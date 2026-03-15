import { useState, useEffect, useRef, useCallback } from 'react'
import type { OfficeState } from '../office/engine/officeState.js'
import type { OfficeLayout, ToolActivity, EmoteType } from '../office/types.js'
import type { ServerMessage, BuildingConfig, ConnectedNodeInfo } from '../types/messages.js'
import { extractToolName } from '../office/toolUtils.js'
import { migrateLayoutColors } from '../office/layout/layoutSerializer.js'
import { buildDynamicCatalog } from '../office/layout/furnitureCatalog.js'
import { setFloorSprites } from '../office/floorTiles.js'
import { invalidateTileLayer } from '../office/engine/renderer.js'
import { setWallSprites } from '../office/wallTiles.js'
import { setCharacterTemplates } from '../office/sprites/spriteData.js'
import { vscode, onServerMessage } from '../socketApi.js'
import { playWaitingSound, playPermissionSound, playTurnCompleteSound, setSoundEnabled, setSoundConfig } from '../notificationSound.js'
import { TEAM_COLORS } from '../constants.js'
import { setBehaviorConfig } from '../office/engine/behaviorConfig.js'

/** 從 Record<number, T> 中移除指定鍵，若鍵不存在則回傳原始物件（避免不必要的重渲染） */
function removeKey<T>(prev: Record<number, T>, id: number): Record<number, T> {
  if (!(id in prev)) return prev
  const next = { ...prev }
  delete next[id]
  return next
}

export interface SubagentCharacter {
  id: number
  parentAgentId: number
  parentToolId: string
  label: string
}

export interface FurnitureAsset {
  id: string
  name: string
  label: string
  category: string
  file: string
  width: number
  height: number
  footprintW: number
  footprintH: number
  isDesk: boolean
  canPlaceOnWalls: boolean
  partOfGroup?: boolean
  groupId?: string
  canPlaceOnSurfaces?: boolean
  backgroundTiles?: number
}

export interface ExtensionMessageState {
  agents: number[]
  selectedAgent: number | null
  agentTools: Record<number, ToolActivity[]>
  agentStatuses: Record<number, string>
  agentModels: Record<number, string>
  subagentTools: Record<number, Record<string, ToolActivity[]>>
  subagentCharacters: SubagentCharacter[]
  layoutReady: boolean
  loadedAssets?: { catalog: FurnitureAsset[]; sprites: Record<string, string[][]> }
  /** agentId → projectName，僅外部專案代理有條目 */
  agentProjects: Record<number, string>
  /** agentId → { owner }，僅遠端代理有條目 */
  remoteAgents: Record<number, { owner: string }>
  /** agentId → 轉錄記錄陣列 */
  agentTranscripts: Record<number, TranscriptEntry[]>
  /** 被排除的專案目錄 basename 清單 */
  excludedProjects: string[]
  /** ~/.claude/projects/ 下所有專案目錄（含排除狀態） */
  projectDirs: { name: string; excluded: boolean }[]
  /** 當前觀看的樓層 ID */
  currentFloorId: string | null
  /** 建築物配置 */
  building: BuildingConfig | null
  /** 各樓層代理數量摘要（floorId → agentCount） */
  floorSummaries: Record<string, number>
  /** 聊天訊息 */
  chatMessages: Array<{ nickname: string; text: string; ts: number }>
  /** agentId → git 分支名稱 */
  agentGitBranches: Record<number, string>
  /** agentId → 狀態歷史 */
  agentStatusHistory: Record<number, Array<{ ts: number; status: string; detail?: string }>>
  /** agentId → 團隊名稱 */
  agentTeams: Record<number, string>
  /** agentId → CLI 類型 */
  agentCliTypes: Record<number, string>
  /** 區網已發現的同伴 */
  lanPeers: Array<{ name: string; host: string; port: number; agentCount: number }>
  /** agentId → 成長資料 */
  agentGrowthData: Record<number, { xp: number; level: number; achievements: string[] }>
  /** agentId → 開始工作時間戳（ms） */
  agentStartTimes: Record<number, number>
  /** 已連線的遠端節點健康資訊 */
  nodeHealthNodes: ConnectedNodeInfo[]
  /** 待顯示的成就通知佇列 */
  pendingAchievementToasts: string[]
  /** 移除已顯示的成就通知 */
  dismissAchievementToast: () => void
}

/** 轉錄記錄條目 */
export interface TranscriptEntry {
  ts: number
  role: 'user' | 'assistant' | 'system'
  summary: string
}

function saveAgentSeats(os: OfficeState): void {
  const seats: Record<number, { palette: number; hueShift: number; seatId: string | null }> = {}
  for (const ch of os.characters.values()) {
    if (ch.isSubagent) continue
    seats[ch.id] = { palette: ch.palette, hueShift: ch.hueShift, seatId: ch.seatId }
  }
  vscode.postMessage({ type: 'saveAgentSeats', seats })
}

// ── Handler Context ────────────────────────────────────────────

interface HandlerContext {
  os: OfficeState
  layoutReadyRef: React.MutableRefObject<boolean>
  pendingAgentsRef: React.MutableRefObject<Array<{ id: number; palette?: number; hueShift?: number; seatId?: string }>>
  isEditDirty?: () => boolean
  onLayoutLoaded?: (layout: OfficeLayout) => void
  onZoomLoaded?: (zoom: number) => void
  onUiScaleLoaded?: (scale: number) => void
  setAgents: React.Dispatch<React.SetStateAction<number[]>>
  setSelectedAgent: React.Dispatch<React.SetStateAction<number | null>>
  setAgentTools: React.Dispatch<React.SetStateAction<Record<number, ToolActivity[]>>>
  setAgentStatuses: React.Dispatch<React.SetStateAction<Record<number, string>>>
  setAgentModels: React.Dispatch<React.SetStateAction<Record<number, string>>>
  setSubagentTools: React.Dispatch<React.SetStateAction<Record<number, Record<string, ToolActivity[]>>>>
  setSubagentCharacters: React.Dispatch<React.SetStateAction<SubagentCharacter[]>>
  setLayoutReady: React.Dispatch<React.SetStateAction<boolean>>
  setLoadedAssets: React.Dispatch<React.SetStateAction<{ catalog: FurnitureAsset[]; sprites: Record<string, string[][]> } | undefined>>
  setAgentProjects: React.Dispatch<React.SetStateAction<Record<number, string>>>
  setRemoteAgents: React.Dispatch<React.SetStateAction<Record<number, { owner: string }>>>
  setAgentTranscripts: React.Dispatch<React.SetStateAction<Record<number, TranscriptEntry[]>>>
  setExcludedProjects: React.Dispatch<React.SetStateAction<string[]>>
  setProjectDirs: React.Dispatch<React.SetStateAction<{ name: string; excluded: boolean }[]>>
  setCurrentFloorId: React.Dispatch<React.SetStateAction<string | null>>
  setBuilding: React.Dispatch<React.SetStateAction<BuildingConfig | null>>
  setFloorSummaries: React.Dispatch<React.SetStateAction<Record<string, number>>>
  setChatMessages: React.Dispatch<React.SetStateAction<Array<{ nickname: string; text: string; ts: number }>>>
  setAgentGitBranches: React.Dispatch<React.SetStateAction<Record<number, string>>>
  setAgentStatusHistory: React.Dispatch<React.SetStateAction<Record<number, Array<{ ts: number; status: string; detail?: string }>>>>
  setAgentTeams: React.Dispatch<React.SetStateAction<Record<number, string>>>
  setAgentCliTypes: React.Dispatch<React.SetStateAction<Record<number, string>>>
  setLanPeers: React.Dispatch<React.SetStateAction<Array<{ name: string; host: string; port: number; agentCount: number }>>>
  setAgentGrowthData: React.Dispatch<React.SetStateAction<Record<number, { xp: number; level: number; achievements: string[] }>>>
  setAgentStartTimes: React.Dispatch<React.SetStateAction<Record<number, number>>>
  setNodeHealthNodes: React.Dispatch<React.SetStateAction<ConnectedNodeInfo[]>>
  setPendingAchievementToasts: React.Dispatch<React.SetStateAction<string[]>>
}

// ── Message Handlers ───────────────────────────────────────────

function handleLayoutLoaded(msg: ServerMessage & { type: 'layoutLoaded' }, ctx: HandlerContext): void {
  if (ctx.layoutReadyRef.current && ctx.isEditDirty?.()) {
    console.log('[Webview] 跳過外部佈局更新 — 編輯器有未儲存的變更')
    return
  }
  const rawLayout = msg.layout
  const layout = rawLayout && rawLayout.version === 1 ? migrateLayoutColors(rawLayout) : null
  if (layout) {
    ctx.os.rebuildFromLayout(layout)
    ctx.onLayoutLoaded?.(layout)
  } else {
    ctx.onLayoutLoaded?.(ctx.os.getLayout())
  }
  for (const p of ctx.pendingAgentsRef.current) {
    ctx.os.addAgent(p.id, p.palette, p.hueShift, p.seatId, true)
  }
  ctx.pendingAgentsRef.current = []
  ctx.layoutReadyRef.current = true
  ctx.setLayoutReady(true)
  if (ctx.os.characters.size > 0) {
    saveAgentSeats(ctx.os)
  }
}

function handleAgentCreated(msg: ServerMessage & { type: 'agentCreated' }, ctx: HandlerContext): void {
  const { id, projectName } = msg
  ctx.setAgents((prev) => (prev.includes(id) ? prev : [...prev, id]))
  ctx.setSelectedAgent(id)
  if (projectName) {
    ctx.setAgentProjects((prev) => ({ ...prev, [id]: projectName }))
  }
  if (msg.startedAt) {
    ctx.setAgentStartTimes((prev) => ({ ...prev, [id]: msg.startedAt! }))
  }
  if (msg.cliType) {
    ctx.setAgentCliTypes((prev) => ({ ...prev, [id]: msg.cliType! }))
  }
  if (msg.isRemote && msg.owner) {
    ctx.setRemoteAgents((prev) => ({ ...prev, [id]: { owner: msg.owner! } }))
    ctx.os.setAgentRemote(id, true)
  }
  if (msg.fromElevator) {
    // 從電梯位置生成（若有電梯）
    const elevPos = ctx.os.findElevatorPosition()
    if (elevPos) {
      ctx.os.addAgentAtPosition(id, elevPos.col, elevPos.row)
    } else {
      ctx.os.addAgent(id)
    }
  } else {
    ctx.os.addAgent(id)
  }
  saveAgentSeats(ctx.os)
}

function handleAgentClosed(msg: ServerMessage & { type: 'agentClosed' }, ctx: HandlerContext): void {
  const { id } = msg
  ctx.setAgents((prev) => prev.filter((a) => a !== id))
  ctx.setSelectedAgent((prev) => (prev === id ? null : prev))
  ctx.setAgentTools((prev) => removeKey(prev, id))
  ctx.setAgentStatuses((prev) => removeKey(prev, id))
  ctx.setAgentModels((prev) => removeKey(prev, id))
  ctx.setAgentProjects((prev) => removeKey(prev, id))
  ctx.setRemoteAgents((prev) => removeKey(prev, id))
  ctx.setSubagentTools((prev) => removeKey(prev, id))
  ctx.setAgentTranscripts((prev) => removeKey(prev, id))
  ctx.setAgentGitBranches((prev) => removeKey(prev, id))
  ctx.setAgentStatusHistory((prev) => removeKey(prev, id))
  ctx.setAgentTeams((prev) => removeKey(prev, id))
  ctx.setAgentCliTypes((prev) => removeKey(prev, id))
  ctx.setAgentGrowthData((prev) => removeKey(prev, id))
  ctx.setAgentStartTimes((prev) => removeKey(prev, id))
  ctx.os.removeAllSubagents(id)
  ctx.setSubagentCharacters((prev) => prev.filter((s) => s.parentAgentId !== id))
  ctx.os.removeAgent(id)
}

function handleExistingAgents(msg: ServerMessage & { type: 'existingAgents' }, ctx: HandlerContext): void {
  const incoming = msg.agents
  const meta = msg.agentMeta || ({} as Record<number, { palette?: number; hueShift?: number; seatId?: string; isExternal?: boolean; projectName?: string; isRemote?: boolean; owner?: string; cliType?: string; startedAt?: number }>)
  const newProjects: Record<number, string> = {}
  const newRemote: Record<number, { owner: string }> = {}
  const newCliTypes: Record<number, string> = {}
  const newStartTimes: Record<number, number> = {}
  for (const id of incoming) {
    const m = meta[id]
    if (m?.projectName) {
      newProjects[id] = m.projectName
    }
    if (m?.cliType) {
      newCliTypes[id] = m.cliType
    }
    if (m?.startedAt) {
      newStartTimes[id] = m.startedAt
    }
    if (m?.isRemote && m?.owner) {
      newRemote[id] = { owner: m.owner }
      ctx.os.setAgentRemote(id, true)
    }
    if (ctx.layoutReadyRef.current) {
      ctx.os.addAgent(id, m?.palette, m?.hueShift, m?.seatId, true)
    } else {
      ctx.pendingAgentsRef.current.push({ id, palette: m?.palette, hueShift: m?.hueShift, seatId: m?.seatId })
    }
  }
  if (Object.keys(newProjects).length > 0) {
    ctx.setAgentProjects((prev) => ({ ...prev, ...newProjects }))
  }
  if (Object.keys(newRemote).length > 0) {
    ctx.setRemoteAgents((prev) => ({ ...prev, ...newRemote }))
  }
  if (Object.keys(newCliTypes).length > 0) {
    ctx.setAgentCliTypes((prev) => ({ ...prev, ...newCliTypes }))
  }
  if (Object.keys(newStartTimes).length > 0) {
    ctx.setAgentStartTimes((prev) => ({ ...prev, ...newStartTimes }))
  }
  if (ctx.layoutReadyRef.current && incoming.length > 0) {
    saveAgentSeats(ctx.os)
  }
  ctx.setAgents((prev) => {
    const ids = new Set(prev)
    const merged = [...prev]
    for (const id of incoming) {
      if (!ids.has(id)) {
        merged.push(id)
      }
    }
    return merged.sort((a, b) => a - b)
  })
}

function handleAgentToolStart(msg: ServerMessage & { type: 'agentToolStart' }, ctx: HandlerContext): void {
  const { id, toolId, status } = msg
  ctx.setAgentTools((prev) => {
    const list = prev[id] || []
    if (list.some((t) => t.toolId === toolId)) return prev
    return { ...prev, [id]: [...list, { toolId, status, done: false, startTime: Date.now() }] }
  })
  const toolName = extractToolName(status)
  ctx.os.setAgentTool(id, toolName)
  ctx.os.setAgentActive(id, true)
  ctx.os.clearPermissionBubble(id)
  if (status.startsWith('Subtask:')) {
    const label = status.slice('Subtask:'.length).trim()
    const subId = ctx.os.addSubagent(id, toolId)
    ctx.setSubagentCharacters((prev) => {
      if (prev.some((s) => s.id === subId)) return prev
      const siblingCount = prev.filter((s) => s.parentAgentId === id).length
      const numbered = `#${siblingCount + 1} ${label}`
      return [...prev, { id: subId, parentAgentId: id, parentToolId: toolId, label: numbered }]
    })
  }
}

function handleAgentToolDone(msg: ServerMessage & { type: 'agentToolDone' }, ctx: HandlerContext): void {
  const { id, toolId } = msg
  ctx.setAgentTools((prev) => {
    const list = prev[id]
    if (!list) return prev
    return {
      ...prev,
      [id]: list.map((t) => (t.toolId === toolId ? { ...t, done: true, endTime: Date.now() } : t)),
    }
  })
}

function handleAgentToolsClear(msg: ServerMessage & { type: 'agentToolsClear' }, ctx: HandlerContext): void {
  const { id } = msg
  ctx.setAgentTools((prev) => removeKey(prev, id))
  ctx.setSubagentTools((prev) => removeKey(prev, id))
  ctx.os.removeAllSubagents(id)
  ctx.setSubagentCharacters((prev) => prev.filter((s) => s.parentAgentId !== id))
  ctx.os.setAgentTool(id, null)
  ctx.os.clearPermissionBubble(id)
  playTurnCompleteSound()
}

function handleAgentSelected(msg: ServerMessage & { type: 'agentSelected' }, ctx: HandlerContext): void {
  ctx.setSelectedAgent(msg.id)
}

function handleAgentStatus(msg: ServerMessage & { type: 'agentStatus' }, ctx: HandlerContext): void {
  const { id, status } = msg
  ctx.setAgentStatuses((prev) => {
    if (status === 'active') return removeKey(prev, id)
    return { ...prev, [id]: status }
  })
  ctx.os.setAgentActive(id, status === 'active')
  if (status === 'waiting') {
    ctx.os.showWaitingBubble(id)
    playWaitingSound()
  }
}

function handleAgentToolPermission(msg: ServerMessage & { type: 'agentToolPermission' }, ctx: HandlerContext): void {
  const { id } = msg
  ctx.setAgentTools((prev) => {
    const list = prev[id]
    if (!list) return prev
    return {
      ...prev,
      [id]: list.map((t) => (t.done ? t : { ...t, permissionWait: true })),
    }
  })
  ctx.os.showPermissionBubble(id)
  playPermissionSound()
}

function handleSubagentToolPermission(msg: ServerMessage & { type: 'subagentToolPermission' }, ctx: HandlerContext): void {
  const { id, parentToolId } = msg
  const subId = ctx.os.getSubagentId(id, parentToolId)
  if (subId !== null) {
    ctx.os.showPermissionBubble(subId)
  }
}

function handleAgentToolPermissionClear(msg: ServerMessage & { type: 'agentToolPermissionClear' }, ctx: HandlerContext): void {
  const { id } = msg
  ctx.setAgentTools((prev) => {
    const list = prev[id]
    if (!list) return prev
    const hasPermission = list.some((t) => t.permissionWait)
    if (!hasPermission) return prev
    return {
      ...prev,
      [id]: list.map((t) => (t.permissionWait ? { ...t, permissionWait: false } : t)),
    }
  })
  ctx.os.clearPermissionBubble(id)
  for (const [subId, meta] of ctx.os.subagentMeta) {
    if (meta.parentAgentId === id) {
      ctx.os.clearPermissionBubble(subId)
    }
  }
}

function handleSubagentToolStart(msg: ServerMessage & { type: 'subagentToolStart' }, ctx: HandlerContext): void {
  const { id, parentToolId, toolId, status } = msg
  ctx.setSubagentTools((prev) => {
    const agentSubs = prev[id] || {}
    const list = agentSubs[parentToolId] || []
    if (list.some((t) => t.toolId === toolId)) return prev
    return { ...prev, [id]: { ...agentSubs, [parentToolId]: [...list, { toolId, status, done: false, startTime: Date.now() }] } }
  })
  const subId = ctx.os.getSubagentId(id, parentToolId)
  if (subId !== null) {
    const subToolName = extractToolName(status)
    ctx.os.setAgentTool(subId, subToolName)
    ctx.os.setAgentActive(subId, true)
  }
}

function handleSubagentToolDone(msg: ServerMessage & { type: 'subagentToolDone' }, ctx: HandlerContext): void {
  const { id, parentToolId, toolId } = msg
  ctx.setSubagentTools((prev) => {
    const agentSubs = prev[id]
    if (!agentSubs) return prev
    const list = agentSubs[parentToolId]
    if (!list) return prev
    return {
      ...prev,
      [id]: { ...agentSubs, [parentToolId]: list.map((t) => (t.toolId === toolId ? { ...t, done: true, endTime: Date.now() } : t)) },
    }
  })
}

function handleSubagentClear(msg: ServerMessage & { type: 'subagentClear' }, ctx: HandlerContext): void {
  const { id, parentToolId } = msg
  ctx.setSubagentTools((prev) => {
    const agentSubs = prev[id]
    if (!agentSubs || !(parentToolId in agentSubs)) return prev
    const next = { ...agentSubs }
    delete next[parentToolId]
    if (Object.keys(next).length === 0) {
      const outer = { ...prev }
      delete outer[id]
      return outer
    }
    return { ...prev, [id]: next }
  })
  ctx.os.removeSubagent(id, parentToolId)
  ctx.setSubagentCharacters((prev) => prev.filter((s) => !(s.parentAgentId === id && s.parentToolId === parentToolId)))
}

function handleAgentEmote(msg: ServerMessage & { type: 'agentEmote' }, ctx: HandlerContext): void {
  ctx.os.showEmote(msg.id, msg.emote as EmoteType)
}

function handleAgentThinking(msg: ServerMessage & { type: 'agentThinking' }, ctx: HandlerContext): void {
  ctx.os.setAgentThinking(msg.id, msg.thinking)
}

function handleAgentDetached(msg: ServerMessage & { type: 'agentDetached' }, ctx: HandlerContext): void {
  ctx.os.setAgentDetached(msg.id, msg.detached)
}

function handleAgentModel(msg: ServerMessage & { type: 'agentModel' }, ctx: HandlerContext): void {
  const { id, model } = msg
  ctx.setAgentModels((prev) => {
    if (prev[id] === model) return prev
    return { ...prev, [id]: model }
  })
}

function handleCharacterSpritesLoaded(msg: ServerMessage & { type: 'characterSpritesLoaded' }): void {
  console.log(`[Webview] 收到 ${msg.characters.length} 個預著色角色精靈圖`)
  setCharacterTemplates(msg.characters)
}

function handleFloorTilesLoaded(msg: ServerMessage & { type: 'floorTilesLoaded' }): void {
  console.log(`[Webview] 收到 ${msg.sprites.length} 個地板花紋`)
  setFloorSprites(msg.sprites)
  invalidateTileLayer()
}

function handleWallTilesLoaded(msg: ServerMessage & { type: 'wallTilesLoaded' }): void {
  console.log(`[Webview] 收到 ${msg.sprites.length} 個牆磚精靈圖`)
  setWallSprites(msg.sprites)
}

function handleSettingsLoaded(msg: ServerMessage & { type: 'settingsLoaded' }, ctx: HandlerContext): void {
  setSoundEnabled(msg.soundEnabled)
  if (msg.soundConfig) {
    setSoundConfig(msg.soundConfig)
  }
  if (msg.zoom != null) {
    ctx.onZoomLoaded?.(msg.zoom)
  }
  if (msg.uiScale != null) {
    ctx.onUiScaleLoaded?.(msg.uiScale)
  }
}

function handleFurnitureAssetsLoaded(msg: ServerMessage & { type: 'furnitureAssetsLoaded' }, ctx: HandlerContext): void {
  try {
    const { catalog, sprites } = msg
    console.log(`Webview: 載入了 ${catalog.length} 個家具素材`)
    buildDynamicCatalog({ catalog, sprites })
    ctx.setLoadedAssets({ catalog, sprites })
  } catch (err) {
    console.error(`Webview: 處理 furnitureAssetsLoaded 時發生錯誤:`, err)
  }
}

function handleAgentTranscript(msg: ServerMessage & { type: 'agentTranscript' }, ctx: HandlerContext): void {
  const { id, log } = msg
  ctx.setAgentTranscripts((prev) => ({ ...prev, [id]: log }))
}

function handleProjectNameUpdated(msg: ServerMessage & { type: 'projectNameUpdated' }, ctx: HandlerContext): void {
  ctx.setAgentProjects((prev) => ({ ...prev, ...msg.updates }))
}

function handleExcludedProjectsUpdated(msg: ServerMessage & { type: 'excludedProjectsUpdated' }, ctx: HandlerContext): void {
  ctx.setExcludedProjects(msg.excluded)
}

function handleProjectDirsList(msg: ServerMessage & { type: 'projectDirsList' }, ctx: HandlerContext): void {
  ctx.setProjectDirs(msg.dirs)
}

function handleBuildingConfig(msg: ServerMessage & { type: 'buildingConfig' }, ctx: HandlerContext): void {
  ctx.setBuilding(msg.building)
  ctx.setCurrentFloorId((prev) => prev ?? msg.building.defaultFloorId)
}

function handleFloorSummaries(msg: ServerMessage & { type: 'floorSummaries' }, ctx: HandlerContext): void {
  const map: Record<string, number> = {}
  for (const s of msg.summaries) {
    map[s.floorId] = s.agentCount
  }
  ctx.setFloorSummaries(map)
}

function handleAgentFloorTransfer(msg: ServerMessage & { type: 'agentFloorTransfer' }, ctx: HandlerContext): void {
  const { id } = msg
  // 觸發代理離開動畫（走向電梯 → 消散）
  ctx.os.startFloorTransfer(id)
  // 從 UI 狀態中移除代理（角色的視覺消散由 officeState 處理）
  ctx.setAgents((prev) => prev.filter((a) => a !== id))
  ctx.setAgentTools((prev) => removeKey(prev, id))
  ctx.setAgentStatuses((prev) => removeKey(prev, id))
  ctx.setAgentModels((prev) => removeKey(prev, id))
  ctx.setAgentProjects((prev) => removeKey(prev, id))
  ctx.setRemoteAgents((prev) => removeKey(prev, id))
  ctx.setSubagentTools((prev) => removeKey(prev, id))
  ctx.setAgentTranscripts((prev) => removeKey(prev, id))
  ctx.setAgentGitBranches((prev) => removeKey(prev, id))
  ctx.setAgentStatusHistory((prev) => removeKey(prev, id))
  ctx.setAgentTeams((prev) => removeKey(prev, id))
  ctx.setAgentCliTypes((prev) => removeKey(prev, id))
  ctx.setAgentStartTimes((prev) => removeKey(prev, id))
  ctx.os.removeAllSubagents(id)
  ctx.setSubagentCharacters((prev) => prev.filter((s) => s.parentAgentId !== id))
}

function handleChatMessage(msg: ServerMessage & { type: 'chatMessage' }, ctx: HandlerContext): void {
  const { nickname, text, ts } = msg
  ctx.setChatMessages((prev) => [...prev, { nickname, text, ts }])
}

function handleChatHistory(msg: ServerMessage & { type: 'chatHistory' }, ctx: HandlerContext): void {
  ctx.setChatMessages(msg.messages)
}

function handleAgentGitBranch(msg: ServerMessage & { type: 'agentGitBranch' }, ctx: HandlerContext): void {
  const { id, branch } = msg
  ctx.setAgentGitBranches((prev) => {
    if (prev[id] === branch) return prev
    return { ...prev, [id]: branch }
  })
}

function handleStatusHistory(msg: ServerMessage & { type: 'statusHistory' }, ctx: HandlerContext): void {
  const { id, history } = msg
  ctx.setAgentStatusHistory((prev) => ({ ...prev, [id]: history }))
}

/** 為團隊名稱分配一致的顏色（基於名稱的哈希） */
function getTeamColor(teamName: string): string {
  let hash = 0
  for (let i = 0; i < teamName.length; i++) {
    hash = ((hash << 5) - hash + teamName.charCodeAt(i)) | 0
  }
  return TEAM_COLORS[Math.abs(hash) % TEAM_COLORS.length]
}

function handleAgentTeam(msg: ServerMessage & { type: 'agentTeam' }, ctx: HandlerContext): void {
  const { id, teamName } = msg
  if (teamName) {
    const color = getTeamColor(teamName)
    ctx.setAgentTeams((prev) => {
      if (prev[id] === teamName) return prev
      return { ...prev, [id]: teamName }
    })
    ctx.os.setAgentTeam(id, teamName, color)
  } else {
    ctx.setAgentTeams((prev) => removeKey(prev, id))
    ctx.os.setAgentTeam(id, null, null)
  }
}

function handleLanPeers(msg: ServerMessage & { type: 'lanPeers' }, ctx: HandlerContext): void {
  ctx.setLanPeers(msg.peers)
}

function handleBehaviorSettingsLoaded(msg: ServerMessage & { type: 'behaviorSettingsLoaded' }): void {
  setBehaviorConfig(msg.settings as Record<string, number>)
}

function handleNodeHealth(msg: ServerMessage & { type: 'nodeHealth' }, ctx: HandlerContext): void {
  ctx.setNodeHealthNodes(msg.nodes)
}

function handlePermissionDenied(msg: ServerMessage & { type: 'permissionDenied' }): void {
  console.warn(`[Webview] 權限被拒絕: action=${msg.action}, reason=${msg.reason}`)
}

function handleAgentGrowth(msg: ServerMessage & { type: 'agentGrowth' }, ctx: HandlerContext): void {
  // 更新 OfficeState 中角色的等級
  const ch = ctx.os.characters.get(msg.id)
  if (ch) {
    ch.level = msg.level
  }
  // 更新 React state
  ctx.setAgentGrowthData((prev) => ({
    ...prev,
    [msg.id]: { xp: msg.xp, level: msg.level, achievements: msg.achievements },
  }))
  // 新成就通知
  if (msg.newAchievements && msg.newAchievements.length > 0) {
    ctx.setPendingAchievementToasts((prev) => [...prev, ...msg.newAchievements])
  }
}

function handleFloorSwitched(msg: ServerMessage & { type: 'floorSwitched' }, ctx: HandlerContext): void {
  ctx.setCurrentFloorId(msg.floorId)
  // 清空當前代理相關狀態，新樓層的資料會隨 existingAgents + layoutLoaded 到來
  ctx.setAgents([])
  ctx.setAgentTools({})
  ctx.setAgentStatuses({})
  ctx.setAgentModels({})
  ctx.setSubagentTools({})
  ctx.setSubagentCharacters([])
  ctx.setAgentProjects({})
  ctx.setRemoteAgents({})
  ctx.setAgentTranscripts({})
  ctx.setAgentGitBranches({})
  ctx.setAgentStatusHistory({})
  ctx.setAgentTeams({})
  ctx.setAgentCliTypes({})
  ctx.setAgentStartTimes({})
  ctx.os.clearAllAgents()
  ctx.layoutReadyRef.current = false
  ctx.setLayoutReady(false)
  ctx.setChatMessages([])
}

// ── Handler 查找表 ──────────────────────────────────────────────

type HandlerFn = (msg: never, ctx: HandlerContext) => void

const messageHandlers: Record<string, HandlerFn> = {
  layoutLoaded: handleLayoutLoaded as HandlerFn,
  agentCreated: handleAgentCreated as HandlerFn,
  agentClosed: handleAgentClosed as HandlerFn,
  existingAgents: handleExistingAgents as HandlerFn,
  agentToolStart: handleAgentToolStart as HandlerFn,
  agentToolDone: handleAgentToolDone as HandlerFn,
  agentToolsClear: handleAgentToolsClear as HandlerFn,
  agentSelected: handleAgentSelected as HandlerFn,
  agentStatus: handleAgentStatus as HandlerFn,
  agentToolPermission: handleAgentToolPermission as HandlerFn,
  agentToolPermissionClear: handleAgentToolPermissionClear as HandlerFn,
  subagentToolPermission: handleSubagentToolPermission as HandlerFn,
  subagentToolStart: handleSubagentToolStart as HandlerFn,
  subagentToolDone: handleSubagentToolDone as HandlerFn,
  subagentClear: handleSubagentClear as HandlerFn,
  agentEmote: handleAgentEmote as HandlerFn,
  agentThinking: handleAgentThinking as HandlerFn,
  agentDetached: handleAgentDetached as HandlerFn,
  agentModel: handleAgentModel as HandlerFn,
  characterSpritesLoaded: handleCharacterSpritesLoaded as HandlerFn,
  floorTilesLoaded: handleFloorTilesLoaded as HandlerFn,
  wallTilesLoaded: handleWallTilesLoaded as HandlerFn,
  settingsLoaded: handleSettingsLoaded as HandlerFn,
  furnitureAssetsLoaded: handleFurnitureAssetsLoaded as HandlerFn,
  agentTranscript: handleAgentTranscript as HandlerFn,
  projectNameUpdated: handleProjectNameUpdated as HandlerFn,
  excludedProjectsUpdated: handleExcludedProjectsUpdated as HandlerFn,
  projectDirsList: handleProjectDirsList as HandlerFn,
  buildingConfig: handleBuildingConfig as HandlerFn,
  floorSwitched: handleFloorSwitched as HandlerFn,
  floorSummaries: handleFloorSummaries as HandlerFn,
  chatMessage: handleChatMessage as HandlerFn,
  chatHistory: handleChatHistory as HandlerFn,
  agentFloorTransfer: handleAgentFloorTransfer as HandlerFn,
  agentGitBranch: handleAgentGitBranch as HandlerFn,
  statusHistory: handleStatusHistory as HandlerFn,
  agentTeam: handleAgentTeam as HandlerFn,
  lanPeers: handleLanPeers as HandlerFn,
  behaviorSettingsLoaded: handleBehaviorSettingsLoaded as HandlerFn,
  agentGrowth: handleAgentGrowth as HandlerFn,
  nodeHealth: handleNodeHealth as HandlerFn,
  permissionDenied: handlePermissionDenied as HandlerFn,
}

// ── Hook ────────────────────────────────────────────────────────

export function useExtensionMessages(
  getOfficeState: () => OfficeState,
  onLayoutLoaded?: (layout: OfficeLayout) => void,
  isEditDirty?: () => boolean,
  onZoomLoaded?: (zoom: number) => void,
  onUiScaleLoaded?: (scale: number) => void,
): ExtensionMessageState {
  const [agents, setAgents] = useState<number[]>([])
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null)
  const [agentTools, setAgentTools] = useState<Record<number, ToolActivity[]>>({})
  const [agentStatuses, setAgentStatuses] = useState<Record<number, string>>({})
  const [agentModels, setAgentModels] = useState<Record<number, string>>({})
  const [subagentTools, setSubagentTools] = useState<Record<number, Record<string, ToolActivity[]>>>({})
  const [subagentCharacters, setSubagentCharacters] = useState<SubagentCharacter[]>([])
  const [layoutReady, setLayoutReady] = useState(false)
  const [loadedAssets, setLoadedAssets] = useState<{ catalog: FurnitureAsset[]; sprites: Record<string, string[][]> } | undefined>()
  const [agentProjects, setAgentProjects] = useState<Record<number, string>>({})
  const [remoteAgents, setRemoteAgents] = useState<Record<number, { owner: string }>>({})
  const [agentTranscripts, setAgentTranscripts] = useState<Record<number, TranscriptEntry[]>>({})
  const [excludedProjects, setExcludedProjects] = useState<string[]>([])
  const [projectDirs, setProjectDirs] = useState<{ name: string; excluded: boolean }[]>([])
  const [currentFloorId, setCurrentFloorId] = useState<string | null>(null)
  const [building, setBuilding] = useState<BuildingConfig | null>(null)
  const [floorSummaries, setFloorSummaries] = useState<Record<string, number>>({})
  const [chatMessages, setChatMessages] = useState<Array<{ nickname: string; text: string; ts: number }>>([])
  const [agentGitBranches, setAgentGitBranches] = useState<Record<number, string>>({})
  const [agentStatusHistory, setAgentStatusHistory] = useState<Record<number, Array<{ ts: number; status: string; detail?: string }>>>({})
  const [agentTeams, setAgentTeams] = useState<Record<number, string>>({})
  const [agentCliTypes, setAgentCliTypes] = useState<Record<number, string>>({})
  const [lanPeers, setLanPeers] = useState<Array<{ name: string; host: string; port: number; agentCount: number }>>([])
  const [agentGrowthData, setAgentGrowthData] = useState<Record<number, { xp: number; level: number; achievements: string[] }>>({})
  const [agentStartTimes, setAgentStartTimes] = useState<Record<number, number>>({})
  const [nodeHealthNodes, setNodeHealthNodes] = useState<ConnectedNodeInfo[]>([])
  const [pendingAchievementToasts, setPendingAchievementToasts] = useState<string[]>([])

  const dismissAchievementToast = useCallback(() => {
    setPendingAchievementToasts((prev) => prev.slice(1))
  }, [])

  const layoutReadyRef = useRef(false)
  const pendingAgentsRef = useRef<Array<{ id: number; palette?: number; hueShift?: number; seatId?: string }>>([])

  useEffect(() => {
    const ctx: HandlerContext = {
      os: getOfficeState(),
      layoutReadyRef,
      pendingAgentsRef,
      isEditDirty,
      onLayoutLoaded,
      onZoomLoaded,
      onUiScaleLoaded,
      setAgents,
      setSelectedAgent,
      setAgentTools,
      setAgentStatuses,
      setAgentModels,
      setSubagentTools,
      setSubagentCharacters,
      setLayoutReady,
      setLoadedAssets,
      setAgentProjects,
      setRemoteAgents,
      setAgentTranscripts,
      setExcludedProjects,
      setProjectDirs,
      setCurrentFloorId,
      setBuilding,
      setFloorSummaries,
      setChatMessages,
      setAgentGitBranches,
      setAgentStatusHistory,
      setAgentTeams,
      setAgentCliTypes,
      setLanPeers,
      setAgentGrowthData,
      setAgentStartTimes,
      setNodeHealthNodes,
      setPendingAchievementToasts,
    }

    const handler = (data: unknown) => {
      const msg = data as ServerMessage
      // 每次呼叫確保 os 為最新
      ctx.os = getOfficeState()
      const fn = messageHandlers[msg.type]
      if (fn) fn(msg as never, ctx)
    }

    const unsub = onServerMessage(handler)
    vscode.postMessage({ type: 'webviewReady' })
    return unsub
  }, [getOfficeState])

  return { agents, selectedAgent, agentTools, agentStatuses, agentModels, subagentTools, subagentCharacters, layoutReady, loadedAssets, agentProjects, remoteAgents, agentTranscripts, excludedProjects, projectDirs, currentFloorId, building, floorSummaries, chatMessages, agentGitBranches, agentStatusHistory, agentTeams, agentCliTypes, lanPeers, agentGrowthData, agentStartTimes, nodeHealthNodes, pendingAchievementToasts, dismissAchievementToast }
}
