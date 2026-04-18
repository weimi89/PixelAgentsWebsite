import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../hooks/useAuth.js'
import { t } from '../i18n.js'

// ── 樣式常數 ─────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 8,
  right: 8,
  zIndex: 300,
}

const btnBase: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '20px',
  background: 'var(--pixel-btn-bg)',
  color: 'var(--pixel-text)',
  border: '2px solid var(--pixel-border)',
  borderRadius: 0,
  cursor: 'pointer',
  boxShadow: 'var(--pixel-shadow)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minHeight: 40,
  whiteSpace: 'nowrap' as const,
}

const popoverStyle: React.CSSProperties = {
  position: 'fixed',
  top: 48,
  right: 8,
  zIndex: 301,
  background: 'var(--pixel-bg)',
  border: '2px solid var(--pixel-border)',
  borderRadius: 0,
  boxShadow: 'var(--pixel-shadow)',
  minWidth: 280,
  maxWidth: 340,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: '18px',
  background: 'var(--pixel-btn-bg)',
  color: 'var(--pixel-text)',
  border: '2px solid var(--pixel-border)',
  borderRadius: 0,
  boxSizing: 'border-box',
  minHeight: 36,
}

const submitBtnStyle: React.CSSProperties = {
  ...btnBase,
  width: '100%',
  justifyContent: 'center',
  background: 'var(--pixel-accent)',
  color: '#fff',
  border: '2px solid var(--pixel-accent)',
  marginTop: 8,
}

const errorStyle: React.CSSProperties = {
  color: 'var(--pixel-close-hover)',
  fontSize: '16px',
  marginTop: 4,
}

const successStyle: React.CSSProperties = {
  color: 'var(--pixel-green)',
  fontSize: '16px',
  marginTop: 4,
}

const menuItemStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: '18px',
  cursor: 'pointer',
  color: 'var(--pixel-text)',
  background: 'transparent',
  border: 'none',
  borderRadius: 0,
  width: '100%',
  textAlign: 'left',
  minHeight: 40,
}

// ── 子視圖型別 ──────────────────────────────────────────────────

type PanelView = 'closed' | 'login' | 'register' | 'menu' | 'changePassword' | 'viewApiKey'

// ── 登入表單 Tab ────────────────────────────────────────────────

type LoginTab = 'account' | 'apikey'

// ── 元件 ─────────────────────────────────────────────────────────

export function AuthPanel() {
  const auth = useAuth()
  const [view, setView] = useState<PanelView>('closed')
  const [loginTab, setLoginTab] = useState<LoginTab>('account')

  // 表單欄位
  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formApiKey, setFormApiKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 變更密碼
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState(false)

  // 顯示的 API Key
  const [displayApiKey, setDisplayApiKey] = useState<string | null>(null)
  const [apiKeyCopied, setApiKeyCopied] = useState(false)
  // 是否顯示完整 API Key（預設遮罩）
  const [apiKeyRevealed, setApiKeyRevealed] = useState(false)
  // 註冊後一次性顯示的 API Key
  const [registeredApiKey, setRegisteredApiKey] = useState<string | null>(null)

  // 強制變更密碼
  const [mustChangePassword, setMustChangePassword] = useState(false)

  const popoverRef = useRef<HTMLDivElement>(null)

  const resetForm = useCallback(() => {
    setFormUsername('')
    setFormPassword('')
    setFormApiKey('')
    setOldPassword('')
    setNewPassword('')
    setConfirmPwd('')
    setError('')
    setPwdSuccess(false)
    setLoading(false)
    setApiKeyCopied(false)
  }, [])

  // ── Escape 鍵關閉 ─────────────────────────────────────────────
  useEffect(() => {
    if (view === 'closed') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // mustChangePassword 時不允許關閉
        if (mustChangePassword && view === 'changePassword') return
        setView('closed')
        resetForm()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [view, mustChangePassword, resetForm])

  // ── 點擊外部關閉 ──────────────────────────────────────────────
  useEffect(() => {
    if (view === 'closed') return
    const handler = (e: MouseEvent) => {
      if (mustChangePassword && view === 'changePassword') return
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setView('closed')
        resetForm()
      }
    }
    // 延遲綁定，避免開啟面板的那次點擊立即觸發關閉
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handler)
    }, 0)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousedown', handler)
    }
  }, [view, mustChangePassword, resetForm])

  // ── 帳號密碼登入 ──────────────────────────────────────────────
  const handleLogin = useCallback(async () => {
    if (!formUsername || !formPassword) return
    setLoading(true)
    setError('')
    const result = await auth.login(formUsername, formPassword)
    setLoading(false)
    if (result.success) {
      if (result.mustChangePassword) {
        setMustChangePassword(true)
        setView('changePassword')
        resetForm()
      } else {
        setView('closed')
        resetForm()
      }
    } else {
      setError(result.error || t.loginFailed)
    }
  }, [formUsername, formPassword, auth, resetForm])

  // ── API Key 登入 ──────────────────────────────────────────────
  const handleApiKeyLogin = useCallback(async () => {
    if (!formApiKey) return
    setLoading(true)
    setError('')
    const result = await auth.loginWithApiKey(formApiKey)
    setLoading(false)
    if (result.success) {
      setView('closed')
      resetForm()
    } else {
      setError(result.error || t.loginFailed)
    }
  }, [formApiKey, auth, resetForm])

  // ── 註冊 ──────────────────────────────────────────────────────
  const handleRegister = useCallback(async () => {
    if (!formUsername || !formPassword) return
    setLoading(true)
    setError('')
    const result = await auth.register(formUsername, formPassword)
    setLoading(false)
    if (result.success) {
      if (result.apiKey) {
        setRegisteredApiKey(result.apiKey)
      }
      setView('closed')
      resetForm()
    } else {
      setError(result.error || t.registerFailed)
    }
  }, [formUsername, formPassword, auth, resetForm])

  // ── 變更密碼 ──────────────────────────────────────────────────
  const handleChangePassword = useCallback(async () => {
    if (!oldPassword || !newPassword) return
    if (newPassword !== confirmPwd) {
      setError(t.passwordMismatch)
      return
    }
    setLoading(true)
    setError('')
    const result = await auth.changePassword(oldPassword, newPassword)
    setLoading(false)
    if (result.success) {
      setPwdSuccess(true)
      setMustChangePassword(false)
      setTimeout(() => {
        setView('closed')
        resetForm()
      }, 1500)
    } else {
      setError(result.error || '變更失敗')
    }
  }, [oldPassword, newPassword, confirmPwd, auth, resetForm])

  // ── 查看 API Key ──────────────────────────────────────────────
  const handleViewApiKey = useCallback(async () => {
    const result = await auth.getApiKey()
    if (result.success && result.apiKey) {
      setDisplayApiKey(result.apiKey)
      setApiKeyRevealed(false)
      setView('viewApiKey')
    }
  }, [auth])

  // ── 重新生成 API Key ──────────────────────────────────────────
  const handleRegenerateApiKey = useCallback(async () => {
    if (!window.confirm(t.apiKeyRegenerateConfirm)) return
    const result = await auth.regenerateApiKey()
    if (result.success && result.apiKey) {
      setDisplayApiKey(result.apiKey)
    }
  }, [auth])

  // ── 複製 API Key ──────────────────────────────────────────────
  const handleCopyApiKey = useCallback(async (key: string) => {
    try {
      await navigator.clipboard.writeText(key)
      setApiKeyCopied(true)
      setTimeout(() => setApiKeyCopied(false), 2000)
    } catch { /* 忽略 */ }
  }, [])

  // ── Enter 鍵提交 ──────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      action()
    }
  }, [])

  const handleToggle = useCallback(() => {
    if (view !== 'closed') {
      setView('closed')
      resetForm()
    } else if (auth.isAuthenticated) {
      setView('menu')
    } else {
      setView('login')
    }
  }, [view, auth.isAuthenticated, resetForm])

  // ── 角色顯示名稱 ─────────────────────────────────────────────
  const roleLabel = auth.role === 'admin' ? t.roleAdmin : auth.role === 'member' ? t.roleMember : ''

  // ── 渲染 ──────────────────────────────────────────────────────

  const triggerButton = (
    <button
      style={btnBase}
      onClick={handleToggle}
      aria-label={auth.isAuthenticated ? auth.username || '' : t.login}
    >
      {auth.isAuthenticated ? (
        <>
          <span>{auth.username}</span>
          <span style={{ fontSize: '14px', opacity: 0.6 }}>({roleLabel})</span>
          <span style={{ fontSize: '12px' }}>{view === 'closed' ? '\u25BC' : '\u25B2'}</span>
        </>
      ) : (
        <span>{t.login}</span>
      )}
    </button>
  )

  // 註冊後的 API Key 一次性顯示（浮動通知）
  const apiKeyNotice = registeredApiKey ? createPortal(
    <div
      ref={popoverRef}
      style={{
        ...popoverStyle,
        padding: 12,
      }}
    >
      <div style={{ fontSize: '16px', color: 'var(--pixel-status-permission)', marginBottom: 8 }}>
        {t.apiKeyShowOnce}
      </div>
      <div style={{
        padding: '6px 8px',
        background: 'var(--pixel-btn-bg)',
        border: '2px solid var(--pixel-border)',
        fontSize: '14px',
        color: 'var(--pixel-text)',
        wordBreak: 'break-all',
        marginBottom: 8,
      }}>
        {registeredApiKey}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          style={{ ...submitBtnStyle, flex: 1, marginTop: 0 }}
          onClick={() => handleCopyApiKey(registeredApiKey)}
        >
          {apiKeyCopied ? t.apiKeyCopied : t.copyToClipboard}
        </button>
        <button
          style={{ ...btnBase, flex: 0, marginTop: 0 }}
          onClick={() => { setRegisteredApiKey(null); setApiKeyCopied(false) }}
        >
          OK
        </button>
      </div>
    </div>,
    document.body,
  ) : null

  // 登入/註冊面板內容
  let popoverContent: React.ReactNode = null

  if (view === 'login') {
    popoverContent = (
      <div style={{ padding: 12 }}>
        {/* Tab 切換 */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 12 }}>
          <button
            style={{
              ...btnBase,
              flex: 1,
              justifyContent: 'center',
              background: loginTab === 'account' ? 'var(--pixel-active-bg)' : 'transparent',
              border: loginTab === 'account' ? '2px solid var(--pixel-accent)' : '2px solid var(--pixel-border)',
              fontSize: '16px',
            }}
            onClick={() => { setLoginTab('account'); setError('') }}
          >
            {t.accountLogin}
          </button>
          <button
            style={{
              ...btnBase,
              flex: 1,
              justifyContent: 'center',
              background: loginTab === 'apikey' ? 'var(--pixel-active-bg)' : 'transparent',
              border: loginTab === 'apikey' ? '2px solid var(--pixel-accent)' : '2px solid var(--pixel-border)',
              fontSize: '16px',
            }}
            onClick={() => { setLoginTab('apikey'); setError('') }}
          >
            {t.apiKeyLogin}
          </button>
        </div>

        {loginTab === 'account' ? (
          <>
            <label style={{ fontSize: '16px', color: 'var(--pixel-text-dim)', display: 'block', marginBottom: 4 }}>
              {t.username}
            </label>
            <input
              style={inputStyle}
              type="text"
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, handleLogin)}
              autoFocus
              autoComplete="username"
            />
            <label style={{ fontSize: '16px', color: 'var(--pixel-text-dim)', display: 'block', marginTop: 8, marginBottom: 4 }}>
              {t.password}
            </label>
            <input
              style={inputStyle}
              type="password"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, handleLogin)}
              autoComplete="current-password"
            />
            {error && <div style={errorStyle}>{error}</div>}
            <button
              style={{ ...submitBtnStyle, opacity: loading ? 0.5 : 1 }}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? t.loading : t.login}
            </button>
            {/* 註冊連結 */}
            <div style={{ marginTop: 12, fontSize: '16px', color: 'var(--pixel-text-dim)' }}>
              {t.noAccountYet}{' '}
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--pixel-accent)',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: 0,
                  textDecoration: 'underline',
                }}
                onClick={() => { setView('register'); setError('') }}
              >
                {t.register}
              </button>
            </div>
          </>
        ) : (
          <>
            <label style={{ fontSize: '16px', color: 'var(--pixel-text-dim)', display: 'block', marginBottom: 4 }}>
              {t.apiKeyLabel}
            </label>
            <input
              style={inputStyle}
              type="password"
              value={formApiKey}
              onChange={(e) => setFormApiKey(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, handleApiKeyLogin)}
              placeholder={t.pasteApiKey}
              autoFocus
            />
            {error && <div style={errorStyle}>{error}</div>}
            <button
              style={{ ...submitBtnStyle, opacity: loading ? 0.5 : 1 }}
              onClick={handleApiKeyLogin}
              disabled={loading}
            >
              {loading ? t.loading : t.login}
            </button>
          </>
        )}

{/* 首次使用提示已移除 — 不應在 UI 中顯示預設密碼 */}
      </div>
    )
  }

  if (view === 'register') {
    popoverContent = (
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: '20px', color: 'var(--pixel-text)', marginBottom: 12 }}>{t.register}</div>
        <label style={{ fontSize: '16px', color: 'var(--pixel-text-dim)', display: 'block', marginBottom: 4 }}>
          {t.username}
        </label>
        <input
          style={inputStyle}
          type="text"
          value={formUsername}
          onChange={(e) => setFormUsername(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, handleRegister)}
          autoFocus
          autoComplete="username"
        />
        <label style={{ fontSize: '16px', color: 'var(--pixel-text-dim)', display: 'block', marginTop: 8, marginBottom: 4 }}>
          {t.password}
        </label>
        <input
          style={inputStyle}
          type="password"
          value={formPassword}
          onChange={(e) => setFormPassword(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, handleRegister)}
          autoComplete="new-password"
        />
        <div style={{ fontSize: '14px', color: 'var(--pixel-text-dim)', marginTop: 4 }}>
          {t.passwordRequirements}
        </div>
        {error && <div style={errorStyle}>{error}</div>}
        <button
          style={{ ...submitBtnStyle, opacity: loading ? 0.5 : 1 }}
          onClick={handleRegister}
          disabled={loading}
        >
          {loading ? t.loading : t.register}
        </button>
        <div style={{ marginTop: 8, fontSize: '16px' }}>
          <button
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--pixel-accent)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: 0,
              textDecoration: 'underline',
            }}
            onClick={() => { setView('login'); setError('') }}
          >
            {t.login}
          </button>
        </div>
      </div>
    )
  }

  if (view === 'menu') {
    popoverContent = (
      <div style={{ padding: '4px 0' }}>
        <div style={{
          padding: '8px 12px',
          fontSize: '18px',
          color: 'var(--pixel-text)',
          borderBottom: '2px solid var(--pixel-border)',
        }}>
          {auth.username} <span style={{ fontSize: '14px', opacity: 0.6 }}>({roleLabel})</span>
        </div>
        <button
          style={menuItemStyle}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--pixel-btn-hover-bg)' }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent' }}
          onClick={handleViewApiKey}
        >
          {t.viewApiKey}
        </button>
        <button
          style={menuItemStyle}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--pixel-btn-hover-bg)' }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent' }}
          onClick={() => { setView('changePassword'); resetForm() }}
        >
          {t.changePassword}
        </button>
        <div style={{ borderTop: '2px solid var(--pixel-border)' }} />
        <button
          style={{ ...menuItemStyle, color: 'var(--pixel-close-hover)' }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--pixel-btn-hover-bg)' }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent' }}
          onClick={() => { auth.logout(); setView('closed'); resetForm() }}
        >
          {t.logout}
        </button>
      </div>
    )
  }

  if (view === 'changePassword') {
    popoverContent = (
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: '20px', color: 'var(--pixel-text)', marginBottom: 12 }}>
          {mustChangePassword ? t.forceChangePassword : t.changePassword}
        </div>
        <label style={{ fontSize: '16px', color: 'var(--pixel-text-dim)', display: 'block', marginBottom: 4 }}>
          {t.currentPassword}
        </label>
        <input
          style={inputStyle}
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
        />
        <label style={{ fontSize: '16px', color: 'var(--pixel-text-dim)', display: 'block', marginTop: 8, marginBottom: 4 }}>
          {t.newPassword}
        </label>
        <input
          style={inputStyle}
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
        <label style={{ fontSize: '16px', color: 'var(--pixel-text-dim)', display: 'block', marginTop: 8, marginBottom: 4 }}>
          {t.confirmPassword}
        </label>
        <input
          style={inputStyle}
          type="password"
          value={confirmPwd}
          onChange={(e) => setConfirmPwd(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, handleChangePassword)}
          autoComplete="new-password"
        />
        <div style={{ fontSize: '14px', color: 'var(--pixel-text-dim)', marginTop: 4 }}>
          {t.passwordRequirements}
        </div>
        {error && <div style={errorStyle}>{error}</div>}
        {pwdSuccess && <div style={successStyle}>{t.passwordChanged}</div>}
        <button
          style={{ ...submitBtnStyle, opacity: loading ? 0.5 : 1 }}
          onClick={handleChangePassword}
          disabled={loading}
        >
          {loading ? t.loading : t.changePassword}
        </button>
        {!mustChangePassword && (
          <div style={{ marginTop: 8, fontSize: '16px' }}>
            <button
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--pixel-accent)',
                cursor: 'pointer',
                fontSize: '16px',
                padding: 0,
                textDecoration: 'underline',
              }}
              onClick={() => { setView('menu'); resetForm() }}
            >
              {t.login === '登入' ? '返回' : 'Back'}
            </button>
          </div>
        )}
      </div>
    )
  }

  if (view === 'viewApiKey') {
    // 決定顯示的文字：遮罩或完整
    const displayText = displayApiKey
      ? (apiKeyRevealed ? displayApiKey : t.apiKeyMasked(displayApiKey))
      : ''

    popoverContent = (
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: '20px', color: 'var(--pixel-text)', marginBottom: 12 }}>
          {t.apiKeyLabel}
        </div>
        {displayApiKey && (
          <>
            <div style={{
              padding: '6px 8px',
              background: 'var(--pixel-btn-bg)',
              border: '2px solid var(--pixel-border)',
              fontSize: '14px',
              color: 'var(--pixel-text)',
              wordBreak: 'break-all',
              marginBottom: 8,
              fontFamily: 'monospace',
            }}>
              {displayText}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {/* 顯示/隱藏切換按鈕 */}
              <button
                style={{ ...btnBase, flex: 0, fontSize: '16px' }}
                onClick={() => setApiKeyRevealed((v) => !v)}
              >
                {apiKeyRevealed ? t.hideFullApiKey : t.showFullApiKey}
              </button>
              {/* 複製按鈕（始終複製完整 key） */}
              <button
                style={{ ...submitBtnStyle, flex: 1, marginTop: 0 }}
                onClick={() => handleCopyApiKey(displayApiKey)}
              >
                {apiKeyCopied ? t.apiKeyCopied : t.copyToClipboard}
              </button>
            </div>
            {/* 重新生成按鈕 */}
            <button
              style={{
                ...btnBase,
                width: '100%',
                justifyContent: 'center',
                marginTop: 8,
                fontSize: '16px',
                background: 'var(--pixel-danger-bg)',
                color: '#fff',
                border: '2px solid var(--pixel-danger-bg)',
              }}
              onClick={handleRegenerateApiKey}
            >
              {t.apiKeyRegenerate}
            </button>
          </>
        )}
        <div style={{ marginTop: 8, fontSize: '16px' }}>
          <button
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--pixel-accent)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: 0,
              textDecoration: 'underline',
            }}
            onClick={() => { setView('menu'); setDisplayApiKey(null); setApiKeyCopied(false); setApiKeyRevealed(false) }}
          >
            {t.login === '登入' ? '返回' : 'Back'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="pixel-auth-panel" style={panelStyle}>
        {triggerButton}
      </div>
      {view !== 'closed' && popoverContent && createPortal(
        <div ref={popoverRef} style={popoverStyle}>
          {popoverContent}
        </div>,
        document.body,
      )}
      {apiKeyNotice}
    </>
  )
}
