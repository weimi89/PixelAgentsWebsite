import { EditTool, TileType } from '../types.js'
import type { TileType as TileTypeVal, OfficeLayout, FloorColor } from '../types.js'
import { UNDO_STACK_MAX_SIZE, DEFAULT_FLOOR_COLOR, DEFAULT_WALL_COLOR } from '../../constants.js'

export class EditorState {
  isEditMode = false
  activeTool: EditTool = EditTool.SELECT
  selectedTileType: TileTypeVal = TileType.FLOOR_1
  selectedFurnitureType: string = 'desk' // FurnitureType.DESK 或素材 ID

  // 地板色彩設定（繪製時套用至新磚塊）
  floorColor: FloorColor = { ...DEFAULT_FLOOR_COLOR }

  // 牆壁色彩設定（繪製時套用至新牆磚）
  wallColor: FloorColor = { ...DEFAULT_WALL_COLOR }

  // 追蹤牆壁拖曳期間的切換方向（true=新增牆壁, false=移除, null=未決定）
  wallDragAdding: boolean | null = null

  // 拾取的家具色彩（由拾取工具複製，放置時套用）
  pickedFurnitureColor: FloorColor | null = null

  // 幽靈預覽位置
  ghostCol = -1
  ghostRow = -1
  ghostValid = false

  // 選取
  selectedFurnitureUid: string | null = null

  // 滑鼠拖曳狀態（磚塊繪製）
  isDragging = false

  // 撤銷 / 重做堆疊
  undoStack: OfficeLayout[] = []
  redoStack: OfficeLayout[] = []

  // 髒旗標 — 當佈局與上次儲存不同時為 true
  isDirty = false

  // 拖曳移動狀態
  dragUid: string | null = null
  dragStartCol = 0
  dragStartRow = 0
  dragOffsetCol = 0
  dragOffsetRow = 0
  isDragMoving = false

  pushUndo(layout: OfficeLayout): void {
    this.undoStack.push(layout)
    // 限制撤銷堆疊大小
    if (this.undoStack.length > UNDO_STACK_MAX_SIZE) {
      this.undoStack.shift()
    }
  }

  popUndo(): OfficeLayout | null {
    return this.undoStack.pop() || null
  }

  pushRedo(layout: OfficeLayout): void {
    this.redoStack.push(layout)
    if (this.redoStack.length > UNDO_STACK_MAX_SIZE) {
      this.redoStack.shift()
    }
  }

  popRedo(): OfficeLayout | null {
    return this.redoStack.pop() || null
  }

  clearRedo(): void {
    this.redoStack = []
  }

  clearSelection(): void {
    this.selectedFurnitureUid = null
  }

  clearGhost(): void {
    this.ghostCol = -1
    this.ghostRow = -1
    this.ghostValid = false
  }

  startDrag(uid: string, startCol: number, startRow: number, offsetCol: number, offsetRow: number): void {
    this.dragUid = uid
    this.dragStartCol = startCol
    this.dragStartRow = startRow
    this.dragOffsetCol = offsetCol
    this.dragOffsetRow = offsetRow
    this.isDragMoving = false
  }

  clearDrag(): void {
    this.dragUid = null
    this.isDragMoving = false
  }

  reset(): void {
    this.activeTool = EditTool.SELECT
    this.selectedFurnitureUid = null
    this.ghostCol = -1
    this.ghostRow = -1
    this.ghostValid = false
    this.isDragging = false
    this.wallDragAdding = null
    this.undoStack = []
    this.redoStack = []
    this.isDirty = false
    this.dragUid = null
    this.isDragMoving = false
  }
}
