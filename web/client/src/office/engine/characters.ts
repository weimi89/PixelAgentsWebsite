import { CharacterState, Direction, TILE_SIZE, EmoteType } from '../types.js'
import type { Character, Seat, SpriteData, TileType as TileTypeVal } from '../types.js'
import type { CharacterSprites } from '../sprites/spriteData.js'
import { findPath } from '../layout/tileMap.js'
import {
  WALK_SPEED_PX_PER_SEC,
  WALK_FRAME_DURATION_SEC,
  TYPE_FRAME_DURATION_SEC,
  WANDER_PAUSE_MIN_SEC,
  WANDER_PAUSE_MAX_SEC,
  WANDER_MOVES_BEFORE_REST_MIN,
  WANDER_MOVES_BEFORE_REST_MAX,
  SEAT_REST_MIN_SEC,
  SEAT_REST_MAX_SEC,
  CHAT_DURATION_MIN_SEC,
  CHAT_DURATION_MAX_SEC,
  CHAT_PROXIMITY_TILES,
  INTERACT_DURATION_MIN_SEC,
  INTERACT_DURATION_MAX_SEC,
  THINK_PACE_DISTANCE,
  STRETCH_DURATION_SEC,
  USE_WALL_DURATION_MIN_SEC,
  USE_WALL_DURATION_MAX_SEC,
  SLEEP_TRIGGER_IDLE_SEC,
  STRETCH_TRIGGER_SIT_SEC,
  EMOTE_DISPLAY_DURATION_SEC,
  SLEEP_ZZZ_REFRESH_SEC,
  WANDER_WEIGHT_RANDOM,
  WANDER_WEIGHT_FURNITURE,
  WANDER_WEIGHT_CHAT,
  WANDER_WEIGHT_WALL,
  WANDER_WEIGHT_RETURN_SEAT,
} from '../../constants.js'

/** 顯示閱讀動畫而非打字動畫的工具 */
const READING_TOOLS = new Set(['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'])

export function isReadingTool(tool: string | null): boolean {
  if (!tool) return false
  return READING_TOOLS.has(tool)
}

/** 判斷狀態是否需要坐姿偏移（在椅子上的狀態） */
export function isSittingState(state: CharacterState): boolean {
  return state === CharacterState.TYPE || state === CharacterState.SLEEP
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
  }
}

/** 曼哈頓距離 */
function manhattan(c1: number, r1: number, c2: number, r2: number): number {
  return Math.abs(c1 - c2) + Math.abs(r1 - r2)
}

/** 加權隨機漫遊目標選擇 */
function pickWanderAction(
  ch: Character,
  ctx: UpdateContext,
): { type: 'random' | 'furniture' | 'chat' | 'wall' | 'return_seat'; target?: { col: number; row: number }; furnitureType?: string; chatTarget?: number } {
  const weights: Array<{ type: 'random' | 'furniture' | 'chat' | 'wall' | 'return_seat'; weight: number; target?: { col: number; row: number }; furnitureType?: string; chatTarget?: number }> = []

  // 隨機漫遊
  weights.push({ type: 'random', weight: WANDER_WEIGHT_RANDOM })

  // 互動家具
  let closestFurniture: { col: number; row: number; type: string } | null = null
  let closestFurnitureDist = Infinity
  for (const [, f] of ctx.furnitureMap) {
    if (!INTERACTABLE_FURNITURE.has(f.type)) continue
    const d = manhattan(ch.tileCol, ch.tileRow, f.col, f.row)
    if (d < closestFurnitureDist) {
      closestFurnitureDist = d
      closestFurniture = f
    }
  }
  if (closestFurniture) {
    weights.push({ type: 'furniture', weight: WANDER_WEIGHT_FURNITURE, target: { col: closestFurniture.col, row: closestFurniture.row }, furnitureType: closestFurniture.type })
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
    weights.push({ type: 'chat', weight: WANDER_WEIGHT_CHAT, target: { col: closestChat.col, row: closestChat.row }, chatTarget: closestChat.id })
  }

  // 白板
  let closestWall: { col: number; row: number; type: string } | null = null
  let closestWallDist = Infinity
  for (const [, f] of ctx.furnitureMap) {
    if (!WALL_INTERACTABLE_FURNITURE.has(f.type)) continue
    const d = manhattan(ch.tileCol, ch.tileRow, f.col, f.row)
    if (d < closestWallDist) {
      closestWallDist = d
      closestWall = f
    }
  }
  if (closestWall) {
    weights.push({ type: 'wall', weight: WANDER_WEIGHT_WALL, target: { col: closestWall.col, row: closestWall.row }, furnitureType: closestWall.type })
  }

  // 返回座位
  if (ch.wanderCount >= ch.wanderLimit && ch.seatId) {
    weights.push({ type: 'return_seat', weight: WANDER_WEIGHT_RETURN_SEAT })
  }

  // 加權隨機選擇
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
  ch.frameTimer += dt

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
        if (ch.sitTimer >= STRETCH_TRIGGER_SIT_SEC) {
          ch.state = CharacterState.STRETCH
          ch.behaviorTimer = STRETCH_DURATION_SEC
          ch.frame = 0
          ch.frameTimer = 0
          ch.sitTimer = 0
          setEmote(ch, EmoteType.STAR, STRETCH_DURATION_SEC)
          break
        }

        ch.state = CharacterState.IDLE
        ch.frame = 0
        ch.frameTimer = 0
        ch.sitTimer = 0
        ch.sleepTimer = 0
        ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC)
        ch.wanderCount = 0
        ch.wanderLimit = randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX)
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
          if (ch.sleepTimer >= SLEEP_TRIGGER_IDLE_SEC) {
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
        const action = pickWanderAction(ch, ctx)

        if (action.type === 'return_seat' && ch.seatId) {
          const seat = ctx.seats.get(ch.seatId)
          if (seat) {
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
        } else if (action.type === 'furniture' && action.target) {
          const adj = findAdjacentWalkable(action.target.col, action.target.row, ctx.tileMap, ctx.blockedTiles)
          if (adj) {
            const path = findPath(ch.tileCol, ch.tileRow, adj.col, adj.row, ctx.tileMap, ctx.blockedTiles)
            if (path.length > 0) {
              ch.path = path
              ch.moveProgress = 0
              ch.state = CharacterState.WALK
              ch.frame = 0
              ch.frameTimer = 0
              ch.interactTarget = action.target
              ch.wanderCount++
              break
            }
          }
        } else if (action.type === 'chat' && action.target && action.chatTarget !== undefined) {
          // 如果夠近則直接聊天，否則走過去
          if (manhattan(ch.tileCol, ch.tileRow, action.target.col, action.target.row) <= CHAT_PROXIMITY_TILES) {
            const other = ctx.allCharacters.get(action.chatTarget)
            if (other && other.state === CharacterState.IDLE && other.chatPartnerId === null) {
              startChat(ch, other)
              break
            }
          } else {
            const path = findPath(ch.tileCol, ch.tileRow, action.target.col, action.target.row, ctx.tileMap, ctx.blockedTiles)
            if (path.length > 0) {
              ch.path = path
              ch.moveProgress = 0
              ch.state = CharacterState.WALK
              ch.frame = 0
              ch.frameTimer = 0
              ch.wanderCount++
              break
            }
          }
        } else if (action.type === 'wall' && action.target) {
          const adj = findAdjacentWalkable(action.target.col, action.target.row, ctx.tileMap, ctx.blockedTiles)
          if (adj) {
            const path = findPath(ch.tileCol, ch.tileRow, adj.col, adj.row, ctx.tileMap, ctx.blockedTiles)
            if (path.length > 0) {
              ch.path = path
              ch.moveProgress = 0
              ch.state = CharacterState.WALK
              ch.frame = 0
              ch.frameTimer = 0
              ch.interactTarget = action.target
              ch.wanderCount++
              break
            }
          }
        } else {
          // 隨機漫遊
          if (ctx.walkableTiles.length > 0) {
            const target = ctx.walkableTiles[Math.floor(Math.random() * ctx.walkableTiles.length)]
            const path = findPath(ch.tileCol, ch.tileRow, target.col, target.row, ctx.tileMap, ctx.blockedTiles)
            if (path.length > 0) {
              ch.path = path
              ch.moveProgress = 0
              ch.state = CharacterState.WALK
              ch.frame = 0
              ch.frameTimer = 0
              ch.wanderCount++
            }
          }
        }
        ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC)
      }
      break
    }

    case CharacterState.WALK: {
      // 步行動畫
      if (ch.frameTimer >= WALK_FRAME_DURATION_SEC) {
        ch.frameTimer -= WALK_FRAME_DURATION_SEC
        ch.frame = (ch.frame + 1) % 4
      }

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
                ch.interactTarget = null
                break
              }
            }
            ch.interactTarget = null
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
                ch.seatTimer = randomRange(SEAT_REST_MIN_SEC, SEAT_REST_MAX_SEC)
              }
              ch.wanderCount = 0
              ch.wanderLimit = randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX)
              ch.frame = 0
              ch.frameTimer = 0
              break
            }
          }
          ch.state = CharacterState.IDLE
          ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC)
        }
        ch.frame = 0
        ch.frameTimer = 0
        break
      }

      // 朝路徑中的下一格移動
      const nextTile = ch.path[0]
      ch.dir = directionBetween(ch.tileCol, ch.tileRow, nextTile.col, nextTile.row)

      ch.moveProgress += (WALK_SPEED_PX_PER_SEC / TILE_SIZE) * dt

      const fromCenter = tileCenter(ch.tileCol, ch.tileRow)
      const toCenter = tileCenter(nextTile.col, nextTile.row)
      const t = Math.min(ch.moveProgress, 1)
      ch.x = fromCenter.x + (toCenter.x - fromCenter.x) * t
      ch.y = fromCenter.y + (toCenter.y - fromCenter.y) * t

      if (ch.moveProgress >= 1) {
        ch.tileCol = nextTile.col
        ch.tileRow = nextTile.row
        ch.x = toCenter.x
        ch.y = toCenter.y
        ch.path.shift()
        ch.moveProgress = 0
      }

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
        ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC)
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
        ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC)
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
        ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC)
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
        ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC)
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
      // 思考踱步
      if (ch.frameTimer >= WALK_FRAME_DURATION_SEC) {
        ch.frameTimer -= WALK_FRAME_DURATION_SEC
        ch.frame = (ch.frame + 1) % 4
      }

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
        // 定期刷新表情
        if (!ch.emoteType) {
          setEmote(ch, EmoteType.IDEA, EMOTE_DISPLAY_DURATION_SEC)
        }
      }

      if (ch.path.length > 0) {
        const nextStep = ch.path[0]
        ch.dir = directionBetween(ch.tileCol, ch.tileRow, nextStep.col, nextStep.row)
        ch.moveProgress += (WALK_SPEED_PX_PER_SEC / TILE_SIZE) * dt
        const from = tileCenter(ch.tileCol, ch.tileRow)
        const to = tileCenter(nextStep.col, nextStep.row)
        const p = Math.min(ch.moveProgress, 1)
        ch.x = from.x + (to.x - from.x) * p
        ch.y = from.y + (to.y - from.y) * p

        if (ch.moveProgress >= 1) {
          ch.tileCol = nextStep.col
          ch.tileRow = nextStep.row
          ch.x = to.x
          ch.y = to.y
          ch.path.shift()
          ch.moveProgress = 0
        }
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
  }
}

/** 開始兩個角色的聊天 */
function startChat(a: Character, b: Character): void {
  const duration = randomRange(CHAT_DURATION_MIN_SEC, CHAT_DURATION_MAX_SEC)
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
  if (ch.chatPartnerId !== null) {
    const partner = allCharacters.get(ch.chatPartnerId)
    if (partner && partner.state === CharacterState.CHAT) {
      partner.state = CharacterState.IDLE
      partner.chatPartnerId = null
      partner.frame = 0
      partner.frameTimer = 0
      partner.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC)
    }
  }
  ch.state = CharacterState.IDLE
  ch.chatPartnerId = null
  ch.frame = 0
  ch.frameTimer = 0
  ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC)
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
