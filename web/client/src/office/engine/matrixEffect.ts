import type { Character, SpriteData } from '../types.js'
import { MATRIX_EFFECT_DURATION } from '../types.js'
import {
  MATRIX_TRAIL_LENGTH,
  MATRIX_SPRITE_COLS,
  MATRIX_SPRITE_ROWS,
  MATRIX_FLICKER_FPS,
  MATRIX_FLICKER_VISIBILITY_THRESHOLD,
  MATRIX_COLUMN_STAGGER_RANGE,
  MATRIX_HEAD_COLOR,
  MATRIX_TRAIL_OVERLAY_ALPHA,
  MATRIX_TRAIL_EMPTY_ALPHA,
  MATRIX_TRAIL_MID_THRESHOLD,
  MATRIX_TRAIL_DIM_THRESHOLD,
} from '../../constants.js'

/** 基於雜湊的閃爍：~70% 可見以產生微光效果 */
function flickerVisible(col: number, row: number, time: number): boolean {
  const t = Math.floor(time * MATRIX_FLICKER_FPS)
  const hash = ((col * 7 + row * 13 + t * 31) & 0xff)
  return hash < MATRIX_FLICKER_VISIBILITY_THRESHOLD
}

function generateSeeds(): number[] {
  const seeds: number[] = []
  for (let i = 0; i < MATRIX_SPRITE_COLS; i++) {
    seeds.push(Math.random())
  }
  return seeds
}

export { generateSeeds as matrixEffectSeeds }

/**
 * 以 Matrix 風格數位雨生成/消散特效渲染角色。
 * 逐像素渲染：每欄從上到下掃過，帶有明亮的頭部和漸隱的綠色拖尾。
 */
export function renderMatrixEffect(
  ctx: CanvasRenderingContext2D,
  ch: Character,
  spriteData: SpriteData,
  drawX: number,
  drawY: number,
  zoom: number,
): void {
  const progress = ch.matrixEffectTimer / MATRIX_EFFECT_DURATION
  const isSpawn = ch.matrixEffect === 'spawn'
  const time = ch.matrixEffectTimer
  const totalSweep = MATRIX_SPRITE_ROWS + MATRIX_TRAIL_LENGTH

  for (let col = 0; col < MATRIX_SPRITE_COLS; col++) {
    // 交錯：每欄在略微不同的時間開始
    const stagger = (ch.matrixEffectSeeds[col] ?? 0) * MATRIX_COLUMN_STAGGER_RANGE
    const colProgress = Math.max(0, Math.min(1, (progress - stagger) / (1 - MATRIX_COLUMN_STAGGER_RANGE)))
    const headRow = colProgress * totalSweep

    for (let row = 0; row < MATRIX_SPRITE_ROWS; row++) {
      const pixel = spriteData[row]?.[col]
      const hasPixel = pixel && pixel !== ''
      const distFromHead = headRow - row
      const px = drawX + col * zoom
      const py = drawY + row * zoom

      if (isSpawn) {
        // 生成：頭部向下掃過，顯現角色像素
        if (distFromHead < 0) {
          // 頭部上方：不可見
          continue
        } else if (distFromHead < 1) {
          // 頭部像素：明亮的白綠色
          ctx.fillStyle = MATRIX_HEAD_COLOR
          ctx.fillRect(px, py, zoom, zoom)
        } else if (distFromHead < MATRIX_TRAIL_LENGTH) {
          // 拖尾區域：顯示帶綠色覆蓋的角色像素，或無像素時僅顯示綠色
          const trailPos = distFromHead / MATRIX_TRAIL_LENGTH
          if (hasPixel) {
            // 繪製原始像素
            ctx.fillStyle = pixel
            ctx.fillRect(px, py, zoom, zoom)
            // 隨拖尾進展而淡出的綠色覆蓋層
            const greenAlpha = (1 - trailPos) * MATRIX_TRAIL_OVERLAY_ALPHA
            if (flickerVisible(col, row, time)) {
              ctx.fillStyle = `rgba(0, 255, 65, ${greenAlpha})`
              ctx.fillRect(px, py, zoom, zoom)
            }
          } else {
            // 無角色像素：漸隱的綠色拖尾
            if (flickerVisible(col, row, time)) {
              const alpha = (1 - trailPos) * MATRIX_TRAIL_EMPTY_ALPHA
              ctx.fillStyle = trailPos < MATRIX_TRAIL_MID_THRESHOLD ? `rgba(0, 255, 65, ${alpha})`
                : trailPos < MATRIX_TRAIL_DIM_THRESHOLD ? `rgba(0, 170, 40, ${alpha})`
                  : `rgba(0, 85, 20, ${alpha})`
              ctx.fillRect(px, py, zoom, zoom)
            }
          }
        } else {
          // 拖尾下方：正常角色像素
          if (hasPixel) {
            ctx.fillStyle = pixel
            ctx.fillRect(px, py, zoom, zoom)
          }
        }
      } else {
        // 消散：頭部向下掃過，吞噬角色像素
        if (distFromHead < 0) {
          // 頭部上方：正常角色像素（尚未被吞噬）
          if (hasPixel) {
            ctx.fillStyle = pixel
            ctx.fillRect(px, py, zoom, zoom)
          }
        } else if (distFromHead < 1) {
          // 頭部像素：明亮的白綠色
          ctx.fillStyle = MATRIX_HEAD_COLOR
          ctx.fillRect(px, py, zoom, zoom)
        } else if (distFromHead < MATRIX_TRAIL_LENGTH) {
          // 拖尾區域：漸隱的綠色
          if (flickerVisible(col, row, time)) {
            const trailPos = distFromHead / MATRIX_TRAIL_LENGTH
            const alpha = (1 - trailPos) * MATRIX_TRAIL_EMPTY_ALPHA
            ctx.fillStyle = trailPos < MATRIX_TRAIL_MID_THRESHOLD ? `rgba(0, 255, 65, ${alpha})`
              : trailPos < MATRIX_TRAIL_DIM_THRESHOLD ? `rgba(0, 170, 40, ${alpha})`
                : `rgba(0, 85, 20, ${alpha})`
            ctx.fillRect(px, py, zoom, zoom)
          }
        }
        // 拖尾下方：空（已被吞噬）
      }
    }
  }
}
