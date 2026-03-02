import type { RecordingMeta, RecordingFrame } from './recorder.js'

const DB_NAME = 'pixel-agents-recordings'
const DB_VERSION = 1
const META_STORE = 'recordings-meta'
const FRAMES_STORE = 'recordings-frames'

// ── IndexedDB 開啟 ──────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(FRAMES_STORE)) {
        db.createObjectStore(FRAMES_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = null
      reject(req.error)
    }
  })
  return dbPromise
}

// ── 公開 API ─────────────────────────────────────────────────

export async function saveRecording(meta: RecordingMeta, frames: RecordingFrame[]): Promise<void> {
  const db = await openDB()
  const tx = db.transaction([META_STORE, FRAMES_STORE], 'readwrite')
  tx.objectStore(META_STORE).put(meta)
  tx.objectStore(FRAMES_STORE).put(frames, meta.id)
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function listRecordings(): Promise<RecordingMeta[]> {
  const db = await openDB()
  const tx = db.transaction(META_STORE, 'readonly')
  const store = tx.objectStore(META_STORE)
  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => {
      const metas = req.result as RecordingMeta[]
      metas.sort((a, b) => b.createdAt - a.createdAt)
      resolve(metas)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function loadRecordingFrames(id: string): Promise<RecordingFrame[]> {
  const db = await openDB()
  const tx = db.transaction(FRAMES_STORE, 'readonly')
  const store = tx.objectStore(FRAMES_STORE)
  return new Promise((resolve, reject) => {
    const req = store.get(id)
    req.onsuccess = () => resolve((req.result as RecordingFrame[]) || [])
    req.onerror = () => reject(req.error)
  })
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction([META_STORE, FRAMES_STORE], 'readwrite')
  tx.objectStore(META_STORE).delete(id)
  tx.objectStore(FRAMES_STORE).delete(id)
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function exportRecording(id: string): Promise<string> {
  const db = await openDB()
  const tx = db.transaction([META_STORE, FRAMES_STORE], 'readonly')
  const metaReq = tx.objectStore(META_STORE).get(id)
  const framesReq = tx.objectStore(FRAMES_STORE).get(id)
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      resolve(JSON.stringify({ meta: metaReq.result, frames: framesReq.result }))
    }
    tx.onerror = () => reject(tx.error)
  })
}

export async function importRecording(json: string): Promise<RecordingMeta> {
  const data = JSON.parse(json) as { meta: RecordingMeta; frames: RecordingFrame[] }
  if (!data.meta?.id || !Array.isArray(data.frames)) {
    throw new Error('Invalid recording file')
  }
  // 產生新 ID 避免衝突
  data.meta.id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  await saveRecording(data.meta, data.frames)
  return data.meta
}
