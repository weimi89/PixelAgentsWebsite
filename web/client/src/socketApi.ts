import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'

/** 儲存認證 token，供重連時使用 */
let authToken: string | null = null

function createSocket(): Socket {
  const opts: Record<string, unknown> = {
    transports: ['websocket', 'polling'],
  }
  if (authToken) {
    opts.auth = { token: authToken }
  }
  return io(window.location.origin, opts)
}

const socket: Socket = createSocket()

// 暴露與 vscodeApi.ts 相同的介面，使所有現有程式碼只需最小修改即可運作
export const vscode = {
  postMessage(msg: unknown): void {
    socket.emit('message', msg)
  },
}

/**
 * 監聽來自伺服器的訊息。
 * @returns 取消訂閱函式。
 */
export function onServerMessage(handler: (data: unknown) => void): () => void {
  socket.on('message', handler)
  return () => { socket.off('message', handler) }
}

/**
 * 監聽 Socket.IO 連線狀態變更。
 * 訂閱時會立即以目前狀態呼叫一次 handler，避免訂閱者晚於 connect/disconnect 事件而錯失初始狀態。
 * @returns 取消訂閱函式。
 */
export function onConnectionChange(handler: (connected: boolean) => void): () => void {
  // 訂閱當下先同步一次目前狀態（race-safe）
  handler(socket.connected)
  const onConnect = () => handler(true)
  const onDisconnect = () => handler(false)
  socket.on('connect', onConnect)
  socket.on('disconnect', onDisconnect)
  return () => {
    socket.off('connect', onConnect)
    socket.off('disconnect', onDisconnect)
  }
}

/** 取得目前的連線狀態 */
export function isConnected(): boolean {
  return socket.connected
}

/**
 * 直接 emit 事件到 socket（不走 postMessage 包裝）。
 * 用於 auth:upgrade 等非 ClientMessage 的事件。
 */
export function emitRaw(event: string, data: unknown): void {
  socket.emit(event, data)
}

/**
 * 設定/清除認證 token。
 * 下次重連時會將 token 附帶在 socket auth 中。
 */
export function setAuthToken(token: string | null): void {
  authToken = token
}

/**
 * 斷線並重連（帶新的認證 token）。
 * 用於登出後重建匿名連線。
 */
export function reconnectWithAuth(): void {
  socket.disconnect()
  // 更新 socket 的 auth 選項
  if (authToken) {
    (socket.auth as Record<string, unknown>) = { token: authToken }
  } else {
    (socket.auth as Record<string, unknown>) = {}
  }
  socket.connect()
}
