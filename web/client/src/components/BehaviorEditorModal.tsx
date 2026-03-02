import { useState, useEffect, useCallback, memo } from 'react'
import { vscode } from '../socketApi.js'
import { getBehaviorConfig, DEFAULT_BEHAVIOR_CONFIG } from '../office/engine/behaviorConfig.js'
import type { BehaviorConfig } from '../office/engine/behaviorConfig.js'
import { t } from '../i18n.js'

interface BehaviorEditorModalProps {
  isOpen: boolean
  onClose: () => void
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 200,
}

const modalStyle: React.CSSProperties = {
  background: 'var(--pixel-bg)',
  border: '2px solid var(--pixel-border)',
  borderRadius: 0,
  padding: '16px 20px',
  boxShadow: 'var(--pixel-shadow)',
  maxWidth: 520,
  width: '90%',
  maxHeight: '80vh',
  overflowY: 'auto',
  color: 'var(--pixel-text)',
  fontSize: '20px',
}

const sectionStyle: React.CSSProperties = {
  marginBottom: 16,
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '22px',
  marginBottom: 8,
  borderBottom: '1px solid var(--pixel-border)',
  paddingBottom: 4,
}

const sliderRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 6,
}

const labelStyle: React.CSSProperties = {
  flex: '0 0 120px',
  textAlign: 'right',
}

const sliderStyle: React.CSSProperties = {
  flex: 1,
  accentColor: 'var(--pixel-accent)',
}

const valueStyle: React.CSSProperties = {
  flex: '0 0 48px',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

const btnStyle: React.CSSProperties = {
  padding: '5px 12px',
  fontSize: '20px',
  background: 'var(--pixel-btn-bg)',
  color: 'var(--pixel-text)',
  border: '2px solid transparent',
  borderRadius: 0,
  cursor: 'pointer',
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 12,
  paddingTop: 8,
  borderTop: '1px solid var(--pixel-border)',
}

interface WeightSliderProps {
  label: string
  value: number
  onChange: (v: number) => void
}

function WeightSlider({ label, value, onChange }: WeightSliderProps) {
  return (
    <div style={sliderRowStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={sliderStyle}
      />
      <span style={valueStyle}>{value}</span>
    </div>
  )
}

interface TimeSliderProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}

function TimeSlider({ label, value, min, max, onChange }: TimeSliderProps) {
  return (
    <div style={sliderRowStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={sliderStyle}
      />
      <span style={valueStyle}>{t.behaviorSeconds(value)}</span>
    </div>
  )
}

export const BehaviorEditorModal = memo(function BehaviorEditorModal({
  isOpen,
  onClose,
}: BehaviorEditorModalProps) {
  const [config, setConfig] = useState<BehaviorConfig>(() => ({ ...getBehaviorConfig() }))

  // 開啟時同步最新配置
  useEffect(() => {
    if (isOpen) {
      setConfig({ ...getBehaviorConfig() })
    }
  }, [isOpen])

  const updateField = useCallback((field: keyof BehaviorConfig, value: number) => {
    setConfig((prev) => {
      const next = { ...prev, [field]: value }
      // 即時推送到伺服器並更新本地
      vscode.postMessage({ type: 'saveBehaviorSettings', settings: next })
      return next
    })
  }, [])

  const handleResetDefaults = useCallback(() => {
    const defaults = { ...DEFAULT_BEHAVIOR_CONFIG }
    setConfig(defaults)
    vscode.postMessage({ type: 'saveBehaviorSettings', settings: defaults })
  }, [])

  if (!isOpen) return null

  const weightTotal =
    config.wanderWeightIdleLook +
    config.wanderWeightRandom +
    config.wanderWeightFurniture +
    config.wanderWeightChat +
    config.wanderWeightWall +
    config.wanderWeightMeeting +
    config.wanderWeightReturnSeat

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: '24px', marginBottom: 12 }}>{t.behaviorEditor}</div>

        {/* 漫遊行為權重 */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>{t.behaviorWeights}</div>
          <WeightSlider
            label={t.behaviorWeightIdleLook}
            value={config.wanderWeightIdleLook}
            onChange={(v) => updateField('wanderWeightIdleLook', v)}
          />
          <WeightSlider
            label={t.behaviorWeightRandom}
            value={config.wanderWeightRandom}
            onChange={(v) => updateField('wanderWeightRandom', v)}
          />
          <WeightSlider
            label={t.behaviorWeightFurniture}
            value={config.wanderWeightFurniture}
            onChange={(v) => updateField('wanderWeightFurniture', v)}
          />
          <WeightSlider
            label={t.behaviorWeightChat}
            value={config.wanderWeightChat}
            onChange={(v) => updateField('wanderWeightChat', v)}
          />
          <WeightSlider
            label={t.behaviorWeightWall}
            value={config.wanderWeightWall}
            onChange={(v) => updateField('wanderWeightWall', v)}
          />
          <WeightSlider
            label={t.behaviorWeightMeeting}
            value={config.wanderWeightMeeting}
            onChange={(v) => updateField('wanderWeightMeeting', v)}
          />
          <WeightSlider
            label={t.behaviorWeightReturnSeat}
            value={config.wanderWeightReturnSeat}
            onChange={(v) => updateField('wanderWeightReturnSeat', v)}
          />
          <div style={{ textAlign: 'right', fontSize: '18px', color: 'var(--pixel-text-dim)', marginTop: 4 }}>
            {t.behaviorWeightTotal(weightTotal)}
          </div>
        </div>

        {/* 時間參數 */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>{t.behaviorTiming}</div>
          <div style={{ fontSize: '18px', color: 'var(--pixel-text-dim)', marginBottom: 6 }}>
            {t.behaviorMinMax(t.behaviorWanderPause)}
          </div>
          <TimeSlider
            label="Min"
            value={config.wanderPauseMin}
            min={1}
            max={30}
            onChange={(v) => updateField('wanderPauseMin', v)}
          />
          <TimeSlider
            label="Max"
            value={config.wanderPauseMax}
            min={1}
            max={60}
            onChange={(v) => updateField('wanderPauseMax', v)}
          />
          <div style={{ fontSize: '18px', color: 'var(--pixel-text-dim)', marginBottom: 6, marginTop: 8 }}>
            {t.behaviorMinMax(t.behaviorSeatRest)}
          </div>
          <TimeSlider
            label="Min"
            value={config.seatRestMin}
            min={10}
            max={600}
            onChange={(v) => updateField('seatRestMin', v)}
          />
          <TimeSlider
            label="Max"
            value={config.seatRestMax}
            min={10}
            max={600}
            onChange={(v) => updateField('seatRestMax', v)}
          />
          <div style={{ marginTop: 8 }}>
            <TimeSlider
              label={t.behaviorSleepTrigger}
              value={config.sleepTrigger}
              min={30}
              max={900}
              onChange={(v) => updateField('sleepTrigger', v)}
            />
          </div>
          <TimeSlider
            label={t.behaviorStretchTrigger}
            value={config.stretchTrigger}
            min={30}
            max={600}
            onChange={(v) => updateField('stretchTrigger', v)}
          />
          <div style={{ fontSize: '18px', color: 'var(--pixel-text-dim)', marginBottom: 6, marginTop: 8 }}>
            {t.behaviorMinMax(t.behaviorChatDuration)}
          </div>
          <TimeSlider
            label="Min"
            value={config.chatDurationMin}
            min={1}
            max={30}
            onChange={(v) => updateField('chatDurationMin', v)}
          />
          <TimeSlider
            label="Max"
            value={config.chatDurationMax}
            min={1}
            max={60}
            onChange={(v) => updateField('chatDurationMax', v)}
          />
          <div style={{ marginTop: 8 }}>
            <TimeSlider
              label={t.behaviorFurnitureCooldown}
              value={config.furnitureCooldown}
              min={10}
              max={600}
              onChange={(v) => updateField('furnitureCooldown', v)}
            />
          </div>
        </div>

        <div style={footerStyle}>
          <button
            style={btnStyle}
            onClick={handleResetDefaults}
          >
            {t.behaviorResetDefaults}
          </button>
          <button
            style={btnStyle}
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
})
