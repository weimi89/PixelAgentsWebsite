import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import type { AgentContext, AgentState, PersistedAgent, MessageSender } from './types.js';
import { DEFAULT_GROWTH, restoreGrowth, recordSessionStart, calculateLevel } from './growthSystem.js';
import { cancelWaitingTimer, cancelPermissionTimer } from './timerManager.js';
import { startFileWatching, readNewLines } from './fileWatcher.js';
import { JSONL_POLL_INTERVAL_MS, JSONL_POLL_TIMEOUT_MS, LAYOUT_FILE_DIR, AGENTS_FILE_NAME, DEFAULT_FLOOR_ID } from './constants.js';
import { getCustomName, isProjectExcluded } from './projectNameStore.js';
import { resolveFloorForProject } from './floorAssignment.js';
import { db } from './db/database.js';
import {
	isTmuxAvailable,
	tmuxSessionName as buildTmuxName,
	createTmuxSession,
	killTmuxSession,
	isTmuxSessionAlive,
	listPixelAgentSessions,
	parseSessionUuid,
} from './tmuxManager.js';
import { type CLIAdapter, type CliType, getAdapter, getAllAdapters } from './cliAdapters/index.js';

/** 從專案目錄名稱提取可讀的專案名稱（優先使用自訂名稱，回退至最後一段非空片段） */
export function extractProjectName(projectDir: string): string {
	const custom = getCustomName(projectDir);
	if (custom) return custom;
	const dirName = path.basename(projectDir);
	const parts = dirName.split(/-+/).filter(Boolean);
	return parts[parts.length - 1] || dirName;
}

/** 從會話檔案提取專案名稱（使用 CLI adapter 的自訂邏輯，若有的話） */
export function extractProjectNameFromFile(filePath: string, projectDir: string): string {
	const cliType = detectCliTypeFromPath(projectDir);
	const adapter = getAdapter(cliType);
	if (adapter?.extractProjectName) {
		const name = adapter.extractProjectName(filePath);
		if (name) return name;
	}
	return extractProjectName(projectDir);
}

/** 從工作目錄路徑推導出 Claude 專案目錄路徑 */
export function getProjectDirPath(cwd: string): string {
	const dirName = cwd.replace(/[^a-zA-Z0-9-]/g, '-');
	return path.join(os.homedir(), '.claude', 'projects', dirName);
}

/** 取得指定 CLI 類型的所有專案目錄清單（排除忽略模式和排除清單） */
export function getProjectDirsForCli(adapter: CLIAdapter): string[] {
	// 若 adapter 提供自訂掃描邏輯，使用它
	if (adapter.scanSessionFiles) {
		try {
			return adapter.scanSessionFiles()
				.map(r => r.dir)
				.filter(dir => !isProjectExcluded(dir));
		} catch {
			return [];
		}
	}
	const projectsRoot = adapter.getProjectsRoot();
	const ignoredPatterns = adapter.ignoredDirPatterns();
	try {
		return findJsonlDirs(projectsRoot, ignoredPatterns)
			.filter(dir => !isProjectExcluded(dir));
	} catch {
		return [];
	}
}

/** 從根目錄遞迴找出「直接包含 JSONL 檔案」的資料夾 */
function findJsonlDirs(rootDir: string, ignoredPatterns: string[]): string[] {
	const MAX_SCAN_DEPTH = 4;
	const found = new Set<string>();
	const stack: Array<{ dir: string; depth: number }> = [{ dir: rootDir, depth: 0 }];

	while (stack.length > 0) {
		const current = stack.pop();
		if (!current) continue;

		let entries: fs.Dirent[];
		try {
			entries = fs.readdirSync(current.dir, { withFileTypes: true });
		} catch {
			continue;
		}

		let hasJsonl = false;
		for (const entry of entries) {
			if (entry.isFile() && entry.name.endsWith('.jsonl')) {
				hasJsonl = true;
				continue;
			}
			if (!entry.isDirectory()) continue;
			if (ignoredPatterns.some(p => entry.name.includes(p))) continue;
			if (current.depth >= MAX_SCAN_DEPTH) continue;
			stack.push({ dir: path.join(current.dir, entry.name), depth: current.depth + 1 });
		}

		if (hasJsonl) {
			found.add(current.dir);
		}
	}

	return [...found];
}

/** 取得所有已註冊 CLI 的專案目錄清單 */
export function getAllProjectDirs(): string[] {
	const dirs: string[] = [];
	for (const adapter of getAllAdapters()) {
		dirs.push(...getProjectDirsForCli(adapter));
	}
	return dirs;
}

/** 根據專案目錄路徑推斷 CLI 類型 */
export function detectCliTypeFromPath(projectDir: string): CliType {
	for (const adapter of getAllAdapters()) {
		if (projectDir.startsWith(adapter.getProjectsRoot())) {
			return adapter.name;
		}
	}
	return 'claude'; // 預設
}

// ── 持久化 ─────────────────────────────────────────────

/** 取得代理持久化檔案路徑 */
function getAgentsFilePath(): string {
	return path.join(os.homedir(), LAYOUT_FILE_DIR, AGENTS_FILE_NAME);
}

/** 將所有代理狀態持久化至磁碟（及 DB） */
export function savePersistedAgents(agents: Map<number, AgentState>): void {
	const data: PersistedAgent[] = [];
	for (const agent of agents.values()) {
		// 從 JSONL 檔名中提取會話 ID
		const sessionId = path.basename(agent.jsonlFile, '.jsonl');
		const g = agent.growth;
		data.push({
			id: agent.id,
			sessionId,
			jsonlFile: agent.jsonlFile,
			projectDir: agent.projectDir,
			tmuxSessionName: agent.tmuxSessionName ?? undefined,
			floorId: agent.floorId,
			...(agent.cliType !== 'claude' ? { cliType: agent.cliType } : {}),
			...(agent.ownerId ? { ownerId: agent.ownerId } : {}),
			...(g.xp > 0 ? { xp: g.xp, toolCallCount: g.toolCallCount, sessionCount: g.sessionCount, bashCallCount: g.bashCallCount, achievements: g.achievements } : {}),
		});

		// 同步成長資料至 DB agent_appearances 表
		if (db && g.xp > 0) {
			const agentKey = path.basename(agent.projectDir);
			try {
				db.saveAgentAppearance(agentKey, {
					floorId: agent.floorId,
					cliType: agent.cliType !== 'claude' ? agent.cliType : null,
					xp: g.xp,
					toolCallCount: g.toolCallCount,
					sessionCount: g.sessionCount,
					bashCallCount: g.bashCallCount,
					achievements: g.achievements,
				});
			} catch {
				// 忽略 DB 寫入錯誤，JSON 檔案作為備份
			}
		}
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

// ── 輔助函式：建立代理狀態 ───────

/** 建立代理初始狀態，包含檔案偏移量與所有追蹤用的資料結構 */
function createAgentState(
	id: number,
	expectedFile: string,
	projectDir: string,
	tmuxName: string | null,
	isDetached: boolean,
	floorId: string = DEFAULT_FLOOR_ID,
	cliType: string = 'claude',
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
		isRemote: false,
		owner: null,
		ownerId: null,
		remoteSessionId: null,
		gitBranch: null,
		statusHistory: [],
		teamName: null,
		cliType,
		startedAt: Date.now(),
		growth: { ...DEFAULT_GROWTH },
	};
}

// ── 共用的生成邏輯 ──────────────────────────────────────

/** 生成 CLI 代理進程（透過 tmux 或直接生成），建立狀態並啟動檔案監視 */
function spawnCliAgent(
	args: string[],
	cwd: string,
	expectedFile: string,
	label: string,
	sessionUuid: string,
	ctx: AgentContext,
	cliType: CliType = 'claude',
): void {
	const {
		nextAgentIdRef, agents, activeAgentIdRef,
		jsonlPollTimers, persistAgents,
	} = ctx;

	const adapter = getAdapter(cliType);
	if (!adapter) {
		console.error(`[Pixel Agents] No adapter found for CLI type: ${cliType}`);
		return;
	}

	const projectDir = path.dirname(expectedFile);

	const cleanEnv = adapter.buildCleanEnv();
	const binaryPath = adapter.getBinaryPath();
	const id = nextAgentIdRef.current++;

	const useTmux = isTmuxAvailable();
	let tmuxName: string | null = null;

	if (useTmux) {
		tmuxName = buildTmuxName(sessionUuid);
		console.log(`[Pixel Agents] Using tmux session: ${tmuxName} (cli: ${cliType})`);
		createTmuxSession(tmuxName, binaryPath, args, cwd, cleanEnv);
	} else {
		console.log(`[Pixel Agents] tmux not available, using direct spawn`);
	}

	const floorId = resolveFloorForProject(projectDir, ctx.building);
	const agent = createAgentState(id, expectedFile, projectDir, tmuxName, false, floorId, cliType);
	const floorSend = ctx.floorSender(floorId);

	if (!useTmux) {
		console.log(`[Pixel Agents] Using ${cliType} binary: ${binaryPath}`);
		const proc = spawn(binaryPath, args, {
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
			ctx.broadcastFloorSummaries();
		});

		proc.on('exit', (code) => {
			console.log(`[Pixel Agents] Agent ${id}: process exited with code ${code}`);
			removeAgent(id, ctx);
			ctx.floorSender(agent.floorId).postMessage({ type: 'agentClosed', id });
			ctx.broadcastFloorSummaries();
		});
	}

	agents.set(id, agent);
	ctx.trackedJsonlFiles.set(agent.jsonlFile, id);
	activeAgentIdRef.current = id;
	ctx.incrementFloorCount(floorId);
	recordSessionStart(id, agent, floorSend);
	persistAgents();
	// 記錄代理上線歷史
	if (db) {
		const agentKey = path.basename(projectDir);
		db.addAgentHistory(agentKey, 'online', `agent_id=${id} cli=${cliType}`);
	}
	console.log(`[Pixel Agents] Agent ${id}: ${label} (floor: ${floorId})`);
	const isExternal = projectDir !== ctx.ownProjectDir;
	floorSend.postMessage({
		type: 'agentCreated',
		id,
		projectName: extractProjectName(projectDir),
		floorId,
		startedAt: agent.startedAt,
		...(isExternal ? { isExternal: true } : {}),
		...(cliType !== 'claude' ? { cliType } : {}),
	});

	ctx.broadcastFloorSummaries();

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

/** 恢復既有的會話（自動判斷 CLI 類型） */
export function resumeSession(
	sessionId: string,
	sessionProjectDir: string,
	cwd: string,
	ctx: AgentContext,
): void {
	const expectedFile = path.join(sessionProjectDir, `${sessionId}.jsonl`);
	const cliType = detectCliTypeFromPath(sessionProjectDir);
	const adapter = getAdapter(cliType);
	const args = adapter ? adapter.buildResumeArgs(sessionId) : ['--resume', sessionId];

	spawnCliAgent(
		args, cwd, expectedFile,
		`resumed session ${sessionId}`,
		sessionId, ctx, cliType,
	);
}

/** 移除代理：清理所有計時器、監視器，並從狀態中刪除 */
export function removeAgent(
	agentId: number,
	ctx: AgentContext,
): void {
	const {
		agents, fileWatchers, pollingTimers, waitingTimers,
		permissionTimers, jsonlPollTimers, persistAgents,
	} = ctx;

	const agent = agents.get(agentId);
	if (!agent) return;

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

	// 清理直接子進程的事件監聽，避免舊 proc 在移除代理後仍 emit 導致殭屍 listener 或 MaxListeners 警告
	if (agent.process) {
		agent.process.stdout?.removeAllListeners('data');
		agent.process.stderr?.removeAllListeners('data');
		agent.process.removeAllListeners('error');
		agent.process.removeAllListeners('exit');
		agent.process.removeAllListeners('close');
	}

	ctx.trackedJsonlFiles.delete(agent.jsonlFile);
	if (agent.remoteSessionId) {
		ctx.remoteAgentMap.delete(agent.remoteSessionId);
	}
	ctx.decrementFloorCount(agent.floorId);
	// 記錄代理離線歷史
	if (db) {
		const agentKey = path.basename(agent.projectDir);
		db.addAgentHistory(agentKey, 'offline', `agent_id=${agentId}`);
	}
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
	ctx.broadcastFloorSummaries();
}

// ── 伺服器重啟時的 tmux 恢復 ─────────────────────────

/** 恢復上次伺服器執行中遺留的 tmux 代理會話 */
export function recoverTmuxAgents(
	ctx: AgentContext,
): number {
	const { nextAgentIdRef, agents, persistAgents } = ctx;

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
		if (ctx.trackedJsonlFiles.has(jsonlFile)) continue;

		const floorId = persistedFloorId || resolveFloorForProject(projectDir, ctx.building);
		const cliType = match?.cliType || detectCliTypeFromPath(projectDir);
		const id = nextAgentIdRef.current++;
		const agent = createAgentState(id, jsonlFile, projectDir, sessionName, false, floorId, cliType);
		// 從持久化資料還原成長狀態和所有權
		if (match) {
			agent.growth = restoreGrowth(match);
			if (match.ownerId) {
				agent.ownerId = match.ownerId;
			}
		}
		// 從頭讀取以重建狀態
		agent.fileOffset = 0;
		agents.set(id, agent);
		ctx.trackedJsonlFiles.set(agent.jsonlFile, id);
		ctx.incrementFloorCount(floorId);

		console.log(`[Pixel Agents] Recovered tmux agent ${id}: ${sessionName} (floor: ${floorId}, cli: ${cliType})`);
		const isExternal = projectDir !== ctx.ownProjectDir;
		ctx.floorSender(floorId).postMessage({
			type: 'agentCreated',
			id,
			projectName: extractProjectName(projectDir),
			floorId,
			startedAt: agent.startedAt,
			...(isExternal ? { isExternal: true } : {}),
			...(cliType !== 'claude' ? { cliType } : {}),
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

	let removed = false;
	for (const [agentId, agent] of agents) {
		if (!agent.tmuxSessionName) continue;
		if (!isTmuxSessionAlive(agent.tmuxSessionName)) {
			console.log(`[Pixel Agents] tmux session ${agent.tmuxSessionName} died, removing agent ${agentId}`);
			const floorId = agent.floorId;
			removeAgent(agentId, ctx);
			ctx.floorSender(floorId).postMessage({ type: 'agentClosed', id: agentId });
			removed = true;
		}
	}
	if (removed) {
		ctx.broadcastFloorSummaries();
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
	const enrichedMeta: Record<string, { palette?: number; hueShift?: number; seatId?: string; isExternal?: boolean; projectName?: string; floorId?: string; isRemote?: boolean; owner?: string; ownerId?: string; cliType?: string; startedAt?: number }> = {};
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
		enrichedMeta[key].startedAt = agent.startedAt;
		const isExternal = agent.projectDir !== ownProjectDir;
		if (isExternal) {
			enrichedMeta[key].isExternal = true;
		}
		if (agent.cliType !== 'claude') {
			enrichedMeta[key].cliType = agent.cliType;
		}
		if (agent.isRemote) {
			enrichedMeta[key].isRemote = true;
			if (agent.owner) {
				enrichedMeta[key].owner = agent.owner;
			}
		}
		if (agent.ownerId) {
			enrichedMeta[key].ownerId = agent.ownerId;
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
		// 傳送成長資料
		if (agent.growth.xp > 0) {
			sender.postMessage({
				type: 'agentGrowth',
				id,
				xp: agent.growth.xp,
				level: calculateLevel(agent.growth.xp),
				achievements: agent.growth.achievements,
				newAchievements: [],
			});
		}
	}
}
