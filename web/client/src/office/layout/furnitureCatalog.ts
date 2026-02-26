import { FurnitureType } from '../types.js'
import type { FurnitureCatalogEntry, SpriteData } from '../types.js'
import {
  DESK_SQUARE_SPRITE,
  BOOKSHELF_SPRITE,
  PLANT_SPRITE,
  COOLER_SPRITE,
  WHITEBOARD_SPRITE,
  CHAIR_SPRITE,
  PC_SPRITE,
  LAMP_SPRITE,
  LAPTOP_SPRITE,
  PRINTER_SPRITE,
  COFFEE_MACHINE_SPRITE,
  SOFA_SPRITE,
  FILING_CABINET_SPRITE,
  CLOCK_SPRITE,
  PAINTING_SPRITE,
  TRASH_CAN_SPRITE,
  FRIDGE_SPRITE,
  VENDING_MACHINE_SPRITE,
  SERVER_RACK_SPRITE,
  WINDOW_SPRITE,
  MEETING_TABLE_SPRITE,
  COFFEE_TABLE_SPRITE,
  ARMCHAIR_SPRITE,
  LARGE_SCREEN_SPRITE,
  BULLETIN_BOARD_SPRITE,
  AC_UNIT_SPRITE,
  FIRE_EXTINGUISHER_SPRITE,
  EXIT_SIGN_SPRITE,
  PHONE_SPRITE,
  COFFEE_MUG_SPRITE,
  PAPER_STACK_SPRITE,
  MICROWAVE_SPRITE,
  SINK_SPRITE,
  LOCKER_SPRITE,
  COAT_RACK_SPRITE,
  POTTED_CACTUS_SPRITE,
} from '../sprites/spriteData.js'

export interface LoadedAssetData {
  catalog: Array<{
    id: string
    label: string
    category: string
    width: number
    height: number
    footprintW: number
    footprintH: number
    isDesk: boolean
    groupId?: string
    orientation?: string  // 'front' | 'back' | 'left' | 'right'
    state?: string        // 'on' | 'off'
    canPlaceOnSurfaces?: boolean
    backgroundTiles?: number
    canPlaceOnWalls?: boolean
  }>
  sprites: Record<string, SpriteData>
}

export type FurnitureCategory = 'desks' | 'chairs' | 'storage' | 'decor' | 'electronics' | 'wall' | 'misc'

export interface CatalogEntryWithCategory extends FurnitureCatalogEntry {
  category: FurnitureCategory
}

export const FURNITURE_CATALOG: CatalogEntryWithCategory[] = [
  // ── 原始手繪精靈圖 ──
  { type: FurnitureType.DESK,       label: 'Desk',       footprintW: 2, footprintH: 2, sprite: DESK_SQUARE_SPRITE,  isDesk: true,  category: 'desks' },
  { type: FurnitureType.BOOKSHELF,  label: 'Bookshelf',  footprintW: 1, footprintH: 2, sprite: BOOKSHELF_SPRITE,    isDesk: false, category: 'storage' },
  { type: FurnitureType.PLANT,      label: 'Plant',      footprintW: 1, footprintH: 1, sprite: PLANT_SPRITE,        isDesk: false, category: 'decor' },
  { type: FurnitureType.COOLER,     label: 'Cooler',     footprintW: 1, footprintH: 1, sprite: COOLER_SPRITE,       isDesk: false, category: 'misc' },
  { type: FurnitureType.WHITEBOARD, label: 'Whiteboard', footprintW: 2, footprintH: 1, sprite: WHITEBOARD_SPRITE,   isDesk: false, category: 'decor' },
  { type: FurnitureType.CHAIR,      label: 'Chair',      footprintW: 1, footprintH: 1, sprite: CHAIR_SPRITE,        isDesk: false, category: 'chairs' },
  { type: FurnitureType.PC,         label: 'PC',         footprintW: 1, footprintH: 1, sprite: PC_SPRITE,           isDesk: false, category: 'electronics' },
  { type: FurnitureType.LAMP,       label: 'Lamp',       footprintW: 1, footprintH: 1, sprite: LAMP_SPRITE,         isDesk: false, category: 'decor' },

  // ── 新家具精靈圖 ──
  { type: FurnitureType.LAPTOP,          label: '筆電',     footprintW: 1, footprintH: 1, sprite: LAPTOP_SPRITE,          isDesk: false, category: 'electronics', canPlaceOnSurfaces: true },
  { type: FurnitureType.PRINTER,         label: '印表機',   footprintW: 1, footprintH: 1, sprite: PRINTER_SPRITE,         isDesk: false, category: 'electronics' },
  { type: FurnitureType.COFFEE_MACHINE,  label: '咖啡機',   footprintW: 1, footprintH: 1, sprite: COFFEE_MACHINE_SPRITE,  isDesk: false, category: 'misc' },
  { type: FurnitureType.SOFA,            label: '沙發',     footprintW: 2, footprintH: 1, sprite: SOFA_SPRITE,            isDesk: false, category: 'chairs' },
  { type: FurnitureType.FILING_CABINET,  label: '檔案櫃',   footprintW: 1, footprintH: 1, sprite: FILING_CABINET_SPRITE,  isDesk: false, category: 'storage' },
  { type: FurnitureType.CLOCK,           label: '時鐘',     footprintW: 1, footprintH: 1, sprite: CLOCK_SPRITE,           isDesk: false, category: 'wall', canPlaceOnWalls: true },
  { type: FurnitureType.PAINTING,        label: '畫作',     footprintW: 1, footprintH: 1, sprite: PAINTING_SPRITE,        isDesk: false, category: 'wall', canPlaceOnWalls: true },
  { type: FurnitureType.TRASH_CAN,       label: '垃圾桶',   footprintW: 1, footprintH: 1, sprite: TRASH_CAN_SPRITE,       isDesk: false, category: 'misc' },
  { type: FurnitureType.FRIDGE,          label: '冰箱',     footprintW: 1, footprintH: 2, sprite: FRIDGE_SPRITE,          isDesk: false, category: 'misc' },
  { type: FurnitureType.VENDING_MACHINE, label: '販賣機',   footprintW: 1, footprintH: 2, sprite: VENDING_MACHINE_SPRITE, isDesk: false, category: 'misc' },
  { type: FurnitureType.SERVER_RACK,     label: '伺服器',   footprintW: 1, footprintH: 2, sprite: SERVER_RACK_SPRITE,     isDesk: false, category: 'electronics' },
  { type: FurnitureType.WINDOW,          label: '窗戶',     footprintW: 2, footprintH: 1, sprite: WINDOW_SPRITE,          isDesk: false, category: 'wall', canPlaceOnWalls: true },

  // ── 第二批家具精靈圖 ──
  { type: FurnitureType.MEETING_TABLE,      label: '會議桌',     footprintW: 2, footprintH: 2, sprite: MEETING_TABLE_SPRITE,      isDesk: true,  category: 'desks' },
  { type: FurnitureType.COFFEE_TABLE,       label: '茶几',       footprintW: 2, footprintH: 1, sprite: COFFEE_TABLE_SPRITE,       isDesk: false, category: 'desks' },
  { type: FurnitureType.ARMCHAIR,           label: '扶手椅',     footprintW: 1, footprintH: 1, sprite: ARMCHAIR_SPRITE,           isDesk: false, category: 'chairs' },
  { type: FurnitureType.LARGE_SCREEN,       label: '大螢幕',     footprintW: 2, footprintH: 1, sprite: LARGE_SCREEN_SPRITE,       isDesk: false, category: 'wall', canPlaceOnWalls: true },
  { type: FurnitureType.BULLETIN_BOARD,     label: '布告欄',     footprintW: 2, footprintH: 1, sprite: BULLETIN_BOARD_SPRITE,     isDesk: false, category: 'wall', canPlaceOnWalls: true },
  { type: FurnitureType.AC_UNIT,            label: '冷氣',       footprintW: 1, footprintH: 1, sprite: AC_UNIT_SPRITE,            isDesk: false, category: 'wall', canPlaceOnWalls: true },
  { type: FurnitureType.FIRE_EXTINGUISHER,  label: '滅火器',     footprintW: 1, footprintH: 1, sprite: FIRE_EXTINGUISHER_SPRITE,  isDesk: false, category: 'wall', canPlaceOnWalls: true },
  { type: FurnitureType.EXIT_SIGN,          label: '出口標誌',   footprintW: 1, footprintH: 1, sprite: EXIT_SIGN_SPRITE,          isDesk: false, category: 'wall', canPlaceOnWalls: true },
  { type: FurnitureType.PHONE,              label: '電話',       footprintW: 1, footprintH: 1, sprite: PHONE_SPRITE,              isDesk: false, category: 'electronics', canPlaceOnSurfaces: true },
  { type: FurnitureType.COFFEE_MUG,         label: '馬克杯',     footprintW: 1, footprintH: 1, sprite: COFFEE_MUG_SPRITE,         isDesk: false, category: 'misc', canPlaceOnSurfaces: true },
  { type: FurnitureType.PAPER_STACK,        label: '文件堆',     footprintW: 1, footprintH: 1, sprite: PAPER_STACK_SPRITE,        isDesk: false, category: 'misc', canPlaceOnSurfaces: true },
  { type: FurnitureType.MICROWAVE,          label: '微波爐',     footprintW: 1, footprintH: 1, sprite: MICROWAVE_SPRITE,          isDesk: false, category: 'electronics' },
  { type: FurnitureType.SINK,               label: '水槽',       footprintW: 1, footprintH: 1, sprite: SINK_SPRITE,               isDesk: false, category: 'misc' },
  { type: FurnitureType.LOCKER,             label: '置物櫃',     footprintW: 1, footprintH: 2, sprite: LOCKER_SPRITE,             isDesk: false, category: 'storage' },
  { type: FurnitureType.COAT_RACK,          label: '衣帽架',     footprintW: 1, footprintH: 1, sprite: COAT_RACK_SPRITE,          isDesk: false, category: 'decor' },
  { type: FurnitureType.POTTED_CACTUS,      label: '仙人掌',     footprintW: 1, footprintH: 1, sprite: POTTED_CACTUS_SPRITE,      isDesk: false, category: 'decor' },

]

// ── 旋轉群組 ──────────────────────────────────────────────
// 彈性旋轉：支援 2 個以上的朝向（不僅限 4 個）
interface RotationGroup {
  /** 此群組可用朝向的有序列表 */
  orientations: string[]
  /** 映射朝向 → 素材 ID（對應預設/關閉狀態） */
  members: Record<string, string>
}

// 映射任何成員素材 ID → 其所屬旋轉群組
const rotationGroups = new Map<string, RotationGroup>()

// ── 狀態群組 ────────────────────────────────────────────────
// 映射素材 ID → 其開/關對應項（對稱切換）
const stateGroups = new Map<string, string>()
// 用於 getOnStateType / getOffStateType 的方向性映射
const offToOn = new Map<string, string>()  // 關閉素材 → 開啟素材
const onToOff = new Map<string, string>()  // 開啟素材 → 關閉素材

// 內部目錄（包含所有變體，供 getCatalogEntry 查詢使用）
let internalCatalog: CatalogEntryWithCategory[] | null = null

// 從載入的素材建構的動態目錄（可用時使用）
// 僅包含群組項目的 "front" 變體（顯示在編輯器調色盤中）
let dynamicCatalog: CatalogEntryWithCategory[] | null = null
let dynamicCategories: FurnitureCategory[] | null = null

/**
 * 從載入的素材建構目錄。成功時返回 true。
 * 建構完成後，所有 getCatalog* 函式使用動態目錄。
 * 僅使用自訂素材（素材載入時排除硬編碼家具）。
 */
export function buildDynamicCatalog(assets: LoadedAssetData): boolean {
  if (!assets?.catalog || !assets?.sprites) return false

  // 建構所有條目（包含非 front 變體）
  const allEntries = assets.catalog.map((asset) => {
    const sprite = assets.sprites[asset.id]
    if (!sprite) {
      console.warn(`No sprite data for asset ${asset.id}`)
      return null
    }
    return {
      type: asset.id,
      label: asset.label,
      footprintW: asset.footprintW,
      footprintH: asset.footprintH,
      sprite,
      isDesk: asset.isDesk,
      category: asset.category as FurnitureCategory,
      ...(asset.orientation ? { orientation: asset.orientation } : {}),
      ...(asset.canPlaceOnSurfaces ? { canPlaceOnSurfaces: true } : {}),
      ...(asset.backgroundTiles ? { backgroundTiles: asset.backgroundTiles } : {}),
      ...(asset.canPlaceOnWalls ? { canPlaceOnWalls: true } : {}),
    }
  }).filter((e): e is CatalogEntryWithCategory => e !== null)

  if (allEntries.length === 0) return false

  // 從 groupId + orientation 元資料建構旋轉群組
  rotationGroups.clear()
  stateGroups.clear()
  offToOn.clear()
  onToOff.clear()

  // 階段 1：收集每個群組的朝向（旋轉僅使用 "off" 或無狀態變體）
  const groupMap = new Map<string, Map<string, string>>() // groupId → (orientation → assetId)
  for (const asset of assets.catalog) {
    if (asset.groupId && asset.orientation) {
      // 旋轉群組僅使用 "off" 或無狀態變體
      if (asset.state && asset.state !== 'off') continue
      let orientMap = groupMap.get(asset.groupId)
      if (!orientMap) {
        orientMap = new Map()
        groupMap.set(asset.groupId, orientMap)
      }
      orientMap.set(asset.orientation, asset.id)
    }
  }

  // 階段 2：註冊具有 2 個以上朝向的旋轉群組
  const nonFrontIds = new Set<string>()
  const orientationOrder = ['front', 'right', 'back', 'left']
  for (const orientMap of groupMap.values()) {
    if (orientMap.size < 2) continue
    // 建構可用朝向的有序列表
    const orderedOrients = orientationOrder.filter((o) => orientMap.has(o))
    if (orderedOrients.length < 2) continue
    const members: Record<string, string> = {}
    for (const o of orderedOrients) {
      members[o] = orientMap.get(o)!
    }
    const rg: RotationGroup = { orientations: orderedOrients, members }
    for (const id of Object.values(members)) {
      rotationGroups.set(id, rg)
    }
    // 追蹤非 front ID 以從可見目錄中排除
    for (const [orient, id] of Object.entries(members)) {
      if (orient !== 'front') nonFrontIds.add(id)
    }
  }

  // 階段 3：建構狀態群組（同一 groupId + orientation 內的 on ↔ off 配對）
  const stateMap = new Map<string, Map<string, string>>() // "groupId|orientation" → (state → assetId)
  for (const asset of assets.catalog) {
    if (asset.groupId && asset.state) {
      const key = `${asset.groupId}|${asset.orientation || ''}`
      let sm = stateMap.get(key)
      if (!sm) {
        sm = new Map()
        stateMap.set(key, sm)
      }
      sm.set(asset.state, asset.id)
    }
  }
  for (const sm of stateMap.values()) {
    const onId = sm.get('on')
    const offId = sm.get('off')
    if (onId && offId) {
      stateGroups.set(onId, offId)
      stateGroups.set(offId, onId)
      offToOn.set(offId, onId)
      onToOff.set(onId, offId)
    }
  }

  // 也為 "on" 狀態變體註冊旋轉群組（使旋轉功能也能作用於開啟狀態的項目）
  for (const asset of assets.catalog) {
    if (asset.groupId && asset.orientation && asset.state === 'on') {
      // 找到關閉變體的旋轉群組
      const offCounterpart = stateGroups.get(asset.id)
      if (offCounterpart) {
        const offGroup = rotationGroups.get(offCounterpart)
        if (offGroup) {
          // 為 "on" 狀態建構等價群組
          const onMembers: Record<string, string> = {}
          for (const orient of offGroup.orientations) {
            const offId = offGroup.members[orient]
            const onId = stateGroups.get(offId)
            // 若有開啟狀態變體則使用，否則回退至關閉狀態
            onMembers[orient] = onId ?? offId
          }
          const onGroup: RotationGroup = { orientations: offGroup.orientations, members: onMembers }
          for (const id of Object.values(onMembers)) {
            if (!rotationGroups.has(id)) {
              rotationGroups.set(id, onGroup)
            }
          }
        }
      }
    }
  }

  // 追蹤 "on" 變體 ID 以從可見目錄中排除
  const onStateIds = new Set<string>()
  for (const asset of assets.catalog) {
    if (asset.state === 'on') onStateIds.add(asset.id)
  }

  // 儲存完整內部目錄（所有變體 — 供 getCatalogEntry 查詢使用）
  internalCatalog = allEntries

  // 可見目錄：排除非 front 變體和 "on" 狀態變體
  const visibleEntries = allEntries.filter((e) => !nonFrontIds.has(e.type) && !onStateIds.has(e.type))

  // 移除群組變體標籤的朝向/狀態後綴
  for (const entry of visibleEntries) {
    if (rotationGroups.has(entry.type) || stateGroups.has(entry.type)) {
      entry.label = entry.label
        .replace(/ - Front - Off$/, '')
        .replace(/ - Front$/, '')
        .replace(/ - Off$/, '')
    }
  }

  dynamicCatalog = visibleEntries
  dynamicCategories = Array.from(new Set(visibleEntries.map((e) => e.category)))
    .filter((c): c is FurnitureCategory => !!c)
    .sort()

  const rotGroupCount = new Set(Array.from(rotationGroups.values())).size
  console.log(`✓ Built dynamic catalog with ${allEntries.length} assets (${visibleEntries.length} visible, ${rotGroupCount} rotation groups, ${stateGroups.size / 2} state pairs)`)
  return true
}

export function getCatalogEntry(type: string): CatalogEntryWithCategory | undefined {
  // 先檢查內部目錄（包含所有變體，例如非 front 旋轉）
  if (internalCatalog) {
    return internalCatalog.find((e) => e.type === type)
  }
  const catalog = dynamicCatalog || FURNITURE_CATALOG
  return catalog.find((e) => e.type === type)
}

export function getCatalogByCategory(category: FurnitureCategory): CatalogEntryWithCategory[] {
  const catalog = dynamicCatalog || FURNITURE_CATALOG
  return catalog.filter((e) => e.category === category)
}

export function getActiveCatalog(): CatalogEntryWithCategory[] {
  return dynamicCatalog || FURNITURE_CATALOG
}

export function getActiveCategories(): Array<{ id: FurnitureCategory; label: string }> {
  const categories = dynamicCategories || (FURNITURE_CATEGORIES.map((c) => c.id) as FurnitureCategory[])
  return FURNITURE_CATEGORIES.filter((c) => categories.includes(c.id))
}

export const FURNITURE_CATEGORIES: Array<{ id: FurnitureCategory; label: string }> = [
  { id: 'desks', label: '桌子' },
  { id: 'chairs', label: '椅子' },
  { id: 'storage', label: '收納' },
  { id: 'electronics', label: '電子' },
  { id: 'decor', label: '裝飾' },
  { id: 'wall', label: '牆飾' },
  { id: 'misc', label: '其他' },
]

// ── 旋轉輔助函式 ─────────────────────────────────────────────

/** 返回旋轉群組中的下一個素材 ID（順時針或逆時針），若不可旋轉則返回 null。 */
export function getRotatedType(currentType: string, direction: 'cw' | 'ccw'): string | null {
  const group = rotationGroups.get(currentType)
  if (!group) return null
  const order = group.orientations.map((o) => group.members[o])
  const idx = order.indexOf(currentType)
  if (idx === -1) return null
  const step = direction === 'cw' ? 1 : -1
  const nextIdx = (idx + step + order.length) % order.length
  return order[nextIdx]
}

/** 返回切換後的狀態變體（on↔off），若無狀態變體則返回 null。 */
export function getToggledType(currentType: string): string | null {
  return stateGroups.get(currentType) ?? null
}

/** 若此類型有 "on" 變體則返回，否則返回原類型不變。 */
export function getOnStateType(currentType: string): string {
  return offToOn.get(currentType) ?? currentType
}

/** 若此類型有 "off" 變體則返回，否則返回原類型不變。 */
export function getOffStateType(currentType: string): string {
  return onToOff.get(currentType) ?? currentType
}

/** 若指定的家具類型屬於旋轉群組則返回 true。 */
export function isRotatable(type: string): boolean {
  return rotationGroups.has(type)
}
