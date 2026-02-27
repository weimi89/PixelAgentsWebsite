import { useState, useEffect, useRef } from 'react'
import type { OfficeState } from '../office/engine/officeState.js'
import type { OfficeLayout, ToolActivity } from '../office/types.js'
import type { ServerMessage } from '../types/messages.js'
import { extractToolName } from '../office/toolUtils.js'
import { migrateLayoutColors } from '../office/layout/layoutSerializer.js'
import { buildDynamicCatalog } from '../office/layout/furnitureCatalog.js'
import { setFloorSprites } from '../office/floorTiles.js'
import { setWallSprites } from '../office/wallTiles.js'
import { setCharacterTemplates } from '../office/sprites/spriteData.js'
import { vscode, onServerMessage } from '../socketApi.js'
import { playDoneSound, setSoundEnabled } from '../notificationSound.js'

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
}

function saveAgentSeats(os: OfficeState): void {
  const seats: Record<number, { palette: number; hueShift: number; seatId: string | null }> = {}
  for (const ch of os.characters.values()) {
    if (ch.isSubagent) continue
    seats[ch.id] = { palette: ch.palette, hueShift: ch.hueShift, seatId: ch.seatId }
  }
  vscode.postMessage({ type: 'saveAgentSeats', seats })
}

export function useExtensionMessages(
  getOfficeState: () => OfficeState,
  onLayoutLoaded?: (layout: OfficeLayout) => void,
  isEditDirty?: () => boolean,
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

  const layoutReadyRef = useRef(false)
  const pendingAgentsRef = useRef<Array<{ id: number; palette?: number; hueShift?: number; seatId?: string }>>([])

  useEffect(() => {
    const handler = (data: unknown) => {
      const msg = data as ServerMessage
      const os = getOfficeState()

      if (msg.type === 'layoutLoaded') {
        if (layoutReadyRef.current && isEditDirty?.()) {
          console.log('[Webview] 跳過外部佈局更新 — 編輯器有未儲存的變更')
          return
        }
        const rawLayout = msg.layout
        const layout = rawLayout && rawLayout.version === 1 ? migrateLayoutColors(rawLayout) : null
        if (layout) {
          os.rebuildFromLayout(layout)
          onLayoutLoaded?.(layout)
        } else {
          onLayoutLoaded?.(os.getLayout())
        }
        for (const p of pendingAgentsRef.current) {
          os.addAgent(p.id, p.palette, p.hueShift, p.seatId, true)
        }
        pendingAgentsRef.current = []
        layoutReadyRef.current = true
        setLayoutReady(true)
        if (os.characters.size > 0) {
          saveAgentSeats(os)
        }
      } else if (msg.type === 'agentCreated') {
        const { id, isExternal, projectName } = msg
        setAgents((prev) => (prev.includes(id) ? prev : [...prev, id]))
        setSelectedAgent(id)
        if (isExternal && projectName) {
          setAgentProjects((prev) => ({ ...prev, [id]: projectName }))
        }
        os.addAgent(id)
        saveAgentSeats(os)
      } else if (msg.type === 'agentClosed') {
        const { id } = msg
        setAgents((prev) => prev.filter((a) => a !== id))
        setSelectedAgent((prev) => (prev === id ? null : prev))
        setAgentTools((prev) => {
          if (!(id in prev)) return prev
          const next = { ...prev }
          delete next[id]
          return next
        })
        setAgentStatuses((prev) => {
          if (!(id in prev)) return prev
          const next = { ...prev }
          delete next[id]
          return next
        })
        setAgentModels((prev) => {
          if (!(id in prev)) return prev
          const next = { ...prev }
          delete next[id]
          return next
        })
        setAgentProjects((prev) => {
          if (!(id in prev)) return prev
          const next = { ...prev }
          delete next[id]
          return next
        })
        setSubagentTools((prev) => {
          if (!(id in prev)) return prev
          const next = { ...prev }
          delete next[id]
          return next
        })
        os.removeAllSubagents(id)
        setSubagentCharacters((prev) => prev.filter((s) => s.parentAgentId !== id))
        os.removeAgent(id)
      } else if (msg.type === 'existingAgents') {
        const incoming = msg.agents
        const meta = msg.agentMeta || ({} as Record<number, { palette?: number; hueShift?: number; seatId?: string; isExternal?: boolean; projectName?: string }>)
        const newProjects: Record<number, string> = {}
        for (const id of incoming) {
          const m = meta[id]
          if (m?.isExternal && m.projectName) {
            newProjects[id] = m.projectName
          }
          if (layoutReadyRef.current) {
            os.addAgent(id, m?.palette, m?.hueShift, m?.seatId, true)
          } else {
            pendingAgentsRef.current.push({ id, palette: m?.palette, hueShift: m?.hueShift, seatId: m?.seatId })
          }
        }
        if (Object.keys(newProjects).length > 0) {
          setAgentProjects((prev) => ({ ...prev, ...newProjects }))
        }
        if (layoutReadyRef.current && incoming.length > 0) {
          saveAgentSeats(os)
        }
        setAgents((prev) => {
          const ids = new Set(prev)
          const merged = [...prev]
          for (const id of incoming) {
            if (!ids.has(id)) {
              merged.push(id)
            }
          }
          return merged.sort((a, b) => a - b)
        })
      } else if (msg.type === 'agentToolStart') {
        const { id, toolId, status } = msg
        setAgentTools((prev) => {
          const list = prev[id] || []
          if (list.some((t) => t.toolId === toolId)) return prev
          return { ...prev, [id]: [...list, { toolId, status, done: false }] }
        })
        const toolName = extractToolName(status)
        os.setAgentTool(id, toolName)
        os.setAgentActive(id, true)
        os.clearPermissionBubble(id)
        if (status.startsWith('Subtask:')) {
          const label = status.slice('Subtask:'.length).trim()
          const subId = os.addSubagent(id, toolId)
          setSubagentCharacters((prev) => {
            if (prev.some((s) => s.id === subId)) return prev
            return [...prev, { id: subId, parentAgentId: id, parentToolId: toolId, label }]
          })
        }
      } else if (msg.type === 'agentToolDone') {
        const { id, toolId } = msg
        setAgentTools((prev) => {
          const list = prev[id]
          if (!list) return prev
          return {
            ...prev,
            [id]: list.map((t) => (t.toolId === toolId ? { ...t, done: true } : t)),
          }
        })
      } else if (msg.type === 'agentToolsClear') {
        const { id } = msg
        setAgentTools((prev) => {
          if (!(id in prev)) return prev
          const next = { ...prev }
          delete next[id]
          return next
        })
        setSubagentTools((prev) => {
          if (!(id in prev)) return prev
          const next = { ...prev }
          delete next[id]
          return next
        })
        os.removeAllSubagents(id)
        setSubagentCharacters((prev) => prev.filter((s) => s.parentAgentId !== id))
        os.setAgentTool(id, null)
        os.clearPermissionBubble(id)
      } else if (msg.type === 'agentSelected') {
        const { id } = msg
        setSelectedAgent(id)
      } else if (msg.type === 'agentStatus') {
        const { id, status } = msg
        setAgentStatuses((prev) => {
          if (status === 'active') {
            if (!(id in prev)) return prev
            const next = { ...prev }
            delete next[id]
            return next
          }
          return { ...prev, [id]: status }
        })
        os.setAgentActive(id, status === 'active')
        if (status === 'waiting') {
          os.showWaitingBubble(id)
          playDoneSound()
        }
      } else if (msg.type === 'agentToolPermission') {
        const { id } = msg
        setAgentTools((prev) => {
          const list = prev[id]
          if (!list) return prev
          return {
            ...prev,
            [id]: list.map((t) => (t.done ? t : { ...t, permissionWait: true })),
          }
        })
        os.showPermissionBubble(id)
      } else if (msg.type === 'subagentToolPermission') {
        const { id, parentToolId } = msg
        const subId = os.getSubagentId(id, parentToolId)
        if (subId !== null) {
          os.showPermissionBubble(subId)
        }
      } else if (msg.type === 'agentToolPermissionClear') {
        const { id } = msg
        setAgentTools((prev) => {
          const list = prev[id]
          if (!list) return prev
          const hasPermission = list.some((t) => t.permissionWait)
          if (!hasPermission) return prev
          return {
            ...prev,
            [id]: list.map((t) => (t.permissionWait ? { ...t, permissionWait: false } : t)),
          }
        })
        os.clearPermissionBubble(id)
        for (const [subId, meta] of os.subagentMeta) {
          if (meta.parentAgentId === id) {
            os.clearPermissionBubble(subId)
          }
        }
      } else if (msg.type === 'subagentToolStart') {
        const { id, parentToolId, toolId, status } = msg
        setSubagentTools((prev) => {
          const agentSubs = prev[id] || {}
          const list = agentSubs[parentToolId] || []
          if (list.some((t) => t.toolId === toolId)) return prev
          return { ...prev, [id]: { ...agentSubs, [parentToolId]: [...list, { toolId, status, done: false }] } }
        })
        const subId = os.getSubagentId(id, parentToolId)
        if (subId !== null) {
          const subToolName = extractToolName(status)
          os.setAgentTool(subId, subToolName)
          os.setAgentActive(subId, true)
        }
      } else if (msg.type === 'subagentToolDone') {
        const { id, parentToolId, toolId } = msg
        setSubagentTools((prev) => {
          const agentSubs = prev[id]
          if (!agentSubs) return prev
          const list = agentSubs[parentToolId]
          if (!list) return prev
          return {
            ...prev,
            [id]: { ...agentSubs, [parentToolId]: list.map((t) => (t.toolId === toolId ? { ...t, done: true } : t)) },
          }
        })
      } else if (msg.type === 'subagentClear') {
        const { id, parentToolId } = msg
        setSubagentTools((prev) => {
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
        os.removeSubagent(id, parentToolId)
        setSubagentCharacters((prev) => prev.filter((s) => !(s.parentAgentId === id && s.parentToolId === parentToolId)))
      } else if (msg.type === 'agentThinking') {
        const { id, thinking } = msg
        os.setAgentThinking(id, thinking)
      } else if (msg.type === 'agentDetached') {
        const { id, detached } = msg
        os.setAgentDetached(id, detached)
      } else if (msg.type === 'agentModel') {
        const { id, model } = msg
        setAgentModels((prev) => {
          if (prev[id] === model) return prev
          return { ...prev, [id]: model }
        })
      } else if (msg.type === 'characterSpritesLoaded') {
        const { characters } = msg
        console.log(`[Webview] 收到 ${characters.length} 個預著色角色精靈圖`)
        setCharacterTemplates(characters)
      } else if (msg.type === 'floorTilesLoaded') {
        const { sprites } = msg
        console.log(`[Webview] 收到 ${sprites.length} 個地板花紋`)
        setFloorSprites(sprites)
      } else if (msg.type === 'wallTilesLoaded') {
        const { sprites } = msg
        console.log(`[Webview] 收到 ${sprites.length} 個牆磚精靈圖`)
        setWallSprites(sprites)
      } else if (msg.type === 'settingsLoaded') {
        setSoundEnabled(msg.soundEnabled)
      } else if (msg.type === 'furnitureAssetsLoaded') {
        try {
          const { catalog, sprites } = msg
          console.log(`Webview: 載入了 ${catalog.length} 個家具素材`)
          buildDynamicCatalog({ catalog, sprites })
          setLoadedAssets({ catalog, sprites })
        } catch (err) {
          console.error(`Webview: 處理 furnitureAssetsLoaded 時發生錯誤:`, err)
        }
      }
    }

    const unsub = onServerMessage(handler)
    vscode.postMessage({ type: 'webviewReady' })
    return unsub
  }, [getOfficeState])

  return { agents, selectedAgent, agentTools, agentStatuses, agentModels, subagentTools, subagentCharacters, layoutReady, loadedAssets, agentProjects }
}
