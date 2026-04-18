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

function loadPersistedAgentsOnce(): ReturnType<typeof loadPersistedAgents> {
	const now = Date.now();
	if (!persistedAgentsCache || now - persistedAgentsCacheTime > PERSISTED_CACHE_TTL_MS) {
		persistedAgentsCache = loadPersistedAgents();
		persistedAgentsCacheTime = now;
	}
	return persistedAgentsCache;
}

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

/** 讀取會話檔案中的新資料，逐行（JSONL）或全量（JSON）交給轉錄解析器處理 */
export function readNewLines(
	agentId: number,
	ctx: AgentContext,
): void {
	const { agents, waitingTimers, permissionTimers } = ctx;
	const agent = agents.get(agentId);
	if (!agent) {
		lastReadTime.delete(agentId);
		return;
	}

	// Gemini 使用全量 JSON 讀取模式
	if (agent.cliType === 'gemini') {
		readGeminiSession(agentId, ctx);
		return;
	}

	// 節流：防止 fs.watch + 輪詢在短時間內雙重觸發
	const now = Date.now();
	const lastRead = lastReadTime.get(agentId) || 0;
	if (now - lastRead < READ_THROTTLE_MS) return;
	lastReadTime.set(agentId, now);
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

/**
 * Gemini 全量讀取：讀取 JSON 會話檔，只處理新增的訊息。
 * Task 2.3 優化：大檔案（>100KB）先嘗試尾部讀取解析新訊息，
 * 避免每次全量 JSON.parse 的開銷。失敗時回退至全量讀取。
 */
function readGeminiSession(agentId: number, ctx: AgentContext): void {
	const { agents, waitingTimers, permissionTimers } = ctx;
	const agent = agents.get(agentId);
	if (!agent) return;

	// 節流
	const now = Date.now();
	const lastRead = lastReadTime.get(agentId) || 0;
	if (now - lastRead < READ_THROTTLE_MS) return;
	lastReadTime.set(agentId, now);

	const sender = ctx.floorSender(agent.floorId);
	try {
		const stat = fs.statSync(agent.jsonlFile);
		const lastSize = agent.geminiLastSize ?? 0;
		if (stat.size === lastSize) return;

		const processedCount = agent.geminiMessageCount ?? 0;
		let newMessages: Array<Record<string, unknown>> | null = null;
		let nextMessageCount = processedCount;

		// 大檔案優化：嘗試尾部讀取（僅當已有基準 size 與處理過的訊息）
		if (stat.size > GEMINI_LARGE_FILE_THRESHOLD_BYTES && lastSize > 0 && processedCount > 0) {
			newMessages = tryGeminiTailRead(agent.jsonlFile, lastSize, stat.size);
			if (newMessages) {
				nextMessageCount = processedCount + newMessages.length;
			}
		}

		// 尾部讀取失敗或小檔案 — 全量讀取（權威來源，重設 watermark）
		if (!newMessages) {
			const content = fs.readFileSync(agent.jsonlFile, 'utf-8');
			const session = JSON.parse(content);
			const messages = session.messages as Array<Record<string, unknown>> || [];
			newMessages = messages.slice(processedCount);
			nextMessageCount = messages.length;
		}

		// 所有讀取成功後才更新 watermark，避免中途失敗造成狀態不一致
		agent.geminiLastSize = stat.size;
		agent.geminiMessageCount = nextMessageCount;

		if (newMessages.length > 0) {
			cancelWaitingTimer(agentId, waitingTimers);
			cancelPermissionTimer(agentId, permissionTimers);
			if (agent.permissionSent) {
				agent.permissionSent = false;
				sender?.postMessage({ type: 'agentToolPermissionClear', id: agentId });
			}
		}

		for (const msg of newMessages) {
			processTranscriptLine(agentId, JSON.stringify(msg), ctx);
		}
	} catch (e) {
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
		// 讀取尾部：從上次大小前 100 位元組（確保捕獲跨邊界的 JSON）到檔案末尾
		const overlap = 100;
		const readStart = Math.max(0, lastSize - overlap);
		const readLength = currentSize - readStart;

		const buf = Buffer.alloc(readLength);
		const fd = fs.openSync(filePath, 'r');
		try {
			fs.readSync(fd, buf, 0, readLength, readStart);
		} finally {
			fs.closeSync(fd);
		}
		const tail = buf.toString('utf-8');

		// 嘗試包裝為完整 JSON 陣列來解析新訊息
		// 尾部應包含: ...}, {newMsg1}, {newMsg2}]}
		// 找到新資料開始的位置（從 overlap 區域之後）
		const newDataStart = tail.indexOf('{', overlap);
		if (newDataStart === -1) return null;

		// 從新資料開始到結尾，去掉最後的 ]}
		let fragment = tail.slice(newDataStart).trimEnd();
		if (fragment.endsWith(']}')) {
			fragment = fragment.slice(0, -2);
		} else if (fragment.endsWith(']')) {
			fragment = fragment.slice(0, -1);
		}
		// 去掉尾部的逗號
		fragment = fragment.replace(/,\s*$/, '');

		if (!fragment.trim()) return null;

		// 包裝為 JSON 陣列解析
		const parsed = JSON.parse(`[${fragment}]`) as Array<Record<string, unknown>>;

		// 驗證：解析出的訊息數量應合理（新增的訊息 = 總數 - 已處理數）
		// 如果無法確認總數，保守回退
		if (parsed.length === 0) return null;

		return parsed;
	} catch {
		// 尾部解析失敗 — 回退至全量讀取
		return null;
	}
}

/** 檢查 JSONL 檔案是否已被現有代理追蹤 */
function isTrackedByAgent(filePath: string, ctx: AgentContext): boolean {
	return ctx.trackedJsonlFiles.has(filePath);
}

/** 根據代理數量計算動態掃描間隔（Task 2.2） */
function computeScanInterval(agentCount: number): number {
	if (agentCount === 0) return PROJECT_SCAN_MAX_INTERVAL_MS;  // 10s
	if (agentCount >= 10) return PROJECT_SCAN_MIN_INTERVAL_MS;  // 1s
	return PROJECT_SCAN_INTERVAL_MS;                            // 3s（預設）
}

/** 啟動定期專案掃描，自動偵測並收養活躍的 Claude 會話 */
export function ensureProjectScan(
	projectDirs: string[],
	projectScanTimerRef: { current: ReturnType<typeof setTimeout> | null },
	ctx: AgentContext,
): void {
	if (projectScanTimerRef.current) return;

	// 初始掃描：收養所有專案目錄中的活躍 JSONL 檔案
	for (const dir of projectDirs) {
		scanAndAdopt(dir, ctx);
	}

	// 遞迴 setTimeout — 間隔依代理數量動態調整
	function scheduleNextScan(): void {
		const interval = computeScanInterval(ctx.agents.size);
		projectScanTimerRef.current = setTimeout(() => {
			for (const dir of projectDirs) {
				scanAndAdopt(dir, ctx);
			}
			scheduleNextScan();
		}, interval);
	}
	scheduleNextScan();
}

/** 停止定期專案掃描（動態關閉或重啟時使用） */
export function stopProjectScan(
	projectScanTimerRef: { current: ReturnType<typeof setTimeout> | null },
): void {
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
	let dirMtimeMs: number;
	try {
		dirMtimeMs = fs.statSync(scanDir).mtimeMs;
	} catch { return []; }

	const cached = dirScanCache.get(scanDir);
	const now = Date.now();

	if (cached && cached.dirMtimeMs === dirMtimeMs) {
		// 目錄結構未變（無新增/刪除檔案）— 僅 re-stat 上次活躍的檔案
		const results: Array<{ filePath: string; mtimeMs: number }> = [];
		for (const [filePath, lastMtime] of cached.fileMtimes) {
			// 上次非活躍（mtime 距上次檢查已超過閾值）→ 跳過 stat
			if ((now - lastMtime) > ACTIVE_JSONL_MAX_AGE_MS * 2) continue;
			try {
				const stat = fs.statSync(filePath);
				cached.fileMtimes.set(filePath, stat.mtimeMs);
				if ((now - stat.mtimeMs) < ACTIVE_JSONL_MAX_AGE_MS) {
					results.push({ filePath, mtimeMs: stat.mtimeMs });
				}
			} catch {
				// 檔案已消失 — 從快取移除
				cached.fileMtimes.delete(filePath);
			}
		}
		return results;
	}

	// 目錄 mtime 已變或無快取 — 完整掃描
	let fileNames: string[];
	try {
		fileNames = fs.readdirSync(scanDir).filter(f => f.endsWith(ext));
	} catch { return []; }

	const fileMtimes = new Map<string, number>();
	const results: Array<{ filePath: string; mtimeMs: number }> = [];

	for (const f of fileNames) {
		const filePath = path.join(scanDir, f);
		try {
			const stat = fs.statSync(filePath);
			fileMtimes.set(filePath, stat.mtimeMs);
			if ((now - stat.mtimeMs) < ACTIVE_JSONL_MAX_AGE_MS) {
				results.push({ filePath, mtimeMs: stat.mtimeMs });
			}
		} catch {
			// 無法 stat — 跳過
		}
	}

	dirScanCache.set(scanDir, { dirMtimeMs, fileMtimes });
	return results;
}

/** 掃描單一專案目錄，收養活躍的外部會話（支援 JSONL 和 JSON） */
function scanAndAdopt(
	projectDir: string,
	ctx: AgentContext,
): void {
	const { nextAgentIdRef, agents, persistAgents } = ctx;

	const cliType = detectCliTypeFromPath(projectDir);
	const adapter = getAdapter(cliType);

	const ext = adapter?.sessionFileExtension?.() || '.jsonl';

	const scanDir = cliType === 'gemini' ? path.join(projectDir, 'chats') : projectDir;
	const activeFiles = scanDirWithCache(scanDir, ext);

	for (const { filePath: file } of activeFiles) {
		// 跳過已被代理追蹤的檔案
		if (isTrackedByAgent(file, ctx)) continue;

		// activeFiles 已過濾為活躍檔案，無需再次檢查

		// 自動收養：為此外部會話建立代理
		const floorId = resolveFloorForProject(projectDir, ctx.building);
		const cliType = detectCliTypeFromPath(projectDir);
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
			isRemote: false,
			owner: null,
			ownerId: null,
			remoteSessionId: null,
			gitBranch: null,
			statusHistory: [],
			teamName: getTeamName(projectDir),
			cliType,
			startedAt: Date.now(),
			growth: { ...DEFAULT_GROWTH },
		};
		// 嘗試從持久化資料還原成長狀態
		const sessionId = path.basename(file, ext);
		const persisted = loadPersistedAgentsOnce();
		const match = persisted.find(p => p.sessionId === sessionId);
		if (match) {
			agent.growth = restoreGrowth(match);
		}
		agents.set(id, agent);
		ctx.trackedJsonlFiles.set(file, id);
		ctx.incrementFloorCount(floorId);
		const floorSend = ctx.floorSender(floorId);
		recordSessionStart(id, agent, floorSend);
		persistAgents();
		console.log(`[Pixel Agents] Auto-adopted session: ${path.basename(file)} → Agent ${id} (floor: ${floorId}, cli: ${cliType})`);
		const isExternal = projectDir !== ctx.ownProjectDir;
		floorSend.postMessage({
			type: 'agentCreated',
			id,
			projectName: extractProjectNameFromFile(file, projectDir),
			floorId,
			startedAt: agent.startedAt,
			...(isExternal ? { isExternal: true } : {}),
			...(cliType !== 'claude' ? { cliType } : {}),
		});
		// 若有持久化的團隊名稱，立即通知客戶端
		if (agent.teamName) {
			floorSend.postMessage({ type: 'agentTeam', id, teamName: agent.teamName });
		}

		// 立即開始監視檔案
		startFileWatching(id, file, ctx);
		readNewLines(id, ctx);

		// 代理建立後廣播樓層摘要
		ctx.broadcastFloorSummaries();
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
	clearAgentActivity(agent, agentId, permissionTimers, ctx.floorSender(agent.floorId), ctx.progressExtensions);

	ctx.trackedJsonlFiles.delete(agent.jsonlFile);
	agent.jsonlFile = newFilePath;
	ctx.trackedJsonlFiles.set(newFilePath, agentId);
	agent.fileOffset = 0;
	agent.lineBuffer = '';
	agent.geminiLastSize = 0;
	agent.geminiMessageCount = 0;
	persistAgents();

	startFileWatching(agentId, newFilePath, ctx);
	readNewLines(agentId, ctx);
}
