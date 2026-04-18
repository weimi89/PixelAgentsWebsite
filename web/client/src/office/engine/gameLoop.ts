import { MAX_DELTA_TIME_SEC } from '../../constants.js'

export interface GameLoopCallbacks {
  update: (dt: number) => void
  render: (ctx: CanvasRenderingContext2D) => void
}

/** 避免相同錯誤連續輸出淹沒 console — 每種錯誤訊息僅在一分鐘內記錄一次 */
const loggedErrors = new Map<string, number>()
const ERROR_LOG_WINDOW_MS = 60_000

function logLoopError(phase: 'update' | 'render', err: unknown): void {
  const key = `${phase}:${err instanceof Error ? err.message : String(err)}`
  const now = Date.now()
  const last = loggedErrors.get(key) ?? 0
  if (now - last < ERROR_LOG_WINDOW_MS) return
  loggedErrors.set(key, now)
  console.error(`[gameLoop] ${phase} error:`, err)
}

export function startGameLoop(
  canvas: HTMLCanvasElement,
  callbacks: GameLoopCallbacks,
): () => void {
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  let lastTime = 0
  let rafId = 0
  let stopped = false

  const frame = (time: number) => {
    if (stopped) return
    const dt = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, MAX_DELTA_TIME_SEC)
    lastTime = time

    // 單一幀失敗不應整個畫面崩潰 — 捕獲後跳過當幀並繼續
    try {
      callbacks.update(dt)
    } catch (err) {
      logLoopError('update', err)
    }

    ctx.imageSmoothingEnabled = false
    try {
      callbacks.render(ctx)
    } catch (err) {
      logLoopError('render', err)
    }

    rafId = requestAnimationFrame(frame)
  }

  rafId = requestAnimationFrame(frame)

  return () => {
    stopped = true
    cancelAnimationFrame(rafId)
  }
}
