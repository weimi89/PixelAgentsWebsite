import { TILE_SIZE } from '../types.js'
import type { Character, Seat } from '../types.js'
import {
  PALETTE_COUNT,
  HUE_SHIFT_MIN_DEG,
  HUE_SHIFT_RANGE_DEG,
} from '../../constants.js'
import { createCharacter } from './characters.js'
import { matrixEffectSeeds } from './matrixEffect.js'

export interface AgentManagerShared {
  characters: Map<number, Character>
  seats: Map<string, Seat>
  walkableTiles: Array<{ col: number; row: number }>
  selectedAgentId: number | null
  cameraFollowId: number | null
  scheduleFurnitureRebuild(): void
}

/**
 * 代理生命週期管理器 — 建立、移除、狀態設定、調色盤分配。
 */
export class AgentManager {
  private shared: AgentManagerShared
  constructor(shared: AgentManagerShared) {
    this.shared = shared
  }

  /**
   * 根據當前活躍代理為新代理選擇多元調色盤。
   * 前 6 個代理各獲得唯一外觀（隨機順序）。超過 6 個後，
   * 外觀以均衡輪次重複並套用隨機色相偏移（>=45 deg）。
   */
  pickDiversePalette(): { palette: number; hueShift: number } {
    const counts = new Array(PALETTE_COUNT).fill(0) as number[]
    for (const ch of this.shared.characters.values()) {
      if (ch.isSubagent) continue
      counts[ch.palette]++
    }
    const minCount = Math.min(...counts)
    const available: number[] = []
    for (let i = 0; i < PALETTE_COUNT; i++) {
      if (counts[i] === minCount) available.push(i)
    }
    const palette = available[Math.floor(Math.random() * available.length)]
    let hueShift = 0
    if (minCount > 0) {
      hueShift = HUE_SHIFT_MIN_DEG + Math.floor(Math.random() * HUE_SHIFT_RANGE_DEG)
    }
    return { palette, hueShift }
  }

  findFreeSeat(): string | null {
    for (const [uid, seat] of this.shared.seats) {
      if (!seat.assigned) return uid
    }
    return null
  }

  addAgent(id: number, preferredPalette?: number, preferredHueShift?: number, preferredSeatId?: string, skipSpawnEffect?: boolean): void {
    if (this.shared.characters.has(id)) return

    let palette: number
    let hueShift: number
    if (preferredPalette !== undefined) {
      palette = preferredPalette
      hueShift = preferredHueShift ?? 0
    } else {
      const pick = this.pickDiversePalette()
      palette = pick.palette
      hueShift = pick.hueShift
    }

    // 先嘗試偏好座位，再嘗試任何空閒座位
    let seatId: string | null = null
    if (preferredSeatId && this.shared.seats.has(preferredSeatId)) {
      const seat = this.shared.seats.get(preferredSeatId)!
      if (!seat.assigned) {
        seatId = preferredSeatId
      }
    }
    if (!seatId) {
      seatId = this.findFreeSeat()
    }

    let ch: Character
    if (seatId) {
      const seat = this.shared.seats.get(seatId)!
      seat.assigned = true
      ch = createCharacter(id, palette, seatId, seat, hueShift)
    } else {
      // 沒有座位 — 在隨機可行走格生成
      const spawn = this.shared.walkableTiles.length > 0
        ? this.shared.walkableTiles[Math.floor(Math.random() * this.shared.walkableTiles.length)]
        : { col: 1, row: 1 }
      ch = createCharacter(id, palette, null, null, hueShift)
      ch.x = spawn.col * TILE_SIZE + TILE_SIZE / 2
      ch.y = spawn.row * TILE_SIZE + TILE_SIZE / 2
      ch.tileCol = spawn.col
      ch.tileRow = spawn.row
    }

    if (!skipSpawnEffect) {
      ch.matrixEffect = 'spawn'
      ch.matrixEffectTimer = 0
      ch.matrixEffectSeeds = matrixEffectSeeds()
    }
    this.shared.characters.set(id, ch)
  }

  /** 在指定位置生成代理（用於電梯到達） */
  addAgentAtPosition(id: number, col: number, row: number): void {
    if (this.shared.characters.has(id)) return
    const pick = this.pickDiversePalette()
    const seatId = this.findFreeSeat()
    const ch = createCharacter(id, pick.palette, seatId, seatId ? this.shared.seats.get(seatId)! : null, pick.hueShift)
    if (seatId) {
      const seat = this.shared.seats.get(seatId)!
      seat.assigned = true
    }
    // 覆蓋位置至指定格
    ch.x = col * TILE_SIZE + TILE_SIZE / 2
    ch.y = row * TILE_SIZE + TILE_SIZE / 2
    ch.tileCol = col
    ch.tileRow = row
    ch.matrixEffect = 'spawn'
    ch.matrixEffectTimer = 0
    ch.matrixEffectSeeds = matrixEffectSeeds()
    this.shared.characters.set(id, ch)
  }

  removeAgent(id: number): void {
    const ch = this.shared.characters.get(id)
    if (!ch) return
    if (ch.matrixEffect === 'despawn') return // 已在消散中
    // 立即釋放座位並清除選取
    if (ch.seatId) {
      const seat = this.shared.seats.get(ch.seatId)
      if (seat) seat.assigned = false
    }
    if (this.shared.selectedAgentId === id) this.shared.selectedAgentId = null
    if (this.shared.cameraFollowId === id) this.shared.cameraFollowId = null
    // 啟動消散動畫而非立即刪除
    ch.matrixEffect = 'despawn'
    ch.matrixEffectTimer = 0
    ch.matrixEffectSeeds = matrixEffectSeeds()
    ch.bubbleType = null
  }

  /** 清除所有代理（characters + seats + selection） */
  clearAllAgents(): void {
    this.shared.characters.clear()
    this.shared.selectedAgentId = null
    this.shared.cameraFollowId = null
    for (const seat of this.shared.seats.values()) {
      seat.assigned = false
    }
  }

  setAgentRemote(id: number, remote: boolean): void {
    const ch = this.shared.characters.get(id)
    if (ch) ch.isRemote = remote
  }

  setAgentTeam(id: number, teamName: string | null, teamColor: string | null): void {
    const ch = this.shared.characters.get(id)
    if (ch) {
      ch.teamName = teamName
      ch.teamColor = teamColor
    }
  }

  setAgentDetached(id: number, detached: boolean): void {
    const ch = this.shared.characters.get(id)
    if (ch) {
      ch.isDetached = detached
      if (detached) {
        ch.bubbleType = 'detached'
        ch.bubbleTimer = 0
      } else if (ch.bubbleType === 'detached') {
        ch.bubbleType = null
        ch.bubbleTimer = 0
      }
    }
  }

  setAgentActive(id: number, active: boolean): void {
    const ch = this.shared.characters.get(id)
    if (ch) {
      ch.isActive = active
      if (!active) {
        // 哨兵值 -1：表示回合剛結束，跳過下一次座位休息計時器
        ch.seatTimer = -1
        ch.path = []
        ch.moveProgress = 0
      }
      this.shared.scheduleFurnitureRebuild()
    }
  }

  setAgentTool(id: number, tool: string | null): void {
    const ch = this.shared.characters.get(id)
    if (ch) {
      ch.currentTool = tool
    }
  }

  setAgentThinking(id: number, thinking: boolean): void {
    const ch = this.shared.characters.get(id)
    if (ch) {
      ch.isThinking = thinking
    }
  }
}
