import { useState, useCallback, useEffect } from 'react'
import { vscode, onServerMessage } from '../socketApi.js'
import type { SessionInfo } from '../components/SessionPicker.js'
import type { ServerMessage } from '../types/messages.js'

export interface PanelManagerParams {
  isEditMode: boolean
  handleToggleEditMode: () => void
}

export interface PanelManagerState {
  isSettingsOpen: boolean
  isSessionPickerOpen: boolean
  isBuildingViewOpen: boolean
  isDashboardView: boolean
  isBehaviorEditorOpen: boolean
  sessions: SessionInfo[]
  isLoadingSessions: boolean
  closeAllPanels: () => void
  handleToggleEditModeExclusive: () => void
  handleToggleBuildingView: () => void
  handleSwitchFloor: (floorId: string) => void
  handleOpenSessionPicker: () => void
  handleToggleSettings: () => void
  handleToggleBehaviorEditor: () => void
  handleResumeSession: (sessionId: string, projectDir: string) => void
  handleExcludeProject: (dirBasename: string) => void
  handleIncludeProject: (dirBasename: string) => void
  handleToggleDashboardView: () => void
  setIsSessionPickerOpen: (open: boolean) => void
  setIsBuildingViewOpen: (open: boolean) => void
}

/**
 * 面板互斥管理 hook — 設定、工作階段選擇器、大樓面板、儀表板的開閉控制。
 * 同時只能開啟一個面板。
 */
export function usePanelManager({ isEditMode, handleToggleEditMode }: PanelManagerParams): PanelManagerState {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSessionPickerOpen, setIsSessionPickerOpen] = useState(false)
  const [isBuildingViewOpen, setIsBuildingViewOpen] = useState(false)
  const [isDashboardView, setIsDashboardView] = useState(false)
  const [isBehaviorEditorOpen, setIsBehaviorEditorOpen] = useState(false)
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)

  // 關閉所有底部工具列面板（互斥：同時只能開一個）
  const closeAllPanels = useCallback(() => {
    setIsSettingsOpen(false)
    setIsSessionPickerOpen(false)
    setIsBuildingViewOpen(false)
    setIsDashboardView(false)
    setIsBehaviorEditorOpen(false)
    if (isEditMode) handleToggleEditMode()
  }, [isEditMode, handleToggleEditMode])

  // 進入佈局編輯時，只關閉其他面板（不遞迴觸發 edit mode toggle）
  const handleToggleEditModeExclusive = useCallback(() => {
    if (!isEditMode) {
      setIsSettingsOpen(false)
      setIsSessionPickerOpen(false)
      setIsBuildingViewOpen(false)
      setIsDashboardView(false)
      setIsBehaviorEditorOpen(false)
    }
    handleToggleEditMode()
  }, [isEditMode, handleToggleEditMode])

  const handleToggleBuildingView = useCallback(() => {
    if (isBuildingViewOpen) {
      setIsBuildingViewOpen(false)
    } else {
      closeAllPanels()
      setIsBuildingViewOpen(true)
    }
  }, [isBuildingViewOpen, closeAllPanels])

  const handleSwitchFloor = useCallback((floorId: string) => {
    vscode.postMessage({ type: 'switchFloor', floorId })
  }, [])

  const handleOpenSessionPicker = useCallback(() => {
    closeAllPanels()
    setIsSessionPickerOpen(true)
    setIsLoadingSessions(true)
    vscode.postMessage({ type: 'listSessions' })
    vscode.postMessage({ type: 'listProjectDirs' })
  }, [closeAllPanels])

  const handleToggleSettings = useCallback(() => {
    if (isSettingsOpen) {
      setIsSettingsOpen(false)
    } else {
      closeAllPanels()
      setIsSettingsOpen(true)
    }
  }, [isSettingsOpen, closeAllPanels])

  const handleResumeSession = useCallback((sessionId: string, projectDir: string) => {
    vscode.postMessage({ type: 'resumeSession', sessionId, projectDir })
    setIsSessionPickerOpen(false)
  }, [])

  const handleExcludeProject = useCallback((dirBasename: string) => {
    vscode.postMessage({ type: 'excludeProject', projectDir: dirBasename })
    // 重新獲取 sessions 和目錄清單以反映排除
    vscode.postMessage({ type: 'listSessions' })
    vscode.postMessage({ type: 'listProjectDirs' })
  }, [])

  const handleIncludeProject = useCallback((dirBasename: string) => {
    vscode.postMessage({ type: 'includeProject', projectDir: dirBasename })
    // 重新獲取 sessions 和目錄清單以反映恢復
    vscode.postMessage({ type: 'listSessions' })
    vscode.postMessage({ type: 'listProjectDirs' })
  }, [])

  const handleToggleBehaviorEditor = useCallback(() => {
    if (isBehaviorEditorOpen) {
      setIsBehaviorEditorOpen(false)
    } else {
      closeAllPanels()
      setIsBehaviorEditorOpen(true)
    }
  }, [isBehaviorEditorOpen, closeAllPanels])

  const handleToggleDashboardView = useCallback(() => {
    if (isDashboardView) {
      setIsDashboardView(false)
    } else {
      closeAllPanels()
      setIsDashboardView(true)
    }
  }, [isDashboardView, closeAllPanels])

  // 監聽 sessionsList 訊息
  useEffect(() => {
    const unsub = onServerMessage((data) => {
      const msg = data as ServerMessage
      if (msg.type === 'sessionsList') {
        setSessions(msg.sessions)
        setIsLoadingSessions(false)
      }
    })
    return unsub
  }, [])

  return {
    isSettingsOpen,
    isSessionPickerOpen,
    isBuildingViewOpen,
    isDashboardView,
    isBehaviorEditorOpen,
    sessions,
    isLoadingSessions,
    closeAllPanels,
    handleToggleEditModeExclusive,
    handleToggleBuildingView,
    handleSwitchFloor,
    handleOpenSessionPicker,
    handleToggleSettings,
    handleToggleBehaviorEditor,
    handleResumeSession,
    handleExcludeProject,
    handleIncludeProject,
    handleToggleDashboardView,
    setIsSessionPickerOpen,
    setIsBuildingViewOpen,
  }
}
