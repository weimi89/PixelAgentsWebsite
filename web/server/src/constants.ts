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
export const STALE_AGENT_TIMEOUT_MS = 3_600_000; // 1 小時 — 超過此時間無 JSONL 更新才視為過期

// ── 動態掃描間隔 ──────────────────────────────────────
export const PROJECT_SCAN_MIN_INTERVAL_MS = 1_000;   // 有 10+ 活躍代理時最快 1s
export const PROJECT_SCAN_MAX_INTERVAL_MS = 10_000;  // 無代理時最慢 10s

// ── Gemini 大檔案閾值 ──────────────────────────────────
export const GEMINI_LARGE_FILE_THRESHOLD_BYTES = 100 * 1024; // 100KB — 超過此大小使用尾部讀取優化
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
export const PASSWORD_MIN_LENGTH = 8;
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
export const DEFAULT_PORT = 13001;
export const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 5000; // 強制退出前的寬限時間
export const SOCKET_IO_MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB，用於大型素材傳輸
export const GIT_ROOT_MAX_DEPTH = 50; // findGitRoot 最大向上搜尋深度（防止符號連結循環）

// ── Agent Node 心跳 ──────────────────────────────────────────
export const AGENT_NODE_HEARTBEAT_INTERVAL_MS = 30_000; // Agent Node 每 30s 發送一次心跳
export const AGENT_NODE_HEARTBEAT_TIMEOUT_MS = 90_000; // 90s 無心跳視為斷線
export const NODE_HEALTH_BROADCAST_INTERVAL_MS = 10_000; // 每 10s 廣播節點健康狀態

// ── 統計刷新 ──────────────────────────────────────────────────
export const STATS_FLUSH_INTERVAL_MS = 30_000; // 統計資料髒旗標檢查間隔

// ── 壓力測試 ──────────────────────────────────────────────────
export const STRESS_TEST_TOOL_INTERVAL_MS = 500;  // 壓力測試工具呼叫間隔
export const STRESS_TEST_METRICS_INTERVAL_MS = 10_000;  // 指標記錄間隔

// ── 速率限制 ──────────────────────────────────────────────────
export const RATE_LIMIT_API_WINDOW_MS = 60_000;       // API 路由速率限制視窗：1 分鐘
export const RATE_LIMIT_API_MAX_REQUESTS = 100;        // API 路由：每分鐘最多 100 次
export const RATE_LIMIT_LOGIN_WINDOW_MS = 60_000;      // 登入速率限制視窗：1 分鐘
export const RATE_LIMIT_LOGIN_MAX_REQUESTS = 5;        // 登入：每分鐘最多 5 次
export const RATE_LIMIT_REGISTER_WINDOW_MS = 60_000;   // 註冊速率限制視窗：1 分鐘
export const RATE_LIMIT_REGISTER_MAX_REQUESTS = 5;     // 註冊：每分鐘最多 5 次

// ── 稽核日誌 ──────────────────────────────────────────────────
export const INVITES_FILE_NAME = 'invites.json';
export const INVITE_CODE_LENGTH = 16;
export const INVITE_DEFAULT_EXPIRY_HOURS = 168; // 7 天
export const REGISTRATION_POLICY_DEFAULT = 'open' as const;

export const AUDIT_LOG_FILE_NAME = 'audit.jsonl';
export const AUDIT_LOG_MAX_SIZE_BYTES = 1_048_576; // 1MB — 超過此大小自動輪替

// ── Socket.IO CSRF 防護 ──────────────────────────────────────
/** 允許的來源清單（除 localhost 變體外），可透過 ALLOWED_ORIGINS 環境變數擴充（逗號分隔） */
export const ALLOWED_ORIGINS_ENV_KEY = 'ALLOWED_ORIGINS';

// ── JWT Refresh Token ─────────────────────────────────────────
export const ACCESS_TOKEN_EXPIRY_MINUTES = 15;
export const REFRESH_TOKEN_EXPIRY_DAYS = 30;

// ── 轉錄解析 ──────────────────────────────────────────────────
export const THINKING_DEPTH_THRESHOLD = 2000; // thinking 區塊字元數閾值，超過觸發 idea 表情

// ── Redis ────────────────────────────────────────────────────────
export const REDIS_AGENT_CACHE_TTL_MS = 3_600_000; // 1 小時 — 代理狀態快取存活時間
export const REDIS_JWT_CACHE_TTL_MS = 900_000;      // 15 分鐘 — 與 access token 有效期對齊

// ── 叢集 ────────────────────────────────────────────────────────
export const CLUSTER_HEARTBEAT_INTERVAL_MS = 15_000;   // 叢集心跳間隔：15 秒
export const CLUSTER_HEARTBEAT_TTL_MS = 45_000;        // 叢集心跳 TTL：45 秒（3 次心跳失敗視為離線）

// ── 自動備份 ──────────────────────────────────────────────────
export const BACKUP_INTERVAL_MS = 21_600_000; // 6 小時
export const BACKUP_MAX_KEEP = 5;
export const BACKUP_DIR_NAME = 'backups';
