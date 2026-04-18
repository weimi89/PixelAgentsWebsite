import { CharacterState, Direction, TILE_SIZE, EmoteType } from '../types.js'
import type { Character, Seat, SpriteData, TileType as TileTypeVal } from '../types.js'
import type { CharacterSprites } from '../sprites/spriteData.js'
import { findPath } from '../layout/tileMap.js'
import {
  WALK_SPEED_PX_PER_SEC,
  WALK_STEP_DISTANCE_PX,
  WALK_TURN_PAUSE_SEC,
  TYPE_FRAME_DURATION_SEC,
  WANDER_MOVES_BEFORE_REST_MIN,
  WANDER_MOVES_BEFORE_REST_MAX,
  CHAT_PROXIMITY_TILES,
  INTERACT_DURATION_MIN_SEC,
  INTERACT_DURATION_MAX_SEC,
  THINK_PACE_DISTANCE,
  STRETCH_DURATION_SEC,
  USE_WALL_DURATION_MIN_SEC,
  USE_WALL_DURATION_MAX_SEC,
  EMOTE_DISPLAY_DURATION_SEC,
  SLEEP_ZZZ_REFRESH_SEC,
  WANDER_RANDOM_RADIUS,
  WANDER_MAX_PATH_STEPS,
  MEETING_MIN_PARTICIPANTS,
  MEETING_DURATION_MIN_SEC,
  MEETING_DURATION_MAX_SEC,
  MEETING_SEAT_SEARCH_RADIUS,
  FURNITURE_WEIGHT_DECAY,
  FURNITURE_VISIT_HISTORY_MAX,
  SIT_WANDER_BONUS_MAX,
} from '../../constants.js'
import { getBehaviorConfig } from './behaviorConfig.js'

/** 顯示閱讀動畫而非打字動畫的工具 */
const READING_TOOLS = new Set(['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'])

export function isReadingTool(tool: string | null): boolean {
  if (!tool) return false
  return READING_TOOLS.has(tool)
}

/**
 * 推進角色於一格之間的移動。
 * 回傳 true 表示本 tick 已消耗（步行動畫已處理），呼叫者可直接跳過後續邏輯。
 *
 * 改進項目（使走路更自然）：
 *   - 方向改變時有短暫 turnPauseTimer 停頓，消除瞬間轉向的機械感
 *   - 動畫幀切換依「實際像素距離」而非固定時間，走快/慢都一致
 */
function advanceWalk(ch: Character, next: { col: number; row: number }, dt: number): void {
  const newDir = directionBetween(ch.tileCol, ch.tileRow, next.col, next.row)
  // 轉向停頓：新方向與目前不同 → 先停頓一瞬間再續走
  if (newDir !== ch.dir) {
    ch.dir = newDir
    ch.turnPauseTimer = WALK_TURN_PAUSE_SEC
  }
  if (ch.turnPauseTimer && ch.turnPauseTimer > 0) {
    ch.turnPauseTimer -= dt
    return
  }

  const deltaPx = WALK_SPEED_PX_PER_SEC * dt
  ch.moveProgress += deltaPx / TILE_SIZE
  // 幀時序改為像素距離累加（每走 WALK_STEP_DISTANCE_PX 切一幀），
  // 使走路動畫與實際位移視覺上同步
  ch.frameTimer += deltaPx
  if (ch.frameTimer >= WALK_STEP_DISTANCE_PX) {
    ch.frameTimer -= WALK_STEP_DISTANCE_PX
    ch.frame = (ch.frame + 1) % 4
  }

  const fromCenter = tileCenter(ch.tileCol, ch.tileRow)
  const toCenter = tileCenter(next.col, next.row)
  const t = Math.min(ch.moveProgress, 1)
  ch.x = fromCenter.x + (toCenter.x - fromCenter.x) * t
  ch.y = fromCenter.y + (toCenter.y - fromCenter.y) * t

  if (ch.moveProgress >= 1) {
    ch.tileCol = next.col
    ch.tileRow = next.row
    ch.x = toCenter.x
    ch.y = toCenter.y
    ch.path.shift()
    ch.moveProgress = 0
  }
}

/** 判斷狀態是否需要坐姿偏移（在椅子上的狀態） */
export function isSittingState(state: CharacterState): boolean {
  return state === CharacterState.TYPE || state === CharacterState.SLEEP || state === CharacterState.MEETING
}

/** 可互動的家具類型 */
const INTERACTABLE_FURNITURE = new Set([
  'coffee_machine', 'cooler', 'vending_machine',
  'fridge', 'microwave', 'sink',
])

/** 牆面可互動的家具類型 */
const WALL_INTERACTABLE_FURNITURE = new Set([
  'whiteboard', 'bulletin_board',
])

/** 互動家具對應的表情類型 */
function getInteractEmote(furnitureType: string): EmoteType {
  if (furnitureType === 'coffee_machine') return EmoteType.COFFEE
  if (furnitureType === 'cooler' || furnitureType === 'sink') return EmoteType.WATER
  return EmoteType.COFFEE // 販賣機、冰箱、微波爐預設咖啡
}

/** 格的像素中心 */
function tileCenter(col: number, row: number): { x: number; y: number } {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  }
}

/** 從一格到相鄰格的方向 */
function directionBetween(fromCol: number, fromRow: number, toCol: number, toRow: number): Direction {
  const dc = toCol - fromCol
  const dr = toRow - fromRow
  if (Math.abs(dc) >= Math.abs(dr)) {
    return dc > 0 ? Direction.RIGHT : dc < 0 ? Direction.LEFT : Direction.DOWN
  }
  return dr > 0 ? Direction.DOWN : Direction.UP
}

/** 設定表情並啟動計時器 */
function setEmote(ch: Character, emote: EmoteType, duration = EMOTE_DISPLAY_DURATION_SEC): void {
  ch.emoteType = emote
  ch.emoteTimer = duration
}

/** 更新資訊傳入結構 */
export interface UpdateContext {
  walkableTiles: Array<{ col: number; row: number }>
  seats: Map<string, Seat>
  tileMap: TileTypeVal[][]
  blockedTiles: Set<string>
  allCharacters: Map<number, Character>
  furnitureMap: Map<string, { col: number; row: number; type: string }>
  furnitureUidMap: Map<string, string>
}

export function createCharacter(
  id: number,
  palette: number,
  seatId: string | null,
  seat: Seat | null,
  hueShift = 0,
): Character {
  const col = seat ? seat.seatCol : 1
  const row = seat ? seat.seatRow : 1
  const center = tileCenter(col, row)
  return {
    id,
    state: CharacterState.TYPE,
    dir: seat ? seat.facingDir : Direction.DOWN,
    x: center.x,
    y: center.y,
    tileCol: col,
    tileRow: row,
    path: [],
    moveProgress: 0,
    currentTool: null,
    palette,
    hueShift,
    frame: 0,
    frameTimer: 0,
    wanderTimer: 0,
    wanderCount: 0,
    wanderLimit: randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX),
    isActive: true,
    seatId,
    isDetached: false,
    bubbleType: null,
    bubbleTimer: 0,
    seatTimer: 0,
    isSubagent: false,
    isRemote: false,
    parentAgentId: null,
    matrixEffect: null,
    matrixEffectTimer: 0,
    matrixEffectSeeds: [],
    emoteType: null,
    emoteTimer: 0,
    isThinking: false,
    sitTimer: 0,
    sleepTimer: 0,
    chatPartnerId: null,
    interactTarget: null,
    thinkPath: [],
    thinkForward: true,
    behaviorTimer: 0,
    meetingTableUid: null,
    transferTargetFloor: null,
    teamName: null,
    teamColor: null,
    recentFurnitureVisits: new Map(),
    gameTime: 0,
    level: 1,
  }
}

/** 曼哈頓距離 */
function manhattan(c1: number, r1: number, c2: number, r2: number): number {
  return Math.abs(c1 - c2) + Math.abs(r1 - r2)
}

/** 截斷路徑至最大步數 */
function truncatePath(path: Array<{ col: number; row: number }>): Array<{ col: number; row: number }> {
  if (path.length <= WANDER_MAX_PATH_STEPS) return path
  return path.slice(0, WANDER_MAX_PATH_STEPS)
}

type WanderActionType = 'idle_look' | 'random' | 'furniture' | 'chat' | 'wall' | 'meeting'

/** 加權隨機漫遊目標選擇 */
function pickWanderAction(
  ch: Character,
  ctx: UpdateContext,
): { type: WanderActionType; target?: { col: number; row: number }; furnitureType?: string; chatTarget?: number } {
  const cfg = getBehaviorConfig()
  const weights: Array<{ type: WanderActionType; weight: number; target?: { col: number; row: number }; furnitureType?: string; chatTarget?: number }> = []

  // 站著看看（只轉方向，不移動）
  weights.push({ type: 'idle_look', weight: cfg.wanderWeightIdleLook })

  // 隨機漫遊
  weights.push({ type: 'random', weight: cfg.wanderWeightRandom })

  // 互動家具（限制在 8 格範圍內）
  let closestFurniture: { col: number; row: number; type: string } | null = null
  let closestFurnitureDist = Infinity
  for (const [, f] of ctx.furnitureMap) {
    if (!INTERACTABLE_FURNITURE.has(f.type)) continue
    const d = manhattan(ch.tileCol, ch.tileRow, f.col, f.row)
    if (d <= 8 && d < closestFurnitureDist) {
      closestFurnitureDist = d
      closestFurniture = f
    }
  }
  if (closestFurniture) {
    // 家具親和度衰減：最近訪問過的家具權重減半
    const fKey = `${closestFurniture.col},${closestFurniture.row}`
    const fUid = ctx.furnitureUidMap.get(fKey)
    const lastVisit = fUid ? (ch.recentFurnitureVisits.get(fUid) ?? -Infinity) : -Infinity
    const timeSinceVisit = ch.gameTime - lastVisit
    const fWeight = timeSinceVisit < cfg.furnitureCooldown
      ? Math.round(cfg.wanderWeightFurniture * FURNITURE_WEIGHT_DECAY)
      : cfg.wanderWeightFurniture
    weights.push({ type: 'furniture', weight: fWeight, target: { col: closestFurniture.col, row: closestFurniture.row }, furnitureType: closestFurniture.type })
  }

  // 聊天對象
  let closestChat: { id: number; col: number; row: number } | null = null
  let closestChatDist = Infinity
  for (const [otherId, other] of ctx.allCharacters) {
    if (otherId === ch.id) continue
    if (other.isSubagent) continue
    if (other.state !== CharacterState.IDLE) continue
    if (other.chatPartnerId !== null) continue
    const d = manhattan(ch.tileCol, ch.tileRow, other.tileCol, other.tileRow)
    if (d <= CHAT_PROXIMITY_TILES * 3 && d < closestChatDist) {
      closestChatDist = d
      closestChat = { id: otherId, col: other.tileCol, row: other.tileRow }
    }
  }
  if (closestChat) {
    weights.push({ type: 'chat', weight: cfg.wanderWeightChat, target: { col: closestChat.col, row: closestChat.row }, chatTarget: closestChat.id })
  }

  // 白板（限制在 8 格範圍內）
  let closestWall: { col: number; row: number; type: string } | null = null
  let closestWallDist = Infinity
  for (const [, f] of ctx.furnitureMap) {
    if (!WALL_INTERACTABLE_FURNITURE.has(f.type)) continue
    const d = manhattan(ch.tileCol, ch.tileRow, f.col, f.row)
    if (d <= 8 && d < closestWallDist) {
      closestWallDist = d
      closestWall = f
    }
  }
  if (closestWall) {
    // 牆壁互動親和度衰減
    const wKey = `${closestWall.col},${closestWall.row}`
    const wUid = ctx.furnitureUidMap.get(wKey)
    const wLastVisit = wUid ? (ch.recentFurnitureVisits.get(wUid) ?? -Infinity) : -Infinity
    const wTimeSince = ch.gameTime - wLastVisit
    const wWeight = wTimeSince < cfg.furnitureCooldown
      ? Math.round(cfg.wanderWeightWall * FURNITURE_WEIGHT_DECAY)
      : cfg.wanderWeightWall
    weights.push({ type: 'wall', weight: wWeight, target: { col: closestWall.col, row: closestWall.row }, furnitureType: closestWall.type })
  }

  // 會議桌 — 附近有足夠的非活躍角色時加入
  if (!ch.isSubagent) {
    let closestMeeting: { col: number; row: number; type: string } | null = null
    let closestMeetingDist = Infinity
    for (const [, f] of ctx.furnitureMap) {
      if (f.type !== 'meeting_table') continue
      const d = manhattan(ch.tileCol, ch.tileRow, f.col, f.row)
      if (d <= 10 && d < closestMeetingDist) {
        closestMeetingDist = d
        closestMeeting = f
      }
    }
    if (closestMeeting) {
      // 檢查附近是否有足夠的非活躍、非子代理角色
      let nearbyIdle = 0
      for (const [otherId, other] of ctx.allCharacters) {
        if (otherId === ch.id || other.isSubagent || other.isActive) continue
        const d = manhattan(closestMeeting.col, closestMeeting.row, other.tileCol, other.tileRow)
        if (d <= 8) nearbyIdle++
      }
      if (nearbyIdle >= MEETING_MIN_PARTICIPANTS - 1) {
        weights.push({ type: 'meeting', weight: cfg.wanderWeightMeeting, target: { col: closestMeeting.col, row: closestMeeting.row }, furnitureType: closestMeeting.type })
      }
    }
  }

  // 加權隨機選擇（return_seat 已在 IDLE 狀態中確定性處理）
  const total = weights.reduce((sum, w) => sum + w.weight, 0)
  let r = Math.random() * total
  for (const w of weights) {
    r -= w.weight
    if (r <= 0) return w
  }
  return weights[0]
}

/** 找到家具旁邊的可行走格 */
function findAdjacentWalkable(
  targetCol: number,
  targetRow: number,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
): { col: number; row: number } | null {
  const rows = tileMap.length
  const cols = rows > 0 ? tileMap[0].length : 0
  const offsets = [
    { dc: 0, dr: 1 }, { dc: 0, dr: -1 },
    { dc: 1, dr: 0 }, { dc: -1, dr: 0 },
  ]
  for (const { dc, dr } of offsets) {
    const c = targetCol + dc
    const r = targetRow + dr
    if (c >= 0 && c < cols && r >= 0 && r < rows) {
      const tile = tileMap[r]?.[c]
      if (tile !== undefined && tile !== 0 && tile !== 8 && !blockedTiles.has(`${c},${r}`)) {
        return { col: c, row: r }
      }
    }
  }
  return null
}

/** 為 THINK 踱步生成一條直線路徑 */
function generateThinkPath(
  startCol: number,
  startRow: number,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
): Array<{ col: number; row: number }> {
  const path: Array<{ col: number; row: number }> = [{ col: startCol, row: startRow }]
  const rows = tileMap.length
  const cols = rows > 0 ? tileMap[0].length : 0
  // 嘗試四個方向
  const dirs = [
    { dc: 1, dr: 0 }, { dc: -1, dr: 0 },
    { dc: 0, dr: 1 }, { dc: 0, dr: -1 },
  ]
  for (const { dc, dr } of dirs) {
    let ok = true
    const candidate = [{ col: startCol, row: startRow }]
    for (let i = 1; i <= THINK_PACE_DISTANCE; i++) {
      const c = startCol + dc * i
      const r = startRow + dr * i
      if (c < 0 || c >= cols || r < 0 || r >= rows) { ok = false; break }
      const tile = tileMap[r]?.[c]
      if (tile === undefined || tile === 0 || tile === 8 || blockedTiles.has(`${c},${r}`)) { ok = false; break }
      candidate.push({ col: c, row: r })
    }
    if (ok && candidate.length > 1) return candidate
  }
  return path
}

export function updateCharacter(
  ch: Character,
  dt: number,
  ctx: UpdateContext,
): void {
  const cfg = getBehaviorConfig()
  ch.frameTimer += dt
  ch.gameTime += dt

  switch (ch.state) {
    case CharacterState.TYPE: {
      if (ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {
        ch.frameTimer -= TYPE_FRAME_DURATION_SEC
        ch.frame = (ch.frame + 1) % 2
      }
      // 累加久坐時間
      ch.sitTimer += dt

      // 檢查是否進入思考模式
      if (ch.isThinking) {
        ch.thinkPath = generateThinkPath(ch.tileCol, ch.tileRow, ctx.tileMap, ctx.blockedTiles)
        ch.thinkForward = true
        ch.state = CharacterState.THINK
        ch.frame = 0
        ch.frameTimer = 0
        setEmote(ch, EmoteType.IDEA, EMOTE_DISPLAY_DURATION_SEC)
        break
      }

      // 若不再活躍，站起來開始漫遊（seatTimer 到期後）
      if (!ch.isActive) {
        if (ch.seatTimer > 0) {
          ch.seatTimer -= dt
          break
        }
        ch.seatTimer = 0 // 清除哨兵值

        // 檢查是否觸發伸展（久坐 3 分鐘）
        if (ch.sitTimer >= cfg.stretchTrigger) {
          ch.state = CharacterState.STRETCH
          ch.behaviorTimer = STRETCH_DURATION_SEC
          ch.frame = 0
          ch.frameTimer = 0
          ch.sitTimer = 0
          setEmote(ch, EmoteType.STAR, STRETCH_DURATION_SEC)
          break
        }

        // 久坐後額外漫遊次數（按坐姿時間比例，最多 SIT_WANDER_BONUS_MAX）
        const sitRatio = Math.min(1, ch.sitTimer / cfg.stretchTrigger)
        const sitBonus = Math.floor(sitRatio * SIT_WANDER_BONUS_MAX)
        ch.state = CharacterState.IDLE
        ch.frame = 0
        ch.frameTimer = 0
        ch.sitTimer = 0
        ch.sleepTimer = 0
        ch.wanderTimer = randomRange(cfg.wanderPauseMin, cfg.wanderPauseMax)
        ch.wanderCount = 0
        ch.wanderLimit = randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX) + sitBonus
      }
      break
    }

    case CharacterState.IDLE: {
      // 無閒置動畫 — 靜態姿勢
      ch.frame = 0
      if (ch.seatTimer < 0) ch.seatTimer = 0 // 清除回合結束哨兵值

      // 若變為活躍，尋路至座位
      if (ch.isActive) {
        ch.sleepTimer = 0
        if (!ch.seatId) {
          ch.state = CharacterState.STAND_WORK
          ch.frame = 0
          ch.frameTimer = 0
          break
        }
        const seat = ctx.seats.get(ch.seatId)
        if (seat) {
          const path = findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, ctx.tileMap, ctx.blockedTiles)
          if (path.length > 0) {
            ch.path = path
            ch.moveProgress = 0
            ch.state = CharacterState.WALK
            ch.frame = 0
            ch.frameTimer = 0
          } else {
            ch.state = CharacterState.TYPE
            ch.dir = seat.facingDir
            ch.frame = 0
            ch.frameTimer = 0
          }
        }
        break
      }

      // 累加閒置時間（在座位上時）
      if (ch.seatId) {
        const seat = ctx.seats.get(ch.seatId)
        if (seat && ch.tileCol === seat.seatCol && ch.tileRow === seat.seatRow) {
          ch.sleepTimer += dt
          if (ch.sleepTimer >= cfg.sleepTrigger) {
            ch.state = CharacterState.SLEEP
            ch.frame = 0
            ch.frameTimer = 0
            ch.behaviorTimer = 0
            setEmote(ch, EmoteType.ZZZ, SLEEP_ZZZ_REFRESH_SEC)
            break
          }
        }
      }

      // 漫遊計時器倒數
      ch.wanderTimer -= dt
      if (ch.wanderTimer <= 0) {
        // 漫遊夠了 → 回座休息
        if (ch.wanderCount >= ch.wanderLimit) {
          if (ch.seatId) {
            const seat = ctx.seats.get(ch.seatId)
            if (seat) {
              // 已經在座位上 → 直接坐下休息
              if (ch.tileCol === seat.seatCol && ch.tileRow === seat.seatRow) {
                ch.state = CharacterState.TYPE
                ch.dir = seat.facingDir
                ch.seatTimer = randomRange(cfg.seatRestMin, cfg.seatRestMax)
                ch.wanderCount = 0
                ch.wanderLimit = randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX)
                ch.frame = 0
                ch.frameTimer = 0
                break
              }
              // 不在座位上 → 走回去
              const path = findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, ctx.tileMap, ctx.blockedTiles)
              if (path.length > 0) {
                ch.path = path
                ch.moveProgress = 0
                ch.state = CharacterState.WALK
                ch.frame = 0
                ch.frameTimer = 0
                break
              }
            }
          }
          // 沒有座位或找不到路徑 → 原地站立休息一段時間再重新漫遊
          ch.wanderCount = 0
          ch.wanderLimit = randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX)
          ch.wanderTimer = randomRange(cfg.seatRestMin * 0.5, cfg.seatRestMax * 0.5)
          break
        }

        // 加權選擇漫遊動作
        const action = pickWanderAction(ch, ctx)
        let acted = false

        if (action.type === 'idle_look') {
          // 站著轉方向 — 隨機看向一個方向
          const dirs = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]
          ch.dir = dirs[Math.floor(Math.random() * dirs.length)]
          acted = true
        } else if (action.type === 'furniture' && action.target) {
          const adj = findAdjacentWalkable(action.target.col, action.target.row, ctx.tileMap, ctx.blockedTiles)
          if (adj) {
            const rawPath = findPath(ch.tileCol, ch.tileRow, adj.col, adj.row, ctx.tileMap, ctx.blockedTiles)
            if (rawPath.length > 0) {
              ch.path = truncatePath(rawPath)
              ch.moveProgress = 0
              ch.state = CharacterState.WALK
              ch.frame = 0
              ch.frameTimer = 0
              // 僅在路徑未截斷時設定互動目標
              if (rawPath.length <= WANDER_MAX_PATH_STEPS) {
                ch.interactTarget = action.target
              }
              ch.wanderCount++
              acted = true
            }
          }
        } else if (action.type === 'chat' && action.target && action.chatTarget !== undefined) {
          if (manhattan(ch.tileCol, ch.tileRow, action.target.col, action.target.row) <= CHAT_PROXIMITY_TILES) {
            const other = ctx.allCharacters.get(action.chatTarget)
            if (other && other.state === CharacterState.IDLE && other.chatPartnerId === null) {
              startChat(ch, other)
              acted = true
            }
          } else {
            const rawPath = findPath(ch.tileCol, ch.tileRow, action.target.col, action.target.row, ctx.tileMap, ctx.blockedTiles)
            if (rawPath.length > 0) {
              ch.path = truncatePath(rawPath)
              ch.moveProgress = 0
              ch.state = CharacterState.WALK
              ch.frame = 0
              ch.frameTimer = 0
              ch.wanderCount++
              acted = true
            }
          }
        } else if (action.type === 'wall' && action.target) {
          const adj = findAdjacentWalkable(action.target.col, action.target.row, ctx.tileMap, ctx.blockedTiles)
          if (adj) {
            const rawPath = findPath(ch.tileCol, ch.tileRow, adj.col, adj.row, ctx.tileMap, ctx.blockedTiles)
            if (rawPath.length > 0) {
              ch.path = truncatePath(rawPath)
              ch.moveProgress = 0
              ch.state = CharacterState.WALK
              ch.frame = 0
              ch.frameTimer = 0
              // 僅在路徑未截斷時設定互動目標
              if (rawPath.length <= WANDER_MAX_PATH_STEPS) {
                ch.interactTarget = action.target
              }
              ch.wanderCount++
              acted = true
            }
          }
        } else if (action.type === 'meeting' && action.target) {
          // 走向會議桌旁的空閒格
          const adj = findMeetingSpot(action.target.col, action.target.row, ctx.tileMap, ctx.blockedTiles, ctx.allCharacters, ch.id)
          if (adj) {
            if (ch.tileCol === adj.col && ch.tileRow === adj.row) {
              // 已經在會議桌旁 → 直接進入會議
              startMeeting(ch, action.target, ctx.allCharacters, ctx.tileMap, ctx.blockedTiles)
              acted = true
            } else {
              const rawPath = findPath(ch.tileCol, ch.tileRow, adj.col, adj.row, ctx.tileMap, ctx.blockedTiles)
              if (rawPath.length > 0) {
                ch.path = truncatePath(rawPath)
                ch.moveProgress = 0
                ch.state = CharacterState.WALK
                ch.frame = 0
                ch.frameTimer = 0
                ch.meetingTableUid = `${action.target.col},${action.target.row}`
                ch.wanderCount++
                acted = true
              }
            }
          }
        } else {
          // 隨機漫遊 — 限制在附近幾格，優先走近處
          const nearby = ctx.walkableTiles.filter(
            (t) => manhattan(ch.tileCol, ch.tileRow, t.col, t.row) <= WANDER_RANDOM_RADIUS &&
              (t.col !== ch.tileCol || t.row !== ch.tileRow),
          )
          if (nearby.length > 0) {
            // 加權偏好近處目標（距離 1 權重 3, 距離 2 權重 2, 距離 3 權重 1）
            const weighted: Array<{ tile: { col: number; row: number }; w: number }> = nearby.map(t => {
              const d = manhattan(ch.tileCol, ch.tileRow, t.col, t.row)
              return { tile: t, w: WANDER_RANDOM_RADIUS + 1 - d }
            })
            const totalW = weighted.reduce((s, e) => s + e.w, 0)
            let pick = Math.random() * totalW
            let target = weighted[0].tile
            for (const e of weighted) {
              pick -= e.w
              if (pick <= 0) { target = e.tile; break }
            }
            const rawPath = findPath(ch.tileCol, ch.tileRow, target.col, target.row, ctx.tileMap, ctx.blockedTiles)
            if (rawPath.length > 0) {
              ch.path = truncatePath(rawPath)
              ch.moveProgress = 0
              ch.state = CharacterState.WALK
              ch.frame = 0
              ch.frameTimer = 0
              ch.wanderCount++
              acted = true
            }
          }
        }
        // 無論是否成功行動，都重設漫遊計時器
        if (action.type === 'idle_look') {
          // 站著看看後短暫停頓
          ch.wanderTimer = randomRange(cfg.wanderPauseMin * 0.5, cfg.wanderPauseMin * 1.5)
        } else {
          ch.wanderTimer = acted
            ? randomRange(cfg.wanderPauseMin, cfg.wanderPauseMax)
            : randomRange(cfg.wanderPauseMax * 0.5, cfg.wanderPauseMax)
        }
      }
      break
    }

    case CharacterState.WALK: {
      if (ch.path.length === 0) {
        // 路徑完成 — 對齊至格中心並轉換狀態
        const center = tileCenter(ch.tileCol, ch.tileRow)
        ch.x = center.x
        ch.y = center.y

        if (ch.isActive) {
          if (!ch.seatId) {
            ch.state = CharacterState.STAND_WORK
          } else {
            const seat = ctx.seats.get(ch.seatId)
            if (seat && ch.tileCol === seat.seatCol && ch.tileRow === seat.seatRow) {
              ch.state = CharacterState.TYPE
              ch.dir = seat.facingDir
            } else {
              ch.state = CharacterState.IDLE
            }
          }
        } else {
          // 檢查是否抵達互動目標旁
          if (ch.interactTarget) {
            const target = ch.interactTarget
            const d = manhattan(ch.tileCol, ch.tileRow, target.col, target.row)
            if (d <= 2) {
              // 查找目標家具類型
              const fKey = `${target.col},${target.row}`
              const furniture = ctx.furnitureMap.get(fKey)
              if (furniture) {
                ch.dir = directionBetween(ch.tileCol, ch.tileRow, target.col, target.row)
                if (WALL_INTERACTABLE_FURNITURE.has(furniture.type)) {
                  ch.state = CharacterState.USE_WALL
                  ch.behaviorTimer = randomRange(USE_WALL_DURATION_MIN_SEC, USE_WALL_DURATION_MAX_SEC)
                  setEmote(ch, EmoteType.NOTE, ch.behaviorTimer)
                } else {
                  ch.state = CharacterState.INTERACT
                  ch.behaviorTimer = randomRange(INTERACT_DURATION_MIN_SEC, INTERACT_DURATION_MAX_SEC)
                  setEmote(ch, getInteractEmote(furniture.type), ch.behaviorTimer)
                }
                ch.frame = 0
                ch.frameTimer = 0
                // 記錄家具訪問（用於親和度衰減）
                const visitUid = ctx.furnitureUidMap.get(fKey)
                if (visitUid) {
                  ch.recentFurnitureVisits.set(visitUid, ch.gameTime)
                  if (ch.recentFurnitureVisits.size > FURNITURE_VISIT_HISTORY_MAX) {
                    let oldestKey = '', oldestTime = Infinity
                    for (const [k, t] of ch.recentFurnitureVisits) {
                      if (t < oldestTime) { oldestTime = t; oldestKey = k }
                    }
                    ch.recentFurnitureVisits.delete(oldestKey)
                  }
                }
                ch.interactTarget = null
                break
              }
            }
            ch.interactTarget = null
          }

          // 檢查是否正在前往會議桌
          if (ch.meetingTableUid) {
            const [mtc, mtr] = ch.meetingTableUid.split(',').map(Number)
            const d = manhattan(ch.tileCol, ch.tileRow, mtc, mtr)
            if (d <= MEETING_SEAT_SEARCH_RADIUS) {
              const duration = randomRange(MEETING_DURATION_MIN_SEC, MEETING_DURATION_MAX_SEC)
              ch.state = CharacterState.MEETING
              ch.behaviorTimer = duration
              ch.dir = directionBetween(ch.tileCol, ch.tileRow, mtc, mtr)
              ch.frame = 0
              ch.frameTimer = 0
              setEmote(ch, EmoteType.NOTE, 3)
              break
            }
            ch.meetingTableUid = null
          }

          // 到達座位旁 — 檢查是否有附近的聊天對象
          if (!ch.isActive && ch.chatPartnerId === null) {
            for (const [otherId, other] of ctx.allCharacters) {
              if (otherId === ch.id || other.isSubagent) continue
              if (other.state !== CharacterState.IDLE || other.chatPartnerId !== null) continue
              if (manhattan(ch.tileCol, ch.tileRow, other.tileCol, other.tileRow) <= CHAT_PROXIMITY_TILES) {
                if (Math.random() < 0.3) {
                  startChat(ch, other)
                  break
                }
              }
            }
            if ((ch.state as CharacterState) === CharacterState.CHAT) {
              ch.frame = 0
              ch.frameTimer = 0
              break
            }
          }

          // 檢查是否抵達分配的座位 — 坐下休息後再繼續漫遊
          if (ch.seatId) {
            const seat = ctx.seats.get(ch.seatId)
            if (seat && ch.tileCol === seat.seatCol && ch.tileRow === seat.seatRow) {
              ch.state = CharacterState.TYPE
              ch.dir = seat.facingDir
              if (ch.seatTimer < 0) {
                ch.seatTimer = 0
              } else {
                ch.seatTimer = randomRange(cfg.seatRestMin, cfg.seatRestMax)
              }
              ch.wanderCount = 0
              ch.wanderLimit = randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX)
              ch.frame = 0
              ch.frameTimer = 0
              break
            }
          }
          ch.state = CharacterState.IDLE
          ch.wanderTimer = randomRange(cfg.wanderPauseMin, cfg.wanderPauseMax)
        }
        ch.frame = 0
        ch.frameTimer = 0
        break
      }

      // 朝路徑中的下一格移動（自然化：距離同步幀 + 轉向停頓）
      advanceWalk(ch, ch.path[0], dt)

      // 若在漫遊期間變為活躍，重新尋路至座位
      if (ch.isActive && ch.seatId) {
        const seat = ctx.seats.get(ch.seatId)
        if (seat) {
          const lastStep = ch.path[ch.path.length - 1]
          if (!lastStep || lastStep.col !== seat.seatCol || lastStep.row !== seat.seatRow) {
            const newPath = findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, ctx.tileMap, ctx.blockedTiles)
            if (newPath.length > 0) {
              ch.path = newPath
              ch.moveProgress = 0
              ch.interactTarget = null
            }
          }
        }
      }
      break
    }

    case CharacterState.STAND_WORK: {
      // 站立工作（無座位的活躍代理）
      if (ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {
        ch.frameTimer -= TYPE_FRAME_DURATION_SEC
        ch.frame = (ch.frame + 1) % 2
      }
      // 檢查思考模式
      if (ch.isThinking) {
        ch.thinkPath = generateThinkPath(ch.tileCol, ch.tileRow, ctx.tileMap, ctx.blockedTiles)
        ch.thinkForward = true
        ch.state = CharacterState.THINK
        ch.frame = 0
        ch.frameTimer = 0
        setEmote(ch, EmoteType.IDEA, EMOTE_DISPLAY_DURATION_SEC)
        break
      }
      if (!ch.isActive) {
        ch.state = CharacterState.IDLE
        ch.frame = 0
        ch.frameTimer = 0
        ch.wanderTimer = randomRange(cfg.wanderPauseMin, cfg.wanderPauseMax)
        ch.wanderCount = 0
        ch.wanderLimit = randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX)
      }
      break
    }

    case CharacterState.STRETCH: {
      // 伸展動畫
      if (ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {
        ch.frameTimer -= TYPE_FRAME_DURATION_SEC
        ch.frame = (ch.frame + 1) % 2
      }
      ch.behaviorTimer -= dt
      if (ch.behaviorTimer <= 0) {
        ch.state = CharacterState.IDLE
        ch.frame = 0
        ch.frameTimer = 0
        ch.wanderTimer = randomRange(cfg.wanderPauseMin, cfg.wanderPauseMax)
        ch.wanderCount = 0
        ch.wanderLimit = randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX)
      }
      // 若變為活躍，中斷伸展
      if (ch.isActive) {
        ch.state = CharacterState.IDLE
        ch.frame = 0
        ch.frameTimer = 0
      }
      break
    }

    case CharacterState.INTERACT: {
      // 互動動畫（使用 read 幀）
      if (ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {
        ch.frameTimer -= TYPE_FRAME_DURATION_SEC
        ch.frame = (ch.frame + 1) % 2
      }
      ch.behaviorTimer -= dt
      if (ch.behaviorTimer <= 0 || ch.isActive) {
        ch.state = CharacterState.IDLE
        ch.frame = 0
        ch.frameTimer = 0
        ch.wanderTimer = randomRange(cfg.wanderPauseMin, cfg.wanderPauseMax)
      }
      break
    }

    case CharacterState.USE_WALL: {
      // 使用白板/布告欄（使用 type 幀）
      if (ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {
        ch.frameTimer -= TYPE_FRAME_DURATION_SEC
        ch.frame = (ch.frame + 1) % 2
      }
      ch.behaviorTimer -= dt
      if (ch.behaviorTimer <= 0 || ch.isActive) {
        ch.state = CharacterState.IDLE
        ch.frame = 0
        ch.frameTimer = 0
        ch.wanderTimer = randomRange(cfg.wanderPauseMin, cfg.wanderPauseMax)
      }
      break
    }

    case CharacterState.CHAT: {
      // 聊天動畫（使用 read 幀）
      if (ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {
        ch.frameTimer -= TYPE_FRAME_DURATION_SEC
        ch.frame = (ch.frame + 1) % 2
      }
      ch.behaviorTimer -= dt
      if (ch.behaviorTimer <= 0 || ch.isActive) {
        endChat(ch, ctx.allCharacters)
      }
      break
    }

    case CharacterState.THINK: {
      // 持續顯示思考表情 — 表情過期時自動重新觸發
      if (!ch.emoteType) {
        setEmote(ch, EmoteType.IDEA, EMOTE_DISPLAY_DURATION_SEC)
      }
      // 步行動畫由 advanceWalk 推進

      // 不再思考 → 返回工作
      if (!ch.isThinking) {
        if (ch.seatId) {
          const seat = ctx.seats.get(ch.seatId)
          if (seat) {
            const path = findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, ctx.tileMap, ctx.blockedTiles)
            if (path.length > 0) {
              ch.path = path
              ch.moveProgress = 0
              ch.state = CharacterState.WALK
            } else {
              ch.state = CharacterState.TYPE
              ch.dir = seat.facingDir
            }
          } else {
            ch.state = ch.seatId ? CharacterState.TYPE : CharacterState.STAND_WORK
          }
        } else {
          ch.state = CharacterState.STAND_WORK
        }
        ch.frame = 0
        ch.frameTimer = 0
        ch.thinkPath = []
        break
      }

      // 沿踱步路徑移動
      if (ch.path.length === 0 && ch.thinkPath.length > 1) {
        // 到達路徑端點 — 掉頭
        ch.thinkForward = !ch.thinkForward
        const next = ch.thinkForward
          ? ch.thinkPath.slice(1)
          : [...ch.thinkPath].reverse().slice(1)
        ch.path = next
        ch.moveProgress = 0
      }

      if (ch.path.length > 0) {
        advanceWalk(ch, ch.path[0], dt)
      }
      break
    }

    case CharacterState.SLEEP: {
      // 睡眠狀態（趴在桌上）
      if (ch.frameTimer >= TYPE_FRAME_DURATION_SEC * 2) {
        ch.frameTimer -= TYPE_FRAME_DURATION_SEC * 2
        ch.frame = (ch.frame + 1) % 2
      }
      ch.behaviorTimer += dt
      // 定期刷新 zzZ 表情
      if (ch.behaviorTimer >= SLEEP_ZZZ_REFRESH_SEC) {
        ch.behaviorTimer = 0
        setEmote(ch, EmoteType.ZZZ, SLEEP_ZZZ_REFRESH_SEC)
      }
      // 被喚醒
      if (ch.isActive) {
        ch.state = CharacterState.TYPE
        ch.frame = 0
        ch.frameTimer = 0
        ch.sleepTimer = 0
        ch.behaviorTimer = 0
        setEmote(ch, EmoteType.STAR, EMOTE_DISPLAY_DURATION_SEC)
        break
      }
      break
    }

    case CharacterState.MEETING: {
      // 會議動畫（使用 read 幀）
      if (ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {
        ch.frameTimer -= TYPE_FRAME_DURATION_SEC
        ch.frame = (ch.frame + 1) % 2
      }
      ch.behaviorTimer -= dt
      // 定期顯示表情
      if (!ch.emoteType && Math.random() < 0.02) {
        setEmote(ch, Math.random() < 0.5 ? EmoteType.NOTE : EmoteType.IDEA)
      }
      // 會議結束或代理活躍
      if (ch.behaviorTimer <= 0 || ch.isActive) {
        ch.state = CharacterState.IDLE
        ch.meetingTableUid = null
        ch.frame = 0
        ch.frameTimer = 0
        ch.wanderTimer = randomRange(cfg.wanderPauseMin, cfg.wanderPauseMax)
        setEmote(ch, EmoteType.STAR)
      }
      break
    }

    case CharacterState.ENTER_ELEVATOR: {
      if (ch.path.length === 0) {
        // 到達電梯位置 → 觸發消散（由 officeState 的 matrix 特效處理）
        ch.transferTargetFloor = 'despawning'
        // 標記為消散 — officeState.update() 會在 matrixEffect 完成後移除
        ch.matrixEffect = 'despawn'
        ch.matrixEffectTimer = 0
        ch.matrixEffectSeeds = Array.from({ length: 16 }, () => Math.random())
        ch.bubbleType = null
        break
      }
      advanceWalk(ch, ch.path[0], dt)
      break
    }
  }
}

/** 開始兩個角色的聊天 */
function startChat(a: Character, b: Character): void {
  const cfg = getBehaviorConfig()
  const duration = randomRange(cfg.chatDurationMin, cfg.chatDurationMax)
  a.state = CharacterState.CHAT
  a.chatPartnerId = b.id
  a.behaviorTimer = duration
  a.dir = directionBetween(a.tileCol, a.tileRow, b.tileCol, b.tileRow)
  setEmote(a, EmoteType.HEART, duration)

  b.state = CharacterState.CHAT
  b.chatPartnerId = a.id
  b.behaviorTimer = duration
  b.dir = directionBetween(b.tileCol, b.tileRow, a.tileCol, a.tileRow)
  setEmote(b, EmoteType.HEART, duration)
}

/** 結束聊天 */
function endChat(ch: Character, allCharacters: Map<number, Character>): void {
  const cfg = getBehaviorConfig()
  if (ch.chatPartnerId !== null) {
    const partner = allCharacters.get(ch.chatPartnerId)
    if (partner && partner.state === CharacterState.CHAT) {
      partner.state = CharacterState.IDLE
      partner.chatPartnerId = null
      partner.frame = 0
      partner.frameTimer = 0
      partner.wanderTimer = randomRange(cfg.wanderPauseMin, cfg.wanderPauseMax)
    }
  }
  ch.state = CharacterState.IDLE
  ch.chatPartnerId = null
  ch.frame = 0
  ch.frameTimer = 0
  ch.wanderTimer = randomRange(cfg.wanderPauseMin, cfg.wanderPauseMax)
}

/** 找到會議桌旁的可用座位（考慮其他角色佔用） */
function findMeetingSpot(
  tableCol: number,
  tableRow: number,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
  allCharacters: Map<number, Character>,
  selfId: number,
): { col: number; row: number } | null {
  const rows = tileMap.length
  const cols = rows > 0 ? tileMap[0].length : 0
  const occupiedTiles = new Set<string>()
  for (const [cid, c] of allCharacters) {
    if (cid === selfId) continue
    occupiedTiles.add(`${c.tileCol},${c.tileRow}`)
  }
  // 搜索半徑內的可用格
  const candidates: Array<{ col: number; row: number; dist: number }> = []
  for (let dr = -MEETING_SEAT_SEARCH_RADIUS; dr <= MEETING_SEAT_SEARCH_RADIUS; dr++) {
    for (let dc = -MEETING_SEAT_SEARCH_RADIUS; dc <= MEETING_SEAT_SEARCH_RADIUS; dc++) {
      if (dr === 0 && dc === 0) continue
      const c = tableCol + dc
      const r = tableRow + dr
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue
      const tile = tileMap[r]?.[c]
      if (tile === undefined || tile === 0 || tile === 8) continue
      const key = `${c},${r}`
      if (blockedTiles.has(key) || occupiedTiles.has(key)) continue
      candidates.push({ col: c, row: r, dist: Math.abs(dc) + Math.abs(dr) })
    }
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.dist - b.dist)
  return candidates[0]
}

/** 開始會議 — 通知附近的閒置角色也加入 */
function startMeeting(
  initiator: Character,
  tablePos: { col: number; row: number },
  allCharacters: Map<number, Character>,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
): void {
  const duration = randomRange(MEETING_DURATION_MIN_SEC, MEETING_DURATION_MAX_SEC)
  initiator.state = CharacterState.MEETING
  initiator.meetingTableUid = `${tablePos.col},${tablePos.row}`
  initiator.behaviorTimer = duration
  initiator.dir = directionBetween(initiator.tileCol, initiator.tileRow, tablePos.col, tablePos.row)
  initiator.frame = 0
  initiator.frameTimer = 0
  setEmote(initiator, EmoteType.NOTE, 3)

  // 邀請附近的閒置角色加入
  for (const [otherId, other] of allCharacters) {
    if (otherId === initiator.id || other.isSubagent || other.isActive) continue
    if (other.state !== CharacterState.IDLE) continue
    const d = manhattan(tablePos.col, tablePos.row, other.tileCol, other.tileRow)
    if (d <= 8) {
      const spot = findMeetingSpot(tablePos.col, tablePos.row, tileMap, blockedTiles, allCharacters, otherId)
      if (spot) {
        if (other.tileCol === spot.col && other.tileRow === spot.row) {
          other.state = CharacterState.MEETING
          other.meetingTableUid = `${tablePos.col},${tablePos.row}`
          other.behaviorTimer = duration
          other.dir = directionBetween(other.tileCol, other.tileRow, tablePos.col, tablePos.row)
          other.frame = 0
          other.frameTimer = 0
          setEmote(other, EmoteType.NOTE, 3)
        } else {
          // 走向會議桌
          other.meetingTableUid = `${tablePos.col},${tablePos.row}`
          const path = findPath(other.tileCol, other.tileRow, spot.col, spot.row, tileMap, blockedTiles)
          if (path.length > 0) {
            other.path = truncatePath(path)
            other.moveProgress = 0
            other.state = CharacterState.WALK
            other.frame = 0
            other.frameTimer = 0
          }
        }
      }
    }
  }
}

/** 取得角色當前狀態和方向對應的精靈圖幀 */
export function getCharacterSprite(ch: Character, sprites: CharacterSprites): SpriteData {
  switch (ch.state) {
    case CharacterState.TYPE:
      if (isReadingTool(ch.currentTool)) {
        return sprites.reading[ch.dir][ch.frame % 2]
      }
      return sprites.typing[ch.dir][ch.frame % 2]
    case CharacterState.WALK:
      return sprites.walk[ch.dir][ch.frame % 4]
    case CharacterState.IDLE:
      return sprites.walk[ch.dir][1]
    case CharacterState.STAND_WORK:
      if (isReadingTool(ch.currentTool)) {
        return sprites.reading[ch.dir][ch.frame % 2]
      }
      return sprites.typing[ch.dir][ch.frame % 2]
    case CharacterState.STRETCH:
      return sprites.reading[ch.dir][ch.frame % 2]
    case CharacterState.INTERACT:
      return sprites.reading[ch.dir][ch.frame % 2]
    case CharacterState.USE_WALL:
      return sprites.typing[ch.dir][ch.frame % 2]
    case CharacterState.CHAT:
      return sprites.reading[ch.dir][ch.frame % 2]
    case CharacterState.THINK:
      return sprites.walk[ch.dir][ch.frame % 4]
    case CharacterState.SLEEP:
      return sprites.typing[ch.dir][ch.frame % 2]
    case CharacterState.MEETING:
      return sprites.reading[ch.dir][ch.frame % 2]
    case CharacterState.ENTER_ELEVATOR:
      return sprites.walk[ch.dir][ch.frame % 4]
    default:
      return sprites.walk[ch.dir][1]
  }
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}
