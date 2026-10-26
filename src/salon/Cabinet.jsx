// Кабінет клієнта: вкладки Записи / Чат / Сповіщення / Профіль (+ швидкий запис). Вхід — вбудований.
import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { query, orderByChild, equalTo } from 'firebase/database'
import { useSalon } from './ctx'
import { sref, useValue, useValues, toList } from './data'
import { registerClientPush, onSalonForegroundPush, pushPermission } from './push'
import ClientAuth from './ClientAuth'
import MyBookings from './MyBookings'
import ChatTab from './ChatTab'
import NotifTab from './NotifTab'
import ProfileTab from './ProfileTab'
import BookFlow from './BookFlow'
import { Card, Empty, Spinner } from './kit'

const TABS = [['bookings', '📋', 'Записи'], ['chat', '💬', 'Чат'], ['notifs', '🔔', 'Сповіщ.'], ['profile', '👤', 'Профіль']]

export default function Cabinet() {
  const ctx = useSalon()
  const { salonId, user, uProfile, uProfileReady, authReady, profile, ready, missing, noSlug, toast, slug } = ctx
  const nav = useNavigate()
  const { tab: tabParam } = useParams()
  const tab = TABS.some((t) => t[0] === tabParam) ? tabParam : 'bookings'
  const [chatMaster, setChatMaster] = useState(undefined)
  const [flow, setFlow] = useState(false)
  const signedIn = !!user && !!uProfile

  const q = useValue(() => (signedIn ? query(sref(salonId, 'bookings'), orderByChild('clientUid'), equalTo(user.uid)) : null), [salonId, user?.uid, signedIn])
  const bookings = useMemo(() => toList(q.value).filter((b) => b.clientUid === user?.uid && b.status !== 'personal'), [q.value, user?.uid])
  const mids = useMemo(() => [...new Set(bookings.map((b) => b.masterId).filter(Boolean))], [bookings])
  const salonMeta = useValue(() => (signedIn ? sref(salonId, `chatMeta/${user.uid}`) : null), [salonId, user?.uid, signedIn])
  const mMeta = useValues(mids.map((id) => ({ id, ref: sref(salonId, `masterChatMeta/${id}/${user?.uid}`) })), [salonId, user?.uid, mids.join(',')])
  const unread = useMemo(() => ({ salon: salonMeta.value?.unreadForClient || 0, ...Object.fromEntries(mids.map((id) => [id, mMeta[id]?.unreadForClient || 0])) }), [salonMeta.value, mMeta, mids])
  const unreadTotal = Object.values(unread).reduce((s, n) => s + n, 0)

  useEffect(() => { if (signedIn && pushPermission() === 'granted') registerClientPush(salonId, user.uid) }, [signedIn, salonId, user?.uid])
  useEffect(() => onSalonForegroundPush((p) => toast(`${p.data?.title || 'Сповіщення'}${p.data?.body ? ' — ' + p.data.body.split('\n')[0] : ''}`)), [toast])

  if (noSlug) return <Empty icon="💈" text="Відкрийте посилання для запису, яке дав вам салон" />
  if (missing) return <Empty icon="🔍" text="Салон не знайдено" />
  if (!ready || !authReady || !uProfileReady) return <Spinner />
  const go = (t) => { setChatMaster(undefined); nav(`/cabinet/${t}`) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(10px + env(safe-area-inset-top,0px)) 14px 8px', flexShrink: 0 }}>
        <button onClick={() => nav(`/s/${slug}`)} aria-label="До сторінки салону" style={{ width: 38, height: 38, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 18, cursor: 'pointer' }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 16, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name}</div><div style={{ fontSize: 11.5, color: 'var(--dim)' }}>Мій кабінет</div></div>
        {signedIn && <button onClick={() => setFlow(true)} style={{ border: 'none', borderRadius: 11, padding: '9px 13px', background: 'linear-gradient(145deg,var(--acc-hi),var(--accent))', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>＋ Записатись</button>}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 14px calc(88px + env(safe-area-inset-bottom,0px))', maxWidth: 640, width: '100%', margin: '0 auto', zoom: 'var(--ui-zoom, 1)' }}>
        {!signedIn ? <Card style={{ padding: '16px 16px' }}><ClientAuth /></Card> : (
          tab === 'bookings' ? <MyBookings bookings={bookings} loading={q.loading} openChat={(id) => { setChatMaster(id); nav('/cabinet/chat') }} />
            : tab === 'chat' ? <ChatTab bookings={bookings} initialMaster={chatMaster} unread={unread} />
              : tab === 'notifs' ? <NotifTab /> : <ProfileTab />
        )}
      </div>
      <nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100, padding: '0 3px max(10px, calc(env(safe-area-inset-bottom) - 20px))', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', overflow: 'visible', pointerEvents: 'auto', background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: 26, border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 40px rgba(0,0,0,0.65), 0 4px 16px rgba(0,0,0,0.4)' }}>
          {[...TABS.slice(0, 2), null, ...TABS.slice(2)].map((t) => {
            if (!t) return (
              <div key="fab" style={{ flex: '1 1 0', minWidth: 0, display: 'flex', justifyContent: 'center', position: 'relative' }}>
                {signedIn && <button onClick={() => setFlow(true)} aria-label="Записатись" style={{ position: 'absolute', top: -36, width: 78, height: 78, borderRadius: '50%', background: 'linear-gradient(155deg,var(--acc-hi),var(--accent))', border: '5px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 10px 28px rgba(255,90,60,0.5)', zIndex: 2 }}>
                  <svg width="33" height="33" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
                </button>}
              </div>
            )
            const [id, icon, label] = t
            const on = tab === id
            return (
              <button key={id} onClick={() => go(id)} style={{ flex: '1 1 0', minWidth: 0, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 2px 9px', position: 'relative' }}>
                <div style={{ fontSize: 18, lineHeight: 1.2, opacity: on ? 1 : 0.55, transform: on ? 'scale(1.1)' : 'none', transition: 'transform .15s, opacity .15s' }}>{icon}</div>
                <div style={{ fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', color: on ? 'var(--accent)' : 'rgba(255,255,255,0.45)' }}>{label}</div>
                {id === 'chat' && unreadTotal > 0 && <span style={{ position: 'absolute', top: 0, right: '30%', background: 'var(--accent)', color: '#fff', borderRadius: 10, padding: '1px 5px', fontSize: 9, fontWeight: 800 }}>{unreadTotal}</span>}
              </button>
            )
          })}
        </div>
      </nav>
      {flow && <BookFlow onClose={() => setFlow(false)} />}
    </div>
  )
}
