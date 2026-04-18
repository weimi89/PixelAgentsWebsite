import { useState, useEffect, useCallback, useRef, memo } from 'react'
import type { ToolActivity } from '../office/types.js'
import { extractToolName } from '../office/toolUtils.js'
import { TOOL_TYPE_COLORS, LEVEL_BADGE_COLORS, CLI_TYPE_BADGE_COLORS } from '../constants.js'
import { AgentTimeline } from './AgentTimeline.js'
import { AchievementPanel } from './AchievementPanel.js'
import { useDeviceType } from '../hooks/useDeviceType.js'
import { formatModelName } from '../utils.js'
import { vscode } from '../socketApi.js'
import { t } from '../i18n.js'

interface GrowthInfo {
  xp: number
  level: number
  achievements: string[]
}

interface TranscriptEntry {
  ts: number
  role: 'user' | 'assistant' | 'system'
  summary: string
}

interface AgentDetailPanelProps {
  agentId: number
  agents: Record<number, { projectName?: string; isRemote?: boolean; owner?: string; ownerId?: string }>
  agentStatuses: Record<number, string>
  agentTools: Record<number, ToolActivity[]>
  agentModels: Record<number, string>
  agentGitBranches: Record<number, string>
  agentStatusHistory: Record<number, Array<{ ts: number; status: string; detail?: string }>>
  agentGrowthData: Record<number, GrowthInfo>
  agentTranscripts?: Record<number, TranscriptEntry[]>
  agentTeams?: Record<number, string>
  agentCliTypes?: Record<number, string>
  agentStartTimes?: Record<number, number>
  onClose: () => void
  onCloseAgent?: (id: number) => void
  /** P3.4: 當前使用者的認證角色 */
  authRole?: string
  /** P3.4: 當前使用者的 userId */
  authUserId?: string | null
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

/** 格式化工作時長（中文，支援小時） */
function formatWorkDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  if (totalSec < 60) return `${totalSec}秒`
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return s > 0 ? `${h}時${m}分${s}秒` : `${h}時${m}分`
  return s > 0 ? `${m}分${s}秒` : `${m}分`
}

/** 取得工具名稱的顏色 */
function getToolColor(status: string): string {
  const toolName = extractToolName(status)
  if (toolName && toolName in TOOL_TYPE_COLORS) {
    return TOOL_TYPE_COLORS[toolName]
  }
  return 'var(--pixel-text)'
}

/** 取得等級對應的顏色 */
function getLevelColor(level: number): string {
  const def = LEVEL_BADGE_COLORS.find((c) => level >= c.minLevel)
  return def ? def.color : '#888888'
}

/** 計算 XP 在當前等級的進度百分比 */
function getXpProgress(xp: number): number {
  const level = Math.floor(Math.sqrt(xp / 10)) + 1
  // 當前等級所需 XP：(level - 1)^2 * 10
  const currentLevelXp = (level - 1) ** 2 * 10
  // 下一等級所需 XP：level^2 * 10
  const nextLevelXp = level ** 2 * 10
  const range = nextLevelXp - currentLevelXp
  if (range <= 0) return 100
  return Math.min(100, ((xp - currentLevelXp) / range) * 100)
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
  agentGrowthData,
  agentTranscripts,
  agentTeams,
  agentCliTypes,
  agentStartTimes,
  onClose,
  onCloseAgent,
  authRole,
  authUserId,
}: AgentDetailPanelProps) {
  const [visible, setVisible] = useState(false)
  const [closeHovered, setCloseHovered] = useState(false)
  const [isAchievementPanelOpen, setIsAchievementPanelOpen] = useState(false)
  const { isMobile } = useDeviceType()

  // 行動版下滑關閉手勢
  const dragRef = useRef<{ startY: number; currentY: number; dragging: boolean }>({ startY: 0, currentY: 0, dragging: false })
  const panelRef = useRef<HTMLDivElement>(null)

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

  const agent = agents[agentId]
  const status = agentStatuses[agentId]
  const tools = agentTools[agentId] || []
  const model = agentModels[agentId]
  const branch = agentGitBranches[agentId]
  const team = agentTeams?.[agentId]
  const cliType = agentCliTypes?.[agentId]
  const startedAt = agentStartTimes?.[agentId]

  // P3.4: 判斷是否可顯示詳細資訊（admin 或代理所有者可看）
  const isOwnerOrAdmin = authRole === 'admin' || (
    authRole === 'member' && (
      agent?.ownerId == null || agent?.ownerId === authUserId
    )
  )
  const isAnonymous = authRole === 'anonymous'

  // 即時更新工具耗時和工作時長 — 儲存時間戳避免 render 中呼叫 Date.now()（violates react purity）
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const activeTools = agentTools[agentId]
    const hasActive = activeTools?.some((tool) => !tool.done)
    if (!hasActive && !startedAt) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [agentId, agentTools, startedAt])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 200)
  }, [onClose])

  // 行動版觸控手勢處理
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return
    const touch = e.touches[0]
    dragRef.current = { startY: touch.clientY, currentY: touch.clientY, dragging: false }
  }, [isMobile])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return
    const touch = e.touches[0]
    const dy = touch.clientY - dragRef.current.startY
    dragRef.current.currentY = touch.clientY
    // 只允許向下拖曳（dy > 0）且拖曳超過 10px 才算開始
    if (dy > 10) {
      dragRef.current.dragging = true
      if (panelRef.current) {
        panelRef.current.style.transform = `translateY(${dy}px)`
        panelRef.current.style.transition = 'none'
      }
    }
  }, [isMobile])

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || !dragRef.current.dragging) return
    const dy = dragRef.current.currentY - dragRef.current.startY
    if (panelRef.current) {
      panelRef.current.style.transition = 'transform 0.2s ease-out'
    }
    // 下滑超過 120px 或速度夠快 → 關閉
    if (dy > 120) {
      handleClose()
    } else {
      // 彈回
      if (panelRef.current) {
        panelRef.current.style.transform = 'translateY(0)'
      }
    }
    dragRef.current.dragging = false
  }, [isMobile, handleClose])

  // 自動捲動到底部（新項目出現時）
  const toolsScrollRef = useRef<HTMLDivElement>(null)
  const historyScrollRef = useRef<HTMLDivElement>(null)
  const transcriptScrollRef = useRef<HTMLDivElement>(null)
  const transcript = agentTranscripts?.[agentId] || []
  const history = agentStatusHistory[agentId] || []
  const growth = agentGrowthData[agentId]
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

  // 轉錄記錄自動捲動到底部
  useEffect(() => {
    const el = transcriptScrollRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    if (isNearBottom) el.scrollTop = el.scrollHeight
  }, [transcript.length])

  // 行動版樣式覆蓋
  const mobilePanel: React.CSSProperties = isMobile ? {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    top: 'auto',
    width: '100%',
    maxHeight: '70vh',
    height: 'auto',
    borderLeft: 'none',
    borderRight: 'none',
    borderTop: '2px solid var(--pixel-border)',
    boxShadow: '0 -4px 0 #0a0a14',
    zIndex: 60,
    borderRadius: 0,
    paddingBottom: 'env(safe-area-inset-bottom)',
  } : {}

  const mobileTransform = isMobile
    ? (visible ? 'translateY(0)' : 'translateY(100%)')
    : (visible ? 'translateX(0)' : 'translateX(100%)')

  const fs = isMobile ? { row: 14, label: 13, value: 14, header: 16, section: 16, tool: 14 } : { row: 18, label: 18, value: 18, header: 22, section: 20, tool: 18 }

  return (
    <>
      {/* 行動版背景遮罩 */}
      {isMobile && (
        <div
          onClick={handleClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: visible ? 'rgba(0,0,0,0.5)' : 'transparent',
            zIndex: 59,
            transition: 'background 0.2s ease-out',
            pointerEvents: visible ? 'auto' : 'none',
          }}
        />
      )}
      <div
        ref={panelRef}
        className="pixel-detail-panel"
        style={{
          ...panelStyle,
          ...mobilePanel,
          transform: mobileTransform,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
      {/* 行動版拖曳把手 */}
      {isMobile && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '6px 0 2px',
          flexShrink: 0,
        }}>
          <div style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.25)',
          }} />
        </div>
      )}

      {/* 標題列 */}
      <div style={{ ...headerStyle, padding: isMobile ? '4px 10px' : headerStyle.padding }}>
        <span style={{ fontSize: `${fs.header}px`, color: 'var(--pixel-text)', fontWeight: 'bold' }}>
          {t.agentDetail}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          {onCloseAgent && !agent?.isRemote && (
            <button
              onClick={() => onCloseAgent(agentId)}
              className="pixel-detail-btn"
              style={{
                background: 'none',
                border: '1px solid var(--pixel-close-text)',
                color: 'var(--pixel-close-text)',
                cursor: 'pointer',
                padding: isMobile ? '4px 10px' : '1px 6px',
                fontSize: `${isMobile ? 12 : 14}px`,
                borderRadius: 0,
                lineHeight: '18px',
                minHeight: isMobile ? 32 : 'auto',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--pixel-close-hover)'
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--pixel-close-hover)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--pixel-close-text)'
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--pixel-close-text)'
              }}
            >
              {t.closeAgent}
            </button>
          )}
          <button
            className="pixel-detail-btn"
            style={{
              ...closeBtnStyle,
              color: closeHovered ? 'var(--pixel-close-hover)' : 'var(--pixel-close-text)',
              fontSize: isMobile ? '16px' : '20px',
              padding: isMobile ? '4px 10px' : '2px 6px',
              minHeight: isMobile ? 32 : 'auto',
            }}
            onClick={handleClose}
            onMouseEnter={() => setCloseHovered(true)}
            onMouseLeave={() => setCloseHovered(false)}
            title={t.agentDetailClose}
          >
            X
          </button>
        </div>
      </div>

      {/* ---- 基本資訊（固定區域，不捲動） ---- */}
      <div style={{ flexShrink: 0, borderBottom: '2px solid var(--pixel-border)' }}>
        <div style={{ ...rowStyle, fontSize: `${fs.row}px`, padding: isMobile ? '2px 10px' : rowStyle.padding }}>
          <span style={{ ...labelStyle, fontSize: `${fs.label}px` }}>ID</span>
          <span style={{ ...valueStyle, fontSize: `${fs.value}px` }}>#{agentId}</span>
        </div>

        {agent?.projectName && (
          <div style={{ ...rowStyle, fontSize: `${fs.row}px`, padding: isMobile ? '2px 10px' : rowStyle.padding }}>
            <span style={{ ...labelStyle, fontSize: `${fs.label}px` }}>{t.project}</span>
            <span style={{ ...valueStyle, fontSize: `${fs.value}px` }}>{agent.projectName}</span>
          </div>
        )}

        <div style={{ ...rowStyle, fontSize: `${fs.row}px`, padding: isMobile ? '2px 10px' : rowStyle.padding }}>
          <span style={{ ...labelStyle, fontSize: `${fs.label}px` }}>{t.status}</span>
          <span style={{ ...valueStyle, fontSize: `${fs.value}px`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <span style={statusDotStyle(statusColor)} />
            <span style={{ color: statusColor }}>{statusText}</span>
          </span>
        </div>

        {branch && (
          <div style={{ ...rowStyle, fontSize: `${fs.row}px`, padding: isMobile ? '2px 10px' : rowStyle.padding }}>
            <span style={{ ...labelStyle, fontSize: `${fs.label}px` }}>{t.gitBranch}</span>
            <span style={{ ...valueStyle, fontSize: `${fs.value}px`, color: 'var(--pixel-green)' }}>{branch}</span>
          </div>
        )}

        {model && (
          <div style={{ ...rowStyle, fontSize: `${fs.row}px`, padding: isMobile ? '2px 10px' : rowStyle.padding }}>
            <span style={{ ...labelStyle, fontSize: `${fs.label}px` }}>{t.model}</span>
            <span style={{ ...valueStyle, fontSize: `${fs.value}px` }}>{formatModelName(model)}</span>
          </div>
        )}

        {agent?.isRemote && agent?.owner && (
          <div style={{ ...rowStyle, fontSize: `${fs.row}px`, padding: isMobile ? '2px 10px' : rowStyle.padding }}>
            <span style={{ ...labelStyle, fontSize: `${fs.label}px` }}>{t.owner}</span>
            <span style={{ ...valueStyle, fontSize: `${fs.value}px`, color: '#e8a040' }}>{agent.owner}</span>
          </div>
        )}

        {team && (
          <div style={{ ...rowStyle, fontSize: `${fs.row}px`, padding: isMobile ? '2px 10px' : rowStyle.padding }}>
            <span style={{ ...labelStyle, fontSize: `${fs.label}px` }}>{t.team}</span>
            <span style={{ ...valueStyle, fontSize: `${fs.value}px`, color: 'var(--pixel-tool-task)' }}>{team}</span>
          </div>
        )}

        {cliType && (
          <div style={{ ...rowStyle, fontSize: `${fs.row}px`, padding: isMobile ? '2px 10px' : rowStyle.padding }}>
            <span style={{ ...labelStyle, fontSize: `${fs.label}px` }}>CLI</span>
            <span style={{
              fontSize: `${isMobile ? 11 : 14}px`,
              padding: '0 4px',
              border: `1px solid ${CLI_TYPE_BADGE_COLORS[cliType] || 'var(--pixel-accent)'}`,
              color: CLI_TYPE_BADGE_COLORS[cliType] || 'var(--pixel-accent)',
            }}>
              {cliType.toUpperCase()}
            </span>
          </div>
        )}

        {startedAt && (
          <>
            <div style={{ ...rowStyle, fontSize: `${fs.row}px`, padding: isMobile ? '2px 10px' : rowStyle.padding }}>
              <span style={{ ...labelStyle, fontSize: `${fs.label}px` }}>{t.workStartTime}</span>
              <span style={{ ...valueStyle, fontSize: `${fs.value}px` }}>{formatTime(startedAt)}</span>
            </div>
            <div style={{ ...rowStyle, fontSize: `${fs.row}px`, padding: isMobile ? '2px 10px' : rowStyle.padding }}>
              <span style={{ ...labelStyle, fontSize: `${fs.label}px` }}>{t.workDuration}</span>
              <span style={{ ...valueStyle, fontSize: `${fs.value}px`, color: 'var(--pixel-green)' }}>
                {formatWorkDuration(now - startedAt)}
              </span>
            </div>
          </>
        )}

      </div>

      {/* P3.4: anonymous 提示登入 */}
      {isAnonymous && (
        <div style={{ padding: '12px 10px', color: 'rgba(255,255,255,0.5)', fontSize: `${fs.row}px`, textAlign: 'center', borderBottom: '2px solid var(--pixel-border)' }}>
          {t.loginToSeeDetails || '請登入以查看詳細資訊'}
        </div>
      )}

      {/* ---- 成長資訊（P3.4: 非所有者/anonymous 不顯示） ---- */}
      {isOwnerOrAdmin && growth && growth.level > 1 && (
        <div style={{ flexShrink: 0, borderBottom: '2px solid var(--pixel-border)', padding: isMobile ? '4px 10px' : '6px 10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: `${isMobile ? 16 : 20}px`, color: getLevelColor(growth.level) }}>
              {t.growthLevel(growth.level)}
            </span>
            <span style={{ fontSize: `${isMobile ? 12 : 16}px`, color: 'rgba(255,255,255,0.4)' }}>
              {t.growthXp(growth.xp)}
            </span>
          </div>
          {/* XP 進度條 */}
          <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 0, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${getXpProgress(growth.xp)}%`,
              background: getLevelColor(growth.level),
              transition: 'width 0.3s ease',
            }} />
          </div>
          {/* 成就列表 + 查看所有按鈕 */}
          {growth.achievements.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6, alignItems: 'center' }}>
              {growth.achievements.map((a) => (
                <span key={a} style={{
                  fontSize: `${isMobile ? 11 : 14}px`,
                  padding: '1px 4px',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}>
                  {t.achievementNames[a] || a}
                </span>
              ))}
              <button
                onClick={() => setIsAchievementPanelOpen(true)}
                style={{
                  fontSize: `${isMobile ? 11 : 14}px`,
                  padding: '1px 6px',
                  background: 'var(--pixel-btn-bg)',
                  color: 'var(--pixel-accent)',
                  border: '1px solid var(--pixel-accent)',
                  borderRadius: 0,
                  cursor: 'pointer',
                }}
              >
                {t.allAchievements}
              </button>
            </div>
          )}
        </div>
      )}

      {isOwnerOrAdmin && (
        <AchievementPanel
          isOpen={isAchievementPanelOpen}
          onClose={() => setIsAchievementPanelOpen(false)}
          unlockedAchievements={growth?.achievements || []}
        />
      )}

      {/* ---- 工具活動（P3.4: 僅所有者/admin 可見） ---- */}
      {!isOwnerOrAdmin ? null : (
      <>
      <div style={{ ...sectionHeaderStyle, fontSize: `${fs.section}px`, padding: isMobile ? '4px 10px' : sectionHeaderStyle.padding }}>
        {t.agentDetailTools}
        {tools.length > 0 && (
          <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 'normal', marginLeft: 6, fontSize: `${isMobile ? 12 : 16}px` }}>
            ({tools.length})
          </span>
        )}
      </div>

      <div ref={toolsScrollRef} style={scrollAreaStyle}>
        {tools.length === 0 ? (
          <div style={{ padding: '4px 10px', fontSize: `${fs.tool}px`, color: 'rgba(255,255,255,0.3)' }}>
            {t.noToolData}
          </div>
        ) : (
          <div style={{ padding: '2px 0' }}>
            {tools.map((tool) => {
              const toolName = extractToolName(tool.status) || tool.status
              const color = getToolColor(tool.status)
              const elapsed = tool.done
                ? (tool.endTime != null ? Math.floor((tool.endTime - tool.startTime) / 1000) : 0)
                : Math.floor((now - tool.startTime) / 1000)

              return (
                <div
                  key={tool.toolId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: isMobile ? '2px 10px' : '3px 10px',
                    fontSize: `${fs.tool}px`,
                    opacity: tool.done ? 0.5 : 1,
                  }}
                >
                  <span style={{ color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {tool.permissionWait ? `${toolName} (${t.needsApproval})` : toolName}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0, marginLeft: 8, fontSize: `${isMobile ? 11 : 16}px` }}>
                    {formatElapsed(elapsed)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ---- 工具時間軸 ---- */}
      {tools.length > 0 && (
        <div style={{ padding: isMobile ? '4px 10px' : '6px 10px', borderBottom: '1px solid var(--pixel-border)', flexShrink: 0 }}>
          <div style={{ fontSize: `${isMobile ? 10 : 11}px`, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
            {t.agentDetailTimeline}
          </div>
          <AgentTimeline tools={tools} />
        </div>
      )}

      {/* ---- 狀態歷史（固定標題 + 獨立捲動） ---- */}
      <div style={{ ...sectionHeaderStyle, fontSize: `${fs.section}px`, padding: isMobile ? '4px 10px' : sectionHeaderStyle.padding, borderTop: '2px solid var(--pixel-border)' }}>
        {t.agentDetailHistory}
        {history.length > 0 && (
          <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 'normal', marginLeft: 6, fontSize: `${isMobile ? 12 : 16}px` }}>
            ({history.length})
          </span>
        )}
      </div>

      <div ref={historyScrollRef} style={scrollAreaStyle}>
        {history.length === 0 ? (
          <div style={{ padding: '4px 10px', fontSize: `${fs.tool}px`, color: 'rgba(255,255,255,0.3)' }}>
            {t.noHistory}
          </div>
        ) : (
          <div style={{ padding: '4px 10px' }}>
            {history.map((entry, i) => {
              const { color: dotColor } = statusDisplay(entry.status)
              return (
                <div
                  key={`${entry.ts}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? 4 : 6,
                    padding: '2px 0',
                    fontSize: `${isMobile ? 12 : 16}px`,
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

      {/* ---- 對話記錄（固定標題 + 獨立捲動） ---- */}
      {transcript.length > 0 && (
        <>
          <div style={{ ...sectionHeaderStyle, fontSize: `${fs.section}px`, padding: isMobile ? '4px 10px' : sectionHeaderStyle.padding, borderTop: '2px solid var(--pixel-border)' }}>
            {t.agentDetailTranscript}
            <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 'normal', marginLeft: 6, fontSize: `${isMobile ? 12 : 16}px` }}>
              ({transcript.length})
            </span>
          </div>
          <div ref={transcriptScrollRef} style={{ ...scrollAreaStyle, maxHeight: isMobile ? 120 : 160 }}>
            <div style={{ padding: '4px 10px' }}>
              {transcript.slice(-20).map((entry, i) => (
                <div
                  key={`${entry.ts}-${i}`}
                  style={{
                    display: 'flex',
                    gap: 4,
                    fontSize: `${isMobile ? 11 : 14}px`,
                    lineHeight: `${isMobile ? 14 : 16}px`,
                    padding: '1px 0',
                    overflow: 'hidden',
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {formatTime(entry.ts)}
                  </span>
                  <span style={{
                    color: entry.role === 'assistant' ? 'var(--pixel-tool-task)'
                      : entry.role === 'user' ? 'var(--pixel-tool-read)'
                      : 'var(--pixel-status-permission)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}>
                    {entry.summary}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      </>
      )}
      </div>
    </>
  )
})
