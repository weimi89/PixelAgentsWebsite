import { TILE_SIZE } from '../types.js'
import type { Character, Seat } from '../types.js'
import { createCharacter } from './characters.js'
import { matrixEffectSeeds } from './matrixEffect.js'

export interface SubagentShared {
  characters: Map<number, Character>
  seats: Map<string, Seat>
  walkableTiles: Array<{ col: number; row: number }>
  selectedAgentId: number | null
  cameraFollowId: number | null
}

/**
 * 子代理管理器 — 管理子代理的建立、移除和追蹤。
 */
export class SubagentManager {
  /** 映射 "parentId:toolId" → 子代理角色 ID（負數） */
  subagentIdMap: Map<string, number> = new Map()
  /** 反向查找：子代理角色 ID → 父代理資訊 */
  subagentMeta: Map<number, { parentAgentId: number; parentToolId: string }> = new Map()
  private nextSubagentId = -1
  private shared: SubagentShared

  constructor(shared: SubagentShared) {
    this.shared = shared
  }

  /** 建立具有父代理調色盤的子代理角色。回傳子代理 ID。 */
  addSubagent(parentAgentId: number, parentToolId: string): number {
    const key = `${parentAgentId}:${parentToolId}`
    if (this.subagentIdMap.has(key)) return this.subagentIdMap.get(key)!

    const id = this.nextSubagentId--
    const parentCh = this.shared.characters.get(parentAgentId)
    const palette = parentCh ? parentCh.palette : 0
    const hueShift = parentCh ? parentCh.hueShift : 0

    // 找到最接近父代理的空閒座位
    const parentCol = parentCh ? parentCh.tileCol : 0
    const parentRow = parentCh ? parentCh.tileRow : 0
    const dist = (c: number, r: number) =>
      Math.abs(c - parentCol) + Math.abs(r - parentRow)

    let bestSeatId: string | null = null
    let bestDist = Infinity
    for (const [uid, seat] of this.shared.seats) {
      if (!seat.assigned) {
        const d = dist(seat.seatCol, seat.seatRow)
        if (d < bestDist) {
          bestDist = d
          bestSeatId = uid
        }
      }
    }

    let ch: Character
    if (bestSeatId) {
      const seat = this.shared.seats.get(bestSeatId)!
      seat.assigned = true
      ch = createCharacter(id, palette, bestSeatId, seat, hueShift)
    } else {
      // 沒有座位 — 在最接近父代理的可行走格生成
      let spawn = { col: 1, row: 1 }
      if (this.shared.walkableTiles.length > 0) {
        let closest = this.shared.walkableTiles[0]
        let closestDist = dist(closest.col, closest.row)
        for (let i = 1; i < this.shared.walkableTiles.length; i++) {
          const d = dist(this.shared.walkableTiles[i].col, this.shared.walkableTiles[i].row)
          if (d < closestDist) {
            closest = this.shared.walkableTiles[i]
            closestDist = d
          }
        }
        spawn = closest
      }
      ch = createCharacter(id, palette, null, null, hueShift)
      ch.x = spawn.col * TILE_SIZE + TILE_SIZE / 2
      ch.y = spawn.row * TILE_SIZE + TILE_SIZE / 2
      ch.tileCol = spawn.col
      ch.tileRow = spawn.row
    }
    ch.isSubagent = true
    ch.parentAgentId = parentAgentId
    ch.matrixEffect = 'spawn'
    ch.matrixEffectTimer = 0
    ch.matrixEffectSeeds = matrixEffectSeeds()
    this.shared.characters.set(id, ch)

    this.subagentIdMap.set(key, id)
    this.subagentMeta.set(id, { parentAgentId, parentToolId })
    return id
  }

  /** 移除特定子代理角色並釋放其座位 */
  removeSubagent(parentAgentId: number, parentToolId: string): void {
    const key = `${parentAgentId}:${parentToolId}`
    const id = this.subagentIdMap.get(key)
    if (id === undefined) return

    const ch = this.shared.characters.get(id)
    if (ch) {
      if (ch.matrixEffect === 'despawn') {
        this.subagentIdMap.delete(key)
        this.subagentMeta.delete(id)
        return
      }
      if (ch.seatId) {
        const seat = this.shared.seats.get(ch.seatId)
        if (seat) seat.assigned = false
      }
      // 啟動消散動畫 — 保留角色在映射中供渲染使用
      ch.matrixEffect = 'despawn'
      ch.matrixEffectTimer = 0
      ch.matrixEffectSeeds = matrixEffectSeeds()
      ch.bubbleType = null
    }
    // 立即清理追蹤映射以避免鍵值衝突
    this.subagentIdMap.delete(key)
    this.subagentMeta.delete(id)
    if (this.shared.selectedAgentId === id) this.shared.selectedAgentId = null
    if (this.shared.cameraFollowId === id) this.shared.cameraFollowId = null
  }

  /** 移除屬於某父代理的所有子代理 */
  removeAllSubagents(parentAgentId: number): void {
    const toRemove: string[] = []
    for (const [key, id] of this.subagentIdMap) {
      const meta = this.subagentMeta.get(id)
      if (meta && meta.parentAgentId === parentAgentId) {
        const ch = this.shared.characters.get(id)
        if (ch) {
          if (ch.matrixEffect === 'despawn') {
            this.subagentMeta.delete(id)
            toRemove.push(key)
            continue
          }
          if (ch.seatId) {
            const seat = this.shared.seats.get(ch.seatId)
            if (seat) seat.assigned = false
          }
          ch.matrixEffect = 'despawn'
          ch.matrixEffectTimer = 0
          ch.matrixEffectSeeds = matrixEffectSeeds()
          ch.bubbleType = null
        }
        this.subagentMeta.delete(id)
        if (this.shared.selectedAgentId === id) this.shared.selectedAgentId = null
        if (this.shared.cameraFollowId === id) this.shared.cameraFollowId = null
        toRemove.push(key)
      }
    }
    for (const key of toRemove) {
      this.subagentIdMap.delete(key)
    }
  }

  /** 查找指定 parent+toolId 的子代理角色 ID，若無則回傳 null */
  getSubagentId(parentAgentId: number, parentToolId: string): number | null {
    return this.subagentIdMap.get(`${parentAgentId}:${parentToolId}`) ?? null
  }

  /** 清除所有子代理追蹤資料 */
  clear(): void {
    this.subagentIdMap.clear()
    this.subagentMeta.clear()
    this.nextSubagentId = -1
  }
}
