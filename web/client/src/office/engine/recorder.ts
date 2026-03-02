import type { OfficeState } from './officeState.js'
import type { Character, CharacterState, Direction, EmoteType } from '../types.js'
import {
  RECORDING_FPS,
  RECORDING_KEYFRAME_INTERVAL_FRAMES,
  RECORDING_MAX_DURATION_SEC,
} from '../../constants.js'

// ── 型別定義 ──────────────────────────────────────────────────

export interface CharacterSnapshot {
  state: CharacterState
  dir: Direction
  x: number
  y: number
  tileCol: number
  tileRow: number
  frame: number
  moveProgress: number
  isActive: boolean
  isSubagent: boolean
  isRemote: boolean
  isDetached: boolean
  isThinking: boolean
  palette: number
  hueShift: number
  seatId: string | null
  bubbleType: 'permission' | 'waiting' | 'detached' | null
  emoteType: EmoteType | null
  emoteTimer: number
  matrixEffect: 'spawn' | 'despawn' | null
  matrixEffectTimer: number
  matrixEffectSeeds: number[]
  currentTool: string | null
  level: number
  teamName: string | null
  teamColor: string | null
  parentAgentId: number | null
}

export interface CharacterDiff {
  id: number
  op: 'add' | 'remove' | 'update'
  snapshot?: CharacterSnapshot
  fields?: Partial<CharacterSnapshot>
}

export interface RecordingFrame {
  t: number
  diffs: CharacterDiff[]
  isKeyframe?: boolean
}

export interface RecordingMeta {
  id: string
  name: string
  createdAt: number
  durationSec: number
  frameCount: number
}

export type RecordingState = 'idle' | 'recording' | 'playing'

// ── 快照鍵清單（用於差分比較，排除陣列欄位） ─────────────────

const SNAPSHOT_KEYS: Array<keyof CharacterSnapshot> = [
  'state', 'dir', 'x', 'y', 'tileCol', 'tileRow', 'frame', 'moveProgress',
  'isActive', 'isSubagent', 'isRemote', 'isDetached', 'isThinking',
  'palette', 'hueShift', 'seatId', 'bubbleType', 'emoteType', 'emoteTimer',
  'matrixEffect', 'matrixEffectTimer', 'currentTool', 'level',
  'teamName', 'teamColor', 'parentAgentId',
]

// ── 工具函式 ──────────────────────────────────────────────────

function takeSnapshot(ch: Character): CharacterSnapshot {
  return {
    state: ch.state,
    dir: ch.dir,
    x: ch.x,
    y: ch.y,
    tileCol: ch.tileCol,
    tileRow: ch.tileRow,
    frame: ch.frame,
    moveProgress: ch.moveProgress,
    isActive: ch.isActive,
    isSubagent: ch.isSubagent,
    isRemote: ch.isRemote,
    isDetached: ch.isDetached,
    isThinking: ch.isThinking,
    palette: ch.palette,
    hueShift: ch.hueShift,
    seatId: ch.seatId,
    bubbleType: ch.bubbleType,
    emoteType: ch.emoteType,
    emoteTimer: ch.emoteTimer,
    matrixEffect: ch.matrixEffect,
    matrixEffectTimer: ch.matrixEffectTimer,
    matrixEffectSeeds: [...ch.matrixEffectSeeds],
    currentTool: ch.currentTool,
    level: ch.level,
    teamName: ch.teamName,
    teamColor: ch.teamColor,
    parentAgentId: ch.parentAgentId,
  }
}

function diffSnapshots(prev: CharacterSnapshot, curr: CharacterSnapshot): Partial<CharacterSnapshot> | null {
  const changed: Record<string, unknown> = {}
  let hasChange = false
  for (const key of SNAPSHOT_KEYS) {
    if (prev[key] !== curr[key]) {
      changed[key] = curr[key]
      hasChange = true
    }
  }
  // matrixEffectSeeds 為陣列，需特殊比較
  if (
    prev.matrixEffectSeeds.length !== curr.matrixEffectSeeds.length ||
    prev.matrixEffectSeeds.some((v, i) => v !== curr.matrixEffectSeeds[i])
  ) {
    changed.matrixEffectSeeds = [...curr.matrixEffectSeeds]
    hasChange = true
  }
  return hasChange ? (changed as Partial<CharacterSnapshot>) : null
}

function applySnapshot(ch: Character, snap: CharacterSnapshot): void {
  ch.state = snap.state
  ch.dir = snap.dir
  ch.x = snap.x
  ch.y = snap.y
  ch.tileCol = snap.tileCol
  ch.tileRow = snap.tileRow
  ch.frame = snap.frame
  ch.moveProgress = snap.moveProgress
  ch.isActive = snap.isActive
  ch.isSubagent = snap.isSubagent
  ch.isRemote = snap.isRemote
  ch.isDetached = snap.isDetached
  ch.isThinking = snap.isThinking
  ch.palette = snap.palette
  ch.hueShift = snap.hueShift
  ch.seatId = snap.seatId
  ch.bubbleType = snap.bubbleType
  ch.emoteType = snap.emoteType
  ch.emoteTimer = snap.emoteTimer
  ch.matrixEffect = snap.matrixEffect
  ch.matrixEffectTimer = snap.matrixEffectTimer
  ch.matrixEffectSeeds = [...snap.matrixEffectSeeds]
  ch.currentTool = snap.currentTool
  ch.level = snap.level
  ch.teamName = snap.teamName
  ch.teamColor = snap.teamColor
  ch.parentAgentId = snap.parentAgentId
}

function applyDiff(ch: Character, fields: Partial<CharacterSnapshot>): void {
  const target = ch as unknown as Record<string, unknown>
  for (const key of Object.keys(fields) as Array<keyof CharacterSnapshot>) {
    if (key === 'matrixEffectSeeds') {
      ch.matrixEffectSeeds = [...(fields.matrixEffectSeeds!)]
    } else {
      target[key] = fields[key]
    }
  }
}

/** 建立回放用的最小 Character（視覺欄位由快照填入） */
function createPlaybackCharacter(id: number): Character {
  return {
    id,
    state: 'idle' as CharacterState,
    dir: 0 as Direction,
    x: 0, y: 0, tileCol: 0, tileRow: 0,
    path: [],
    moveProgress: 0,
    currentTool: null,
    palette: 0,
    hueShift: 0,
    frame: 0,
    frameTimer: 0,
    wanderTimer: 0,
    wanderCount: 0,
    wanderLimit: 3,
    isActive: false,
    seatId: null,
    isDetached: false,
    bubbleType: null,
    bubbleTimer: 0,
    seatTimer: 0,
    emoteType: null,
    emoteTimer: 0,
    isSubagent: false,
    isRemote: false,
    parentAgentId: null,
    matrixEffect: null,
    matrixEffectTimer: 0,
    matrixEffectSeeds: [],
    isThinking: false,
    sitTimer: 0,
    sleepTimer: 0,
    chatPartnerId: null,
    interactTarget: null,
    thinkPath: [],
    thinkForward: false,
    behaviorTimer: 0,
    meetingTableUid: null,
    transferTargetFloor: null,
    teamName: null,
    teamColor: null,
    recentFurnitureVisits: new Map(),
    gameTime: 0,
    level: 1,
  }
}

// ── Recorder 類別 ──────────────────────────────────────────────

export class Recorder {
  state: RecordingState = 'idle'

  // 錄製狀態
  private frames: RecordingFrame[] = []
  private prevSnapshots: Map<number, CharacterSnapshot> = new Map()
  private recordStartTime = 0
  private lastRecordTime = 0
  private readonly frameInterval = 1 / RECORDING_FPS
  private keyframeCounter = 0

  // 回放狀態
  private playbackFrames: RecordingFrame[] = []
  private playbackIndex = 0
  private playbackTime = 0
  private playbackDuration = 0
  private savedCharacters: Map<number, Character> | null = null

  // 回調
  onStateChange?: (state: RecordingState) => void
  onPlaybackProgress?: (progress: number) => void
  onRecordingTick?: (durationSec: number) => void

  // ── 錄製 API ──────────────────────────────────────────────

  startRecording(): void {
    if (this.state !== 'idle') return
    this.state = 'recording'
    this.frames = []
    this.prevSnapshots.clear()
    this.recordStartTime = 0
    this.lastRecordTime = 0
    this.keyframeCounter = 0
    this.onStateChange?.('recording')
  }

  stopRecording(): { meta: RecordingMeta; frames: RecordingFrame[] } | null {
    if (this.state !== 'recording') return null
    this.state = 'idle'
    this.onStateChange?.('idle')

    if (this.frames.length === 0) return null

    const lastFrame = this.frames[this.frames.length - 1]
    const meta: RecordingMeta = {
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: new Date().toLocaleString('zh-TW'),
      createdAt: Date.now(),
      durationSec: lastFrame.t,
      frameCount: this.frames.length,
    }

    const result = { meta, frames: [...this.frames] }
    this.frames = []
    this.prevSnapshots.clear()
    return result
  }

  /** 在 officeState.update(dt) 之後呼叫 */
  recordTick(gameTime: number, os: OfficeState): void {
    if (this.state !== 'recording') return

    // 初始化起始時間
    if (this.recordStartTime === 0) {
      this.recordStartTime = gameTime
      this.lastRecordTime = gameTime
    }

    // 降頻至目標 FPS
    const elapsed = gameTime - this.lastRecordTime
    if (elapsed < this.frameInterval) return
    this.lastRecordTime = gameTime

    // 最大錄製時長
    const t = gameTime - this.recordStartTime
    if (t >= RECORDING_MAX_DURATION_SEC) {
      this.stopRecording()
      return
    }

    // 是否為 keyframe
    const isKeyframe = this.keyframeCounter % RECORDING_KEYFRAME_INTERVAL_FRAMES === 0
    this.keyframeCounter++

    // 建構差分
    const diffs: CharacterDiff[] = []
    const currentIds = new Set<number>()

    for (const ch of os.characters.values()) {
      currentIds.add(ch.id)
      const snap = takeSnapshot(ch)
      const prev = this.prevSnapshots.get(ch.id)

      if (!prev || isKeyframe) {
        diffs.push({ id: ch.id, op: 'add', snapshot: snap })
      } else {
        const fields = diffSnapshots(prev, snap)
        if (fields) {
          diffs.push({ id: ch.id, op: 'update', fields })
        }
      }
      this.prevSnapshots.set(ch.id, snap)
    }

    // 移除已消失的角色
    for (const [id] of this.prevSnapshots) {
      if (!currentIds.has(id)) {
        diffs.push({ id, op: 'remove' })
        this.prevSnapshots.delete(id)
      }
    }

    if (diffs.length > 0 || isKeyframe) {
      this.frames.push({ t, diffs, isKeyframe: isKeyframe || undefined })
    }

    this.onRecordingTick?.(t)
  }

  // ── 回放 API ──────────────────────────────────────────────

  startPlayback(frames: RecordingFrame[], os: OfficeState): void {
    if (this.state !== 'idle' || frames.length === 0) return

    this.state = 'playing'
    this.playbackFrames = frames
    this.playbackIndex = 0
    this.playbackTime = 0
    this.playbackDuration = frames[frames.length - 1].t

    // 保存當前角色狀態以便恢復
    this.savedCharacters = new Map()
    for (const [id, ch] of os.characters) {
      this.savedCharacters.set(id, {
        ...ch,
        path: [...ch.path],
        matrixEffectSeeds: [...ch.matrixEffectSeeds],
        thinkPath: [...ch.thinkPath],
        recentFurnitureVisits: new Map(ch.recentFurnitureVisits),
      })
    }
    os.characters.clear()

    this.onStateChange?.('playing')
  }

  stopPlayback(os: OfficeState): void {
    if (this.state !== 'playing') return

    this.state = 'idle'
    os.characters.clear()
    if (this.savedCharacters) {
      for (const [id, ch] of this.savedCharacters) {
        os.characters.set(id, ch)
      }
      this.savedCharacters = null
    }

    this.playbackFrames = []
    this.playbackIndex = 0
    this.onStateChange?.('idle')
    this.onPlaybackProgress?.(0)
  }

  /** 替代 officeState.update() 使用 */
  playbackTick(dt: number, os: OfficeState): void {
    if (this.state !== 'playing') return

    this.playbackTime += dt
    if (this.playbackTime >= this.playbackDuration) {
      // 循環回放
      this.playbackTime = 0
      this.playbackIndex = 0
      os.characters.clear()
    }

    this.applyFramesUpTo(this.playbackTime, os)

    const progress = this.playbackDuration > 0 ? this.playbackTime / this.playbackDuration : 0
    this.onPlaybackProgress?.(progress)
  }

  seekTo(progress: number, os: OfficeState): void {
    if (this.state !== 'playing') return

    const targetTime = Math.max(0, Math.min(1, progress)) * this.playbackDuration

    // 找到最近的前一個 keyframe
    let keyframeIndex = 0
    for (let i = 0; i < this.playbackFrames.length; i++) {
      if (this.playbackFrames[i].t > targetTime) break
      if (this.playbackFrames[i].isKeyframe) keyframeIndex = i
    }

    os.characters.clear()
    this.playbackIndex = keyframeIndex
    this.playbackTime = this.playbackFrames[keyframeIndex]?.t ?? 0

    this.applyFramesUpTo(targetTime, os)
    this.playbackTime = targetTime
    this.onPlaybackProgress?.(progress)
  }

  get duration(): number {
    return this.playbackDuration
  }

  get currentTime(): number {
    return this.playbackTime
  }

  // ── 內部 ──────────────────────────────────────────────────

  private applyFramesUpTo(targetTime: number, os: OfficeState): void {
    while (
      this.playbackIndex < this.playbackFrames.length &&
      this.playbackFrames[this.playbackIndex].t <= targetTime
    ) {
      const frame = this.playbackFrames[this.playbackIndex]
      this.applyFrame(frame, os)
      this.playbackIndex++
    }
  }

  private applyFrame(frame: RecordingFrame, os: OfficeState): void {
    if (frame.isKeyframe) {
      // Keyframe: 移除不在 diffs 中的角色
      const addedIds = new Set(frame.diffs.filter(d => d.op === 'add').map(d => d.id))
      for (const id of os.characters.keys()) {
        if (!addedIds.has(id)) {
          os.characters.delete(id)
        }
      }
    }

    for (const diff of frame.diffs) {
      if (diff.op === 'add' && diff.snapshot) {
        let ch = os.characters.get(diff.id)
        if (!ch) {
          ch = createPlaybackCharacter(diff.id)
          os.characters.set(diff.id, ch)
        }
        applySnapshot(ch, diff.snapshot)
      } else if (diff.op === 'update' && diff.fields) {
        const ch = os.characters.get(diff.id)
        if (ch) applyDiff(ch, diff.fields)
      } else if (diff.op === 'remove') {
        os.characters.delete(diff.id)
      }
    }
  }
}
