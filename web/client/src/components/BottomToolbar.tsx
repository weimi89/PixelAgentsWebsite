import { useState, memo } from 'react'
import { SettingsModal } from './SettingsModal.js'
import { FloorSelector } from './FloorSelector.js'
import { t } from '../i18n.js'
import type { FloorConfig } from '../types/messages.js'
import type { RecordingState } from '../office/engine/recorder.js'

interface BottomToolbarProps {
  isEditMode: boolean
  onToggleEditMode: () => void
  onOpenSessionPicker: () => void
  isDebugMode: boolean
  onToggleDebugMode: () => void
  floors: FloorConfig[]
  currentFloorId: string | null
  onSwitchFloor: (floorId: string) => void
  isBuildingViewOpen: boolean
  onToggleBuildingView: () => void
  dayNightEnabled: boolean
  onToggleDayNight: () => void
  dayNightTimeOverride: number | null
  onDayNightTimeOverrideChange: (hour: number | null) => void
  isDashboardView: boolean
  onToggleDashboardView: () => void
  uiScale: number
  onUiScaleChange: (scale: number) => void
  lanPeers: Array<{ name: string; host: string; port: number; agentCount: number }>
  isSettingsOpen: boolean
  onToggleSettings: () => void
  isBehaviorEditorOpen: boolean
  onToggleBehaviorEditor: () => void
  // 錄製/回放
  recorderState: RecordingState
  recordingDuration: number
  playbackProgress: number
  onStartRecording: () => void
  onStopRecording: () => void
  onStopPlayback: () => void
  onOpenRecordingList: () => void
  onSeekPlayback: (progress: number) => void
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
  isBuildingViewOpen,
  onToggleBuildingView,
  dayNightEnabled,
  onToggleDayNight,
  dayNightTimeOverride,
  onDayNightTimeOverrideChange,
  isDashboardView,
  onToggleDashboardView,
  uiScale,
  onUiScaleChange,
  lanPeers,
  isSettingsOpen,
  onToggleSettings,
  isBehaviorEditorOpen,
  onToggleBehaviorEditor,
  recorderState,
  recordingDuration,
  playbackProgress,
  onStartRecording,
  onStopRecording,
  onStopPlayback,
  onOpenRecordingList,
  onSeekPlayback,
}: BottomToolbarProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div role="toolbar" aria-label={t.layout} style={panelStyle}>
      <button
        onClick={onToggleBuildingView}
        onMouseEnter={() => setHovered('building')}
        onMouseLeave={() => setHovered(null)}
        aria-pressed={isBuildingViewOpen}
        style={
          isBuildingViewOpen
            ? { ...btnActive }
            : {
                ...btnBase,
                background: hovered === 'building' ? 'var(--pixel-btn-hover-bg)' : btnBase.background,
              }
        }
        title={t.buildingPanel}
      >
        {t.building}
      </button>
      <button
        onClick={onToggleDashboardView}
        onMouseEnter={() => setHovered('dashboard')}
        onMouseLeave={() => setHovered(null)}
        aria-pressed={isDashboardView}
        style={
          isDashboardView
            ? { ...btnActive }
            : {
                ...btnBase,
                background: hovered === 'dashboard' ? 'var(--pixel-btn-hover-bg)' : btnBase.background,
              }
        }
        title={t.dashboard}
      >
        {isDashboardView ? t.officeView : t.dashboard}
      </button>
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
        onClick={onToggleBehaviorEditor}
        onMouseEnter={() => setHovered('behavior')}
        onMouseLeave={() => setHovered(null)}
        aria-pressed={isBehaviorEditorOpen}
        style={
          isBehaviorEditorOpen
            ? { ...btnActive }
            : {
                ...btnBase,
                background: hovered === 'behavior' ? 'var(--pixel-btn-hover-bg)' : btnBase.background,
              }
        }
        title={t.behaviorEditor}
      >
        {t.behavior}
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
          onClick={onToggleSettings}
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
          onClose={onToggleSettings}
          isDebugMode={isDebugMode}
          onToggleDebugMode={onToggleDebugMode}
          dayNightEnabled={dayNightEnabled}
          onToggleDayNight={onToggleDayNight}
          dayNightTimeOverride={dayNightTimeOverride}
          onDayNightTimeOverrideChange={onDayNightTimeOverrideChange}
          uiScale={uiScale}
          onUiScaleChange={onUiScaleChange}
          lanPeers={lanPeers}
        />
      </div>
      {/* 錄製/回放控制 */}
      <div style={{ borderLeft: '1px solid var(--pixel-border)', paddingLeft: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        {recorderState === 'idle' && (
          <>
            <button
              onClick={onStartRecording}
              onMouseEnter={() => setHovered('rec')}
              onMouseLeave={() => setHovered(null)}
              style={{ ...btnBase, color: '#ff6b6b', background: hovered === 'rec' ? 'var(--pixel-btn-hover-bg)' : btnBase.background }}
              title={t.recording}
            >
              {'\u25CF'}
            </button>
            <button
              onClick={onOpenRecordingList}
              onMouseEnter={() => setHovered('reclist')}
              onMouseLeave={() => setHovered(null)}
              style={{ ...btnBase, background: hovered === 'reclist' ? 'var(--pixel-btn-hover-bg)' : btnBase.background }}
              title={t.recordingList}
            >
              {'\u25B6'}
            </button>
          </>
        )}
        {recorderState === 'recording' && (
          <>
            <button
              onClick={onStopRecording}
              style={{ ...btnBase, color: '#ff6b6b' }}
              title={t.stopRecording}
            >
              {'\u25A0'}
            </button>
            <span style={{ fontSize: '20px', color: '#ff6b6b', minWidth: 48 }}>
              {t.recordingDuration(recordingDuration)}
            </span>
          </>
        )}
        {recorderState === 'playing' && (
          <>
            <button
              onClick={onStopPlayback}
              style={{ ...btnBase, color: 'var(--pixel-accent)' }}
              title={t.stopPlayback}
            >
              {'\u25A0'}
            </button>
            <div
              style={{ width: 80, height: 12, background: 'var(--pixel-btn-bg)', border: '1px solid var(--pixel-border)', cursor: 'pointer', position: 'relative' }}
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect()
                onSeekPlayback((e.clientX - rect.left) / rect.width)
              }}
            >
              <div style={{ width: `${playbackProgress * 100}%`, height: '100%', background: 'var(--pixel-accent)' }} />
            </div>
            <span style={{ fontSize: '18px', color: 'var(--pixel-text-dim)' }}>{t.playback}</span>
          </>
        )}
      </div>
      {!isBuildingViewOpen && (
        <FloorSelector
          floors={floors}
          currentFloorId={currentFloorId}
          onSwitchFloor={onSwitchFloor}
        />
      )}
    </div>
  )
})
