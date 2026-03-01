import { useState, memo } from 'react'
import type { FloorConfig } from '../types/messages.js'

interface FloorSelectorProps {
  floors: FloorConfig[]
  currentFloorId: string | null
  onSwitchFloor: (floorId: string) => void
}

const btnBase: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: '20px',
  color: 'var(--pixel-text)',
  background: 'var(--pixel-btn-bg)',
  border: '2px solid transparent',
  borderRadius: 0,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const btnActive: React.CSSProperties = {
  ...btnBase,
  background: 'var(--pixel-active-bg)',
  border: '2px solid var(--pixel-accent)',
}

export const FloorSelector = memo(function FloorSelector({
  floors,
  currentFloorId,
  onSwitchFloor,
}: FloorSelectorProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  if (floors.length <= 1) return null

  const sorted = [...floors].sort((a, b) => a.order - b.order)

  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      <span style={{
        fontSize: '18px',
        color: 'var(--pixel-text-dim)',
        marginRight: 2,
      }}>
        |
      </span>
      {sorted.map((floor) => {
        const isActive = floor.id === currentFloorId
        const isHovered = hovered === floor.id
        return (
          <button
            key={floor.id}
            onClick={() => onSwitchFloor(floor.id)}
            onMouseEnter={() => setHovered(floor.id)}
            onMouseLeave={() => setHovered(null)}
            style={
              isActive
                ? btnActive
                : {
                    ...btnBase,
                    background: isHovered ? 'var(--pixel-btn-hover-bg)' : btnBase.background,
                  }
            }
            title={floor.name}
          >
            {floor.name}
          </button>
        )
      })}
    </div>
  )
})
