import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, execSync } from 'child_process';
import type { AgentState, PersistedAgent, MessageSender } from './types.js';
import { cancelWaitingTimer, cancelPermissionTimer } from './timerManager.js';
import { startFileWatching, readNewLines } from './fileWatcher.js';
import { JSONL_POLL_INTERVAL_MS, LAYOUT_FILE_DIR, AGENTS_FILE_NAME } from './constants.js';
import {
	isTmuxAvailable,
	tmuxSessionName as buildTmuxName,
	createTmuxSession,
	killTmuxSession,
	isTmuxSessionAlive,
	listPixelAgentSessions,
	parseSessionUuid,
} from './tmuxManager.js';

// 啟動時解析 claude 二進位檔案的完整路徑
const CLAUDE_BIN = (() => {
	try {
		return execSync('which claude', { encoding: 'utf-8' }).trim();
	} catch {
		return 'claude'; // 備選
	}
})();

export function getProjectDirPath(cwd: string): string {
	const dirName = cwd.replace(/[^a-zA-Z0-9-]/g, '-');
	return path.join(os.homedir(), '.claude', 'projects', dirName);
}

export function getAllProjectDirs(): string[] {
	const projectsRoot = path.join(os.homedir(), '.claude', 'projects');
	try {
		const entries = fs.readdirSync(projectsRoot, { withFileTypes: true });
		return entries
			.filter(e => e.isDirectory())
			.map(e => path.join(projectsRoot, e.name));
	} catch {
		return [];
	}
}

// ── 持久化 ─────────────────────────────────────────────

function getAgentsFilePath(): string {
	return path.join(os.homedir(), LAYOUT_FILE_DIR, AGENTS_FILE_NAME);
}

export function savePersistedAgents(agents: Map<number, AgentState>): void {
	const data: PersistedAgent[] = [];
	for (const agent of agents.values()) {
		// 從 JSONL 檔名中提取會話 ID
		const sessionId = path.basename(agent.jsonlFile, '.jsonl');
		data.push({
			id: agent.id,
			sessionId,
			jsonlFile: agent.jsonlFile,
			projectDir: agent.projectDir,
			tmuxSessionName: agent.tmuxSessionName ?? undefined,
		});
	}
	try {
		const filePath = getAgentsFilePath();
		const dir = path.dirname(filePath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
	} catch (err) {
		console.error('[Pixel Agents] Failed to persist agents:', err);
	}
}

export function loadPersistedAgents(): PersistedAgent[] {
	try {
		const filePath = getAgentsFilePath();
		if (!fs.existsSync(filePath)) return [];
		return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PersistedAgent[];
	} catch {
		return [];
	}
}

// ── 輔助函式：建構不含 CLAUDE* 變數的乾淨環境 ──────────

function buildCleanEnv(): Record<string, string | undefined> {
	const cleanEnv = { ...process.env };
	for (const key of Object.keys(cleanEnv)) {
		if (key.startsWith('CLAUDE')) {
			delete cleanEnv[key];
		}
	}
	return cleanEnv;
}

// ── 輔助函式：建立代理狀態並啟動檔案輪詢 ───────

function createAgentState(
	id: number,
	expectedFile: string,
	projectDir: string,
	tmuxName: string | null,
	isDetached: boolean,
): AgentState {
	let fileOffset = 0;
	try {
		if (fs.existsSync(expectedFile)) {
			fileOffset = fs.statSync(expectedFile).size;
		}
	} catch { /* 忽略 */ }

	return {
		id,
		process: null,
		projectDir,
		jsonlFile: expectedFile,
		fileOffset,
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
		tmuxSessionName: tmuxName,
		isDetached,
	};
}

// ── 共用的生成邏輯 ──────────────────────────────────────

function spawnClaudeAgent(
	args: string[],
	cwd: string,
	expectedFile: string,
	label: string,
	sessionUuid: string,
	nextAgentIdRef: { current: number },
	agents: Map<number, AgentState>,
	activeAgentIdRef: { current: number | null },
	knownJsonlFiles: Set<string>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
	sender: MessageSender | undefined,
	persistAgents: () => void,
): void {
	const projectDir = path.dirname(expectedFile);
	knownJsonlFiles.add(expectedFile);

	const cleanEnv = buildCleanEnv();
	const id = nextAgentIdRef.current++;

	const useTmux = isTmuxAvailable();
	let tmuxName: string | null = null;

	if (useTmux) {
		// 在 tmux 中生成以實現持久化
		tmuxName = buildTmuxName(sessionUuid);
		console.log(`[Pixel Agents] Using tmux session: ${tmuxName}`);
		createTmuxSession(tmuxName, CLAUDE_BIN, args, cwd, cleanEnv);
	} else {
		console.log(`[Pixel Agents] tmux not available, using direct spawn`);
	}

	const agent = createAgentState(id, expectedFile, projectDir, tmuxName, false);

	if (!useTmux) {
		// 直接生成 — 追蹤進程
		console.log(`[Pixel Agents] Using claude binary: ${CLAUDE_BIN}`);
		const proc = spawn(CLAUDE_BIN, args, {
			cwd,
			stdio: ['pipe', 'pipe', 'pipe'],
			env: cleanEnv,
		});

		proc.stdout?.on('data', (data: Buffer) => {
			const text = data.toString().replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
			if (text) console.log(`[Pixel Agents] Agent stdout: ${text.slice(0, 200)}`);
		});
		proc.stderr?.on('data', (data: Buffer) => {
			const text = data.toString().replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
			if (text) console.log(`[Pixel Agents] Agent stderr: ${text.slice(0, 200)}`);
		});

		agent.process = proc;

		proc.on('exit', (code) => {
			console.log(`[Pixel Agents] Agent ${id}: process exited with code ${code}`);
			removeAgent(
				id, agents,
				fileWatchers, pollingTimers, waitingTimers, permissionTimers,
				jsonlPollTimers, knownJsonlFiles, persistAgents,
			);
			sender?.postMessage({ type: 'agentClosed', id });
		});
	}

	agents.set(id, agent);
	activeAgentIdRef.current = id;
	persistAgents();
	console.log(`[Pixel Agents] Agent ${id}: ${label}`);
	sender?.postMessage({ type: 'agentCreated', id });

	const pollTimer = setInterval(() => {
		try {
			if (fs.existsSync(agent.jsonlFile)) {
				console.log(`[Pixel Agents] Agent ${id}: found JSONL file ${path.basename(agent.jsonlFile)}`);
				clearInterval(pollTimer);
				jsonlPollTimers.delete(id);
				startFileWatching(id, agent.jsonlFile, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, sender);
				readNewLines(id, agents, waitingTimers, permissionTimers, sender);
			}
		} catch { /* 檔案可能尚不存在 */ }
	}, JSONL_POLL_INTERVAL_MS);
	jsonlPollTimers.set(id, pollTimer);
}

export function launchNewAgent(
	cwd: string,
	nextAgentIdRef: { current: number },
	agents: Map<number, AgentState>,
	activeAgentIdRef: { current: number | null },
	knownJsonlFiles: Set<string>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
	sender: MessageSender | undefined,
	persistAgents: () => void,
): void {
	const sessionId = crypto.randomUUID();
	const projectDir = getProjectDirPath(cwd);
	const expectedFile = path.join(projectDir, `${sessionId}.jsonl`);

	spawnClaudeAgent(
		['--session-id', sessionId], cwd, expectedFile,
		`spawned claude --session-id ${sessionId}`,
		sessionId,
		nextAgentIdRef, agents, activeAgentIdRef, knownJsonlFiles,
		fileWatchers, pollingTimers, waitingTimers, permissionTimers,
		jsonlPollTimers, sender, persistAgents,
	);
}

export function resumeSession(
	sessionId: string,
	sessionProjectDir: string,
	cwd: string,
	nextAgentIdRef: { current: number },
	agents: Map<number, AgentState>,
	activeAgentIdRef: { current: number | null },
	knownJsonlFiles: Set<string>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
	sender: MessageSender | undefined,
	persistAgents: () => void,
): void {
	const expectedFile = path.join(sessionProjectDir, `${sessionId}.jsonl`);

	spawnClaudeAgent(
		['--resume', sessionId], cwd, expectedFile,
		`resumed session ${sessionId}`,
		sessionId,
		nextAgentIdRef, agents, activeAgentIdRef, knownJsonlFiles,
		fileWatchers, pollingTimers, waitingTimers, permissionTimers,
		jsonlPollTimers, sender, persistAgents,
	);
}

export function removeAgent(
	agentId: number,
	agents: Map<number, AgentState>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
	knownJsonlFiles: Set<string>,
	persistAgents: () => void,
): void {
	const agent = agents.get(agentId);
	if (!agent) return;

	// 允許此會話再次活躍時被重新收養
	knownJsonlFiles.delete(agent.jsonlFile);

	const jpTimer = jsonlPollTimers.get(agentId);
	if (jpTimer) { clearInterval(jpTimer); }
	jsonlPollTimers.delete(agentId);

	fileWatchers.get(agentId)?.close();
	fileWatchers.delete(agentId);
	const pt = pollingTimers.get(agentId);
	if (pt) { clearInterval(pt); }
	pollingTimers.delete(agentId);

	cancelWaitingTimer(agentId, waitingTimers);
	cancelPermissionTimer(agentId, permissionTimers);

	agents.delete(agentId);
	persistAgents();
}

export function closeAgent(
	agentId: number,
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
	const agent = agents.get(agentId);
	if (!agent) return;

	// 如果存在 tmux 會話則終止
	if (agent.tmuxSessionName) {
		killTmuxSession(agent.tmuxSessionName);
	}

	// 如果存在直接進程則終止
	if (agent.process && !agent.process.killed) {
		agent.process.kill('SIGTERM');
	}

	removeAgent(agentId, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, jsonlPollTimers, knownJsonlFiles, persistAgents);
	sender?.postMessage({ type: 'agentClosed', id: agentId });
}

// ── 伺服器重啟時的 tmux 恢復 ─────────────────────────

export function recoverTmuxAgents(
	nextAgentIdRef: { current: number },
	agents: Map<number, AgentState>,
	knownJsonlFiles: Set<string>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	sender: MessageSender | undefined,
	persistAgents: () => void,
): number {
	if (!isTmuxAvailable()) return 0;

	// 找出所有存活的 pixel-agents tmux 會話
	const liveSessions = listPixelAgentSessions();
	if (liveSessions.length === 0) return 0;

	// 載入持久化的代理資料，以將 tmux 會話與 JSONL 檔案配對
	const persisted = loadPersistedAgents();
	const persistedMap = new Map<string, PersistedAgent>();
	for (const p of persisted) {
		if (p.tmuxSessionName) {
			persistedMap.set(p.tmuxSessionName, p);
		}
	}

	let recovered = 0;
	for (const sessionName of liveSessions) {
		// 嘗試在持久化資料中找到此會話
		let jsonlFile: string | null = null;
		let projectDir: string | null = null;

		const match = persistedMap.get(sessionName);
		if (match) {
			jsonlFile = match.jsonlFile;
			projectDir = match.projectDir;
		} else {
			// 備選：嘗試透過從會話名稱提取的 UUID 尋找 JSONL
			const uuid = parseSessionUuid(sessionName);
			if (uuid) {
				const allDirs = getAllProjectDirs();
				for (const dir of allDirs) {
					const candidate = path.join(dir, `${uuid}.jsonl`);
					if (fs.existsSync(candidate)) {
						jsonlFile = candidate;
						projectDir = dir;
						break;
					}
				}
			}
		}

		if (!jsonlFile || !projectDir) {
			console.log(`[Pixel Agents] tmux session ${sessionName}: no matching JSONL found, skipping`);
			continue;
		}

		// 如果已被收養則跳過
		if (knownJsonlFiles.has(jsonlFile)) continue;
		knownJsonlFiles.add(jsonlFile);

		const id = nextAgentIdRef.current++;
		const agent = createAgentState(id, jsonlFile, projectDir, sessionName, false);
		// 從頭讀取以重建狀態
		agent.fileOffset = 0;
		agents.set(id, agent);

		console.log(`[Pixel Agents] Recovered tmux agent ${id}: ${sessionName}`);
		sender?.postMessage({ type: 'agentCreated', id });

		// 啟動檔案監視
		startFileWatching(id, jsonlFile, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, sender);
		readNewLines(id, agents, waitingTimers, permissionTimers, sender);

		recovered++;
	}

	if (recovered > 0) {
		persistAgents();
		console.log(`[Pixel Agents] Recovered ${recovered} tmux agent(s)`);
	}

	return recovered;
}

// ── tmux 健康檢查 ───────────────────────────────────────

export function checkTmuxHealth(
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
	for (const [agentId, agent] of agents) {
		if (!agent.tmuxSessionName) continue;
		if (!isTmuxSessionAlive(agent.tmuxSessionName)) {
			console.log(`[Pixel Agents] tmux session ${agent.tmuxSessionName} died, removing agent ${agentId}`);
			removeAgent(agentId, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, jsonlPollTimers, knownJsonlFiles, persistAgents);
			sender?.postMessage({ type: 'agentClosed', id: agentId });
		}
	}
}

export function sendExistingAgents(
	agents: Map<number, AgentState>,
	agentMeta: Record<string, { palette?: number; hueShift?: number; seatId?: string }>,
	sender: MessageSender | undefined,
): void {
	if (!sender) return;
	const agentIds: number[] = [];
	for (const id of agents.keys()) {
		agentIds.push(id);
	}
	agentIds.sort((a, b) => a - b);

	sender.postMessage({
		type: 'existingAgents',
		agents: agentIds,
		agentMeta,
	});

	// 重新傳送當前狀態
	for (const [agentId, agent] of agents) {
		if (agent.model) {
			sender.postMessage({
				type: 'agentModel',
				id: agentId,
				model: agent.model,
			});
		}
		for (const [toolId, status] of agent.activeToolStatuses) {
			sender.postMessage({
				type: 'agentToolStart',
				id: agentId,
				toolId,
				status,
			});
		}
		if (agent.isWaiting) {
			sender.postMessage({
				type: 'agentStatus',
				id: agentId,
				status: 'waiting',
			});
		}
	}
}
