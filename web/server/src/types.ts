import type { ChildProcess } from 'child_process';

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
}
