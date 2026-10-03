// Чат: з салоном і з майстрами, у яких були записи
import { useState, useEffect, useRef, useMemo } from 'react'
import { query, limitToLast } from 'firebase/database'
import { useSalon } from './ctx'
import { sref, useValue, toList } from './data'
import { sendMessage, markChatRead } from './actions'
import { Card, Empty, Spinner, initials } from './kit'

export default function ChatTab({ bookings, initialMaster, unread }) {
  const { salonId, user, uProfile, masters, profile } = useSalon()
  const [open, setOpen] = useState(initialMaster !== undefined ? { masterId: initialMaster || null } : null)
  const mids = useMemo(() => [...new Set(bookings.map((b) => b.masterId).filter(Boolean))], [bookings])
  const nameOf = (id) => masters.find((m) => m.id === id)?.name || 'Майстер'
  if (open) return <Thread masterId={open.masterId} title={open.masterId ? nameOf(open.masterId) : profile.name || 'Салон'} onBack={() => setOpen(null)} />
  const rows = [{ key: 'salon', masterId: null, title: profile.name || 'Салон', sub: 'Адміністратор салону', icon: '💈' }, ...mids.map((id) => ({ key: id, masterId: id, title: nameOf(id), sub: 'Ваш майстер', icon: initials(nameOf(id)) }))]
  return (
    <div>
      {rows.map((r) => (
        <Card key={r.key} onClick={() => setOpen({ masterId: r.masterId })} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: 'color-mix(in srgb, var(--blue) 22%, transparent)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{r.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 800 }}>{r.title}</div><div style={{ fontSize: 12.5, color: 'var(--dim)' }}>{r.sub}</div></div>
            {(unread[r.masterId || 'salon'] || 0) > 0 && <span style={{ minWidth: 20, height: 20, borderRadius: 10, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{unread[r.masterId || 'salon']}</span>}
          </div>
        </Card>
      ))}
      {!uProfile && !user && <Empty text="Увійдіть, щоб писати салону" />}
    </div>
  )
}

function Thread({ masterId, title, onBack }) {
  const { salonId, user, uProfile, toast } = useSalon()
  const base = masterId ? `masterChats/${masterId}/${user.uid}` : `chats/${user.uid}`
  const msgs = useValue(() => query(sref(salonId, base), limitToLast(100)), [salonId, base])
  const [text, setText] = useState('')
  const endRef = useRef(null)
  const list = useMemo(() => toList(msgs.value).sort((a, b) => (a.ts || 0) - (b.ts || 0)), [msgs.value])
  useEffect(() => { markChatRead(salonId, user.uid, masterId) }, [salonId, user.uid, masterId, list.length])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [list.length])
  const send = async () => {
    const t = text.trim(); if (!t) return
    setText('')
    try { await sendMessage({ salonId, uid: user.uid, name: uProfile?.name || 'Клієнт', masterId, text: t }) } catch { toast('Не вдалося надіслати', 'err'); setText(t) }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 190px)', minHeight: 300 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <button onClick={onBack} aria-label="Назад" style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 18, cursor: 'pointer' }}>‹</button>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {msgs.loading ? <Spinner /> : list.length === 0 ? <Empty icon="💬" text="Напишіть перше повідомлення" /> : list.map((m) => {
          const mine = m.from === 'client'
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
              <div style={{ maxWidth: '82%', padding: '9px 12px', borderRadius: 15, fontSize: 14, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: mine ? 'color-mix(in srgb, var(--accent) 28%, transparent)' : 'var(--surface)', border: '1px solid var(--border)' }}>
                {m.text}<div style={{ fontSize: 10, color: 'var(--faint)', textAlign: 'right', marginTop: 2 }}>{m.time || ''}</div>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Повідомлення…" style={{ flex: 1, minWidth: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13, padding: '12px 13px', color: 'var(--text)', fontSize: 15, outline: 'none', fontFamily: 'inherit' }} />
        <button onClick={send} disabled={!text.trim()} style={{ width: 48, border: 'none', borderRadius: 13, background: text.trim() ? 'var(--accent)' : 'var(--surface)', color: '#fff', fontSize: 18, cursor: 'pointer' }}>➤</button>
      </div>
    </div>
  )
}
