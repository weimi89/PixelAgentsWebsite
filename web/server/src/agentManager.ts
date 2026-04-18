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
	// 優先使用使用者設定的自訂名稱（由 SettingsModal 儲存）
	const custom = getCustomName(projectDir);
	if (custom) return custom;
	// 取路徑最後一段（例如 /Users/foo/my-project → my-project）
	const dirName = path.basename(projectDir);
	// 按 `-` 分段並過濾空字串，取最後一段作為精簡名（my-project → project）
	const parts = dirName.split(/-+/).filter(Boolean);
	// 若拆分失敗（全是 `-` 或空字串），退回原始目錄名
	return parts[parts.length - 1] || dirName;
}

/** 從會話檔案提取專案名稱（使用 CLI adapter 的自訂邏輯，若有的話） */
export function extractProjectNameFromFile(filePath: string, projectDir: string): string {
	// 依據專案目錄路徑判斷此會話是由哪個 CLI 產生的（claude/codex/gemini）
	const cliType = detectCliTypeFromPath(projectDir);
	// 取得該 CLI 的 adapter（各 CLI 的格式差異都封裝在 adapter 裡）
	const adapter = getAdapter(cliType);
	// 若 adapter 有自訂的名稱解析邏輯（例如 codex 從 session 檔案內部欄位讀），優先使用
	if (adapter?.extractProjectName) {
		const name = adapter.extractProjectName(filePath);
		// 若解析出非空字串則直接回傳
		if (name) return name;
	}
	// 退回通用版本（從目錄名解析）
	return extractProjectName(projectDir);
}

/** 從工作目錄路徑推導出 Claude 專案目錄路徑 */
export function getProjectDirPath(cwd: string): string {
	// Claude Code 把工作目錄路徑中的所有特殊字元（/、.、空白等）全部替換為 `-`
	// 這是它對應 ~/.claude/projects/ 下子目錄的命名規則
	const dirName = cwd.replace(/[^a-zA-Z0-9-]/g, '-');
	// 組合出完整路徑，例如 /Users/foo/my proj → ~/.claude/projects/-Users-foo-my-proj
	return path.join(os.homedir(), '.claude', 'projects', dirName);
}

/** 取得指定 CLI 類型的所有專案目錄清單（排除忽略模式和排除清單） */
export function getProjectDirsForCli(adapter: CLIAdapter): string[] {
	// 若 adapter 自行提供掃描邏輯（例如 codex 有特殊檔案結構），優先使用
	if (adapter.scanSessionFiles) {
		try {
			return adapter.scanSessionFiles()
				.map(r => r.dir)                     // 只要目錄路徑、不需要檔案清單
				.filter(dir => !isProjectExcluded(dir)); // 過濾使用者設定要隱藏的專案
		} catch {
			// 任一 adapter 失敗不應影響整體，返回空陣列
			return [];
		}
	}
	// 沒有自訂掃描邏輯時，走通用的根目錄遞迴搜尋
	const projectsRoot = adapter.getProjectsRoot();
	// 取得 adapter 定義的忽略模式（例如 observer-sessions）
	const ignoredPatterns = adapter.ignoredDirPatterns();
	try {
		// 遞迴找出所有含 JSONL 檔的子目錄，再過濾排除清單
		return findJsonlDirs(projectsRoot, ignoredPatterns)
			.filter(dir => !isProjectExcluded(dir));
	} catch {
		// I/O 錯誤（如權限不足）時返回空陣列，不中斷整個掃描流程
		return [];
	}
}

/** 從根目錄遞迴找出「直接包含 JSONL 檔案」的資料夾 */
function findJsonlDirs(rootDir: string, ignoredPatterns: string[]): string[] {
	// 最大遞迴深度，防止錯誤設定導致無限深搜尋
	const MAX_SCAN_DEPTH = 4;
	// 結果集合（用 Set 去重）
	const found = new Set<string>();
	// DFS 堆疊，初始推入根目錄（深度 0）
	const stack: Array<{ dir: string; depth: number }> = [{ dir: rootDir, depth: 0 }];

	// 遞迴探索所有子目錄直到堆疊清空
	while (stack.length > 0) {
		// 取出最上層目錄
		const current = stack.pop();
		if (!current) continue;

		// 讀取目錄內容（帶檔案型別資訊避免 lstat 額外呼叫）
		let entries: fs.Dirent[];
		try {
			entries = fs.readdirSync(current.dir, { withFileTypes: true });
		} catch {
			// 權限不足或目錄不存在，跳過此目錄繼續處理堆疊其他條目
			continue;
		}

		// 旗標：本層目錄是否有 .jsonl 檔案
		let hasJsonl = false;
		// 遍歷目錄下所有條目
		for (const entry of entries) {
			// 若是 .jsonl 檔案，標記本層為「含 JSONL」後繼續下一條目
			if (entry.isFile() && entry.name.endsWith('.jsonl')) {
				hasJsonl = true;
				continue;
			}
			// 跳過非目錄（例如符號連結）
			if (!entry.isDirectory()) continue;
			// 跳過 adapter 要求忽略的目錄名（如 observer-sessions）
			if (ignoredPatterns.some(p => entry.name.includes(p))) continue;
			// 達到最大深度，不再往下探索
			if (current.depth >= MAX_SCAN_DEPTH) continue;
			// 將子目錄推入堆疊，深度 + 1
			stack.push({ dir: path.join(current.dir, entry.name), depth: current.depth + 1 });
		}

		// 若本層確認有 JSONL，加入結果集合
		if (hasJsonl) {
			found.add(current.dir);
		}
	}

	// 將 Set 轉為陣列回傳
	return [...found];
}

/** 取得所有已註冊 CLI 的專案目錄清單 */
export function getAllProjectDirs(): string[] {
	// 結果陣列（保留順序，以便 UI 顯示時有一致先後）
	const dirs: string[] = [];
	// 遍歷所有已註冊的 adapter（claude/codex/gemini/...）
	for (const adapter of getAllAdapters()) {
		// 將每個 adapter 掃描出的目錄合併進總清單
		dirs.push(...getProjectDirsForCli(adapter));
	}
	return dirs;
}

/** 根據專案目錄路徑推斷 CLI 類型 */
export function detectCliTypeFromPath(projectDir: string): CliType {
	// 逐一檢查每個 adapter 的專案根目錄
	for (const adapter of getAllAdapters()) {
		// 若目錄路徑以該 adapter 的 projectsRoot 開頭，即屬於該 CLI
		if (projectDir.startsWith(adapter.getProjectsRoot())) {
			return adapter.name;
		}
	}
	// 未匹配時預設為 claude（最常見的 CLI）
	return 'claude';
}

// ── 持久化 ─────────────────────────────────────────────

/** 取得代理持久化檔案路徑 */
function getAgentsFilePath(): string {
	// 組合路徑：~/.pixel-agents/persisted-agents.json
	return path.join(os.homedir(), LAYOUT_FILE_DIR, AGENTS_FILE_NAME);
}

/** 將所有代理狀態持久化至磁碟（及 DB） */
export function savePersistedAgents(agents: Map<number, AgentState>): void {
	// 準備要寫入檔案的資料陣列
	const data: PersistedAgent[] = [];
	// 逐一處理每個代理
	for (const agent of agents.values()) {
		// 從 JSONL 檔案路徑取出 sessionId（檔名去除 .jsonl 副檔名）
		const sessionId = path.basename(agent.jsonlFile, '.jsonl');
		// 簡化變數名方便下方展開
		const g = agent.growth;
		// 組裝持久化物件；用展開運算子有條件地加入選填欄位（減小檔案體積）
		data.push({
			id: agent.id,
			sessionId,
			jsonlFile: agent.jsonlFile,
			projectDir: agent.projectDir,
			// tmux session 名稱；若是直接 spawn 則為 undefined
			tmuxSessionName: agent.tmuxSessionName ?? undefined,
			floorId: agent.floorId,
			// cliType 預設為 claude，只在非 claude 時才寫入
			...(agent.cliType !== 'claude' ? { cliType: agent.cliType } : {}),
			// 只在有擁有者時寫入
			...(agent.ownerId ? { ownerId: agent.ownerId } : {}),
			// 成長資料只在 xp > 0 才寫入（避免全是 0 的冗餘欄位）
			...(g.xp > 0 ? { xp: g.xp, toolCallCount: g.toolCallCount, sessionCount: g.sessionCount, bashCallCount: g.bashCallCount, achievements: g.achievements } : {}),
		});

		// 同步成長資料至 DB（主要儲存，JSON 檔為備援）
		if (db && g.xp > 0) {
			// 用專案目錄名作為聚合鍵
			const agentKey = path.basename(agent.projectDir);
			try {
				// 寫入 agent_appearances 表，保留外觀與統計
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
				// DB 寫入失敗時忽略，依然有 JSON 檔作為備份
			}
		}
	}
	// 寫入 JSON 檔（即使 DB 失敗也有此檔可用）
	try {
		// 取得目標檔路徑
		const filePath = getAgentsFilePath();
		// 確保父目錄存在（~/.pixel-agents/）
		const dir = path.dirname(filePath);
		if (!fs.existsSync(dir)) {
			// recursive 支援多層目錄一次建立
			fs.mkdirSync(dir, { recursive: true });
		}
		// 以 2 空格縮排序列化 JSON，提升檔案可讀性
		fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
	} catch (err) {
		// I/O 錯誤記錄到 console（例如磁碟已滿、權限問題）
		console.error('[Pixel Agents] Failed to persist agents:', err);
	}
}

/** 從磁碟載入先前持久化的代理資料 */
export function loadPersistedAgents(): PersistedAgent[] {
	try {
		// 取得 ~/.pixel-agents/persisted-agents.json 路徑
		const filePath = getAgentsFilePath();
		// 檔案不存在（首次啟動）返回空陣列
		if (!fs.existsSync(filePath)) return [];
		// 讀取 + 解析 JSON；失敗時由外層 catch 處理
		return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PersistedAgent[];
	} catch {
		// JSON 損壞或檔案讀取錯誤都返回空陣列，避免啟動失敗
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
	// 檔案偏移量（bytes）：下次讀取從這裡繼續，避免重複解析舊訊息
	let fileOffset = 0;
	try {
		// 若 JSONL 已存在（例如 resume 模式），從當前檔尾開始讀
		// 這樣只處理「從本次建立後」的新訊息，避免重播既有對話
		if (fs.existsSync(expectedFile)) {
			fileOffset = fs.statSync(expectedFile).size;
		}
	} catch { /* 忽略 stat 錯誤，保持 offset = 0（全檔掃描） */ }

	// 回傳所有欄位初始化為「空/無/預設」的 AgentState
	return {
		id,
		// 子進程尚未 spawn（呼叫端稍後設定）
		process: null,
		projectDir,
		jsonlFile: expectedFile,
		fileOffset,
		// 用於累積跨 read 片段的未完整行
		lineBuffer: '',
		// 當前正在執行的工具 ID 集合（供 UI 顯示）
		activeToolIds: new Set(),
		// 工具 ID → 顯示狀態字串
		activeToolStatuses: new Map(),
		// 工具 ID → 工具名稱
		activeToolNames: new Map(),
		// 子代理（Task 衍生）的工具 ID 嵌套結構
		activeSubagentToolIds: new Map(),
		activeSubagentToolNames: new Map(),
		// 氣泡狀態旗標
		isWaiting: false,
		permissionSent: false,
		// 本回合內是否有使用過工具（影響「閒置」判定）
		hadToolsInTurn: false,
		// 模型名稱（Opus/Sonnet/Haiku 等），初始未知
		model: null,
		// tmux 與直接 spawn 互斥；其中一個為 null
		tmuxSessionName: tmuxName,
		isDetached,
		// 最近 N 筆精簡轉錄，供對話記錄面板顯示
		transcriptLog: [],
		floorId,
		// 本地代理（非遠端 Agent Node 推送）
		isRemote: false,
		owner: null,
		ownerId: null,
		remoteSessionId: null,
		gitBranch: null,
		statusHistory: [],
		teamName: null,
		cliType,
		// 記錄開始時間戳，供 UI 顯示「工作時長」
		startedAt: Date.now(),
		// 成長資料（XP/等級/成就）初始化為預設
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
	// 解構全域狀態容器（由 index.ts 建立並傳入）
	const {
		nextAgentIdRef, agents, activeAgentIdRef,
		jsonlPollTimers, persistAgents,
	} = ctx;

	// 取得 CLI 對應的 adapter
	const adapter = getAdapter(cliType);
	// 若找不到 adapter（表示這個 CLI 類型未註冊），記錯誤後放棄
	if (!adapter) {
		console.error(`[Pixel Agents] No adapter found for CLI type: ${cliType}`);
		return;
	}

	// 預期 JSONL 檔的父目錄就是該代理的專案目錄
	const projectDir = path.dirname(expectedFile);

	// 準備乾淨的 env（避免繼承污染，尤其是巢狀 Claude 會話的偵測機制）
	const cleanEnv = adapter.buildCleanEnv();
	// 取得 CLI binary 絕對路徑
	const binaryPath = adapter.getBinaryPath();
	// 從 ref 取下一個可用的 agentId 並遞增（確保全局唯一）
	const id = nextAgentIdRef.current++;

	// 檢測本機是否有 tmux 可用
	const useTmux = isTmuxAvailable();
	// tmux session 名稱；直接 spawn 模式保持 null
	let tmuxName: string | null = null;

	if (useTmux) {
		// 以 sessionUuid 組成唯一的 tmux 名稱（前綴 pixel-agents-）
		tmuxName = buildTmuxName(sessionUuid);
		console.log(`[Pixel Agents] Using tmux session: ${tmuxName} (cli: ${cliType})`);
		// 在 tmux 中開新會話執行 binary + args
		createTmuxSession(tmuxName, binaryPath, args, cwd, cleanEnv);
	} else {
		console.log(`[Pixel Agents] tmux not available, using direct spawn`);
	}

	// 依專案目錄決定代理該分配到哪一樓層（透過 project-floor-map.json）
	const floorId = resolveFloorForProject(projectDir, ctx.building);
	// 建立空的 AgentState 容器（本地代理，isDetached=false）
	const agent = createAgentState(id, expectedFile, projectDir, tmuxName, false, floorId, cliType);
	// 取得該樓層專用的訊息廣播器（只向同樓層客戶端推送）
	const floorSend = ctx.floorSender(floorId);

	// 若沒用 tmux，直接以 child_process.spawn 啟動 CLI
	if (!useTmux) {
		console.log(`[Pixel Agents] Using ${cliType} binary: ${binaryPath}`);
		// 三個 stdio 都用 pipe，讓我們可以捕獲 stdout/stderr
		const proc = spawn(binaryPath, args, {
			cwd,
			stdio: ['pipe', 'pipe', 'pipe'],
			env: cleanEnv,
		});

		// 監聽 stdout（主要是 CLI 的進度訊息）
		proc.stdout?.on('data', (data: Buffer) => {
			// 移除 ANSI 控制字元與其他非可列印字元
			const text = data.toString().replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
			// 截斷顯示（前 200 字）避免洗版
			if (text) console.log(`[Pixel Agents] Agent stdout: ${text.slice(0, 200)}`);
		});
		// 監聽 stderr（警告/錯誤訊息）
		proc.stderr?.on('data', (data: Buffer) => {
			const text = data.toString().replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
			if (text) console.log(`[Pixel Agents] Agent stderr: ${text.slice(0, 200)}`);
		});

		// 把 ChildProcess 掛到 AgentState 上
		agent.process = proc;

		// 進程啟動錯誤（例如 binary 找不到、權限不足）
		proc.on('error', (err) => {
			console.error(`[Pixel Agents] Agent ${id}: process error:`, err);
			// 清理狀態
			removeAgent(id, ctx);
			// 廣播關閉事件給同樓層客戶端
			ctx.floorSender(agent.floorId).postMessage({ type: 'agentClosed', id });
			// 更新樓層人數徽章
			ctx.broadcastFloorSummaries();
		});

		// 進程正常/非正常結束
		proc.on('exit', (code) => {
			console.log(`[Pixel Agents] Agent ${id}: process exited with code ${code}`);
			removeAgent(id, ctx);
			ctx.floorSender(agent.floorId).postMessage({ type: 'agentClosed', id });
			ctx.broadcastFloorSummaries();
		});
	}

	// 把代理加入全域 agents Map
	agents.set(id, agent);
	// 建立反查表：JSONL 檔案路徑 → 代理 ID
	ctx.trackedJsonlFiles.set(agent.jsonlFile, id);
	// 標記此代理為當前「活躍」代理（UI 可能預設聚焦它）
	activeAgentIdRef.current = id;
	// 樓層代理計數 + 1
	ctx.incrementFloorCount(floorId);
	// 記錄一次 session 開始事件（供成長系統計算 sessionCount）
	recordSessionStart(id, agent, floorSend);
	// 持久化到磁碟
	persistAgents();

	// 若 DB 可用，記一筆 online 歷史事件
	if (db) {
		const agentKey = path.basename(projectDir);
		db.addAgentHistory(agentKey, 'online', `agent_id=${id} cli=${cliType}`);
	}
	console.log(`[Pixel Agents] Agent ${id}: ${label} (floor: ${floorId})`);

	// 判斷此代理是否為「外部」專案（非本伺服器所在專案）
	const isExternal = projectDir !== ctx.ownProjectDir;
	// 向同樓層客戶端廣播代理已建立事件
	floorSend.postMessage({
		type: 'agentCreated',
		id,
		projectName: extractProjectName(projectDir),
		floorId,
		startedAt: agent.startedAt,
		// 選填欄位：只有真的有值才加入訊息，減少 payload 體積
		...(isExternal ? { isExternal: true } : {}),
		...(cliType !== 'claude' ? { cliType } : {}),
	});

	// 重新廣播樓層摘要（讓 UI 更新每層人數）
	ctx.broadcastFloorSummaries();

	// 輪詢等待 JSONL 檔案出現（CLI 啟動需要時間，檔案不會立即出現）
	const pollStartTime = Date.now();
	// 每 N 毫秒檢查一次檔案是否已被 CLI 建立
	const pollTimer = setInterval(() => {
		try {
			// 檔案已出現：啟動檔案監聽並讀取既有內容
			if (fs.existsSync(agent.jsonlFile)) {
				console.log(`[Pixel Agents] Agent ${id}: found JSONL file ${path.basename(agent.jsonlFile)}`);
				// 停止輪詢
				clearInterval(pollTimer);
				// 從 Map 中移除此計時器紀錄
				jsonlPollTimers.delete(id);
				// 啟動 fs.watch + 2s 備援輪詢
				startFileWatching(id, agent.jsonlFile, ctx);
				// 立即讀取現有內容（處理 resume 情境下的歷史訊息）
				readNewLines(id, ctx);
				return;
			}
		} catch { /* fs.existsSync 理論上不拋錯，此 catch 為保險 */ }

		// 若超過最大等待時間仍沒出現，放棄並清理代理
		if (Date.now() - pollStartTime > JSONL_POLL_TIMEOUT_MS) {
			console.warn(`[Pixel Agents] Agent ${id}: JSONL file not found after ${JSONL_POLL_TIMEOUT_MS / 1000}s, removing`);
			// 停止輪詢
			clearInterval(pollTimer);
			jsonlPollTimers.delete(id);
			// 若在 tmux 中開的 session，也要 kill 掉以免殭屍 session
			if (agent.tmuxSessionName) {
				killTmuxSession(agent.tmuxSessionName);
			}
			// 清理代理狀態並通知客戶端
			removeAgent(id, ctx);
			ctx.floorSender(agent.floorId).postMessage({ type: 'agentClosed', id });
		}
	}, JSONL_POLL_INTERVAL_MS);
	// 將 timer 紀錄存起來以便後續 clearInterval（在 removeAgent 中）
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
	// 解構出 agents Map
	const { agents } = ctx;
	// 查詢目標代理
	const agent = agents.get(agentId);
	// 代理不存在則直接返回（idempotent）
	if (!agent) return;

	// 記下樓層 ID，因為 removeAgent 會把 agent 刪掉後就無法讀 floorId
	const floorId = agent.floorId;

	// 若代理透過 tmux 啟動，呼叫 tmux kill-session 結束其執行
	if (agent.tmuxSessionName) {
		killTmuxSession(agent.tmuxSessionName);
	}

	// 若代理直接 spawn 且進程仍活著，發送 SIGTERM 優雅終止
	// （process.killed 代表之前已送過 signal，避免重複發送）
	if (agent.process && !agent.process.killed) {
		agent.process.kill('SIGTERM');
	}

	// 呼叫 removeAgent 清理狀態（見該函式說明）
	removeAgent(agentId, ctx);
	// 向同樓層客戶端廣播代理已關閉
	ctx.floorSender(floorId).postMessage({ type: 'agentClosed', id: agentId });
	// 更新樓層代理數徽章
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
	// 解構出需要的狀態容器
	const { nextAgentIdRef, agents, persistAgents } = ctx;

	// 系統沒有 tmux（例如 Windows 無 tmux），無法恢復，直接返回 0
	if (!isTmuxAvailable()) return 0;

	// 列出系統中所有 pixel-agents-* 開頭的 tmux session（上次未正常關閉遺留下來）
	const liveSessions = listPixelAgentSessions();
	// 沒有任何遺留 session，不需恢復
	if (liveSessions.length === 0) return 0;

	// 載入上次持久化的代理資料（JSON 檔案）
	const persisted = loadPersistedAgents();
	// 建立 tmuxName → 持久化紀錄 的快速查表
	const persistedMap = new Map<string, PersistedAgent>();
	for (const p of persisted) {
		if (p.tmuxSessionName) {
			persistedMap.set(p.tmuxSessionName, p);
		}
	}

	// 統計本次成功恢復的代理數
	let recovered = 0;
	// 逐一處理每個存活的 tmux session
	for (const sessionName of liveSessions) {
		// 待會要用的檔案路徑與專案目錄，尚未確定先設 null
		let jsonlFile: string | null = null;
		let projectDir: string | null = null;
		let persistedFloorId: string | undefined;

		// 先從持久化資料查找；找到表示上次正常記錄有此代理
		const match = persistedMap.get(sessionName);
		if (match) {
			// 直接從紀錄取出三個關鍵欄位
			jsonlFile = match.jsonlFile;
			projectDir = match.projectDir;
			persistedFloorId = match.floorId;
		} else {
			// 備援路徑：持久化資料沒有時（例如檔案被刪），從 session 名反推 UUID
			const uuid = parseSessionUuid(sessionName);
			if (uuid) {
				// 掃描所有已註冊 CLI 的專案目錄，找到 <uuid>.jsonl 的位置
				const allDirs = getAllProjectDirs();
				for (const dir of allDirs) {
					const candidate = path.join(dir, `${uuid}.jsonl`);
					// 檔案存在則視為匹配
					if (fs.existsSync(candidate)) {
						jsonlFile = candidate;
						projectDir = dir;
						break;
					}
				}
			}
		}

		// 兩條路徑都沒找到 JSONL，跳過此 session（UI 不會顯示此代理）
		if (!jsonlFile || !projectDir) {
			console.log(`[Pixel Agents] tmux session ${sessionName}: no matching JSONL found, skipping`);
			continue;
		}

		// 若 JSONL 已經被自動偵測機制收養過（trackedJsonlFiles 已有此檔），跳過避免重複
		if (ctx.trackedJsonlFiles.has(jsonlFile)) continue;

		// 決定樓層：優先使用持久化記錄的；沒有則透過 floorAssignment 計算
		const floorId = persistedFloorId || resolveFloorForProject(projectDir, ctx.building);
		// 決定 CLI 類型：優先用持久化記錄；沒有則從路徑推導
		const cliType = match?.cliType || detectCliTypeFromPath(projectDir);
		// 分配新的 agentId（本次 server run 內唯一）
		const id = nextAgentIdRef.current++;
		// 建立 AgentState；process=null 因為 tmux 已接管進程
		const agent = createAgentState(id, jsonlFile, projectDir, sessionName, false, floorId, cliType);

		// 若有持久化紀錄，還原成長資料與所有權
		if (match) {
			agent.growth = restoreGrowth(match);
			if (match.ownerId) {
				agent.ownerId = match.ownerId;
			}
		}

		// 從頭重讀 JSONL（offset = 0），重建 UI 上的最近訊息
		agent.fileOffset = 0;
		// 加入全域狀態
		agents.set(id, agent);
		ctx.trackedJsonlFiles.set(agent.jsonlFile, id);
		// 樓層計數 + 1
		ctx.incrementFloorCount(floorId);

		console.log(`[Pixel Agents] Recovered tmux agent ${id}: ${sessionName} (floor: ${floorId}, cli: ${cliType})`);

		// 判斷是否為外部專案（非本伺服器專案）
		const isExternal = projectDir !== ctx.ownProjectDir;
		// 向同樓層客戶端廣播代理已建立
		ctx.floorSender(floorId).postMessage({
			type: 'agentCreated',
			id,
			projectName: extractProjectName(projectDir),
			floorId,
			startedAt: agent.startedAt,
			...(isExternal ? { isExternal: true } : {}),
			...(cliType !== 'claude' ? { cliType } : {}),
		});

		// 啟動檔案監視並立即讀取既有訊息
		startFileWatching(id, jsonlFile, ctx);
		readNewLines(id, ctx);

		recovered++;
	}

	// 有實際恢復代理才需要寫回持久化檔（避免多餘 I/O）
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
	// 解構出 agents Map
	const { agents } = ctx;

	// 本輪是否有代理被移除的旗標，用於最後決定是否廣播
	let removed = false;
	// 遍歷所有代理
	for (const [agentId, agent] of agents) {
		// 非 tmux 代理（直接 spawn 或遠端）不在此健康檢查範圍
		if (!agent.tmuxSessionName) continue;
		// 檢查 tmux session 是否仍存在（has-session 命令）
		if (!isTmuxSessionAlive(agent.tmuxSessionName)) {
			console.log(`[Pixel Agents] tmux session ${agent.tmuxSessionName} died, removing agent ${agentId}`);
			// 先備份 floorId，因 removeAgent 會清除 agent 物件
			const floorId = agent.floorId;
			// 清理狀態（見 removeAgent）
			removeAgent(agentId, ctx);
			// 廣播關閉事件給同樓層
			ctx.floorSender(floorId).postMessage({ type: 'agentClosed', id: agentId });
			removed = true;
		}
	}
	// 本輪有移除時才重算並廣播樓層摘要（樓層人數徽章要更新）
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
	// 若 sender 未定義（樓層 Room 尚未建立），不傳送
	if (!sender) return;
	// 收集要傳送的代理 ID 清單
	const agentIds: number[] = [];
	// 遍歷所有代理，篩選屬於目標樓層（若有指定）
	for (const [id, agent] of agents) {
		// 有 floorId 參數時，跳過不在此樓層的代理
		if (floorId && agent.floorId !== floorId) continue;
		agentIds.push(id);
	}
	// 依 ID 排序，確保 UI 顯示順序一致
	agentIds.sort((a, b) => a - b);

	// 把原始 agentMeta（外觀）複製一份，準備補充其他欄位
	const enrichedMeta: Record<string, { palette?: number; hueShift?: number; seatId?: string; isExternal?: boolean; projectName?: string; floorId?: string; isRemote?: boolean; owner?: string; ownerId?: string; cliType?: string; startedAt?: number }> = {};
	for (const [idStr, meta] of Object.entries(agentMeta)) {
		enrichedMeta[idStr] = { ...meta };
	}
	// 為每個代理補充專案名稱、樓層等資訊
	for (const id of agentIds) {
		const agent = agents.get(id);
		if (!agent) continue;
		// Map key 必須是 string
		const key = String(id);
		// 若此代理原本沒有外觀紀錄（新代理），先建立空物件
		if (!enrichedMeta[key]) enrichedMeta[key] = {};
		// 補充專案名稱（用於 UI 標籤）
		enrichedMeta[key].projectName = extractProjectName(agent.projectDir);
		// 樓層 ID
		enrichedMeta[key].floorId = agent.floorId;
		// 開始工作時間戳（計算工作時長用）
		enrichedMeta[key].startedAt = agent.startedAt;

		// 判斷是否為外部專案（與本伺服器專案不同）
		const isExternal = agent.projectDir !== ownProjectDir;
		if (isExternal) {
			enrichedMeta[key].isExternal = true;
		}
		// 非 claude CLI 時加 cliType 讓 UI 顯示識別
		if (agent.cliType !== 'claude') {
			enrichedMeta[key].cliType = agent.cliType;
		}
		// 遠端代理加橘色光暈標識
		if (agent.isRemote) {
			enrichedMeta[key].isRemote = true;
			// 所有者名稱顯示於標籤
			if (agent.owner) {
				enrichedMeta[key].owner = agent.owner;
			}
		}
		// 記錄所有者 userId（用於權限判斷）
		if (agent.ownerId) {
			enrichedMeta[key].ownerId = agent.ownerId;
		}
	}

	// 第一階段：發送代理清單 + 外觀資訊
	sender.postMessage({
		type: 'existingAgents',
		agents: agentIds,
		agentMeta: enrichedMeta,
	});

	// 第二階段：重新傳送每個代理的當前動態狀態
	// （必須在 existingAgents 之後，因客戶端需先建立角色物件）
	for (const id of agentIds) {
		const agent = agents.get(id);
		if (!agent) continue;
		// 模型資訊（Opus/Sonnet/Haiku）
		if (agent.model) {
			sender.postMessage({
				type: 'agentModel',
				id,
				model: agent.model,
			});
		}
		// 當前正在執行的工具（可能有多個，如 Task 子代理）
		for (const [toolId, status] of agent.activeToolStatuses) {
			sender.postMessage({
				type: 'agentToolStart',
				id,
				toolId,
				status,
			});
		}
		// 等待輸入狀態（綠色勾號氣泡）
		if (agent.isWaiting) {
			sender.postMessage({
				type: 'agentStatus',
				id,
				status: 'waiting',
			});
		}
		// 成長資料（等級、經驗、成就）
		if (agent.growth.xp > 0) {
			sender.postMessage({
				type: 'agentGrowth',
				id,
				xp: agent.growth.xp,
				// 由 XP 計算等級（見 growthSystem.ts）
				level: calculateLevel(agent.growth.xp),
				achievements: agent.growth.achievements,
				// 重新發送時不算「新解鎖」，避免重複觸發解鎖通知
				newAchievements: [],
			});
		}
	}
}
