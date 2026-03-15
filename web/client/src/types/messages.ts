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
  /** 樓層擁有者的使用者 ID（null 表示公共樓層） */
  ownerId?: string | null
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
  isRemote?: boolean
  owner?: string
  fromElevator?: boolean
  cliType?: string
  startedAt?: number
}

/** 角色精靈圖方向資料 */
interface CharacterSpriteDirections {
  down: string[][][]
  up: string[][][]
  right: string[][][]
}

/** 樓層代理數量摘要 */
export interface FloorSummary {
  floorId: string
  agentCount: number
}

/** 儀表板資料 */
export interface DashboardPayload {
  floors: Array<{ id: string; name: string; order: number; agentCount: number; activeCount: number }>
  agents: Array<{ id: number; projectName: string; floorId: string; floorName: string; isActive: boolean; model: string; isRemote: boolean; owner: string; activeToolName: string; toolCount: number }>
  stats: { totalAgents: number; activeAgents: number; totalToolCalls: number; toolDistribution: Record<string, number> }
}

/** 伺服器 → 客戶端訊息的 discriminated union */
export type ServerMessage =
  | { type: 'layoutLoaded'; layout: OfficeLayout | null }
  | { type: 'agentCreated'; id: number; isExternal?: boolean; projectName?: string; floorId?: string; isRemote?: boolean; owner?: string; fromElevator?: boolean; cliType?: string; startedAt?: number }
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
  | { type: 'settingsLoaded'; soundEnabled: boolean; zoom?: number; soundConfig?: { master?: boolean; waiting?: boolean; permission?: boolean; turnComplete?: boolean }; uiScale?: number; lanDiscoveryEnabled?: boolean; lanPeerName?: string }
  | { type: 'sessionsList'; sessions: SessionInfo[] }
  | { type: 'agentEmote'; id: number; emote: string }
  | { type: 'agentTranscript'; id: number; log: TranscriptEntry[] }
  | { type: 'exportLayoutData'; layout: OfficeLayout }
  | { type: 'projectNameUpdated'; updates: Record<number, string> }
  | { type: 'excludedProjectsUpdated'; excluded: string[] }
  | { type: 'projectDirsList'; dirs: { name: string; excluded: boolean }[] }
  | { type: 'buildingConfig'; building: BuildingConfig }
  | { type: 'floorSwitched'; floorId: string }
  | { type: 'floorSummaries'; summaries: FloorSummary[] }
  | { type: 'chatMessage'; nickname: string; text: string; ts: number }
  | { type: 'chatHistory'; messages: Array<{ nickname: string; text: string; ts: number }> }
  | { type: 'agentFloorTransfer'; id: number; targetFloorId: string }
  | { type: 'dashboardData'; data: DashboardPayload }
  | { type: 'agentGitBranch'; id: number; branch: string }
  | { type: 'statusHistory'; id: number; history: Array<{ ts: number; status: string; detail?: string }> }
  | { type: 'agentTeam'; id: number; teamName: string | null }
  | { type: 'lanPeers'; peers: Array<{ name: string; host: string; port: number; agentCount: number }> }
  | { type: 'behaviorSettingsLoaded'; settings: Record<string, number> }
  | { type: 'agentGrowth'; id: number; xp: number; level: number; achievements: string[]; newAchievements: string[] }
  | { type: 'nodeHealth'; nodes: ConnectedNodeInfo[] }
  | { type: 'permissionDenied'; action: string; reason: string }

/** 已連線 Agent Node 的摘要資訊 */
export interface ConnectedNodeInfo {
  username: string
  socketId: string
  latencyMs: number
  activeSessions: number
  connectedAt: number
  lastHeartbeat: number
}
