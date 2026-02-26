import { useState, useEffect } from 'react'

/**
 * 共享的 requestAnimationFrame 迴圈，供 React 覆蓋層元件使用。
 * 使用此 hook 的多個元件共享同一個 rAF 回呼，
 * 相比各自執行獨立迴圈，可減少開銷。
 */
const callbacks = new Set<() => void>()
let rafId = 0

function tick() {
  for (const cb of callbacks) cb()
  if (callbacks.size > 0) {
    rafId = requestAnimationFrame(tick)
  }
}

export function useRenderTick(): void {
  const [, setTick] = useState(0)
  useEffect(() => {
    const cb = () => setTick((n) => n + 1)
    callbacks.add(cb)
    if (callbacks.size === 1) {
      rafId = requestAnimationFrame(tick)
    }
    return () => {
      callbacks.delete(cb)
      if (callbacks.size === 0) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [])
}
