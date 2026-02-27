import type { ToolActivity } from '../types.js'
import type { OfficeState } from '../engine/officeState.js'
import type { SubagentCharacter } from '../../hooks/useExtensionMessages.js'
import { TILE_SIZE } from '../types.js'
import { isSittingState } from '../engine/characters.js'
import { TOOL_OVERLAY_VERTICAL_OFFSET, CHARACTER_SITTING_OFFSET_PX } from '../../constants.js'
import { t } from '../../i18n.js'
import { useRenderTick } from '../../hooks/useRenderTick.js'
import { formatModelName } from '../../utils.js'

interface ToolOverlayProps {
  officeState: OfficeState
  agents: number[]
  agentTools: Record<number, ToolActivity[]>
  agentModels: Record<number, string>
  subagentCharacters: SubagentCharacter[]
  containerRef: React.RefObject<HTMLDivElement | null>
  zoom: number
  panRef: React.RefObject<{ x: number; y: number }>
  onCloseAgent: (id: number) => void
}

/** 從工具/狀態衍生出簡短的人類可讀活動字串 */
function getActivityText(
  agentId: number,
  agentTools: Record<number, ToolActivity[]>,
  isActive: boolean,
): string {
  const tools = agentTools[agentId]
  if (tools && tools.length > 0) {
    // 找到最新的未完成工具
    const activeTool = [...tools].reverse().find((t) => !t.done)
    if (activeTool) {
      if (activeTool.permissionWait) return t.needsApproval
      return activeTool.status
    }
    // 所有工具已完成但代理仍活躍（回合中）— 繼續顯示最後的工具狀態
    if (isActive) {
      const lastTool = tools[tools.length - 1]
      if (lastTool) return lastTool.status
    }
  }

  return t.idle
}

export function ToolOverlay({
  officeState,
  agents,
  agentTools,
  agentModels,
  subagentCharacters,
  containerRef,
  zoom,
  panRef,
  onCloseAgent,
}: ToolOverlayProps) {
  useRenderTick()

  const el = containerRef.current
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const canvasW = Math.round(rect.width * dpr)
  const canvasH = Math.round(rect.height * dpr)
  const layout = officeState.getLayout()
  const mapW = layout.cols * TILE_SIZE * zoom
  const mapH = layout.rows * TILE_SIZE * zoom
  const deviceOffsetX = Math.floor((canvasW - mapW) / 2) + Math.round(panRef.current.x)
  const deviceOffsetY = Math.floor((canvasH - mapH) / 2) + Math.round(panRef.current.y)

  const selectedId = officeState.selectedAgentId
  const hoveredId = officeState.hoveredAgentId

  // 所有角色 ID
  const allIds = [...agents, ...subagentCharacters.map((s) => s.id)]

  return (
    <>
      {allIds.map((id) => {
        const ch = officeState.characters.get(id)
        if (!ch) return null

        const isSelected = selectedId === id
        const isHovered = hoveredId === id
        const isSub = ch.isSubagent

        // 僅對懸停或選取的代理顯示
        if (!isSelected && !isHovered) return null

        // 定位於角色上方
        const sittingOffset = isSittingState(ch.state) ? CHARACTER_SITTING_OFFSET_PX : 0
        const screenX = (deviceOffsetX + ch.x * zoom) / dpr
        const screenY = (deviceOffsetY + (ch.y + sittingOffset - TOOL_OVERLAY_VERTICAL_OFFSET) * zoom) / dpr

        // 取得活動文字
        const subHasPermission = isSub && ch.bubbleType === 'permission'
        const isDetached = ch.isDetached
        let activityText: string
        if (isDetached) {
          activityText = t.detached
        } else if (isSub) {
          if (subHasPermission) {
            activityText = t.needsApproval
          } else {
            const sub = subagentCharacters.find((s) => s.id === id)
            activityText = sub ? sub.label : t.subtask
          }
        } else {
          activityText = getActivityText(id, agentTools, ch.isActive)
        }

        // 取得模型顯示名稱
        const modelName = !isSub && agentModels[id] ? formatModelName(agentModels[id]) : null

        // 決定圓點顏色
        const tools = agentTools[id]
        const hasPermission = subHasPermission || tools?.some((t) => t.permissionWait && !t.done)
        const hasActiveTools = tools?.some((t) => !t.done)
        const isActive = ch.isActive

        let dotColor: string | null = null
        if (isDetached) {
          dotColor = 'var(--pixel-status-detached)'
        } else if (hasPermission) {
          dotColor = 'var(--pixel-status-permission)'
        } else if (isActive && hasActiveTools) {
          dotColor = 'var(--pixel-status-active)'
        }

        return (
          <div
            key={id}
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY - 24,
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              pointerEvents: isSelected ? 'auto' : 'none',
              zIndex: isSelected ? 'var(--pixel-overlay-selected-z)' : 'var(--pixel-overlay-z)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'var(--pixel-bg)',
                border: isSelected
                  ? '2px solid var(--pixel-border-light)'
                  : '2px solid var(--pixel-border)',
                borderRadius: 0,
                padding: isSelected ? '3px 6px 3px 8px' : '3px 8px',
                boxShadow: 'var(--pixel-shadow)',
                whiteSpace: 'nowrap',
                maxWidth: 220,
              }}
            >
              {dotColor && (
                <span
                  className={isActive && !hasPermission ? 'pixel-agents-pulse' : undefined}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: dotColor,
                    flexShrink: 0,
                  }}
                />
              )}
              <span
                style={{
                  fontSize: isSub ? '20px' : '22px',
                  fontStyle: isSub ? 'italic' : undefined,
                  color: 'var(--pixel-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {activityText}
              </span>
              {modelName && (
                <span
                  style={{
                    fontSize: '16px',
                    color: 'var(--pixel-text-dim)',
                    flexShrink: 0,
                    marginLeft: 2,
                  }}
                >
                  {modelName}
                </span>
              )}
              {isSelected && !isSub && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onCloseAgent(id)
                  }}
                  title={t.closeAgent}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--pixel-close-text)',
                    cursor: 'pointer',
                    padding: '0 2px',
                    fontSize: '26px',
                    lineHeight: 1,
                    marginLeft: 2,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = 'var(--pixel-close-hover)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = 'var(--pixel-close-text)'
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}
