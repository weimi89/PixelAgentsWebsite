import { TILE_SIZE, MATRIX_EFFECT_DURATION, CharacterState, Direction } from '../types.js'
import type { EmoteType, DayPhase } from '../types.js'
import {
  INACTIVE_SEAT_TIMER_MIN_SEC,
  INACTIVE_SEAT_TIMER_RANGE_SEC,
  AUTO_ON_FACING_DEPTH,
  AUTO_ON_SIDE_DEPTH,
  CHARACTER_SITTING_OFFSET_PX,
  CHARACTER_HIT_HALF_WIDTH,
  CHARACTER_HIT_HEIGHT,
} from '../../constants.js'
import type { Character, Seat, FurnitureInstance, TileType as TileTypeVal, OfficeLayout, PlacedFurniture } from '../types.js'
import { updateCharacter, isSittingState } from './characters.js'
import type { UpdateContext } from './characters.js'
import { isWalkable, getWalkableTiles, findPath } from '../layout/tileMap.js'
import {
  createDefaultLayout,
  layoutToTileMap,
  layoutToFurnitureInstances,
  layoutToSeats,
  getBlockedTiles,
} from '../layout/layoutSerializer.js'
import { getCatalogEntry, getOnStateType } from '../layout/furnitureCatalog.js'
import { AgentManager } from './agentManager.js'
import { SubagentManager } from './subagentManager.js'
import { BubbleEmoteManager } from './bubbleEmoteManager.js'

export class OfficeState {
  layout: OfficeLayout
  tileMap: TileTypeVal[][]
  seats: Map<string, Seat>
  blockedTiles: Set<string>
  furniture: FurnitureInstance[]
  walkableTiles: Array<{ col: number; row: number }>
  /** "col,row" → seatUid 快速查找索引 */
  private seatTileIndex: Map<string, string> = new Map()
  private furnitureRebuildScheduled = false
  characters: Map<number, Character> = new Map()
  selectedAgentId: number | null = null
  cameraFollowId: number | null = null
  hoveredAgentId: number | null = null
  hoveredTile: { col: number; row: number } | null = null
  /** 佈局版本計數器，每次佈局變更時遞增（用於渲染快取失效） */
  layoutVersion = 0
  /** 當前日夜階段 */
  dayPhase: DayPhase = 'day'
  /** 前一次的日夜階段（偵測變化以重建家具） */
  private prevDayPhase: DayPhase = 'day'

  // ── Manager 實例 ──
  private agentMgr: AgentManager
  private subagentMgr: SubagentManager
  private bubbleMgr: BubbleEmoteManager

  constructor(layout?: OfficeLayout) {
    this.layout = layout || createDefaultLayout()
    this.tileMap = layoutToTileMap(this.layout)
    this.seats = layoutToSeats(this.layout.furniture)
    this.rebuildSeatTileIndex()
    this.blockedTiles = getBlockedTiles(this.layout.furniture)
    this.furniture = layoutToFurnitureInstances(this.layout.furniture)
    this.walkableTiles = getWalkableTiles(this.tileMap, this.blockedTiles)

    // 初始化 Managers — 傳入 this 作為共享狀態
    this.agentMgr = new AgentManager(this)
    this.subagentMgr = new SubagentManager(this)
    this.bubbleMgr = new BubbleEmoteManager(this)
  }

  // ── 委派至 AgentManager ──
  addAgent(id: number, preferredPalette?: number, preferredHueShift?: number, preferredSeatId?: string, skipSpawnEffect?: boolean): void {
    this.agentMgr.addAgent(id, preferredPalette, preferredHueShift, preferredSeatId, skipSpawnEffect)
  }
  addAgentAtPosition(id: number, col: number, row: number): void {
    this.agentMgr.addAgentAtPosition(id, col, row)
  }
  removeAgent(id: number): void {
    this.agentMgr.removeAgent(id)
  }
  setAgentRemote(id: number, remote: boolean): void {
    this.agentMgr.setAgentRemote(id, remote)
  }
  setAgentTeam(id: number, teamName: string | null, teamColor: string | null): void {
    this.agentMgr.setAgentTeam(id, teamName, teamColor)
  }
  setAgentDetached(id: number, detached: boolean): void {
    this.agentMgr.setAgentDetached(id, detached)
  }
  setAgentActive(id: number, active: boolean): void {
    this.agentMgr.setAgentActive(id, active)
  }
  setAgentTool(id: number, tool: string | null): void {
    this.agentMgr.setAgentTool(id, tool)
  }
  setAgentThinking(id: number, thinking: boolean): void {
    this.agentMgr.setAgentThinking(id, thinking)
  }

  // ── 委派至 SubagentManager ──
  addSubagent(parentAgentId: number, parentToolId: string): number {
    return this.subagentMgr.addSubagent(parentAgentId, parentToolId)
  }
  removeSubagent(parentAgentId: number, parentToolId: string): void {
    this.subagentMgr.removeSubagent(parentAgentId, parentToolId)
  }
  removeAllSubagents(parentAgentId: number): void {
    this.subagentMgr.removeAllSubagents(parentAgentId)
  }
  getSubagentId(parentAgentId: number, parentToolId: string): number | null {
    return this.subagentMgr.getSubagentId(parentAgentId, parentToolId)
  }
  get subagentIdMap(): Map<string, number> {
    return this.subagentMgr.subagentIdMap
  }
  get subagentMeta(): Map<number, { parentAgentId: number; parentToolId: string }> {
    return this.subagentMgr.subagentMeta
  }

  // ── 委派至 BubbleEmoteManager ──
  showPermissionBubble(id: number): void {
    this.bubbleMgr.showPermissionBubble(id)
  }
  clearPermissionBubble(id: number): void {
    this.bubbleMgr.clearPermissionBubble(id)
  }
  showWaitingBubble(id: number): void {
    this.bubbleMgr.showWaitingBubble(id)
  }
  dismissBubble(id: number): void {
    this.bubbleMgr.dismissBubble(id)
  }
  showEmote(id: number, emote: EmoteType): void {
    this.bubbleMgr.showEmote(id, emote)
  }

  // ── 協調方法 ──

  /** 清除所有代理和子代理（樓層切換時使用） */
  clearAllAgents(): void {
    this.agentMgr.clearAllAgents()
    this.subagentMgr.clear()
  }

  // ── 佈局管理（保留在 OfficeState） ──

  /** 重建 seatTileIndex（"col,row" → seatUid） */
  private rebuildSeatTileIndex(): void {
    this.seatTileIndex.clear()
    for (const [uid, seat] of this.seats) {
      this.seatTileIndex.set(`${seat.seatCol},${seat.seatRow}`, uid)
    }
  }

  /** 從新佈局重建所有衍生狀態。重新分配現有角色。 */
  rebuildFromLayout(layout: OfficeLayout, shift?: { col: number; row: number }): void {
    this.layout = layout
    this.layoutVersion++
    this.tileMap = layoutToTileMap(layout)
    this.seats = layoutToSeats(layout.furniture)
    this.rebuildSeatTileIndex()
    this.blockedTiles = getBlockedTiles(layout.furniture)
    this.rebuildFurnitureInstances()
    this.walkableTiles = getWalkableTiles(this.tileMap, this.blockedTiles)

    // 當網格向左/上擴展時移動角色位置
    if (shift && (shift.col !== 0 || shift.row !== 0)) {
      for (const ch of this.characters.values()) {
        ch.tileCol += shift.col
        ch.tileRow += shift.row
        ch.x += shift.col * TILE_SIZE
        ch.y += shift.row * TILE_SIZE
        ch.path = []
        ch.moveProgress = 0
      }
    }

    // 重新分配角色至新座位，盡可能保留現有的分配
    for (const seat of this.seats.values()) {
      seat.assigned = false
    }

    // 第一輪：嘗試保留角色在現有座位
    for (const ch of this.characters.values()) {
      if (ch.seatId && this.seats.has(ch.seatId)) {
        const seat = this.seats.get(ch.seatId)!
        if (!seat.assigned) {
          seat.assigned = true
          ch.tileCol = seat.seatCol
          ch.tileRow = seat.seatRow
          const cx = seat.seatCol * TILE_SIZE + TILE_SIZE / 2
          const cy = seat.seatRow * TILE_SIZE + TILE_SIZE / 2
          ch.x = cx
          ch.y = cy
          ch.dir = seat.facingDir
          continue
        }
      }
      ch.seatId = null
    }

    // 第二輪：將剩餘角色分配至空閒座位
    for (const ch of this.characters.values()) {
      if (ch.seatId) continue
      const seatId = this.agentMgr.findFreeSeat()
      if (seatId) {
        this.seats.get(seatId)!.assigned = true
        ch.seatId = seatId
        const seat = this.seats.get(seatId)!
        ch.tileCol = seat.seatCol
        ch.tileRow = seat.seatRow
        ch.x = seat.seatCol * TILE_SIZE + TILE_SIZE / 2
        ch.y = seat.seatRow * TILE_SIZE + TILE_SIZE / 2
        ch.dir = seat.facingDir
      }
    }

    // 重新定位超出邊界或在不可行走格上的角色
    for (const ch of this.characters.values()) {
      if (ch.seatId) continue
      if (ch.tileCol < 0 || ch.tileCol >= layout.cols || ch.tileRow < 0 || ch.tileRow >= layout.rows) {
        this.relocateCharacterToWalkable(ch)
      }
    }
  }

  /** 將角色移動到隨機的可行走格 */
  private relocateCharacterToWalkable(ch: Character): void {
    if (this.walkableTiles.length === 0) return
    const spawn = this.walkableTiles[Math.floor(Math.random() * this.walkableTiles.length)]
    ch.tileCol = spawn.col
    ch.tileRow = spawn.row
    ch.x = spawn.col * TILE_SIZE + TILE_SIZE / 2
    ch.y = spawn.row * TILE_SIZE + TILE_SIZE / 2
    ch.path = []
    ch.moveProgress = 0
  }

  getLayout(): OfficeLayout {
    return this.layout
  }

  // ── 路徑/座位工具（保留在 OfficeState） ──

  /** 取得角色自身座位的封鎖格鍵值，若無則回傳 null */
  private ownSeatKey(ch: Character): string | null {
    if (!ch.seatId) return null
    const seat = this.seats.get(ch.seatId)
    if (!seat) return null
    return `${seat.seatCol},${seat.seatRow}`
  }

  /** 暫時解除角色自身座位的封鎖，執行函式，然後重新封鎖 */
  private withOwnSeatUnblocked<T>(ch: Character, fn: () => T): T {
    const key = this.ownSeatKey(ch)
    if (key) this.blockedTiles.delete(key)
    const result = fn()
    if (key) this.blockedTiles.add(key)
    return result
  }

  /** 在指定格位置找到座位 uid，若無則回傳 null */
  getSeatAtTile(col: number, row: number): string | null {
    return this.seatTileIndex.get(`${col},${row}`) ?? null
  }

  /** 將代理從當前座位重新分配至新座位 */
  reassignSeat(agentId: number, seatId: string): void {
    const ch = this.characters.get(agentId)
    if (!ch) return
    if (ch.seatId) {
      const old = this.seats.get(ch.seatId)
      if (old) old.assigned = false
    }
    const seat = this.seats.get(seatId)
    if (!seat || seat.assigned) return
    seat.assigned = true
    ch.seatId = seatId
    const path = this.withOwnSeatUnblocked(ch, () =>
      findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, this.tileMap, this.blockedTiles)
    )
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
      if (!ch.isActive) {
        ch.seatTimer = INACTIVE_SEAT_TIMER_MIN_SEC + Math.random() * INACTIVE_SEAT_TIMER_RANGE_SEC
      }
    }
  }

  /** 將代理送回其當前分配的座位 */
  sendToSeat(agentId: number): void {
    const ch = this.characters.get(agentId)
    if (!ch || !ch.seatId) return
    const seat = this.seats.get(ch.seatId)
    if (!seat) return
    const path = this.withOwnSeatUnblocked(ch, () =>
      findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, this.tileMap, this.blockedTiles)
    )
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
      if (!ch.isActive) {
        ch.seatTimer = INACTIVE_SEAT_TIMER_MIN_SEC + Math.random() * INACTIVE_SEAT_TIMER_RANGE_SEC
      }
    }
  }

  /** 將代理步行至任意可行走格（右鍵指令） */
  walkToTile(agentId: number, col: number, row: number): boolean {
    const ch = this.characters.get(agentId)
    if (!ch || ch.isSubagent) return false
    if (!isWalkable(col, row, this.tileMap, this.blockedTiles)) {
      const key = this.ownSeatKey(ch)
      if (!key || key !== `${col},${row}`) return false
    }
    const path = this.withOwnSeatUnblocked(ch, () =>
      findPath(ch.tileCol, ch.tileRow, col, row, this.tileMap, this.blockedTiles)
    )
    if (path.length === 0) return false
    ch.path = path
    ch.moveProgress = 0
    ch.state = CharacterState.WALK
    ch.frame = 0
    ch.frameTimer = 0
    return true
  }

  // ── 家具重建（供 AgentManagerShared 介面） ──

  scheduleFurnitureRebuild(): void {
    if (this.furnitureRebuildScheduled) return
    this.furnitureRebuildScheduled = true
    queueMicrotask(() => {
      this.furnitureRebuildScheduled = false
      this.rebuildFurnitureInstances()
    })
  }

  /** 重建家具實例並套用自動狀態（活躍代理將電子設備切換為 ON） */
  private rebuildFurnitureInstances(): void {
    const autoOnTiles = new Set<string>()
    for (const ch of this.characters.values()) {
      if (!ch.isActive || !ch.seatId) continue
      const seat = this.seats.get(ch.seatId)
      if (!seat) continue
      const dCol = seat.facingDir === Direction.RIGHT ? 1 : seat.facingDir === Direction.LEFT ? -1 : 0
      const dRow = seat.facingDir === Direction.DOWN ? 1 : seat.facingDir === Direction.UP ? -1 : 0
      for (let d = 1; d <= AUTO_ON_FACING_DEPTH; d++) {
        const tileCol = seat.seatCol + dCol * d
        const tileRow = seat.seatRow + dRow * d
        autoOnTiles.add(`${tileCol},${tileRow}`)
      }
      for (let d = 1; d <= AUTO_ON_SIDE_DEPTH; d++) {
        const baseCol = seat.seatCol + dCol * d
        const baseRow = seat.seatRow + dRow * d
        if (dCol !== 0) {
          autoOnTiles.add(`${baseCol},${baseRow - 1}`)
          autoOnTiles.add(`${baseCol},${baseRow + 1}`)
        } else {
          autoOnTiles.add(`${baseCol - 1},${baseRow}`)
          autoOnTiles.add(`${baseCol + 1},${baseRow}`)
        }
      }
    }

    // 夜間：所有 LAMP 類家具自動亮起
    const lampsOn = this.dayPhase === 'dusk' || this.dayPhase === 'night'
    if (lampsOn) {
      for (const item of this.layout.furniture) {
        const entry = getCatalogEntry(item.type)
        if (!entry) continue
        if (item.type.toLowerCase().includes('lamp')) {
          for (let dr = 0; dr < entry.footprintH; dr++) {
            for (let dc = 0; dc < entry.footprintW; dc++) {
              autoOnTiles.add(`${item.col + dc},${item.row + dr}`)
            }
          }
        }
      }
    }

    if (autoOnTiles.size === 0) {
      this.furniture = layoutToFurnitureInstances(this.layout.furniture)
      return
    }

    const modifiedFurniture: PlacedFurniture[] = this.layout.furniture.map((item) => {
      const entry = getCatalogEntry(item.type)
      if (!entry) return item
      for (let dr = 0; dr < entry.footprintH; dr++) {
        for (let dc = 0; dc < entry.footprintW; dc++) {
          if (autoOnTiles.has(`${item.col + dc},${item.row + dr}`)) {
            const onType = getOnStateType(item.type)
            if (onType !== item.type) {
              return { ...item, type: onType }
            }
            return item
          }
        }
      }
      return item
    })

    this.furniture = layoutToFurnitureInstances(modifiedFurniture)
  }

  // ── 日夜/電梯 ──

  /** 建構家具位置查找表（"col,row" → 家具資訊） */
  private buildFurnitureMap(): Map<string, { col: number; row: number; type: string }> {
    const map = new Map<string, { col: number; row: number; type: string }>()
    for (const item of this.layout.furniture) {
      const entry = getCatalogEntry(item.type)
      const w = entry ? entry.footprintW : 1
      const h = entry ? entry.footprintH : 1
      for (let dr = 0; dr < h; dr++) {
        for (let dc = 0; dc < w; dc++) {
          map.set(`${item.col + dc},${item.row + dr}`, { col: item.col + dc, row: item.row + dr, type: item.type })
        }
      }
    }
    return map
  }

  /** 更新日夜階段並在變化時重建家具 */
  setDayPhase(phase: DayPhase): void {
    this.dayPhase = phase
    if (phase !== this.prevDayPhase) {
      this.prevDayPhase = phase
      this.scheduleFurnitureRebuild()
    }
  }

  /** 掃描佈局中的電梯家具，回傳第一個找到的位置 */
  findElevatorPosition(): { col: number; row: number } | null {
    for (const item of this.layout.furniture) {
      if (item.type.toLowerCase().includes('elevator') || item.type.toLowerCase().includes('door')) {
        return { col: item.col, row: item.row }
      }
    }
    return null
  }

  /** 觸發代理的跨樓層轉移動畫 */
  startFloorTransfer(agentId: number): void {
    const ch = this.characters.get(agentId)
    if (!ch) return
    const elevatorPos = this.findElevatorPosition()
    if (elevatorPos) {
      const path = this.withOwnSeatUnblocked(ch, () =>
        findPath(ch.tileCol, ch.tileRow, elevatorPos.col, elevatorPos.row, this.tileMap, this.blockedTiles)
      )
      if (path.length > 0) {
        ch.state = CharacterState.ENTER_ELEVATOR
        ch.transferTargetFloor = 'transferring'
        ch.path = path
        ch.moveProgress = 0
        ch.frame = 0
        ch.frameTimer = 0
        return
      }
    }
    this.removeAgent(agentId)
  }

  // ── 遊戲循環 ──

  update(dt: number): void {
    const furnitureMap = this.buildFurnitureMap()
    const furnitureUidMap = new Map<string, string>()
    for (const item of this.layout.furniture) {
      const entry = getCatalogEntry(item.type)
      const w = entry ? entry.footprintW : 1
      const h = entry ? entry.footprintH : 1
      for (let dr = 0; dr < h; dr++) {
        for (let dc = 0; dc < w; dc++) {
          furnitureUidMap.set(`${item.col + dc},${item.row + dr}`, item.uid)
        }
      }
    }
    const ctx: UpdateContext = {
      walkableTiles: this.walkableTiles,
      seats: this.seats,
      tileMap: this.tileMap,
      blockedTiles: this.blockedTiles,
      allCharacters: this.characters,
      furnitureMap,
      furnitureUidMap,
    }

    const toDelete: number[] = []
    for (const ch of this.characters.values()) {
      // 處理 Matrix 特效動畫
      if (ch.matrixEffect) {
        ch.matrixEffectTimer += dt
        if (ch.matrixEffectTimer >= MATRIX_EFFECT_DURATION) {
          if (ch.matrixEffect === 'spawn') {
            ch.matrixEffect = null
            ch.matrixEffectTimer = 0
            ch.matrixEffectSeeds = []
          } else {
            toDelete.push(ch.id)
          }
        }
        continue
      }

      this.withOwnSeatUnblocked(ch, () =>
        updateCharacter(ch, dt, ctx)
      )

      // 遞減表情計時器
      if (ch.emoteType && ch.emoteTimer > 0) {
        ch.emoteTimer -= dt
        if (ch.emoteTimer <= 0) {
          ch.emoteType = null
          ch.emoteTimer = 0
        }
      }

      // 遞減等待氣泡的計時器（不含權限/斷線氣泡）
      if (ch.bubbleType === 'waiting') {
        ch.bubbleTimer -= dt
        if (ch.bubbleTimer <= 0) {
          ch.bubbleType = null
          ch.bubbleTimer = 0
        }
      }
    }
    for (const id of toDelete) {
      this.characters.delete(id)
    }
  }

  // ── 查詢 ──

  getCharacters(): Character[] {
    return Array.from(this.characters.values())
  }

  /** 取得指定像素位置的角色（用於點擊測試） */
  getCharacterAt(worldX: number, worldY: number): number | null {
    let bestId: number | null = null
    let bestY = -Infinity
    for (const ch of this.characters.values()) {
      if (ch.matrixEffect === 'despawn') continue
      const sittingOffset = isSittingState(ch.state) ? CHARACTER_SITTING_OFFSET_PX : 0
      const anchorY = ch.y + sittingOffset
      const left = ch.x - CHARACTER_HIT_HALF_WIDTH
      const right = ch.x + CHARACTER_HIT_HALF_WIDTH
      const top = anchorY - CHARACTER_HIT_HEIGHT
      const bottom = anchorY
      if (worldX >= left && worldX <= right && worldY >= top && worldY <= bottom) {
        if (ch.y > bestY) {
          bestY = ch.y
          bestId = ch.id
        }
      }
    }
    return bestId
  }
}
