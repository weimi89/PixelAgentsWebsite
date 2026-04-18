/**
 * fileWatcher — JSONL 檔案監視、增量讀取、自動收養
 *
 * 職責：
 *   - 為每個代理建立 fs.watch + 2s 輪詢備援，偵測 JSONL 檔案變更
 *   - 讀取新增的行（JSONL 增量）或全檔（Gemini JSON）後交給 transcriptParser
 *   - 定期掃描所有專案目錄，發現未被代理認領的活躍 JSONL 並自動建立代理
 *   - 清理陳舊代理（長時間無更新）
 *   - 處理 /clear 後代理重新指派到新 JSONL 檔的情境
 *
 * 關鍵設計：
 *   - 增量讀取用 fileOffset（bytes）追蹤讀到哪，避免重複解析
 *   - Claude/Codex 用逐行 JSONL；Gemini 用全量 JSON 格式（geminiLastSize/geminiMessageCount）
 *   - 大檔案（>100KB）Gemini 採尾部讀取優化，避免每次 JSON.parse 整檔
 *   - 掃描間隔動態調整（代理多時縮短、少時拉長）
 *   - 目錄 mtime 快取避免無變更時重複 readdir
 */
import * as fs from 'fs';
import * as path from 'path';
import type { AgentContext, AgentState } from './types.js';
import { cancelWaitingTimer, cancelPermissionTimer, clearAgentActivity } from './timerManager.js';
import { processTranscriptLine } from './transcriptParser.js';
import { removeAgent, extractProjectNameFromFile, detectCliTypeFromPath, loadPersistedAgents } from './agentManager.js';
import { DEFAULT_GROWTH, restoreGrowth, recordSessionStart } from './growthSystem.js';
import { resolveFloorForProject } from './floorAssignment.js';
import { getTeamName } from './teamNameStore.js';
import { getAdapter } from './cliAdapters/index.js';
import {
	FILE_WATCHER_POLL_INTERVAL_MS,
	PROJECT_SCAN_INTERVAL_MS,
	PROJECT_SCAN_MIN_INTERVAL_MS,
	PROJECT_SCAN_MAX_INTERVAL_MS,
	ACTIVE_JSONL_MAX_AGE_MS,
	STALE_AGENT_TIMEOUT_MS,
	DEFAULT_FLOOR_ID,
	GEMINI_LARGE_FILE_THRESHOLD_BYTES,
} from './constants.js';

/** 每代理的 readNewLines 節流時間戳，防止 fs.watch + 輪詢雙重觸發 */
const lastReadTime = new Map<number, number>();
const READ_THROTTLE_MS = 100;

/** 目錄級 mtime 快取：避免在目錄未變更時重複 readdirSync（Task 2.1） */
interface DirCacheEntry {
	/** 目錄本身的 mtimeMs（macOS 上僅在新增/刪除檔案時更新） */
	dirMtimeMs: number;
	/** 各檔案的 mtimeMs（用於判斷是否活躍） */
	fileMtimes: Map<string, number>;
}
const dirScanCache = new Map<string, DirCacheEntry>();

/** 持久化代理快取（每次掃描週期重新載入） */
let persistedAgentsCache: ReturnType<typeof loadPersistedAgents> | null = null;
let persistedAgentsCacheTime = 0;
const PERSISTED_CACHE_TTL_MS = 5000;

/** 帶 TTL 的持久化代理清單快取（避免每輪自動掃描都重讀 JSON 檔） */
function loadPersistedAgentsOnce(): ReturnType<typeof loadPersistedAgents> {
	// 取得當前時間戳
	const now = Date.now();
	// 快取不存在或超過 TTL（5s），重新讀檔
	if (!persistedAgentsCache || now - persistedAgentsCacheTime > PERSISTED_CACHE_TTL_MS) {
		// 從 ~/.pixel-agents/persisted-agents.json 讀取
		persistedAgentsCache = loadPersistedAgents();
		// 更新快取時間戳
		persistedAgentsCacheTime = now;
	}
	// 回傳快取內容
	return persistedAgentsCache;
}

/** 啟動檔案監視（fs.watch + 輪詢備援），偵測 JSONL 檔案變更 */
export function startFileWatching(
	agentId: number,
	filePath: string,
	ctx: AgentContext,
): void {
	// 解構出要用的 Map（agents 用於輪詢時檢查代理是否仍存在）
	const { agents, fileWatchers, pollingTimers } = ctx;

	// 主要方式：fs.watch（OS 原生通知，低延遲）
	try {
		// 對 JSONL 檔建立監聽，每次檔案變更就觸發 readNewLines
		const watcher = fs.watch(filePath, () => {
			readNewLines(agentId, ctx);
		});
		// 記錄 watcher 實例，removeAgent 時需要 close 它
		fileWatchers.set(agentId, watcher);
	} catch (e) {
		// fs.watch 可能失敗（檔案剛被刪或權限不足），不中斷流程
		console.log(`[Pixel Agents] fs.watch failed for agent ${agentId}: ${e}`);
	}

	// 備援：每 2 秒輪詢（fs.watch 在 Windows 與某些 macOS 情境下不可靠）
	const interval = setInterval(() => {
		// 若代理已被移除，停止輪詢並清理計時器
		if (!agents.has(agentId)) { clearInterval(interval); return; }
		// 主動讀取新增行（若 fs.watch 漏掉事件，此處會補上）
		readNewLines(agentId, ctx);
	}, FILE_WATCHER_POLL_INTERVAL_MS);
	// 記錄計時器供後續清理
	pollingTimers.set(agentId, interval);
}

/** 讀取會話檔案中的新資料，逐行（JSONL）或全量（JSON）交給轉錄解析器處理 */
export function readNewLines(
	agentId: number,
	ctx: AgentContext,
): void {
	// 解構需要的 Map（agents 查代理、兩個 timer Map 用於讀到新資料時取消計時器）
	const { agents, waitingTimers, permissionTimers } = ctx;
	// 取得此代理狀態；若已被移除就清除節流紀錄後直接返回
	const agent = agents.get(agentId);
	if (!agent) {
		// 清除節流時間戳避免記憶體洩漏
		lastReadTime.delete(agentId);
		return;
	}

	// Gemini 不是 JSONL 而是單一 JSON 物件（messages 陣列），分支走全量讀取路徑
	if (agent.cliType === 'gemini') {
		readGeminiSession(agentId, ctx);
		return;
	}

	// 節流：fs.watch 和 2s 輪詢可能同一瞬間都觸發，100ms 內忽略第二次
	const now = Date.now();
	const lastRead = lastReadTime.get(agentId) || 0;
	if (now - lastRead < READ_THROTTLE_MS) return;
	// 記錄本次讀取時間戳
	lastReadTime.set(agentId, now);
	// 取得對應樓層的訊息發送器（只廣播給同樓層的客戶端）
	const sender = ctx.floorSender(agent.floorId);
	try {
		// 讀取檔案目前大小
		const stat = fs.statSync(agent.jsonlFile);
		// 檔案沒長大代表沒新資料，省下 read 呼叫
		if (stat.size <= agent.fileOffset) return;

		// 分配緩衝區裝載「上次讀到的位置」到「目前檔尾」的新資料
		const buf = Buffer.alloc(stat.size - agent.fileOffset);
		// 用 fd 方式讀取指定 offset，比 readFile 省記憶體（不讀整檔）
		const fd = fs.openSync(agent.jsonlFile, 'r');
		try {
			// 從 fileOffset 位置讀取 buf.length 位元組
			fs.readSync(fd, buf, 0, buf.length, agent.fileOffset);
		} finally {
			// 無論成功失敗都要關 fd，避免 fd 洩漏
			fs.closeSync(fd);
		}
		// 更新 offset 到新位置，下次從這裡接著讀
		agent.fileOffset = stat.size;

		// 關鍵：lineBuffer 保留上次未終止的行（JSONL 可能寫到一半被讀到）
		const text = agent.lineBuffer + buf.toString('utf-8');
		// 用 \n 分行；最後一段可能不完整，暫存回 lineBuffer 等下次合併
		const lines = text.split('\n');
		agent.lineBuffer = lines.pop() || '';

		// 偵測是否有實際內容（跳過純空白行）
		const hasLines = lines.some(l => l.trim());
		if (hasLines) {
			// 有新資料代表代理還活著：取消等待氣泡與權限氣泡計時器
			cancelWaitingTimer(agentId, waitingTimers);
			cancelPermissionTimer(agentId, permissionTimers);
			// 若先前已送出權限氣泡，通知客戶端清除
			if (agent.permissionSent) {
				agent.permissionSent = false;
				sender?.postMessage({ type: 'agentToolPermissionClear', id: agentId });
			}
		}

		// 逐行交給 transcriptParser 解析（tool_use、tool_result、thinking 等）
		for (const line of lines) {
			// 跳過空白行
			if (!line.trim()) continue;
			processTranscriptLine(agentId, line, ctx);
		}
	} catch (e) {
		// 檔案暫時消失（/clear）、權限問題等不中斷，下次輪詢會再試
		console.log(`[Pixel Agents] Read error for agent ${agentId}: ${e}`);
	}
}

/**
 * Gemini 全量讀取：讀取 JSON 會話檔，只處理新增的訊息。
 * Task 2.3 優化：大檔案（>100KB）先嘗試尾部讀取解析新訊息，
 * 避免每次全量 JSON.parse 的開銷。失敗時回退至全量讀取。
 */
function readGeminiSession(agentId: number, ctx: AgentContext): void {
	const { agents, waitingTimers, permissionTimers } = ctx;
	const agent = agents.get(agentId);
	if (!agent) return;

	// 節流：同 readNewLines，避免 fs.watch + 輪詢雙重觸發
	const now = Date.now();
	const lastRead = lastReadTime.get(agentId) || 0;
	if (now - lastRead < READ_THROTTLE_MS) return;
	lastReadTime.set(agentId, now);

	// 取得對應樓層的訊息發送器
	const sender = ctx.floorSender(agent.floorId);
	try {
		// 取得檔案目前大小
		const stat = fs.statSync(agent.jsonlFile);
		// 比對上次處理完的大小（watermark）；相同代表沒新資料
		const lastSize = agent.geminiLastSize ?? 0;
		if (stat.size === lastSize) return;

		// 上次已處理的訊息數量（Gemini 格式是 messages 陣列索引）
		const processedCount = agent.geminiMessageCount ?? 0;
		// 將被填入的「新訊息陣列」（null 代表需要回退至全量讀取）
		let newMessages: Array<Record<string, unknown>> | null = null;
		// 新的 messageCount（成功後寫回 agent）
		let nextMessageCount = processedCount;

		// 大檔案（>100KB）優化路徑：從檔尾讀取增量 JSON 片段，避免整檔 JSON.parse
		// 需有有效基準（lastSize>0、processedCount>0）才能計算增量區段
		if (stat.size > GEMINI_LARGE_FILE_THRESHOLD_BYTES && lastSize > 0 && processedCount > 0) {
			newMessages = tryGeminiTailRead(agent.jsonlFile, lastSize, stat.size);
			// 尾部讀取成功 → 累計新訊息數（增量模式）
			if (newMessages) {
				nextMessageCount = processedCount + newMessages.length;
			}
		}

		// 尾部讀取失敗或小檔案 — 退回全量讀取（權威來源，以此重設 watermark）
		if (!newMessages) {
			// 一次讀進整個檔案
			const content = fs.readFileSync(agent.jsonlFile, 'utf-8');
			// 解析為 { messages: [...] } 物件
			const session = JSON.parse(content);
			const messages = session.messages as Array<Record<string, unknown>> || [];
			// 只取未處理過的尾端訊息
			newMessages = messages.slice(processedCount);
			// 全量模式下 count 直接等於陣列總長度
			nextMessageCount = messages.length;
		}

		// 所有讀取/解析都成功後才更新 watermark；中途擲例外就維持舊值下次重試
		agent.geminiLastSize = stat.size;
		agent.geminiMessageCount = nextMessageCount;

		// 若確實有新訊息：取消氣泡計時器、清除權限氣泡
		if (newMessages.length > 0) {
			cancelWaitingTimer(agentId, waitingTimers);
			cancelPermissionTimer(agentId, permissionTimers);
			if (agent.permissionSent) {
				agent.permissionSent = false;
				sender?.postMessage({ type: 'agentToolPermissionClear', id: agentId });
			}
		}

		// 將每則新訊息轉回 JSON 字串後交給 transcriptParser（共用 Claude/Codex 的管線）
		for (const msg of newMessages) {
			processTranscriptLine(agentId, JSON.stringify(msg), ctx);
		}
	} catch (e) {
		// JSON 解析失敗（檔案寫到一半）等狀況不中斷流程，下次重試
		console.log(`[Pixel Agents] Gemini read error for agent ${agentId}: ${e}`);
	}
}

/**
 * 嘗試從 Gemini JSON 檔案的尾部讀取新訊息（Task 2.3）。
 * Gemini 格式：{"messages":[...]}，新訊息追加在 ]} 之前。
 * 策略：讀取從 (lastSize - overlap) 到 currentSize 的區段，
 * 嘗試解析出新的 JSON 物件。
 * @returns 新訊息陣列，或 null 表示需要回退至全量讀取。
 */
function tryGeminiTailRead(
	filePath: string,
	lastSize: number,
	currentSize: number,
): Array<Record<string, unknown>> | null {
	try {
		// overlap = 往前多讀 100 位元組，確保跨邊界的 JSON 物件不會被切斷
		const overlap = 100;
		// 計算實際讀取起點（不可為負）
		const readStart = Math.max(0, lastSize - overlap);
		// 讀取長度 = 從起點到當前檔尾
		const readLength = currentSize - readStart;

		// 分配緩衝並用 fd 讀取指定區段（避免整檔載入）
		const buf = Buffer.alloc(readLength);
		const fd = fs.openSync(filePath, 'r');
		try {
			fs.readSync(fd, buf, 0, readLength, readStart);
		} finally {
			// 確保 fd 被關閉
			fs.closeSync(fd);
		}
		// 轉為字串以便用字串操作截出增量片段
		const tail = buf.toString('utf-8');

		// 尾部資料格式大約為: ...前一訊息},{新訊息1},{新訊息2}]}
		// 從 overlap 區域之後找下一個 `{` 作為新資料起點（跳過重疊段）
		const newDataStart = tail.indexOf('{', overlap);
		if (newDataStart === -1) return null;

		// 取出「新訊息起點」到「檔尾」的片段
		let fragment = tail.slice(newDataStart).trimEnd();
		// 若結尾是 `]}` 代表整份 messages 陣列的關閉符，去掉
		if (fragment.endsWith(']}')) {
			fragment = fragment.slice(0, -2);
		} else if (fragment.endsWith(']')) {
			// 只有 `]`（罕見的中間狀態）也要去掉
			fragment = fragment.slice(0, -1);
		}
		// 去掉尾部逗號，避免 JSON.parse 失敗
		fragment = fragment.replace(/,\s*$/, '');

		// 若處理完變空字串，代表沒新增訊息
		if (!fragment.trim()) return null;

		// 用 `[...]` 包裝後即可 JSON.parse 成陣列
		const parsed = JSON.parse(`[${fragment}]`) as Array<Record<string, unknown>>;

		// 保險：空陣列視為需回退至全量讀取
		if (parsed.length === 0) return null;

		return parsed;
	} catch {
		// 任何解析錯誤都回傳 null，讓呼叫端改走全量讀取（權威來源）
		return null;
	}
}

/** 檢查 JSONL 檔案是否已被現有代理追蹤 */
function isTrackedByAgent(filePath: string, ctx: AgentContext): boolean {
	// trackedJsonlFiles 為 path → agentId 的反查表，用於避免同一檔案被收養兩次
	return ctx.trackedJsonlFiles.has(filePath);
}

/** 根據代理數量計算動態掃描間隔（Task 2.2） */
function computeScanInterval(agentCount: number): number {
	// 沒代理時拉長至 10s，減輕 idle CPU 負擔
	if (agentCount === 0) return PROJECT_SCAN_MAX_INTERVAL_MS;
	// 高負載（10+ 代理）縮至 1s，降低新會話發現延遲
	if (agentCount >= 10) return PROJECT_SCAN_MIN_INTERVAL_MS;
	// 一般情況用 3s 預設值
	return PROJECT_SCAN_INTERVAL_MS;
}

/** 啟動定期專案掃描，自動偵測並收養活躍的 Claude 會話 */
export function ensureProjectScan(
	projectDirs: string[],
	projectScanTimerRef: { current: ReturnType<typeof setTimeout> | null },
	ctx: AgentContext,
): void {
	// 已有掃描計時器 → 不重複啟動（冪等）
	if (projectScanTimerRef.current) return;

	// 第一輪立即執行（不等 setTimeout）收養啟動時已存在的活躍會話
	for (const dir of projectDirs) {
		scanAndAdopt(dir, ctx);
	}

	// 以遞迴 setTimeout 實作「每輪結束後動態決定下輪間隔」
	// 比 setInterval 好的地方：可隨代理數量變化調整頻率
	function scheduleNextScan(): void {
		// 依目前代理數決定下一輪間隔
		const interval = computeScanInterval(ctx.agents.size);
		projectScanTimerRef.current = setTimeout(() => {
			// 輪到這輪：掃描所有專案目錄
			for (const dir of projectDirs) {
				scanAndAdopt(dir, ctx);
			}
			// 本輪結束後排下一輪（遞迴）
			scheduleNextScan();
		}, interval);
	}
	// 啟動第一次排程
	scheduleNextScan();
}

/** 停止定期專案掃描（動態關閉或重啟時使用） */
export function stopProjectScan(
	projectScanTimerRef: { current: ReturnType<typeof setTimeout> | null },
): void {
	// 若有排程中的 setTimeout 就取消並清空 ref
	if (projectScanTimerRef.current) {
		clearTimeout(projectScanTimerRef.current);
		projectScanTimerRef.current = null;
	}
}

/**
 * 使用目錄 mtime 快取掃描檔案清單（Task 2.1）。
 * macOS 上目錄 mtime 僅在新增/刪除檔案時更新，不會因檔案內容變更而更新。
 * 因此：
 *   - 目錄 mtime 未變：跳過 readdirSync，僅 re-stat 上次已知活躍的檔案
 *   - 目錄 mtime 已變（或無快取）：完整 readdirSync + stat 全部檔案
 * 回傳 [filePath, mtimeMs][] 僅包含活躍的檔案。
 */
function scanDirWithCache(
	scanDir: string,
	ext: string,
): Array<{ filePath: string; mtimeMs: number }> {
	// 步驟 1：取得目錄本身的 mtime，作為「目錄結構是否變動」的指標
	let dirMtimeMs: number;
	try {
		dirMtimeMs = fs.statSync(scanDir).mtimeMs;
	} catch {
		// 目錄不存在或無權限 → 回傳空陣列
		return [];
	}

	// 讀取目錄快取（可能為 undefined = 首次掃描）
	const cached = dirScanCache.get(scanDir);
	const now = Date.now();

	// 快取命中路徑：目錄 mtime 沒變代表沒新增/刪除檔案，只需重新 stat 既有檔案
	if (cached && cached.dirMtimeMs === dirMtimeMs) {
		const results: Array<{ filePath: string; mtimeMs: number }> = [];
		// 走訪快取中記錄的每個檔案
		for (const [filePath, lastMtime] of cached.fileMtimes) {
			// 優化：上次 mtime 距今已超過 2 倍閾值的檔案，幾乎不可能突然變活躍 → 跳過 stat
			if ((now - lastMtime) > ACTIVE_JSONL_MAX_AGE_MS * 2) continue;
			try {
				// 重新 stat 取得最新 mtime
				const stat = fs.statSync(filePath);
				// 更新快取中此檔的 mtime
				cached.fileMtimes.set(filePath, stat.mtimeMs);
				// 30 秒內有更新 → 活躍，放入結果
				if ((now - stat.mtimeMs) < ACTIVE_JSONL_MAX_AGE_MS) {
					results.push({ filePath, mtimeMs: stat.mtimeMs });
				}
			} catch {
				// 檔案中途被刪 → 從快取清掉
				cached.fileMtimes.delete(filePath);
			}
		}
		return results;
	}

	// 快取未命中或目錄有變動 — 走完整掃描路徑
	let fileNames: string[];
	try {
		// 讀取目錄並過濾副檔名（.jsonl 或 .json）
		fileNames = fs.readdirSync(scanDir).filter(f => f.endsWith(ext));
	} catch {
		// readdirSync 失敗（目錄可能剛被刪）→ 回空陣列
		return [];
	}

	// 建立新的 fileMtimes 快取（取代舊的）
	const fileMtimes = new Map<string, number>();
	const results: Array<{ filePath: string; mtimeMs: number }> = [];

	// 對每個候選檔案做 stat 並判斷活躍性
	for (const f of fileNames) {
		const filePath = path.join(scanDir, f);
		try {
			const stat = fs.statSync(filePath);
			// 不論活躍與否都記入快取（下次命中路徑可用）
			fileMtimes.set(filePath, stat.mtimeMs);
			// 30 秒內有更新才算活躍
			if ((now - stat.mtimeMs) < ACTIVE_JSONL_MAX_AGE_MS) {
				results.push({ filePath, mtimeMs: stat.mtimeMs });
			}
		} catch {
			// 個別檔案 stat 失敗 → 跳過，不中斷整個掃描
		}
	}

	// 寫回目錄快取（下次可走快取命中路徑）
	dirScanCache.set(scanDir, { dirMtimeMs, fileMtimes });
	return results;
}

/** 掃描單一專案目錄，收養活躍的外部會話（支援 JSONL 和 JSON） */
function scanAndAdopt(
	projectDir: string,
	ctx: AgentContext,
): void {
	// 解構出建立代理需要的欄位
	const { nextAgentIdRef, agents, persistAgents } = ctx;

	// 依專案目錄路徑推斷 CLI 類型（claude / codex / gemini）
	const cliType = detectCliTypeFromPath(projectDir);
	// 取對應 adapter 詢問該 CLI 的會話檔副檔名
	const adapter = getAdapter(cliType);
	const ext = adapter?.sessionFileExtension?.() || '.jsonl';

	// Gemini 會話檔放在 chats/ 子目錄；其他 CLI 直接在專案目錄
	const scanDir = cliType === 'gemini' ? path.join(projectDir, 'chats') : projectDir;
	// 取得活躍（30s 內有更新）的會話檔清單（走目錄 mtime 快取）
	const activeFiles = scanDirWithCache(scanDir, ext);

	for (const { filePath: file } of activeFiles) {
		// 已被某代理追蹤的檔案不重複收養
		if (isTrackedByAgent(file, ctx)) continue;

		// 自動收養流程開始
		// 依專案分配樓層（預設 1F，或使用者設定的對應樓層）
		const floorId = resolveFloorForProject(projectDir, ctx.building);
		// 再次偵測 CLI 類型（shadow 外層變數，確保跟著目錄）
		const cliType = detectCliTypeFromPath(projectDir);
		// 分配新代理 ID
		const id = nextAgentIdRef.current++;
		// 建立代理狀態物件：所有欄位初始化
		const agent: AgentState = {
			id,
			process: null, // 外部會話 — 由使用者手動啟動，非本服務 spawn
			projectDir,
			jsonlFile: file,
			fileOffset: 0, // 從檔首開始讀（首次會一次讀完整個會話紀錄）
			lineBuffer: '', // 行緩衝初始化
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
			isRemote: false, // 自動收養都是本機會話
			owner: null,
			ownerId: null,
			remoteSessionId: null,
			gitBranch: null,
			statusHistory: [],
			teamName: getTeamName(projectDir), // 讀出使用者設定的團隊名稱（可為 null）
			cliType,
			startedAt: Date.now(),
			growth: { ...DEFAULT_GROWTH }, // 預設成長狀態（後續可能被還原覆寫）
		};
		// 從持久化資料還原成長狀態（等級、經驗值等）
		const sessionId = path.basename(file, ext);
		const persisted = loadPersistedAgentsOnce();
		const match = persisted.find(p => p.sessionId === sessionId);
		if (match) {
			// 有對應 sessionId → 從持久化資料重建 growth
			agent.growth = restoreGrowth(match);
		}
		// 註冊代理到 Map
		agents.set(id, agent);
		// 反查表：file → agentId，用於 isTrackedByAgent 與 /clear 時重指派
		ctx.trackedJsonlFiles.set(file, id);
		// 更新樓層代理計數（用於樓層摘要廣播）
		ctx.incrementFloorCount(floorId);
		// 取對應樓層的廣播器
		const floorSend = ctx.floorSender(floorId);
		// 記錄新會話開始（成長系統可能給每日登入獎勵等）
		recordSessionStart(id, agent, floorSend);
		// 寫回 persisted-agents.json
		persistAgents();
		console.log(`[Pixel Agents] Auto-adopted session: ${path.basename(file)} → Agent ${id} (floor: ${floorId}, cli: ${cliType})`);
		// 外部專案（非本機服務的工作目錄）需帶 isExternal 旗標，客戶端會顯示專案名稱
		const isExternal = projectDir !== ctx.ownProjectDir;
		floorSend.postMessage({
			type: 'agentCreated',
			id,
			projectName: extractProjectNameFromFile(file, projectDir),
			floorId,
			startedAt: agent.startedAt,
			// 條件式展開：只在為 true 時加入欄位，減少傳輸量
			...(isExternal ? { isExternal: true } : {}),
			// 非 Claude 才傳 cliType（Claude 為預設值省略）
			...(cliType !== 'claude' ? { cliType } : {}),
		});
		// 若有團隊名稱，額外發送 agentTeam 訊息給客戶端顯示標籤
		if (agent.teamName) {
			floorSend.postMessage({ type: 'agentTeam', id, teamName: agent.teamName });
		}

		// 立即啟動檔案監視，並同步讀取目前已有的內容
		startFileWatching(id, file, ctx);
		readNewLines(id, ctx);

		// 新代理加入後，樓層摘要需要更新（選取器中顯示數量）
		ctx.broadcastFloorSummaries();
	}

	// 本輪掃描結束後，順手檢查並移除陳舊代理（10 分鐘無更新）
	checkStaleAgents(ctx);
}

/** 移除 JSONL 檔案最近未更新且沒有受管理進程的代理 */
function checkStaleAgents(ctx: AgentContext): void {
	const { agents } = ctx;

	// 蒐集候選的陳舊代理 ID（第一階段只找、不動 Map，避免邊走邊改）
	const staleIds: number[] = [];
	for (const [id, agent] of agents) {
		// 跳過本服務 spawn 或 tmux 管理的代理（它們由進程結束事件移除）
		if (agent.process || agent.tmuxSessionName) continue;
		try {
			// 檢查 JSONL 檔案最後修改時間
			const stat = fs.statSync(agent.jsonlFile);
			const age = Date.now() - stat.mtimeMs;
			// 10 分鐘閾值：容忍 extended thinking 等長時間無寫入（比預期保守）
			if (age > STALE_AGENT_TIMEOUT_MS) {
				console.log(`[Pixel Agents] Agent ${id}: session stale (${Math.round(age / 1000)}s), removing`);
				staleIds.push(id);
			}
		} catch {
			// stat 失敗（檔案被刪）→ 直接標記為陳舊
			staleIds.push(id);
		}
	}
	// 第二階段：實際移除陳舊代理
	for (const id of staleIds) {
		const agent = agents.get(id);
		// 即使代理已消失也要用預設樓層廣播（保險起見）
		const floorId = agent?.floorId || DEFAULT_FLOOR_ID;
		const floorSend = ctx.floorSender(floorId);
		// 若還有未完成的工具 → 先廣播清除，避免客戶端殘留覆蓋層
		if (agent && agent.activeToolIds.size > 0) {
			agent.activeToolIds.clear();
			agent.activeToolStatuses.clear();
			agent.activeToolNames.clear();
			agent.activeSubagentToolIds.clear();
			agent.activeSubagentToolNames.clear();
			floorSend.postMessage({ type: 'agentToolsClear', id });
		}
		// 實際從 Map 移除（含 watcher / timer 清理）
		removeAgent(id, ctx);
		// 通知客戶端移除角色
		floorSend.postMessage({ type: 'agentClosed', id });
	}
	// 只在有變動時才重算樓層摘要，避免無謂廣播
	if (staleIds.length > 0) {
		ctx.broadcastFloorSummaries();
	}
}

/** 將代理重新指派到新的 JSONL 檔案（例如 /clear 後建立的新檔案） */
export function reassignAgentToFile(
	agentId: number,
	newFilePath: string,
	ctx: AgentContext,
): void {
	// 解構所有需要清理的 Map
	const { agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, persistAgents } = ctx;
	const agent = agents.get(agentId);
	// 代理已不存在就無事可做
	if (!agent) return;

	// 步驟 1：關閉舊檔的 fs.watch
	fileWatchers.get(agentId)?.close();
	fileWatchers.delete(agentId);
	// 步驟 2：停止舊檔的輪詢計時器
	const pt = pollingTimers.get(agentId);
	if (pt) { clearInterval(pt); }
	pollingTimers.delete(agentId);

	// 步驟 3：取消氣泡相關計時器並清除工具活動（防止舊狀態殘留）
	cancelWaitingTimer(agentId, waitingTimers);
	cancelPermissionTimer(agentId, permissionTimers);
	clearAgentActivity(agent, agentId, permissionTimers, ctx.floorSender(agent.floorId), ctx.progressExtensions);

	// 步驟 4：更新檔案對應關係
	// 從反查表移除舊路徑
	ctx.trackedJsonlFiles.delete(agent.jsonlFile);
	// 指向新檔
	agent.jsonlFile = newFilePath;
	// 反查表加入新路徑
	ctx.trackedJsonlFiles.set(newFilePath, agentId);
	// 步驟 5：重設讀取位置（新檔從頭開始讀）
	agent.fileOffset = 0;
	agent.lineBuffer = '';
	// Gemini watermark 也需歸零
	agent.geminiLastSize = 0;
	agent.geminiMessageCount = 0;
	// 持久化新的檔案對應關係
	persistAgents();

	// 步驟 6：對新檔啟動監視並讀取現有內容
	startFileWatching(agentId, newFilePath, ctx);
	readNewLines(agentId, ctx);
}
