/**
 * 地板磚花紋儲存與快取。
 *
 * 儲存從 floors.png 載入的 7 種灰階地板花紋。
 * 使用共用 colorize 模組進行 HSL 著色（Photoshop 風格 Colorize）。
 * 以 (pattern, h, s, b, c) 為鍵快取著色後的 SpriteData。
 */

import type { SpriteData, FloorColor } from './types.js'
import { getColorizedSprite, clearColorizeCache } from './colorize.js'
import { TILE_SIZE, FALLBACK_FLOOR_COLOR } from '../constants.js'

/** 當 floors.png 未載入時使用的預設純灰色 16×16 磚塊 */
const DEFAULT_FLOOR_SPRITE: SpriteData = Array.from(
  { length: TILE_SIZE },
  () => Array(TILE_SIZE).fill(FALLBACK_FLOOR_COLOR) as string[],
)

/** 模組層級的地板磚精靈圖儲存（載入時設定一次） */
let floorSprites: SpriteData[] = []

/** 牆壁顏色常數 */
export const WALL_COLOR = '#3A3A5C'

/** 設定地板磚精靈圖（當擴充傳送 floorTilesLoaded 時呼叫一次） */
export function setFloorSprites(sprites: SpriteData[]): void {
  floorSprites = sprites
  clearColorizeCache()
}

/** 取得指定花紋索引的原始（灰階）地板精靈圖（1-7 -> 陣列索引 0-6）。
 *  當 floors.png 未載入時，回退至預設純灰色磚塊。 */
export function getFloorSprite(patternIndex: number): SpriteData | null {
  const idx = patternIndex - 1
  if (idx < 0) return null
  if (idx < floorSprites.length) return floorSprites[idx]
  // 無 PNG 精靈圖載入 — 對任何有效的花紋索引返回預設純色磚塊
  if (floorSprites.length === 0 && patternIndex >= 1) return DEFAULT_FLOOR_SPRITE
  return null
}

/** 檢查地板精靈圖是否可用（始終為 true — 回退至預設純色磚塊） */
export function hasFloorSprites(): boolean {
  return true
}

/** 取得可用地板花紋數量（至少 1，即預設純色磚塊） */
export function getFloorPatternCount(): number {
  return floorSprites.length > 0 ? floorSprites.length : 1
}

/** 取得所有地板精靈圖（用於預覽渲染，回退至預設純色磚塊） */
export function getAllFloorSprites(): SpriteData[] {
  return floorSprites.length > 0 ? floorSprites : [DEFAULT_FLOOR_SPRITE]
}

/**
 * 取得地板精靈圖的著色版本。
 * 使用 Photoshop 風格 Colorize：灰階 -> 以指定色相/飽和度建立 HSL，
 * 然後進行亮度/對比度調整。
 */
export function getColorizedFloorSprite(patternIndex: number, color: FloorColor): SpriteData {
  const key = `floor-${patternIndex}-${color.h}-${color.s}-${color.b}-${color.c}`

  const base = getFloorSprite(patternIndex)
  if (!base) {
    // 返回 16x16 洋紅色錯誤磚塊
    const err: SpriteData = Array.from({ length: 16 }, () => Array(16).fill('#FF00FF'))
    return err
  }

  // 地板磚一律使用著色模式（灰階花紋需要 Photoshop 風格 Colorize）
  return getColorizedSprite(key, base, { ...color, colorize: true })
}
