import {
  DAY_NIGHT_DAWN_HOUR,
  DAY_NIGHT_DAY_HOUR,
  DAY_NIGHT_DUSK_HOUR,
  DAY_NIGHT_NIGHT_HOUR,
  DAY_NIGHT_MAX_ALPHA_NIGHT,
  DAY_NIGHT_MAX_ALPHA_TRANSITION,
} from '../../constants.js'
import type { DayPhase } from '../types.js'

/** 根據小時判斷日夜階段 */
export function getDayPhase(hour: number): DayPhase {
  if (hour >= DAY_NIGHT_DAWN_HOUR && hour < DAY_NIGHT_DAY_HOUR) return 'dawn'
  if (hour >= DAY_NIGHT_DAY_HOUR && hour < DAY_NIGHT_DUSK_HOUR) return 'day'
  if (hour >= DAY_NIGHT_DUSK_HOUR && hour < DAY_NIGHT_NIGHT_HOUR) return 'dusk'
  return 'night'
}

// 模組級快取：結果僅以分鐘精度變化，避免 60fps 重複計算
let cachedOverlayKey = ''
let cachedOverlay: { color: string; alpha: number } = { color: 'rgba(0,0,0,0)', alpha: 0 }

/** 根據時間計算平滑插值的色溫覆蓋層（每分鐘最多計算一次） */
export function getDayNightOverlay(hour: number, minute: number): { color: string; alpha: number } {
  const key = `${hour}:${minute}`
  if (key === cachedOverlayKey) return cachedOverlay

  const t = hour + minute / 60
  let result: { color: string; alpha: number }

  // 白天：無覆蓋
  if (t >= DAY_NIGHT_DAY_HOUR && t < DAY_NIGHT_DUSK_HOUR) {
    result = { color: 'rgba(0,0,0,0)', alpha: 0 }
  }
  // 黎明過渡：dawn → day（暖色漸弱）
  else if (t >= DAY_NIGHT_DAWN_HOUR && t < DAY_NIGHT_DAY_HOUR) {
    const progress = (t - DAY_NIGHT_DAWN_HOUR) / (DAY_NIGHT_DAY_HOUR - DAY_NIGHT_DAWN_HOUR)
    const alpha = DAY_NIGHT_MAX_ALPHA_TRANSITION * (1 - progress)
    result = { color: `rgba(255, 180, 100, ${alpha})`, alpha }
  }
  // 黃昏過渡：day → dusk → night（暖色漸強再轉冷色）
  else if (t >= DAY_NIGHT_DUSK_HOUR && t < DAY_NIGHT_NIGHT_HOUR) {
    const progress = (t - DAY_NIGHT_DUSK_HOUR) / (DAY_NIGHT_NIGHT_HOUR - DAY_NIGHT_DUSK_HOUR)
    if (progress < 0.5) {
      const p = progress * 2
      const alpha = DAY_NIGHT_MAX_ALPHA_TRANSITION * p
      result = { color: `rgba(255, 120, 50, ${alpha})`, alpha }
    } else {
      const p = (progress - 0.5) * 2
      const r = Math.round(255 * (1 - p) + 20 * p)
      const g = Math.round(120 * (1 - p) + 20 * p)
      const b = Math.round(50 * (1 - p) + 60 * p)
      const alpha = DAY_NIGHT_MAX_ALPHA_TRANSITION + (DAY_NIGHT_MAX_ALPHA_NIGHT - DAY_NIGHT_MAX_ALPHA_TRANSITION) * p
      result = { color: `rgba(${r}, ${g}, ${b}, ${alpha})`, alpha }
    }
  }
  // 夜間 → 黎明前過渡
  else if (t >= 0 && t < DAY_NIGHT_DAWN_HOUR) {
    if (t >= DAY_NIGHT_DAWN_HOUR - 1) {
      const progress = t - (DAY_NIGHT_DAWN_HOUR - 1)
      const nightAlpha = DAY_NIGHT_MAX_ALPHA_NIGHT * (1 - progress)
      const dawnAlpha = DAY_NIGHT_MAX_ALPHA_TRANSITION * progress
      const r = Math.round(20 * (1 - progress) + 255 * progress)
      const g = Math.round(20 * (1 - progress) + 180 * progress)
      const b = Math.round(60 * (1 - progress) + 100 * progress)
      const alpha = nightAlpha + dawnAlpha
      result = { color: `rgba(${r}, ${g}, ${b}, ${alpha})`, alpha }
    } else {
      result = { color: `rgba(20, 20, 60, ${DAY_NIGHT_MAX_ALPHA_NIGHT})`, alpha: DAY_NIGHT_MAX_ALPHA_NIGHT }
    }
  }
  // 深夜（19-24）
  else {
    result = { color: `rgba(20, 20, 60, ${DAY_NIGHT_MAX_ALPHA_NIGHT})`, alpha: DAY_NIGHT_MAX_ALPHA_NIGHT }
  }

  cachedOverlayKey = key
  cachedOverlay = result
  return result
}

/** 是否應該亮燈 */
export function shouldLampsBeOn(phase: DayPhase): boolean {
  return phase === 'dusk' || phase === 'night'
}
