import { useState } from 'react'
import { t } from '../i18n.js'

export interface SessionInfo {
  sessionId: string
  projectDir: string
  projectName: string
  title: string
  modifiedAt: number
  size: number
  isActive: boolean
}

interface SessionPickerProps {
  isOpen: boolean
  onClose: () => void
  sessions: SessionInfo[]
  onResume: (sessionId: string, projectDir: string) => void
  isLoading: boolean
}

function formatTimeAgo(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000)
  if (seconds < 60) return `${seconds} 秒前`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分鐘前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小時前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  const months = Math.floor(days / 30)
  return `${months} 個月前`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

export function SessionPicker({ isOpen, onClose, sessions, onResume, isLoading }: SessionPickerProps) {
  const [hovered, setHovered] = useState<string | null>(null)

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
      {/* 彈出視窗 */}
      <div
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
          width: 480,
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
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
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '24px', color: 'rgba(255, 255, 255, 0.9)' }}>
            {t.sessions}
          </span>
          <button
            onClick={onClose}
            onMouseEnter={() => setHovered('close')}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: hovered === 'close' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
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

        {/* 工作階段列表 */}
        <div
          style={{
            overflowY: 'auto',
            flex: 1,
            padding: '0 4px',
          }}
        >
          {isLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '20px' }}>
              {t.loadingSessions}
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '20px' }}>
              {t.noSessions}
            </div>
          ) : (
            sessions.map((session) => {
              const key = session.sessionId
              const isHovered = hovered === key
              return (
                <div
                  key={key}
                  onMouseEnter={() => setHovered(key)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    padding: '8px 10px',
                    background: isHovered ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                    cursor: session.isActive ? 'default' : 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    opacity: session.isActive ? 0.5 : 1,
                  }}
                  onClick={() => {
                    if (!session.isActive) {
                      onResume(session.sessionId, session.projectDir)
                    }
                  }}
                >
                  {/* 上列：專案名稱 + 時間 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{
                      fontSize: '16px',
                      color: 'rgba(90, 180, 255, 0.9)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '60%',
                    }}>
                      {session.projectName}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {session.isActive && (
                        <span style={{
                          fontSize: '14px',
                          color: 'rgba(80, 200, 120, 0.9)',
                          border: '1px solid rgba(80, 200, 120, 0.4)',
                          padding: '0 4px',
                        }}>
                          {t.activeSession}
                        </span>
                      )}
                      <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>
                        {formatTimeAgo(session.modifiedAt)}
                      </span>
                    </span>
                  </div>
                  {/* 下列：標題 + 大小 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '20px',
                      color: 'rgba(255, 255, 255, 0.8)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '80%',
                    }}>
                      {session.title}
                    </span>
                    <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                      {formatSize(session.size)}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
