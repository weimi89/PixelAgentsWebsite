// ── 計時（毫秒）──────────────────────────────────────────────
export const JSONL_POLL_INTERVAL_MS = 1000;
export const JSONL_POLL_TIMEOUT_MS = 30_000; // 30 秒 — JSONL 輪詢最大等待時間
export const FILE_WATCHER_POLL_INTERVAL_MS = 2000;
export const PROJECT_SCAN_INTERVAL_MS = 3000; // 3s（fs.watch 已提供即時變更通知，掃描僅作新會話發現）
export const TOOL_DONE_DELAY_MS = 300;
export const PERMISSION_TIMER_DELAY_MS = 7000;
export const PERMISSION_TIMER_BASH_MS = 15000;
export const PERMISSION_TIMER_READ_MS = 5000;
export const PERMISSION_TIMER_MCP_MS = 10000;
export const PERMISSION_TIMER_MAX_PROGRESS_EXTENSIONS = 3;
export const TEXT_IDLE_DELAY_MS = 5000;

// ── 顯示截斷（已移至 pixel-agents-shared）────────────────────
// BASH_COMMAND_DISPLAY_MAX_LENGTH、TASK_DESCRIPTION_DISPLAY_MAX_LENGTH
// 請從 'pixel-agents-shared' 匯入

// ── PNG / 素材解析 ─────────────────────────────────────
export const PNG_ALPHA_THRESHOLD = 128;
export const WALL_PIECE_WIDTH = 16;
export const WALL_PIECE_HEIGHT = 32;
export const WALL_GRID_COLS = 4;
export const WALL_BITMASK_COUNT = 16;
export const FLOOR_PATTERN_COUNT = 7;
export const FLOOR_TILE_SIZE = 16;
export const CHARACTER_DIRECTIONS = ['down', 'up', 'right'] as const;
export const CHAR_FRAME_W = 16;
export const CHAR_FRAME_H = 32;
export const CHAR_FRAMES_PER_ROW = 7;
export const CHAR_COUNT = 6;

// ── 使用者層級持久化 ──────────────────────────────────
export const LAYOUT_FILE_DIR = '.pixel-agents';
export const LAYOUT_FILE_NAME = 'layout.json';
export const SETTINGS_FILE_NAME = 'settings.json';
export const AGENTS_FILE_NAME = 'agents.json';
export const AGENT_SEATS_FILE_NAME = 'agent-seats.json';
export const PROJECT_NAMES_FILE_NAME = 'project-names.json';
export const EXCLUDED_PROJECTS_FILE_NAME = 'excluded-projects.json';
export const TEAM_NAMES_FILE_NAME = 'team-names.json';
export const BUILDING_FILE_NAME = 'building.json';
export const FLOOR_LAYOUT_DIR = 'floors';
export const DEFAULT_FLOOR_ID = '1F';
export const PROJECT_FLOOR_MAP_FILE_NAME = 'project-floor-map.json';

// ── 自動偵測 ──────────────────────────────────────────
export const ACTIVE_JSONL_MAX_AGE_MS = 30_000; // 30 秒 — 在此時間窗口內被修改的檔案視為「活躍」
export const STALE_AGENT_TIMEOUT_MS = 600_000; // 10 分鐘 — 超過此時間無 JSONL 更新才視為過期（容忍 extended thinking）
/** 掃描時忽略的專案目錄名稱模式（例如 claude-mem observer sessions） */
export const IGNORED_PROJECT_DIR_PATTERNS = ['observer-sessions'];

// ── 工作階段掃描 ──────────────────────────────────────
export const SESSION_TITLE_MAX_LENGTH = 80;
export const SESSION_SCAN_READ_BYTES = 16384;
export const MAX_SESSIONS_DISPLAY = 50;

// ── tmux ─────────────────────────────────────────────────────
export const TMUX_HEALTH_CHECK_INTERVAL_MS = 5000;

// ── 轉錄記錄 ──────────────────────────────────────────────
export const MAX_TRANSCRIPT_LOG = 15;

// ── 狀態歷史 ──────────────────────────────────────────────
export const MAX_STATUS_HISTORY = 50;

// ── 認證 ──────────────────────────────────────────────────────
export const AUTH_TOKEN_EXPIRY_DAYS = 30;
export const JWT_SECRET_FILE_NAME = 'jwt-secret.key';
export const USERS_FILE_NAME = 'users.json';

// ── 聊天 ──────────────────────────────────────────────────────
export const CHAT_MESSAGE_MAX_LENGTH = 100;
export const CHAT_RATE_LIMIT_MS = 500;
export const CHAT_HISTORY_MAX = 50;

// ── LAN 自動發現 ──────────────────────────────────────────────
export const LAN_DISCOVERY_UDP_PORT = 47800;
export const LAN_DISCOVERY_HEARTBEAT_MS = 5000;
export const LAN_DISCOVERY_TIMEOUT_MS = 15000;

// ── 終端 ──────────────────────────────────────────────────────
export const TERMINAL_WS_PATH = '/terminal-ws';
export const TERMINAL_DEFAULT_COLS = 80;
export const TERMINAL_DEFAULT_ROWS = 24;

// ── 伺服器 ──────────────────────────────────────────────────
export const DEFAULT_PORT = 3000;
export const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 5000; // 強制退出前的寬限時間
