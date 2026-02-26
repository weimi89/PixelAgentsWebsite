import type { Direction, SpriteData, FloorColor } from '../types.js'
import { Direction as Dir } from '../types.js'
import { adjustSprite } from '../colorize.js'

// ── Color Palettes ──────────────────────────────────────────────
const _ = '' // transparent

// ── Furniture Sprites ───────────────────────────────────────────

/** Square desk: 32x32 pixels (2x2 tiles) — top-down wood surface */
export const DESK_SQUARE_SPRITE: SpriteData = (() => {
  const W = '#8B6914' // wood edge
  const L = '#A07828' // lighter wood
  const S = '#B8922E' // surface
  const D = '#6B4E0A' // dark edge
  const rows: string[][] = []
  // Row 0: empty
  rows.push(new Array(32).fill(_))
  // Row 1: top edge
  rows.push([_, ...new Array(30).fill(W), _])
  // Rows 2-5: top surface
  for (let r = 0; r < 4; r++) {
    rows.push([_, W, ...new Array(28).fill(r < 1 ? L : S), W, _])
  }
  // Row 6: horizontal divider
  rows.push([_, D, ...new Array(28).fill(W), D, _])
  // Rows 7-12: middle surface area
  for (let r = 0; r < 6; r++) {
    rows.push([_, W, ...new Array(28).fill(S), W, _])
  }
  // Row 13: center line
  rows.push([_, W, ...new Array(28).fill(L), W, _])
  // Rows 14-19: lower surface
  for (let r = 0; r < 6; r++) {
    rows.push([_, W, ...new Array(28).fill(S), W, _])
  }
  // Row 20: horizontal divider
  rows.push([_, D, ...new Array(28).fill(W), D, _])
  // Rows 21-24: bottom surface
  for (let r = 0; r < 4; r++) {
    rows.push([_, W, ...new Array(28).fill(r > 2 ? L : S), W, _])
  }
  // Row 25: bottom edge
  rows.push([_, ...new Array(30).fill(W), _])
  // Rows 26-31: legs/shadow
  for (let r = 0; r < 4; r++) {
    const row = new Array(32).fill(_) as string[]
    row[1] = D; row[2] = D; row[29] = D; row[30] = D
    rows.push(row)
  }
  rows.push(new Array(32).fill(_))
  rows.push(new Array(32).fill(_))
  return rows
})()

/** Plant in pot: 16x24 */
export const PLANT_SPRITE: SpriteData = (() => {
  const G = '#3D8B37'
  const D = '#2D6B27'
  const T = '#6B4E0A'
  const P = '#B85C3A'
  const R = '#8B4422'
  return [
    [_, _, _, _, _, _, G, G, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, G, G, G, G, _, _, _, _, _, _, _],
    [_, _, _, _, G, G, D, G, G, G, _, _, _, _, _, _],
    [_, _, _, G, G, D, G, G, D, G, G, _, _, _, _, _],
    [_, _, G, G, G, G, G, G, G, G, G, G, _, _, _, _],
    [_, G, G, D, G, G, G, G, G, G, D, G, G, _, _, _],
    [_, G, G, G, G, D, G, G, D, G, G, G, G, _, _, _],
    [_, _, G, G, G, G, G, G, G, G, G, G, _, _, _, _],
    [_, _, _, G, G, G, D, G, G, G, G, _, _, _, _, _],
    [_, _, _, _, G, G, G, G, G, G, _, _, _, _, _, _],
    [_, _, _, _, _, G, G, G, G, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, T, T, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, T, T, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, T, T, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, R, R, R, R, R, _, _, _, _, _, _],
    [_, _, _, _, R, P, P, P, P, P, R, _, _, _, _, _],
    [_, _, _, _, R, P, P, P, P, P, R, _, _, _, _, _],
    [_, _, _, _, R, P, P, P, P, P, R, _, _, _, _, _],
    [_, _, _, _, R, P, P, P, P, P, R, _, _, _, _, _],
    [_, _, _, _, R, P, P, P, P, P, R, _, _, _, _, _],
    [_, _, _, _, R, P, P, P, P, P, R, _, _, _, _, _],
    [_, _, _, _, _, R, P, P, P, R, _, _, _, _, _, _],
    [_, _, _, _, _, _, R, R, R, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Bookshelf: 16x32 (1 tile wide, 2 tiles tall) */
export const BOOKSHELF_SPRITE: SpriteData = (() => {
  const W = '#8B6914'
  const D = '#6B4E0A'
  const R = '#CC4444'
  const B = '#4477AA'
  const G = '#44AA66'
  const Y = '#CCAA33'
  const P = '#9955AA'
  return [
    [_, W, W, W, W, W, W, W, W, W, W, W, W, W, W, _],
    [W, D, D, D, D, D, D, D, D, D, D, D, D, D, D, W],
    [W, D, R, R, B, B, G, G, Y, Y, R, R, B, B, D, W],
    [W, D, R, R, B, B, G, G, Y, Y, R, R, B, B, D, W],
    [W, D, R, R, B, B, G, G, Y, Y, R, R, B, B, D, W],
    [W, D, R, R, B, B, G, G, Y, Y, R, R, B, B, D, W],
    [W, D, R, R, B, B, G, G, Y, Y, R, R, B, B, D, W],
    [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
    [W, D, D, D, D, D, D, D, D, D, D, D, D, D, D, W],
    [W, D, P, P, Y, Y, B, B, G, G, P, P, R, R, D, W],
    [W, D, P, P, Y, Y, B, B, G, G, P, P, R, R, D, W],
    [W, D, P, P, Y, Y, B, B, G, G, P, P, R, R, D, W],
    [W, D, P, P, Y, Y, B, B, G, G, P, P, R, R, D, W],
    [W, D, P, P, Y, Y, B, B, G, G, P, P, R, R, D, W],
    [W, D, P, P, Y, Y, B, B, G, G, P, P, R, R, D, W],
    [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
    [W, D, D, D, D, D, D, D, D, D, D, D, D, D, D, W],
    [W, D, G, G, R, R, P, P, B, B, Y, Y, G, G, D, W],
    [W, D, G, G, R, R, P, P, B, B, Y, Y, G, G, D, W],
    [W, D, G, G, R, R, P, P, B, B, Y, Y, G, G, D, W],
    [W, D, G, G, R, R, P, P, B, B, Y, Y, G, G, D, W],
    [W, D, G, G, R, R, P, P, B, B, Y, Y, G, G, D, W],
    [W, D, G, G, R, R, P, P, B, B, Y, Y, G, G, D, W],
    [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
    [W, D, D, D, D, D, D, D, D, D, D, D, D, D, D, W],
    [W, D, D, D, D, D, D, D, D, D, D, D, D, D, D, W],
    [W, D, D, D, D, D, D, D, D, D, D, D, D, D, D, W],
    [W, D, D, D, D, D, D, D, D, D, D, D, D, D, D, W],
    [W, D, D, D, D, D, D, D, D, D, D, D, D, D, D, W],
    [W, D, D, D, D, D, D, D, D, D, D, D, D, D, D, W],
    [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
    [_, W, W, W, W, W, W, W, W, W, W, W, W, W, W, _],
  ]
})()

/** Water cooler: 16x24 */
export const COOLER_SPRITE: SpriteData = (() => {
  const W = '#CCDDEE'
  const L = '#88BBDD'
  const D = '#999999'
  const B = '#666666'
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, D, D, D, D, D, D, _, _, _, _, _],
    [_, _, _, _, D, L, L, L, L, L, L, D, _, _, _, _],
    [_, _, _, _, D, L, L, L, L, L, L, D, _, _, _, _],
    [_, _, _, _, D, L, L, L, L, L, L, D, _, _, _, _],
    [_, _, _, _, D, L, L, L, L, L, L, D, _, _, _, _],
    [_, _, _, _, D, L, L, L, L, L, L, D, _, _, _, _],
    [_, _, _, _, _, D, D, D, D, D, D, _, _, _, _, _],
    [_, _, _, _, _, D, W, W, W, W, D, _, _, _, _, _],
    [_, _, _, _, _, D, W, W, W, W, D, _, _, _, _, _],
    [_, _, _, _, _, D, W, W, W, W, D, _, _, _, _, _],
    [_, _, _, _, _, D, W, W, W, W, D, _, _, _, _, _],
    [_, _, _, _, _, D, W, W, W, W, D, _, _, _, _, _],
    [_, _, _, _, D, D, W, W, W, W, D, D, _, _, _, _],
    [_, _, _, _, D, W, W, W, W, W, W, D, _, _, _, _],
    [_, _, _, _, D, W, W, W, W, W, W, D, _, _, _, _],
    [_, _, _, _, D, D, D, D, D, D, D, D, _, _, _, _],
    [_, _, _, _, _, D, B, B, B, B, D, _, _, _, _, _],
    [_, _, _, _, _, D, B, B, B, B, D, _, _, _, _, _],
    [_, _, _, _, _, D, B, B, B, B, D, _, _, _, _, _],
    [_, _, _, _, D, D, B, B, B, B, D, D, _, _, _, _],
    [_, _, _, _, D, B, B, B, B, B, B, D, _, _, _, _],
    [_, _, _, _, D, D, D, D, D, D, D, D, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Whiteboard: 32x16 (2 tiles wide, 1 tile tall) — hangs on wall */
export const WHITEBOARD_SPRITE: SpriteData = (() => {
  const F = '#AAAAAA'
  const W = '#EEEEFF'
  const M = '#CC4444'
  const B = '#4477AA'
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, _],
    [_, F, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, F, _],
    [_, F, W, W, M, M, M, W, W, W, W, W, B, B, B, B, W, W, W, W, W, W, W, M, W, W, W, W, W, W, F, _],
    [_, F, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, B, B, W, W, M, W, W, W, W, W, W, F, _],
    [_, F, W, W, W, W, M, M, M, M, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, B, B, W, W, F, _],
    [_, F, W, W, W, W, W, W, W, W, W, W, W, B, B, B, W, W, W, W, W, W, W, W, W, W, W, W, W, W, F, _],
    [_, F, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, M, M, M, W, W, W, W, W, W, W, F, _],
    [_, F, W, M, M, W, W, W, W, W, W, W, W, W, W, W, B, B, W, W, W, W, W, W, W, W, W, W, W, W, F, _],
    [_, F, W, W, W, W, W, W, B, B, B, W, W, W, W, W, W, W, W, W, W, W, W, W, M, M, M, M, W, W, F, _],
    [_, F, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, F, _],
    [_, F, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, F, _],
    [_, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Chair: 16x16 — top-down desk chair */
export const CHAIR_SPRITE: SpriteData = (() => {
  const W = '#8B6914'
  const D = '#6B4E0A'
  const B = '#5C3D0A'
  const S = '#A07828'
  return [
    [_, _, _, _, _, D, D, D, D, D, D, _, _, _, _, _],
    [_, _, _, _, D, B, B, B, B, B, B, D, _, _, _, _],
    [_, _, _, _, D, B, S, S, S, S, B, D, _, _, _, _],
    [_, _, _, _, D, B, S, S, S, S, B, D, _, _, _, _],
    [_, _, _, _, D, B, S, S, S, S, B, D, _, _, _, _],
    [_, _, _, _, D, B, S, S, S, S, B, D, _, _, _, _],
    [_, _, _, _, D, B, S, S, S, S, B, D, _, _, _, _],
    [_, _, _, _, D, B, S, S, S, S, B, D, _, _, _, _],
    [_, _, _, _, D, B, S, S, S, S, B, D, _, _, _, _],
    [_, _, _, _, D, B, B, B, B, B, B, D, _, _, _, _],
    [_, _, _, _, _, D, D, D, D, D, D, _, _, _, _, _],
    [_, _, _, _, _, _, D, W, W, D, _, _, _, _, _, _],
    [_, _, _, _, _, _, D, W, W, D, _, _, _, _, _, _],
    [_, _, _, _, _, D, D, D, D, D, D, _, _, _, _, _],
    [_, _, _, _, _, D, _, _, _, _, D, _, _, _, _, _],
    [_, _, _, _, _, D, _, _, _, _, D, _, _, _, _, _],
  ]
})()

/** PC monitor: 16x16 — top-down monitor on stand */
export const PC_SPRITE: SpriteData = (() => {
  const F = '#555555'
  const S = '#3A3A5C'
  const B = '#6688CC'
  const D = '#444444'
  return [
    [_, _, _, F, F, F, F, F, F, F, F, F, F, _, _, _],
    [_, _, _, F, S, S, S, S, S, S, S, S, F, _, _, _],
    [_, _, _, F, S, B, B, B, B, B, B, S, F, _, _, _],
    [_, _, _, F, S, B, B, B, B, B, B, S, F, _, _, _],
    [_, _, _, F, S, B, B, B, B, B, B, S, F, _, _, _],
    [_, _, _, F, S, B, B, B, B, B, B, S, F, _, _, _],
    [_, _, _, F, S, B, B, B, B, B, B, S, F, _, _, _],
    [_, _, _, F, S, B, B, B, B, B, B, S, F, _, _, _],
    [_, _, _, F, S, S, S, S, S, S, S, S, F, _, _, _],
    [_, _, _, F, F, F, F, F, F, F, F, F, F, _, _, _],
    [_, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, D, D, D, D, _, _, _, _, _, _],
    [_, _, _, _, _, D, D, D, D, D, D, _, _, _, _, _],
    [_, _, _, _, _, D, D, D, D, D, D, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Desk lamp: 16x16 — top-down lamp with light cone */
export const LAMP_SPRITE: SpriteData = (() => {
  const Y = '#FFDD55'
  const L = '#FFEE88'
  const D = '#888888'
  const B = '#555555'
  const G = '#FFFFCC'
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, G, G, G, G, _, _, _, _, _, _],
    [_, _, _, _, _, G, Y, Y, Y, Y, G, _, _, _, _, _],
    [_, _, _, _, G, Y, Y, L, L, Y, Y, G, _, _, _, _],
    [_, _, _, _, Y, Y, L, L, L, L, Y, Y, _, _, _, _],
    [_, _, _, _, Y, Y, L, L, L, L, Y, Y, _, _, _, _],
    [_, _, _, _, _, Y, Y, Y, Y, Y, Y, _, _, _, _, _],
    [_, _, _, _, _, _, D, D, D, D, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, D, D, D, D, _, _, _, _, _, _],
    [_, _, _, _, _, B, B, B, B, B, B, _, _, _, _, _],
    [_, _, _, _, _, B, B, B, B, B, B, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

// ── New Furniture Sprites ──────────────────────────────────────

/** Laptop: 16x16 — open laptop, top-down view (surface item) */
export const LAPTOP_SPRITE: SpriteData = (() => {
  const F = '#444444' // frame
  const S = '#333333' // screen bezel
  const B = '#4488CC' // screen blue
  const L = '#66AADD' // screen highlight
  const K = '#555555' // keyboard body
  const T = '#777777' // keys
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, F, F, F, F, F, F, F, F, F, F, _, _, _],
    [_, _, _, F, S, S, S, S, S, S, S, S, F, _, _, _],
    [_, _, _, F, S, B, L, B, B, L, B, S, F, _, _, _],
    [_, _, _, F, S, B, B, B, B, B, B, S, F, _, _, _],
    [_, _, _, F, S, B, B, L, L, B, B, S, F, _, _, _],
    [_, _, _, F, S, B, B, B, B, B, B, S, F, _, _, _],
    [_, _, _, F, F, F, F, F, F, F, F, F, F, _, _, _],
    [_, _, _, K, K, K, K, K, K, K, K, K, K, _, _, _],
    [_, _, _, K, T, K, T, K, T, K, T, K, K, _, _, _],
    [_, _, _, K, K, T, K, T, K, T, K, T, K, _, _, _],
    [_, _, _, K, T, K, T, K, T, K, T, K, K, _, _, _],
    [_, _, _, K, K, K, T, T, T, T, K, K, K, _, _, _],
    [_, _, _, K, K, K, K, K, K, K, K, K, K, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Printer: 16x24 — boxy office printer */
export const PRINTER_SPRITE: SpriteData = (() => {
  const F = '#CCCCCC' // frame light
  const M = '#AAAAAA' // frame mid
  const D = '#888888' // frame dark
  const B = '#666666' // bottom
  const P = '#EEEEEE' // paper
  const G = '#44BB66' // status LED
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, P, P, P, P, P, P, P, P, _, _, _, _],
    [_, _, _, _, P, P, P, P, P, P, P, P, _, _, _, _],
    [_, _, _, D, D, D, D, D, D, D, D, D, D, _, _, _],
    [_, _, _, D, F, F, F, F, F, F, F, F, D, _, _, _],
    [_, _, _, D, F, F, F, F, F, F, F, F, D, _, _, _],
    [_, _, _, D, F, M, M, M, M, M, M, F, D, _, _, _],
    [_, _, _, D, F, M, M, M, M, M, M, F, D, _, _, _],
    [_, _, _, D, D, D, D, D, D, D, D, D, D, _, _, _],
    [_, _, _, D, F, F, F, F, F, F, F, F, D, _, _, _],
    [_, _, _, D, F, F, F, F, F, F, F, F, D, _, _, _],
    [_, _, _, D, F, F, F, F, F, F, G, F, D, _, _, _],
    [_, _, _, D, D, D, D, D, D, D, D, D, D, _, _, _],
    [_, _, _, D, B, B, B, B, B, B, B, B, D, _, _, _],
    [_, _, _, D, B, B, B, B, B, B, B, B, D, _, _, _],
    [_, _, _, D, M, M, M, M, M, M, M, M, D, _, _, _],
    [_, _, _, D, M, P, P, P, P, P, P, M, D, _, _, _],
    [_, _, _, D, M, P, P, P, P, P, P, M, D, _, _, _],
    [_, _, _, D, D, D, D, D, D, D, D, D, D, _, _, _],
    [_, _, _, B, B, _, _, _, _, _, _, B, B, _, _, _],
    [_, _, _, B, B, _, _, _, _, _, _, B, B, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Coffee machine: 16x24 — drip coffee maker */
export const COFFEE_MACHINE_SPRITE: SpriteData = (() => {
  const F = '#444444' // frame
  const M = '#555555' // mid
  const D = '#333333' // dark
  const W = '#AABBCC' // water tank
  const L = '#88AACC' // water
  const R = '#CC4444' // button
  const C = '#8B6914' // coffee color
  const G = '#777777' // glass pot
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, D, D, D, D, D, D, _, _, _, _, _],
    [_, _, _, _, D, W, W, W, W, W, W, D, _, _, _, _],
    [_, _, _, _, D, W, L, L, L, L, W, D, _, _, _, _],
    [_, _, _, _, D, W, L, L, L, L, W, D, _, _, _, _],
    [_, _, _, _, D, W, L, L, L, L, W, D, _, _, _, _],
    [_, _, _, _, D, W, W, W, W, W, W, D, _, _, _, _],
    [_, _, _, _, D, D, D, D, D, D, D, D, _, _, _, _],
    [_, _, _, _, D, F, F, F, F, F, F, D, _, _, _, _],
    [_, _, _, _, D, F, F, F, F, R, F, D, _, _, _, _],
    [_, _, _, _, D, F, F, F, F, F, F, D, _, _, _, _],
    [_, _, _, _, D, M, M, M, M, M, M, D, _, _, _, _],
    [_, _, _, _, D, M, M, M, M, M, M, D, _, _, _, _],
    [_, _, _, _, D, D, D, D, D, D, D, D, _, _, _, _],
    [_, _, _, _, _, _, G, G, G, G, _, _, _, _, _, _],
    [_, _, _, _, _, G, C, C, C, C, G, _, _, _, _, _],
    [_, _, _, _, _, G, C, C, C, C, G, _, _, _, _, _],
    [_, _, _, _, _, G, C, C, C, C, G, _, _, _, _, _],
    [_, _, _, _, _, G, G, G, G, G, G, _, _, _, _, _],
    [_, _, _, _, D, D, D, D, D, D, D, D, _, _, _, _],
    [_, _, _, _, D, D, D, D, D, D, D, D, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Sofa: 32x16 — two-seater couch (2 tiles wide, 1 tile tall) */
export const SOFA_SPRITE: SpriteData = (() => {
  const F = '#5566AA' // fabric
  const L = '#6677BB' // fabric light
  const D = '#445599' // fabric dark
  const A = '#3D4488' // armrest
  const B = '#333355' // shadow/base
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, _, _, _, _],
    [_, _, _, _, A, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, A, _, _, _, _],
    [_, _, _, _, A, D, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, D, A, _, _, _, _],
    [_, _, _, _, A, D, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, D, A, _, _, _, _],
    [_, _, A, A, A, D, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, D, A, A, A, _, _],
    [_, _, A, D, D, D, L, L, L, L, L, L, L, D, D, L, L, L, L, L, L, L, L, L, L, L, D, D, D, A, _, _],
    [_, _, A, D, L, L, L, L, L, L, L, L, L, D, D, L, L, L, L, L, L, L, L, L, L, L, L, L, D, A, _, _],
    [_, _, A, D, L, L, L, F, F, F, F, L, L, D, D, L, L, F, F, F, F, L, L, L, F, F, L, L, D, A, _, _],
    [_, _, A, D, L, L, L, L, L, L, L, L, L, D, D, L, L, L, L, L, L, L, L, L, L, L, L, L, D, A, _, _],
    [_, _, A, D, L, L, L, L, L, L, L, L, L, D, D, L, L, L, L, L, L, L, L, L, L, L, L, L, D, A, _, _],
    [_, _, A, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, A, _, _],
    [_, _, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, A, _, _],
    [_, _, _, B, B, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, B, B, _],
    [_, _, _, B, B, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, B, B, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Filing cabinet: 16x24 — metal 3-drawer filing cabinet */
export const FILING_CABINET_SPRITE: SpriteData = (() => {
  const F = '#999999' // frame
  const L = '#AAAAAA' // frame light
  const D = '#777777' // frame dark
  const H = '#BBBBBB' // handle highlight
  const B = '#555555' // bottom
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, D, D, D, D, D, D, D, D, _, _, _, _],
    [_, _, _, _, D, F, F, F, F, F, F, D, _, _, _, _],
    [_, _, _, _, D, F, L, L, L, L, F, D, _, _, _, _],
    [_, _, _, _, D, F, L, H, H, L, F, D, _, _, _, _],
    [_, _, _, _, D, F, L, L, L, L, F, D, _, _, _, _],
    [_, _, _, _, D, F, F, F, F, F, F, D, _, _, _, _],
    [_, _, _, _, D, D, D, D, D, D, D, D, _, _, _, _],
    [_, _, _, _, D, F, F, F, F, F, F, D, _, _, _, _],
    [_, _, _, _, D, F, L, L, L, L, F, D, _, _, _, _],
    [_, _, _, _, D, F, L, H, H, L, F, D, _, _, _, _],
    [_, _, _, _, D, F, L, L, L, L, F, D, _, _, _, _],
    [_, _, _, _, D, F, F, F, F, F, F, D, _, _, _, _],
    [_, _, _, _, D, D, D, D, D, D, D, D, _, _, _, _],
    [_, _, _, _, D, F, F, F, F, F, F, D, _, _, _, _],
    [_, _, _, _, D, F, L, L, L, L, F, D, _, _, _, _],
    [_, _, _, _, D, F, L, H, H, L, F, D, _, _, _, _],
    [_, _, _, _, D, F, L, L, L, L, F, D, _, _, _, _],
    [_, _, _, _, D, F, F, F, F, F, F, D, _, _, _, _],
    [_, _, _, _, D, D, D, D, D, D, D, D, _, _, _, _],
    [_, _, _, _, B, B, _, _, _, _, B, B, _, _, _, _],
    [_, _, _, _, B, B, _, _, _, _, B, B, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Wall clock: 16x16 — round clock face (wall item) */
export const CLOCK_SPRITE: SpriteData = (() => {
  const F = '#8B6914' // frame wood
  const W = '#EEEEFF' // clock face
  const D = '#333333' // hands/marks
  const R = '#CC4444' // second hand
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, F, F, F, F, F, F, _, _, _, _, _],
    [_, _, _, _, F, F, W, W, W, W, F, F, _, _, _, _],
    [_, _, _, F, F, W, W, D, D, W, W, F, F, _, _, _],
    [_, _, _, F, W, W, W, W, W, W, W, W, F, _, _, _],
    [_, _, F, F, W, W, W, W, W, W, W, W, F, F, _, _],
    [_, _, F, W, W, W, W, W, W, W, W, W, W, F, _, _],
    [_, _, F, W, D, W, W, D, D, W, W, W, W, F, _, _],
    [_, _, F, W, W, W, W, D, D, W, W, W, W, F, _, _],
    [_, _, F, W, W, W, W, W, R, W, W, W, W, F, _, _],
    [_, _, F, F, W, W, W, W, R, W, W, W, F, F, _, _],
    [_, _, _, F, W, W, W, W, W, W, W, W, F, _, _, _],
    [_, _, _, F, F, W, W, D, D, W, W, F, F, _, _, _],
    [_, _, _, _, F, F, W, W, W, W, F, F, _, _, _, _],
    [_, _, _, _, _, F, F, F, F, F, F, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Painting: 16x16 — framed landscape painting (wall item) */
export const PAINTING_SPRITE: SpriteData = (() => {
  const F = '#8B6914' // frame
  const D = '#6B4E0A' // frame dark
  const S = '#77BBDD' // sky
  const G = '#44AA66' // green hills
  const H = '#3D8B37' // dark green
  const Y = '#FFDD55' // sun
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, D, D, D, D, D, D, D, D, D, D, D, D, _, _],
    [_, _, D, F, F, F, F, F, F, F, F, F, F, D, _, _],
    [_, _, D, F, S, S, S, S, S, Y, Y, S, F, D, _, _],
    [_, _, D, F, S, S, S, S, Y, Y, Y, S, F, D, _, _],
    [_, _, D, F, S, S, S, S, S, Y, Y, S, F, D, _, _],
    [_, _, D, F, S, S, S, S, S, S, S, S, F, D, _, _],
    [_, _, D, F, S, S, G, G, G, G, S, S, F, D, _, _],
    [_, _, D, F, G, G, G, H, G, G, G, G, F, D, _, _],
    [_, _, D, F, G, H, G, G, G, H, G, G, F, D, _, _],
    [_, _, D, F, H, G, H, G, G, G, H, G, F, D, _, _],
    [_, _, D, F, G, H, G, G, G, G, G, H, F, D, _, _],
    [_, _, D, F, F, F, F, F, F, F, F, F, F, D, _, _],
    [_, _, D, D, D, D, D, D, D, D, D, D, D, D, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Trash can: 16x16 — cylindrical office trash bin */
export const TRASH_CAN_SPRITE: SpriteData = (() => {
  const F = '#888888' // body
  const L = '#999999' // body light
  const D = '#666666' // body dark
  const R = '#555555' // rim
  const B = '#444444' // bottom
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, R, R, R, R, R, R, _, _, _, _, _],
    [_, _, _, _, R, R, R, R, R, R, R, R, _, _, _, _],
    [_, _, _, _, R, D, D, D, D, D, D, R, _, _, _, _],
    [_, _, _, _, D, F, F, F, F, F, F, D, _, _, _, _],
    [_, _, _, _, D, F, L, F, F, L, F, D, _, _, _, _],
    [_, _, _, _, D, F, L, F, F, L, F, D, _, _, _, _],
    [_, _, _, _, D, F, L, F, F, L, F, D, _, _, _, _],
    [_, _, _, _, D, F, L, F, F, L, F, D, _, _, _, _],
    [_, _, _, _, D, F, L, F, F, L, F, D, _, _, _, _],
    [_, _, _, _, D, F, F, F, F, F, F, D, _, _, _, _],
    [_, _, _, _, D, F, F, F, F, F, F, D, _, _, _, _],
    [_, _, _, _, _, D, D, B, B, D, D, _, _, _, _, _],
    [_, _, _, _, _, _, B, B, B, B, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Fridge: 16x32 — tall office refrigerator (1 tile wide, 2 tiles tall) */
export const FRIDGE_SPRITE: SpriteData = (() => {
  const F = '#CCCCCC' // body
  const L = '#DDDDDD' // body light
  const D = '#AAAAAA' // body dark
  const H = '#888888' // handle
  const B = '#777777' // bottom
  const S = '#BBBBBB' // seam
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, D, D, D, D, D, D, D, D, D, D, _, _, _],
    [_, _, _, D, F, F, F, F, F, F, F, F, D, _, _, _],
    [_, _, _, D, F, L, L, L, L, L, L, F, D, _, _, _],
    [_, _, _, D, F, L, L, L, L, L, L, F, D, _, _, _],
    [_, _, _, D, F, L, L, L, L, L, L, F, D, _, _, _],
    [_, _, _, D, F, L, L, L, L, L, L, F, D, _, _, _],
    [_, _, _, D, F, L, L, L, L, L, L, F, D, _, _, _],
    [_, _, _, D, F, F, F, F, F, F, H, F, D, _, _, _],
    [_, _, _, D, F, F, F, F, F, F, H, F, D, _, _, _],
    [_, _, _, D, S, S, S, S, S, S, S, S, D, _, _, _],
    [_, _, _, D, S, S, S, S, S, S, S, S, D, _, _, _],
    [_, _, _, D, F, F, F, F, F, F, F, F, D, _, _, _],
    [_, _, _, D, F, L, L, L, L, L, L, F, D, _, _, _],
    [_, _, _, D, F, L, L, L, L, L, L, F, D, _, _, _],
    [_, _, _, D, F, L, L, L, L, L, L, F, D, _, _, _],
    [_, _, _, D, F, L, L, L, L, L, L, F, D, _, _, _],
    [_, _, _, D, F, L, L, L, L, L, L, F, D, _, _, _],
    [_, _, _, D, F, L, L, L, L, L, L, F, D, _, _, _],
    [_, _, _, D, F, L, L, L, L, L, L, F, D, _, _, _],
    [_, _, _, D, F, L, L, L, L, L, L, F, D, _, _, _],
    [_, _, _, D, F, L, L, L, L, L, L, F, D, _, _, _],
    [_, _, _, D, F, L, L, L, L, L, L, F, D, _, _, _],
    [_, _, _, D, F, F, F, F, F, F, H, F, D, _, _, _],
    [_, _, _, D, F, F, F, F, F, F, H, F, D, _, _, _],
    [_, _, _, D, F, F, F, F, F, F, F, F, D, _, _, _],
    [_, _, _, D, D, D, D, D, D, D, D, D, D, _, _, _],
    [_, _, _, B, B, _, _, _, _, _, _, B, B, _, _, _],
    [_, _, _, B, B, _, _, _, _, _, _, B, B, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Vending machine: 16x32 — snack/drink vending machine (1 tile wide, 2 tiles tall) */
export const VENDING_MACHINE_SPRITE: SpriteData = (() => {
  const F = '#CC4444' // body red
  const D = '#AA3333' // body dark
  const B = '#882222' // body darker
  const W = '#CCDDEE' // window glass
  const L = '#AABBCC' // glass dark
  const M = '#888888' // metal
  const G = '#666666' // metal dark
  const Y = '#FFDD55' // light/coin
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, B, B, B, B, B, B, B, B, B, B, _, _, _],
    [_, _, _, B, D, D, D, D, D, D, D, D, B, _, _, _],
    [_, _, _, B, D, F, F, F, F, F, F, D, B, _, _, _],
    [_, _, _, B, D, W, W, W, W, W, W, D, B, _, _, _],
    [_, _, _, B, D, W, L, W, W, L, W, D, B, _, _, _],
    [_, _, _, B, D, W, L, W, W, L, W, D, B, _, _, _],
    [_, _, _, B, D, W, L, W, W, L, W, D, B, _, _, _],
    [_, _, _, B, D, W, W, W, W, W, W, D, B, _, _, _],
    [_, _, _, B, D, W, L, W, W, L, W, D, B, _, _, _],
    [_, _, _, B, D, W, L, W, W, L, W, D, B, _, _, _],
    [_, _, _, B, D, W, L, W, W, L, W, D, B, _, _, _],
    [_, _, _, B, D, W, W, W, W, W, W, D, B, _, _, _],
    [_, _, _, B, D, D, D, D, D, D, D, D, B, _, _, _],
    [_, _, _, B, D, F, F, F, Y, F, F, D, B, _, _, _],
    [_, _, _, B, D, F, F, F, F, F, F, D, B, _, _, _],
    [_, _, _, B, D, F, F, M, M, F, F, D, B, _, _, _],
    [_, _, _, B, D, F, F, M, M, F, F, D, B, _, _, _],
    [_, _, _, B, D, F, F, F, F, F, F, D, B, _, _, _],
    [_, _, _, B, D, D, D, D, D, D, D, D, B, _, _, _],
    [_, _, _, B, D, M, M, M, M, M, M, D, B, _, _, _],
    [_, _, _, B, D, M, G, G, G, G, M, D, B, _, _, _],
    [_, _, _, B, D, M, G, G, G, G, M, D, B, _, _, _],
    [_, _, _, B, D, M, M, M, M, M, M, D, B, _, _, _],
    [_, _, _, B, D, D, D, D, D, D, D, D, B, _, _, _],
    [_, _, _, B, D, F, F, F, F, F, F, D, B, _, _, _],
    [_, _, _, B, B, B, B, B, B, B, B, B, B, _, _, _],
    [_, _, _, G, G, _, _, _, _, _, _, G, G, _, _, _],
    [_, _, _, G, G, _, _, _, _, _, _, G, G, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Server rack: 16x32 — server rack with LEDs (1 tile wide, 2 tiles tall) */
export const SERVER_RACK_SPRITE: SpriteData = (() => {
  const F = '#444444' // frame
  const M = '#555555' // panel
  const D = '#333333' // dark
  const L = '#666666' // panel light
  const G = '#44BB66' // green LED
  const R = '#CC4444' // red LED
  const B = '#AAAAAA' // vent
  const V = '#888888' // vent dark
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, D, D, D, D, D, D, D, D, D, D, _, _, _],
    [_, _, _, D, F, F, F, F, F, F, F, F, D, _, _, _],
    [_, _, _, D, F, M, M, M, M, M, M, F, D, _, _, _],
    [_, _, _, D, F, M, G, M, M, G, M, F, D, _, _, _],
    [_, _, _, D, F, M, M, M, M, M, M, F, D, _, _, _],
    [_, _, _, D, F, B, V, B, V, B, V, F, D, _, _, _],
    [_, _, _, D, F, F, F, F, F, F, F, F, D, _, _, _],
    [_, _, _, D, F, M, M, M, M, M, M, F, D, _, _, _],
    [_, _, _, D, F, M, G, M, M, R, M, F, D, _, _, _],
    [_, _, _, D, F, M, M, M, M, M, M, F, D, _, _, _],
    [_, _, _, D, F, B, V, B, V, B, V, F, D, _, _, _],
    [_, _, _, D, F, F, F, F, F, F, F, F, D, _, _, _],
    [_, _, _, D, F, M, M, M, M, M, M, F, D, _, _, _],
    [_, _, _, D, F, M, G, M, M, G, M, F, D, _, _, _],
    [_, _, _, D, F, M, M, M, M, M, M, F, D, _, _, _],
    [_, _, _, D, F, B, V, B, V, B, V, F, D, _, _, _],
    [_, _, _, D, F, F, F, F, F, F, F, F, D, _, _, _],
    [_, _, _, D, F, M, M, M, M, M, M, F, D, _, _, _],
    [_, _, _, D, F, M, R, M, M, G, M, F, D, _, _, _],
    [_, _, _, D, F, M, M, M, M, M, M, F, D, _, _, _],
    [_, _, _, D, F, B, V, B, V, B, V, F, D, _, _, _],
    [_, _, _, D, F, F, F, F, F, F, F, F, D, _, _, _],
    [_, _, _, D, F, L, L, L, L, L, L, F, D, _, _, _],
    [_, _, _, D, F, L, L, L, L, L, L, F, D, _, _, _],
    [_, _, _, D, F, L, L, L, L, L, L, F, D, _, _, _],
    [_, _, _, D, D, D, D, D, D, D, D, D, D, _, _, _],
    [_, _, _, D, D, _, _, _, _, _, _, D, D, _, _, _],
    [_, _, _, D, D, _, _, _, _, _, _, D, D, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Window: 32x16 — office window with sky view (wall item, 2 tiles wide) */
export const WINDOW_SPRITE: SpriteData = (() => {
  const F = '#AAAAAA' // frame
  const D = '#888888' // frame dark
  const S = '#88CCEE' // sky
  const L = '#AADDFF' // sky light
  const C = '#FFFFFF' // cloud
  const W = '#BBBBBB' // windowsill
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, _, _],
    [_, _, D, F, F, F, F, F, F, F, F, F, F, F, D, D, F, F, F, F, F, F, F, F, F, F, F, F, F, D, _, _],
    [_, _, D, F, S, S, L, L, S, S, S, S, S, F, D, D, F, S, S, S, S, S, L, L, S, S, S, F, F, D, _, _],
    [_, _, D, F, S, S, S, S, S, C, C, S, S, F, D, D, F, S, S, C, C, C, S, S, S, S, S, F, F, D, _, _],
    [_, _, D, F, S, S, S, S, S, C, C, C, S, F, D, D, F, S, S, S, C, C, S, S, S, S, S, F, F, D, _, _],
    [_, _, D, F, S, S, S, S, S, S, S, S, S, F, D, D, F, S, S, S, S, S, S, S, S, S, S, F, F, D, _, _],
    [_, _, D, F, L, S, S, S, S, S, S, L, S, F, D, D, F, S, L, S, S, S, S, S, S, L, S, F, F, D, _, _],
    [_, _, D, F, S, S, S, S, S, S, S, S, S, F, D, D, F, S, S, S, S, S, S, S, S, S, S, F, F, D, _, _],
    [_, _, D, F, S, S, S, S, S, S, S, S, S, F, D, D, F, S, S, S, S, S, S, S, S, S, S, F, F, D, _, _],
    [_, _, D, F, S, S, S, S, S, S, S, S, S, F, D, D, F, S, S, S, S, S, S, S, S, S, S, F, F, D, _, _],
    [_, _, D, F, F, F, F, F, F, F, F, F, F, F, D, D, F, F, F, F, F, F, F, F, F, F, F, F, F, D, _, _],
    [_, _, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, _, _],
    [_, _, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

// ── Additional Furniture Sprites ──────────────────────────────────

/** Meeting table: 32x32 (2x2 tiles) — large oval conference table, wood tones */
export const MEETING_TABLE_SPRITE: SpriteData = (() => {
  const W = '#8B6914' // wood edge
  const L = '#A07828' // lighter wood
  const S = '#B8922E' // surface
  const D = '#6B4E0A' // dark edge
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, W, W, W, L, L, L, L, L, L, L, L, L, L, L, L, L, L, W, W, W, _, _, _, _, _, _],
    [_, _, _, _, _, W, W, L, L, S, S, S, S, S, S, S, S, S, S, S, S, S, S, L, L, W, W, _, _, _, _, _],
    [_, _, _, _, W, W, L, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, L, W, W, _, _, _, _],
    [_, _, _, _, W, L, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, L, W, _, _, _, _],
    [_, _, _, W, W, L, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, L, W, W, _, _, _],
    [_, _, _, W, L, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, L, W, _, _, _],
    [_, _, _, W, L, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, L, W, _, _, _],
    [_, _, _, W, L, S, S, S, S, S, S, S, S, S, L, L, S, S, S, S, S, S, S, S, S, S, S, L, W, _, _, _],
    [_, _, _, W, L, S, S, S, S, S, S, S, S, S, L, L, S, S, S, S, S, S, S, S, S, S, S, L, W, _, _, _],
    [_, _, _, W, L, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, L, W, _, _, _],
    [_, _, _, W, L, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, L, W, _, _, _],
    [_, _, _, W, W, L, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, L, W, W, _, _, _],
    [_, _, _, _, W, L, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, L, W, _, _, _, _],
    [_, _, _, _, W, W, L, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, L, W, W, _, _, _, _],
    [_, _, _, _, _, W, W, L, L, S, S, S, S, S, S, S, S, S, S, S, S, S, S, L, L, W, W, _, _, _, _, _],
    [_, _, _, _, _, _, W, W, W, L, L, L, L, L, L, L, L, L, L, L, L, L, L, W, W, W, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _, _, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _, _, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _, _, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _, _, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _, _, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _, _, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _, _, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _, _, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Coffee table: 32x16 (2x1 tiles) — low rectangular table, lighter wood */
export const COFFEE_TABLE_SPRITE: SpriteData = (() => {
  const W = '#A07828' // wood edge
  const S = '#C8A848' // surface light
  const L = '#B8922E' // surface mid
  const D = '#8B6914' // dark edge
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, _, _, _, _],
    [_, _, _, _, D, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, D, _, _, _, _],
    [_, _, _, _, D, W, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, W, D, _, _, _, _],
    [_, _, _, _, D, W, S, S, L, L, L, L, L, L, L, L, L, L, L, L, L, L, L, L, S, S, W, D, _, _, _, _],
    [_, _, _, _, D, W, S, S, L, L, L, L, L, L, L, L, L, L, L, L, L, L, L, L, S, S, W, D, _, _, _, _],
    [_, _, _, _, D, W, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, W, D, _, _, _, _],
    [_, _, _, _, D, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, D, _, _, _, _],
    [_, _, _, _, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, _, _, _, _],
    [_, _, _, _, _, D, D, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, D, D, _, _, _, _],
    [_, _, _, _, _, D, D, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, D, D, _, _, _, _],
    [_, _, _, _, _, D, D, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, D, D, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Armchair: 16x16 — single cushioned lounge chair, warm red/burgundy fabric */
export const ARMCHAIR_SPRITE: SpriteData = (() => {
  const F = '#AA3333' // fabric dark
  const L = '#CC4444' // fabric mid
  const H = '#DD5555' // fabric highlight
  const A = '#882222' // armrest dark
  const B = '#553333' // base/shadow
  return [
    [_, _, _, _, _, F, F, F, F, F, F, _, _, _, _, _],
    [_, _, _, _, F, A, A, A, A, A, A, F, _, _, _, _],
    [_, _, _, _, F, A, F, F, F, F, A, F, _, _, _, _],
    [_, _, _, _, F, A, F, F, F, F, A, F, _, _, _, _],
    [_, _, _, _, F, A, F, F, F, F, A, F, _, _, _, _],
    [_, _, A, A, F, A, L, L, L, L, A, F, A, A, _, _],
    [_, _, A, F, F, L, L, H, H, L, L, F, F, A, _, _],
    [_, _, A, F, L, L, H, H, H, H, L, L, F, A, _, _],
    [_, _, A, F, L, L, H, H, H, H, L, L, F, A, _, _],
    [_, _, A, F, L, L, L, L, L, L, L, L, F, A, _, _],
    [_, _, A, F, F, L, L, L, L, L, L, F, F, A, _, _],
    [_, _, A, A, F, F, F, F, F, F, F, F, A, A, _, _],
    [_, _, _, A, A, A, A, A, A, A, A, A, A, _, _, _],
    [_, _, _, B, B, _, _, _, _, _, _, B, B, _, _, _],
    [_, _, _, B, B, _, _, _, _, _, _, B, B, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Large screen: 32x16 (2x1 tiles) — wall-mounted TV/monitor, thin bezel */
export const LARGE_SCREEN_SPRITE: SpriteData = (() => {
  const F = '#333333' // frame/bezel
  const S = '#2A2A44' // screen dark
  const B = '#4488CC' // screen blue
  const L = '#66AADD' // screen highlight
  const D = '#222222' // outer edge
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, _, _],
    [_, _, D, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, D, _, _],
    [_, _, D, F, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, F, D, _, _],
    [_, _, D, F, S, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, S, F, D, _, _],
    [_, _, D, F, S, B, L, L, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, L, L, B, B, S, F, D, _, _],
    [_, _, D, F, S, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, S, F, D, _, _],
    [_, _, D, F, S, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, S, F, D, _, _],
    [_, _, D, F, S, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, S, F, D, _, _],
    [_, _, D, F, S, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, S, F, D, _, _],
    [_, _, D, F, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, F, D, _, _],
    [_, _, D, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, D, _, _],
    [_, _, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Bulletin board: 32x16 (2x1 tiles) — cork board with pinned notes */
export const BULLETIN_BOARD_SPRITE: SpriteData = (() => {
  const F = '#8B6914' // wood frame
  const C = '#C4A05A' // cork
  const K = '#B08840' // cork dark
  const W = '#EEEEFF' // white note
  const Y = '#FFEE88' // yellow note
  const P = '#FF8899' // pink note
  const G = '#88DDAA' // green note
  const R = '#CC4444' // pin
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, _, _],
    [_, _, F, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, F, _, _],
    [_, _, F, C, C, R, C, C, C, C, C, C, R, C, C, C, C, C, R, C, C, C, C, C, C, R, C, C, C, F, _, _],
    [_, _, F, C, W, W, W, W, C, C, C, Y, Y, Y, Y, C, C, P, P, P, P, C, C, C, G, G, G, C, C, F, _, _],
    [_, _, F, C, W, W, W, W, C, K, C, Y, Y, Y, Y, C, C, P, P, P, P, C, K, C, G, G, G, C, C, F, _, _],
    [_, _, F, C, W, W, W, W, C, C, C, Y, Y, Y, Y, C, C, P, P, P, P, C, C, C, G, G, G, C, C, F, _, _],
    [_, _, F, C, W, W, W, W, C, C, C, Y, Y, Y, Y, C, C, P, P, P, P, C, C, C, G, G, G, C, C, F, _, _],
    [_, _, F, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, C, F, _, _],
    [_, _, F, C, C, C, C, R, C, C, C, C, C, C, R, C, C, C, C, C, C, C, R, C, C, C, C, C, C, F, _, _],
    [_, _, F, C, C, C, Y, Y, Y, Y, C, C, C, W, W, W, W, C, K, C, C, G, G, G, G, C, C, C, C, F, _, _],
    [_, _, F, C, K, C, Y, Y, Y, Y, C, C, C, W, W, W, W, C, C, C, C, G, G, G, G, C, K, C, C, F, _, _],
    [_, _, F, C, C, C, Y, Y, Y, Y, C, C, C, W, W, W, W, C, C, C, C, G, G, G, G, C, C, C, C, F, _, _],
    [_, _, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** AC unit: 16x16 — wall air conditioner, white/gray */
export const AC_UNIT_SPRITE: SpriteData = (() => {
  const F = '#DDDDDD' // body light
  const M = '#CCCCCC' // body mid
  const D = '#AAAAAA' // body dark
  const B = '#888888' // border/vent
  const V = '#999999' // vent lines
  const G = '#44BB66' // status LED
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, B, B, B, B, B, B, B, B, B, B, _, _, _],
    [_, _, _, B, F, F, F, F, F, F, F, F, B, _, _, _],
    [_, _, _, B, F, F, F, F, F, F, F, F, B, _, _, _],
    [_, _, _, B, F, M, M, M, M, M, M, F, B, _, _, _],
    [_, _, _, B, F, M, M, M, M, M, M, F, B, _, _, _],
    [_, _, _, B, D, D, D, D, D, D, D, D, B, _, _, _],
    [_, _, _, B, V, B, V, B, V, B, V, B, B, _, _, _],
    [_, _, _, B, V, B, V, B, V, B, V, B, B, _, _, _],
    [_, _, _, B, V, B, V, B, V, B, V, B, B, _, _, _],
    [_, _, _, B, D, D, D, D, D, D, D, G, B, _, _, _],
    [_, _, _, B, B, B, B, B, B, B, B, B, B, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Fire extinguisher: 16x16 — red fire extinguisher on wall mount */
export const FIRE_EXTINGUISHER_SPRITE: SpriteData = (() => {
  const R = '#CC4444' // body red
  const D = '#AA3333' // body dark
  const B = '#882222' // body darkest
  const M = '#888888' // metal
  const L = '#AAAAAA' // metal light
  const K = '#333333' // nozzle/handle
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, M, M, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, M, L, L, M, _, _, _, _, _, _],
    [_, _, _, _, _, _, M, M, M, M, _, _, _, _, _, _],
    [_, _, _, _, _, _, K, K, K, K, K, _, _, _, _, _],
    [_, _, _, _, _, _, K, M, M, K, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, M, M, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, B, R, R, B, _, _, _, _, _, _],
    [_, _, _, _, _, B, R, R, R, R, B, _, _, _, _, _],
    [_, _, _, _, _, B, R, D, D, R, B, _, _, _, _, _],
    [_, _, _, _, _, B, R, D, D, R, B, _, _, _, _, _],
    [_, _, _, _, _, B, R, D, D, R, B, _, _, _, _, _],
    [_, _, _, _, _, B, R, R, R, R, B, _, _, _, _, _],
    [_, _, _, _, _, _, B, B, B, B, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Exit sign: 16x16 — green "EXIT" illuminated sign */
export const EXIT_SIGN_SPRITE: SpriteData = (() => {
  const F = '#333333' // frame
  const G = '#44AA66' // green background
  const L = '#66DD88' // green light
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, F, F, F, F, F, F, F, F, F, F, _, _, _],
    [_, _, _, F, G, G, G, G, G, G, G, G, F, _, _, _],
    [_, _, _, F, G, L, G, L, L, G, L, G, F, _, _, _],
    [_, _, _, F, G, L, G, G, L, G, L, G, F, _, _, _],
    [_, _, _, F, G, L, L, G, L, G, L, G, F, _, _, _],
    [_, _, _, F, G, L, G, G, L, G, L, G, F, _, _, _],
    [_, _, _, F, G, L, G, L, L, G, L, G, F, _, _, _],
    [_, _, _, F, G, G, G, G, G, G, G, G, F, _, _, _],
    [_, _, _, F, F, F, F, F, F, F, F, F, F, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Desk phone: 16x16 — desk telephone, dark gray/black (surface item) */
export const PHONE_SPRITE: SpriteData = (() => {
  const F = '#444444' // body
  const D = '#333333' // body dark
  const B = '#222222' // darkest
  const L = '#666666' // lighter
  const K = '#555555' // keys
  const G = '#44BB66' // LED
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, B, B, B, B, B, B, B, _, _, _, _],
    [_, _, _, _, B, D, D, D, D, D, D, D, B, _, _, _],
    [_, _, _, _, B, D, F, F, F, F, F, D, B, _, _, _],
    [_, _, _, _, B, D, F, K, F, K, F, D, B, _, _, _],
    [_, _, _, _, B, D, F, F, F, F, F, D, B, _, _, _],
    [_, _, _, _, B, D, F, K, F, K, F, D, B, _, _, _],
    [_, _, _, _, B, D, F, F, F, F, F, D, B, _, _, _],
    [_, _, _, _, B, D, F, K, F, K, F, D, B, _, _, _],
    [_, _, _, B, B, D, D, D, D, D, D, D, B, _, _, _],
    [_, _, _, B, L, L, L, L, G, L, L, L, B, _, _, _],
    [_, _, _, B, B, B, B, B, B, B, B, B, B, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Coffee mug: 16x16 — white/cream mug with steam (surface item) */
export const COFFEE_MUG_SPRITE: SpriteData = (() => {
  const W = '#EEEEEE' // mug white
  const M = '#DDDDDD' // mug mid
  const D = '#BBBBBB' // mug dark
  const C = '#8B6914' // coffee color
  const S = '#CCCCCC' // steam
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, S, _, _, S, _, _, _, _, _],
    [_, _, _, _, _, _, S, _, _, S, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, S, _, _, S, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, D, D, D, D, D, _, _, _, _, _],
    [_, _, _, _, _, _, D, C, C, C, D, _, _, _, _, _],
    [_, _, _, _, _, _, D, W, W, W, D, D, D, _, _, _],
    [_, _, _, _, _, _, D, W, W, W, D, _, D, _, _, _],
    [_, _, _, _, _, _, D, W, M, W, D, D, D, _, _, _],
    [_, _, _, _, _, _, D, W, M, W, D, _, _, _, _, _],
    [_, _, _, _, _, _, D, M, M, M, D, _, _, _, _, _],
    [_, _, _, _, _, _, _, D, D, D, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Paper stack: 16x16 — stack of white papers (surface item) */
export const PAPER_STACK_SPRITE: SpriteData = (() => {
  const W = '#EEEEEE' // paper white
  const P = '#DDDDDD' // paper edge
  const D = '#BBBBBB' // shadow
  const L = '#CCCCCC' // lines (text)
  const B = '#AAAAAA' // bottom edge
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, D, P, P, P, P, P, P, _, _, _, _],
    [_, _, _, _, _, D, P, P, P, P, P, P, _, _, _, _],
    [_, _, _, _, D, W, W, W, W, W, W, W, D, _, _, _],
    [_, _, _, _, D, W, L, L, L, L, L, W, D, _, _, _],
    [_, _, _, _, D, W, W, W, W, W, W, W, D, _, _, _],
    [_, _, _, _, D, W, L, L, L, L, W, W, D, _, _, _],
    [_, _, _, _, D, W, W, W, W, W, W, W, D, _, _, _],
    [_, _, _, _, D, W, L, L, L, W, W, W, D, _, _, _],
    [_, _, _, _, B, B, B, B, B, B, B, B, B, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Microwave: 16x16 — small microwave oven, white/silver */
export const MICROWAVE_SPRITE: SpriteData = (() => {
  const F = '#CCCCCC' // body
  const L = '#DDDDDD' // body light
  const D = '#AAAAAA' // body dark
  const B = '#888888' // border
  const G = '#444444' // glass door
  const M = '#555555' // glass dark
  const K = '#999999' // buttons
  const E = '#44BB66' // LED
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, B, B, B, B, B, B, B, B, B, B, _, _, _],
    [_, _, _, B, D, D, D, D, D, D, D, D, B, _, _, _],
    [_, _, _, B, D, G, G, G, G, G, D, L, B, _, _, _],
    [_, _, _, B, D, G, M, M, M, G, D, K, B, _, _, _],
    [_, _, _, B, D, G, M, M, M, G, D, K, B, _, _, _],
    [_, _, _, B, D, G, M, M, M, G, D, K, B, _, _, _],
    [_, _, _, B, D, G, M, M, M, G, D, L, B, _, _, _],
    [_, _, _, B, D, G, G, G, G, G, D, E, B, _, _, _],
    [_, _, _, B, D, D, D, D, D, D, D, D, B, _, _, _],
    [_, _, _, B, F, F, F, F, F, F, F, F, B, _, _, _],
    [_, _, _, B, B, B, B, B, B, B, B, B, B, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Sink: 16x16 — kitchen sink, silver/gray */
export const SINK_SPRITE: SpriteData = (() => {
  const F = '#BBBBBB' // body
  const L = '#CCCCCC' // body light
  const D = '#999999' // body dark
  const B = '#777777' // border
  const W = '#DDDDEE' // basin
  const M = '#888888' // metal
  const H = '#AAAAAA' // faucet
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, H, H, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, H, H, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, H, H, H, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, M, M, _, _, _, _, _, _],
    [_, _, _, B, B, B, B, B, B, B, B, B, B, _, _, _],
    [_, _, _, B, D, D, D, D, D, D, D, D, B, _, _, _],
    [_, _, _, B, D, W, W, W, W, W, W, D, B, _, _, _],
    [_, _, _, B, D, W, W, W, W, W, W, D, B, _, _, _],
    [_, _, _, B, D, W, W, W, W, W, W, D, B, _, _, _],
    [_, _, _, B, D, W, W, W, W, W, W, D, B, _, _, _],
    [_, _, _, B, D, D, D, D, D, D, D, D, B, _, _, _],
    [_, _, _, B, F, F, F, F, F, F, F, F, B, _, _, _],
    [_, _, _, B, F, L, L, L, L, L, L, F, B, _, _, _],
    [_, _, _, B, B, B, B, B, B, B, B, B, B, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Locker: 16x32 (1x2 tiles) — tall metal locker, gray/blue */
export const LOCKER_SPRITE: SpriteData = (() => {
  const F = '#7788AA' // body blue-gray
  const L = '#8899BB' // body light
  const D = '#667799' // body dark
  const B = '#556688' // border
  const H = '#BBBBBB' // handle
  const V = '#445577' // vent
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, B, B, B, B, B, B, B, B, B, B, _, _, _],
    [_, _, _, B, D, D, D, D, D, D, D, D, B, _, _, _],
    [_, _, _, B, D, F, F, F, F, F, F, D, B, _, _, _],
    [_, _, _, B, D, F, V, V, V, V, F, D, B, _, _, _],
    [_, _, _, B, D, F, V, V, V, V, F, D, B, _, _, _],
    [_, _, _, B, D, F, V, V, V, V, F, D, B, _, _, _],
    [_, _, _, B, D, F, F, F, F, F, F, D, B, _, _, _],
    [_, _, _, B, D, F, L, L, L, L, F, D, B, _, _, _],
    [_, _, _, B, D, F, L, L, L, L, F, D, B, _, _, _],
    [_, _, _, B, D, F, L, L, L, L, F, D, B, _, _, _],
    [_, _, _, B, D, F, L, H, H, L, F, D, B, _, _, _],
    [_, _, _, B, D, F, L, H, H, L, F, D, B, _, _, _],
    [_, _, _, B, D, F, L, L, L, L, F, D, B, _, _, _],
    [_, _, _, B, D, F, L, L, L, L, F, D, B, _, _, _],
    [_, _, _, B, D, F, L, L, L, L, F, D, B, _, _, _],
    [_, _, _, B, D, F, L, L, L, L, F, D, B, _, _, _],
    [_, _, _, B, D, F, L, L, L, L, F, D, B, _, _, _],
    [_, _, _, B, D, F, L, L, L, L, F, D, B, _, _, _],
    [_, _, _, B, D, F, L, L, L, L, F, D, B, _, _, _],
    [_, _, _, B, D, F, L, L, L, L, F, D, B, _, _, _],
    [_, _, _, B, D, F, L, L, L, L, F, D, B, _, _, _],
    [_, _, _, B, D, F, L, L, L, L, F, D, B, _, _, _],
    [_, _, _, B, D, F, L, L, L, L, F, D, B, _, _, _],
    [_, _, _, B, D, F, L, L, L, L, F, D, B, _, _, _],
    [_, _, _, B, D, F, F, F, F, F, F, D, B, _, _, _],
    [_, _, _, B, D, D, D, D, D, D, D, D, B, _, _, _],
    [_, _, _, B, B, B, B, B, B, B, B, B, B, _, _, _],
    [_, _, _, B, B, _, _, _, _, _, _, B, B, _, _, _],
    [_, _, _, B, B, _, _, _, _, _, _, B, B, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Coat rack: 16x24 — wooden coat rack/stand with hooks */
export const COAT_RACK_SPRITE: SpriteData = (() => {
  const W = '#8B6914' // wood
  const D = '#6B4E0A' // wood dark
  const L = '#A07828' // wood light
  const H = '#888888' // hook metal
  const C = '#445599' // coat fabric
  const B = '#334488' // coat dark
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, W, W, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, W, L, L, W, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, W, W, _, _, _, _, _, _, _],
    [_, _, _, _, _, H, H, W, W, H, H, _, _, _, _, _],
    [_, _, _, _, H, _, C, W, W, B, _, H, _, _, _, _],
    [_, _, _, _, _, C, C, W, W, B, B, _, _, _, _, _],
    [_, _, _, _, _, C, C, W, W, B, B, _, _, _, _, _],
    [_, _, _, _, _, _, C, W, W, B, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, W, W, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, W, W, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, W, W, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, W, W, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, W, W, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, W, W, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, W, W, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, W, W, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, W, W, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, D, D, D, D, _, _, _, _, _, _],
    [_, _, _, _, _, D, D, D, D, D, D, _, _, _, _, _],
    [_, _, _, _, D, D, D, D, D, D, D, D, _, _, _, _],
    [_, _, _, _, D, D, _, _, _, _, D, D, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Potted cactus: 16x16 — small cactus in terra cotta pot */
export const POTTED_CACTUS_SPRITE: SpriteData = (() => {
  const G = '#44AA66' // cactus green
  const D = '#338855' // cactus dark
  const L = '#66CC88' // cactus light/spine
  const P = '#B85C3A' // pot terra cotta
  const R = '#8B4422' // pot dark
  const Y = '#FFDD55' // flower
  return [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, Y, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, G, G, G, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, G, D, G, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, G, L, G, _, G, G, _, _, _, _],
    [_, _, _, _, _, _, G, D, G, _, G, D, G, _, _, _],
    [_, _, _, _, G, G, G, L, G, _, G, L, G, _, _, _],
    [_, _, _, _, G, D, G, D, G, G, G, D, G, _, _, _],
    [_, _, _, _, G, L, G, L, G, D, G, G, _, _, _, _],
    [_, _, _, _, _, G, G, D, G, G, G, _, _, _, _, _],
    [_, _, _, _, _, _, G, G, G, _, _, _, _, _, _, _],
    [_, _, _, _, _, R, R, R, R, R, R, _, _, _, _, _],
    [_, _, _, _, _, R, P, P, P, P, R, _, _, _, _, _],
    [_, _, _, _, _, R, P, P, P, P, R, _, _, _, _, _],
    [_, _, _, _, _, _, R, R, R, R, _, _, _, _, _, _],
  ]
})()

// ── Speech Bubble Sprites ───────────────────────────────────────

/** Permission bubble: white square with "..." in amber, and a tail pointer (11x13) */
export const BUBBLE_PERMISSION_SPRITE: SpriteData = (() => {
  const B = '#555566' // border
  const F = '#EEEEFF' // fill
  const A = '#CCA700' // amber dots
  return [
    [B, B, B, B, B, B, B, B, B, B, B],
    [B, F, F, F, F, F, F, F, F, F, B],
    [B, F, F, F, F, F, F, F, F, F, B],
    [B, F, F, F, F, F, F, F, F, F, B],
    [B, F, F, F, F, F, F, F, F, F, B],
    [B, F, F, A, F, A, F, A, F, F, B],
    [B, F, F, F, F, F, F, F, F, F, B],
    [B, F, F, F, F, F, F, F, F, F, B],
    [B, F, F, F, F, F, F, F, F, F, B],
    [B, B, B, B, B, B, B, B, B, B, B],
    [_, _, _, _, B, B, B, _, _, _, _],
    [_, _, _, _, _, B, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Waiting bubble: white square with green checkmark, and a tail pointer (11x13) */
export const BUBBLE_WAITING_SPRITE: SpriteData = (() => {
  const B = '#555566' // border
  const F = '#EEEEFF' // fill
  const G = '#44BB66' // green check
  return [
    [_, B, B, B, B, B, B, B, B, B, _],
    [B, F, F, F, F, F, F, F, F, F, B],
    [B, F, F, F, F, F, F, F, F, F, B],
    [B, F, F, F, F, F, F, F, G, F, B],
    [B, F, F, F, F, F, F, G, F, F, B],
    [B, F, F, G, F, F, G, F, F, F, B],
    [B, F, F, F, G, G, F, F, F, F, B],
    [B, F, F, F, F, F, F, F, F, F, B],
    [B, F, F, F, F, F, F, F, F, F, B],
    [_, B, B, B, B, B, B, B, B, B, _],
    [_, _, _, _, B, B, B, _, _, _, _],
    [_, _, _, _, _, B, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _],
  ]
})()

/** Detached bubble: white square with gray X, and a tail pointer (11x13) */
export const BUBBLE_DETACHED_SPRITE: SpriteData = (() => {
  const B = '#555566' // border
  const F = '#EEEEFF' // fill
  const X = '#888888' // gray X
  return [
    [_, B, B, B, B, B, B, B, B, B, _],
    [B, F, F, F, F, F, F, F, F, F, B],
    [B, F, F, F, F, F, F, F, F, F, B],
    [B, F, F, X, F, F, F, X, F, F, B],
    [B, F, F, F, X, F, X, F, F, F, B],
    [B, F, F, F, F, X, F, F, F, F, B],
    [B, F, F, F, X, F, X, F, F, F, B],
    [B, F, F, X, F, F, F, X, F, F, B],
    [B, F, F, F, F, F, F, F, F, F, B],
    [_, B, B, B, B, B, B, B, B, B, _],
    [_, _, _, _, B, B, B, _, _, _, _],
    [_, _, _, _, _, B, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _, _, _],
  ]
})()

// ── Character Sprites ───────────────────────────────────────────
// 16x24 characters with palette substitution

/** Palette colors for 6 distinct agent characters */
export const CHARACTER_PALETTES = [
  { skin: '#FFCC99', shirt: '#4488CC', pants: '#334466', hair: '#553322', shoes: '#222222' },
  { skin: '#FFCC99', shirt: '#CC4444', pants: '#333333', hair: '#FFD700', shoes: '#222222' },
  { skin: '#DEB887', shirt: '#44AA66', pants: '#334444', hair: '#222222', shoes: '#333333' },
  { skin: '#FFCC99', shirt: '#AA55CC', pants: '#443355', hair: '#AA4422', shoes: '#222222' },
  { skin: '#DEB887', shirt: '#CCAA33', pants: '#444433', hair: '#553322', shoes: '#333333' },
  { skin: '#FFCC99', shirt: '#FF8844', pants: '#443322', hair: '#111111', shoes: '#222222' },
] as const

interface CharPalette {
  skin: string
  shirt: string
  pants: string
  hair: string
  shoes: string
}

// Template keys for character pixel data
const H = 'hair'
const K = 'skin'
const S = 'shirt'
const P = 'pants'
const O = 'shoes'
const E = '#FFFFFF' // eyes

type TemplateCell = typeof H | typeof K | typeof S | typeof P | typeof O | typeof E | typeof _

/** Resolve a template to SpriteData using a palette */
function resolveTemplate(template: TemplateCell[][], palette: CharPalette): SpriteData {
  return template.map((row) =>
    row.map((cell) => {
      if (cell === _) return ''
      if (cell === E) return E
      if (cell === H) return palette.hair
      if (cell === K) return palette.skin
      if (cell === S) return palette.shirt
      if (cell === P) return palette.pants
      if (cell === O) return palette.shoes
      return cell
    }),
  )
}

/** Flip a template horizontally (for generating left sprites from right) */
function flipHorizontal(template: TemplateCell[][]): TemplateCell[][] {
  return template.map((row) => [...row].reverse())
}

// ════════════════════════════════════════════════════════════════
// DOWN-FACING SPRITES
// ════════════════════════════════════════════════════════════════

// Walk down: 4 frames (1, 2=standing, 3=mirror legs, 2 again)
const CHAR_WALK_DOWN_1: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, E, K, K, E, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, K, S, S, S, S, S, S, K, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, P, P, _, _, _, _, P, P, _, _, _, _],
  [_, _, _, _, P, P, _, _, _, _, P, P, _, _, _, _],
  [_, _, _, _, O, O, _, _, _, _, _, O, O, _, _, _],
  [_, _, _, _, O, O, _, _, _, _, _, O, O, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

const CHAR_WALK_DOWN_2: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, E, K, K, E, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, K, S, S, S, S, S, S, K, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

const CHAR_WALK_DOWN_3: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, E, K, K, E, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, K, S, S, S, S, S, S, K, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, O, O, _, _, _, _, _, _, P, P, _, _, _],
  [_, _, _, O, O, _, _, _, _, _, _, P, P, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, O, O, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, O, O, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

// Down typing: front-facing sitting, arms on keyboard
const CHAR_DOWN_TYPE_1: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, E, K, K, E, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, K, K, S, S, S, S, S, S, K, K, _, _, _],
  [_, _, _, _, K, S, S, S, S, S, S, K, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

const CHAR_DOWN_TYPE_2: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, E, K, K, E, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, K, S, S, S, S, S, S, K, K, _, _, _],
  [_, _, _, _, K, S, S, S, S, S, S, _, K, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

// Down reading: front-facing sitting, arms at sides, looking at screen
const CHAR_DOWN_READ_1: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, E, K, K, E, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, K, S, S, S, S, S, S, K, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

const CHAR_DOWN_READ_2: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, E, K, K, E, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, K, S, S, S, S, S, S, K, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

// ════════════════════════════════════════════════════════════════
// UP-FACING SPRITES (back of head, no face)
// ════════════════════════════════════════════════════════════════

// Walk up: back view, legs alternate
const CHAR_WALK_UP_1: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, K, S, S, S, S, S, S, K, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, P, P, _, _, _, _, P, P, _, _, _, _],
  [_, _, _, _, P, P, _, _, _, _, P, P, _, _, _, _],
  [_, _, _, O, O, _, _, _, _, _, _, O, O, _, _, _],
  [_, _, _, O, O, _, _, _, _, _, _, O, O, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

const CHAR_WALK_UP_2: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, K, S, S, S, S, S, S, K, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

const CHAR_WALK_UP_3: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, K, S, S, S, S, S, S, K, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, O, O, _, _, _, _, _, _, P, P, _, _, _],
  [_, _, _, O, O, _, _, _, _, _, _, P, P, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, O, O, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, O, O, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

// Up typing: back view, arms out to keyboard
const CHAR_UP_TYPE_1: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, K, K, S, S, S, S, S, S, K, K, _, _, _],
  [_, _, _, _, K, S, S, S, S, S, S, K, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

const CHAR_UP_TYPE_2: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, K, S, S, S, S, S, S, K, K, _, _, _],
  [_, _, _, _, K, S, S, S, S, S, S, _, K, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

// Up reading: back view, arms at sides
const CHAR_UP_READ_1: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, K, S, S, S, S, S, S, K, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

const CHAR_UP_READ_2: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, _, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, H, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _],
  [_, _, _, _, K, S, S, S, S, S, S, K, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

// ════════════════════════════════════════════════════════════════
// RIGHT-FACING SPRITES (side profile, one eye visible)
// Left sprites are generated by flipHorizontal()
// ════════════════════════════════════════════════════════════════

// Right walk: side view, legs step
const CHAR_WALK_RIGHT_1: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, E, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, K, S, S, S, S, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, P, P, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, P, P, _, _, _, P, P, _, _, _, _],
  [_, _, _, _, _, P, P, _, _, _, P, P, _, _, _, _],
  [_, _, _, _, _, O, O, _, _, _, _, O, O, _, _, _],
  [_, _, _, _, _, O, O, _, _, _, _, O, O, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

const CHAR_WALK_RIGHT_2: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, E, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, K, S, S, S, S, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, P, P, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, _, O, O, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, _, O, O, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

const CHAR_WALK_RIGHT_3: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, E, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, K, S, S, S, S, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, P, P, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, P, P, P, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, O, O, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

// Right typing: side profile sitting, one arm on keyboard
const CHAR_RIGHT_TYPE_1: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, E, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, K, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, P, P, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, _, O, O, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

const CHAR_RIGHT_TYPE_2: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, E, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, K, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, _, _, K, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, P, P, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, _, O, O, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

// Right reading: side sitting, arms at side
const CHAR_RIGHT_READ_1: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, E, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, K, S, S, S, S, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, P, P, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, _, O, O, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

const CHAR_RIGHT_READ_2: TemplateCell[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, H, H, H, H, H, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, E, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, S, S, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, K, S, S, S, S, K, _, _, _, _, _],
  [_, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, P, P, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _],
  [_, _, _, _, _, _, P, P, _, P, P, _, _, _, _, _],
  [_, _, _, _, _, _, O, O, _, O, O, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

// ════════════════════════════════════════════════════════════════
// Template export (for export-characters script)
// ════════════════════════════════════════════════════════════════

/** All character templates grouped by direction, for use by the export script.
 *  Frame order per direction: walk1, walk2, walk3, type1, type2, read1, read2 */
export const CHARACTER_TEMPLATES = {
  down: [
    CHAR_WALK_DOWN_1, CHAR_WALK_DOWN_2, CHAR_WALK_DOWN_3,
    CHAR_DOWN_TYPE_1, CHAR_DOWN_TYPE_2,
    CHAR_DOWN_READ_1, CHAR_DOWN_READ_2,
  ],
  up: [
    CHAR_WALK_UP_1, CHAR_WALK_UP_2, CHAR_WALK_UP_3,
    CHAR_UP_TYPE_1, CHAR_UP_TYPE_2,
    CHAR_UP_READ_1, CHAR_UP_READ_2,
  ],
  right: [
    CHAR_WALK_RIGHT_1, CHAR_WALK_RIGHT_2, CHAR_WALK_RIGHT_3,
    CHAR_RIGHT_TYPE_1, CHAR_RIGHT_TYPE_2,
    CHAR_RIGHT_READ_1, CHAR_RIGHT_READ_2,
  ],
} as const

// ════════════════════════════════════════════════════════════════
// Loaded character sprites (from PNG assets)
// ════════════════════════════════════════════════════════════════

interface LoadedCharacterData {
  down: SpriteData[]
  up: SpriteData[]
  right: SpriteData[]
}

let loadedCharacters: LoadedCharacterData[] | null = null

/** Set pre-colored character sprites loaded from PNG assets. Call this when characterSpritesLoaded message arrives. */
export function setCharacterTemplates(data: LoadedCharacterData[]): void {
  loadedCharacters = data
  // Clear cache so sprites are rebuilt from loaded data
  spriteCache.clear()
}

/** Flip a SpriteData horizontally (for generating left sprites from right) */
function flipSpriteHorizontal(sprite: SpriteData): SpriteData {
  return sprite.map((row) => [...row].reverse())
}

// ════════════════════════════════════════════════════════════════
// Sprite resolution + caching
// ════════════════════════════════════════════════════════════════

export interface CharacterSprites {
  walk: Record<Direction, [SpriteData, SpriteData, SpriteData, SpriteData]>
  typing: Record<Direction, [SpriteData, SpriteData]>
  reading: Record<Direction, [SpriteData, SpriteData]>
}

const spriteCache = new Map<string, CharacterSprites>()

/** Apply hue shift to every sprite in a CharacterSprites set */
function hueShiftSprites(sprites: CharacterSprites, hueShift: number): CharacterSprites {
  const color: FloorColor = { h: hueShift, s: 0, b: 0, c: 0 }
  const shift = (s: SpriteData) => adjustSprite(s, color)
  const shiftWalk = (arr: [SpriteData, SpriteData, SpriteData, SpriteData]): [SpriteData, SpriteData, SpriteData, SpriteData] =>
    [shift(arr[0]), shift(arr[1]), shift(arr[2]), shift(arr[3])]
  const shiftPair = (arr: [SpriteData, SpriteData]): [SpriteData, SpriteData] =>
    [shift(arr[0]), shift(arr[1])]
  return {
    walk: {
      [Dir.DOWN]: shiftWalk(sprites.walk[Dir.DOWN]),
      [Dir.UP]: shiftWalk(sprites.walk[Dir.UP]),
      [Dir.RIGHT]: shiftWalk(sprites.walk[Dir.RIGHT]),
      [Dir.LEFT]: shiftWalk(sprites.walk[Dir.LEFT]),
    } as Record<Direction, [SpriteData, SpriteData, SpriteData, SpriteData]>,
    typing: {
      [Dir.DOWN]: shiftPair(sprites.typing[Dir.DOWN]),
      [Dir.UP]: shiftPair(sprites.typing[Dir.UP]),
      [Dir.RIGHT]: shiftPair(sprites.typing[Dir.RIGHT]),
      [Dir.LEFT]: shiftPair(sprites.typing[Dir.LEFT]),
    } as Record<Direction, [SpriteData, SpriteData]>,
    reading: {
      [Dir.DOWN]: shiftPair(sprites.reading[Dir.DOWN]),
      [Dir.UP]: shiftPair(sprites.reading[Dir.UP]),
      [Dir.RIGHT]: shiftPair(sprites.reading[Dir.RIGHT]),
      [Dir.LEFT]: shiftPair(sprites.reading[Dir.LEFT]),
    } as Record<Direction, [SpriteData, SpriteData]>,
  }
}

export function getCharacterSprites(paletteIndex: number, hueShift = 0): CharacterSprites {
  const cacheKey = `${paletteIndex}:${hueShift}`
  const cached = spriteCache.get(cacheKey)
  if (cached) return cached

  let sprites: CharacterSprites

  if (loadedCharacters) {
    // Use pre-colored character sprites directly (no palette swapping)
    const char = loadedCharacters[paletteIndex % loadedCharacters.length]
    const d = char.down
    const u = char.up
    const rt = char.right
    const flip = flipSpriteHorizontal

    sprites = {
      walk: {
        [Dir.DOWN]: [d[0], d[1], d[2], d[1]],
        [Dir.UP]: [u[0], u[1], u[2], u[1]],
        [Dir.RIGHT]: [rt[0], rt[1], rt[2], rt[1]],
        [Dir.LEFT]: [flip(rt[0]), flip(rt[1]), flip(rt[2]), flip(rt[1])],
      },
      typing: {
        [Dir.DOWN]: [d[3], d[4]],
        [Dir.UP]: [u[3], u[4]],
        [Dir.RIGHT]: [rt[3], rt[4]],
        [Dir.LEFT]: [flip(rt[3]), flip(rt[4])],
      },
      reading: {
        [Dir.DOWN]: [d[5], d[6]],
        [Dir.UP]: [u[5], u[6]],
        [Dir.RIGHT]: [rt[5], rt[6]],
        [Dir.LEFT]: [flip(rt[5]), flip(rt[6])],
      },
    }
  } else {
    // Fallback: use hardcoded templates with palette swapping
    const pal = CHARACTER_PALETTES[paletteIndex % CHARACTER_PALETTES.length]
    const r = (t: TemplateCell[][]) => resolveTemplate(t, pal)
    const rf = (t: TemplateCell[][]) => resolveTemplate(flipHorizontal(t), pal)

    sprites = {
      walk: {
        [Dir.DOWN]: [r(CHAR_WALK_DOWN_1), r(CHAR_WALK_DOWN_2), r(CHAR_WALK_DOWN_3), r(CHAR_WALK_DOWN_2)],
        [Dir.UP]: [r(CHAR_WALK_UP_1), r(CHAR_WALK_UP_2), r(CHAR_WALK_UP_3), r(CHAR_WALK_UP_2)],
        [Dir.RIGHT]: [r(CHAR_WALK_RIGHT_1), r(CHAR_WALK_RIGHT_2), r(CHAR_WALK_RIGHT_3), r(CHAR_WALK_RIGHT_2)],
        [Dir.LEFT]: [rf(CHAR_WALK_RIGHT_1), rf(CHAR_WALK_RIGHT_2), rf(CHAR_WALK_RIGHT_3), rf(CHAR_WALK_RIGHT_2)],
      },
      typing: {
        [Dir.DOWN]: [r(CHAR_DOWN_TYPE_1), r(CHAR_DOWN_TYPE_2)],
        [Dir.UP]: [r(CHAR_UP_TYPE_1), r(CHAR_UP_TYPE_2)],
        [Dir.RIGHT]: [r(CHAR_RIGHT_TYPE_1), r(CHAR_RIGHT_TYPE_2)],
        [Dir.LEFT]: [rf(CHAR_RIGHT_TYPE_1), rf(CHAR_RIGHT_TYPE_2)],
      },
      reading: {
        [Dir.DOWN]: [r(CHAR_DOWN_READ_1), r(CHAR_DOWN_READ_2)],
        [Dir.UP]: [r(CHAR_UP_READ_1), r(CHAR_UP_READ_2)],
        [Dir.RIGHT]: [r(CHAR_RIGHT_READ_1), r(CHAR_RIGHT_READ_2)],
        [Dir.LEFT]: [rf(CHAR_RIGHT_READ_1), rf(CHAR_RIGHT_READ_2)],
      },
    }
  }

  // Apply hue shift if non-zero
  if (hueShift !== 0) {
    sprites = hueShiftSprites(sprites, hueShift)
  }

  spriteCache.set(cacheKey, sprites)
  return sprites
}
