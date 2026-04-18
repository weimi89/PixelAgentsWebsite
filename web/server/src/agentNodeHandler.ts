/**
 * agentNodeHandler — 遠端 Agent Node 的 Socket.IO namespace 管理
 *
 * 職責：
 *   - /agent-node namespace 的 JWT 認證與連線管理
 *   - 接收 Agent Node 推送的事件（agentStarted、toolStart/Done、transcript…），
 *     轉換為標準代理事件並廣播至瀏覽器客戶端
 *   - 為遠端代理的瀏覽器終端提供雙向中繼（browser ↔ server ↔ Agent Node PTY）
 *   - 心跳監測（timeout 後強制斷線）
 *   - 斷線寬限期：grace 期內同 sessionId 重連可無縫恢復（不移除代理）
 *
 * 關鍵設計：
 *   - remoteAgentMap：sessionId → agentId 反查表（遠端事件帶 sessionId，需轉為 agentId 才能找到代理）
 *   - ownedSessions：每個 socket 擁有的 sessionId 集合；斷線時這些代理進入 grace
 *   - orphanedRemoteAgents：grace 期內保留代理實體但標記 isDetached，重連時可復活
 *   - 終端中繼是獨立的 Map（remoteTerminalSockets / remoteTerminalNodeSockets）
 *     用於 browser WebSocket ↔ Agent Node 的雙向 pipe；斷線時立即釋放（不走 grace）
 */
import type { Server, Socket } from 'socket.io';
import type { AgentContext, AgentState } from './types.js';
import type { AgentNodeEvent, ServerNodeMessage } from 'pixel-agents-shared';
import { verifyToken } from './auth/jwt.js';
import { resolveFloorForProject } from './floorAssignment.js';
import { removeAgent } from './agentManager.js';
import { cancelPermissionTimer } from './timerManager.js';
import { appendStatusHistory } from './transcriptParser.js';
import { readExcludedProjects } from './projectNameStore.js';
import {
	MAX_TRANSCRIPT_LOG,
	TOOL_DONE_DELAY_MS,
	AGENT_NODE_HEARTBEAT_TIMEOUT_MS,
	AGENT_NODE_RECONNECT_GRACE_MS,
} from './constants.js';

interface SocketData {
	user: { userId: string; username: string };
	/** 此 socket 擁有的遠端代理 sessionId 集合 */
	ownedSessions: Set<string>;
	/** 最後一次收到心跳的時間戳 */
	lastHeartbeat: number;
	/** 最近一次心跳延遲（毫秒） */
	latencyMs: number;
	/** 連線建立時間戳 */
	connectedAt: number;
}

/** 已連線節點的摘要資訊 */
export interface ConnectedNodeInfo {
	username: string;
	socketId: string;
	latencyMs: number;
	activeSessions: number;
	connectedAt: number;
	lastHeartbeat: number;
}

/** 瀏覽器終端 WebSocket 的最小介面（避免直接依賴 ws 模組） */
export interface TerminalWebSocket {
	readyState: number;
	send(data: string | Buffer): void;
	close(): void;
}

/** 遠端終端中繼映射：remoteSessionId → 瀏覽器端 WebSocket 連線 */
const remoteTerminalSockets = new Map<string, TerminalWebSocket>();

/** 遠端終端映射（反向）：remoteSessionId → Agent Node socket id（用於清理） */
const remoteTerminalNodeSockets = new Map<string, string>();

/** 心跳超時檢查計時器（供關閉清理用） */
let heartbeatCheckInterval: ReturnType<typeof setInterval> | null = null;

/** Agent Node namespace 參考（供外部廣播使用） */
let agentNodeNamespace: ReturnType<Server['of']> | null = null;

/** 斷線代理的寬限期：sessionId → 清除計時器。在此期間同一 sessionId 重新連入可無縫恢復。 */
const orphanedRemoteAgents = new Map<string, { agentId: number; timer: ReturnType<typeof setTimeout> }>();

/** 設定 Agent Node 的 Socket.IO namespace（/agent-node） */
export function setupAgentNodeNamespace(io: Server, ctx: AgentContext): void {
	// 建立（或取得）/agent-node 子 namespace，與瀏覽器用的主 namespace 隔離
	const ns = io.of('/agent-node');
	// 儲存參考供外部（終端中繼、排除專案廣播）使用
	agentNodeNamespace = ns;

	// JWT 認證中介層：所有連線都要先驗 token，否則拒絕
	ns.use((socket, next) => {
		// Agent Node CLI 登入後會把 token 放在 handshake.auth
		const token = socket.handshake.auth?.token as string | undefined;
		if (!token) {
			next(new Error('Authentication required'));
			return;
		}
		try {
			// 驗簽 + 解析 payload（內含 userId、username）
			const payload = verifyToken(token);
			const now = Date.now();
			// 把使用者資訊與連線狀態附在 socket.data 上供後續 handler 取用
			(socket as Socket & { data: SocketData }).data = {
				user: payload,
				ownedSessions: new Set(),
				lastHeartbeat: now,
				latencyMs: 0,
				connectedAt: now,
			};
			next();
		} catch {
			// 簽名無效 / 過期 → 拒絕連線
			next(new Error('Authentication failed'));
		}
	});

	ns.on('connection', (rawSocket) => {
		// 將 raw socket cast 為附帶 SocketData 的型別
		const socket = rawSocket as Socket & { data: SocketData };
		const { username } = socket.data.user;
		console.log(`[Pixel Agents] Agent Node connected: ${username} (${socket.id})`);

		// 向 Agent Node 回報認證成功（含 userId 供其記錄擁有者身分）
		socket.emit('message', { type: 'authenticated', userId: socket.data.user.userId } satisfies ServerNodeMessage);

		// 連線後立即同步使用者的排除專案清單（Node 不會掃描這些目錄）
		const excluded = readExcludedProjects();
		socket.emit('message', { type: 'excludedProjectsSync', excluded } satisfies ServerNodeMessage);

		// 註冊事件處理器：所有 Agent Node 事件都透過 'event' 訊息型別
		socket.on('event', (event: AgentNodeEvent) => {
			handleAgentNodeEvent(event, socket, ctx);
		});

		socket.on('disconnect', () => {
			console.log(`[Pixel Agents] Agent Node disconnected: ${username} (${socket.id}) — entering ${AGENT_NODE_RECONNECT_GRACE_MS / 1000}s grace`);
			// 終端中繼必須立即釋放（使用者無法透過失效 socket 收資料）— 不走 grace
			cleanupTerminalRelaysForSocket(socket.id);

			// 將此 socket 擁有的代理標記為 orphaned；grace 期內同 sessionId 重連可恢復
			for (const sessionId of socket.data.ownedSessions) {
				const agentId = ctx.remoteAgentMap.get(sessionId);
				if (agentId === undefined) continue;
				const agent = ctx.agents.get(agentId);
				if (!agent) continue;
				// 前端以橘色光暈/斷線圖示顯示 detached 狀態
				agent.isDetached = true;
				ctx.floorSender(agent.floorId).postMessage({ type: 'agentDetached', id: agentId, detached: true });

				// 罕見情境：同 sessionId 連續兩次 disconnect（中間沒來得及 reconnect）— 先清舊 timer
				const prev = orphanedRemoteAgents.get(sessionId);
				if (prev) clearTimeout(prev.timer);

				// 排程 grace 到期清理：30s 後若仍未重連就真正移除代理
				const timer = setTimeout(() => {
					orphanedRemoteAgents.delete(sessionId);
					// 重新查一次（可能在 grace 期間已被其他路徑清除）
					const stillAgentId = ctx.remoteAgentMap.get(sessionId);
					if (stillAgentId === undefined) return;
					const stillAgent = ctx.agents.get(stillAgentId);
					if (!stillAgent) return;
					console.log(`[Pixel Agents] Grace expired, removing orphaned remote agent ${stillAgentId} (session: ${sessionId})`);
					const floorId = stillAgent.floorId;
					// 實際移除代理（含 watcher / timer 清理）
					removeAgent(stillAgentId, ctx);
					ctx.remoteAgentMap.delete(sessionId);
					ctx.floorSender(floorId).postMessage({ type: 'agentClosed', id: stillAgentId });
					ctx.broadcastFloorSummaries();
				}, AGENT_NODE_RECONNECT_GRACE_MS);
				// 記錄以便重連時取消
				orphanedRemoteAgents.set(sessionId, { agentId, timer });
			}
			// 清空此 socket 的 session 集合（grace 期間以 orphanedRemoteAgents 為準）
			socket.data.ownedSessions.clear();
			ctx.broadcastFloorSummaries();
		});
	});

	// 心跳超時檢查：每 timeout/3 掃一次，超過 timeout 未收心跳就強制斷線
	const checkIntervalMs = Math.floor(AGENT_NODE_HEARTBEAT_TIMEOUT_MS / 3);
	heartbeatCheckInterval = setInterval(() => {
		const now = Date.now();
		// 走訪所有連線中的 socket
		for (const [, rawSocket] of ns.sockets) {
			const socket = rawSocket as Socket & { data: SocketData };
			// 超過 timeout 毫秒沒收到心跳 → 視為連線掛掉
			if (now - socket.data.lastHeartbeat > AGENT_NODE_HEARTBEAT_TIMEOUT_MS) {
				console.log(
					`[Pixel Agents] Agent Node heartbeat timeout: ${socket.data.user.username} (${socket.id}), ` +
					`last heartbeat ${Math.round((now - socket.data.lastHeartbeat) / 1000)}s ago`,
				);
				// true = 關閉底層連線（不等 ack）；會觸發上面的 disconnect handler
				socket.disconnect(true);
			}
		}
	}, checkIntervalMs);
}

/** 清理心跳檢查計時器（伺服器關閉時呼叫） */
export function cleanupAgentNodeHeartbeat(): void {
	if (heartbeatCheckInterval) {
		clearInterval(heartbeatCheckInterval);
		heartbeatCheckInterval = null;
	}
	// 一併清除所有待決的 orphan grace timer（伺服器關閉時不應再觸發）
	for (const { timer } of orphanedRemoteAgents.values()) {
		clearTimeout(timer);
	}
	orphanedRemoteAgents.clear();
}

/** 取得所有已連線的 Agent Node 摘要 */
export function getConnectedNodes(): ConnectedNodeInfo[] {
	if (!agentNodeNamespace) return [];
	const nodes: ConnectedNodeInfo[] = [];
	for (const [, rawSocket] of agentNodeNamespace.sockets) {
		const socket = rawSocket as Socket & { data: SocketData };
		nodes.push({
			username: socket.data.user.username,
			socketId: socket.id,
			latencyMs: socket.data.latencyMs,
			activeSessions: socket.data.ownedSessions.size,
			connectedAt: socket.data.connectedAt,
			lastHeartbeat: socket.data.lastHeartbeat,
		});
	}
	return nodes;
}

/** 向所有 Agent Node 廣播排除專案清單 */
export function broadcastExcludedProjectsToNodes(io: Server, excluded: string[]): void {
	const ns = io.of('/agent-node');
	ns.emit('message', { type: 'excludedProjectsSync', excluded } satisfies ServerNodeMessage);
}

/** 向所有 Agent Node 廣播排除專案清單（使用已儲存的 namespace） */
export function syncExcludedProjectsToNodes(excluded: string[]): void {
	if (!agentNodeNamespace) return;
	agentNodeNamespace.emit('message', { type: 'excludedProjectsSync', excluded } satisfies ServerNodeMessage);
}

/**
 * 為遠端代理啟動終端中繼。
 * 找到擁有該 sessionId 的 Agent Node socket，傳送 terminalAttach，
 * 並註冊瀏覽器 WebSocket 以接收回傳的終端資料。
 * @returns true 如果成功啟動中繼，false 如果找不到 Agent Node
 */
export function startRemoteTerminalRelay(
	remoteSessionId: string,
	browserWs: TerminalWebSocket,
	cols: number,
	rows: number,
): boolean {
	if (!agentNodeNamespace) return false;

	// 找到擁有此 sessionId 的 Agent Node socket
	let targetSocket: (Socket & { data: SocketData }) | null = null;
	for (const [, rawSocket] of agentNodeNamespace.sockets) {
		const sock = rawSocket as Socket & { data: SocketData };
		if (sock.data.ownedSessions.has(remoteSessionId)) {
			targetSocket = sock;
			break;
		}
	}

	if (!targetSocket) return false;

	// 註冊映射
	remoteTerminalSockets.set(remoteSessionId, browserWs);
	remoteTerminalNodeSockets.set(remoteSessionId, targetSocket.id);

	// 發送 terminalAttach 至 Agent Node
	targetSocket.emit('message', {
		type: 'terminalAttach',
		sessionId: remoteSessionId,
		cols,
		rows,
	} satisfies ServerNodeMessage);

	return true;
}

/** 轉發終端輸入至遠端 Agent Node */
export function sendRemoteTerminalInput(remoteSessionId: string, data: string): void {
	if (!agentNodeNamespace) return;
	const nodeSocketId = remoteTerminalNodeSockets.get(remoteSessionId);
	if (!nodeSocketId) return;

	const rawSocket = agentNodeNamespace.sockets.get(nodeSocketId);
	if (!rawSocket) return;

	rawSocket.emit('message', {
		type: 'terminalInput',
		sessionId: remoteSessionId,
		data,
	} satisfies ServerNodeMessage);
}

/** 轉發終端 resize 至遠端 Agent Node */
export function sendRemoteTerminalResize(remoteSessionId: string, cols: number, rows: number): void {
	if (!agentNodeNamespace) return;
	const nodeSocketId = remoteTerminalNodeSockets.get(remoteSessionId);
	if (!nodeSocketId) return;

	const rawSocket = agentNodeNamespace.sockets.get(nodeSocketId);
	if (!rawSocket) return;

	rawSocket.emit('message', {
		type: 'terminalResize',
		sessionId: remoteSessionId,
		cols,
		rows,
	} satisfies ServerNodeMessage);
}

/** 中斷遠端終端中繼（由瀏覽器端觸發） */
export function detachRemoteTerminal(remoteSessionId: string): void {
	if (!agentNodeNamespace) return;
	const nodeSocketId = remoteTerminalNodeSockets.get(remoteSessionId);

	// 清理映射
	remoteTerminalSockets.delete(remoteSessionId);
	remoteTerminalNodeSockets.delete(remoteSessionId);

	if (!nodeSocketId) return;
	const rawSocket = agentNodeNamespace.sockets.get(nodeSocketId);
	if (!rawSocket) return;

	rawSocket.emit('message', {
		type: 'terminalDetach',
		sessionId: remoteSessionId,
	} satisfies ServerNodeMessage);
}

/**
 * 向擁有指定 sessionId 的 Agent Node 發送 resumeSession 指令。
 * @returns true 如果找到對應的 Agent Node 並已發送，false 如果找不到
 */
export function forwardResumeSessionToNode(
	remoteSessionId: string,
	sessionId: string,
	projectDir: string,
): boolean {
	if (!agentNodeNamespace) return false;

	// 找到擁有此 remoteSessionId 的 Agent Node socket
	for (const [, rawSocket] of agentNodeNamespace.sockets) {
		const sock = rawSocket as Socket & { data: SocketData };
		if (sock.data.ownedSessions.has(remoteSessionId)) {
			sock.emit('message', {
				type: 'resumeSession',
				sessionId,
				projectDir,
			} satisfies ServerNodeMessage);
			return true;
		}
	}

	return false;
}

/** 檢查指定 remoteSessionId 是否已有活躍的終端中繼 */
export function hasRemoteTerminalRelay(remoteSessionId: string): boolean {
	return remoteTerminalSockets.has(remoteSessionId);
}

/** 清理指定 Agent Node socket 的所有終端中繼（斷線時呼叫） */
function cleanupTerminalRelaysForSocket(socketId: string): void {
	for (const [sessionId, nodeSocketId] of remoteTerminalNodeSockets) {
		if (nodeSocketId === socketId) {
			const browserWs = remoteTerminalSockets.get(sessionId);
			if (browserWs && browserWs.readyState === 1) {
				browserWs.send(JSON.stringify({ type: 'exit', code: 1 }));
			}
			remoteTerminalSockets.delete(sessionId);
			remoteTerminalNodeSockets.delete(sessionId);
		}
	}
}

/** 清理指定 remoteSessionId 的終端中繼（代理停止時呼叫） */
function cleanupTerminalRelayForSession(sessionId: string): void {
	const browserWs = remoteTerminalSockets.get(sessionId);
	if (browserWs && browserWs.readyState === 1) {
		browserWs.send(JSON.stringify({ type: 'exit', code: 1 }));
	}
	remoteTerminalSockets.delete(sessionId);
	remoteTerminalNodeSockets.delete(sessionId);
}

function handleAgentNodeEvent(
	event: AgentNodeEvent,
	socket: Socket & { data: SocketData },
	ctx: AgentContext,
): void {
	const { username } = socket.data.user;

	// sessionResumed 回報（Agent Node 恢復會話的結果）
	if (event.type === 'sessionResumed') {
		const agentId = ctx.remoteAgentMap.get(event.sessionId);
		if (event.success) {
			console.log(`[Pixel Agents] Remote session resumed: ${event.sessionId} (agent=${agentId})`);
		} else {
			console.warn(`[Pixel Agents] Remote session resume failed: ${event.sessionId} - ${event.error}`);
		}
		// 通知所有瀏覽器客戶端結果
		ctx.sender?.postMessage({
			type: 'remoteSessionResumed',
			sessionId: event.sessionId,
			success: event.success,
			error: event.error,
		});
		return;
	}

	// 終端事件不需要 agentId 查詢，直接轉發至瀏覽器 WebSocket
	if (event.type === 'terminalData') {
		const browserWs = remoteTerminalSockets.get(event.sessionId);
		if (browserWs && browserWs.readyState === 1) {
			browserWs.send(Buffer.from(event.data, 'utf-8'));
		}
		return;
	}
	if (event.type === 'terminalReady') {
		const browserWs = remoteTerminalSockets.get(event.sessionId);
		if (browserWs && browserWs.readyState === 1) {
			// 查找 agentId 以發送 attached 訊息
			const agentId = ctx.remoteAgentMap.get(event.sessionId);
			browserWs.send(JSON.stringify({ type: 'attached', agentId: agentId ?? -1 }));
		}
		return;
	}
	if (event.type === 'terminalExit') {
		const browserWs = remoteTerminalSockets.get(event.sessionId);
		if (browserWs && browserWs.readyState === 1) {
			browserWs.send(JSON.stringify({ type: 'exit', code: event.code }));
		}
		remoteTerminalSockets.delete(event.sessionId);
		remoteTerminalNodeSockets.delete(event.sessionId);
		return;
	}
	if (event.type === 'terminalError') {
		const browserWs = remoteTerminalSockets.get(event.sessionId);
		if (browserWs && browserWs.readyState === 1) {
			browserWs.send(JSON.stringify({ type: 'error', message: event.message }));
		}
		remoteTerminalSockets.delete(event.sessionId);
		remoteTerminalNodeSockets.delete(event.sessionId);
		return;
	}

	// 心跳不需要 sessionId 查詢，提前處理並返回
	if (event.type === 'heartbeat') {
		const now = Date.now();
		socket.data.lastHeartbeat = now;
		socket.data.latencyMs = now - event.timestamp;
		socket.emit('message', {
			type: 'heartbeatAck',
			timestamp: event.timestamp,
			serverTime: now,
		} satisfies ServerNodeMessage);
		return;
	}

	switch (event.type) {
		case 'agentStarted': {
			// 分支 A：重連復活路徑 — 先檢查 orphan 表是否有等待中的代理
			const orphan = orphanedRemoteAgents.get(event.sessionId);
			if (orphan) {
				// 取消 grace 清理 timer 避免等等真的被移除
				clearTimeout(orphan.timer);
				orphanedRemoteAgents.delete(event.sessionId);
				const existingAgent = ctx.agents.get(orphan.agentId);
				if (existingAgent) {
					// 代理還活著 → 復活（清除斷線標記、更新 owner）
					existingAgent.isDetached = false;
					existingAgent.owner = username;
					existingAgent.ownerId = socket.data.user.userId;
					// 新 socket 接管此 session
					socket.data.ownedSessions.add(event.sessionId);
					console.log(`[Pixel Agents] Remote agent ${orphan.agentId} recovered from grace (session: ${event.sessionId})`);
					// 回傳既有 agentId 給 Node（Node 會沿用此 ID 繼續推送事件）
					socket.emit('message', {
						type: 'agentRegistered',
						sessionId: event.sessionId,
						agentId: orphan.agentId,
					} satisfies ServerNodeMessage);
					// 通知前端解除斷線顯示
					ctx.floorSender(existingAgent.floorId).postMessage({
						type: 'agentDetached',
						id: orphan.agentId,
						detached: false,
					});
					ctx.broadcastFloorSummaries();
					return;
				}
				// 保險分支：orphan 表有但代理實體已被清掉 → 走建立新代理流程
			}

			// 分支 B：重複註冊防護（不該發生，但保險）
			if (ctx.remoteAgentMap.has(event.sessionId)) return;

			// 分支 C：建立新的遠端代理
			const id = ctx.nextAgentIdRef.current++;
			// 依專案決定樓層
			const floorId = resolveFloorForProject(event.projectDir, ctx.building);
			// 遠端代理的 state：process=null（非本機 spawn）、jsonlFile=''（無檔案監視）、isRemote=true
			const agent: AgentState = {
				id,
				process: null,
				projectDir: event.projectDir,
				jsonlFile: '', // 遠端代理沒有本機 JSONL 檔，由 Node 推送事件取代
				fileOffset: 0,
				lineBuffer: '',
				activeToolIds: new Set(),
				activeToolStatuses: new Map(),
				activeToolNames: new Map(),
				activeSubagentToolIds: new Map(),
				activeSubagentToolNames: new Map(),
				isWaiting: false,
				permissionSent: false,
				hadToolsInTurn: false,
				model: null,
				tmuxSessionName: null,
				isDetached: false,
				transcriptLog: [],
				floorId,
				isRemote: true,
				owner: username,
				ownerId: socket.data.user.userId,
				remoteSessionId: event.sessionId,
				gitBranch: null,
				statusHistory: [],
				teamName: null,
				cliType: 'claude',
				startedAt: Date.now(),
				growth: { xp: 0, toolCallCount: 0, sessionCount: 0, bashCallCount: 0, achievements: [] },
			};

			// 註冊到主 Map + 反查表 + socket 擁有集合
			ctx.agents.set(id, agent);
			ctx.remoteAgentMap.set(event.sessionId, id);
			socket.data.ownedSessions.add(event.sessionId);
			ctx.incrementFloorCount(floorId);
			ctx.persistAgents();

			console.log(`[Pixel Agents] Remote agent ${id} started: ${event.projectName} (owner: ${username}, floor: ${floorId})`);

			// 通知同樓層瀏覽器：新增角色（橘色光暈 + @owner 標籤）
			ctx.floorSender(floorId).postMessage({
				type: 'agentCreated',
				id,
				projectName: event.projectName,
				floorId,
				startedAt: agent.startedAt,
				isRemote: true,
				owner: username,
				ownerId: socket.data.user.userId,
			});
			ctx.broadcastFloorSummaries();

			// 回報 Node 已註冊成功（Node 可能根據此 agentId 記錄本地映射）
			socket.emit('message', {
				type: 'agentRegistered',
				sessionId: event.sessionId,
				agentId: id,
			} satisfies ServerNodeMessage);
			break;
		}

		case 'agentStopped': {
			// 使用者在 Node 端明確結束會話 → 不走 grace，直接移除
			// 先清掉可能存在的 orphan timer（防止稍後重複觸發）
			const orphan = orphanedRemoteAgents.get(event.sessionId);
			if (orphan) {
				clearTimeout(orphan.timer);
				orphanedRemoteAgents.delete(event.sessionId);
			}
			// 反查 agentId；找不到代表早已清除，無事可做
			const agentId = ctx.remoteAgentMap.get(event.sessionId);
			if (agentId === undefined) return;
			const agent = ctx.agents.get(agentId);
			if (!agent) return;
			const floorId = agent.floorId;

			// 終端中繼立即斷開（相關 WebSocket 會收到 exit code 1）
			cleanupTerminalRelayForSession(event.sessionId);

			// 實際移除代理 + 清掉反查表 + 從 socket 擁有集合移除
			removeAgent(agentId, ctx);
			ctx.remoteAgentMap.delete(event.sessionId);
			socket.data.ownedSessions.delete(event.sessionId);

			// 通知同樓層瀏覽器移除角色
			ctx.floorSender(floorId).postMessage({ type: 'agentClosed', id: agentId });
			ctx.broadcastFloorSummaries();
			break;
		}

		case 'toolStart': {
			const agentId = ctx.remoteAgentMap.get(event.sessionId);
			if (agentId === undefined) return;
			const agent = ctx.agents.get(agentId);
			if (!agent) return;
			const sender = ctx.floorSender(agent.floorId);

			agent.activeToolIds.add(event.toolId);
			agent.activeToolStatuses.set(event.toolId, event.toolStatus);
			agent.activeToolNames.set(event.toolId, event.toolName);
			agent.hadToolsInTurn = true;

			sender.postMessage({
				type: 'agentToolStart',
				id: agentId,
				toolId: event.toolId,
				status: event.toolStatus,
			});
			sender.postMessage({ type: 'agentStatus', id: agentId, status: 'active' });
			appendStatusHistory(agent, 'active', event.toolStatus);
			break;
		}

		case 'toolDone': {
			const agentId = ctx.remoteAgentMap.get(event.sessionId);
			if (agentId === undefined) return;
			const agent = ctx.agents.get(agentId);
			if (!agent) return;
			const sender = ctx.floorSender(agent.floorId);

			const doneToolName = agent.activeToolNames.get(event.toolId);
			agent.activeToolIds.delete(event.toolId);
			agent.activeToolStatuses.delete(event.toolId);
			agent.activeToolNames.delete(event.toolId);

			if (agent.activeToolIds.size === 0) {
				agent.hadToolsInTurn = false;
			}

			appendStatusHistory(agent, 'tool_done', doneToolName || 'unknown');
			const toolId = event.toolId;
			setTimeout(() => {
				sender.postMessage({ type: 'agentToolDone', id: agentId, toolId });
			}, TOOL_DONE_DELAY_MS);
			break;
		}

		case 'agentThinking': {
			const agentId = ctx.remoteAgentMap.get(event.sessionId);
			if (agentId === undefined) return;
			const agent = ctx.agents.get(agentId);
			if (!agent) return;
			ctx.floorSender(agent.floorId).postMessage({
				type: 'agentThinking', id: agentId, thinking: true,
			});
			break;
		}

		case 'agentEmote': {
			const agentId = ctx.remoteAgentMap.get(event.sessionId);
			if (agentId === undefined) return;
			const agent = ctx.agents.get(agentId);
			if (!agent) return;
			ctx.floorSender(agent.floorId).postMessage({
				type: 'agentEmote', id: agentId, emote: event.emoteType,
			});
			break;
		}

		case 'subtaskStart': {
			const agentId = ctx.remoteAgentMap.get(event.sessionId);
			if (agentId === undefined) return;
			const agent = ctx.agents.get(agentId);
			if (!agent) return;
			const sender = ctx.floorSender(agent.floorId);

			let subTools = agent.activeSubagentToolIds.get(event.parentToolId);
			if (!subTools) {
				subTools = new Set();
				agent.activeSubagentToolIds.set(event.parentToolId, subTools);
			}
			subTools.add(event.toolId);

			let subNames = agent.activeSubagentToolNames.get(event.parentToolId);
			if (!subNames) {
				subNames = new Map();
				agent.activeSubagentToolNames.set(event.parentToolId, subNames);
			}
			subNames.set(event.toolId, event.toolName);

			sender.postMessage({
				type: 'subagentToolStart',
				id: agentId,
				parentToolId: event.parentToolId,
				toolId: event.toolId,
				status: event.toolStatus,
			});
			break;
		}

		case 'subtaskDone': {
			const agentId = ctx.remoteAgentMap.get(event.sessionId);
			if (agentId === undefined) return;
			const agent = ctx.agents.get(agentId);
			if (!agent) return;
			const sender = ctx.floorSender(agent.floorId);

			const subTools = agent.activeSubagentToolIds.get(event.parentToolId);
			if (subTools) subTools.delete(event.toolId);
			const subNames = agent.activeSubagentToolNames.get(event.parentToolId);
			if (subNames) subNames.delete(event.toolId);

			const toolId = event.toolId;
			const parentToolId = event.parentToolId;
			setTimeout(() => {
				sender.postMessage({
					type: 'subagentToolDone', id: agentId, parentToolId, toolId,
				});
			}, TOOL_DONE_DELAY_MS);
			break;
		}

		case 'subtaskClear': {
			const agentId = ctx.remoteAgentMap.get(event.sessionId);
			if (agentId === undefined) return;
			const agent = ctx.agents.get(agentId);
			if (!agent) return;

			agent.activeSubagentToolIds.delete(event.parentToolId);
			agent.activeSubagentToolNames.delete(event.parentToolId);

			ctx.floorSender(agent.floorId).postMessage({
				type: 'subagentClear', id: agentId, parentToolId: event.parentToolId,
			});
			break;
		}

		case 'modelDetected': {
			const agentId = ctx.remoteAgentMap.get(event.sessionId);
			if (agentId === undefined) return;
			const agent = ctx.agents.get(agentId);
			if (!agent) return;
			agent.model = event.model;
			ctx.floorSender(agent.floorId).postMessage({
				type: 'agentModel', id: agentId, model: event.model,
			});
			break;
		}

		case 'turnComplete': {
			const agentId = ctx.remoteAgentMap.get(event.sessionId);
			if (agentId === undefined) return;
			const agent = ctx.agents.get(agentId);
			if (!agent) return;
			const sender = ctx.floorSender(agent.floorId);

			cancelPermissionTimer(agentId, ctx.permissionTimers);
			sender.postMessage({ type: 'agentThinking', id: agentId, thinking: false });

			if (agent.activeToolIds.size > 0) {
				agent.activeToolIds.clear();
				agent.activeToolStatuses.clear();
				agent.activeToolNames.clear();
				agent.activeSubagentToolIds.clear();
				agent.activeSubagentToolNames.clear();
				sender.postMessage({ type: 'agentToolsClear', id: agentId });
			}

			agent.isWaiting = true;
			agent.permissionSent = false;
			agent.hadToolsInTurn = false;
			sender.postMessage({ type: 'agentStatus', id: agentId, status: 'waiting' });
			appendStatusHistory(agent, 'waiting', 'turn_complete');
			break;
		}

		case 'statusChange': {
			const agentId = ctx.remoteAgentMap.get(event.sessionId);
			if (agentId === undefined) return;
			const agent = ctx.agents.get(agentId);
			if (!agent) return;
			const sender = ctx.floorSender(agent.floorId);

			if (event.status === 'waiting') {
				agent.isWaiting = true;
				sender.postMessage({ type: 'agentStatus', id: agentId, status: 'waiting' });
				appendStatusHistory(agent, 'waiting');
			} else if (event.status === 'permission') {
				agent.permissionSent = true;
				sender.postMessage({ type: 'agentToolPermission', id: agentId });
				appendStatusHistory(agent, 'permission');
			} else if (event.status === 'idle') {
				agent.isWaiting = false;
				sender.postMessage({ type: 'agentStatus', id: agentId, status: 'active' });
				appendStatusHistory(agent, 'idle');
			}
			break;
		}

		case 'transcript': {
			const agentId = ctx.remoteAgentMap.get(event.sessionId);
			if (agentId === undefined) return;
			const agent = ctx.agents.get(agentId);
			if (!agent) return;
			const sender = ctx.floorSender(agent.floorId);

			const entry = { ts: Date.now(), role: event.role, summary: event.summary };
			agent.transcriptLog.push(entry);
			if (agent.transcriptLog.length > MAX_TRANSCRIPT_LOG) {
				agent.transcriptLog.splice(0, agent.transcriptLog.length - MAX_TRANSCRIPT_LOG);
			}
			sender.postMessage({ type: 'agentTranscript', id: agentId, log: agent.transcriptLog });
			break;
		}
	}
}
