/**
 * 共用精靈圖著色模組。
 *
 * 兩種模式：
 * - Colorize（Photoshop 風格）：灰階 → 固定 HSL。用於地板磚和選擇啟用的家具。
 * - Adjust（家具預設模式）：偏移原始像素的 HSL 值。
 */

import type { SpriteData, FloorColor } from './types.js'

/** 通用著色精靈圖快取：任意字串鍵 → SpriteData */
const colorizeCache = new Map<string, SpriteData>()

/**
 * 從快取取得色彩調整後的精靈圖，若無則計算並快取。
 * 根據 `color.colorize` 分派至 colorize 或 adjust 模式。
 * 呼叫者提供唯一的快取鍵，該鍵必須包含 colorize 旗標。
 */
export function getColorizedSprite(cacheKey: string, sprite: SpriteData, color: FloorColor): SpriteData {
  const cached = colorizeCache.get(cacheKey)
  if (cached) return cached
  const result = color.colorize ? colorizeSprite(sprite, color) : adjustSprite(sprite, color)
  colorizeCache.set(cacheKey, result)
  return result
}

/** 清除所有已快取的著色精靈圖（例如素材重新載入時） */
export function clearColorizeCache(): void {
  colorizeCache.clear()
}

/**
 * 使用 HSL 轉換對精靈圖著色。
 *
 * 演算法（Photoshop Colorize 風格）：
 * 1. 解析每個像素的顏色為感知亮度（0-1）
 * 2. 套用對比度：以中點 0.5 為基準拉伸/壓縮
 * 3. 套用亮度：向上/向下偏移明度
 * 4. 以使用者的色相 + 飽和度建立 HSL 顏色
 * 5. 轉換 HSL -> RGB -> hex
 */
export function colorizeSprite(sprite: SpriteData, color: FloorColor): SpriteData {
  const { h, s, b, c } = color
  const result: SpriteData = []

  for (const row of sprite) {
    const newRow: string[] = []
    for (const pixel of row) {
      if (pixel === '') {
        newRow.push('')
        continue
      }

      // 解析 hex 以取得 RGB 值
      const r = parseInt(pixel.slice(1, 3), 16)
      const g = parseInt(pixel.slice(3, 5), 16)
      const bv = parseInt(pixel.slice(5, 7), 16)
      // 使用感知亮度進行灰階計算
      let lightness = (0.299 * r + 0.587 * g + 0.114 * bv) / 255

      // 套用對比度：以 0.5 為基準拉伸/壓縮
      if (c !== 0) {
        const factor = (100 + c) / 100
        lightness = 0.5 + (lightness - 0.5) * factor
      }

      // 套用亮度：向上/向下偏移
      if (b !== 0) {
        lightness = lightness + b / 200
      }

      // 限制範圍
      lightness = Math.max(0, Math.min(1, lightness))

      // 轉換 HSL 為 RGB
      const satFrac = s / 100
      const hex = hslToHex(h, satFrac, lightness)
      newRow.push(hex)
    }
    result.push(newRow)
  }

  return result
}

/** 將 HSL（h: 0-360, s: 0-1, l: 0-1）轉換為 #RRGGBB hex 字串 */
function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = h / 60
  const x = c * (1 - Math.abs(hp % 2 - 1))
  let r1 = 0, g1 = 0, b1 = 0

  if (hp < 1) { r1 = c; g1 = x; b1 = 0 }
  else if (hp < 2) { r1 = x; g1 = c; b1 = 0 }
  else if (hp < 3) { r1 = 0; g1 = c; b1 = x }
  else if (hp < 4) { r1 = 0; g1 = x; b1 = c }
  else if (hp < 5) { r1 = x; g1 = 0; b1 = c }
  else { r1 = c; g1 = 0; b1 = x }

  const m = l - c / 2
  const r = Math.round((r1 + m) * 255)
  const g = Math.round((g1 + m) * 255)
  const bOut = Math.round((b1 + m) * 255)

  return `#${clamp255(r).toString(16).padStart(2, '0')}${clamp255(g).toString(16).padStart(2, '0')}${clamp255(bOut).toString(16).padStart(2, '0')}`.toUpperCase()
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, v))
}

/** 將 RGB（各 0-255）轉換為 HSL（h: 0-360, s: 0-1, l: 0-1） */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rf = r / 255, gf = g / 255, bf = b / 255
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rf) h = ((gf - bf) / d + (gf < bf ? 6 : 0)) * 60
  else if (max === gf) h = ((bf - rf) / d + 2) * 60
  else h = ((rf - gf) / d + 4) * 60
  return [h, s, l]
}

/**
 * 透過偏移 HSL 值調整精靈圖的顏色（家具的預設模式）。
 *
 * H 滑桿（-180 到 +180）：旋轉色相
 * S 滑桿（-100 到 +100）：偏移飽和度
 * B 滑桿（-100 到 100）：偏移明度
 * C 滑桿（-100 到 100）：以中點為基準調整對比度
 */
export function adjustSprite(sprite: SpriteData, color: FloorColor): SpriteData {
  const { h: hShift, s: sShift, b, c } = color
  const result: SpriteData = []

  for (const row of sprite) {
    const newRow: string[] = []
    for (const pixel of row) {
      if (pixel === '') {
        newRow.push('')
        continue
      }

      const r = parseInt(pixel.slice(1, 3), 16)
      const g = parseInt(pixel.slice(3, 5), 16)
      const bv = parseInt(pixel.slice(5, 7), 16)
      const [origH, origS, origL] = rgbToHsl(r, g, bv)

      // 偏移色相
      const newH = ((origH + hShift) % 360 + 360) % 360

      // 偏移飽和度
      const newS = Math.max(0, Math.min(1, origS + sShift / 100))

      // 套用對比度：以 0.5 為基準拉伸/壓縮
      let lightness = origL
      if (c !== 0) {
        const factor = (100 + c) / 100
        lightness = 0.5 + (lightness - 0.5) * factor
      }

      // 套用亮度
      if (b !== 0) {
        lightness = lightness + b / 200
      }

      lightness = Math.max(0, Math.min(1, lightness))

      const hex = hslToHex(newH, newS, lightness)
      newRow.push(hex)
    }
    result.push(newRow)
  }

  return result
}
