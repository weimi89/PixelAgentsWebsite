import { TileType, MAX_COLS, MAX_ROWS } from '../types.js'
import { DEFAULT_NEUTRAL_COLOR } from '../../constants.js'
import type { TileType as TileTypeVal, OfficeLayout, PlacedFurniture, FloorColor } from '../types.js'
import { getCatalogEntry, getRotatedType, getToggledType } from '../layout/furnitureCatalog.js'
import { getPlacementBlockedTiles } from '../layout/layoutSerializer.js'

/** 以花紋和色彩繪製單一磚塊。返回新佈局（不可變）。 */
export function paintTile(layout: OfficeLayout, col: number, row: number, tileType: TileTypeVal, color?: FloorColor): OfficeLayout {
  const idx = row * layout.cols + col
  if (idx < 0 || idx >= layout.tiles.length) return layout

  const existingColors = layout.tileColors || new Array(layout.tiles.length).fill(null)
  const newColor = color ?? (tileType === TileType.WALL || tileType === TileType.VOID ? null : { ...DEFAULT_NEUTRAL_COLOR })

  // 檢查是否有實際變更
  if (layout.tiles[idx] === tileType) {
    const existingColor = existingColors[idx]
    if (newColor === null && existingColor === null) return layout
    if (newColor && existingColor &&
      newColor.h === existingColor.h && newColor.s === existingColor.s &&
      newColor.b === existingColor.b && newColor.c === existingColor.c &&
      !!newColor.colorize === !!existingColor.colorize) return layout
  }

  const tiles = [...layout.tiles]
  tiles[idx] = tileType
  const tileColors = [...existingColors]
  tileColors[idx] = newColor
  return { ...layout, tiles, tileColors }
}

/** 放置家具。返回新佈局（不可變）。 */
export function placeFurniture(layout: OfficeLayout, item: PlacedFurniture): OfficeLayout {
  if (!canPlaceFurniture(layout, item.type, item.col, item.row)) return layout
  return { ...layout, furniture: [...layout.furniture, item] }
}

/** 依 uid 移除家具。返回新佈局（不可變）。 */
export function removeFurniture(layout: OfficeLayout, uid: string): OfficeLayout {
  const filtered = layout.furniture.filter((f) => f.uid !== uid)
  if (filtered.length === layout.furniture.length) return layout
  return { ...layout, furniture: filtered }
}

/** 將家具移動至新位置。返回新佈局（不可變）。 */
export function moveFurniture(layout: OfficeLayout, uid: string, newCol: number, newRow: number): OfficeLayout {
  const item = layout.furniture.find((f) => f.uid === uid)
  if (!item) return layout
  if (!canPlaceFurniture(layout, item.type, newCol, newRow, uid)) return layout
  return {
    ...layout,
    furniture: layout.furniture.map((f) => (f.uid === uid ? { ...f, col: newCol, row: newRow } : f)),
  }
}

/** 將家具旋轉至下一個朝向。返回新佈局（不可變）。 */
export function rotateFurniture(layout: OfficeLayout, uid: string, direction: 'cw' | 'ccw'): OfficeLayout {
  const item = layout.furniture.find((f) => f.uid === uid)
  if (!item) return layout
  const newType = getRotatedType(item.type, direction)
  if (!newType) return layout
  return {
    ...layout,
    furniture: layout.furniture.map((f) => (f.uid === uid ? { ...f, type: newType } : f)),
  }
}

/** 切換家具狀態（開/關）。返回新佈局（不可變）。 */
export function toggleFurnitureState(layout: OfficeLayout, uid: string): OfficeLayout {
  const item = layout.furniture.find((f) => f.uid === uid)
  if (!item) return layout
  const newType = getToggledType(item.type)
  if (!newType) return layout
  return {
    ...layout,
    furniture: layout.furniture.map((f) => (f.uid === uid ? { ...f, type: newType } : f)),
  }
}

/** 對於牆面項目，偏移列位使底部列對齊懸停的磚塊。 */
export function getWallPlacementRow(type: string, row: number): number {
  const entry = getCatalogEntry(type)
  if (!entry?.canPlaceOnWalls) return row
  return row - (entry.footprintH - 1)
}

/** 檢查家具是否可放置在 (col, row) 而不重疊。 */
export function canPlaceFurniture(
  layout: OfficeLayout,
  type: string, // FurnitureType 列舉或素材 ID
  col: number,
  row: number,
  excludeUid?: string,
): boolean {
  const entry = getCatalogEntry(type)
  if (!entry) return false

  // 檢查邊界 — 牆面項目可能延伸至地圖上方（頂部列懸掛在牆上方）
  if (entry.canPlaceOnWalls) {
    const bottomRow = row + entry.footprintH - 1
    if (col < 0 || col + entry.footprintW > layout.cols || bottomRow < 0 || bottomRow >= layout.rows) {
      return false
    }
  } else {
    if (col < 0 || row < 0 || col + entry.footprintW > layout.cols || row + entry.footprintH > layout.rows) {
      return false
    }
  }

  // 牆壁/VOID 放置檢查（背景列跳過此檢查）
  const bgRows = entry.backgroundTiles || 0
  for (let dr = 0; dr < entry.footprintH; dr++) {
    if (dr < bgRows) continue
    if (row + dr < 0) continue // 地圖上方的列（牆面項目向上延伸）
    // 牆面項目：僅底部列必須在牆磚上；上方列可與 VOID/任何磚塊重疊
    if (entry.canPlaceOnWalls && dr < entry.footprintH - 1) continue
    for (let dc = 0; dc < entry.footprintW; dc++) {
      const idx = (row + dr) * layout.cols + (col + dc)
      const tileVal = layout.tiles[idx]
      if (entry.canPlaceOnWalls) {
        if (tileVal !== TileType.WALL) return false
      } else {
        if (tileVal === TileType.VOID) return false // 不能放在 VOID 上
        if (tileVal === TileType.WALL) return false // 一般項目不能與牆壁重疊
      }
    }
  }

  // 建構已佔據集合，排除正在移動的項目，跳過背景磚塊列
  const occupied = getPlacementBlockedTiles(layout.furniture, excludeUid)

  // 若此項目可放在表面上，建構書桌磚塊集合以排除碰撞檢測
  let deskTiles: Set<string> | null = null
  if (entry.canPlaceOnSurfaces) {
    deskTiles = new Set<string>()
    for (const item of layout.furniture) {
      if (item.uid === excludeUid) continue
      const itemEntry = getCatalogEntry(item.type)
      if (!itemEntry || !itemEntry.isDesk) continue
      for (let dr = 0; dr < itemEntry.footprintH; dr++) {
        for (let dc = 0; dc < itemEntry.footprintW; dc++) {
          deskTiles.add(`${item.col + dc},${item.row + dr}`)
        }
      }
    }
  }

  // 檢查重疊 — 也跳過新項目自身的背景列
  const newBgRows = entry.backgroundTiles || 0
  for (let dr = 0; dr < entry.footprintH; dr++) {
    if (dr < newBgRows) continue // 新項目的背景列可與現有項目重疊
    if (row + dr < 0) continue // 地圖上方的列（牆面項目向上延伸）
    for (let dc = 0; dc < entry.footprintW; dc++) {
      const key = `${col + dc},${row + dr}`
      if (occupied.has(key) && !(deskTiles?.has(key))) return false
    }
  }

  return true
}

export type ExpandDirection = 'left' | 'right' | 'up' | 'down'

/**
 * 向指定方向擴展佈局 1 格。新磚塊為 VOID。
 * 向左或向上擴展時，家具和磚塊索引會偏移。
 * 返回 { layout, shift }，若超過 MAX_COLS/MAX_ROWS 則返回 null。
 */
export function expandLayout(
  layout: OfficeLayout,
  direction: ExpandDirection,
): { layout: OfficeLayout; shift: { col: number; row: number } } | null {
  const { cols, rows, tiles, furniture, tileColors } = layout
  const existingColors = tileColors || new Array(tiles.length).fill(null)

  let newCols = cols
  let newRows = rows
  let shiftCol = 0
  let shiftRow = 0

  if (direction === 'right') {
    newCols = cols + 1
  } else if (direction === 'left') {
    newCols = cols + 1
    shiftCol = 1
  } else if (direction === 'down') {
    newRows = rows + 1
  } else if (direction === 'up') {
    newRows = rows + 1
    shiftRow = 1
  }

  if (newCols > MAX_COLS || newRows > MAX_ROWS) return null

  // 建構新磚塊陣列
  const newTiles: TileTypeVal[] = new Array(newCols * newRows).fill(TileType.VOID as TileTypeVal)
  const newColors: Array<FloorColor | null> = new Array(newCols * newRows).fill(null)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const oldIdx = r * cols + c
      const newIdx = (r + shiftRow) * newCols + (c + shiftCol)
      newTiles[newIdx] = tiles[oldIdx]
      newColors[newIdx] = existingColors[oldIdx]
    }
  }

  // 偏移家具位置
  const newFurniture: PlacedFurniture[] = furniture.map((f) => ({
    ...f,
    col: f.col + shiftCol,
    row: f.row + shiftRow,
  }))

  return {
    layout: { ...layout, cols: newCols, rows: newRows, tiles: newTiles, tileColors: newColors, furniture: newFurniture },
    shift: { col: shiftCol, row: shiftRow },
  }
}
