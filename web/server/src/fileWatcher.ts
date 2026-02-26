import * as fs from 'fs';
import * as path from 'path';
import type { AgentState, MessageSender } from './types.js';
import { cancelWaitingTimer, cancelPermissionTimer, clearAgentActivity } from './timerManager.js';
import { processTranscriptLine } from './transcriptParser.js';
import { removeAgent } from './agentManager.js';
import { FILE_WATCHER_POLL_INTERVAL_MS, PROJECT_SCAN_INTERVAL_MS, ACTIVE_JSONL_MAX_AGE_MS } from './constants.js';

export function startFileWatching(
	agentId: number,
	filePath: string,
	agents: Map<number, AgentState>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	sender: MessageSender | undefined,
): void {
	// 主要方式：fs.watch
	try {
		const watcher = fs.watch(filePath, () => {
			readNewLines(agentId, agents, waitingTimers, permissionTimers, sender);
		});
		fileWatchers.set(agentId, watcher);
	} catch (e) {
		console.log(`[Pixel Agents] fs.watch failed for agent ${agentId}: ${e}`);
	}

	// 備援：每 2 秒輪詢
	const interval = setInterval(() => {
		if (!agents.has(agentId)) { clearInterval(interval); return; }
		readNewLines(agentId, agents, waitingTimers, permissionTimers, sender);
	}, FILE_WATCHER_POLL_INTERVAL_MS);
	pollingTimers.set(agentId, interval);
}

export function readNewLines(
	agentId: number,
	agents: Map<number, AgentState>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	sender: MessageSender | undefined,
): void {
	const agent = agents.get(agentId);
	if (!agent) return;
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
			processTranscriptLine(agentId, line, agents, waitingTimers, permissionTimers, sender);
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
function isTrackedByAgent(filePath: string, agents: Map<number, AgentState>): boolean {
	for (const agent of agents.values()) {
		if (agent.jsonlFile === filePath) return true;
	}
	return false;
}

export function ensureProjectScan(
	projectDirs: string[],
	knownJsonlFiles: Set<string>,
	projectScanTimerRef: { current: ReturnType<typeof setInterval> | null },
	nextAgentIdRef: { current: number },
	agents: Map<number, AgentState>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
	sender: MessageSender | undefined,
	persistAgents: () => void,
): void {
	if (projectScanTimerRef.current) return;

	// 初始掃描：收養所有專案目錄中的活躍 JSONL 檔案
	for (const dir of projectDirs) {
		scanAndAdopt(
			dir, knownJsonlFiles, nextAgentIdRef, agents,
			fileWatchers, pollingTimers, waitingTimers, permissionTimers,
			jsonlPollTimers, sender, persistAgents,
		);
	}

	// 定期掃描新會話
	projectScanTimerRef.current = setInterval(() => {
		for (const dir of projectDirs) {
			scanAndAdopt(
				dir, knownJsonlFiles, nextAgentIdRef, agents,
				fileWatchers, pollingTimers, waitingTimers, permissionTimers,
				jsonlPollTimers, sender, persistAgents,
			);
		}
	}, PROJECT_SCAN_INTERVAL_MS);
}

function scanAndAdopt(
	projectDir: string,
	knownJsonlFiles: Set<string>,
	nextAgentIdRef: { current: number },
	agents: Map<number, AgentState>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
	sender: MessageSender | undefined,
	persistAgents: () => void,
): void {
	let files: string[];
	try {
		files = fs.readdirSync(projectDir)
			.filter(f => f.endsWith('.jsonl'))
			.map(f => path.join(projectDir, f));
	} catch { return; }

	for (const file of files) {
		knownJsonlFiles.add(file);

		// 跳過已被代理追蹤的檔案
		if (isTrackedByAgent(file, agents)) continue;

		// 僅收養最近活躍的檔案
		if (!isRecentlyActive(file)) continue;

		// 自動收養：為此外部 Claude 會話建立代理
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
		};
		agents.set(id, agent);
		persistAgents();
		console.log(`[Pixel Agents] Auto-adopted session: ${path.basename(file)} → Agent ${id}`);
		sender?.postMessage({ type: 'agentCreated', id });

		// 立即開始監視檔案
		startFileWatching(id, file, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, sender);
		readNewLines(id, agents, waitingTimers, permissionTimers, sender);
	}

	// 檢查過期代理（JSONL 檔案不再被寫入）
	checkStaleAgents(agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, jsonlPollTimers, knownJsonlFiles, sender, persistAgents);
}

/** 移除 JSONL 檔案最近未更新且沒有受管理進程的代理 */
function checkStaleAgents(
	agents: Map<number, AgentState>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
	knownJsonlFiles: Set<string>,
	sender: MessageSender | undefined,
	persistAgents: () => void,
): void {
	const staleIds: number[] = [];
	for (const [id, agent] of agents) {
		// 僅檢查自動收養的代理（無受管理的進程、無 tmux 會話）
		if (agent.process || agent.tmuxSessionName) continue;
		try {
			const stat = fs.statSync(agent.jsonlFile);
			const age = Date.now() - stat.mtimeMs;
			// 如果檔案超過 2 倍閾值未被存取，視為過期
			if (age > ACTIVE_JSONL_MAX_AGE_MS * 2) {
				console.log(`[Pixel Agents] Agent ${id}: session stale (${Math.round(age / 1000)}s), removing`);
				staleIds.push(id);
			}
		} catch {
			// 檔案已消失 — 移除代理
			staleIds.push(id);
		}
	}
	for (const id of staleIds) {
		removeAgent(id, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, jsonlPollTimers, knownJsonlFiles, persistAgents);
		sender?.postMessage({ type: 'agentClosed', id });
	}
}

export function reassignAgentToFile(
	agentId: number,
	newFilePath: string,
	agents: Map<number, AgentState>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	sender: MessageSender | undefined,
	persistAgents: () => void,
): void {
	const agent = agents.get(agentId);
	if (!agent) return;

	fileWatchers.get(agentId)?.close();
	fileWatchers.delete(agentId);
	const pt = pollingTimers.get(agentId);
	if (pt) { clearInterval(pt); }
	pollingTimers.delete(agentId);

	cancelWaitingTimer(agentId, waitingTimers);
	cancelPermissionTimer(agentId, permissionTimers);
	clearAgentActivity(agent, agentId, permissionTimers, sender);

	agent.jsonlFile = newFilePath;
	agent.fileOffset = 0;
	agent.lineBuffer = '';
	persistAgents();

	startFileWatching(agentId, newFilePath, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, sender);
	readNewLines(agentId, agents, waitingTimers, permissionTimers, sender);
}
