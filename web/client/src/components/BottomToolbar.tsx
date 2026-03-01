import { useState, memo } from 'react'
import { SettingsModal } from './SettingsModal.js'
import { FloorSelector } from './FloorSelector.js'
import { t } from '../i18n.js'
import type { FloorConfig } from '../types/messages.js'

interface BottomToolbarProps {
  isEditMode: boolean
  onToggleEditMode: () => void
  onOpenSessionPicker: () => void
  isDebugMode: boolean
  onToggleDebugMode: () => void
  floors: FloorConfig[]
  currentFloorId: string | null
  onSwitchFloor: (floorId: string) => void
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 10,
  left: 10,
  zIndex: 'var(--pixel-controls-z)',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  background: 'var(--pixel-bg)',
  border: '2px solid var(--pixel-border)',
  borderRadius: 0,
  padding: '4px 6px',
  boxShadow: 'var(--pixel-shadow)',
}

const btnBase: React.CSSProperties = {
  padding: '5px 10px',
  fontSize: '24px',
  color: 'var(--pixel-text)',
  background: 'var(--pixel-btn-bg)',
  border: '2px solid transparent',
  borderRadius: 0,
  cursor: 'pointer',
}

const btnActive: React.CSSProperties = {
  ...btnBase,
  background: 'var(--pixel-active-bg)',
  border: '2px solid var(--pixel-accent)',
}


export const BottomToolbar = memo(function BottomToolbar({
  isEditMode,
  onToggleEditMode,
  onOpenSessionPicker,
  isDebugMode,
  onToggleDebugMode,
  floors,
  currentFloorId,
  onSwitchFloor,
}: BottomToolbarProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  return (
    <div role="toolbar" aria-label={t.layout} style={panelStyle}>
      <button
        onClick={onOpenSessionPicker}
        onMouseEnter={() => setHovered('sessions')}
        onMouseLeave={() => setHovered(null)}
        style={{
          ...btnBase,
          background: hovered === 'sessions' ? 'var(--pixel-btn-hover-bg)' : btnBase.background,
        }}
        title={t.browseSessions}
      >
        {t.sessions}
      </button>
      <button
        onClick={onToggleEditMode}
        onMouseEnter={() => setHovered('edit')}
        onMouseLeave={() => setHovered(null)}
        aria-pressed={isEditMode}
        style={
          isEditMode
            ? { ...btnActive }
            : {
                ...btnBase,
                background: hovered === 'edit' ? 'var(--pixel-btn-hover-bg)' : btnBase.background,
              }
        }
        title={t.editOfficeLayout}
      >
        {t.layout}
      </button>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setIsSettingsOpen((v) => !v)}
          onMouseEnter={() => setHovered('settings')}
          onMouseLeave={() => setHovered(null)}
          aria-pressed={isSettingsOpen}
          style={
            isSettingsOpen
              ? { ...btnActive }
              : {
                  ...btnBase,
                  background: hovered === 'settings' ? 'var(--pixel-btn-hover-bg)' : btnBase.background,
                }
          }
          title={t.settings}
        >
          {t.settings}
        </button>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          isDebugMode={isDebugMode}
          onToggleDebugMode={onToggleDebugMode}
        />
      </div>
      <FloorSelector
        floors={floors}
        currentFloorId={currentFloorId}
        onSwitchFloor={onSwitchFloor}
      />
    </div>
  )
})
