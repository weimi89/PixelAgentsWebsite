import { useState, useEffect, useRef } from 'react'
import { vscode, onServerMessage } from '../socketApi.js'
import { useAuth } from '../hooks/useAuth.js'
import { t } from '../i18n.js'
import { DASHBOARD_REFRESH_MS, TOOL_TYPE_COLORS_HEX } from '../constants.js'
import type { DashboardPayload } from '../types/messages.js'

function getToolColor(name: string): string {
  for (const [key, color] of Object.entries(TOOL_TYPE_COLORS_HEX)) {
    if (key === 'default') continue
    if (name.includes(key)) return color
  }
  return TOOL_TYPE_COLORS_HEX.default
}

export function Dashboard() {
  const { role } = useAuth()
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [clock, setClock] = useState(new Date())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const unsub = onServerMessage((raw) => {
      const msg = raw as { type: string; data?: DashboardPayload }
      if (msg.type === 'dashboardData' && msg.data) {
        setData(msg.data)
      }
    })

    // 啟動定期請求
    vscode.postMessage({ type: 'webviewReady' })
    vscode.postMessage({ type: 'requestDashboardData' })
    timerRef.current = setInterval(() => {
      vscode.postMessage({ type: 'requestDashboardData' })
      setClock(new Date())
    }, DASHBOARD_REFRESH_MS)

    return () => {
      unsub()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  if (!data) {
    return (
      <div style={containerStyle}>
        <div style={{ fontSize: '28px', color: 'rgba(255,255,255,0.5)' }}>{t.loading}</div>
      </div>
    )
  }

  const { floors, agents, stats } = data
  const maxToolCount = Math.max(1, ...Object.values(stats.toolDistribution))
  const sortedTools = Object.entries(stats.toolDistribution).sort((a, b) => b[1] - a[1]).slice(0, 15)

  return (
    <div className="pixel-dashboard" style={containerStyle}>
      {/* 標題列 */}
      <div className="pixel-dashboard-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '32px', color: 'var(--pixel-text)', margin: 0 }}>{t.dashboard}</h1>
        <span style={{ fontSize: '24px', color: 'rgba(255,255,255,0.5)' }}>
          {clock.toLocaleTimeString()}
        </span>
      </div>

      {/* 統計卡片 */}
      <div className="pixel-dashboard-stats" style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', flex: 'none' }}>
        <StatCard label={t.totalAgents} value={stats.totalAgents} color="#5b8def" />
        <StatCard label={t.activeAgents} value={stats.activeAgents} color="#5bef7a" />
        {role === 'admin' && <StatCard label={t.totalToolCalls} value={stats.totalToolCalls} color="#efcf5b" />}
      </div>

      <div className="pixel-dashboard-body" style={{ display: 'flex', gap: 12, flex: 1, overflow: 'hidden' }}>
        {/* 左側：樓層 + 工具分布 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {/* 樓層概覽 */}
          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>{t.floorOverview}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {floors.map((f) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <span style={{ fontSize: '22px', color: 'var(--pixel-text)', minWidth: 80 }}>{f.name}</span>
                  <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.05)', position: 'relative' }}>
                    {f.agentCount > 0 && (
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${Math.min(100, (f.agentCount / Math.max(1, stats.totalAgents)) * 100)}%`,
                        background: 'rgba(90, 140, 255, 0.4)',
                      }} />
                    )}
                    {f.activeCount > 0 && (
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${Math.min(100, (f.activeCount / Math.max(1, stats.totalAgents)) * 100)}%`,
                        background: 'rgba(90, 240, 120, 0.6)',
                      }} />
                    )}
                  </div>
                  <span style={{ fontSize: '20px', color: 'rgba(255,255,255,0.6)', minWidth: 60, textAlign: 'right' }}>
                    {f.agentCount} / {f.activeCount} {t.active}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 工具分布（僅 admin 可見） */}
          {role === 'admin' && (
          <div style={{ ...sectionStyle, flex: 1, overflow: 'auto' }}>
            <h2 style={sectionTitleStyle}>{t.toolDistribution}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {sortedTools.map(([name, count]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span title={name} style={{ fontSize: '18px', color: 'rgba(255,255,255,0.7)', maxWidth: 140, minWidth: 90, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{name}</span>
                  <div style={{ flex: 1, height: 12, background: 'rgba(255,255,255,0.05)', position: 'relative' }}>
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      height: '100%',
                      width: `${(count / maxToolCount) * 100}%`,
                      background: getToolColor(name),
                      opacity: 0.7,
                    }} />
                  </div>
                  <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.5)', minWidth: 40, textAlign: 'right' }}>{count}</span>
                </div>
              ))}
              {sortedTools.length === 0 && (
                <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.3)' }}>{t.noToolData}</span>
              )}
            </div>
          </div>
          )}
        </div>

        {/* 右側：代理列表（anonymous 不可見） */}
        {role !== 'anonymous' && (
        <div style={{ ...sectionStyle, flex: 1.5, overflow: 'auto', minWidth: 0 }}>
          <h2 style={sectionTitleStyle}>{t.agentList}</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '18px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--pixel-border)' }}>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>{t.project}</th>
                <th style={thStyle}>{t.status}</th>
                <th style={thStyle}>{t.tool}</th>
                <th style={thStyle}>{t.model}</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={tdStyle}>
                    {a.id}
                    {a.isRemote && <span style={{ color: '#ef8f5b', marginLeft: 4 }}>@{a.owner}</span>}
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.projectName}</td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: a.isActive ? '#5bef7a' : 'rgba(255,255,255,0.2)',
                      marginRight: 4,
                    }} />
                    {a.isActive ? t.active : t.inactive}
                  </td>
                  <td style={{ ...tdStyle, color: a.activeToolName ? getToolColor(a.activeToolName) : 'rgba(255,255,255,0.3)' }}>
                    {a.activeToolName || '-'}
                  </td>
                  <td style={{ ...tdStyle, color: 'rgba(255,255,255,0.5)' }}>{a.model || '-'}</td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>{t.noAgentsYet}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'var(--pixel-bg)',
      border: '2px solid var(--pixel-border)',
      padding: '8px 16px',
      minWidth: 160,
      boxShadow: 'var(--pixel-shadow)',
    }}>
      <div style={{ fontSize: '48px', color, fontWeight: 'bold' }}>{value}</div>
      <div style={{ fontSize: '18px', color: 'rgba(255,255,255,0.5)' }}>{label}</div>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  background: '#0e0e18',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: 'inherit',
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--pixel-bg)',
  border: '2px solid var(--pixel-border)',
  padding: '8px 12px',
  boxShadow: 'var(--pixel-shadow)',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '22px',
  color: 'rgba(255,255,255,0.8)',
  margin: '0 0 8px 0',
  borderBottom: '1px solid var(--pixel-border)',
  paddingBottom: 4,
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '4px 8px',
  color: 'rgba(255,255,255,0.6)',
  fontWeight: 'normal',
  position: 'sticky',
  top: 0,
  background: 'var(--pixel-bg)',
  zIndex: 1,
}

const tdStyle: React.CSSProperties = {
  padding: '4px 8px',
  color: 'rgba(255,255,255,0.8)',
}
