import type { ChildProcess } from 'child_process';
import type { FSWatcher } from 'fs';

export type FloorId = string;

export interface FloorConfig {
	id: FloorId;
	name: string;
	order: number;
}

export interface BuildingConfig {
	version: 1;
	defaultFloorId: FloorId;
	floors: FloorConfig[];
}

export interface MessageSender {
	postMessage(msg: unknown): void;
}

export interface AgentState {
	id: number;
	process: ChildProcess | null;
	projectDir: string;
	jsonlFile: string;
	fileOffset: number;
	lineBuffer: string;
	activeToolIds: Set<string>;
	activeToolStatuses: Map<string, string>;
	activeToolNames: Map<string, string>;
	activeSubagentToolIds: Map<string, Set<string>>;
	activeSubagentToolNames: Map<string, Map<string, string>>;
	isWaiting: boolean;
	permissionSent: boolean;
	hadToolsInTurn: boolean;
	model: string | null;
	/** tmux 會話名稱，如果作為直接子進程執行則為 null */
	tmuxSessionName: string | null;
	/** 此代理的 tmux 會話是否存活但伺服器剛重啟（尚未重新連接） */
	isDetached: boolean;
	/** 最近的精簡轉錄記錄（FIFO，最多 MAX_TRANSCRIPT_LOG 條） */
	transcriptLog: Array<{ ts: number; role: 'user' | 'assistant' | 'system'; summary: string }>;
	/** 此代理所屬的樓層 */
	floorId: FloorId;
	/** 此代理是否來自遠端 Agent Node */
	isRemote: boolean;
	/** 遠端代理的擁有者使用者名稱 */
	owner: string | null;
	/** 遠端代理的來源 sessionId（用於 Agent Node 事件對應） */
	remoteSessionId: string | null;
	/** 從 JSONL 偵測到的 git 分支名稱 */
	gitBranch: string | null;
	/** 最近 N 筆狀態變更歷史（FIFO，最多 MAX_STATUS_HISTORY 條） */
	statusHistory: Array<{ ts: number; status: string; detail?: string }>;
	/** 此代理的團隊名稱（手動設定或自動偵測） */
	teamName: string | null;
	/** 此代理的 CLI 類型（claude/codex/gemini） */
	cliType: string;
}

export interface PersistedAgent {
	id: number;
	sessionId: string;
	jsonlFile: string;
	projectDir: string;
	palette?: number;
	hueShift?: number;
	seatId?: string;
	tmuxSessionName?: string;
	floorId?: FloorId;
	cliType?: string;
}

/** 客戶端 → 伺服器的 Socket.IO 訊息型別 */
export type ClientMessage =
	| { type: 'webviewReady' }
	| { type: 'closeAgent'; id: number }
	| { type: 'focusAgent'; id: number }
	| { type: 'saveAgentSeats'; seats: Record<number, { palette: number; hueShift: number; seatId: string | null }> }
	| { type: 'saveLayout'; layout: Record<string, unknown> }
	| { type: 'setSoundEnabled'; enabled: boolean }
	| { type: 'setSoundConfig'; config: { master?: boolean; waiting?: boolean; permission?: boolean; turnComplete?: boolean } }
	| { type: 'setUiScale'; scale: number }
	| { type: 'listSessions' }
	| { type: 'resumeSession'; sessionId: string; projectDir: string }
	| { type: 'requestExportLayout' }
	| { type: 'setProjectName'; agentId: number; name: string }
	| { type: 'excludeProject'; projectDir: string }
	| { type: 'includeProject'; projectDir: string }
	| { type: 'listProjectDirs' }
	| { type: 'switchFloor'; floorId: FloorId }
	| { type: 'saveFloorLayout'; floorId: FloorId; layout: Record<string, unknown> }
	| { type: 'renameFloor'; floorId: FloorId; name: string }
	| { type: 'addFloor'; name: string }
	| { type: 'removeFloor'; floorId: FloorId }
	| { type: 'chatMessage'; text: string }
	| { type: 'setNickname'; nickname: string }
	| { type: 'moveAgentToFloor'; agentId: number; targetFloorId: FloorId }
	| { type: 'requestDashboardData' }
	| { type: 'setZoom'; zoom: number }
	| { type: 'requestStatusHistory'; agentId: number }
	| { type: 'setAgentTeam'; agentId: number; teamName: string | null }
	| { type: 'setLanDiscoveryEnabled'; enabled: boolean }
	| { type: 'setLanPeerName'; name: string }
	| { type: 'approvePermission'; agentId: number }
	| { type: 'approveAllPermissions' }
	| { type: 'saveBehaviorSettings'; settings: Record<string, number> }
	| { type: 'requestBehaviorSettings' };

/** 代理上下文 — 集中管理所有共享狀態與計時器，避免函式傳遞大量參數 */
export interface AgentContext {
	agents: Map<number, AgentState>;
	nextAgentIdRef: { current: number };
	activeAgentIdRef: { current: number | null };
	fileWatchers: Map<number, FSWatcher>;
	pollingTimers: Map<number, ReturnType<typeof setInterval>>;
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>;
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>;
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>;
	sender: MessageSender | undefined;
	persistAgents: () => void;
	/** filePath → agentId 快速查找，避免 isTrackedByAgent O(n) 遍歷 */
	trackedJsonlFiles: Map<string, number>;
	/** 本伺服器工作目錄對應的 Claude 專案目錄，用於區分本專案 vs 外部代理 */
	ownProjectDir: string;
	/** socketId → 當前觀看的 floorId */
	socketFloors: Map<string, FloorId>;
	/** 建築物配置 */
	building: BuildingConfig;
	/** 取得特定樓層的 MessageSender（僅廣播至該樓層的客戶端） */
	floorSender: (floorId: FloorId) => MessageSender;
	/** 廣播各樓層代理數量摘要至所有客戶端 */
	broadcastFloorSummaries: () => void;
	/** remoteSessionId → agentId 的映射（供 Agent Node 事件快速查找） */
	remoteAgentMap: Map<string, number>;
	/** agentId → 進度訊號延長計時器次數（用於自適應權限偵測，限制最多 N 次） */
	progressExtensions: Map<number, number>;
	/** 增量更新樓層代理計數（代理建立時呼叫） */
	incrementFloorCount: (floorId: FloorId) => void;
	/** 增量更新樓層代理計數（代理移除時呼叫） */
	decrementFloorCount: (floorId: FloorId) => void;
}
