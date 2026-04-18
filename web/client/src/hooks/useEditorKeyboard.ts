import { useEffect } from 'react'
import type { EditorState } from '../office/editor/editorState.js'
import { EditTool } from '../office/types.js'

export function useEditorKeyboard(
  isEditMode: boolean,
  editorState: EditorState,
  onDeleteSelected: () => void,
  onRotateSelected: () => void,
  onFlipSelected: () => void,
  onVFlipSelected: () => void,
  onToggleState: () => void,
  onUndo: () => void,
  onRedo: () => void,
  onEditorTick: () => void,
  onCloseEditMode: () => void,
): void {
  useEffect(() => {
    if (!isEditMode) return
    const handler = (e: KeyboardEvent) => {
      // 當焦點在輸入元素上時跳過（例如設定面板）
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'Escape') {
        // 多階段 Esc：取消選取物件 → 關閉工具 → 取消選取已放置物件 → 關閉編輯器
        if (editorState.activeTool === EditTool.FURNITURE_PICK) {
          editorState.activeTool = EditTool.FURNITURE_PLACE
          editorState.clearGhost()
        } else if (editorState.activeTool === EditTool.FURNITURE_PLACE && editorState.selectedFurnitureType !== '') {
          editorState.selectedFurnitureType = ''
          editorState.clearGhost()
        } else if (editorState.activeTool !== EditTool.SELECT) {
          editorState.activeTool = EditTool.SELECT
          editorState.clearGhost()
        } else if (editorState.selectedFurnitureUid) {
          editorState.clearSelection()
        } else {
          onCloseEditMode()
          return
        }
        editorState.clearDrag()
        onEditorTick()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // 避免 Backspace 觸發瀏覽器「返回上一頁」的歷史行為
        e.preventDefault()
        if (editorState.selectedFurnitureUid) {
          onDeleteSelected()
        }
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        onRotateSelected()
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        onFlipSelected()
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault()
        onVFlipSelected()
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        onToggleState()
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault()
        onUndo()
      } else if (
        (e.key === 'y' && (e.ctrlKey || e.metaKey)) ||
        (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)
      ) {
        e.preventDefault()
        onRedo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isEditMode, editorState, onDeleteSelected, onRotateSelected, onFlipSelected, onVFlipSelected, onToggleState, onUndo, onRedo, onEditorTick, onCloseEditMode])
}
