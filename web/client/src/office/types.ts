export {
  TILE_SIZE,
  DEFAULT_COLS,
  DEFAULT_ROWS,
  MAX_COLS,
  MAX_ROWS,
  MATRIX_EFFECT_DURATION_SEC as MATRIX_EFFECT_DURATION,
} from '../constants.js'

export const TileType = {
  WALL: 0,
  FLOOR_1: 1,
  FLOOR_2: 2,
  FLOOR_3: 3,
  FLOOR_4: 4,
  FLOOR_5: 5,
  FLOOR_6: 6,
  FLOOR_7: 7,
  VOID: 8,
} as const
export type TileType = (typeof TileType)[keyof typeof TileType]

/** 每格磚塊的色彩設定，用於地板花紋著色 */
export interface FloorColor {
  /** 色相：colorize 模式 0-360，adjust 模式 -180 到 +180 */
  h: number
  /** 飽和度：colorize 模式 0-100，adjust 模式 -100 到 +100 */
  s: number
  /** 亮度 -100 到 100 */
  b: number
  /** 對比度 -100 到 100 */
  c: number
  /** 為 true 時使用 Photoshop 風格 Colorize（灰階 → 固定 HSL）。預設：adjust 模式。 */
  colorize?: boolean
}

export const CharacterState = {
  IDLE: 'idle',
  WALK: 'walk',
  TYPE: 'type',
  CHAT: 'chat',
  INTERACT: 'interact',
  STAND_WORK: 'stand_work',
  THINK: 'think',
  STRETCH: 'stretch',
  USE_WALL: 'use_wall',
  SLEEP: 'sleep',
} as const
export type CharacterState = (typeof CharacterState)[keyof typeof CharacterState]

export const EmoteType = {
  COFFEE: 'coffee',
  WATER: 'water',
  STAR: 'star',
  ZZZ: 'zzz',
  IDEA: 'idea',
  HEART: 'heart',
  NOTE: 'note',
} as const
export type EmoteType = (typeof EmoteType)[keyof typeof EmoteType]

export const Direction = {
  DOWN: 0,
  LEFT: 1,
  RIGHT: 2,
  UP: 3,
} as const
export type Direction = (typeof Direction)[keyof typeof Direction]

/** hex 色彩字串的二維陣列（'' 表示透明）。[列][欄] */
export type SpriteData = string[][]

export interface Seat {
  /** 椅子家具 uid */
  uid: string
  /** 代理坐下的磚塊欄位 */
  seatCol: number
  /** 代理坐下的磚塊列位 */
  seatRow: number
  /** 角色坐下時面對的方向（朝向相鄰書桌） */
  facingDir: Direction
  assigned: boolean
}

export interface FurnitureInstance {
  sprite: SpriteData
  /** 像素 x（左上角） */
  x: number
  /** 像素 y（左上角） */
  y: number
  /** 用於深度排序的 Y 值（通常為底部邊緣） */
  zY: number
}

export interface ToolActivity {
  toolId: string
  status: string
  done: boolean
  permissionWait?: boolean
}

export const FurnitureType = {
  // 原始手繪精靈圖（保留以向後相容）
  DESK: 'desk',
  BOOKSHELF: 'bookshelf',
  PLANT: 'plant',
  COOLER: 'cooler',
  WHITEBOARD: 'whiteboard',
  CHAIR: 'chair',
  PC: 'pc',
  LAMP: 'lamp',
  // 新家具精靈圖
  LAPTOP: 'laptop',
  PRINTER: 'printer',
  COFFEE_MACHINE: 'coffee_machine',
  SOFA: 'sofa',
  FILING_CABINET: 'filing_cabinet',
  CLOCK: 'clock',
  PAINTING: 'painting',
  TRASH_CAN: 'trash_can',
  FRIDGE: 'fridge',
  VENDING_MACHINE: 'vending_machine',
  SERVER_RACK: 'server_rack',
  WINDOW: 'window',
  // 第二批家具精靈圖
  MEETING_TABLE: 'meeting_table',
  COFFEE_TABLE: 'coffee_table',
  ARMCHAIR: 'armchair',
  LARGE_SCREEN: 'large_screen',
  BULLETIN_BOARD: 'bulletin_board',
  AC_UNIT: 'ac_unit',
  FIRE_EXTINGUISHER: 'fire_extinguisher',
  EXIT_SIGN: 'exit_sign',
  PHONE: 'phone',
  COFFEE_MUG: 'coffee_mug',
  PAPER_STACK: 'paper_stack',
  MICROWAVE: 'microwave',
  SINK: 'sink',
  LOCKER: 'locker',
  COAT_RACK: 'coat_rack',
  POTTED_CACTUS: 'potted_cactus',
} as const
export type FurnitureType = (typeof FurnitureType)[keyof typeof FurnitureType]

export const EditTool = {
  TILE_PAINT: 'tile_paint',
  WALL_PAINT: 'wall_paint',
  FURNITURE_PLACE: 'furniture_place',
  FURNITURE_PICK: 'furniture_pick',
  SELECT: 'select',
  EYEDROPPER: 'eyedropper',
  ERASE: 'erase',
} as const
export type EditTool = (typeof EditTool)[keyof typeof EditTool]

export interface FurnitureCatalogEntry {
  type: string // FurnitureType 列舉或素材 ID
  label: string
  footprintW: number
  footprintH: number
  sprite: SpriteData
  isDesk: boolean
  category?: string
  /** 旋轉群組的朝向：'front' | 'back' | 'left' | 'right' */
  orientation?: string
  /** 此項目是否可放置在書桌/桌面表面上 */
  canPlaceOnSurfaces?: boolean
  /** 從佔地頂部算起屬於「背景」的磚塊列數（允許放置，仍封鎖行走）。預設 0。 */
  backgroundTiles?: number
  /** 此項目是否可放置在牆磚上 */
  canPlaceOnWalls?: boolean
}

export interface PlacedFurniture {
  uid: string
  type: string // FurnitureType 列舉或素材 ID
  col: number
  row: number
  /** 家具的選用色彩覆寫 */
  color?: FloorColor
}

export interface OfficeLayout {
  version: 1
  cols: number
  rows: number
  tiles: TileType[]
  furniture: PlacedFurniture[]
  /** 每格磚塊的色彩設定，與 tiles 陣列平行。null = 牆壁/無色彩 */
  tileColors?: Array<FloorColor | null>
}

export interface Character {
  id: number
  state: CharacterState
  dir: Direction
  /** 像素位置 */
  x: number
  y: number
  /** 當前磚塊欄位 */
  tileCol: number
  /** 當前磚塊列位 */
  tileRow: number
  /** 剩餘路徑步驟（磚塊座標） */
  path: Array<{ col: number; row: number }>
  /** 當前磚塊與下一磚塊之間的 0-1 插值 */
  moveProgress: number
  /** 當前工具名稱，用於打字 vs 閱讀動畫選擇，或 null */
  currentTool: string | null
  /** 調色盤索引（0-5） */
  palette: number
  /** 色相偏移角度（0 = 無偏移，重複調色盤時 ≥45） */
  hueShift: number
  /** 動畫幀索引 */
  frame: number
  /** 動畫用時間累加器 */
  frameTimer: number
  /** 閒置漫遊決策計時器 */
  wanderTimer: number
  /** 當前漫遊週期中已完成的漫遊移動次數 */
  wanderCount: number
  /** 返回座位休息前的最大漫遊移動次數 */
  wanderLimit: number
  /** 代理是否正在積極工作 */
  isActive: boolean
  /** 已指定的座位 uid，若無座位則為 null */
  seatId: string | null
  /** 此角色是否已分離（tmux session 存活但伺服器已重啟） */
  isDetached: boolean
  /** 當前顯示的對話氣泡類型，若無顯示則為 null */
  bubbleType: 'permission' | 'waiting' | 'detached' | null
  /** 氣泡倒數計時器（waiting: 2→0, permission: 未使用） */
  bubbleTimer: number
  /** 座位重新指定後，非活躍狀態下保持坐姿的計時器（倒數至 0） */
  seatTimer: number
  /** 此角色是否代表子代理（由 Task 工具生成） */
  isSubagent: boolean
  /** 若為子代理，則為父代理 ID，否則為 null */
  parentAgentId: number | null
  /** 當前活躍的 Matrix 生成/消散特效，或 null */
  matrixEffect: 'spawn' | 'despawn' | null
  /** 從 0 向上計數至 MATRIX_EFFECT_DURATION 的計時器 */
  matrixEffectTimer: number
  /** 每欄的隨機種子（16 個值），用於交錯雨滴時序 */
  matrixEffectSeeds: number[]
  /** 當前表情類型，或 null */
  emoteType: EmoteType | null
  /** 表情顯示倒數（秒） */
  emoteTimer: number
  /** 思考模式（來回踱步）—— 由伺服器設定 */
  isThinking: boolean
  /** 久坐累計時間（秒），用於觸發 STRETCH */
  sitTimer: number
  /** 閒置累計時間（秒），用於觸發 SLEEP */
  sleepTimer: number
  /** CHAT 目標角色 ID，或 null */
  chatPartnerId: number | null
  /** 互動目標家具格位，或 null */
  interactTarget: { col: number; row: number } | null
  /** 當前所在的 THINK 踱步路徑 */
  thinkPath: Array<{ col: number; row: number }>
  /** THINK 踱步方向標記 */
  thinkForward: boolean
  /** 行為狀態倒數計時器（通用） */
  behaviorTimer: number
}
