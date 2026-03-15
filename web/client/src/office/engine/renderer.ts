import { TileType, TILE_SIZE } from '../types.js'
import type { TileType as TileTypeVal, FurnitureInstance, Character, SpriteData, Seat, FloorColor } from '../types.js'
import { getCachedSprite, getOutlineSprite, tintCanvas } from '../sprites/spriteCache.js'
import { getCharacterSprites, BUBBLE_PERMISSION_SPRITE, BUBBLE_WAITING_SPRITE, BUBBLE_DETACHED_SPRITE, getEmoteSprite } from '../sprites/spriteData.js'
import { getCharacterSprite, isSittingState } from './characters.js'
import { renderMatrixEffect } from './matrixEffect.js'
import { getColorizedFloorSprite, hasFloorSprites, WALL_COLOR } from '../floorTiles.js'
import { hasWallSprites, getWallInstances, wallColorToHex } from '../wallTiles.js'
import {
  MINIMAP_MARGIN,
  MINIMAP_MARGIN_BOTTOM,
  MINIMAP_MIN_SIZE,
  MINIMAP_MAX_SIZE,
  MINIMAP_TILE_MIN_PX,
  MINIMAP_DOT_SIZE,
  MINIMAP_VIEWPORT_STROKE,
  MINIMAP_BG_COLOR,
  MINIMAP_FLOOR_COLOR,
  MINIMAP_WALL_COLOR,
  MINIMAP_FURNITURE_COLOR,
  CHARACTER_SITTING_OFFSET_PX,
  CHARACTER_Z_SORT_OFFSET,
  OUTLINE_Z_SORT_OFFSET,
  SELECTED_OUTLINE_ALPHA,
  HOVERED_OUTLINE_ALPHA,
  GHOST_PREVIEW_SPRITE_ALPHA,
  GHOST_PREVIEW_TINT_ALPHA,
  SELECTION_DASH_PATTERN,
  BUTTON_MIN_RADIUS,
  BUTTON_RADIUS_ZOOM_FACTOR,
  BUTTON_ICON_SIZE_FACTOR,
  BUTTON_LINE_WIDTH_MIN,
  BUTTON_LINE_WIDTH_ZOOM_FACTOR,
  BUBBLE_FADE_DURATION_SEC,
  BUBBLE_SITTING_OFFSET_PX,
  BUBBLE_VERTICAL_OFFSET_PX,
  FALLBACK_FLOOR_COLOR,
  SEAT_OWN_COLOR,
  SEAT_AVAILABLE_COLOR,
  SEAT_BUSY_COLOR,
  GRID_LINE_COLOR,
  VOID_TILE_OUTLINE_COLOR,
  VOID_TILE_DASH_PATTERN,
  GHOST_BORDER_HOVER_FILL,
  GHOST_BORDER_HOVER_STROKE,
  GHOST_BORDER_STROKE,
  GHOST_VALID_TINT,
  GHOST_INVALID_TINT,
  SELECTION_HIGHLIGHT_COLOR,
  DELETE_BUTTON_BG,
  ROTATE_BUTTON_BG,
  DETACHED_CHARACTER_ALPHA,
  EMOTE_VERTICAL_OFFSET_PX,
  EMOTE_FADE_DURATION_SEC,
  SUBAGENT_GLOW_COLOR,
  SUBAGENT_GLOW_ALPHA,
  REMOTE_AGENT_GLOW_COLOR,
  REMOTE_AGENT_GLOW_ALPHA,
  TEAM_BADGE_SIZE,
  TEAM_BADGE_VERTICAL_OFFSET_PX,
  TEAM_CONNECTION_LINE_ALPHA,
  TEAM_CONNECTION_LINE_WIDTH,
  TEAM_CONNECTION_DASH,
  LEVEL_BADGE_COLORS,
  LEVEL_GLOW_COLORS,
  LEVEL_BADGE_VERTICAL_OFFSET_PX,
} from '../../constants.js'

// ── 靜態磚層離屏 Canvas 快取 ──────────────────────────────
let tileLayerCanvas: OffscreenCanvas | HTMLCanvasElement | null = null
let tileLayerCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null
let tileLayerKey = ''

function createOffscreenCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return c
}

/** 重建離屏磚層 Canvas */
function rebuildTileLayer(
  tileMap: TileTypeVal[][],
  zoom: number,
  tileColors?: Array<FloorColor | null>,
  cols?: number,
): void {
  const tmRows = tileMap.length
  const tmCols = tmRows > 0 ? tileMap[0].length : 0
  const layoutCols = cols ?? tmCols
  const s = TILE_SIZE * zoom
  const w = tmCols * s
  const h = tmRows * s
  if (w === 0 || h === 0) { tileLayerCanvas = null; return }

  if (!tileLayerCanvas || tileLayerCanvas.width !== w || tileLayerCanvas.height !== h) {
    tileLayerCanvas = createOffscreenCanvas(w, h)
    tileLayerCtx = tileLayerCanvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  }
  if (!tileLayerCtx) return

  const useSpriteFloors = hasFloorSprites()
  tileLayerCtx.clearRect(0, 0, w, h)

  for (let r = 0; r < tmRows; r++) {
    for (let c = 0; c < tmCols; c++) {
      const tile = tileMap[r][c]
      if (tile === TileType.VOID) continue

      if (tile === TileType.WALL || !useSpriteFloors) {
        if (tile === TileType.WALL) {
          const colorIdx = r * layoutCols + c
          const wallColor = tileColors?.[colorIdx]
          tileLayerCtx.fillStyle = wallColor ? wallColorToHex(wallColor) : WALL_COLOR
        } else {
          tileLayerCtx.fillStyle = FALLBACK_FLOOR_COLOR
        }
        tileLayerCtx.fillRect(c * s, r * s, s, s)
        continue
      }

      const colorIdx = r * layoutCols + c
      const color = tileColors?.[colorIdx] ?? { h: 0, s: 0, b: 0, c: 0 }
      const sprite = getColorizedFloorSprite(tile, color)
      const cached = getCachedSprite(sprite, zoom)
      tileLayerCtx.drawImage(cached, c * s, r * s)
    }
  }
}

/** 手動使磚層快取失效（佈局編輯時呼叫） */
export function invalidateTileLayer(): void {
  tileLayerKey = ''
}

// ── 渲染函式 ────────────────────────────────────────────

export function renderTileGrid(
  ctx: CanvasRenderingContext2D,
  tileMap: TileTypeVal[][],
  offsetX: number,
  offsetY: number,
  zoom: number,
  tileColors?: Array<FloorColor | null>,
  cols?: number,
  layoutVersion?: number,
): void {
  const key = `${tileMap.length}:${tileMap[0]?.length ?? 0}:${zoom}:${layoutVersion ?? 0}`
  if (key !== tileLayerKey) {
    rebuildTileLayer(tileMap, zoom, tileColors, cols)
    tileLayerKey = key
  }
  if (tileLayerCanvas) {
    ctx.drawImage(tileLayerCanvas, offsetX, offsetY)
  }
}

interface ZDrawable {
  zY: number
  draw: (ctx: CanvasRenderingContext2D) => void
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  furniture: FurnitureInstance[],
  characters: Character[],
  offsetX: number,
  offsetY: number,
  zoom: number,
  selectedAgentId: number | null,
  hoveredAgentId: number | null,
): void {
  const drawables: ZDrawable[] = []

  // 家具
  for (const f of furniture) {
    const cached = getCachedSprite(f.sprite, zoom)
    const fx = offsetX + f.x * zoom
    const fy = offsetY + f.y * zoom
    drawables.push({
      zY: f.zY,
      draw: (c) => {
        c.drawImage(cached, fx, fy)
      },
    })
  }

  // 角色
  for (const ch of characters) {
    const sprites = getCharacterSprites(ch.palette, ch.hueShift)
    const spriteData = getCharacterSprite(ch, sprites)
    const cached = getCachedSprite(spriteData, zoom)
    // 坐姿偏移：角色坐下時向下移動，使其視覺上坐在椅子上
    const sittingOffset = isSittingState(ch.state) ? CHARACTER_SITTING_OFFSET_PX : 0
    // 錨點在角色底部中央 — 四捨五入為整數裝置像素
    const drawX = Math.round(offsetX + ch.x * zoom - cached.width / 2)
    const drawY = Math.round(offsetY + (ch.y + sittingOffset) * zoom - cached.height)

    // 按角色格底部排序（非中心）使其渲染在
    // 同行家具（如椅子）前方，但在較低行家具
    //（如書桌、書架等從下方遮擋的物件）後方。
    const charZY = ch.y + TILE_SIZE / 2 + CHARACTER_Z_SORT_OFFSET

    // Matrix 生成/消散特效 — 跳過輪廓，使用逐像素渲染
    if (ch.matrixEffect) {
      const mDrawX = drawX
      const mDrawY = drawY
      const mSpriteData = spriteData
      const mCh = ch
      drawables.push({
        zY: charZY,
        draw: (c) => {
          renderMatrixEffect(c, mCh, mSpriteData, mDrawX, mDrawY, zoom)
        },
      })
      continue
    }

    // 白色輪廓：選取時完全不透明，懸停時 50%
    const isSelected = selectedAgentId !== null && ch.id === selectedAgentId
    const isHovered = hoveredAgentId !== null && ch.id === hoveredAgentId
    if (isSelected || isHovered) {
      const outlineAlpha = isSelected ? SELECTED_OUTLINE_ALPHA : HOVERED_OUTLINE_ALPHA
      const outlineData = getOutlineSprite(spriteData)
      const outlineCached = getCachedSprite(outlineData, zoom)
      const olDrawX = drawX - zoom  // 1 個精靈像素偏移，已縮放
      const olDrawY = drawY - zoom  // 輪廓透過 drawY 跟隨坐姿偏移
      drawables.push({
        zY: charZY - OUTLINE_Z_SORT_OFFSET, // 排序在角色之前
        draw: (c) => {
          c.save()
          c.globalAlpha = outlineAlpha
          c.drawImage(outlineCached, olDrawX, olDrawY)
          c.restore()
        },
      })
    }

    // 子代理永久光暈（淡藍色輪廓，與選取/懸停輪廓獨立）
    if (ch.isSubagent && !isSelected && !isHovered) {
      const outlineData = getOutlineSprite(spriteData)
      const outlineCached = getCachedSprite(outlineData, zoom)
      const tinted = tintCanvas(outlineCached, SUBAGENT_GLOW_COLOR)
      const glowDrawX = drawX - zoom
      const glowDrawY = drawY - zoom
      drawables.push({
        zY: charZY - OUTLINE_Z_SORT_OFFSET,
        draw: (c) => {
          c.save()
          c.globalAlpha = SUBAGENT_GLOW_ALPHA
          c.drawImage(tinted, glowDrawX, glowDrawY)
          c.restore()
        },
      })

    // 遠端代理永久光暈（橘色輪廓）
    } else if (ch.isRemote && !isSelected && !isHovered) {
      const outlineData = getOutlineSprite(spriteData)
      const outlineCached = getCachedSprite(outlineData, zoom)
      const tinted = tintCanvas(outlineCached, REMOTE_AGENT_GLOW_COLOR)
      const glowDrawX = drawX - zoom
      const glowDrawY = drawY - zoom
      drawables.push({
        zY: charZY - OUTLINE_Z_SORT_OFFSET,
        draw: (c) => {
          c.save()
          c.globalAlpha = REMOTE_AGENT_GLOW_ALPHA
          c.drawImage(tinted, glowDrawX, glowDrawY)
          c.restore()
        },
      })
    }

    // 等級光暈（25+ 級銀色，50+ 級金色）— 與子代理/遠端光暈獨立
    if (!ch.isSubagent && !ch.isRemote && !isSelected && !isHovered && ch.level >= 25) {
      const glowDef = LEVEL_GLOW_COLORS.find((g) => ch.level >= g.minLevel)
      if (glowDef) {
        const outlineData = getOutlineSprite(spriteData)
        const outlineCached = getCachedSprite(outlineData, zoom)
        const tinted = tintCanvas(outlineCached, glowDef.color)
        const glowDrawX = drawX - zoom
        const glowDrawY = drawY - zoom
        drawables.push({
          zY: charZY - OUTLINE_Z_SORT_OFFSET,
          draw: (c) => {
            c.save()
            c.globalAlpha = glowDef.alpha
            c.drawImage(tinted, glowDrawX, glowDrawY)
            c.restore()
          },
        })
      }
    }

    // 斷線角色以降低的不透明度渲染
    const isDetached = ch.isDetached
    drawables.push({
      zY: charZY,
      draw: (c) => {
        if (isDetached) {
          c.save()
          c.globalAlpha = DETACHED_CHARACTER_ALPHA
        }
        c.drawImage(cached, drawX, drawY)
        if (isDetached) {
          c.restore()
        }
      },
    })
  }

  // 按 Y 排序（越低 = 越前方 = 越晚繪製）
  drawables.sort((a, b) => a.zY - b.zY)

  for (const d of drawables) {
    d.draw(ctx)
  }
}

// ── 座位指示器 ─────────────────────────────────────────────

export function renderSeatIndicators(
  ctx: CanvasRenderingContext2D,
  seats: Map<string, Seat>,
  characters: Map<number, Character>,
  selectedAgentId: number | null,
  hoveredTile: { col: number; row: number } | null,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  if (selectedAgentId === null || !hoveredTile) return
  const selectedChar = characters.get(selectedAgentId)
  if (!selectedChar) return

  // 僅顯示懸停座位格的指示器
  for (const [uid, seat] of seats) {
    if (seat.seatCol !== hoveredTile.col || seat.seatRow !== hoveredTile.row) continue

    const s = TILE_SIZE * zoom
    const x = offsetX + seat.seatCol * s
    const y = offsetY + seat.seatRow * s

    if (selectedChar.seatId === uid) {
      // 選取代理的自身座位 — 藍色
      ctx.fillStyle = SEAT_OWN_COLOR
    } else if (!seat.assigned) {
      // 可用座位 — 綠色
      ctx.fillStyle = SEAT_AVAILABLE_COLOR
    } else {
      // 已佔用（分配給其他代理）— 紅色
      ctx.fillStyle = SEAT_BUSY_COLOR
    }
    ctx.fillRect(x, y, s, s)
    break
  }
}

// ── 編輯模式覆蓋層 ──────────────────────────────────────────

export function renderGridOverlay(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  zoom: number,
  cols: number,
  rows: number,
  tileMap?: TileTypeVal[][],
): void {
  const s = TILE_SIZE * zoom
  ctx.strokeStyle = GRID_LINE_COLOR
  ctx.lineWidth = 1
  ctx.beginPath()
  // 垂直線 — 偏移 0.5 以獲得清晰的 1px 線條
  for (let c = 0; c <= cols; c++) {
    const x = offsetX + c * s + 0.5
    ctx.moveTo(x, offsetY)
    ctx.lineTo(x, offsetY + rows * s)
  }
  // 水平線
  for (let r = 0; r <= rows; r++) {
    const y = offsetY + r * s + 0.5
    ctx.moveTo(offsetX, y)
    ctx.lineTo(offsetX + cols * s, y)
  }
  ctx.stroke()

  // 在 VOID 格上繪製淡虛線輪廓
  if (tileMap) {
    ctx.save()
    ctx.strokeStyle = VOID_TILE_OUTLINE_COLOR
    ctx.lineWidth = 1
    ctx.setLineDash(VOID_TILE_DASH_PATTERN)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (tileMap[r]?.[c] === TileType.VOID) {
          ctx.strokeRect(offsetX + c * s + 0.5, offsetY + r * s + 0.5, s - 1, s - 1)
        }
      }
    }
    ctx.restore()
  }
}

/** 在網格邊界外 1 格繪製淡擴展佔位符（幽靈邊框）。 */
export function renderGhostBorder(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  zoom: number,
  cols: number,
  rows: number,
  ghostHoverCol: number,
  ghostHoverRow: number,
): void {
  const s = TILE_SIZE * zoom
  ctx.save()

  // 收集幽靈邊框格：網格周圍一圈
  const ghostTiles: Array<{ c: number; r: number }> = []
  // 頂部和底部行
  for (let c = -1; c <= cols; c++) {
    ghostTiles.push({ c, r: -1 })
    ghostTiles.push({ c, r: rows })
  }
  // 左側和右側欄（排除已加入的角落）
  for (let r = 0; r < rows; r++) {
    ghostTiles.push({ c: -1, r })
    ghostTiles.push({ c: cols, r })
  }

  for (const { c, r } of ghostTiles) {
    const x = offsetX + c * s
    const y = offsetY + r * s
    const isHovered = c === ghostHoverCol && r === ghostHoverRow
    if (isHovered) {
      ctx.fillStyle = GHOST_BORDER_HOVER_FILL
      ctx.fillRect(x, y, s, s)
    }
    ctx.strokeStyle = isHovered ? GHOST_BORDER_HOVER_STROKE : GHOST_BORDER_STROKE
    ctx.lineWidth = 1
    ctx.setLineDash(VOID_TILE_DASH_PATTERN)
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1)
  }

  ctx.restore()
}

export function renderGhostPreview(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteData,
  col: number,
  row: number,
  valid: boolean,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const cached = getCachedSprite(sprite, zoom)
  const x = offsetX + col * TILE_SIZE * zoom
  const y = offsetY + row * TILE_SIZE * zoom
  ctx.save()
  ctx.globalAlpha = GHOST_PREVIEW_SPRITE_ALPHA
  ctx.drawImage(cached, x, y)
  // 色調覆蓋層
  ctx.globalAlpha = GHOST_PREVIEW_TINT_ALPHA
  ctx.fillStyle = valid ? GHOST_VALID_TINT : GHOST_INVALID_TINT
  ctx.fillRect(x, y, cached.width, cached.height)
  ctx.restore()
}

export function renderSelectionHighlight(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  w: number,
  h: number,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const s = TILE_SIZE * zoom
  const x = offsetX + col * s
  const y = offsetY + row * s
  ctx.save()
  ctx.strokeStyle = SELECTION_HIGHLIGHT_COLOR
  ctx.lineWidth = 2
  ctx.setLineDash(SELECTION_DASH_PATTERN)
  ctx.strokeRect(x + 1, y + 1, w * s - 2, h * s - 2)
  ctx.restore()
}

export function renderDeleteButton(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  w: number,
  _h: number,
  offsetX: number,
  offsetY: number,
  zoom: number,
): DeleteButtonBounds {
  const s = TILE_SIZE * zoom
  // 定位在選取家具的右上角
  const cx = offsetX + (col + w) * s + 1
  const cy = offsetY + row * s - 1
  const radius = Math.max(BUTTON_MIN_RADIUS, zoom * BUTTON_RADIUS_ZOOM_FACTOR)

  // 圓形背景
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = DELETE_BUTTON_BG
  ctx.fill()

  // X 標記
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = Math.max(BUTTON_LINE_WIDTH_MIN, zoom * BUTTON_LINE_WIDTH_ZOOM_FACTOR)
  ctx.lineCap = 'round'
  const xSize = radius * BUTTON_ICON_SIZE_FACTOR
  ctx.beginPath()
  ctx.moveTo(cx - xSize, cy - xSize)
  ctx.lineTo(cx + xSize, cy + xSize)
  ctx.moveTo(cx + xSize, cy - xSize)
  ctx.lineTo(cx - xSize, cy + xSize)
  ctx.stroke()
  ctx.restore()

  return { cx, cy, radius }
}

export function renderRotateButton(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  _w: number,
  _h: number,
  offsetX: number,
  offsetY: number,
  zoom: number,
): RotateButtonBounds {
  const s = TILE_SIZE * zoom
  // 定位在刪除按鈕的左側（刪除按鈕在右上角）
  const radius = Math.max(BUTTON_MIN_RADIUS, zoom * BUTTON_RADIUS_ZOOM_FACTOR)
  const cx = offsetX + col * s - 1
  const cy = offsetY + row * s - 1

  // 圓形背景
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = ROTATE_BUTTON_BG
  ctx.fill()

  // 圓形箭頭圖示
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = Math.max(BUTTON_LINE_WIDTH_MIN, zoom * BUTTON_LINE_WIDTH_ZOOM_FACTOR)
  ctx.lineCap = 'round'
  const arcR = radius * BUTTON_ICON_SIZE_FACTOR
  ctx.beginPath()
  // 繪製 270 度弧線
  ctx.arc(cx, cy, arcR, -Math.PI * 0.8, Math.PI * 0.7)
  ctx.stroke()
  // 在弧線末端繪製箭頭
  const endAngle = Math.PI * 0.7
  const endX = cx + arcR * Math.cos(endAngle)
  const endY = cy + arcR * Math.sin(endAngle)
  const arrowSize = radius * 0.35
  ctx.beginPath()
  ctx.moveTo(endX + arrowSize * 0.6, endY - arrowSize * 0.3)
  ctx.lineTo(endX, endY)
  ctx.lineTo(endX + arrowSize * 0.7, endY + arrowSize * 0.5)
  ctx.stroke()
  ctx.restore()

  return { cx, cy, radius }
}

// ── 對話氣泡 ──────────────────────────────────────────────

export function renderBubbles(
  ctx: CanvasRenderingContext2D,
  characters: Character[],
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  for (const ch of characters) {
    if (!ch.bubbleType) continue

    const sprite = ch.bubbleType === 'permission'
      ? BUBBLE_PERMISSION_SPRITE
      : ch.bubbleType === 'detached'
        ? BUBBLE_DETACHED_SPRITE
        : BUBBLE_WAITING_SPRITE

    // 計算不透明度：權限 = 完全不透明，等待 = 最後 0.5s 淡出
    let alpha = 1.0
    if (ch.bubbleType === 'waiting' && ch.bubbleTimer < BUBBLE_FADE_DURATION_SEC) {
      alpha = ch.bubbleTimer / BUBBLE_FADE_DURATION_SEC
    }

    const cached = getCachedSprite(sprite, zoom)
    // 位置：置中於角色頭部上方
    // 角色錨點在底部中央 (ch.x, ch.y)，精靈圖為 16x24
    // 將氣泡放在頭部上方並留有小間距；跟隨坐姿偏移
    const sittingOff = isSittingState(ch.state) ? BUBBLE_SITTING_OFFSET_PX : 0
    const bubbleX = Math.round(offsetX + ch.x * zoom - cached.width / 2)
    const bubbleY = Math.round(offsetY + (ch.y + sittingOff - BUBBLE_VERTICAL_OFFSET_PX) * zoom - cached.height - 1 * zoom)

    ctx.save()
    if (alpha < 1.0) ctx.globalAlpha = alpha
    ctx.drawImage(cached, bubbleX, bubbleY)
    ctx.restore()
  }
}

// ── 表情圖標 ──────────────────────────────────────────────

export function renderEmotes(
  ctx: CanvasRenderingContext2D,
  characters: Character[],
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  for (const ch of characters) {
    if (!ch.emoteType) continue

    const sprite = getEmoteSprite(ch.emoteType)
    const cached = getCachedSprite(sprite, zoom)

    // 淡出效果：最後 EMOTE_FADE_DURATION_SEC 秒逐漸消失
    let alpha = 1.0
    if (ch.emoteTimer < EMOTE_FADE_DURATION_SEC) {
      alpha = ch.emoteTimer / EMOTE_FADE_DURATION_SEC
    }

    // 位置：角色頭部右上方（不與氣泡重疊）
    const sittingOff = isSittingState(ch.state) ? CHARACTER_SITTING_OFFSET_PX : 0
    const emoteX = Math.round(offsetX + (ch.x + 4) * zoom)
    const emoteY = Math.round(offsetY + (ch.y + sittingOff - EMOTE_VERTICAL_OFFSET_PX) * zoom - cached.height)

    ctx.save()
    if (alpha < 1.0) ctx.globalAlpha = alpha
    ctx.drawImage(cached, emoteX, emoteY)
    ctx.restore()
  }
}

// ── 團隊視覺化 ────────────────────────────────────────────

export function renderTeamConnections(
  ctx: CanvasRenderingContext2D,
  characters: Character[],
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  // 按團隊分組角色
  const teamMap = new Map<string, Character[]>()
  for (const ch of characters) {
    if (!ch.teamName || !ch.teamColor || ch.matrixEffect) continue
    let list = teamMap.get(ch.teamName)
    if (!list) {
      list = []
      teamMap.set(ch.teamName, list)
    }
    list.push(ch)
  }

  ctx.save()
  ctx.globalAlpha = TEAM_CONNECTION_LINE_ALPHA
  ctx.lineWidth = TEAM_CONNECTION_LINE_WIDTH * zoom
  ctx.setLineDash(TEAM_CONNECTION_DASH.map(d => d * zoom))

  for (const [, members] of teamMap) {
    if (members.length < 2) continue
    const color = members[0].teamColor!
    ctx.strokeStyle = color

    // 連接所有成員（鏈式：0→1→2→...）
    for (let i = 0; i < members.length - 1; i++) {
      const a = members[i]
      const b = members[i + 1]
      const sittingOffA = isSittingState(a.state) ? CHARACTER_SITTING_OFFSET_PX : 0
      const sittingOffB = isSittingState(b.state) ? CHARACTER_SITTING_OFFSET_PX : 0
      const ax = Math.round(offsetX + (a.x + 8) * zoom)
      const ay = Math.round(offsetY + (a.y + sittingOffA - 8) * zoom)
      const bx = Math.round(offsetX + (b.x + 8) * zoom)
      const by = Math.round(offsetY + (b.y + sittingOffB - 8) * zoom)
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.stroke()
    }
  }

  ctx.restore()
}

export function renderTeamBadges(
  ctx: CanvasRenderingContext2D,
  characters: Character[],
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  for (const ch of characters) {
    if (!ch.teamColor || ch.matrixEffect) continue

    const sittingOff = isSittingState(ch.state) ? CHARACTER_SITTING_OFFSET_PX : 0
    const badgePx = TEAM_BADGE_SIZE * zoom
    const bx = Math.round(offsetX + (ch.x + 8) * zoom - badgePx / 2)
    const by = Math.round(offsetY + (ch.y + sittingOff - TEAM_BADGE_VERTICAL_OFFSET_PX) * zoom)

    ctx.fillStyle = ch.teamColor
    ctx.fillRect(bx, by, badgePx, badgePx)
  }
}

/** 繪製等級徽章（角色腳下的 "Lv{N}" 文字） */
export function renderLevelBadges(
  ctx: CanvasRenderingContext2D,
  characters: Character[],
  offsetX: number,
  offsetY: number,
  zoom: number,
  hoveredAgentId: number | null,
  selectedAgentId: number | null,
): void {
  if (zoom < 2) return // 縮放太小時不繪製
  for (const ch of characters) {
    if (ch.level <= 1 || ch.matrixEffect) continue
    // 僅在懸停或選取時顯示
    if (ch.id !== hoveredAgentId && ch.id !== selectedAgentId) continue

    const sittingOff = isSittingState(ch.state) ? CHARACTER_SITTING_OFFSET_PX : 0
    const fontSize = Math.max(8, Math.round(5 * zoom))
    const text = `Lv${ch.level}`

    // 選取等級對應的顏色
    const colorDef = LEVEL_BADGE_COLORS.find((c) => ch.level >= c.minLevel)
    const color = colorDef ? colorDef.color : '#888888'

    const bx = Math.round(offsetX + ch.x * zoom)
    const by = Math.round(offsetY + (ch.y + sittingOff - LEVEL_BADGE_VERTICAL_OFFSET_PX) * zoom)

    ctx.save()
    ctx.font = `${fontSize}px "FS Pixel Sans", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    // 暗色背景描邊
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = Math.max(2, zoom * 0.6)
    ctx.strokeText(text, bx, by)
    // 前景色
    ctx.fillStyle = color
    ctx.fillText(text, bx, by)
    ctx.restore()
  }
}

export interface ButtonBounds {
  /** 裝置像素中的中心 X */
  cx: number
  /** 裝置像素中的中心 Y */
  cy: number
  /** 裝置像素中的半徑 */
  radius: number
}

export type DeleteButtonBounds = ButtonBounds
export type RotateButtonBounds = ButtonBounds

export interface EditorRenderState {
  showGrid: boolean
  ghostSprite: SpriteData | null
  ghostCol: number
  ghostRow: number
  ghostValid: boolean
  selectedCol: number
  selectedRow: number
  selectedW: number
  selectedH: number
  hasSelection: boolean
  isRotatable: boolean
  /** 每幀由 renderDeleteButton 更新 */
  deleteButtonBounds: DeleteButtonBounds | null
  /** 每幀由 renderRotateButton 更新 */
  rotateButtonBounds: RotateButtonBounds | null
  /** 是否顯示幽靈邊框（網格外的擴展格） */
  showGhostBorder: boolean
  /** 懸停的幽靈邊框格欄（-1 到 cols） */
  ghostBorderHoverCol: number
  /** 懸停的幽靈邊框格行（-1 到 rows） */
  ghostBorderHoverRow: number
}

export interface SelectionRenderState {
  selectedAgentId: number | null
  hoveredAgentId: number | null
  hoveredTile: { col: number; row: number } | null
  seats: Map<string, Seat>
  characters: Map<number, Character>
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  tileMap: TileTypeVal[][],
  furniture: FurnitureInstance[],
  characters: Character[],
  zoom: number,
  panX: number,
  panY: number,
  selection?: SelectionRenderState,
  editor?: EditorRenderState,
  tileColors?: Array<FloorColor | null>,
  layoutCols?: number,
  layoutRows?: number,
  dayNightOverlay?: { color: string; alpha: number },
  layoutVersion?: number,
): { offsetX: number; offsetY: number } {
  // 清除
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  // 使用佈局尺寸（備選為 tileMap 大小）
  const cols = layoutCols ?? (tileMap.length > 0 ? tileMap[0].length : 0)
  const rows = layoutRows ?? tileMap.length

  // 在視窗中置中地圖 + 平移偏移（整數裝置像素）
  const mapW = cols * TILE_SIZE * zoom
  const mapH = rows * TILE_SIZE * zoom
  const offsetX = Math.floor((canvasWidth - mapW) / 2) + Math.round(panX)
  const offsetY = Math.floor((canvasHeight - mapH) / 2) + Math.round(panY)

  // 繪製磚塊（地板 + 牆壁底色）— 使用離屏快取
  renderTileGrid(ctx, tileMap, offsetX, offsetY, zoom, tileColors, layoutCols, layoutVersion)

  // 座位指示器（在家具/角色下方，在地板上方）
  if (selection) {
    renderSeatIndicators(ctx, selection.seats, selection.characters, selection.selectedAgentId, selection.hoveredTile, offsetX, offsetY, zoom)
  }

  // 建構牆壁實例以與家具和角色進行 Z-sort
  const wallInstances = hasWallSprites()
    ? getWallInstances(tileMap, tileColors, layoutCols)
    : []
  const allFurniture = wallInstances.length > 0
    ? [...wallInstances, ...furniture]
    : furniture

  // 團隊連接線（在角色下方）
  renderTeamConnections(ctx, characters, offsetX, offsetY, zoom)

  // 繪製牆壁 + 家具 + 角色（Z-sort）
  const selectedId = selection?.selectedAgentId ?? null
  const hoveredId = selection?.hoveredAgentId ?? null
  renderScene(ctx, allFurniture, characters, offsetX, offsetY, zoom, selectedId, hoveredId)

  // 等級徽章（懸停/選取時在角色頭上）
  renderLevelBadges(ctx, characters, offsetX, offsetY, zoom, hoveredId, selectedId)

  // 團隊徽章（在角色上方）
  renderTeamBadges(ctx, characters, offsetX, offsetY, zoom)

  // 對話氣泡（始終在角色上方）
  renderBubbles(ctx, characters, offsetX, offsetY, zoom)

  // 表情圖標（在氣泡旁邊）
  renderEmotes(ctx, characters, offsetX, offsetY, zoom)

  // 日夜色溫覆蓋層（在角色/家具之上，編輯器覆蓋層之前）
  if (dayNightOverlay && dayNightOverlay.alpha > 0) {
    ctx.save()
    ctx.fillStyle = dayNightOverlay.color
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    ctx.restore()
  }

  // 編輯器覆蓋層
  if (editor) {
    if (editor.showGrid) {
      renderGridOverlay(ctx, offsetX, offsetY, zoom, cols, rows, tileMap)
    }
    if (editor.showGhostBorder) {
      renderGhostBorder(ctx, offsetX, offsetY, zoom, cols, rows, editor.ghostBorderHoverCol, editor.ghostBorderHoverRow)
    }
    if (editor.ghostSprite && editor.ghostCol >= 0) {
      renderGhostPreview(ctx, editor.ghostSprite, editor.ghostCol, editor.ghostRow, editor.ghostValid, offsetX, offsetY, zoom)
    }
    if (editor.hasSelection) {
      renderSelectionHighlight(ctx, editor.selectedCol, editor.selectedRow, editor.selectedW, editor.selectedH, offsetX, offsetY, zoom)
      editor.deleteButtonBounds = renderDeleteButton(ctx, editor.selectedCol, editor.selectedRow, editor.selectedW, editor.selectedH, offsetX, offsetY, zoom)
      if (editor.isRotatable) {
        editor.rotateButtonBounds = renderRotateButton(ctx, editor.selectedCol, editor.selectedRow, editor.selectedW, editor.selectedH, offsetX, offsetY, zoom)
      } else {
        editor.rotateButtonBounds = null
      }
    } else {
      editor.deleteButtonBounds = null
      editor.rotateButtonBounds = null
    }
  }

  return { offsetX, offsetY }
}

// ── 迷你地圖 ────────────────────────────────────────────────

export interface MinimapBounds {
  /** minimap 在 canvas 上的裝置像素矩形 */
  x: number
  y: number
  w: number
  h: number
  /** 每格在 minimap 上的裝置像素大小 */
  tilePx: number
  cols: number
  rows: number
}

export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  tileMap: TileTypeVal[][],
  furniture: FurnitureInstance[],
  characters: Character[],
  zoom: number,
  offsetX: number,
  offsetY: number,
  layoutCols: number,
  layoutRows: number,
  dpr: number,
): MinimapBounds | null {
  if (layoutCols === 0 || layoutRows === 0) return null

  // 常數以 CSS 像素定義，乘以 DPR 得到設備像素
  // 行動裝置（CSS 寬度 < 768px）縮小迷你地圖
  const cssWidth = canvasWidth / dpr
  const mobileFactor = cssWidth < 768 ? 0.5 : 1
  const maxSize = MINIMAP_MAX_SIZE * dpr * mobileFactor
  const minSize = MINIMAP_MIN_SIZE * dpr * mobileFactor
  const tileMinPx = MINIMAP_TILE_MIN_PX * dpr

  // 計算 minimap 尺寸：適配地圖比例，限制在 MIN-MAX 範圍
  const aspect = layoutCols / layoutRows
  let mmW: number
  let mmH: number
  const tilePx = Math.max(tileMinPx, Math.floor(maxSize / Math.max(layoutCols, layoutRows)))
  mmW = layoutCols * tilePx
  mmH = layoutRows * tilePx
  if (mmW > maxSize) { mmW = maxSize; mmH = mmW / aspect }
  if (mmH > maxSize) { mmH = maxSize; mmW = mmH * aspect }
  if (mmW < minSize && mmH < minSize) {
    if (aspect >= 1) { mmW = minSize; mmH = mmW / aspect }
    else { mmH = minSize; mmW = mmH * aspect }
  }

  mmW = Math.round(mmW)
  mmH = Math.round(mmH)

  const marginLeft = MINIMAP_MARGIN * dpr
  const marginTop = MINIMAP_MARGIN * dpr
  const mmX = marginLeft
  const mmY = marginTop

  // 背景
  const border = Math.max(1, Math.round(dpr))
  ctx.fillStyle = MINIMAP_BG_COLOR
  ctx.fillRect(mmX - border, mmY - border, mmW + border * 2, mmH + border * 2)
  ctx.strokeStyle = 'rgba(100,100,140,0.5)'
  ctx.lineWidth = border
  ctx.strokeRect(mmX - border, mmY - border, mmW + border * 2, mmH + border * 2)

  // 繪製磚塊
  const tileW = mmW / layoutCols
  const tileH = mmH / layoutRows
  for (let r = 0; r < layoutRows && r < tileMap.length; r++) {
    for (let c = 0; c < layoutCols && tileMap[r] && c < tileMap[r].length; c++) {
      const tile = tileMap[r][c]
      if (tile === TileType.VOID) continue
      ctx.fillStyle = tile === TileType.WALL ? MINIMAP_WALL_COLOR : MINIMAP_FLOOR_COLOR
      ctx.fillRect(mmX + c * tileW, mmY + r * tileH, Math.ceil(tileW), Math.ceil(tileH))
    }
  }

  // 繪製家具（小色塊）
  ctx.fillStyle = MINIMAP_FURNITURE_COLOR
  for (const f of furniture) {
    const fCol = f.x / TILE_SIZE
    const fRow = f.y / TILE_SIZE
    const fW = (f.sprite[0]?.length ?? TILE_SIZE) / TILE_SIZE
    const fH = f.sprite.length / TILE_SIZE
    ctx.fillRect(
      mmX + fCol * tileW,
      mmY + fRow * tileH,
      Math.ceil(fW * tileW),
      Math.ceil(fH * tileH),
    )
  }

  // 繪製角色（彩色圓點）— palette 索引 → 代表色
  const PALETTE_COLORS = ['#4a90d9', '#d94a4a', '#4ad97a', '#d9b44a', '#9b59b6', '#e67e22']
  const dot = Math.max(2, Math.round(MINIMAP_DOT_SIZE * dpr))
  for (const ch of characters) {
    if (ch.matrixEffect === 'despawn') continue
    const cx = mmX + (ch.x / TILE_SIZE) * tileW
    const cy = mmY + (ch.y / TILE_SIZE) * tileH
    ctx.fillStyle = PALETTE_COLORS[ch.palette] ?? '#66ff66'
    ctx.fillRect(Math.round(cx - dot / 2), Math.round(cy - dot / 2), dot, dot)
  }

  // 繪製視窗矩形
  // 視窗在世界座標中的可見區域
  const vpLeft = -offsetX / zoom
  const vpTop = -offsetY / zoom
  const vpWidth = canvasWidth / zoom
  const vpHeight = canvasHeight / zoom

  // 轉換為 minimap 座標
  const vpMmX = mmX + (vpLeft / (layoutCols * TILE_SIZE)) * mmW
  const vpMmY = mmY + (vpTop / (layoutRows * TILE_SIZE)) * mmH
  const vpMmW = (vpWidth / (layoutCols * TILE_SIZE)) * mmW
  const vpMmH = (vpHeight / (layoutRows * TILE_SIZE)) * mmH

  ctx.strokeStyle = MINIMAP_VIEWPORT_STROKE
  ctx.lineWidth = Math.max(1, Math.round(dpr))
  ctx.strokeRect(
    Math.max(mmX, vpMmX),
    Math.max(mmY, vpMmY),
    Math.min(vpMmW, mmW),
    Math.min(vpMmH, mmH),
  )

  return { x: mmX, y: mmY, w: mmW, h: mmH, tilePx: tileW, cols: layoutCols, rows: layoutRows }
}
