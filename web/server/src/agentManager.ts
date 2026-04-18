/**
 * agentManager — 本地代理（Agent）生命週期管理
 *
 * 職責：
 *   - 代理的建立（resume/spawn）、關閉、移除
 *   - 從 Claude 專案目錄結構解析專案名稱 / CLI 類型
 *   - 掃描各 CLI 的專案目錄（配合 adapter）
 *   - 將代理外觀與座位持久化至 `~/.pixel-agents/persisted-agents.json`
 *   - 伺服器重啟時，從既有 tmux sessions 恢復失聯代理
 *
 * 不包含：
 *   - 遠端代理（見 agentNodeHandler.ts）
 *   - JSONL 檔案監聽與解析（見 fileWatcher.ts、transcriptParser.ts）
 *
 * 關鍵不變量：
 *   - 一個 AgentState.id 與一個 JSONL 檔案 1:1 綁定（ctx.trackedJsonlFiles）
 *   - 每個 agent 只有一個 tmuxSessionName 或一個 process（互斥）
 *   - removeAgent 必須清理：fileWatchers、計時器、子進程 listeners、
 *     trackedJsonlFiles 與 remoteAgentMap 的對應條目
 */
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

/**
 * 恢復既有的 Claude/Codex/Gemini 會話。
 *
 * - 依據 sessionProjectDir 偵測 CLI 類型
 * - 透過對應 adapter 構造 `--resume <sessionId>` 參數（不同 CLI 格式不同）
 * - spawn 新子進程並建立 AgentState；若 tmux 可用會包一層 tmux session
 *
 * @param sessionId     Claude 會話的 UUID（JSONL 檔名即 sessionId.jsonl）
 * @param sessionProjectDir  該會話所在的專案目錄（`~/.claude/projects/<hash>/`）
 * @param cwd           子進程工作目錄（= 原始專案實體路徑）
 */
export function resumeSession(
	sessionId: string,
	sessionProjectDir: string,
	cwd: string,
	ctx: AgentContext,
): void {
	// JSONL 檔案路徑慣例：`~/.claude/projects/<專案雜湊>/<sessionId>.jsonl`
	// 這裡「預期」這個檔案會在 spawn 後很快出現，fileWatcher 會等它。
	const expectedFile = path.join(sessionProjectDir, `${sessionId}.jsonl`);

	// CLI 類型從 projectDir 路徑推導（`.claude/projects` vs `.codex/sessions`
	// vs `.gemini/tmp/...`），而非從 session 本身檔名。見 detectCliTypeFromPath。
	const cliType = detectCliTypeFromPath(sessionProjectDir);

	// 每種 CLI 的 resume 旗標不同：
	//   Claude:  `claude --resume <id>`
	//   Codex:   `codex resume <id>` 或 `codex --session <id>`（依 adapter）
	//   Gemini:  目前沒有 resume，adapter 可能回空陣列或使用預設
	// Adapter 在 cliAdapters/*.ts 實作；若未知 CLI 退回 Claude 風格作為最安全預設。
	const adapter = getAdapter(cliType);
	const args = adapter ? adapter.buildResumeArgs(sessionId) : ['--resume', sessionId];

	// 把參數組裝完後，交由共用的 spawnCliAgent 處理：
	//   - 決定走 tmux 還是直接 spawn
	//   - 建立 AgentState 並加入 ctx.agents
	//   - 等 JSONL 檔出現後觸發 fileWatcher
	//   - 廣播 agentCreated 給同樓層客戶端
	// label 字串只用於 log，可辨識是 resume vs 全新啟動。
	spawnCliAgent(
		args, cwd, expectedFile,
		`resumed session ${sessionId}`,
		sessionId, ctx, cliType,
	);
}

/**
 * 移除代理：從系統中徹底清除單一代理的所有痕跡。
 *
 * 清理範圍（依序執行，任一步失敗不應阻塞後續）：
 *   1. JSONL 輪詢計時器、fs.watch、2s 備援輪詢
 *   2. 等待／權限氣泡計時器
 *   3. 直接子進程的所有事件 listener（stdout/stderr/error/exit/close）
 *      — 必要，否則快速 spawn/remove 會造成 MaxListeners 警告
 *   4. trackedJsonlFiles 與 remoteAgentMap（若為遠端代理）
 *   5. 樓層代理計數 - 1
 *   6. DB 寫入 agent_history 的 offline 紀錄
 *   7. agents Map 刪除 + 觸發持久化寫入
 *
 * 注意：本函式不會 kill 子進程或 tmux session；
 *   若需終止「活」的代理，請使用 closeAgent() 包裝。
 */
export function removeAgent(
	agentId: number,
	ctx: AgentContext,
): void {
	// 從 context 解構出需要操作的所有 Map 與回呼
	const {
		agents, fileWatchers, pollingTimers, waitingTimers,
		permissionTimers, jsonlPollTimers, persistAgents,
	} = ctx;

	// 透過 agentId 取出對應的代理物件
	const agent = agents.get(agentId);
	// 若代理已不存在（例如被其他路徑重複呼叫過），直接返回不做任何事
	if (!agent) return;

	// 取得等待 JSONL 檔案出現的輪詢計時器
	const jpTimer = jsonlPollTimers.get(agentId);
	// 若計時器仍在執行，清除它以停止輪詢
	if (jpTimer) { clearInterval(jpTimer); }
	// 從 Map 中移除此計時器紀錄
	jsonlPollTimers.delete(agentId);

	// 關閉 fs.watch 檔案監聽實例（?. 是防止 get 回傳 undefined）
	fileWatchers.get(agentId)?.close();
	// 從 Map 中移除 watcher 紀錄
	fileWatchers.delete(agentId);
	// 取得 2 秒備援輪詢計時器（當 fs.watch 不可靠時的後備）
	const pt = pollingTimers.get(agentId);
	// 若存在則清除它
	if (pt) { clearInterval(pt); }
	// 從 Map 中移除此輪詢紀錄
	pollingTimers.delete(agentId);

	// 取消「等待輸入」的綠色勾號氣泡計時器
	cancelWaitingTimer(agentId, waitingTimers);
	// 取消「權限請求」的琥珀色圓點氣泡計時器
	cancelPermissionTimer(agentId, permissionTimers);

	// 若代理是直接 spawn 啟動（非 tmux 包裹），需要清理子進程事件監聽器，
	// 避免舊進程仍發出 data/exit 事件造成殭屍 listener 與 MaxListeners 警告
	if (agent.process) {
		// 清除標準輸出的所有 data 監聽器
		agent.process.stdout?.removeAllListeners('data');
		// 清除標準錯誤的所有 data 監聽器
		agent.process.stderr?.removeAllListeners('data');
		// 清除 error 事件所有監聽器
		agent.process.removeAllListeners('error');
		// 清除 exit 事件所有監聽器
		agent.process.removeAllListeners('exit');
		// 清除 close 事件所有監聽器
		agent.process.removeAllListeners('close');
	}

	// 從「JSONL 路徑 → 代理 ID」反查表中移除，讓自動偵測可重新認領此檔案
	ctx.trackedJsonlFiles.delete(agent.jsonlFile);
	// 若此代理是遠端代理，還需從遠端 sessionId 對應表移除
	if (agent.remoteSessionId) {
		ctx.remoteAgentMap.delete(agent.remoteSessionId);
	}
	// 所屬樓層的代理數量 - 1，用於 UI 顯示每層人數徽章
	ctx.decrementFloorCount(agent.floorId);

	// 若 SQLite 資料庫可用，寫入一筆 offline 歷史紀錄
	if (db) {
		// 用專案目錄名（basename）作為聚合鍵，同專案跨機器的紀錄可一起查詢
		const agentKey = path.basename(agent.projectDir);
		// 呼叫 DAO 方法寫入 agent_history 資料表
		db.addAgentHistory(agentKey, 'offline', `agent_id=${agentId}`);
	}

	// 從 agents Map 中刪除條目（必須在前面所有操作之後，因為前面還需要讀 agent 屬性）
	agents.delete(agentId);
	// 把目前的 agents Map 序列化寫入 ~/.pixel-agents/persisted-agents.json
	persistAgents();
}

/**
 * 使用者主動關閉代理（來自 UI 按下「關閉代理」按鈕）。
 *
 * 順序：
 *   1. kill tmux session（若有）
 *   2. process.kill('SIGTERM')（若為直接 spawn）
 *   3. removeAgent() 清理狀態
 *   4. 廣播 agentClosed 給同樓層客戶端
 *
 * 與 removeAgent 差異：removeAgent 只清理狀態、不 kill 進程；
 * closeAgent = kill + removeAgent + 廣播。
 *
 * 遠端代理（isRemote=true）沒有本地 process / tmux，
 * 實際 kill 由 Agent Node 執行（見 agentNodeHandler），
 * 此函式在遠端代理上仍安全（跳過 kill、只做 remove + 廣播）。
 */
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

/**
 * 伺服器重啟後，收養仍活著的 pixel-agents-* tmux sessions，
 * 讓之前正在工作的代理在重啟後「看起來」繼續工作。
 *
 * 流程：
 *   1. 掃描系統中所有 `pixel-agents-*` 前綴的 tmux session
 *   2. 從名稱反推 sessionId → JSONL 檔案路徑
 *   3. 若 JSONL 已被其他自動偵測收養（trackedJsonlFiles），跳過
 *   4. 其餘建立 process=null（已經由 tmux 接管）的 AgentState
 *   5. 依 persisted-agents.json 還原外觀（palette/hue/seatId/floorId）
 *
 * @returns 本次恢復的代理數量
 */
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
