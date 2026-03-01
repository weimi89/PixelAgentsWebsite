import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, execSync } from 'child_process';
import type { AgentContext, AgentState, PersistedAgent, MessageSender } from './types.js';
import { cancelWaitingTimer, cancelPermissionTimer } from './timerManager.js';
import { startFileWatching, readNewLines } from './fileWatcher.js';
import { JSONL_POLL_INTERVAL_MS, JSONL_POLL_TIMEOUT_MS, LAYOUT_FILE_DIR, AGENTS_FILE_NAME, IGNORED_PROJECT_DIR_PATTERNS, DEFAULT_FLOOR_ID } from './constants.js';
import { getCustomName, isProjectExcluded } from './projectNameStore.js';
import { resolveFloorForProject } from './floorAssignment.js';
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

/** 從專案目錄名稱提取可讀的專案名稱（優先使用自訂名稱，回退至最後一段非空片段） */
export function extractProjectName(projectDir: string): string {
	const custom = getCustomName(projectDir);
	if (custom) return custom;
	const dirName = path.basename(projectDir);
	const parts = dirName.split(/-+/).filter(Boolean);
	return parts[parts.length - 1] || dirName;
}

/** 從工作目錄路徑推導出 Claude 專案目錄路徑 */
export function getProjectDirPath(cwd: string): string {
	const dirName = cwd.replace(/[^a-zA-Z0-9-]/g, '-');
	return path.join(os.homedir(), '.claude', 'projects', dirName);
}

/** 取得所有 Claude 專案目錄清單（排除 observer-sessions 等忽略模式） */
export function getAllProjectDirs(): string[] {
	const projectsRoot = path.join(os.homedir(), '.claude', 'projects');
	try {
		const entries = fs.readdirSync(projectsRoot, { withFileTypes: true });
		return entries
			.filter(e => e.isDirectory())
			.filter(e => !IGNORED_PROJECT_DIR_PATTERNS.some(p => e.name.includes(p)))
			.map(e => path.join(projectsRoot, e.name))
			.filter(dir => !isProjectExcluded(dir));
	} catch {
		return [];
	}
}

// ── 持久化 ─────────────────────────────────────────────

/** 取得代理持久化檔案路徑 */
function getAgentsFilePath(): string {
	return path.join(os.homedir(), LAYOUT_FILE_DIR, AGENTS_FILE_NAME);
}

/** 將所有代理狀態持久化至磁碟 */
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
			floorId: agent.floorId,
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

/** 從磁碟載入先前持久化的代理資料 */
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

/** 建構乾淨的環境變數（移除所有 CLAUDE 前綴的變數以避免巢狀偵測） */
function buildCleanEnv(): Record<string, string | undefined> {
	const cleanEnv = { ...process.env };
	for (const key of Object.keys(cleanEnv)) {
		if (key.startsWith('CLAUDE')) {
			delete cleanEnv[key];
		}
	}
	return cleanEnv;
}

// ── 輔助函式：建立代理狀態 ───────

/** 建立代理初始狀態，包含檔案偏移量與所有追蹤用的資料結構 */
function createAgentState(
	id: number,
	expectedFile: string,
	projectDir: string,
	tmuxName: string | null,
	isDetached: boolean,
	floorId: string = DEFAULT_FLOOR_ID,
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
		transcriptLog: [],
		floorId,
	};
}

// ── 共用的生成邏輯 ──────────────────────────────────────

/** 生成 Claude 代理進程（透過 tmux 或直接生成），建立狀態並啟動檔案監視 */
function spawnClaudeAgent(
	args: string[],
	cwd: string,
	expectedFile: string,
	label: string,
	sessionUuid: string,
	ctx: AgentContext,
): void {
	const {
		nextAgentIdRef, agents, activeAgentIdRef, knownJsonlFiles,
		jsonlPollTimers, persistAgents,
	} = ctx;

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

	const floorId = resolveFloorForProject(projectDir, ctx.building);
	const agent = createAgentState(id, expectedFile, projectDir, tmuxName, false, floorId);
	const floorSend = ctx.floorSender(floorId);

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

		proc.on('error', (err) => {
			console.error(`[Pixel Agents] Agent ${id}: process error:`, err);
			removeAgent(id, ctx);
			ctx.floorSender(agent.floorId).postMessage({ type: 'agentClosed', id });
		});

		proc.on('exit', (code) => {
			console.log(`[Pixel Agents] Agent ${id}: process exited with code ${code}`);
			removeAgent(id, ctx);
			ctx.floorSender(agent.floorId).postMessage({ type: 'agentClosed', id });
		});
	}

	agents.set(id, agent);
	ctx.trackedJsonlFiles.set(agent.jsonlFile, id);
	activeAgentIdRef.current = id;
	persistAgents();
	console.log(`[Pixel Agents] Agent ${id}: ${label} (floor: ${floorId})`);
	const isExternal = projectDir !== ctx.ownProjectDir;
	floorSend.postMessage({
		type: 'agentCreated',
		id,
		projectName: extractProjectName(projectDir),
		floorId,
		...(isExternal ? { isExternal: true } : {}),
	});

	// 輪詢等待 JSONL 檔案出現後開始檔案監視（含超時防護）
	const pollStartTime = Date.now();
	const pollTimer = setInterval(() => {
		try {
			if (fs.existsSync(agent.jsonlFile)) {
				console.log(`[Pixel Agents] Agent ${id}: found JSONL file ${path.basename(agent.jsonlFile)}`);
				clearInterval(pollTimer);
				jsonlPollTimers.delete(id);
				startFileWatching(id, agent.jsonlFile, ctx);
				readNewLines(id, ctx);
				return;
			}
		} catch { /* 檔案可能尚不存在 */ }
		if (Date.now() - pollStartTime > JSONL_POLL_TIMEOUT_MS) {
			console.warn(`[Pixel Agents] Agent ${id}: JSONL file not found after ${JSONL_POLL_TIMEOUT_MS / 1000}s, removing`);
			clearInterval(pollTimer);
			jsonlPollTimers.delete(id);
			if (agent.tmuxSessionName) {
				killTmuxSession(agent.tmuxSessionName);
			}
			removeAgent(id, ctx);
			ctx.floorSender(agent.floorId).postMessage({ type: 'agentClosed', id });
		}
	}, JSONL_POLL_INTERVAL_MS);
	jsonlPollTimers.set(id, pollTimer);
}

/** 恢復既有的 Claude 會話 */
export function resumeSession(
	sessionId: string,
	sessionProjectDir: string,
	cwd: string,
	ctx: AgentContext,
): void {
	const expectedFile = path.join(sessionProjectDir, `${sessionId}.jsonl`);

	spawnClaudeAgent(
		['--resume', sessionId], cwd, expectedFile,
		`resumed session ${sessionId}`,
		sessionId, ctx,
	);
}

/** 移除代理：清理所有計時器、監視器，並從狀態中刪除 */
export function removeAgent(
	agentId: number,
	ctx: AgentContext,
): void {
	const {
		agents, fileWatchers, pollingTimers, waitingTimers,
		permissionTimers, jsonlPollTimers, knownJsonlFiles, persistAgents,
	} = ctx;

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

	ctx.trackedJsonlFiles.delete(agent.jsonlFile);
	agents.delete(agentId);
	persistAgents();
}

/** 關閉代理：終止 tmux 會話或直接進程，然後移除代理 */
export function closeAgent(
	agentId: number,
	ctx: AgentContext,
): void {
	const { agents } = ctx;
	const agent = agents.get(agentId);
	if (!agent) return;

	const floorId = agent.floorId;

	// 如果存在 tmux 會話則終止
	if (agent.tmuxSessionName) {
		killTmuxSession(agent.tmuxSessionName);
	}

	// 如果存在直接進程則終止
	if (agent.process && !agent.process.killed) {
		agent.process.kill('SIGTERM');
	}

	removeAgent(agentId, ctx);
	ctx.floorSender(floorId).postMessage({ type: 'agentClosed', id: agentId });
}

// ── 伺服器重啟時的 tmux 恢復 ─────────────────────────

/** 恢復上次伺服器執行中遺留的 tmux 代理會話 */
export function recoverTmuxAgents(
	ctx: AgentContext,
): number {
	const { nextAgentIdRef, agents, knownJsonlFiles, persistAgents } = ctx;

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
		let persistedFloorId: string | undefined;

		const match = persistedMap.get(sessionName);
		if (match) {
			jsonlFile = match.jsonlFile;
			projectDir = match.projectDir;
			persistedFloorId = match.floorId;
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

		const floorId = persistedFloorId || resolveFloorForProject(projectDir, ctx.building);
		const id = nextAgentIdRef.current++;
		const agent = createAgentState(id, jsonlFile, projectDir, sessionName, false, floorId);
		// 從頭讀取以重建狀態
		agent.fileOffset = 0;
		agents.set(id, agent);
		ctx.trackedJsonlFiles.set(agent.jsonlFile, id);

		console.log(`[Pixel Agents] Recovered tmux agent ${id}: ${sessionName} (floor: ${floorId})`);
		const isExternal = projectDir !== ctx.ownProjectDir;
		ctx.floorSender(floorId).postMessage({
			type: 'agentCreated',
			id,
			projectName: extractProjectName(projectDir),
			floorId,
			...(isExternal ? { isExternal: true } : {}),
		});

		// 啟動檔案監視
		startFileWatching(id, jsonlFile, ctx);
		readNewLines(id, ctx);

		recovered++;
	}

	if (recovered > 0) {
		persistAgents();
		console.log(`[Pixel Agents] Recovered ${recovered} tmux agent(s)`);
	}

	return recovered;
}

// ── tmux 健康檢查 ───────────────────────────────────────

/** 檢查所有 tmux 代理的會話是否仍存活，移除已失效的代理 */
export function checkTmuxHealth(
	ctx: AgentContext,
): void {
	const { agents } = ctx;

	for (const [agentId, agent] of agents) {
		if (!agent.tmuxSessionName) continue;
		if (!isTmuxSessionAlive(agent.tmuxSessionName)) {
			console.log(`[Pixel Agents] tmux session ${agent.tmuxSessionName} died, removing agent ${agentId}`);
			const floorId = agent.floorId;
			removeAgent(agentId, ctx);
			ctx.floorSender(floorId).postMessage({ type: 'agentClosed', id: agentId });
		}
	}
}

/** 發送現有代理清單與其當前狀態至客戶端（過濾至指定樓層） */
export function sendExistingAgents(
	agents: Map<number, AgentState>,
	agentMeta: Record<string, { palette?: number; hueShift?: number; seatId?: string }>,
	sender: MessageSender | undefined,
	ownProjectDir: string,
	floorId?: string,
): void {
	if (!sender) return;
	const agentIds: number[] = [];
	for (const [id, agent] of agents) {
		if (floorId && agent.floorId !== floorId) continue;
		agentIds.push(id);
	}
	agentIds.sort((a, b) => a - b);

	// 為每個代理補充專案資訊
	const enrichedMeta: Record<string, { palette?: number; hueShift?: number; seatId?: string; isExternal?: boolean; projectName?: string; floorId?: string }> = {};
	for (const [idStr, meta] of Object.entries(agentMeta)) {
		enrichedMeta[idStr] = { ...meta };
	}
	for (const id of agentIds) {
		const agent = agents.get(id);
		if (!agent) continue;
		const key = String(id);
		if (!enrichedMeta[key]) enrichedMeta[key] = {};
		enrichedMeta[key].projectName = extractProjectName(agent.projectDir);
		enrichedMeta[key].floorId = agent.floorId;
		const isExternal = agent.projectDir !== ownProjectDir;
		if (isExternal) {
			enrichedMeta[key].isExternal = true;
		}
	}

	sender.postMessage({
		type: 'existingAgents',
		agents: agentIds,
		agentMeta: enrichedMeta,
	});

	// 重新傳送當前狀態
	for (const id of agentIds) {
		const agent = agents.get(id);
		if (!agent) continue;
		if (agent.model) {
			sender.postMessage({
				type: 'agentModel',
				id,
				model: agent.model,
			});
		}
		for (const [toolId, status] of agent.activeToolStatuses) {
			sender.postMessage({
				type: 'agentToolStart',
				id,
				toolId,
				status,
			});
		}
		if (agent.isWaiting) {
			sender.postMessage({
				type: 'agentStatus',
				id,
				status: 'waiting',
			});
		}
	}
}
