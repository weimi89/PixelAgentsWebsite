import type { Server, Socket } from 'socket.io';
import type { AgentContext, AgentState } from './types.js';
import type { AgentNodeEvent, ServerNodeMessage } from 'pixel-agents-shared';
import { verifyToken } from './auth/jwt.js';
import { resolveFloorForProject } from './floorAssignment.js';
import { removeAgent } from './agentManager.js';
import { cancelPermissionTimer } from './timerManager.js';
import { appendStatusHistory } from './transcriptParser.js';
import { MAX_TRANSCRIPT_LOG, TOOL_DONE_DELAY_MS } from './constants.js';

interface SocketData {
	user: { userId: string; username: string };
	/** 此 socket 擁有的遠端代理 sessionId 集合 */
	ownedSessions: Set<string>;
}

/** 設定 Agent Node 的 Socket.IO namespace（/agent-node） */
export function setupAgentNodeNamespace(io: Server, ctx: AgentContext): void {
	const ns = io.of('/agent-node');

	// JWT 認證中介層
	ns.use((socket, next) => {
		const token = socket.handshake.auth?.token as string | undefined;
		if (!token) {
			next(new Error('Authentication required'));
			return;
		}
		try {
			const payload = verifyToken(token);
			(socket as Socket & { data: SocketData }).data = {
				user: payload,
				ownedSessions: new Set(),
			};
			next();
		} catch {
			next(new Error('Authentication failed'));
		}
	});

	ns.on('connection', (rawSocket) => {
		const socket = rawSocket as Socket & { data: SocketData };
		const { username } = socket.data.user;
		console.log(`[Pixel Agents] Agent Node connected: ${username} (${socket.id})`);

		socket.emit('message', { type: 'authenticated', userId: socket.data.user.userId } satisfies ServerNodeMessage);

		socket.on('event', (event: AgentNodeEvent) => {
			handleAgentNodeEvent(event, socket, ctx);
		});

		socket.on('disconnect', () => {
			console.log(`[Pixel Agents] Agent Node disconnected: ${username} (${socket.id})`);
			// 清除此 socket 擁有的所有遠端代理
			for (const sessionId of socket.data.ownedSessions) {
				const agentId = ctx.remoteAgentMap.get(sessionId);
				if (agentId === undefined) continue;
				const agent = ctx.agents.get(agentId);
				if (!agent) continue;
				const floorId = agent.floorId;
				removeAgent(agentId, ctx);
				ctx.remoteAgentMap.delete(sessionId);
				ctx.floorSender(floorId).postMessage({ type: 'agentClosed', id: agentId });
			}
			socket.data.ownedSessions.clear();
			ctx.broadcastFloorSummaries();
		});
	});
}

function handleAgentNodeEvent(
	event: AgentNodeEvent,
	socket: Socket & { data: SocketData },
	ctx: AgentContext,
): void {
	const { username } = socket.data.user;

	switch (event.type) {
		case 'agentStarted': {
			// 如果此 sessionId 已經有代理，忽略
			if (ctx.remoteAgentMap.has(event.sessionId)) return;

			const id = ctx.nextAgentIdRef.current++;
			const floorId = resolveFloorForProject(event.projectDir, ctx.building);
			const agent: AgentState = {
				id,
				process: null,
				projectDir: event.projectDir,
				jsonlFile: '',
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
				remoteSessionId: event.sessionId,
				gitBranch: null,
				statusHistory: [],
				teamName: null,
				cliType: 'claude',
			};

			ctx.agents.set(id, agent);
			ctx.remoteAgentMap.set(event.sessionId, id);
			socket.data.ownedSessions.add(event.sessionId);
			ctx.incrementFloorCount(floorId);
			ctx.persistAgents();

			console.log(`[Pixel Agents] Remote agent ${id} started: ${event.projectName} (owner: ${username}, floor: ${floorId})`);

			ctx.floorSender(floorId).postMessage({
				type: 'agentCreated',
				id,
				projectName: event.projectName,
				floorId,
				isRemote: true,
				owner: username,
			});
			ctx.broadcastFloorSummaries();

			socket.emit('message', {
				type: 'agentRegistered',
				sessionId: event.sessionId,
				agentId: id,
			} satisfies ServerNodeMessage);
			break;
		}

		case 'agentStopped': {
			const agentId = ctx.remoteAgentMap.get(event.sessionId);
			if (agentId === undefined) return;
			const agent = ctx.agents.get(agentId);
			if (!agent) return;
			const floorId = agent.floorId;

			removeAgent(agentId, ctx);
			ctx.remoteAgentMap.delete(event.sessionId);
			socket.data.ownedSessions.delete(event.sessionId);

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
