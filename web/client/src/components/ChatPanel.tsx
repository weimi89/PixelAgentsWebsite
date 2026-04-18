import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { vscode } from '../socketApi.js'
import { useDeviceType } from '../hooks/useDeviceType.js'
import { t } from '../i18n.js'
import { CHAT_INPUT_MAX_LENGTH, CHAT_PANEL_MAX_MESSAGES } from '../constants.js'

export interface ChatMessage {
  nickname: string
  text: string
  ts: number
}

interface ChatPanelProps {
  messages: ChatMessage[]
}

/** 依據暱稱 hash 產生固定顏色 */
function nicknameColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  }
  const hue = ((hash % 360) + 360) % 360
  return `hsl(${hue}, 70%, 70%)`
}

export const ChatPanel = memo(function ChatPanel({ messages }: ChatPanelProps) {
  const { isMobile } = useDeviceType()
  const [expanded, setExpanded] = useState(false)
  const [inputText, setInputText] = useState('')
  const [hasNew, setHasNew] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [sendHovered, setSendHovered] = useState(false)
  const [closeHovered, setCloseHovered] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const prevMsgCountRef = useRef(messages.length)

  // 新訊息到達時：展開則自動捲到底，收合則閃爍提示
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      if (expanded && listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight
      } else if (!expanded) {
        setHasNew(true)
      }
    }
    prevMsgCountRef.current = messages.length
  }, [messages.length, expanded])

  // 展開時捲到底部
  useEffect(() => {
    if (expanded && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
    if (expanded) setHasNew(false)
  }, [expanded])

  // 展開時：全域 Esc 關閉抽屜（即使未聚焦輸入框也能關閉）
  // 抽屜右上的 X 按鈕可能被 AuthPanel 的 admin 按鈕蓋住（z-index 差）
  useEffect(() => {
    if (!expanded) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 若焦點在輸入框，讓 input 的 onKeyDown 先處理（blur）
        if (document.activeElement === inputRef.current) return
        setExpanded(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [expanded])

  const handleSend = useCallback(() => {
    const text = inputText.trim()
    if (!text) return
    vscode.postMessage({ type: 'chatMessage', text })
    setInputText('')
  }, [inputText])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      handleSend()
    } else if (e.key === 'Escape') {
      inputRef.current?.blur()
      setExpanded(false)
    }
  }, [handleSend])

  const visibleMessages = messages.slice(-CHAT_PANEL_MAX_MESSAGES)
  const lastMsg = visibleMessages.length > 0 ? visibleMessages[visibleMessages.length - 1] : null

  // 右側抽屜寬度（桌面）
  const DRAWER_WIDTH = 320
  return (
    <>
      {/* 收合時的觸發按鈕：右下小方塊顯示最新訊息／新訊息指示燈 */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            position: isMobile ? 'fixed' : 'absolute',
            bottom: isMobile ? 90 : 10,
            right: isMobile ? 8 : 10,
            left: 'auto',
            zIndex: isMobile ? 44 : 45,
            background: 'var(--pixel-bg)',
            border: '2px solid var(--pixel-border)',
            borderRadius: 0,
            padding: isMobile ? '8px 12px' : '4px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            maxWidth: isMobile ? 'auto' : 280,
            boxShadow: 'var(--pixel-shadow)',
          }}
        >
          <span style={{ fontSize: isMobile ? '16px' : '20px', color: 'var(--pixel-text)' }}>{t.chat}</span>
          {!isMobile && lastMsg && (
            <span
              style={{
                fontSize: '18px',
                color: 'rgba(255,255,255,0.5)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                textAlign: 'left',
              }}
            >
              <span style={{ color: nicknameColor(lastMsg.nickname) }}>{lastMsg.nickname}</span>: {lastMsg.text}
            </span>
          )}
          {hasNew && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--pixel-accent)',
                flexShrink: 0,
                animation: 'chatPulse 1s infinite',
              }}
            />
          )}
        </button>
      )}

      {/* 展開時：右側全高抽屜（桌面）/ 底部抽屜（行動） */}
      {expanded && (
        <div
          className="pixel-chat-drawer"
          style={{
            position: 'fixed',
            // 桌面：右側全高抽屜（避開底部工具列區以免遮蓋其他功能）
            // 行動：底部抽屜（保留原本 UX）
            top: isMobile ? 'auto' : 0,
            bottom: 0,
            right: 0,
            left: isMobile ? 0 : 'auto',
            width: isMobile ? '100%' : DRAWER_WIDTH,
            // 低於 AgentDetailPanel (310)：兩者同時存在時，詳情面板蓋住聊天（聊天次要）
            zIndex: 280,
            background: 'var(--pixel-bg)',
            border: isMobile ? 'none' : '2px solid var(--pixel-border)',
            borderTop: isMobile ? '2px solid var(--pixel-border)' : undefined,
            boxShadow: isMobile ? '0 -4px 0 #0a0a14' : '-4px 0 0 #0a0a14',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: isMobile ? '50vh' : 'none',
            paddingBottom: isMobile ? 'env(safe-area-inset-bottom)' : 0,
          }}
        >
          {/* 標題列 — 桌面抽屜右側留 90px 讓位給 AuthPanel 的登入/admin 按鈕，避免 X 按鈕被蓋住 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: isMobile ? '4px 8px' : '4px 96px 4px 8px',
              borderBottom: '1px solid var(--pixel-border)',
            }}
          >
            <span style={{ fontSize: '20px', color: 'rgba(255,255,255,0.9)' }}>{t.chat}</span>
            <button
              onClick={() => setExpanded(false)}
              onMouseEnter={() => setCloseHovered(true)}
              onMouseLeave={() => setCloseHovered(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: closeHovered ? 'var(--pixel-close-hover)' : 'rgba(255,255,255,0.6)',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0 4px',
                lineHeight: 1,
              }}
            >
              X
            </button>
          </div>

          {/* 訊息列表 — 桌面抽屜時填滿可用高度，行動時限制 50vh 內 */}
          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '4px 8px',
              minHeight: 100,
              maxHeight: isMobile ? 220 : 'none',
            }}
          >
            {visibleMessages.map((msg, i) => {
              const d = new Date(msg.ts)
              const ts = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
              return (
                <div key={`${msg.ts}-${i}`} style={{ fontSize: '18px', marginBottom: 2, wordBreak: 'break-word' }}>
                  <span style={{ color: nicknameColor(msg.nickname), fontWeight: 'bold' }}>{msg.nickname}</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>: {msg.text}</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px', marginLeft: 6 }}>{ts}</span>
                </div>
              )
            })}
            {visibleMessages.length === 0 && (
              <div style={{ fontSize: '18px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 8 }}>
                ...
              </div>
            )}
          </div>

          {/* 輸入列 */}
          <div
            style={{
              display: 'flex',
              borderTop: '1px solid var(--pixel-border)',
              padding: 4,
              gap: 4,
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value.slice(0, CHAT_INPUT_MAX_LENGTH))}
              onKeyDown={handleKeyDown}
              onFocus={(e) => { e.stopPropagation(); setInputFocused(true) }}
              onBlur={() => setInputFocused(false)}
              placeholder={t.chatPlaceholder}
              maxLength={CHAT_INPUT_MAX_LENGTH}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${inputFocused ? 'var(--pixel-accent)' : 'var(--pixel-border)'}`,
                borderRadius: 0,
                color: 'var(--pixel-text)',
                fontSize: isMobile ? '16px' : '18px',
                padding: isMobile ? '8px 10px' : '3px 6px',
                outline: 'none',
                fontFamily: 'inherit',
                minHeight: isMobile ? 40 : 'auto',
              }}
            />
            <button
              onClick={handleSend}
              onMouseEnter={() => setSendHovered(true)}
              onMouseLeave={() => setSendHovered(false)}
              style={{
                background: sendHovered ? 'var(--pixel-btn-hover-bg)' : 'var(--pixel-btn-bg)',
                border: '2px solid transparent',
                borderRadius: 0,
                color: 'var(--pixel-text)',
                fontSize: isMobile ? '16px' : '18px',
                padding: isMobile ? '8px 14px' : '3px 8px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                minHeight: isMobile ? 40 : 'auto',
              }}
            >
              {t.chatSend}
            </button>
          </div>
          {/* 字數指示 */}
          {inputText.length > 0 && (
            <div style={{
              textAlign: 'right',
              padding: '0 8px 2px',
              fontSize: '14px',
              color: inputText.length > CHAT_INPUT_MAX_LENGTH * 0.8
                ? '#ef5b5b'
                : 'rgba(255,255,255,0.3)',
            }}>
              {inputText.length}/{CHAT_INPUT_MAX_LENGTH}
            </div>
          )}
        </div>
      )}
    </>
  )
})
