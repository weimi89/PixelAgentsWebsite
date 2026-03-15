import { useState, useEffect, useCallback } from 'react'
import { t } from '../i18n.js'

interface UserInfo {
  id: string
  username: string
  role: 'admin' | 'member'
  createdAt: string
  mustChangePassword: boolean
  apiKey: string
}

interface UserManagementPanelProps {
  isOpen: boolean
  onClose: () => void
  /** 目前使用者的 JWT token（用於 API 認證） */
  token: string | null
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 60,
  background: 'var(--pixel-bg)',
  border: '2px solid var(--pixel-border)',
  borderRadius: 0,
  padding: '4px',
  boxShadow: 'var(--pixel-shadow)',
  minWidth: 'min(420px, calc(100vw - 24px))',
  maxWidth: 'min(600px, calc(100vw - 24px))',
  maxHeight: '80vh',
  overflow: 'auto',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '4px 10px',
  borderBottom: '1px solid var(--pixel-border)',
  marginBottom: '4px',
}

const rowStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
}

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderRadius: 0,
  color: 'rgba(255, 255, 255, 0.7)',
  fontSize: '14px',
  cursor: 'pointer',
  padding: '2px 6px',
  marginLeft: 4,
}

/** 遮罩 API Key，僅顯示前 6 字元 */
function maskApiKey(key: string): string {
  if (key.length <= 6) return key
  return key.slice(0, 6) + '*'.repeat(Math.min(key.length - 6, 20))
}

export function UserManagementPanel({ isOpen, onClose, token }: UserManagementPanelProps) {
  const [users, setUsers] = useState<UserInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  /** 記錄哪些使用者的 API Key 已被展開 */
  const [visibleApiKeys, setVisibleApiKeys] = useState<Set<string>>(new Set())

  const fetchUsers = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
        setError(body.error || t.userLoadFailed)
        return
      }
      const data = await res.json() as { users: UserInfo[] }
      setUsers(data.users)
    } catch {
      setError(t.userLoadFailed)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (isOpen) {
      fetchUsers()
      // 每次重新開啟時清除已展開的 API Key
      setVisibleApiKeys(new Set())
    }
  }, [isOpen, fetchUsers])

  // Escape 鍵關閉
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'member') => {
    if (!token) return
    try {
      const res = await fetch(`/api/auth/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
        )
      }
    } catch {
      // 靜默失敗
    }
  }

  const handleDelete = async (userId: string, username: string) => {
    if (!token) return
    if (!window.confirm(t.userDeleteConfirm(username))) return
    try {
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId))
      }
    } catch {
      // 靜默失敗
    }
  }

  /** P4.1: 重設他人的 API Key */
  const handleResetApiKey = async (userId: string, username: string) => {
    if (!token) return
    if (!window.confirm(t.resetApiKeyConfirm(username))) return
    try {
      const res = await fetch(`/api/auth/users/${userId}/reset-apikey`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json() as { apiKey: string }
        // 更新本地使用者清單中的 API Key
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, apiKey: data.apiKey } : u)),
        )
        // 自動展開新的 API Key
        setVisibleApiKeys((prev) => new Set(prev).add(userId))
      }
    } catch {
      // 靜默失敗
    }
  }

  /** 切換 API Key 的可見性 */
  const toggleApiKeyVisibility = (userId: string) => {
    setVisibleApiKeys((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  return (
    <>
      {/* 遮罩 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 59,
        }}
      />
      {/* 面板 */}
      <div role="dialog" aria-modal="true" aria-label={t.userManagementPanel} className="pixel-modal-dialog" style={panelStyle}>
        <div style={headerStyle}>
          <span style={{ fontSize: '24px', color: 'rgba(255, 255, 255, 0.9)' }}>
            {t.userManagementPanel}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: 0,
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            X
          </button>
        </div>

        {loading && (
          <div style={{ padding: '10px', color: 'rgba(255, 255, 255, 0.5)', fontSize: '20px' }}>
            {t.loading}
          </div>
        )}

        {error && (
          <div style={{ padding: '10px', color: 'rgba(255, 100, 100, 0.8)', fontSize: '18px' }}>
            {error}
          </div>
        )}

        {!loading && !error && users.length === 0 && (
          <div style={{ padding: '10px', color: 'rgba(255, 255, 255, 0.4)', fontSize: '18px' }}>
            {t.noUsers}
          </div>
        )}

        {users.map((user) => (
          <div key={user.id} style={rowStyle}>
            {/* 第一行：使用者名稱、角色、操作 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span
                style={{
                  flex: 2,
                  fontSize: '20px',
                  color: 'rgba(255, 255, 255, 0.85)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.username}
              </span>
              <span style={{ flex: 1, textAlign: 'center' }}>
                <select
                  value={user.role}
                  onChange={(e) => handleRoleChange(user.id, e.target.value as 'admin' | 'member')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: 0,
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '16px',
                    padding: '1px 4px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="admin">{t.roleAdmin}</option>
                  <option value="member">{t.roleMember}</option>
                </select>
              </span>
              <span style={{ flex: 1, textAlign: 'right' }}>
                <button
                  onClick={() => handleDelete(user.id, user.username)}
                  style={{
                    ...btnStyle,
                    color: 'rgba(255, 100, 100, 0.8)',
                    borderColor: 'rgba(255, 100, 100, 0.3)',
                  }}
                >
                  {t.deleteUser}
                </button>
              </span>
            </div>
            {/* 第二行：API Key 顯示與操作 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.4)', minWidth: 52 }}>
                {t.userApiKey}:
              </span>
              <code
                style={{
                  flex: 1,
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '1px 4px',
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  userSelect: visibleApiKeys.has(user.id) ? 'all' : 'none',
                }}
                onClick={() => toggleApiKeyVisibility(user.id)}
                title={visibleApiKeys.has(user.id) ? t.hideApiKey : t.showApiKey}
              >
                {visibleApiKeys.has(user.id) ? user.apiKey : maskApiKey(user.apiKey)}
              </code>
              <button
                onClick={() => handleResetApiKey(user.id, user.username)}
                style={{
                  ...btnStyle,
                  fontSize: '12px',
                  color: 'rgba(255, 180, 100, 0.8)',
                  borderColor: 'rgba(255, 180, 100, 0.3)',
                  marginLeft: 2,
                }}
                title={t.resetApiKey}
              >
                {t.resetApiKey}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
