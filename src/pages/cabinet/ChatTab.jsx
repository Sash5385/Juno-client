import { useState, useEffect, useRef } from 'react'
import {
  subscribeStudentChat, sendStudentMessage, markDirectChatRead, clearStudentChat,
} from '../../firebase/db'
import { useToast } from '../../hooks/useToast'
import './ChatTab.css'

// ─── DIRECT CHAT (with instructor) ───────────────────────────────
function DirectChat({ user, profile }) {
  const [messages, setMessages] = useState([])
  const { showToast, ToastEl } = useToast()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const taRef = useRef(null)

  useEffect(() => {
    if (!user?.uid) return
    markDirectChatRead(user.uid).catch(() => {})
    return subscribeStudentChat(user.uid, setMessages)
  }, [user?.uid])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      await sendStudentMessage(user.uid, text.trim())
      setText('')
      taRef.current?.focus()
    } catch {
      showToast('Помилка надсилання')
    } finally {
      setSending(false)
    }
  }

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const initials = (profile?.name || 'У').split(' ').map(w => w[0]).slice(0, 2).join('')

  const [clearPending, setClearPending] = useState(false)

  const handleClear = async () => {
    if (!clearPending) { setClearPending(true); return }
    setClearPending(false)
    await clearStudentChat(user.uid)
  }

  return (
    <div className="chat-inner fade-up">
      {ToastEl}
      <div className="chat-header">
        <div className="chat-instructor-avatar">🚗</div>
        <div className="chat-instructor-info">
          <div className="chat-instructor-name">Майстер</div>
          <div className="chat-instructor-status">Відповідає протягом дня</div>
        </div>
        {messages.length > 0 && (
          clearPending ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(229,57,53,0.15)', color: '#e53935', border: '1px solid rgba(229,57,53,0.3)', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                onClick={handleClear}
              >Очистити</button>
              <button
                style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(255,255,255,0.08)', color: 'var(--dim)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, cursor: 'pointer' }}
                onClick={() => setClearPending(false)}
              >Ні</button>
            </div>
          ) : (
            <button className="chat-clear-btn" onClick={handleClear} aria-label="Очистити чат">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          )
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <div className="chat-empty-title">Почніть розмову</div>
            <div className="chat-empty-sub">Напишіть майстру будь-яке питання</div>
          </div>
        )}
        {messages.map(m => {
          const isMe = m.from === 'student'
          const isBroadcast = m.broadcast
          return (
            <div key={m.id} className={`chat-msg-row ${isMe ? 'out' : 'in'}`}>
              {!isMe && <div className="chat-msg-avatar instructor">🚗</div>}
              <div className={`chat-bubble ${isMe ? 'bubble-out' : isBroadcast ? 'bubble-broadcast' : 'bubble-in'}`}>
                {isBroadcast && <div className="bubble-broadcast-label">📢 Оголошення</div>}
                <div className="bubble-text">{m.text}</div>
                <div className="bubble-time">{m.time}</div>
              </div>
              {isMe && <div className="chat-msg-avatar me">{initials}</div>}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <div style={{display:'flex',gap:5,padding:'0 0 7px',overflowX:'auto',scrollbarWidth:'none'}}>
          {['Підтверджую ✅','Скасовую ❌','Запізнюся ⏱','Дякую! 🙏','Коли наступний запис?'].map(q => (
            <button key={q} onClick={() => setText(q)} style={{
              flexShrink:0,fontSize:11,padding:'5px 11px',borderRadius:20,
              border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)',
              color:'var(--dim)',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap',
            }}>{q}</button>
          ))}
        </div>
        <div className="chat-input-box">
          <textarea
            ref={taRef}
            className="chat-textarea"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Напишіть повідомлення…"
            rows={1}
          />
          <button
            className={`chat-send-btn ${text.trim() ? 'active' : ''}`}
            onClick={send}
            disabled={!text.trim() || sending}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ChatTab({ user, profile }) {
  return (
    <div className="chat-tab">
      <DirectChat user={user} profile={profile} />
    </div>
  )
}
