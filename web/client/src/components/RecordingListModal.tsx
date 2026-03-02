import { useState, useEffect, useRef, memo } from 'react'
import { t } from '../i18n.js'
import type { RecordingMeta, RecordingFrame } from '../office/engine/recorder.js'
import { listRecordings, loadRecordingFrames, deleteRecording, exportRecording, importRecording } from '../office/engine/recordingStorage.js'

interface RecordingListModalProps {
  isOpen: boolean
  onClose: () => void
  onPlay: (frames: RecordingFrame[]) => void
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 'var(--pixel-modal-z)',
}

const panelStyle: React.CSSProperties = {
  background: 'var(--pixel-bg)',
  border: '2px solid var(--pixel-border)',
  borderRadius: 0,
  padding: 16,
  minWidth: 360,
  maxWidth: 480,
  maxHeight: '70vh',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  boxShadow: 'var(--pixel-shadow)',
}

const btnStyle: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: '20px',
  color: 'var(--pixel-text)',
  background: 'var(--pixel-btn-bg)',
  border: '2px solid transparent',
  borderRadius: 0,
  cursor: 'pointer',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '6px 8px',
  borderBottom: '1px solid var(--pixel-border)',
}

export const RecordingListModal = memo(function RecordingListModal({ isOpen, onClose, onPlay }: RecordingListModalProps) {
  const [recordings, setRecordings] = useState<RecordingMeta[]>([])
  const [loading, setLoading] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    listRecordings()
      .then(setRecordings)
      .catch(() => setRecordings([]))
      .finally(() => setLoading(false))
  }, [isOpen])

  if (!isOpen) return null

  const handlePlay = async (id: string) => {
    const frames = await loadRecordingFrames(id)
    if (frames.length > 0) {
      onClose()
      onPlay(frames)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteRecording(id)
    setRecordings(prev => prev.filter(r => r.id !== id))
  }

  const handleExport = async (id: string, name: string) => {
    const json = await exportRecording(id)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.replace(/[/\\:]/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const json = await file.text()
      const meta = await importRecording(json)
      setRecordings(prev => [meta, ...prev])
    } catch {
      // 靜默失敗（檔案格式錯誤）
    }
    if (importRef.current) importRef.current.value = ''
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '24px', color: 'var(--pixel-text)' }}>{t.recordingList}</span>
          <button style={btnStyle} onClick={onClose}>X</button>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button style={btnStyle} onClick={() => importRef.current?.click()}>
            {t.importRecording}
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <div style={{ color: 'var(--pixel-text-dim)', padding: 8 }}>{t.loading}</div>}
          {!loading && recordings.length === 0 && (
            <div style={{ color: 'var(--pixel-text-dim)', padding: 8 }}>{t.noRecordings}</div>
          )}
          {recordings.map(rec => (
            <div key={rec.id} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '20px', color: 'var(--pixel-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rec.name}
                </div>
                <div style={{ fontSize: '18px', color: 'var(--pixel-text-dim)' }}>
                  {t.recordingDuration(rec.durationSec)} / {t.recordingFrames(rec.frameCount)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button style={btnStyle} onClick={() => handlePlay(rec.id)} title={t.playRecording}>
                  {t.playRecording}
                </button>
                <button style={btnStyle} onClick={() => handleExport(rec.id, rec.name)} title={t.exportRecording}>
                  {t.exportRecording}
                </button>
                <button
                  style={{ ...btnStyle, color: '#ff6b6b' }}
                  onClick={() => handleDelete(rec.id)}
                  title={t.deleteRecording}
                >
                  {t.deleteRecording}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})
