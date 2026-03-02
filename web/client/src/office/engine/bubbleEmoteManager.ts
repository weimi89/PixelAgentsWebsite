import type { Character, EmoteType } from '../types.js'
import {
  WAITING_BUBBLE_DURATION_SEC,
  DISMISS_BUBBLE_FAST_FADE_SEC,
  EMOTE_DISPLAY_DURATION_SEC,
} from '../../constants.js'

export interface BubbleEmoteShared {
  characters: Map<number, Character>
}

/**
 * 氣泡與表情管理器 — 管理角色的對話氣泡和表情動畫。
 */
export class BubbleEmoteManager {
  private shared: BubbleEmoteShared
  constructor(shared: BubbleEmoteShared) {
    this.shared = shared
  }

  showPermissionBubble(id: number): void {
    const ch = this.shared.characters.get(id)
    if (ch) {
      ch.bubbleType = 'permission'
      ch.bubbleTimer = 0
    }
  }

  clearPermissionBubble(id: number): void {
    const ch = this.shared.characters.get(id)
    if (ch && ch.bubbleType === 'permission') {
      ch.bubbleType = null
      ch.bubbleTimer = 0
    }
  }

  showWaitingBubble(id: number): void {
    const ch = this.shared.characters.get(id)
    if (ch) {
      ch.bubbleType = 'waiting'
      ch.bubbleTimer = WAITING_BUBBLE_DURATION_SEC
    }
  }

  /** 點擊關閉氣泡 — 權限：立即消失，等待：快速淡出 */
  dismissBubble(id: number): void {
    const ch = this.shared.characters.get(id)
    if (!ch || !ch.bubbleType) return
    if (ch.bubbleType === 'permission') {
      ch.bubbleType = null
      ch.bubbleTimer = 0
    } else if (ch.bubbleType === 'waiting') {
      ch.bubbleTimer = Math.min(ch.bubbleTimer, DISMISS_BUBBLE_FAST_FADE_SEC)
    }
  }

  /** 在指定代理角色上顯示短暫表情（伺服器觸發） */
  showEmote(id: number, emote: EmoteType): void {
    const ch = this.shared.characters.get(id)
    if (!ch) return
    if (ch.emoteType && ch.emoteTimer > 1.0) return
    ch.emoteType = emote
    ch.emoteTimer = EMOTE_DISPLAY_DURATION_SEC
  }
}
