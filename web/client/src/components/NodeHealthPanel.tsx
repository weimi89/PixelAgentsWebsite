import { useEffect, useState } from 'react'
import type { ConnectedNodeInfo } from '../types/messages.js'
import { vscode } from '../socketApi.js'
import { t } from '../i18n.js'

interface NodeHealthPanelProps {
  isOpen: boolean
  onClose: () => void
  nodes: ConnectedNodeInfo[]
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  return `${hours}h ${remainMinutes}m`
}

function getLatencyColor(latencyMs: number): string {
  if (latencyMs < 100) return '#3794ff'
  if (latencyMs < 300) return '#cca700'
  return '#f44747'
}

function getLatencyLabel(latencyMs: number): string {
  if (latencyMs < 100) return t.latencyGood
  if (latencyMs < 300) return t.latencyFair
  return t.latencyPoor
}

/** 信號強度條 — 3 條，依延遲著色 */
function SignalBars({ latencyMs }: { latencyMs: number }) {
  const color = getLatencyColor(latencyMs)
  const bars = latencyMs < 100 ? 3 : latencyMs < 300 ? 2 : 1
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 1, height: 12 }}>
      {[1, 2, 3].map((level) => (
        <span
          key={level}
          style={{
            width: 3,
            height: 4 + level * 3,
            background: level <= bars ? color : 'rgba(255, 255, 255, 0.15)',
          }}
        />
      ))}
    </span>
  )
}

export function NodeHealthPanel({ isOpen, onClose, nodes }: NodeHealthPanelProps) {
  // 1 秒 tick，用於 uptime/連線時長顯示 — 取代 render 內直接呼叫 Date.now()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!isOpen) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isOpen])

  // 開啟時立即請求節點健康資訊
  useEffect(() => {
    if (isOpen) {
      vscode.postMessage({ type: 'requestNodeHealth' })
    }
  }, [isOpen])

  // Escape 鍵關閉
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* 背景遮罩 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 49,
        }}
      />
      {/* 面板 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.nodeHealth}
        className="pixel-modal-dialog"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 50,
          background: 'var(--pixel-bg)',
          border: '2px solid var(--pixel-border)',
          borderRadius: 0,
          padding: '4px',
          boxShadow: 'var(--pixel-shadow)',
          minWidth: 'min(280px, calc(100vw - 24px))',
          maxWidth: 'min(420px, calc(100vw - 24px))',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        {/* 標題列 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 10px',
            borderBottom: '1px solid var(--pixel-border)',
            marginBottom: '4px',
          }}
        >
          <span style={{ fontSize: '24px', color: 'rgba(255, 255, 255, 0.9)' }}>
            {t.nodeHealth}
          </span>
          <button
            onClick={onClose}
            aria-label="close"
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: 0,
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            X
          </button>
        </div>

        {/* 節點列表 */}
        {nodes.length === 0 ? (
          <div style={{ padding: '12px 10px', fontSize: '20px', color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center' }}>
            {t.noRemoteNodes}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {nodes.map((node) => {
              const connectedDuration = now - node.connectedAt
              const latencyColor = getLatencyColor(node.latencyMs)
              return (
                <div
                  key={node.socketId}
                  style={{
                    padding: '6px 10px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  {/* 使用者名稱與信號強度 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '22px', color: 'rgba(255, 255, 255, 0.9)' }}>
                      @{node.username}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <SignalBars latencyMs={node.latencyMs} />
                      <span style={{ fontSize: '18px', color: latencyColor }}>
                        {node.latencyMs}ms
                      </span>
                      <span style={{ fontSize: '16px', color: 'rgba(255, 255, 255, 0.4)' }}>
                        ({getLatencyLabel(node.latencyMs)})
                      </span>
                    </div>
                  </div>
                  {/* 詳細資訊 */}
                  <div style={{ display: 'flex', gap: 16, fontSize: '18px', color: 'rgba(255, 255, 255, 0.5)' }}>
                    <span>{t.nodeActiveSessions}: {node.activeSessions}</span>
                    <span>{t.nodeConnectedTime}: {formatDuration(connectedDuration)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
