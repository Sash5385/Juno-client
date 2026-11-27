import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  subscribeStudentChat, sendStudentMessage, markDirectChatRead, clearStudentChat,
  editStudentMessage, iRef,
} from '../../firebase/db'
import { get } from 'firebase/database'
import { useToast } from '../../hooks/useToast'
import { useSalonMode } from '../../hooks/useSalonMode'
import './ChatTab.css'
import { MetalIcon } from '../../MetalIcon'

// Редагувати можна свої повідомлення протягом доби
const EDIT_WINDOW = 24 * 60 * 60 * 1000
const fmtTime = ts => new Date(ts).toLocaleTimeString('uk', { hour: '2-digit', minute: '2-digit' })

// ─── DIRECT CHAT (with instructor) ───────────────────────────────
// mid/title — тред із майстром салону (chats_m/{mid}); без mid — тред «Салон» (як раніше)
function DirectChat({ user, profile, mid, title }) {
  const salonOn = useSalonMode()
  const [messages, setMessages] = useState([])
  const { showToast, ToastEl } = useToast()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(null)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const taRef = useRef(null)
  // Ім'я й фото майстра в шапці чату (замість безликого «Майстер»); салон без mid — назва салону з профілю
  const [who, setWho] = useState(null)
  useEffect(() => {
    if (mid) return
    get(iRef('admin_settings/profile')).then(s => { const p = s.val() || {}; setWho({ name: p.name || '', photo: p.photoUrl || '' }) }).catch(() => {})
  }, [mid])

  useEffect(() => {
    if (!user?.uid) return
    markDirectChatRead(user.uid, mid).catch(() => {})
    return subscribeStudentChat(user.uid, setMessages, mid)
  }, [user?.uid, mid])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      if (editing) {
        await editStudentMessage(user.uid, editing, text.trim(), mid)
        setEditing(null)
      } else {
        await sendStudentMessage(user.uid, text.trim(), mid)
      }
      setText('')
      taRef.current?.focus()
    } catch {
      showToast('Помилка надсилання')
    } finally {
      setSending(false)
    }
  }

  const startEdit = m => { setEditing(m.id); setText(m.text || ''); taRef.current?.focus() }
  const cancelEdit = () => { setEditing(null); setText('') }

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const initials = (profile?.name || 'У').split(' ').map(w => w[0]).slice(0, 2).join('')

  const [clearPending, setClearPending] = useState(false)

  const handleClear = async () => {
    if (!clearPending) { setClearPending(true); return }
    setClearPending(false)
    await clearStudentChat(user.uid, mid)
  }

  return (
    <div className="chat-inner fade-up">
      {ToastEl}
      <div className="chat-header">
        <div className="chat-instructor-avatar">{who?.photo ? <img src={who.photo} alt="" style={{width:34,height:34,borderRadius:'50%',objectFit:'cover',display:'block'}}/> : <MetalIcon name="user" size={34}/>}</div>
        <div className="chat-instructor-info">
          <div className="chat-instructor-name">{title || who?.name || (salonOn ? "Салон" : "Майстер")}</div>
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
                style={{ fontSize: 11, padding: '3px 8px', background: 'var(--field-bg)', color: 'var(--dim)', border: '1px solid var(--field-bd)', borderRadius: 6, cursor: 'pointer' }}
                onClick={() => setClearPending(false)}
              >Ні</button>
            </div>
          ) : (
            <button onClick={handleClear} aria-label="Очистити чат" title="Очистити чат" style={{ background:'none', border:'none', color:'var(--dim)', fontSize:20, lineHeight:1, padding:'6px 8px', cursor:'pointer' }}>⋯</button>
          )
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon"><MetalIcon name="chat" size={48}/></div>
            <div className="chat-empty-title">Почніть розмову</div>
            <div className="chat-empty-sub">Напишіть майстру будь-яке питання</div>
          </div>
        )}
        {messages.map(m => {
          const isMe = m.from === 'student'
          const isBroadcast = m.broadcast
          return (
            <div key={m.id} className={`chat-msg-row ${isMe ? 'out' : 'in'}`}>
              {!isMe && <div className="chat-msg-avatar instructor">{salonOn ? <MetalIcon name="user" size={22}/> : <MetalIcon name="user" size={22}/>}</div>}
              <div className={`chat-bubble ${isMe ? 'bubble-out' : isBroadcast ? 'bubble-broadcast' : 'bubble-in'}`}>
                {isBroadcast && <div className="bubble-broadcast-label"><span style={{display:'inline-flex',alignItems:'center',gap:5}}><MetalIcon name="mega" size={16}/>Оголошення</span></div>}
                {/* ім'я майстра салону, якщо написав він, а не власник */}
                {!isMe && !isBroadcast && m.senderName && <div className="bubble-broadcast-label">{m.senderName}</div>}
                <div className="bubble-text">{m.text}</div>
                <div className="bubble-time">
                    {m.editedAt ? `ред. ${fmtTime(m.editedAt)} · ` : ''}{m.time}
                    {isMe && !m.broadcast && Date.now() - (m.ts || 0) < EDIT_WINDOW && (
                      <button className="bubble-edit" onClick={() => startEdit(m)} aria-label="Редагувати"><MetalIcon name="edit" size={14} color="currentColor"/></button>
                    )}
                  </div>
              </div>
              {isMe && <MetalIcon square size={28} color="#c2410c">{initials}</MetalIcon>}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <div style={{display:'flex',gap:5,padding:'0 0 7px',overflowX:'auto',scrollbarWidth:'none'}}>
          {['Підтверджую ✅','Скасовую ❌','Запізнюся ⏱','Дякую! 🙏','Коли наступний запис?'].map(q => (
            <button key={q} onClick={() => setText(q)} style={{
              flexShrink:0,fontSize:11,padding:'5px 11px',minHeight:32,borderRadius:20,
              border:'1px solid var(--field-bd)',background:'var(--field-bg)',
              color:'var(--dim)',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap',
            }}>{q}</button>
          ))}
        </div>
        {editing && (
          <div className="chat-edit-bar">
            <span style={{display:'inline-flex',alignItems:'center',gap:6}}><MetalIcon name="edit" size={16}/>Редагування повідомлення</span>
            <button onClick={cancelEdit} aria-label="Скасувати">✕</button>
          </div>
        )}
        <div className="chat-input-box">
          <textarea
            ref={taRef}
            className="chat-textarea"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Напишіть повідомлення…"
            maxLength={4000}
            rows={1}
          />
          <button
            className={`chat-send-btn ${text.trim() ? 'active' : ''}`}
            aria-label="Надіслати"
            onClick={send}
            disabled={!text.trim() || sending}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ChatTab({ user, profile, threads = {}, unreadSalon = 0 }) {
  // Тред «Салон» ('') + по треду на кожного майстра, у якого є запис. Без майстрів — один тред, як і раніше.
  const want = new URLSearchParams(useLocation().search).get('m') // push відкриває тред цього майстра
  const [sel, setSel] = useState(null)
  const ready = threads.ready
  const list = threads.threads || []
  useEffect(() => {
    if (sel !== null || !ready) return
    const firstUnread = list.find(t => (threads.unread?.[t.id] || 0) > 0)
    if (want && list.some(t => t.id === want)) setSel(want)
    else if (!unreadSalon && firstUnread) setSel(firstUnread.id)
    else setSel('')
  }, [ready, sel, want, list.length, unreadSalon])
  const active = sel !== null && list.some(t => t.id === sel) ? sel : ''
  const th = list.find(t => t.id === active)
  return (
    <div className="chat-tab">
      {list.length > 0 && (
        <div className="chat-tabs" style={{ overflowX: 'auto' }}>
          {[{ id: '', name: 'Салон' }, ...list].map(t => {
            const n = t.id ? (threads.unread?.[t.id] || 0) : unreadSalon
            return (
              <button key={t.id || 'salon'} className={`chat-tab-btn${t.id === active ? ' active' : ''}`}
                style={{ flex: '1 0 auto', whiteSpace: 'nowrap' }} onClick={() => setSel(t.id)}>
                {t.name}{n > 0 && t.id !== active ? ` · ${n}` : ''}
              </button>
            )
          })}
        </div>
      )}
      <DirectChat key={active || 'salon'} user={user} profile={profile} mid={active || undefined} title={th ? th.name : undefined} />
    </div>
  )
}
