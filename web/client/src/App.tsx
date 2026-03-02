import { useState, useCallback, useRef, useEffect } from 'react'
import { OfficeState } from './office/engine/officeState.js'
import { OfficeCanvas } from './office/components/OfficeCanvas.js'
import { ToolOverlay } from './office/components/ToolOverlay.js'
import { EditorToolbar } from './office/editor/EditorToolbar.js'
import { EditorState } from './office/editor/editorState.js'
import { EditTool } from './office/types.js'
import { isRotatable } from './office/layout/furnitureCatalog.js'
import { vscode } from './socketApi.js'
import { useExtensionMessages } from './hooks/useExtensionMessages.js'
import { useEditorActions } from './hooks/useEditorActions.js'
import { useEditorKeyboard } from './hooks/useEditorKeyboard.js'
import { useConnectionState } from './hooks/useConnectionState.js'
import { useDisplaySettings } from './hooks/useDisplaySettings.js'
import { useTerminalTabs } from './hooks/useTerminalTabs.js'
import { useInteractionState } from './hooks/useInteractionState.js'
import { usePanelManager } from './hooks/usePanelManager.js'
import { ZoomControls } from './components/ZoomControls.js'
import { BottomToolbar } from './components/BottomToolbar.js'
import { DebugView } from './components/DebugView.js'
import { AgentLabels } from './components/AgentLabels.js'
import { SessionPicker } from './components/SessionPicker.js'
import { BuildingView } from './components/BuildingView.js'
import { ChatPanel } from './components/ChatPanel.js'
import { AgentDetailPanel } from './components/AgentDetailPanel.js'
import { ContextMenu } from './components/ContextMenu.js'
import type { ContextMenuAction } from './components/ContextMenu.js'
import { TerminalPanel } from './components/TerminalPanel.js'
import { BehaviorEditorModal } from './components/BehaviorEditorModal.js'
import { RecordingListModal } from './components/RecordingListModal.js'
import { Recorder } from './office/engine/recorder.js'
import type { RecordingState, RecordingFrame } from './office/engine/recorder.js'
import { saveRecording } from './office/engine/recordingStorage.js'
import { Dashboard } from './pages/Dashboard.js'
import { t } from './i18n.js'

// 遊戲狀態存在於 React 之外 — 由訊息處理器以命令式方式更新
const officeStateRef = { current: null as OfficeState | null }
const editorState = new EditorState()
const recorderInstance = new Recorder()

function getOfficeState(): OfficeState {
  if (!officeStateRef.current) {
    officeStateRef.current = new OfficeState()
  }
  return officeStateRef.current
}

const actionBarBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '22px',
  background: 'var(--pixel-btn-bg)',
  color: 'var(--pixel-text-dim)',
  border: '2px solid transparent',
  borderRadius: 0,
  cursor: 'pointer',
}

const actionBarBtnDisabled: React.CSSProperties = {
  ...actionBarBtnStyle,
  opacity: 'var(--pixel-btn-disabled-opacity)',
  cursor: 'default',
}

function EditActionBar({ editor, editorState: es }: { editor: ReturnType<typeof useEditorActions>; editorState: EditorState }) {
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const undoDisabled = es.undoStack.length === 0
  const redoDisabled = es.redoStack.length === 0

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 'var(--pixel-controls-z)',
        display: 'flex',
        gap: 4,
        alignItems: 'center',
        background: 'var(--pixel-bg)',
        border: '2px solid var(--pixel-border)',
        borderRadius: 0,
        padding: '4px 8px',
        boxShadow: 'var(--pixel-shadow)',
      }}
    >
      <button
        style={undoDisabled ? actionBarBtnDisabled : actionBarBtnStyle}
        onClick={undoDisabled ? undefined : editor.handleUndo}
        title={t.undoShortcut}
      >
        {t.undo}
      </button>
      <button
        style={redoDisabled ? actionBarBtnDisabled : actionBarBtnStyle}
        onClick={redoDisabled ? undefined : editor.handleRedo}
        title={t.redoShortcut}
      >
        {t.redo}
      </button>
      <button
        style={actionBarBtnStyle}
        onClick={editor.handleSave}
        title={t.saveLayout}
      >
        {t.save}
      </button>
      {!showResetConfirm ? (
        <button
          style={actionBarBtnStyle}
          onClick={() => setShowResetConfirm(true)}
          title={t.resetToLastSaved}
        >
          {t.reset}
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: '22px', color: 'var(--pixel-reset-text)' }}>{t.resetConfirm}</span>
          <button
            style={{ ...actionBarBtnStyle, background: 'var(--pixel-danger-bg)', color: '#fff' }}
            onClick={() => { setShowResetConfirm(false); editor.handleReset() }}
          >
            {t.yes}
          </button>
          <button
            style={actionBarBtnStyle}
            onClick={() => setShowResetConfirm(false)}
          >
            {t.no}
          </button>
        </div>
      )}
    </div>
  )
}

function App() {
  const editor = useEditorActions(getOfficeState, editorState)

  const isEditDirty = useCallback(() => editor.isEditMode && editor.isDirty, [editor.isEditMode, editor.isDirty])

  const display = useDisplaySettings()

  const { agents, selectedAgent, agentTools, agentStatuses, agentModels, subagentTools, subagentCharacters, layoutReady, loadedAssets, agentProjects, remoteAgents, agentTranscripts, projectDirs, currentFloorId, building, floorSummaries, chatMessages, agentGitBranches, agentStatusHistory, agentTeams, agentCliTypes, lanPeers, agentGrowthData } = useExtensionMessages(getOfficeState, editor.setLastSavedLayout, isEditDirty, editor.handleZoomChange, display.handleUiScaleLoaded)

  const connected = useConnectionState()

  const panels = usePanelManager({ isEditMode: editor.isEditMode, handleToggleEditMode: editor.handleToggleEditMode })

  const terminal = useTerminalTabs(agentProjects)

  const interaction = useInteractionState(getOfficeState)

  const containerRef = useRef<HTMLDivElement>(null)

  // 錄製/回放狀態
  const [recorderState, setRecorderState] = useState<RecordingState>('idle')
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [playbackProgress, setPlaybackProgress] = useState(0)
  const [isRecordingListOpen, setIsRecordingListOpen] = useState(false)

  useEffect(() => {
    recorderInstance.onStateChange = setRecorderState
    recorderInstance.onPlaybackProgress = setPlaybackProgress
    recorderInstance.onRecordingTick = setRecordingDuration
  }, [])

  const handleStartRecording = useCallback(() => {
    recorderInstance.startRecording()
  }, [])

  const handleStopRecording = useCallback(async () => {
    const result = recorderInstance.stopRecording()
    if (result) {
      await saveRecording(result.meta, result.frames)
    }
  }, [])

  const handleStopPlayback = useCallback(() => {
    recorderInstance.stopPlayback(getOfficeState())
  }, [])

  const handlePlayRecording = useCallback((frames: RecordingFrame[]) => {
    recorderInstance.startPlayback(frames, getOfficeState())
  }, [])

  const handleSeekPlayback = useCallback((progress: number) => {
    recorderInstance.seekTo(progress, getOfficeState())
  }, [])

  useEditorKeyboard(
    editor.isEditMode,
    editorState,
    editor.handleDeleteSelected,
    editor.handleRotateSelected,
    editor.handleToggleState,
    editor.handleUndo,
    editor.handleRedo,
    interaction.triggerEditorTickForKeyboard,
    panels.handleToggleEditModeExclusive,
  )

  // Space 鍵批准/關閉選取代理的氣泡，Ctrl+A 批准全部（非編輯模式）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editor.isEditMode) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === ' ') {
        e.preventDefault()
        const os = getOfficeState()
        const selId = os.selectedAgentId
        if (selId != null) {
          const ch = os.characters.get(selId)
          if (ch?.bubbleType === 'permission') {
            vscode.postMessage({ type: 'approvePermission', agentId: selId })
          }
          os.dismissBubble(selId)
        }
      }
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        const os = getOfficeState()
        let hasPermission = false
        for (const ch of os.characters.values()) {
          if (ch.bubbleType === 'permission') { hasPermission = true; break }
        }
        if (hasPermission) {
          e.preventDefault()
          vscode.postMessage({ type: 'approveAllPermissions' })
          for (const [id, ch] of os.characters) {
            if (ch.bubbleType === 'permission') os.dismissBubble(id)
          }
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editor.isEditMode])

  const officeState = getOfficeState()

  // 強制依賴 editorTickForKeyboard 以傳播鍵盤觸發的重新渲染
  void interaction.editorTickForKeyboard

  // 當選取或正在放置可旋轉的物件時顯示「按 R 旋轉」提示
  const showRotateHint = editor.isEditMode && (() => {
    if (editorState.selectedFurnitureUid) {
      const item = officeState.getLayout().furniture.find((f) => f.uid === editorState.selectedFurnitureUid)
      if (item && isRotatable(item.type)) return true
    }
    if (editorState.activeTool === EditTool.FURNITURE_PLACE && isRotatable(editorState.selectedFurnitureType)) {
      return true
    }
    return false
  })()

  if (!layoutReady) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pixel-text)' }}>
        {t.loading}
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', '--pixel-ui-scale': display.uiScale } as React.CSSProperties}>
      {panels.isDashboardView ? (
        <Dashboard />
      ) : (
      <div style={{
        opacity: layoutReady ? 1 : 0,
        transition: 'opacity 0.2s ease-in-out',
        width: '100%',
        height: '100%',
      }}>
        <OfficeCanvas
          officeState={officeState}
          onClick={interaction.handleClick}
          isEditMode={editor.isEditMode}
          editorState={editorState}
          onEditorTileAction={editor.handleEditorTileAction}
          onEditorEraseAction={editor.handleEditorEraseAction}
          onEditorSelectionChange={editor.handleEditorSelectionChange}
          onDeleteSelected={editor.handleDeleteSelected}
          onRotateSelected={editor.handleRotateSelected}
          onDragMove={editor.handleDragMove}
          editorTick={editor.editorTick}
          zoom={editor.zoom}
          onZoomChange={editor.handleZoomChange}
          panRef={editor.panRef}
          dayNightEnabled={display.dayNightEnabled}
          dayNightTimeOverride={display.dayNightTimeOverride}
          onContextMenu={interaction.handleContextMenu}
          recorder={recorderInstance}
        />
      </div>
      )}

      {!panels.isDashboardView && <ZoomControls zoom={editor.zoom} onZoomChange={editor.handleZoomChange} />}

      {/* 斷線指示器 */}
      {!connected && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 80,
            zIndex: 'var(--pixel-controls-z)',
            background: 'var(--pixel-bg)',
            border: '2px solid var(--pixel-status-permission)',
            borderRadius: 0,
            padding: '4px 10px',
            boxShadow: 'var(--pixel-shadow)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--pixel-status-permission)',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: '20px', color: 'var(--pixel-status-permission)' }}>
            {t.disconnected}
          </span>
        </div>
      )}

      {/* 暈影覆蓋層 */}
      {!panels.isDashboardView && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--pixel-vignette)',
            pointerEvents: 'none',
            zIndex: 40,
          }}
        />
      )}

      <BottomToolbar
        isEditMode={editor.isEditMode}
        onToggleEditMode={panels.handleToggleEditModeExclusive}
        onOpenSessionPicker={panels.handleOpenSessionPicker}
        isDebugMode={display.isDebugMode}
        onToggleDebugMode={display.handleToggleDebugMode}
        floors={building?.floors ?? []}
        currentFloorId={currentFloorId}
        onSwitchFloor={panels.handleSwitchFloor}
        isBuildingViewOpen={panels.isBuildingViewOpen}
        onToggleBuildingView={panels.handleToggleBuildingView}
        dayNightEnabled={display.dayNightEnabled}
        onToggleDayNight={display.handleToggleDayNight}
        dayNightTimeOverride={display.dayNightTimeOverride}
        onDayNightTimeOverrideChange={display.handleDayNightTimeOverrideChange}
        isDashboardView={panels.isDashboardView}
        onToggleDashboardView={panels.handleToggleDashboardView}
        uiScale={display.uiScale}
        onUiScaleChange={display.handleUiScaleChange}
        lanPeers={lanPeers}
        isSettingsOpen={panels.isSettingsOpen}
        onToggleSettings={panels.handleToggleSettings}
        isBehaviorEditorOpen={panels.isBehaviorEditorOpen}
        onToggleBehaviorEditor={panels.handleToggleBehaviorEditor}
        recorderState={recorderState}
        recordingDuration={recordingDuration}
        playbackProgress={playbackProgress}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        onStopPlayback={handleStopPlayback}
        onOpenRecordingList={() => setIsRecordingListOpen(true)}
        onSeekPlayback={handleSeekPlayback}
      />

      <SessionPicker
        isOpen={panels.isSessionPickerOpen}
        onClose={() => panels.setIsSessionPickerOpen(false)}
        sessions={panels.sessions}
        onResume={panels.handleResumeSession}
        isLoading={panels.isLoadingSessions}
        projectDirs={projectDirs}
        onExcludeProject={panels.handleExcludeProject}
        onIncludeProject={panels.handleIncludeProject}
      />

      <BuildingView
        isOpen={panels.isBuildingViewOpen}
        onClose={() => panels.setIsBuildingViewOpen(false)}
        floors={building?.floors ?? []}
        currentFloorId={currentFloorId}
        floorSummaries={floorSummaries}
        onSwitchFloor={panels.handleSwitchFloor}
      />

      <BehaviorEditorModal
        isOpen={panels.isBehaviorEditorOpen}
        onClose={panels.handleToggleBehaviorEditor}
      />

      <RecordingListModal
        isOpen={isRecordingListOpen}
        onClose={() => setIsRecordingListOpen(false)}
        onPlay={handlePlayRecording}
      />

      <ChatPanel messages={chatMessages} />

      {!panels.isDashboardView && interaction.detailPanelAgentId != null && agents.includes(interaction.detailPanelAgentId) && (() => {
        // 組合代理資訊供面板使用
        const agentInfoMap: Record<number, { projectName?: string; isRemote?: boolean; owner?: string }> = {}
        for (const id of agents) {
          agentInfoMap[id] = {
            projectName: agentProjects[id],
            isRemote: !!remoteAgents[id],
            owner: remoteAgents[id]?.owner,
          }
        }
        return (
          <AgentDetailPanel
            agentId={interaction.detailPanelAgentId}
            agents={agentInfoMap}
            agentStatuses={agentStatuses}
            agentTools={agentTools}
            agentModels={agentModels}
            agentGitBranches={agentGitBranches}
            agentStatusHistory={agentStatusHistory}
            agentGrowthData={agentGrowthData}
            onClose={interaction.handleCloseDetailPanel}
          />
        )
      })()}

      {!panels.isDashboardView && editor.isEditMode && editor.isDirty && (
        <EditActionBar editor={editor} editorState={editorState} />
      )}

      {!panels.isDashboardView && showRotateHint && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: editor.isDirty ? 'translateX(calc(-50% + 100px))' : 'translateX(-50%)',
            zIndex: 49,
            background: 'var(--pixel-hint-bg)',
            color: '#fff',
            fontSize: '20px',
            padding: '3px 8px',
            borderRadius: 0,
            border: '2px solid var(--pixel-accent)',
            boxShadow: 'var(--pixel-shadow)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <span dangerouslySetInnerHTML={{ __html: t.pressRToRotate }} />
        </div>
      )}

      {!panels.isDashboardView && editor.isEditMode && (() => {
        // 從當前佈局計算所選家具的顏色和文字
        const selUid = editorState.selectedFurnitureUid
        const selItem = selUid
          ? officeState.getLayout().furniture.find((f) => f.uid === selUid)
          : null
        const selColor = selItem?.color ?? null
        const selText = selItem?.text ?? null
        const selIsPixelText = selItem?.text !== undefined
        return (
          <EditorToolbar
            activeTool={editorState.activeTool}
            selectedTileType={editorState.selectedTileType}
            selectedFurnitureType={editorState.selectedFurnitureType}
            selectedFurnitureUid={selUid}
            selectedFurnitureColor={selColor}
            selectedFurnitureText={selText}
            selectedFurnitureIsPixelText={selIsPixelText}
            floorColor={editorState.floorColor}
            wallColor={editorState.wallColor}
            onToolChange={editor.handleToolChange}
            onTileTypeChange={editor.handleTileTypeChange}
            onFloorColorChange={editor.handleFloorColorChange}
            onWallColorChange={editor.handleWallColorChange}
            onSelectedFurnitureColorChange={editor.handleSelectedFurnitureColorChange}
            onSelectedFurnitureTextChange={editor.handleSelectedFurnitureTextChange}
            onFurnitureTypeChange={editor.handleFurnitureTypeChange}
            loadedAssets={loadedAssets}
          />
        )
      })()}

      {!panels.isDashboardView && (
        <AgentLabels
          officeState={officeState}
          agents={agents}
          agentStatuses={agentStatuses}
          containerRef={containerRef}
          zoom={editor.zoom}
          panRef={editor.panRef}
          subagentCharacters={subagentCharacters}
        />
      )}

      {!panels.isDashboardView && (
        <ToolOverlay
          officeState={officeState}
          agents={agents}
          agentTools={agentTools}
          agentModels={agentModels}
          subagentCharacters={subagentCharacters}
          containerRef={containerRef}
          zoom={editor.zoom}
          panRef={editor.panRef}
          onCloseAgent={interaction.handleCloseAgent}
          agentProjects={agentProjects}
          remoteAgents={remoteAgents}
          agentTranscripts={agentTranscripts}
          agentGitBranches={agentGitBranches}
          agentTeams={agentTeams}
          agentCliTypes={agentCliTypes}
        />
      )}

      {!panels.isDashboardView && display.isDebugMode && (
        <DebugView
          agents={agents}
          selectedAgent={selectedAgent}
          agentTools={agentTools}
          agentStatuses={agentStatuses}
          subagentTools={subagentTools}
          onSelectAgent={interaction.handleSelectAgent}
        />
      )}

      {!panels.isDashboardView && terminal.terminalTabs.length > 0 && (
        <TerminalPanel
          tabs={terminal.terminalTabs}
          activeTabId={terminal.activeTerminalTabId}
          onSelectTab={terminal.setActiveTerminalTabId}
          onCloseTab={terminal.handleCloseTerminalTab}
          onClosePanel={terminal.handleCloseTerminalPanel}
        />
      )}

      {!panels.isDashboardView && interaction.contextMenu && (() => {
        const os = getOfficeState()
        const ch = os.characters.get(interaction.contextMenu.agentId)
        if (!ch) return null
        const isSubagent = ch.isSubagent
        const isRemote = !!remoteAgents[interaction.contextMenu.agentId]
        const meta = os.subagentMeta.get(interaction.contextMenu.agentId)
        const actions: ContextMenuAction[] = []
        if (isSubagent && meta) {
          actions.push({ label: t.contextFocusParent, onClick: () => {
            os.selectedAgentId = meta.parentAgentId
            os.cameraFollowId = meta.parentAgentId
          }})
        } else {
          actions.push({ label: t.contextGoToSeat, onClick: () => {
            os.sendToSeat(interaction.contextMenu!.agentId)
          }})
          actions.push({ label: t.contextFollowCamera, onClick: () => {
            os.selectedAgentId = interaction.contextMenu!.agentId
            os.cameraFollowId = interaction.contextMenu!.agentId
          }})
          if (building && building.floors.length > 1) {
            actions.push({ label: t.contextMoveFloor, onClick: () => {
              const targetFloor = building.floors.find((f) => f.id !== currentFloorId)
              if (targetFloor) {
                vscode.postMessage({ type: 'moveAgentToFloor', agentId: interaction.contextMenu!.agentId, targetFloorId: targetFloor.id })
              }
            }})
          }
          actions.push({ label: t.setTeam, onClick: () => {
            const current = agentTeams[interaction.contextMenu!.agentId] || ''
            const name = prompt(t.teamName, current)
            if (name !== null) {
              vscode.postMessage({ type: 'setAgentTeam', agentId: interaction.contextMenu!.agentId, teamName: name || null })
            }
          }})
          if (!isRemote) {
            actions.push({ label: t.openTerminal, onClick: () => {
              terminal.handleOpenTerminal(interaction.contextMenu!.agentId)
            }})
            actions.push({ label: t.closeAgent, onClick: () => {
              interaction.handleCloseAgent(interaction.contextMenu!.agentId)
            }})
          }
        }
        return (
          <ContextMenu
            x={interaction.contextMenu.x}
            y={interaction.contextMenu.y}
            actions={actions}
            onClose={interaction.handleCloseContextMenu}
          />
        )
      })()}
    </div>
  )
}

export default App
