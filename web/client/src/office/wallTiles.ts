/**
 * 牆磚自動拼接：精靈圖儲存與位元遮罩選取。
 *
 * 儲存從 walls.png 載入的 16 個牆壁精靈圖（每個 4 位元位元遮罩對應一個）。
 * 渲染時，檢查每個牆磚的 4 個基本方向鄰居以建構位元遮罩，
 * 然後直接繪製對應的精靈圖。
 * 不修改佈局模型 — 自動拼接純粹為視覺效果。
 *
 * 位元遮罩慣例：N=1, E=2, S=4, W=8。超出邊界 = 非牆壁。
 */

import type { SpriteData, TileType as TileTypeVal, FloorColor, FurnitureInstance } from './types.js'
import { TileType, TILE_SIZE } from './types.js'
import { getColorizedSprite } from './colorize.js'

/** 以位元遮罩（0-15）索引的 16 個牆壁精靈圖 */
let wallSprites: SpriteData[] | null = null

/** 設定牆壁精靈圖（當擴充傳送 wallTilesLoaded 時呼叫一次） */
export function setWallSprites(sprites: SpriteData[]): void {
  wallSprites = sprites
}

/** 檢查牆壁精靈圖是否已載入 */
export function hasWallSprites(): boolean {
  return wallSprites !== null
}

/**
 * 根據基本方向鄰居取得牆磚的精靈圖。
 * 返回精靈圖 + Y 偏移，或 null 以回退至純色 WALL_COLOR。
 */
export function getWallSprite(
  col: number,
  row: number,
  tileMap: TileTypeVal[][],
): { sprite: SpriteData; offsetY: number } | null {
  if (!wallSprites) return null

  const tmRows = tileMap.length
  const tmCols = tmRows > 0 ? tileMap[0].length : 0

  // 建構 4 位元鄰居位元遮罩
  let mask = 0
  if (row > 0 && tileMap[row - 1][col] === TileType.WALL) mask |= 1            // 北
  if (col < tmCols - 1 && tileMap[row][col + 1] === TileType.WALL) mask |= 2   // 東
  if (row < tmRows - 1 && tileMap[row + 1][col] === TileType.WALL) mask |= 4   // 南
  if (col > 0 && tileMap[row][col - 1] === TileType.WALL) mask |= 8            // 西

  const sprite = wallSprites[mask]
  if (!sprite) return null

  // 將精靈圖錨定在磚塊底部 — 較高的精靈圖向上延伸
  return { sprite, offsetY: TILE_SIZE - sprite.length }
}

/**
 * 根據基本方向鄰居取得牆磚的著色精靈圖。
 * 使用 Colorize 模式（灰階 → HSL），如同地板磚。
 * 返回著色後的精靈圖 + Y 偏移，或 null（若無牆壁精靈圖載入）。
 */
export function getColorizedWallSprite(
  col: number,
  row: number,
  tileMap: TileTypeVal[][],
  color: FloorColor,
): { sprite: SpriteData; offsetY: number } | null {
  if (!wallSprites) return null

  const tmRows = tileMap.length
  const tmCols = tmRows > 0 ? tileMap[0].length : 0

  // 建構 4 位元鄰居位元遮罩（與 getWallSprite 相同）
  let mask = 0
  if (row > 0 && tileMap[row - 1][col] === TileType.WALL) mask |= 1            // 北
  if (col < tmCols - 1 && tileMap[row][col + 1] === TileType.WALL) mask |= 2   // 東
  if (row < tmRows - 1 && tileMap[row + 1][col] === TileType.WALL) mask |= 4   // 南
  if (col > 0 && tileMap[row][col - 1] === TileType.WALL) mask |= 8            // 西

  const sprite = wallSprites[mask]
  if (!sprite) return null

  const cacheKey = `wall-${mask}-${color.h}-${color.s}-${color.b}-${color.c}`
  const colorized = getColorizedSprite(cacheKey, sprite, { ...color, colorize: true })

  return { sprite: colorized, offsetY: TILE_SIZE - sprite.length }
}

/**
 * 為所有牆磚建構類似 FurnitureInstance 的物件，
 * 使其可參與家具和角色的 Z 排序。
 */
export function getWallInstances(
  tileMap: TileTypeVal[][],
  tileColors?: Array<FloorColor | null>,
  cols?: number,
): FurnitureInstance[] {
  if (!wallSprites) return []
  const tmRows = tileMap.length
  const tmCols = tmRows > 0 ? tileMap[0].length : 0
  const layoutCols = cols ?? tmCols
  const instances: FurnitureInstance[] = []
  for (let r = 0; r < tmRows; r++) {
    for (let c = 0; c < tmCols; c++) {
      if (tileMap[r][c] !== TileType.WALL) continue
      const colorIdx = r * layoutCols + c
      const wallColor = tileColors?.[colorIdx]
      const wallInfo = wallColor
        ? getColorizedWallSprite(c, r, tileMap, wallColor)
        : getWallSprite(c, r, tileMap)
      if (!wallInfo) continue
      instances.push({
        sprite: wallInfo.sprite,
        x: c * TILE_SIZE,
        y: r * TILE_SIZE + wallInfo.offsetY,
        zY: (r + 1) * TILE_SIZE,
      })
    }
  }
  return instances
}

/**
 * 計算指定 FloorColor 的牆磚平面填充 hex 顏色。
 * 使用與地板磚相同的 Colorize 演算法：50% 灰 → HSL。
 */
export function wallColorToHex(color: FloorColor): string {
  const { h, s, b, c } = color
  // 以 50% 灰作為牆壁基底
  let lightness = 0.5

  // 套用對比度
  if (c !== 0) {
    const factor = (100 + c) / 100
    lightness = 0.5 + (lightness - 0.5) * factor
  }

  // 套用亮度
  if (b !== 0) {
    lightness = lightness + b / 200
  }

  lightness = Math.max(0, Math.min(1, lightness))

  // HSL 轉 hex（與 colorize.ts 的 hslToHex 相同）
  const satFrac = s / 100
  const ch = (1 - Math.abs(2 * lightness - 1)) * satFrac
  const hp = h / 60
  const x = ch * (1 - Math.abs(hp % 2 - 1))
  let r1 = 0, g1 = 0, b1 = 0

  if (hp < 1) { r1 = ch; g1 = x; b1 = 0 }
  else if (hp < 2) { r1 = x; g1 = ch; b1 = 0 }
  else if (hp < 3) { r1 = 0; g1 = ch; b1 = x }
  else if (hp < 4) { r1 = 0; g1 = x; b1 = ch }
  else if (hp < 5) { r1 = x; g1 = 0; b1 = ch }
  else { r1 = ch; g1 = 0; b1 = x }

  const m = lightness - ch / 2
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round((v + m) * 255)))

  return `#${clamp(r1).toString(16).padStart(2, '0')}${clamp(g1).toString(16).padStart(2, '0')}${clamp(b1).toString(16).padStart(2, '0')}`
}
