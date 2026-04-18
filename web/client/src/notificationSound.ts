import {
  NOTIFICATION_NOTE_1_HZ,
  NOTIFICATION_NOTE_2_HZ,
  NOTIFICATION_NOTE_1_START_SEC,
  NOTIFICATION_NOTE_2_START_SEC,
  NOTIFICATION_NOTE_DURATION_SEC,
  NOTIFICATION_VOLUME,
  PERMISSION_NOTE_1_HZ,
  PERMISSION_NOTE_2_HZ,
  TURN_COMPLETE_NOTE_HZ,
} from './constants.js'

export interface SoundConfig {
  master: boolean
  waiting: boolean
  permission: boolean
  turnComplete: boolean
}

const DEFAULT_SOUND_CONFIG: SoundConfig = {
  master: true,
  waiting: true,
  permission: true,
  turnComplete: true,
}

let soundConfig: SoundConfig = { ...DEFAULT_SOUND_CONFIG }
let audioCtx: AudioContext | null = null

/** 當 master 關閉時暫停（非銷毀）AudioContext — 釋放音訊硬體資源 */
function applyMasterState(): void {
  if (!audioCtx) return
  if (!soundConfig.master && audioCtx.state === 'running') {
    audioCtx.suspend().catch(() => { /* ignore */ })
  }
}

export function setSoundConfig(config: Partial<SoundConfig>): void {
  soundConfig = { ...soundConfig, ...config }
  applyMasterState()
}

export function getSoundConfig(): SoundConfig {
  return soundConfig
}

/** 向後相容：舊 soundEnabled boolean 轉為新格式 */
export function setSoundEnabled(enabled: boolean): void {
  soundConfig.master = enabled
  applyMasterState()
}

export function isSoundEnabled(): boolean {
  return soundConfig.master
}

/** 完全釋放 AudioContext（例如頁面卸載時）。下次播放會重新建立。 */
export function closeAudio(): void {
  if (!audioCtx) return
  try {
    audioCtx.close().catch(() => { /* ignore */ })
  } catch {
    // 某些瀏覽器 close() 為同步
  }
  audioCtx = null
}

function playNote(ctx: AudioContext, freq: number, startOffset: number, volume = NOTIFICATION_VOLUME, duration = NOTIFICATION_NOTE_DURATION_SEC): void {
  const t = ctx.currentTime + startOffset
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, t)

  gain.gain.setValueAtTime(volume, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(t)
  osc.stop(t + duration)
}

async function ensureAudioCtx(): Promise<AudioContext | null> {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    if (audioCtx.state === 'suspended') await audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

/** 等待音效（上行雙音 E5 → E6）— 等待氣泡出現時播放 */
export async function playWaitingSound(): Promise<void> {
  if (!soundConfig.master || !soundConfig.waiting) return
  const ctx = await ensureAudioCtx()
  if (!ctx) return
  playNote(ctx, NOTIFICATION_NOTE_1_HZ, NOTIFICATION_NOTE_1_START_SEC)
  playNote(ctx, NOTIFICATION_NOTE_2_HZ, NOTIFICATION_NOTE_2_START_SEC)
}

/** 權限音效（下行雙音 D5 → A4）— 權限請求時播放 */
export async function playPermissionSound(): Promise<void> {
  if (!soundConfig.master || !soundConfig.permission) return
  const ctx = await ensureAudioCtx()
  if (!ctx) return
  playNote(ctx, PERMISSION_NOTE_1_HZ, 0)
  playNote(ctx, PERMISSION_NOTE_2_HZ, 0.12)
}

/** 回合完成音效（單音 G5）— 回合完成時播放 */
export async function playTurnCompleteSound(): Promise<void> {
  if (!soundConfig.master || !soundConfig.turnComplete) return
  const ctx = await ensureAudioCtx()
  if (!ctx) return
  playNote(ctx, TURN_COMPLETE_NOTE_HZ, 0, NOTIFICATION_VOLUME * 0.8, 0.12)
}

/** 向後相容別名 */
export const playDoneSound = playWaitingSound

/** 從任何使用者手勢處理器呼叫，以確保 AudioContext 已解鎖 */
export function unlockAudio(): void {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    if (audioCtx.state === 'suspended') audioCtx.resume()
  } catch {
    // 忽略
  }
}
