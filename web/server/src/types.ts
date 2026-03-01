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
}

/** 客戶端 → 伺服器的 Socket.IO 訊息型別 */
export type ClientMessage =
	| { type: 'webviewReady' }
	| { type: 'closeAgent'; id: number }
	| { type: 'focusAgent'; id: number }
	| { type: 'saveAgentSeats'; seats: Record<number, { palette: number; hueShift: number; seatId: string | null }> }
	| { type: 'saveLayout'; layout: Record<string, unknown> }
	| { type: 'setSoundEnabled'; enabled: boolean }
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
	| { type: 'removeFloor'; floorId: FloorId };

/** 代理上下文 — 集中管理所有共享狀態與計時器，避免函式傳遞大量參數 */
export interface AgentContext {
	agents: Map<number, AgentState>;
	nextAgentIdRef: { current: number };
	activeAgentIdRef: { current: number | null };
	knownJsonlFiles: Set<string>;
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
}
