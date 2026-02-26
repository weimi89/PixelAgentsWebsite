import { useState, useCallback, useRef } from 'react'
import type { OfficeState } from '../office/engine/officeState.js'
import type { EditorState } from '../office/editor/editorState.js'
import { EditTool } from '../office/types.js'
import { TileType } from '../office/types.js'
import type { OfficeLayout, EditTool as EditToolType, TileType as TileTypeVal, FloorColor, PlacedFurniture } from '../office/types.js'
import { paintTile, placeFurniture, removeFurniture, moveFurniture, rotateFurniture, toggleFurnitureState, canPlaceFurniture, getWallPlacementRow, expandLayout } from '../office/editor/editorActions.js'
import type { ExpandDirection } from '../office/editor/editorActions.js'
import { getCatalogEntry, getRotatedType, getToggledType } from '../office/layout/furnitureCatalog.js'
import { defaultZoom } from '../office/toolUtils.js'
import { vscode } from '../socketApi.js'
import { LAYOUT_SAVE_DEBOUNCE_MS, ZOOM_MIN, ZOOM_MAX } from '../constants.js'

export interface EditorActions {
  isEditMode: boolean
  editorTick: number
  isDirty: boolean
  zoom: number
  panRef: React.MutableRefObject<{ x: number; y: number }>
  saveTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  setLastSavedLayout: (layout: OfficeLayout) => void
  handleOpenClaude: () => void
  handleToggleEditMode: () => void
  handleToolChange: (tool: EditToolType) => void
  handleTileTypeChange: (type: TileTypeVal) => void
  handleFloorColorChange: (color: FloorColor) => void
  handleWallColorChange: (color: FloorColor) => void
  handleSelectedFurnitureColorChange: (color: FloorColor | null) => void
  handleFurnitureTypeChange: (type: string) => void // FurnitureType 列舉或素材 ID
  handleDeleteSelected: () => void
  handleRotateSelected: () => void
  handleToggleState: () => void
  handleUndo: () => void
  handleRedo: () => void
  handleReset: () => void
  handleSave: () => void
  handleZoomChange: (zoom: number) => void
  handleEditorTileAction: (col: number, row: number) => void
  handleEditorEraseAction: (col: number, row: number) => void
  handleEditorSelectionChange: () => void
  handleDragMove: (uid: string, newCol: number, newRow: number) => void
}

export function useEditorActions(
  getOfficeState: () => OfficeState,
  editorState: EditorState,
): EditorActions {
  const [isEditMode, setIsEditMode] = useState(false)
  const [editorTick, setEditorTick] = useState(0)
  const [isDirty, setIsDirty] = useState(false)
  const [zoom, setZoom] = useState(defaultZoom)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panRef = useRef({ x: 0, y: 0 })
  const lastSavedLayoutRef = useRef<OfficeLayout | null>(null)

  // 由 useExtensionMessages 在 layoutLoaded 時呼叫，設定初始檢查點
  const setLastSavedLayout = useCallback((layout: OfficeLayout) => {
    lastSavedLayoutRef.current = structuredClone(layout)
  }, [])

  // 防抖的佈局儲存
  const saveLayout = useCallback((layout: OfficeLayout) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      vscode.postMessage({ type: 'saveLayout', layout })
    }, LAYOUT_SAVE_DEBOUNCE_MS)
  }, [])

  // 套用佈局編輯：推入復原堆疊、清除重做堆疊、重建狀態、儲存、標記為已修改
  const applyEdit = useCallback((newLayout: OfficeLayout) => {
    const os = getOfficeState()
    editorState.pushUndo(os.getLayout())
    editorState.clearRedo()
    editorState.isDirty = true
    setIsDirty(true)
    os.rebuildFromLayout(newLayout)
    saveLayout(newLayout)
    setEditorTick((n) => n + 1)
  }, [getOfficeState, editorState, saveLayout])

  const handleOpenClaude = useCallback(() => {
    vscode.postMessage({ type: 'openClaude' })
  }, [])

  const handleToggleEditMode = useCallback(() => {
    setIsEditMode((prev) => {
      const next = !prev
      editorState.isEditMode = next
      if (next) {
        // 從現有牆磚初始化 wallColor，使新牆壁顏色一致
        const os = getOfficeState()
        const layout = os.getLayout()
        if (layout.tileColors) {
          for (let i = 0; i < layout.tiles.length; i++) {
            if (layout.tiles[i] === TileType.WALL && layout.tileColors[i]) {
              editorState.wallColor = { ...layout.tileColors[i]! }
              break
            }
          }
        }
      } else {
        editorState.clearSelection()
        editorState.clearGhost()
        editorState.clearDrag()
        wallColorEditActiveRef.current = false
      }
      return next
    })
  }, [editorState, getOfficeState])

  // 工具切換：點擊已啟用的工具會取消選取（回到 SELECT）
  const handleToolChange = useCallback((tool: EditToolType) => {
    if (editorState.activeTool === tool) {
      editorState.activeTool = EditTool.SELECT
    } else {
      editorState.activeTool = tool
    }
    editorState.clearSelection()
    editorState.clearGhost()
    editorState.clearDrag()
    colorEditUidRef.current = null
    wallColorEditActiveRef.current = false
    setEditorTick((n) => n + 1)
  }, [editorState])

  const handleTileTypeChange = useCallback((type: TileTypeVal) => {
    editorState.selectedTileType = type
    setEditorTick((n) => n + 1)
  }, [editorState])

  const handleFloorColorChange = useCallback((color: FloorColor) => {
    editorState.floorColor = color
    setEditorTick((n) => n + 1)
  }, [editorState])

  // 追蹤當前牆壁顏色編輯會話是否已推入復原記錄
  const wallColorEditActiveRef = useRef(false)

  const handleWallColorChange = useCallback((color: FloorColor) => {
    editorState.wallColor = color

    // 將所有現有牆磚更新為新顏色
    const os = getOfficeState()
    const layout = os.getLayout()
    const existingColors = layout.tileColors || new Array(layout.tiles.length).fill(null)
    const newColors = [...existingColors]
    let changed = false
    for (let i = 0; i < layout.tiles.length; i++) {
      if (layout.tiles[i] === TileType.WALL) {
        newColors[i] = { ...color }
        changed = true
      }
    }
    if (changed) {
      // 每次編輯會話只推入一次復原記錄（首次拖動滑桿時）
      if (!wallColorEditActiveRef.current) {
        editorState.pushUndo(layout)
        editorState.clearRedo()
        wallColorEditActiveRef.current = true
      }
      const newLayout = { ...layout, tileColors: newColors }
      editorState.isDirty = true
      setIsDirty(true)
      os.rebuildFromLayout(newLayout)
      saveLayout(newLayout)
    }
    setEditorTick((n) => n + 1)
  }, [editorState, getOfficeState, saveLayout])

  // 追蹤顏色編輯期間已為哪個 uid 推入復原記錄
  // 避免拖動滑桿產生 N 個復原條目
  const colorEditUidRef = useRef<string | null>(null)

  const handleSelectedFurnitureColorChange = useCallback((color: FloorColor | null) => {
    const uid = editorState.selectedFurnitureUid
    if (!uid) return
    const os = getOfficeState()
    const layout = os.getLayout()

    // 每次選取只推入一次復原記錄（首次拖動滑桿時）
    if (colorEditUidRef.current !== uid) {
      editorState.pushUndo(layout)
      editorState.clearRedo()
      colorEditUidRef.current = uid
    }

    // 更新已放置家具的顏色（null 移除顏色）
    const newFurniture = layout.furniture.map((f) =>
      f.uid === uid ? { ...f, color: color ?? undefined } : f,
    )
    const newLayout = { ...layout, furniture: newFurniture }

    editorState.isDirty = true
    setIsDirty(true)
    os.rebuildFromLayout(newLayout)
    saveLayout(newLayout)
    setEditorTick((n) => n + 1)
  }, [getOfficeState, editorState, saveLayout])

  const handleFurnitureTypeChange = useCallback((type: string) => {
    // 點擊相同物件會取消選取（無幽靈預覽），維持在家具模式
    if (editorState.selectedFurnitureType === type) {
      editorState.selectedFurnitureType = ''
      editorState.clearGhost()
    } else {
      editorState.selectedFurnitureType = type
    }
    setEditorTick((n) => n + 1)
  }, [editorState])

  const handleDeleteSelected = useCallback(() => {
    const uid = editorState.selectedFurnitureUid
    if (!uid) return
    const os = getOfficeState()
    const newLayout = removeFurniture(os.getLayout(), uid)
    if (newLayout !== os.getLayout()) {
      applyEdit(newLayout)
      editorState.clearSelection()
      colorEditUidRef.current = null
    }
  }, [getOfficeState, editorState, applyEdit])

  const handleRotateSelected = useCallback(() => {
    // 若在家具放置模式，在旋轉群組中循環所選類型
    if (editorState.activeTool === EditTool.FURNITURE_PLACE) {
      const rotated = getRotatedType(editorState.selectedFurnitureType, 'cw')
      if (rotated) {
        editorState.selectedFurnitureType = rotated
        setEditorTick((n) => n + 1)
      }
      return
    }
    // 否則旋轉已選取的放置家具
    const uid = editorState.selectedFurnitureUid
    if (!uid) return
    const os = getOfficeState()
    const newLayout = rotateFurniture(os.getLayout(), uid, 'cw')
    if (newLayout !== os.getLayout()) {
      applyEdit(newLayout)
    }
  }, [getOfficeState, editorState, applyEdit])

  const handleToggleState = useCallback(() => {
    // 若在家具放置模式，切換所選類型的狀態
    if (editorState.activeTool === EditTool.FURNITURE_PLACE) {
      const toggled = getToggledType(editorState.selectedFurnitureType)
      if (toggled) {
        editorState.selectedFurnitureType = toggled
        setEditorTick((n) => n + 1)
      }
      return
    }
    // 否則切換已選取的放置家具的狀態
    const uid = editorState.selectedFurnitureUid
    if (!uid) return
    const os = getOfficeState()
    const newLayout = toggleFurnitureState(os.getLayout(), uid)
    if (newLayout !== os.getLayout()) {
      applyEdit(newLayout)
    }
  }, [getOfficeState, editorState, applyEdit])

  const handleUndo = useCallback(() => {
    const prev = editorState.popUndo()
    if (!prev) return
    const os = getOfficeState()
    // 恢復前將當前佈局推入重做堆疊
    editorState.pushRedo(os.getLayout())
    os.rebuildFromLayout(prev)
    saveLayout(prev)
    editorState.isDirty = true
    setIsDirty(true)
    setEditorTick((n) => n + 1)
  }, [getOfficeState, editorState, saveLayout])

  const handleRedo = useCallback(() => {
    const next = editorState.popRedo()
    if (!next) return
    const os = getOfficeState()
    // 恢復前將當前佈局推入復原堆疊
    editorState.pushUndo(os.getLayout())
    os.rebuildFromLayout(next)
    saveLayout(next)
    editorState.isDirty = true
    setIsDirty(true)
    setEditorTick((n) => n + 1)
  }, [getOfficeState, editorState, saveLayout])

  const handleReset = useCallback(() => {
    if (!lastSavedLayoutRef.current) return
    const saved = structuredClone(lastSavedLayoutRef.current)
    applyEdit(saved)
    editorState.reset()
    setIsDirty(false)
  }, [editorState, applyEdit])

  const handleSave = useCallback(() => {
    // 立即執行任何待處理的防抖儲存
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const os = getOfficeState()
    const layout = os.getLayout()
    lastSavedLayoutRef.current = structuredClone(layout)
    vscode.postMessage({ type: 'saveLayout', layout })
    editorState.isDirty = false
    setIsDirty(false)
  }, [getOfficeState, editorState])

  // 通知 React 命令式的編輯器選取已變更（例如來自 OfficeCanvas 的 mouseUp）
  const handleEditorSelectionChange = useCallback(() => {
    colorEditUidRef.current = null
    setEditorTick((n) => n + 1)
  }, [])

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom)))
  }, [])

  const handleDragMove = useCallback((uid: string, newCol: number, newRow: number) => {
    const os = getOfficeState()
    const layout = os.getLayout()
    const newLayout = moveFurniture(layout, uid, newCol, newRow)
    if (newLayout !== layout) {
      applyEdit(newLayout)
    }
  }, [getOfficeState, applyEdit])

  /**
   * 若點擊在幽靈邊框格（超出當前邊界），則擴展佈局。
   * 回傳擴展後的佈局和調整後的 col/row，若不需要擴展則回傳 null。
   */
  const maybeExpand = useCallback((layout: OfficeLayout, col: number, row: number): { layout: OfficeLayout; col: number; row: number; shift: { col: number; row: number } } | null => {
    if (col >= 0 && col < layout.cols && row >= 0 && row < layout.rows) return null

    // 判斷需要擴展的方向
    const directions: ExpandDirection[] = []
    if (col < 0) directions.push('left')
    if (col >= layout.cols) directions.push('right')
    if (row < 0) directions.push('up')
    if (row >= layout.rows) directions.push('down')

    let current = layout
    let totalShiftCol = 0
    let totalShiftRow = 0
    for (const dir of directions) {
      const result = expandLayout(current, dir)
      if (!result) return null // 超過最大值
      current = result.layout
      totalShiftCol += result.shift.col
      totalShiftRow += result.shift.row
    }

    return {
      layout: current,
      col: col + totalShiftCol,
      row: row + totalShiftRow,
      shift: { col: totalShiftCol, row: totalShiftRow },
    }
  }, [])

  const handleEditorTileAction = useCallback((col: number, row: number) => {
    const os = getOfficeState()
    let layout = os.getLayout()
    let effectiveCol = col
    let effectiveRow = row

    // 處理地板/牆壁工具的幽靈邊框擴展
    if (editorState.activeTool === EditTool.TILE_PAINT || editorState.activeTool === EditTool.WALL_PAINT) {
      const expansion = maybeExpand(layout, col, row)
      if (expansion) {
        layout = expansion.layout
        effectiveCol = expansion.col
        effectiveRow = expansion.row
        // 先從擴展後的佈局重建，同時偏移角色位置
        os.rebuildFromLayout(layout, expansion.shift)
      }
    }

    if (editorState.activeTool === EditTool.TILE_PAINT) {
      const newLayout = paintTile(layout, effectiveCol, effectiveRow, editorState.selectedTileType, editorState.floorColor)
      if (newLayout !== layout) {
        applyEdit(newLayout)
      }
    } else if (editorState.activeTool === EditTool.WALL_PAINT) {
      const idx = effectiveRow * layout.cols + effectiveCol
      const isWall = layout.tiles[idx] === TileType.WALL

      // 拖曳的第一格決定方向
      if (editorState.wallDragAdding === null) {
        editorState.wallDragAdding = !isWall
      }

      if (editorState.wallDragAdding) {
        // 新增帶顏色的牆壁
        const newLayout = paintTile(layout, effectiveCol, effectiveRow, TileType.WALL, editorState.wallColor)
        if (newLayout !== layout) {
          applyEdit(newLayout)
        }
      } else {
        // 移除牆壁 → 用當前地板設定繪製地板
        if (isWall) {
          const newLayout = paintTile(layout, effectiveCol, effectiveRow, editorState.selectedTileType, editorState.floorColor)
          if (newLayout !== layout) {
            applyEdit(newLayout)
          }
        }
      }
    } else if (editorState.activeTool === EditTool.ERASE) {
      if (col < 0 || col >= layout.cols || row < 0 || row >= layout.rows) return
      const idx = row * layout.cols + col
      if (layout.tiles[idx] === TileType.VOID) return
      const newLayout = paintTile(layout, col, row, TileType.VOID)
      if (newLayout !== layout) {
        applyEdit(newLayout)
      }
    } else if (editorState.activeTool === EditTool.FURNITURE_PLACE) {
      const type = editorState.selectedFurnitureType
      if (type === '') {
        // 未選取物件 — 作為 SELECT 工具運作（尋找家具命中）
        const hit = layout.furniture.find((f) => {
          const entry = getCatalogEntry(f.type)
          if (!entry) return false
          return col >= f.col && col < f.col + entry.footprintW && row >= f.row && row < f.row + entry.footprintH
        })
        editorState.selectedFurnitureUid = hit ? hit.uid : null
        setEditorTick((n) => n + 1)
      } else {
        const placementRow = getWallPlacementRow(type, row)
        if (!canPlaceFurniture(layout, type, col, placementRow)) return
        const uid = `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        const placed: PlacedFurniture = { uid, type, col, row: placementRow }
        if (editorState.pickedFurnitureColor) {
          placed.color = { ...editorState.pickedFurnitureColor }
        }
        const newLayout = placeFurniture(layout, placed)
        if (newLayout !== layout) {
          applyEdit(newLayout)
        }
      }
    } else if (editorState.activeTool === EditTool.FURNITURE_PICK) {
      // 找到點擊格上的家具，複製其類型和顏色以供放置
      const hit = layout.furniture.find((f) => {
        const entry = getCatalogEntry(f.type)
        if (!entry) return false
        return col >= f.col && col < f.col + entry.footprintW && row >= f.row && row < f.row + entry.footprintH
      })
      if (hit) {
        editorState.selectedFurnitureType = hit.type
        editorState.pickedFurnitureColor = hit.color ? { ...hit.color } : null
        editorState.activeTool = EditTool.FURNITURE_PLACE
      }
      setEditorTick((n) => n + 1)
    } else if (editorState.activeTool === EditTool.EYEDROPPER) {
      const idx = row * layout.cols + col
      const tile = layout.tiles[idx]
      if (tile !== undefined && tile !== TileType.WALL && tile !== TileType.VOID) {
        editorState.selectedTileType = tile
        const color = layout.tileColors?.[idx]
        if (color) {
          editorState.floorColor = { ...color }
        }
        editorState.activeTool = EditTool.TILE_PAINT
      } else if (tile === TileType.WALL) {
        // 吸取牆壁顏色並切換至牆壁工具
        const color = layout.tileColors?.[idx]
        if (color) {
          editorState.wallColor = { ...color }
        }
        editorState.activeTool = EditTool.WALL_PAINT
      }
      setEditorTick((n) => n + 1)
    } else if (editorState.activeTool === EditTool.SELECT) {
      const hit = layout.furniture.find((f) => {
        const entry = getCatalogEntry(f.type)
        if (!entry) return false
        return col >= f.col && col < f.col + entry.footprintW && row >= f.row && row < f.row + entry.footprintH
      })
      editorState.selectedFurnitureUid = hit ? hit.uid : null
      setEditorTick((n) => n + 1)
    }
  }, [getOfficeState, editorState, applyEdit, maybeExpand])

  const handleEditorEraseAction = useCallback((col: number, row: number) => {
    const os = getOfficeState()
    const layout = os.getLayout()
    if (col < 0 || col >= layout.cols || row < 0 || row >= layout.rows) return
    const idx = row * layout.cols + col
    // 只清除非 VOID 的格
    if (layout.tiles[idx] === TileType.VOID) return
    const newLayout = paintTile(layout, col, row, TileType.VOID)
    if (newLayout !== layout) {
      applyEdit(newLayout)
    }
  }, [getOfficeState, applyEdit])

  return {
    isEditMode,
    editorTick,
    isDirty,
    zoom,
    panRef,
    saveTimerRef,
    setLastSavedLayout,
    handleOpenClaude,
    handleToggleEditMode,
    handleToolChange,
    handleTileTypeChange,
    handleFloorColorChange,
    handleWallColorChange,
    handleSelectedFurnitureColorChange,
    handleFurnitureTypeChange,
    handleDeleteSelected,
    handleRotateSelected,
    handleToggleState,
    handleUndo,
    handleRedo,
    handleReset,
    handleSave,
    handleZoomChange,
    handleEditorTileAction,
    handleEditorEraseAction,
    handleEditorSelectionChange,
    handleDragMove,
  }
}
