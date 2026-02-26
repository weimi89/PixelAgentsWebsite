import { TileType } from '../types.js'

/** 檢查磚塊是否可行走（地板、地毯或門道，且未被家具封鎖） */
export function isWalkable(
  col: number,
  row: number,
  tileMap: TileType[][],
  blockedTiles: Set<string>,
): boolean {
  const rows = tileMap.length
  const cols = rows > 0 ? tileMap[0].length : 0
  if (row < 0 || row >= rows || col < 0 || col >= cols) return false
  const t = tileMap[row][col]
  if (t === TileType.WALL || t === TileType.VOID) return false
  if (blockedTiles.has(`${col},${row}`)) return false
  return true
}

/** 取得可行走的磚塊位置（網格座標），用於漫遊 */
export function getWalkableTiles(
  tileMap: TileType[][],
  blockedTiles: Set<string>,
): Array<{ col: number; row: number }> {
  const rows = tileMap.length
  const cols = rows > 0 ? tileMap[0].length : 0
  const tiles: Array<{ col: number; row: number }> = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isWalkable(c, r, tileMap, blockedTiles)) {
        tiles.push({ col: c, row: r })
      }
    }
  }
  return tiles
}

/** 在 4 連通網格上的 BFS 尋路（無對角線）。返回不含起點但含終點的路徑。
 *
 * 使用整數鍵（row * cols + col）和型別陣列取代字串鍵
 * 和 Map/Set 以降低 GC 壓力。基於指標的佇列避免 Array.shift() 的 O(n)。 */
export function findPath(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  tileMap: TileType[][],
  blockedTiles: Set<string>,
): Array<{ col: number; row: number }> {
  if (startCol === endCol && startRow === endRow) return []

  const rows = tileMap.length
  const cols = rows > 0 ? tileMap[0].length : 0
  if (rows === 0 || cols === 0) return []

  if (!isWalkable(endCol, endRow, tileMap, blockedTiles)) return []

  const startKey = startRow * cols + startCol
  const endKey = endRow * cols + endCol
  const size = rows * cols

  // 平面型別陣列：單次分配，無逐節點字串/物件開銷
  const visited = new Uint8Array(size)
  const parent = new Int32Array(size).fill(-1)
  visited[startKey] = 1

  // 環形緩衝佇列 — BFS 最多走訪 `size` 個節點
  const queue = new Int32Array(size)
  let head = 0
  let tail = 0
  queue[tail++] = startKey

  const dc = [0, 0, -1, 1]
  const dr = [-1, 1, 0, 0]

  while (head < tail) {
    const currKey = queue[head++]

    if (currKey === endKey) {
      // 重建路徑：push + reverse 避免 unshift 的 O(path²)
      const path: Array<{ col: number; row: number }> = []
      let k = endKey
      while (k !== startKey) {
        path.push({ col: k % cols, row: (k - k % cols) / cols })
        k = parent[k]
      }
      path.reverse()
      return path
    }

    const currCol = currKey % cols
    const currRow = (currKey - currCol) / cols

    for (let d = 0; d < 4; d++) {
      const nc = currCol + dc[d]
      const nr = currRow + dr[d]
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue
      const nk = nr * cols + nc
      if (visited[nk]) continue
      if (!isWalkable(nc, nr, tileMap, blockedTiles)) continue

      visited[nk] = 1
      parent[nk] = currKey
      queue[tail++] = nk
    }
  }

  return []
}
