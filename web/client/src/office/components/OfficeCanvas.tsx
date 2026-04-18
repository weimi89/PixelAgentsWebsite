import { useRef, useEffect, useCallback } from 'react'
import type { OfficeState } from '../engine/officeState.js'
import type { EditorState } from '../editor/editorState.js'
import type { EditorRenderState, SelectionRenderState, DeleteButtonBounds, RotateButtonBounds, MinimapBounds } from '../engine/renderer.js'
import type { Recorder } from '../engine/recorder.js'
import { startGameLoop } from '../engine/gameLoop.js'
import { renderFrame, renderMinimap } from '../engine/renderer.js'
import { TILE_SIZE, EditTool } from '../types.js'
import { CAMERA_FOLLOW_LERP, CAMERA_FOLLOW_SNAP_THRESHOLD, ZOOM_MIN, ZOOM_MAX, ZOOM_SCROLL_THRESHOLD, PAN_MARGIN_FRACTION, LONG_PRESS_DURATION_MS, TOUCH_PAN_THRESHOLD_PX, TOUCH_DOUBLE_TAP_MS, TOUCH_DOUBLE_TAP_DISTANCE_PX, TOUCH_PINCH_ZOOM_THRESHOLD } from '../../constants.js'
import { getDayPhase, getDayNightOverlay } from '../engine/dayNightCycle.js'
import { getCatalogEntry, isRotatable } from '../layout/furnitureCatalog.js'
import { canPlaceFurniture, getWallPlacementRow } from '../editor/editorActions.js'
import { vscode } from '../../socketApi.js'
import { unlockAudio } from '../../notificationSound.js'

interface OfficeCanvasProps {
  officeState: OfficeState
  onClick: (agentId: number) => void
  isEditMode: boolean
  editorState: EditorState
  onEditorTileAction: (col: number, row: number) => void
  onEditorEraseAction: (col: number, row: number) => void
  onEditorSelectionChange: () => void
  onDeleteSelected: () => void
  onRotateSelected: () => void
  onDragMove: (uid: string, newCol: number, newRow: number) => void
  editorTick: number
  zoom: number
  onZoomChange: (zoom: number) => void
  panRef: React.MutableRefObject<{ x: number; y: number }>
  dayNightEnabled?: boolean
  dayNightTimeOverride?: number | null
  onContextMenu?: (agentId: number, x: number, y: number) => void
  recorder?: Recorder | null
}

export function OfficeCanvas({ officeState, onClick, isEditMode, editorState, onEditorTileAction, onEditorEraseAction, onEditorSelectionChange, onDeleteSelected, onRotateSelected, onDragMove, editorTick: _editorTick, zoom, onZoomChange, panRef, dayNightEnabled, dayNightTimeOverride, onContextMenu: onContextMenuProp, recorder }: OfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef({ x: 0, y: 0 })
  // zoom 的 ref，使遊戲迴圈可讀取最新值而不需重啟
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  // 日夜循環 refs
  const dayNightEnabledRef = useRef(dayNightEnabled ?? true)
  dayNightEnabledRef.current = dayNightEnabled ?? true
  const dayNightTimeOverrideRef = useRef<number | null>(dayNightTimeOverride ?? null)
  dayNightTimeOverrideRef.current = dayNightTimeOverride ?? null
  // 中鍵平移狀態（命令式，不觸發重新渲染）
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 })
  // 刪除/旋轉按鈕邊界（由 renderer 每幀更新）
  const deleteButtonBoundsRef = useRef<DeleteButtonBounds | null>(null)
  const rotateButtonBoundsRef = useRef<RotateButtonBounds | null>(null)
  // 右鍵擦除拖曳
  const isEraseDraggingRef = useRef(false)
  // 迷你地圖邊界 + 顯示開關（預設隱藏，M 鍵切換）
  const minimapBoundsRef = useRef<MinimapBounds | null>(null)
  const showMinimapRef = useRef(false)
  // 縮放滾動累加器，用於觸控板縮放靈敏度
  const zoomAccumulatorRef = useRef(0)
  // 觸控手勢
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const touchModeRef = useRef<'none' | 'pan' | 'pinch' | 'tap' | 'edit-drag'>('none')
  const lastPinchDistRef = useRef(0)
  const lastTouchCenterRef = useRef<{ x: number; y: number } | null>(null)
  const doubleTapRef = useRef<{ time: number; x: number; y: number } | null>(null)
  const touchStartTimeRef = useRef(0)
  // 錄製/回放
  const recorderRef = useRef(recorder)
  recorderRef.current = recorder
  const gameTimeRef = useRef(0)

  // 限制平移範圍，使地圖邊緣不會超出視窗內的邊距
  const clampPan = useCallback((px: number, py: number): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: px, y: py }
    const layout = officeState.getLayout()
    const mapW = layout.cols * TILE_SIZE * zoom
    const mapH = layout.rows * TILE_SIZE * zoom
    const marginX = canvas.width * PAN_MARGIN_FRACTION
    const marginY = canvas.height * PAN_MARGIN_FRACTION
    const maxPanX = (mapW / 2) + canvas.width / 2 - marginX
    const maxPanY = (mapH / 2) + canvas.height / 2 - marginY
    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, px)),
      y: Math.max(-maxPanY, Math.min(maxPanY, py)),
    }
  }, [officeState, zoom])

  // 調整 canvas 後端儲存區為裝置像素（不在 ctx 上做 DPR 變換）
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    // 不使用 ctx.scale(dpr) — 我們直接以裝置像素渲染
  }, [])

  // M 鍵切換小地圖顯示
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        // 避免在輸入框中觸發
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        showMinimapRef.current = !showMinimapRef.current
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    resizeCanvas()

    const observer = new ResizeObserver(() => resizeCanvas())
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    const stop = startGameLoop(canvas, {
      update: (dt) => {
        // 日夜階段更新
        if (dayNightEnabledRef.current) {
          const now = new Date()
          const h = dayNightTimeOverrideRef.current !== null ? dayNightTimeOverrideRef.current : now.getHours()
          officeState.setDayPhase(getDayPhase(h))
        } else {
          officeState.setDayPhase('day')
        }
        // 錄製/回放整合
        const rec = recorderRef.current
        if (rec?.state === 'playing') {
          rec.playbackTick(dt, officeState)
        } else {
          officeState.update(dt)
          if (rec?.state === 'recording') {
            gameTimeRef.current += dt
            rec.recordTick(gameTimeRef.current, officeState)
          }
        }
      },
      render: (ctx) => {
        // Canvas 尺寸為裝置像素
        const w = canvas.width
        const h = canvas.height

        // 建構編輯器渲染狀態
        let editorRender: EditorRenderState | undefined
        if (isEditMode) {
          const showGhostBorder = editorState.activeTool === EditTool.TILE_PAINT || editorState.activeTool === EditTool.WALL_PAINT || editorState.activeTool === EditTool.ERASE
          editorRender = {
            showGrid: true,
            ghostSprite: null,
            ghostCol: editorState.ghostCol,
            ghostRow: editorState.ghostRow,
            ghostValid: editorState.ghostValid,
            selectedCol: 0,
            selectedRow: 0,
            selectedW: 0,
            selectedH: 0,
            hasSelection: false,
            isRotatable: false,
            deleteButtonBounds: null,
            rotateButtonBounds: null,
            showGhostBorder,
            ghostBorderHoverCol: showGhostBorder ? editorState.ghostCol : -999,
            ghostBorderHoverRow: showGhostBorder ? editorState.ghostRow : -999,
          }

          // 家具放置的幽靈預覽
          if (editorState.activeTool === EditTool.FURNITURE_PLACE && editorState.ghostCol >= 0) {
            const entry = getCatalogEntry(editorState.selectedFurnitureType)
            if (entry) {
              const placementRow = getWallPlacementRow(editorState.selectedFurnitureType, editorState.ghostRow)
              editorRender.ghostSprite = entry.sprite
              editorRender.ghostRow = placementRow
              editorRender.ghostValid = canPlaceFurniture(
                officeState.getLayout(),
                editorState.selectedFurnitureType,
                editorState.ghostCol,
                placementRow,
              )
            }
          }

          // 拖曳移動的幽靈預覽
          if (editorState.isDragMoving && editorState.dragUid && editorState.ghostCol >= 0) {
            const draggedItem = officeState.getLayout().furniture.find((f) => f.uid === editorState.dragUid)
            if (draggedItem) {
              const entry = getCatalogEntry(draggedItem.type)
              if (entry) {
                const ghostCol = editorState.ghostCol - editorState.dragOffsetCol
                const ghostRow = editorState.ghostRow - editorState.dragOffsetRow
                editorRender.ghostSprite = entry.sprite
                editorRender.ghostCol = ghostCol
                editorRender.ghostRow = ghostRow
                editorRender.ghostValid = canPlaceFurniture(
                  officeState.getLayout(),
                  draggedItem.type,
                  ghostCol,
                  ghostRow,
                  editorState.dragUid,
                )
              }
            }
          }

          // 選取高亮
          if (editorState.selectedFurnitureUid && !editorState.isDragMoving) {
            const item = officeState.getLayout().furniture.find((f) => f.uid === editorState.selectedFurnitureUid)
            if (item) {
              const entry = getCatalogEntry(item.type)
              if (entry) {
                editorRender.hasSelection = true
                editorRender.selectedCol = item.col
                editorRender.selectedRow = item.row
                editorRender.selectedW = entry.footprintW
                editorRender.selectedH = entry.footprintH
                editorRender.isRotatable = isRotatable(item.type)
              }
            }
          }
        }

        // 鏡頭追蹤：平滑地將鏡頭置中於被追蹤的代理
        if (officeState.cameraFollowId !== null) {
          const followCh = officeState.characters.get(officeState.cameraFollowId)
          if (followCh) {
            const layout = officeState.getLayout()
            const z = zoomRef.current
            const mapW = layout.cols * TILE_SIZE * z
            const mapH = layout.rows * TILE_SIZE * z
            const targetX = mapW / 2 - followCh.x * z
            const targetY = mapH / 2 - followCh.y * z
            const dx = targetX - panRef.current.x
            const dy = targetY - panRef.current.y
            if (Math.abs(dx) < CAMERA_FOLLOW_SNAP_THRESHOLD && Math.abs(dy) < CAMERA_FOLLOW_SNAP_THRESHOLD) {
              panRef.current = { x: targetX, y: targetY }
            } else {
              panRef.current = {
                x: panRef.current.x + dx * CAMERA_FOLLOW_LERP,
                y: panRef.current.y + dy * CAMERA_FOLLOW_LERP,
              }
            }
          }
        }

        // 建構選取渲染狀態
        const selectionRender: SelectionRenderState = {
          selectedAgentId: officeState.selectedAgentId,
          hoveredAgentId: officeState.hoveredAgentId,
          hoveredTile: officeState.hoveredTile,
          seats: officeState.seats,
          characters: officeState.characters,
        }

        // 日夜色溫覆蓋計算
        let overlay: { color: string; alpha: number } | undefined
        if (dayNightEnabledRef.current) {
          const now = new Date()
          const h = dayNightTimeOverrideRef.current !== null ? dayNightTimeOverrideRef.current : now.getHours()
          const m = dayNightTimeOverrideRef.current !== null ? 0 : now.getMinutes()
          overlay = getDayNightOverlay(h, m)
        }

        const { offsetX, offsetY } = renderFrame(
          ctx,
          w,
          h,
          officeState.tileMap,
          officeState.furniture,
          officeState.getCharacters(),
          zoomRef.current,
          panRef.current.x,
          panRef.current.y,
          selectionRender,
          editorRender,
          officeState.getLayout().tileColors,
          officeState.getLayout().cols,
          officeState.getLayout().rows,
          overlay,
          officeState.layoutVersion,
        )
        offsetRef.current = { x: offsetX, y: offsetY }

        // 迷你地圖（M 鍵切換顯示、非編輯模式、非行動裝置）
        const currentDpr = window.devicePixelRatio || 1
        const cssW = w / currentDpr
        if (showMinimapRef.current && !isEditMode && cssW >= 768) {
          minimapBoundsRef.current = renderMinimap(
            ctx, w, h,
            officeState.tileMap,
            officeState.furniture,
            officeState.getCharacters(),
            zoomRef.current,
            offsetX, offsetY,
            officeState.getLayout().cols,
            officeState.getLayout().rows,
            currentDpr,
          )
        } else {
          minimapBoundsRef.current = null
        }

        // 儲存刪除/旋轉按鈕邊界以供命中測試
        deleteButtonBoundsRef.current = editorRender?.deleteButtonBounds ?? null
        rotateButtonBoundsRef.current = editorRender?.rotateButtonBounds ?? null
      },
    })

    return () => {
      stop()
      observer.disconnect()
    }
  }, [officeState, resizeCanvas, isEditMode, editorState, _editorTick, panRef])


  // 將 CSS 滑鼠座標轉換為世界（精靈像素）座標
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      // 相對於 canvas 的 CSS 座標
      const cssX = clientX - rect.left
      const cssY = clientY - rect.top
      // 轉換為裝置像素
      const deviceX = cssX * dpr
      const deviceY = cssY * dpr
      // 轉換為世界（精靈像素）座標
      const worldX = (deviceX - offsetRef.current.x) / zoom
      const worldY = (deviceY - offsetRef.current.y) / zoom
      return { worldX, worldY, screenX: cssX, screenY: cssY, deviceX, deviceY }
    },
    [zoom],
  )

  const screenToTile = useCallback(
    (clientX: number, clientY: number): { col: number; row: number } | null => {
      const pos = screenToWorld(clientX, clientY)
      if (!pos) return null
      const col = Math.floor(pos.worldX / TILE_SIZE)
      const row = Math.floor(pos.worldY / TILE_SIZE)
      const layout = officeState.getLayout()
      // 在編輯模式下使用地板/牆壁/擦除工具時，為幽靈邊框擴展有效範圍 1 格
      if (isEditMode && (editorState.activeTool === EditTool.TILE_PAINT || editorState.activeTool === EditTool.WALL_PAINT || editorState.activeTool === EditTool.ERASE)) {
        if (col < -1 || col > layout.cols || row < -1 || row > layout.rows) return null
        return { col, row }
      }
      if (col < 0 || col >= layout.cols || row < 0 || row >= layout.rows) return null
      return { col, row }
    },
    [screenToWorld, officeState, isEditMode, editorState],
  )

  // 檢查裝置像素座標是否命中刪除按鈕
  const hitTestDeleteButton = useCallback((deviceX: number, deviceY: number): boolean => {
    const bounds = deleteButtonBoundsRef.current
    if (!bounds) return false
    const dx = deviceX - bounds.cx
    const dy = deviceY - bounds.cy
    return (dx * dx + dy * dy) <= (bounds.radius + 2) * (bounds.radius + 2) // 少量填充
  }, [])

  // 檢查裝置像素座標是否命中旋轉按鈕
  const hitTestRotateButton = useCallback((deviceX: number, deviceY: number): boolean => {
    const bounds = rotateButtonBoundsRef.current
    if (!bounds) return false
    const dx = deviceX - bounds.cx
    const dy = deviceY - bounds.cy
    return (dx * dx + dy * dy) <= (bounds.radius + 2) * (bounds.radius + 2)
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // 處理中鍵平移
      if (isPanningRef.current) {
        const dpr = window.devicePixelRatio || 1
        const dx = (e.clientX - panStartRef.current.mouseX) * dpr
        const dy = (e.clientY - panStartRef.current.mouseY) * dpr
        panRef.current = clampPan(
          panStartRef.current.panX + dx,
          panStartRef.current.panY + dy,
        )
        return
      }

      if (isEditMode) {
        const tile = screenToTile(e.clientX, e.clientY)
        if (tile) {
          editorState.ghostCol = tile.col
          editorState.ghostRow = tile.row

          // 拖曳移動：檢查游標是否移動到不同格
          if (editorState.dragUid && !editorState.isDragMoving) {
            if (tile.col !== editorState.dragStartCol || tile.row !== editorState.dragStartRow) {
              editorState.isDragMoving = true
            }
          }

          // 拖曳時繪製（僅限地板/牆壁/擦除繪製工具，非家具拖曳時）
          if (editorState.isDragging && (editorState.activeTool === EditTool.TILE_PAINT || editorState.activeTool === EditTool.WALL_PAINT || editorState.activeTool === EditTool.ERASE) && !editorState.dragUid) {
            onEditorTileAction(tile.col, tile.row)
          }
          // 右鍵擦除拖曳
          if (isEraseDraggingRef.current && (editorState.activeTool === EditTool.TILE_PAINT || editorState.activeTool === EditTool.WALL_PAINT || editorState.activeTool === EditTool.ERASE)) {
            const layout = officeState.getLayout()
            if (tile.col >= 0 && tile.col < layout.cols && tile.row >= 0 && tile.row < layout.rows) {
              onEditorEraseAction(tile.col, tile.row)
            }
          }
        } else {
          editorState.ghostCol = -1
          editorState.ghostRow = -1
        }

        // 游標：拖曳中顯示抓取、刪除按鈕上顯示指標、其他顯示十字
        const canvas = canvasRef.current
        if (canvas) {
          if (editorState.isDragMoving) {
            canvas.style.cursor = 'grabbing'
          } else {
            const pos = screenToWorld(e.clientX, e.clientY)
            if (pos && (hitTestDeleteButton(pos.deviceX, pos.deviceY) || hitTestRotateButton(pos.deviceX, pos.deviceY))) {
              canvas.style.cursor = 'pointer'
            } else if (editorState.activeTool === EditTool.FURNITURE_PICK && tile) {
              // 吸管模式：家具上顯示指標，其他地方顯示十字
              const layout = officeState.getLayout()
              const hitFurniture = layout.furniture.find((f) => {
                const entry = getCatalogEntry(f.type)
                if (!entry) return false
                return tile.col >= f.col && tile.col < f.col + entry.footprintW && tile.row >= f.row && tile.row < f.row + entry.footprintH
              })
              canvas.style.cursor = hitFurniture ? 'pointer' : 'crosshair'
            } else if ((editorState.activeTool === EditTool.SELECT || (editorState.activeTool === EditTool.FURNITURE_PLACE && editorState.selectedFurnitureType === '')) && tile) {
              // 檢查是否懸停在家具上
              const layout = officeState.getLayout()
              const hitFurniture = layout.furniture.find((f) => {
                const entry = getCatalogEntry(f.type)
                if (!entry) return false
                return tile.col >= f.col && tile.col < f.col + entry.footprintW && tile.row >= f.row && tile.row < f.row + entry.footprintH
              })
              canvas.style.cursor = hitFurniture ? 'grab' : 'crosshair'
            } else {
              canvas.style.cursor = 'crosshair'
            }
          }
        }
        return
      }

      const pos = screenToWorld(e.clientX, e.clientY)
      if (!pos) return
      const hitId = officeState.getCharacterAt(pos.worldX, pos.worldY)
      const tile = screenToTile(e.clientX, e.clientY)
      officeState.hoveredTile = tile
      const canvas = canvasRef.current
      if (canvas) {
        let cursor = 'default'
        if (hitId !== null) {
          cursor = 'pointer'
        } else if (officeState.selectedAgentId !== null && tile) {
          // 檢查是否懸停在可點擊的座位上（可用的或自己的）
          const seatId = officeState.getSeatAtTile(tile.col, tile.row)
          if (seatId) {
            const seat = officeState.seats.get(seatId)
            if (seat) {
              const selectedCh = officeState.characters.get(officeState.selectedAgentId)
              if (!seat.assigned || (selectedCh && selectedCh.seatId === seatId)) {
                cursor = 'pointer'
              }
            }
          }
        }
        canvas.style.cursor = cursor
      }
      officeState.hoveredAgentId = hitId
    },
    [officeState, screenToWorld, screenToTile, isEditMode, editorState, onEditorTileAction, onEditorEraseAction, panRef, hitTestDeleteButton, hitTestRotateButton, clampPan],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      unlockAudio()
      // 迷你地圖點擊：將鏡頭移至對應位置
      if (e.button === 0 && !isEditMode) {
        const mm = minimapBoundsRef.current
        if (mm) {
          const dpr = window.devicePixelRatio || 1
          const rect = canvasRef.current?.getBoundingClientRect()
          if (rect) {
            const deviceX = (e.clientX - rect.left) * dpr
            const deviceY = (e.clientY - rect.top) * dpr
            if (deviceX >= mm.x && deviceX <= mm.x + mm.w && deviceY >= mm.y && deviceY <= mm.y + mm.h) {
              // 將 minimap 點擊位置轉換為世界格座標
              const worldCol = ((deviceX - mm.x) / mm.w) * mm.cols
              const worldRow = ((deviceY - mm.y) / mm.h) * mm.rows
              // 計算平移使該位置置中
              const layout = officeState.getLayout()
              const mapW = layout.cols * TILE_SIZE * zoom
              const mapH = layout.rows * TILE_SIZE * zoom
              const targetPanX = mapW / 2 - worldCol * TILE_SIZE * zoom
              const targetPanY = mapH / 2 - worldRow * TILE_SIZE * zoom
              officeState.cameraFollowId = null
              panRef.current = clampPan(targetPanX, targetPanY)
              return
            }
          }
        }
      }
      // 滑鼠中鍵（button 1）開始平移
      if (e.button === 1) {
        e.preventDefault()
        // 手動平移時中斷鏡頭追蹤
        officeState.cameraFollowId = null
        isPanningRef.current = true
        panStartRef.current = {
          mouseX: e.clientX,
          mouseY: e.clientY,
          panX: panRef.current.x,
          panY: panRef.current.y,
        }
        const canvas = canvasRef.current
        if (canvas) canvas.style.cursor = 'grabbing'
        return
      }

      // 編輯模式下右鍵擦除
      if (e.button === 2 && isEditMode) {
        const tile = screenToTile(e.clientX, e.clientY)
        if (tile && (editorState.activeTool === EditTool.TILE_PAINT || editorState.activeTool === EditTool.WALL_PAINT || editorState.activeTool === EditTool.ERASE)) {
          const layout = officeState.getLayout()
          if (tile.col >= 0 && tile.col < layout.cols && tile.row >= 0 && tile.row < layout.rows) {
            isEraseDraggingRef.current = true
            onEditorEraseAction(tile.col, tile.row)
          }
        }
        return
      }

      if (!isEditMode) return

      // 優先檢查旋轉/刪除按鈕命中
      const pos = screenToWorld(e.clientX, e.clientY)
      if (pos && hitTestRotateButton(pos.deviceX, pos.deviceY)) {
        onRotateSelected()
        return
      }
      if (pos && hitTestDeleteButton(pos.deviceX, pos.deviceY)) {
        onDeleteSelected()
        return
      }

      const tile = screenToTile(e.clientX, e.clientY)

      // SELECT 工具（或未選取物件的家具工具）：檢查家具命中以開始拖曳
      const actAsSelect = editorState.activeTool === EditTool.SELECT ||
        (editorState.activeTool === EditTool.FURNITURE_PLACE && editorState.selectedFurnitureType === '')
      if (actAsSelect && tile) {
        const layout = officeState.getLayout()
        // 找到點擊格上的所有家具，優先選取表面物件（在書桌上方的）
        let hitFurniture = null as typeof layout.furniture[0] | null
        for (const f of layout.furniture) {
          const entry = getCatalogEntry(f.type)
          if (!entry) continue
          if (tile.col >= f.col && tile.col < f.col + entry.footprintW && tile.row >= f.row && tile.row < f.row + entry.footprintH) {
            if (!hitFurniture || entry.canPlaceOnSurfaces) hitFurniture = f
          }
        }
        if (hitFurniture) {
          // 開始拖曳 — 記錄相對於家具左上角的偏移
          editorState.startDrag(
            hitFurniture.uid,
            tile.col,
            tile.row,
            tile.col - hitFurniture.col,
            tile.row - hitFurniture.row,
          )
          return
        } else {
          // 點擊空白處 — 取消選取
          editorState.clearSelection()
          onEditorSelectionChange()
        }
      }

      // 非選取工具：開始繪製拖曳
      editorState.isDragging = true
      if (tile) {
        onEditorTileAction(tile.col, tile.row)
      }
    },
    [officeState, isEditMode, editorState, screenToTile, screenToWorld, onEditorTileAction, onEditorEraseAction, onEditorSelectionChange, onDeleteSelected, onRotateSelected, hitTestDeleteButton, hitTestRotateButton, panRef],
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1) {
        isPanningRef.current = false
        const canvas = canvasRef.current
        if (canvas) canvas.style.cursor = isEditMode ? 'crosshair' : 'default'
        return
      }
      if (e.button === 2) {
        isEraseDraggingRef.current = false
        return
      }

      // 處理拖曳移動完成
      if (editorState.dragUid) {
        if (editorState.isDragMoving) {
          // 計算目標位置
          const ghostCol = editorState.ghostCol - editorState.dragOffsetCol
          const ghostRow = editorState.ghostRow - editorState.dragOffsetRow
          const draggedItem = officeState.getLayout().furniture.find((f) => f.uid === editorState.dragUid)
          if (draggedItem) {
            const valid = canPlaceFurniture(
              officeState.getLayout(),
              draggedItem.type,
              ghostCol,
              ghostRow,
              editorState.dragUid,
            )
            if (valid) {
              onDragMove(editorState.dragUid, ghostCol, ghostRow)
            }
          }
          editorState.clearSelection()
        } else {
          // 點擊（無移動）— 切換選取
          if (editorState.selectedFurnitureUid === editorState.dragUid) {
            editorState.clearSelection()
          } else {
            editorState.selectedFurnitureUid = editorState.dragUid
          }
        }
        editorState.clearDrag()
        onEditorSelectionChange()
        const canvas = canvasRef.current
        if (canvas) canvas.style.cursor = 'crosshair'
        return
      }

      editorState.isDragging = false
      editorState.wallDragAdding = null
    },
    [editorState, isEditMode, officeState, onDragMove, onEditorSelectionChange],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isEditMode) return // 由 mouseDown/mouseUp 處理
      const pos = screenToWorld(e.clientX, e.clientY)
      if (!pos) return

      const hitId = officeState.getCharacterAt(pos.worldX, pos.worldY)
      if (hitId !== null) {
        // 點擊時關閉任何活動的氣泡
        officeState.dismissBubble(hitId)
        // 切換選取：點擊同一代理取消選取，不同代理則選取
        if (officeState.selectedAgentId === hitId) {
          officeState.selectedAgentId = null
          officeState.cameraFollowId = null
        } else {
          officeState.selectedAgentId = hitId
          officeState.cameraFollowId = hitId
        }
        onClick(hitId) // 仍然聚焦終端
        return
      }

      // 未命中代理 — 在代理已選取時檢查座位點擊
      if (officeState.selectedAgentId !== null) {
        const selectedCh = officeState.characters.get(officeState.selectedAgentId)
        // 子代理跳過座位重新指定
        if (selectedCh && !selectedCh.isSubagent) {
          const tile = screenToTile(e.clientX, e.clientY)
          if (tile) {
            const seatId = officeState.getSeatAtTile(tile.col, tile.row)
            if (seatId) {
              const seat = officeState.seats.get(seatId)
              if (seat && selectedCh) {
                if (selectedCh.seatId === seatId) {
                  // 點擊自己的座位 — 送代理回去
                  officeState.sendToSeat(officeState.selectedAgentId)
                  officeState.selectedAgentId = null
                  officeState.cameraFollowId = null
                  return
                } else if (!seat.assigned) {
                  // 點擊可用座位 — 重新指定
                  officeState.reassignSeat(officeState.selectedAgentId, seatId)
                  officeState.selectedAgentId = null
                  officeState.cameraFollowId = null
                  // 持久化座位指定（排除子代理）
                  const seats: Record<number, { palette: number; seatId: string | null }> = {}
                  for (const ch of officeState.characters.values()) {
                    if (ch.isSubagent) continue
                    seats[ch.id] = { palette: ch.palette, seatId: ch.seatId }
                  }
                  vscode.postMessage({ type: 'saveAgentSeats', seats })
                  return
                }
              }
            }
          }
        }
        // 點擊空白處 — 取消選取
        officeState.selectedAgentId = null
        officeState.cameraFollowId = null
      }
    },
    [officeState, onClick, screenToWorld, screenToTile, isEditMode],
  )

  const handleMouseLeave = useCallback(() => {
    isPanningRef.current = false
    isEraseDraggingRef.current = false
    editorState.isDragging = false
    editorState.wallDragAdding = null
    editorState.clearDrag()
    editorState.ghostCol = -1
    editorState.ghostRow = -1
    officeState.hoveredAgentId = null
    officeState.hoveredTile = null
  }, [officeState, editorState])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (isEditMode) return
    // 檢查是否右鍵點擊到角色
    const pos = screenToWorld(e.clientX, e.clientY)
    if (pos) {
      const hitId = officeState.getCharacterAt(pos.worldX, pos.worldY)
      if (hitId !== null) {
        onContextMenuProp?.(hitId, e.clientX, e.clientY)
        return
      }
    }
    // 右鍵讓選取的代理走向該格
    if (officeState.selectedAgentId !== null) {
      const tile = screenToTile(e.clientX, e.clientY)
      if (tile) {
        officeState.walkToTile(officeState.selectedAgentId, tile.col, tile.row)
      }
    }
  }, [isEditMode, officeState, screenToTile, screenToWorld, onContextMenuProp])

  // 滾輪：Ctrl+滾輪縮放，普通滾輪/觸控板平移
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        // 累加滾動差值，超過閾值時步進縮放
        zoomAccumulatorRef.current += e.deltaY
        if (Math.abs(zoomAccumulatorRef.current) >= ZOOM_SCROLL_THRESHOLD) {
          const delta = zoomAccumulatorRef.current < 0 ? 1 : -1
          zoomAccumulatorRef.current = 0
          const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + delta))
          if (newZoom !== zoom) {
            onZoomChange(newZoom)
          }
        }
      } else {
        // 透過觸控板雙指滾動或滑鼠滾輪平移
        const dpr = window.devicePixelRatio || 1
        officeState.cameraFollowId = null
        panRef.current = clampPan(
          panRef.current.x - e.deltaX * dpr,
          panRef.current.y - e.deltaY * dpr,
        )
      }
    },
    [zoom, onZoomChange, officeState, panRef, clampPan],
  )

  // 防止瀏覽器中鍵預設行為（自動捲動）
  const handleAuxClick = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) e.preventDefault()
  }, [])

  // ── 觸控手勢系統 ──────────────────────────────────────────

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const getTouchDistance = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX
    const dy = t1.clientY - t2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const getTouchCenter = (t1: React.Touch, t2: React.Touch) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  })

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    unlockAudio()
    const touches = e.touches

    if (touches.length === 2) {
      // 雙指：開始 pinch-to-zoom + pan
      cancelLongPress()
      touchModeRef.current = 'pinch'
      lastPinchDistRef.current = getTouchDistance(touches[0], touches[1])
      lastTouchCenterRef.current = getTouchCenter(touches[0], touches[1])
      // 中斷鏡頭追蹤
      officeState.cameraFollowId = null
      return
    }

    if (touches.length !== 1) return

    const touch = touches[0]
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY }
    touchStartTimeRef.current = Date.now()
    touchModeRef.current = 'tap'

    if (isEditMode) {
      // 編輯模式：更新幽靈預覽位置
      const tile = screenToTile(touch.clientX, touch.clientY)
      if (tile) {
        editorState.ghostCol = tile.col
        editorState.ghostRow = tile.row
      }

      // 檢查刪除/旋轉按鈕命中
      const pos = screenToWorld(touch.clientX, touch.clientY)
      if (pos && hitTestRotateButton(pos.deviceX, pos.deviceY)) {
        onRotateSelected()
        touchModeRef.current = 'none'
        return
      }
      if (pos && hitTestDeleteButton(pos.deviceX, pos.deviceY)) {
        onDeleteSelected()
        touchModeRef.current = 'none'
        return
      }

      // SELECT 工具：檢查家具命中
      const actAsSelect = editorState.activeTool === EditTool.SELECT ||
        (editorState.activeTool === EditTool.FURNITURE_PLACE && editorState.selectedFurnitureType === '')
      if (actAsSelect && tile) {
        const layout = officeState.getLayout()
        let hitFurniture = null as typeof layout.furniture[0] | null
        for (const f of layout.furniture) {
          const entry = getCatalogEntry(f.type)
          if (!entry) continue
          if (tile.col >= f.col && tile.col < f.col + entry.footprintW && tile.row >= f.row && tile.row < f.row + entry.footprintH) {
            if (!hitFurniture || entry.canPlaceOnSurfaces) hitFurniture = f
          }
        }
        if (hitFurniture) {
          editorState.startDrag(hitFurniture.uid, tile.col, tile.row, tile.col - hitFurniture.col, tile.row - hitFurniture.row)
          touchModeRef.current = 'edit-drag'
          return
        }
      }
    } else {
      // 非編輯模式：設定長按計時器（walkToTile / context menu）
      longPressTimerRef.current = setTimeout(() => {
        if (!touchStartPosRef.current) return
        const pos = screenToWorld(touchStartPosRef.current.x, touchStartPosRef.current.y)
        if (pos) {
          const hitId = officeState.getCharacterAt(pos.worldX, pos.worldY)
          if (hitId !== null) {
            // 長按角色：觸發右鍵選單
            onContextMenuProp?.(hitId, touchStartPosRef.current.x, touchStartPosRef.current.y)
            touchModeRef.current = 'none'
            touchStartPosRef.current = null
            return
          }
        }
        if (officeState.selectedAgentId !== null) {
          const tile = screenToTile(touchStartPosRef.current.x, touchStartPosRef.current.y)
          if (tile) {
            officeState.walkToTile(officeState.selectedAgentId, tile.col, tile.row)
          }
        }
        touchModeRef.current = 'none'
        touchStartPosRef.current = null
      }, LONG_PRESS_DURATION_MS)
    }
  }, [isEditMode, officeState, editorState, screenToTile, screenToWorld, cancelLongPress, hitTestDeleteButton, hitTestRotateButton, onDeleteSelected, onRotateSelected, onContextMenuProp])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const touches = e.touches

    // 雙指 → pinch + pan
    if (touches.length === 2) {
      if (touchModeRef.current !== 'pinch') {
        // 從單指切換到雙指
        cancelLongPress()
        touchModeRef.current = 'pinch'
        lastPinchDistRef.current = getTouchDistance(touches[0], touches[1])
        lastTouchCenterRef.current = getTouchCenter(touches[0], touches[1])
        // 取消編輯拖曳
        editorState.isDragging = false
        editorState.clearDrag()
        return
      }

      const newDist = getTouchDistance(touches[0], touches[1])
      const newCenter = getTouchCenter(touches[0], touches[1])

      // Pinch zoom — 當距離變化超過門檻時步進
      const distDelta = newDist - lastPinchDistRef.current
      if (Math.abs(distDelta) > TOUCH_PINCH_ZOOM_THRESHOLD) {
        const zoomDelta = distDelta > 0 ? 1 : -1
        const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + zoomDelta))
        if (newZoom !== zoom) {
          onZoomChange(newZoom)
        }
        lastPinchDistRef.current = newDist
      }

      // 同時平移
      if (lastTouchCenterRef.current) {
        const dpr = window.devicePixelRatio || 1
        const dx = (newCenter.x - lastTouchCenterRef.current.x) * dpr
        const dy = (newCenter.y - lastTouchCenterRef.current.y) * dpr
        officeState.cameraFollowId = null
        panRef.current = clampPan(panRef.current.x + dx, panRef.current.y + dy)
      }
      lastTouchCenterRef.current = newCenter
      return
    }

    if (touches.length !== 1) return
    const touch = touches[0]

    // 編輯模式拖曳（家具拖曳或繪製拖曳）
    if (touchModeRef.current === 'edit-drag') {
      const tile = screenToTile(touch.clientX, touch.clientY)
      if (tile) {
        editorState.ghostCol = tile.col
        editorState.ghostRow = tile.row
        if (editorState.dragUid && !editorState.isDragMoving) {
          if (tile.col !== editorState.dragStartCol || tile.row !== editorState.dragStartRow) {
            editorState.isDragMoving = true
          }
        }
        // 繪製拖曳：持續觸發繪製
        if (editorState.isDragging && !editorState.dragUid && (editorState.activeTool === EditTool.TILE_PAINT || editorState.activeTool === EditTool.WALL_PAINT || editorState.activeTool === EditTool.ERASE)) {
          onEditorTileAction(tile.col, tile.row)
        }
      }
      return
    }

    if (!touchStartPosRef.current) return
    const dx = touch.clientX - touchStartPosRef.current.x
    const dy = touch.clientY - touchStartPosRef.current.y
    const dist2 = dx * dx + dy * dy

    // 超過門檻：從 tap 切換到 pan（或 edit-draw）
    if (touchModeRef.current === 'tap' && dist2 > TOUCH_PAN_THRESHOLD_PX * TOUCH_PAN_THRESHOLD_PX) {
      cancelLongPress()

      if (isEditMode && (editorState.activeTool === EditTool.TILE_PAINT || editorState.activeTool === EditTool.WALL_PAINT || editorState.activeTool === EditTool.ERASE)) {
        // 編輯繪製模式：開始拖曳繪製
        touchModeRef.current = 'edit-drag'
        editorState.isDragging = true
        const tile = screenToTile(touch.clientX, touch.clientY)
        if (tile) {
          onEditorTileAction(tile.col, tile.row)
        }
        return
      }

      touchModeRef.current = 'pan'
      officeState.cameraFollowId = null
    }

    // 平移模式
    if (touchModeRef.current === 'pan') {
      const dpr = window.devicePixelRatio || 1
      const prevPos = touchStartPosRef.current
      panRef.current = clampPan(
        panRef.current.x + (touch.clientX - prevPos.x) * dpr,
        panRef.current.y + (touch.clientY - prevPos.y) * dpr,
      )
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY }
    }

  }, [isEditMode, editorState, officeState, zoom, onZoomChange, panRef, clampPan, cancelLongPress, screenToTile, onEditorTileAction])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    cancelLongPress()

    const mode = touchModeRef.current

    // 編輯模式拖曳結束
    if (mode === 'edit-drag') {
      if (editorState.dragUid) {
        if (editorState.isDragMoving) {
          const ghostCol = editorState.ghostCol - editorState.dragOffsetCol
          const ghostRow = editorState.ghostRow - editorState.dragOffsetRow
          const draggedItem = officeState.getLayout().furniture.find((f) => f.uid === editorState.dragUid)
          if (draggedItem) {
            const valid = canPlaceFurniture(officeState.getLayout(), draggedItem.type, ghostCol, ghostRow, editorState.dragUid)
            if (valid) onDragMove(editorState.dragUid, ghostCol, ghostRow)
          }
          editorState.clearSelection()
        } else {
          // 點擊（無移動）— 切換選取
          if (editorState.selectedFurnitureUid === editorState.dragUid) {
            editorState.clearSelection()
          } else {
            editorState.selectedFurnitureUid = editorState.dragUid
          }
        }
        editorState.clearDrag()
        onEditorSelectionChange()
      }
      editorState.isDragging = false
      editorState.wallDragAdding = null
      editorState.ghostCol = -1
      editorState.ghostRow = -1
      touchModeRef.current = 'none'
      touchStartPosRef.current = null
      return
    }

    // tap 模式 — 處理點擊和雙擊
    if (mode === 'tap' && touchStartPosRef.current) {
      const elapsed = Date.now() - touchStartTimeRef.current
      const tapX = touchStartPosRef.current.x
      const tapY = touchStartPosRef.current.y

      // 檢查雙擊
      const prev = doubleTapRef.current
      if (prev && (Date.now() - prev.time) < TOUCH_DOUBLE_TAP_MS) {
        const ddx = tapX - prev.x
        const ddy = tapY - prev.y
        if (ddx * ddx + ddy * ddy < TOUCH_DOUBLE_TAP_DISTANCE_PX * TOUCH_DOUBLE_TAP_DISTANCE_PX) {
          // 雙擊：縮放切換
          doubleTapRef.current = null
          const dpr = window.devicePixelRatio || 1
          const defaultZoom = Math.round(2 * dpr)
          const newZoom = zoom === defaultZoom ? Math.min(ZOOM_MAX, defaultZoom + 2) : defaultZoom
          onZoomChange(newZoom)
          touchModeRef.current = 'none'
          touchStartPosRef.current = null
          return
        }
      }
      doubleTapRef.current = { time: Date.now(), x: tapX, y: tapY }

      // 短按 — 轉發點擊
      if (elapsed < LONG_PRESS_DURATION_MS) {
        if (isEditMode) {
          const tile = screenToTile(tapX, tapY)
          if (tile) {
            // 家具放置/吸管/清除空白處理
            const actAsSelect = editorState.activeTool === EditTool.SELECT ||
              (editorState.activeTool === EditTool.FURNITURE_PLACE && editorState.selectedFurnitureType === '')
            if (actAsSelect) {
              editorState.clearSelection()
              onEditorSelectionChange()
            } else {
              onEditorTileAction(tile.col, tile.row)
            }
          }
        } else {
          // 非編輯模式：模擬 click
          const pos = screenToWorld(tapX, tapY)
          if (pos) {
            const hitId = officeState.getCharacterAt(pos.worldX, pos.worldY)
            if (hitId !== null) {
              officeState.dismissBubble(hitId)
              if (officeState.selectedAgentId === hitId) {
                officeState.selectedAgentId = null
                officeState.cameraFollowId = null
              } else {
                officeState.selectedAgentId = hitId
                officeState.cameraFollowId = hitId
              }
              onClick(hitId)
            } else if (officeState.selectedAgentId !== null) {
              const selectedCh = officeState.characters.get(officeState.selectedAgentId)
              if (selectedCh && !selectedCh.isSubagent) {
                const tile = screenToTile(tapX, tapY)
                if (tile) {
                  const seatId = officeState.getSeatAtTile(tile.col, tile.row)
                  if (seatId) {
                    const seat = officeState.seats.get(seatId)
                    if (seat) {
                      if (selectedCh.seatId === seatId) {
                        officeState.sendToSeat(officeState.selectedAgentId)
                        officeState.selectedAgentId = null
                        officeState.cameraFollowId = null
                      } else if (!seat.assigned) {
                        officeState.reassignSeat(officeState.selectedAgentId, seatId)
                        officeState.selectedAgentId = null
                        officeState.cameraFollowId = null
                        const seats: Record<number, { palette: number; seatId: string | null }> = {}
                        for (const ch of officeState.characters.values()) {
                          if (ch.isSubagent) continue
                          seats[ch.id] = { palette: ch.palette, seatId: ch.seatId }
                        }
                        vscode.postMessage({ type: 'saveAgentSeats', seats })
                      }
                    }
                  } else {
                    officeState.selectedAgentId = null
                    officeState.cameraFollowId = null
                  }
                }
              } else {
                officeState.selectedAgentId = null
                officeState.cameraFollowId = null
              }
            }
          }
        }
      }
    }

    touchModeRef.current = 'none'
    touchStartPosRef.current = null
  }, [isEditMode, officeState, editorState, zoom, onZoomChange, onClick, screenToWorld, screenToTile, cancelLongPress, onEditorTileAction, onEditorSelectionChange, onDragMove])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: '#1E1E2E',
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onAuxClick={handleAuxClick}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchCancel={handleTouchEnd}
        style={{ display: 'block', touchAction: 'none' }}
      />
    </div>
  )
}
