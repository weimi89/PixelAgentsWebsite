import { memo } from 'react'
import type { ToolActivity } from '../office/types.js'
import { extractToolName } from '../office/toolUtils.js'
import { TOOL_TYPE_COLORS_HEX } from '../constants.js'

interface AgentTimelineProps {
  tools: ToolActivity[]
}

const TIMELINE_WINDOW_MS = 5 * 60 * 1000
const MAX_TOOLS = 20

function getHexColor(toolName: string): string {
  for (const [key, color] of Object.entries(TOOL_TYPE_COLORS_HEX)) {
    if (key === 'default') continue
    if (toolName.includes(key)) return color
  }
  return TOOL_TYPE_COLORS_HEX.default
}

export const AgentTimeline = memo(function AgentTimeline({ tools }: AgentTimelineProps) {
  const now = Date.now()
  const windowStart = now - TIMELINE_WINDOW_MS
  const recentTools = tools
    .filter(tool => (tool.endTime ?? now) > windowStart)
    .slice(-MAX_TOOLS)

  if (recentTools.length === 0) return null

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 3,
      maxHeight: 120,
      overflowY: 'auto',
    }}>
      {recentTools.map((tool) => {
        const name = extractToolName(tool.status) || tool.status
        const end = tool.endTime ?? now
        const color = getHexColor(name)
        const elapsedSec = (end - tool.startTime) / 1000
        const elapsed = elapsedSec < 10 ? elapsedSec.toFixed(1) : Math.round(elapsedSec)
        const isActive = !tool.done

        return (
          <div
            key={tool.toolId}
            title={`${name} (${((end - tool.startTime) / 1000).toFixed(1)}s)`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 16,
              padding: '2px 4px',
              background: color,
              border: '1px solid var(--pixel-border)',
              opacity: isActive ? 1 : 0.7,
              animation: isActive ? 'chatPulse 1s ease-in-out infinite' : undefined,
              whiteSpace: 'nowrap',
              fontSize: 10,
              lineHeight: '12px',
              color: '#fff',
            }}
          >
            {name} {elapsed}s
          </div>
        )
      })}
    </div>
  )
})
