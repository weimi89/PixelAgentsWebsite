import * as fs from 'fs';
import * as path from 'path';
import type { AgentContext, AgentState } from './types.js';
import { cancelWaitingTimer, cancelPermissionTimer, clearAgentActivity } from './timerManager.js';
import { processTranscriptLine } from './transcriptParser.js';
import { removeAgent, extractProjectName } from './agentManager.js';
import { resolveFloorForProject } from './floorAssignment.js';
import { FILE_WATCHER_POLL_INTERVAL_MS, PROJECT_SCAN_INTERVAL_MS, ACTIVE_JSONL_MAX_AGE_MS, STALE_AGENT_TIMEOUT_MS, DEFAULT_FLOOR_ID } from './constants.js';

/** 啟動檔案監視（fs.watch + 輪詢備援），偵測 JSONL 檔案變更 */
export function startFileWatching(
	agentId: number,
	filePath: string,
	ctx: AgentContext,
): void {
	const { agents, fileWatchers, pollingTimers } = ctx;

	// 主要方式：fs.watch
	try {
		const watcher = fs.watch(filePath, () => {
			readNewLines(agentId, ctx);
		});
		fileWatchers.set(agentId, watcher);
	} catch (e) {
		console.log(`[Pixel Agents] fs.watch failed for agent ${agentId}: ${e}`);
	}

	// 備援：每 2 秒輪詢
	const interval = setInterval(() => {
		if (!agents.has(agentId)) { clearInterval(interval); return; }
		readNewLines(agentId, ctx);
	}, FILE_WATCHER_POLL_INTERVAL_MS);
	pollingTimers.set(agentId, interval);
}

/** 讀取 JSONL 檔案中的新增行，逐行交給轉錄解析器處理 */
export function readNewLines(
	agentId: number,
	ctx: AgentContext,
): void {
	const { agents, waitingTimers, permissionTimers } = ctx;
	const agent = agents.get(agentId);
	if (!agent) return;
	const sender = ctx.floorSender(agent.floorId);
	try {
		const stat = fs.statSync(agent.jsonlFile);
		if (stat.size <= agent.fileOffset) return;

		const buf = Buffer.alloc(stat.size - agent.fileOffset);
		const fd = fs.openSync(agent.jsonlFile, 'r');
		try {
			fs.readSync(fd, buf, 0, buf.length, agent.fileOffset);
		} finally {
			fs.closeSync(fd);
		}
		agent.fileOffset = stat.size;

		const text = agent.lineBuffer + buf.toString('utf-8');
		const lines = text.split('\n');
		agent.lineBuffer = lines.pop() || '';

		const hasLines = lines.some(l => l.trim());
		if (hasLines) {
			cancelWaitingTimer(agentId, waitingTimers);
			cancelPermissionTimer(agentId, permissionTimers);
			if (agent.permissionSent) {
				agent.permissionSent = false;
				sender?.postMessage({ type: 'agentToolPermissionClear', id: agentId });
			}
		}

		for (const line of lines) {
			if (!line.trim()) continue;
			processTranscriptLine(agentId, line, ctx);
		}
	} catch (e) {
		console.log(`[Pixel Agents] Read error for agent ${agentId}: ${e}`);
	}
}

/** 檢查 JSONL 檔案是否最近被修改過（視為「活躍」） */
function isRecentlyActive(filePath: string): boolean {
	try {
		const stat = fs.statSync(filePath);
		return (Date.now() - stat.mtimeMs) < ACTIVE_JSONL_MAX_AGE_MS;
	} catch {
		return false;
	}
}

/** 檢查 JSONL 檔案是否已被現有代理追蹤 */
function isTrackedByAgent(filePath: string, ctx: AgentContext): boolean {
	return ctx.trackedJsonlFiles.has(filePath);
}

/** 啟動定期專案掃描，自動偵測並收養活躍的 Claude 會話 */
export function ensureProjectScan(
	projectDirs: string[],
	projectScanTimerRef: { current: ReturnType<typeof setInterval> | null },
	ctx: AgentContext,
): void {
	if (projectScanTimerRef.current) return;

	// 初始掃描：收養所有專案目錄中的活躍 JSONL 檔案
	for (const dir of projectDirs) {
		scanAndAdopt(dir, ctx);
	}

	// 定期掃描新會話
	projectScanTimerRef.current = setInterval(() => {
		for (const dir of projectDirs) {
			scanAndAdopt(dir, ctx);
		}
	}, PROJECT_SCAN_INTERVAL_MS);
}

/** 掃描單一專案目錄，收養活躍的外部 Claude 會話 */
function scanAndAdopt(
	projectDir: string,
	ctx: AgentContext,
): void {
	const { knownJsonlFiles, nextAgentIdRef, agents, persistAgents } = ctx;

	let files: string[];
	try {
		files = fs.readdirSync(projectDir)
			.filter(f => f.endsWith('.jsonl'))
			.map(f => path.join(projectDir, f));
	} catch { return; }

	for (const file of files) {
		knownJsonlFiles.add(file);

		// 跳過已被代理追蹤的檔案
		if (isTrackedByAgent(file, ctx)) continue;

		// 僅收養最近活躍的檔案
		if (!isRecentlyActive(file)) continue;

		// 自動收養：為此外部 Claude 會話建立代理
		const floorId = resolveFloorForProject(projectDir, ctx.building);
		const id = nextAgentIdRef.current++;
		const agent: AgentState = {
			id,
			process: null, // 外部進程 — 非我們管理
			projectDir,
			jsonlFile: file,
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
		};
		agents.set(id, agent);
		ctx.trackedJsonlFiles.set(file, id);
		persistAgents();
		console.log(`[Pixel Agents] Auto-adopted session: ${path.basename(file)} → Agent ${id} (floor: ${floorId})`);
		const isExternal = projectDir !== ctx.ownProjectDir;
		ctx.floorSender(floorId).postMessage({
			type: 'agentCreated',
			id,
			projectName: extractProjectName(projectDir),
			floorId,
			...(isExternal ? { isExternal: true } : {}),
		});

		// 立即開始監視檔案
		startFileWatching(id, file, ctx);
		readNewLines(id, ctx);
	}

	// 檢查過期代理（JSONL 檔案不再被寫入）
	checkStaleAgents(ctx);
}

/** 移除 JSONL 檔案最近未更新且沒有受管理進程的代理 */
function checkStaleAgents(ctx: AgentContext): void {
	const { agents } = ctx;

	const staleIds: number[] = [];
	for (const [id, agent] of agents) {
		// 僅檢查自動收養的代理（無受管理的進程、無 tmux 會話）
		if (agent.process || agent.tmuxSessionName) continue;
		try {
			const stat = fs.statSync(agent.jsonlFile);
			const age = Date.now() - stat.mtimeMs;
			// 使用較長的過期閾值（10 分鐘），容忍 extended thinking 等長時間無寫入的情況
			if (age > STALE_AGENT_TIMEOUT_MS) {
				console.log(`[Pixel Agents] Agent ${id}: session stale (${Math.round(age / 1000)}s), removing`);
				staleIds.push(id);
			}
		} catch {
			// 檔案已消失 — 移除代理
			staleIds.push(id);
		}
	}
	for (const id of staleIds) {
		const agent = agents.get(id);
		const floorId = agent?.floorId || DEFAULT_FLOOR_ID;
		const floorSend = ctx.floorSender(floorId);
		if (agent && agent.activeToolIds.size > 0) {
			agent.activeToolIds.clear();
			agent.activeToolStatuses.clear();
			agent.activeToolNames.clear();
			agent.activeSubagentToolIds.clear();
			agent.activeSubagentToolNames.clear();
			floorSend.postMessage({ type: 'agentToolsClear', id });
		}
		removeAgent(id, ctx);
		floorSend.postMessage({ type: 'agentClosed', id });
	}
}

/** 將代理重新指派到新的 JSONL 檔案（例如 /clear 後建立的新檔案） */
export function reassignAgentToFile(
	agentId: number,
	newFilePath: string,
	ctx: AgentContext,
): void {
	const { agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, persistAgents } = ctx;
	const agent = agents.get(agentId);
	if (!agent) return;

	fileWatchers.get(agentId)?.close();
	fileWatchers.delete(agentId);
	const pt = pollingTimers.get(agentId);
	if (pt) { clearInterval(pt); }
	pollingTimers.delete(agentId);

	cancelWaitingTimer(agentId, waitingTimers);
	cancelPermissionTimer(agentId, permissionTimers);
	clearAgentActivity(agent, agentId, permissionTimers, ctx.floorSender(agent.floorId));

	ctx.trackedJsonlFiles.delete(agent.jsonlFile);
	agent.jsonlFile = newFilePath;
	ctx.trackedJsonlFiles.set(newFilePath, agentId);
	agent.fileOffset = 0;
	agent.lineBuffer = '';
	persistAgents();

	startFileWatching(agentId, newFilePath, ctx);
	readNewLines(agentId, ctx);
}
