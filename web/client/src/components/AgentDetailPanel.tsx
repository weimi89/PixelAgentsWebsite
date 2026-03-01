import { useState, useEffect, useCallback, useRef, memo } from 'react'
import type { ToolActivity } from '../office/types.js'
import { extractToolName } from '../office/toolUtils.js'
import { TOOL_TYPE_COLORS } from '../constants.js'
import { formatModelName } from '../utils.js'
import { vscode } from '../socketApi.js'
import { t } from '../i18n.js'

interface AgentDetailPanelProps {
  agentId: number
  agents: Record<number, { projectName?: string; isRemote?: boolean; owner?: string }>
  agentStatuses: Record<number, string>
  agentTools: Record<number, ToolActivity[]>
  agentModels: Record<number, string>
  agentGitBranches: Record<number, string>
  agentStatusHistory: Record<number, Array<{ ts: number; status: string; detail?: string }>>
  onClose: () => void
}

const PANEL_WIDTH = 320

// ---- 樣式定義 ----

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  right: 0,
  top: 0,
  bottom: 0,
  width: PANEL_WIDTH,
  zIndex: 50,
  background: 'var(--pixel-bg)',
  borderLeft: '2px solid var(--pixel-border)',
  boxShadow: '-4px 0 0 #0a0a14',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  transition: 'transform 0.2s ease-out',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 10px',
  borderBottom: '2px solid var(--pixel-border)',
  flexShrink: 0,
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--pixel-close-text)',
  fontSize: '20px',
  cursor: 'pointer',
  padding: '2px 6px',
  borderRadius: 0,
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '20px',
  color: 'var(--pixel-accent)',
  fontWeight: 'bold',
  padding: '6px 10px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  flexShrink: 0,
  background: 'var(--pixel-bg)',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px 10px',
  fontSize: '18px',
}

const labelStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  flexShrink: 0,
  marginRight: 8,
}

const valueStyle: React.CSSProperties = {
  color: 'var(--pixel-text)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'right',
}

const statusDotStyle = (color: string): React.CSSProperties => ({
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: color,
  flexShrink: 0,
  display: 'inline-block',
  marginRight: 6,
})

const scrollAreaStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  minHeight: 0,
}

// ---- 工具函式 ----

/** 將狀態值轉為顯示文字與顏色 */
function statusDisplay(status: string | undefined): { text: string; color: string } {
  if (!status || status === 'active') {
    return { text: t.active, color: 'var(--pixel-status-active)' }
  }
  if (status === 'waiting') {
    return { text: t.mightBeWaiting, color: 'var(--pixel-status-permission)' }
  }
  if (status === 'permission') {
    return { text: t.needsApproval, color: 'var(--pixel-status-permission)' }
  }
  return { text: t.idle, color: 'var(--pixel-status-detached)' }
}

/** 格式化時間戳為 HH:MM:SS */
function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

/** 格式化工具執行時間 */
function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m${s}s` : `${m}m`
}

/** 取得工具名稱的顏色 */
function getToolColor(status: string): string {
  const toolName = extractToolName(status)
  if (toolName && toolName in TOOL_TYPE_COLORS) {
    return TOOL_TYPE_COLORS[toolName]
  }
  return 'var(--pixel-text)'
}

// ---- 元件 ----

export const AgentDetailPanel = memo(function AgentDetailPanel({
  agentId,
  agents,
  agentStatuses,
  agentTools,
  agentModels,
  agentGitBranches,
  agentStatusHistory,
  onClose,
}: AgentDetailPanelProps) {
  const [visible, setVisible] = useState(false)
  const [closeHovered, setCloseHovered] = useState(false)

  // 滑入動畫
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // 開啟時自動請求狀態歷史
  useEffect(() => {
    vscode.postMessage({ type: 'requestStatusHistory', agentId })
  }, [agentId])

  // Escape 關閉面板
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // 即時更新工具耗時
  const [, setTick] = useState(0)
  useEffect(() => {
    const tools = agentTools[agentId]
    const hasActive = tools?.some((tool) => !tool.done)
    if (!hasActive) return
    const interval = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(interval)
  }, [agentId, agentTools])

  const handleClose = useCallback(() => {
    setVisible(false)
    // 等待動畫結束後觸發 onClose
    setTimeout(onClose, 200)
  }, [onClose])

  // 自動捲動到底部（新項目出現時）
  const toolsScrollRef = useRef<HTMLDivElement>(null)
  const historyScrollRef = useRef<HTMLDivElement>(null)

  const agent = agents[agentId]
  const status = agentStatuses[agentId]
  const tools = agentTools[agentId] || []
  const model = agentModels[agentId]
  const branch = agentGitBranches[agentId]
  const history = agentStatusHistory[agentId] || []
  const { text: statusText, color: statusColor } = statusDisplay(status)

  // 工具活動自動捲動到底部
  useEffect(() => {
    const el = toolsScrollRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    if (isNearBottom) el.scrollTop = el.scrollHeight
  }, [tools.length])

  // 狀態歷史自動捲動到底部
  useEffect(() => {
    const el = historyScrollRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    if (isNearBottom) el.scrollTop = el.scrollHeight
  }, [history.length])

  return (
    <div
      style={{
        ...panelStyle,
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
      }}
    >
      {/* 標題列 */}
      <div style={headerStyle}>
        <span style={{ fontSize: '22px', color: 'var(--pixel-text)', fontWeight: 'bold' }}>
          {t.agentDetail}
        </span>
        <button
          style={{
            ...closeBtnStyle,
            color: closeHovered ? 'var(--pixel-close-hover)' : 'var(--pixel-close-text)',
          }}
          onClick={handleClose}
          onMouseEnter={() => setCloseHovered(true)}
          onMouseLeave={() => setCloseHovered(false)}
          title={t.agentDetailClose}
        >
          X
        </button>
      </div>

      {/* ---- 基本資訊（固定區域，不捲動） ---- */}
      <div style={{ flexShrink: 0, borderBottom: '2px solid var(--pixel-border)' }}>
        <div style={rowStyle}>
          <span style={labelStyle}>ID</span>
          <span style={valueStyle}>#{agentId}</span>
        </div>

        {agent?.projectName && (
          <div style={rowStyle}>
            <span style={labelStyle}>{t.project}</span>
            <span style={valueStyle}>{agent.projectName}</span>
          </div>
        )}

        <div style={rowStyle}>
          <span style={labelStyle}>{t.status}</span>
          <span style={{ ...valueStyle, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <span style={statusDotStyle(statusColor)} />
            <span style={{ color: statusColor }}>{statusText}</span>
          </span>
        </div>

        {branch && (
          <div style={rowStyle}>
            <span style={labelStyle}>{t.gitBranch}</span>
            <span style={{ ...valueStyle, color: 'var(--pixel-green)' }}>{branch}</span>
          </div>
        )}

        {model && (
          <div style={rowStyle}>
            <span style={labelStyle}>{t.model}</span>
            <span style={valueStyle}>{formatModelName(model)}</span>
          </div>
        )}

        {agent?.isRemote && agent?.owner && (
          <div style={rowStyle}>
            <span style={labelStyle}>{t.owner}</span>
            <span style={{ ...valueStyle, color: '#e8a040' }}>{agent.owner}</span>
          </div>
        )}
      </div>

      {/* ---- 工具活動（固定標題 + 獨立捲動） ---- */}
      <div style={sectionHeaderStyle}>
        {t.agentDetailTools}
        {tools.length > 0 && (
          <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 'normal', marginLeft: 6, fontSize: '16px' }}>
            ({tools.length})
          </span>
        )}
      </div>

      <div ref={toolsScrollRef} style={scrollAreaStyle}>
        {tools.length === 0 ? (
          <div style={{ padding: '6px 10px', fontSize: '18px', color: 'rgba(255,255,255,0.3)' }}>
            {t.noToolData}
          </div>
        ) : (
          <div style={{ padding: '4px 0' }}>
            {tools.map((tool) => {
              const toolName = extractToolName(tool.status) || tool.status
              const color = getToolColor(tool.status)
              const elapsed = tool.done
                ? (tool.endTime != null ? Math.floor((tool.endTime - tool.startTime) / 1000) : 0)
                : Math.floor((Date.now() - tool.startTime) / 1000)

              return (
                <div
                  key={tool.toolId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '3px 10px',
                    fontSize: '18px',
                    opacity: tool.done ? 0.5 : 1,
                  }}
                >
                  <span style={{ color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {tool.permissionWait ? `${toolName} (${t.needsApproval})` : toolName}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0, marginLeft: 8, fontSize: '16px' }}>
                    {formatElapsed(elapsed)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ---- 狀態歷史（固定標題 + 獨立捲動） ---- */}
      <div style={{ ...sectionHeaderStyle, borderTop: '2px solid var(--pixel-border)' }}>
        {t.agentDetailHistory}
        {history.length > 0 && (
          <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 'normal', marginLeft: 6, fontSize: '16px' }}>
            ({history.length})
          </span>
        )}
      </div>

      <div ref={historyScrollRef} style={scrollAreaStyle}>
        {history.length === 0 ? (
          <div style={{ padding: '6px 10px', fontSize: '18px', color: 'rgba(255,255,255,0.3)' }}>
            {t.noHistory}
          </div>
        ) : (
          <div style={{ padding: '4px 10px' }}>
            {/* 時間順序：舊→新，自動捲動到底部 */}
            {history.map((entry, i) => {
              const { color: dotColor } = statusDisplay(entry.status)
              return (
                <div
                  key={`${entry.ts}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '2px 0',
                    fontSize: '16px',
                  }}
                >
                  <span style={statusDotStyle(dotColor)} />

                  <span style={{
                    color: 'rgba(255,255,255,0.35)',
                    flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatTime(entry.ts)}
                  </span>

                  <span style={{
                    color: dotColor,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}>
                    {statusDisplay(entry.status).text}
                    {entry.detail && (
                      <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>
                        {entry.detail}
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
})
