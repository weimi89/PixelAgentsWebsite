import type { FloorColor } from './office/types.js'

// ── 網格與佈局 ──────────────────────────────────────────────
export const TILE_SIZE = 16
export const DEFAULT_COLS = 20
export const DEFAULT_ROWS = 11
export const MAX_COLS = 64
export const MAX_ROWS = 64

// ── 角色動畫 ────────────────────────────────────────────────
export const WALK_SPEED_PX_PER_SEC = 48
export const WALK_FRAME_DURATION_SEC = 0.15
export const TYPE_FRAME_DURATION_SEC = 0.3
export const WANDER_PAUSE_MIN_SEC = 3.0
export const WANDER_PAUSE_MAX_SEC = 12.0
export const WANDER_MOVES_BEFORE_REST_MIN = 2
export const WANDER_MOVES_BEFORE_REST_MAX = 4
export const SEAT_REST_MIN_SEC = 120.0
export const SEAT_REST_MAX_SEC = 240.0

// ── Matrix 特效 ─────────────────────────────────────────────
export const MATRIX_EFFECT_DURATION_SEC = 0.3
export const MATRIX_TRAIL_LENGTH = 6
export const MATRIX_SPRITE_COLS = 16
export const MATRIX_SPRITE_ROWS = 24
export const MATRIX_FLICKER_FPS = 30
export const MATRIX_FLICKER_VISIBILITY_THRESHOLD = 180
export const MATRIX_COLUMN_STAGGER_RANGE = 0.3
export const MATRIX_HEAD_COLOR = '#ccffcc'
export const MATRIX_TRAIL_OVERLAY_ALPHA = 0.6
export const MATRIX_TRAIL_EMPTY_ALPHA = 0.5
export const MATRIX_TRAIL_MID_THRESHOLD = 0.33
export const MATRIX_TRAIL_DIM_THRESHOLD = 0.66

// ── 渲染 ────────────────────────────────────────────────────
export const CHARACTER_SITTING_OFFSET_PX = 6
export const CHARACTER_Z_SORT_OFFSET = 0.5
export const OUTLINE_Z_SORT_OFFSET = 0.001
export const SELECTED_OUTLINE_ALPHA = 1.0
export const HOVERED_OUTLINE_ALPHA = 0.5
export const SUBAGENT_GLOW_COLOR = '#5ac8ff'
export const SUBAGENT_GLOW_ALPHA = 0.6
export const REMOTE_AGENT_GLOW_COLOR = '#ff9f43'
export const REMOTE_AGENT_GLOW_ALPHA = 0.5
export const GHOST_PREVIEW_SPRITE_ALPHA = 0.5
export const GHOST_PREVIEW_TINT_ALPHA = 0.25
export const SELECTION_DASH_PATTERN: [number, number] = [4, 3]
export const BUTTON_MIN_RADIUS = 6
export const BUTTON_RADIUS_ZOOM_FACTOR = 3
export const BUTTON_ICON_SIZE_FACTOR = 0.45
export const BUTTON_LINE_WIDTH_MIN = 1.5
export const BUTTON_LINE_WIDTH_ZOOM_FACTOR = 0.5
export const BUBBLE_FADE_DURATION_SEC = 0.5
export const BUBBLE_SITTING_OFFSET_PX = 10
export const BUBBLE_VERTICAL_OFFSET_PX = 24
export const FALLBACK_FLOOR_COLOR = '#808080'

// ── 渲染 - 覆蓋層顏色（canvas，非 CSS）─────────────────────
export const SEAT_OWN_COLOR = 'rgba(0, 127, 212, 0.35)'
export const SEAT_AVAILABLE_COLOR = 'rgba(0, 200, 80, 0.35)'
export const SEAT_BUSY_COLOR = 'rgba(220, 50, 50, 0.35)'
export const GRID_LINE_COLOR = 'rgba(255,255,255,0.12)'
export const VOID_TILE_OUTLINE_COLOR = 'rgba(255,255,255,0.08)'
export const VOID_TILE_DASH_PATTERN: [number, number] = [2, 2]
export const GHOST_BORDER_HOVER_FILL = 'rgba(60, 130, 220, 0.25)'
export const GHOST_BORDER_HOVER_STROKE = 'rgba(60, 130, 220, 0.5)'
export const GHOST_BORDER_STROKE = 'rgba(255, 255, 255, 0.06)'
export const GHOST_VALID_TINT = '#00ff00'
export const GHOST_INVALID_TINT = '#ff0000'
export const SELECTION_HIGHLIGHT_COLOR = '#007fd4'
export const DELETE_BUTTON_BG = 'rgba(200, 50, 50, 0.85)'
export const ROTATE_BUTTON_BG = 'rgba(50, 120, 200, 0.85)'

// ── 鏡頭 ────────────────────────────────────────────────────
export const CAMERA_FOLLOW_LERP = 0.1
export const CAMERA_FOLLOW_SNAP_THRESHOLD = 0.5

// ── 縮放 ────────────────────────────────────────────────────
export const ZOOM_MIN = 1
export const ZOOM_MAX = 10
export const ZOOM_DEFAULT_DPR_FACTOR = 2
export const ZOOM_LEVEL_FADE_DELAY_MS = 1500
export const ZOOM_LEVEL_HIDE_DELAY_MS = 2000
export const ZOOM_LEVEL_FADE_DURATION_SEC = 0.5
export const ZOOM_SCROLL_THRESHOLD = 50
export const PAN_MARGIN_FRACTION = 0.25

// ── 迷你地圖（尺寸為 CSS 像素，渲染時乘以 DPR）────────────
export const MINIMAP_MARGIN = 10
export const MINIMAP_MARGIN_BOTTOM = 90      // 避開聊天面板 + 底部工具列
export const MINIMAP_BG_ALPHA = 0.85
export const MINIMAP_MIN_SIZE = 80
export const MINIMAP_MAX_SIZE = 160
export const MINIMAP_TILE_MIN_PX = 3
export const MINIMAP_DOT_SIZE = 3
export const MINIMAP_VIEWPORT_STROKE = 'rgba(255,255,255,0.85)'
export const MINIMAP_BG_COLOR = 'rgba(10,10,18,0.92)'
export const MINIMAP_FLOOR_COLOR = '#6b6b5a'
export const MINIMAP_WALL_COLOR = '#9898a8'
export const MINIMAP_FURNITURE_COLOR = '#7a7068'

// ── 編輯器 ──────────────────────────────────────────────────
export const UNDO_STACK_MAX_SIZE = 50
export const LAYOUT_SAVE_DEBOUNCE_MS = 500
export const DEFAULT_FLOOR_COLOR: FloorColor = { h: 35, s: 30, b: 15, c: 0 }
export const DEFAULT_WALL_COLOR: FloorColor = { h: 240, s: 25, b: 0, c: 0 }
export const DEFAULT_NEUTRAL_COLOR: FloorColor = { h: 0, s: 0, b: 0, c: 0 }

// ── 通知音效 ────────────────────────────────────────────────
export const NOTIFICATION_NOTE_1_HZ = 659.25   // E5 音符
export const NOTIFICATION_NOTE_2_HZ = 1318.51  // E6（高八度）
export const NOTIFICATION_NOTE_1_START_SEC = 0
export const NOTIFICATION_NOTE_2_START_SEC = 0.1
export const NOTIFICATION_NOTE_DURATION_SEC = 0.18
export const NOTIFICATION_VOLUME = 0.14

// 權限音效（下行雙音：D5 → A4）
export const PERMISSION_NOTE_1_HZ = 587.33     // D5
export const PERMISSION_NOTE_2_HZ = 440.00     // A4
// 回合完成音效（單音：G5）
export const TURN_COMPLETE_NOTE_HZ = 783.99    // G5

// ── 遊戲邏輯 ────────────────────────────────────────────────
export const MAX_DELTA_TIME_SEC = 0.1
export const WAITING_BUBBLE_DURATION_SEC = 2.0
export const DISMISS_BUBBLE_FAST_FADE_SEC = 0.3
export const INACTIVE_SEAT_TIMER_MIN_SEC = 3.0
export const INACTIVE_SEAT_TIMER_RANGE_SEC = 2.0
export const PALETTE_COUNT = 6
export const HUE_SHIFT_MIN_DEG = 45
export const HUE_SHIFT_RANGE_DEG = 271
export const AUTO_ON_FACING_DEPTH = 3
export const AUTO_ON_SIDE_DEPTH = 2
export const CHARACTER_HIT_HALF_WIDTH = 8
export const CHARACTER_HIT_HEIGHT = 24
export const TOOL_OVERLAY_VERTICAL_OFFSET = 32
export const PULSE_ANIMATION_DURATION_SEC = 1.5
export const DETACHED_CHARACTER_ALPHA = 0.45

// ── 角色行為 ──────────────────────────────────────────────────
export const CHAT_DURATION_MIN_SEC = 3.0
export const CHAT_DURATION_MAX_SEC = 8.0
export const CHAT_PROXIMITY_TILES = 2
export const INTERACT_DURATION_MIN_SEC = 2.0
export const INTERACT_DURATION_MAX_SEC = 5.0
export const THINK_PACE_DISTANCE = 3
export const STRETCH_DURATION_SEC = 2.5
export const USE_WALL_DURATION_MIN_SEC = 3.0
export const USE_WALL_DURATION_MAX_SEC = 6.0
export const SLEEP_TRIGGER_IDLE_SEC = 300.0
export const STRETCH_TRIGGER_SIT_SEC = 180.0
export const EMOTE_DISPLAY_DURATION_SEC = 2.0
export const EMOTE_VERTICAL_OFFSET_PX = 28
export const EMOTE_FADE_DURATION_SEC = 0.5
export const SLEEP_ZZZ_REFRESH_SEC = 3.0

// ── 漫遊行為權重 ────────────────────────────────────────────
export const WANDER_WEIGHT_IDLE_LOOK = 30         // 站著轉方向（不移動）
export const WANDER_WEIGHT_RANDOM = 30
export const WANDER_WEIGHT_FURNITURE = 15
export const WANDER_WEIGHT_CHAT = 10
export const WANDER_WEIGHT_WALL = 10
export const WANDER_WEIGHT_RETURN_SEAT = 5
export const WANDER_RANDOM_RADIUS = 3             // 隨機漫遊最大格數
export const WANDER_MAX_PATH_STEPS = 5            // 路徑最長步數（截斷）

// ── 工具類型顏色映射 ──────────────────────────────────────────
export const TOOL_TYPE_COLORS: Record<string, string> = {
  Read: 'var(--pixel-tool-read)',
  Grep: 'var(--pixel-tool-read)',
  Glob: 'var(--pixel-tool-read)',
  WebFetch: 'var(--pixel-tool-read)',
  WebSearch: 'var(--pixel-tool-read)',
  Edit: 'var(--pixel-tool-write)',
  Write: 'var(--pixel-tool-write)',
  NotebookEdit: 'var(--pixel-tool-write)',
  Bash: 'var(--pixel-tool-execute)',
  Task: 'var(--pixel-tool-task)',
  AskUserQuestion: 'var(--pixel-tool-wait)',
  EnterPlanMode: 'var(--pixel-tool-wait)',
}

// ── 日夜循環 ──────────────────────────────────────────────────
export const DAY_NIGHT_DAWN_HOUR = 5
export const DAY_NIGHT_DAY_HOUR = 7
export const DAY_NIGHT_DUSK_HOUR = 17
export const DAY_NIGHT_NIGHT_HOUR = 19
export const DAY_NIGHT_MAX_ALPHA_NIGHT = 0.25
export const DAY_NIGHT_MAX_ALPHA_TRANSITION = 0.12

// ── 會議室行為 ────────────────────────────────────────────────
export const MEETING_MIN_PARTICIPANTS = 2
export const MEETING_MAX_PARTICIPANTS = 6
export const MEETING_DURATION_MIN_SEC = 10
export const MEETING_DURATION_MAX_SEC = 25
export const WANDER_WEIGHT_MEETING = 8
export const MEETING_SEAT_SEARCH_RADIUS = 3

// ── 跨樓層移動 ────────────────────────────────────────────────
export const ELEVATOR_FURNITURE_TYPE = 'elevator'

// ── 聊天面板 ──────────────────────────────────────────────────
export const CHAT_INPUT_MAX_LENGTH = 100
export const CHAT_PANEL_MAX_MESSAGES = 50

// ── 儀表板 ────────────────────────────────────────────────────
export const DASHBOARD_REFRESH_MS = 2000

// ── 觸控 ────────────────────────────────────────────────────
export const LONG_PRESS_DURATION_MS = 500

// ── 快取限制 ────────────────────────────────────────────────
export const COLORIZE_CACHE_MAX_SIZE = 256
export const SPRITE_CACHE_MAX_ENTRIES = 64
export const SPRITE_CACHE_MAX_ZOOM_LEVELS = 12

// ── 團隊視覺化 ────────────────────────────────────────────────
export const TEAM_COLORS = [
  '#ff6b6b', // 紅
  '#4ecdc4', // 青
  '#45b7d1', // 藍
  '#f9ca24', // 黃
  '#a29bfe', // 紫
  '#fd79a8', // 粉
  '#00b894', // 綠
  '#e17055', // 橘
] as const
export const TEAM_BADGE_SIZE = 5
export const TEAM_BADGE_VERTICAL_OFFSET_PX = 30
export const TEAM_CONNECTION_LINE_ALPHA = 0.3
export const TEAM_CONNECTION_LINE_WIDTH = 1
export const TEAM_CONNECTION_DASH: [number, number] = [3, 3]
