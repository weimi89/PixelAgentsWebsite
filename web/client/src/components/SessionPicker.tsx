import { useState, useEffect, useMemo } from 'react'
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

export interface ProjectDirInfo {
  name: string
  excluded: boolean
}

interface SessionPickerProps {
  isOpen: boolean
  onClose: () => void
  sessions: SessionInfo[]
  onResume: (sessionId: string, projectDir: string) => void
  isLoading: boolean
  projectDirs: ProjectDirInfo[]
  onExcludeProject: (dirBasename: string) => void
  onIncludeProject: (dirBasename: string) => void
}

function formatTimeAgo(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000)
  if (seconds < 60) return t.timeAgoSeconds(seconds)
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t.timeAgoMinutes(minutes)
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t.timeAgoHours(hours)
  const days = Math.floor(hours / 24)
  if (days < 30) return t.timeAgoDays(days)
  const months = Math.floor(days / 30)
  return t.timeAgoMonths(months)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

export function SessionPicker({ isOpen, onClose, sessions, onResume, isLoading, projectDirs, onExcludeProject, onIncludeProject }: SessionPickerProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showProjectDirs, setShowProjectDirs] = useState(false)

  // 開關時重設搜尋
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setShowProjectDirs(false)
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

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions
    const q = searchQuery.toLowerCase()
    return sessions.filter((s) =>
      s.projectName.toLowerCase().includes(q) ||
      s.title.toLowerCase().includes(q) ||
      s.projectDir.toLowerCase().includes(q),
    )
  }, [sessions, searchQuery])

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
        role="dialog"
        aria-modal="true"
        aria-label={t.sessions}
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
          width: 'min(480px, 90vw)',
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

        {/* 搜尋框 */}
        {!isLoading && sessions.length > 0 && (
          <div style={{ padding: '4px 8px', flexShrink: 0 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchSessions}
              aria-label={t.searchSessions}
              autoFocus
              style={{
                width: '100%',
                padding: '4px 8px',
                fontSize: '20px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '2px solid var(--pixel-border)',
                borderRadius: 0,
                color: 'var(--pixel-text)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

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
          ) : filteredSessions.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '20px' }}>
              {t.noMatchingSessions}
            </div>
          ) : (
            filteredSessions.map((session) => {
              const key = session.sessionId
              const isItemHovered = hovered === key
              return (
                <div
                  key={key}
                  role="listitem"
                  tabIndex={session.isActive ? undefined : 0}
                  onMouseEnter={() => setHovered(key)}
                  onMouseLeave={() => setHovered(null)}
                  onKeyDown={(e) => {
                    if (!session.isActive && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      onResume(session.sessionId, session.projectDir)
                    }
                  }}
                  style={{
                    padding: '8px 10px',
                    background: isItemHovered ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
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

        {/* 專案資料夾管理區 */}
        {projectDirs.length > 0 && (
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--pixel-border)', padding: '4px 8px' }}>
            <button
              onClick={() => setShowProjectDirs((prev) => !prev)}
              onMouseEnter={() => setHovered('dirs-toggle')}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: hovered === 'dirs-toggle' ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '4px 2px',
                width: '100%',
                textAlign: 'left',
              }}
            >
              {showProjectDirs ? '▾' : '▸'} {t.projectFoldersCount(projectDirs.length)}
            </button>
            {showProjectDirs && (
              <div style={{ padding: '4px 0', maxHeight: '200px', overflowY: 'auto' }}>
                {projectDirs.map((dir) => {
                  const dirHoverKey = `dir-${dir.name}`
                  return (
                    <div
                      key={dir.name}
                      onMouseEnter={() => setHovered(dirHoverKey)}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '3px 8px',
                        background: hovered === dirHoverKey ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                        opacity: dir.excluded ? 0.5 : 1,
                      }}
                    >
                      <span style={{
                        fontSize: '14px',
                        color: dir.excluded ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.7)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                        marginRight: '8px',
                        textDecoration: dir.excluded ? 'line-through' : 'none',
                      }}>
                        {dir.name}
                      </span>
                      {dir.excluded ? (
                        <button
                          onClick={() => onIncludeProject(dir.name)}
                          onMouseEnter={() => setHovered(`dir-btn-${dir.name}`)}
                          onMouseLeave={() => setHovered(dirHoverKey)}
                          style={{
                            background: hovered === `dir-btn-${dir.name}` ? 'rgba(80, 200, 120, 0.15)' : 'transparent',
                            border: '1px solid rgba(80, 200, 120, 0.4)',
                            color: 'rgba(80, 200, 120, 0.9)',
                            fontSize: '14px',
                            cursor: 'pointer',
                            padding: '0 6px',
                            borderRadius: 0,
                            flexShrink: 0,
                          }}
                        >
                          {t.showProject}
                        </button>
                      ) : (
                        <button
                          onClick={() => onExcludeProject(dir.name)}
                          onMouseEnter={() => setHovered(`dir-btn-${dir.name}`)}
                          onMouseLeave={() => setHovered(dirHoverKey)}
                          style={{
                            background: hovered === `dir-btn-${dir.name}` ? 'rgba(255, 100, 100, 0.12)' : 'transparent',
                            border: '1px solid',
                            borderColor: hovered === `dir-btn-${dir.name}` ? 'rgba(255, 100, 100, 0.5)' : 'rgba(255, 255, 255, 0.15)',
                            color: hovered === `dir-btn-${dir.name}` ? 'rgba(255, 100, 100, 0.9)' : 'rgba(255, 255, 255, 0.4)',
                            fontSize: '14px',
                            cursor: 'pointer',
                            padding: '0 6px',
                            borderRadius: 0,
                            flexShrink: 0,
                          }}
                        >
                          {t.hideProject}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
