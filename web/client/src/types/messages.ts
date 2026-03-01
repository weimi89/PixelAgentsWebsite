/**
 * 伺服器 → 客戶端的 Socket.IO 訊息型別定義。
 * 使用 discriminated union 讓 TypeScript 透過 msg.type 自動縮窄型別，
 * 避免在訊息處理器中大量使用 `as` 型別斷言。
 */

import type { OfficeLayout } from '../office/types.js'
import type { FurnitureAsset, TranscriptEntry } from '../hooks/useExtensionMessages.js'
import type { SessionInfo } from '../components/SessionPicker.js'

/** 樓層配置 */
export interface FloorConfig {
  id: string
  name: string
  order: number
}

/** 建築物配置 */
export interface BuildingConfig {
  version: 1
  defaultFloorId: string
  floors: FloorConfig[]
}

/** 代理元資料（恢復既有代理時附帶） */
interface AgentMeta {
  palette?: number
  hueShift?: number
  seatId?: string
  isExternal?: boolean
  projectName?: string
  floorId?: string
}

/** 角色精靈圖方向資料 */
interface CharacterSpriteDirections {
  down: string[][][]
  up: string[][][]
  right: string[][][]
}

/** 伺服器 → 客戶端訊息的 discriminated union */
export type ServerMessage =
  | { type: 'layoutLoaded'; layout: OfficeLayout | null }
  | { type: 'agentCreated'; id: number; isExternal?: boolean; projectName?: string; floorId?: string }
  | { type: 'agentClosed'; id: number }
  | { type: 'existingAgents'; agents: number[]; agentMeta?: Record<number, AgentMeta> }
  | { type: 'agentToolStart'; id: number; toolId: string; status: string }
  | { type: 'agentToolDone'; id: number; toolId: string }
  | { type: 'agentToolsClear'; id: number }
  | { type: 'agentSelected'; id: number }
  | { type: 'agentStatus'; id: number; status: string }
  | { type: 'agentToolPermission'; id: number }
  | { type: 'agentToolPermissionClear'; id: number }
  | { type: 'subagentToolPermission'; id: number; parentToolId: string }
  | { type: 'subagentToolStart'; id: number; parentToolId: string; toolId: string; status: string }
  | { type: 'subagentToolDone'; id: number; parentToolId: string; toolId: string }
  | { type: 'subagentClear'; id: number; parentToolId: string }
  | { type: 'agentModel'; id: number; model: string }
  | { type: 'agentDetached'; id: number; detached: boolean }
  | { type: 'agentThinking'; id: number; thinking: boolean }
  | { type: 'characterSpritesLoaded'; characters: CharacterSpriteDirections[] }
  | { type: 'floorTilesLoaded'; sprites: string[][][] }
  | { type: 'wallTilesLoaded'; sprites: string[][][] }
  | { type: 'furnitureAssetsLoaded'; catalog: FurnitureAsset[]; sprites: Record<string, string[][]> }
  | { type: 'settingsLoaded'; soundEnabled: boolean }
  | { type: 'sessionsList'; sessions: SessionInfo[] }
  | { type: 'agentEmote'; id: number; emote: string }
  | { type: 'agentTranscript'; id: number; log: TranscriptEntry[] }
  | { type: 'exportLayoutData'; layout: OfficeLayout }
  | { type: 'projectNameUpdated'; updates: Record<number, string> }
  | { type: 'excludedProjectsUpdated'; excluded: string[] }
  | { type: 'projectDirsList'; dirs: { name: string; excluded: boolean }[] }
  | { type: 'buildingConfig'; building: BuildingConfig }
  | { type: 'floorSwitched'; floorId: string }
