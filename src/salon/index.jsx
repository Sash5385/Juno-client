// Клієнтський застосунок салону (режим VITE_APP_MODE=salon / ?app=salon). Маршрути:
//   /s/{slug} — сторінка салону з майстрами і їхнім рейтингом · /cabinet/bookings — мої записи · /cabinet/chat[?master=id] — чат з майстром.
// Застосунок клієнта інструктора Juno не змінюється: цей модуль вантажиться окремим чанком лише в режимі салону.
import { useEffect, useMemo, useState, useCallback } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { signInWithEmail, signUpWithEmail, signInWithGoogle, signOut } from '../firebase/auth-email'
import { useAuthUser, resolveSalon, ensureSalonUser, bookingsQuery, useValue, toList, sref, SLUG_KEY } from './data'
import Bookings from './Bookings'
import Chat from './Chat'
import { isCancelled } from './logic'
import './salon.css'

const storedSlug = () => { try { return localStorage.getItem(SLUG_KEY) } catch { return null } }
const slugOf = (path) => /^\/s\/([^/]+)/.exec(path)?.[1] || null

function SignIn({ toast }) {
  const [f, setF] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const run = (fn) => async () => { setBusy(true); try { await fn() } catch (e) { toast(e?.code === 'auth/invalid-credential' ? 'Невірний email або пароль' : 'Не вдалося увійти') } finally { setBusy(false) } }
  return (
    <div className="sl-card">
      <div className="sl-title" style={{ marginBottom: 8 }}>Увійдіть, щоб бачити записи й чат з майстром</div>
      <input className="sl-field" type="email" autoComplete="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <input className="sl-field" type="password" autoComplete="current-password" placeholder="Пароль" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      <div className="sl-actions">
        <button className="sl-btn" disabled={busy || !f.email || f.password.length < 6} onClick={run(() => signInWithEmail(f.email.trim(), f.password))}>Увійти</button>
        <button className="sl-btn ghost" disabled={busy || !f.email || f.password.length < 6} onClick={run(() => signUpWithEmail(f.email.trim(), f.password))}>Створити акаунт</button>
        <button className="sl-btn ghost" disabled={busy} onClick={run(signInWithGoogle)}>Google</button>
      </div>
    </div>
  )
}

function Home({ salon, masters }) {
  const p = salon.profile
  return (
    <>
      {p.about && <div className="sl-card sl-dim">{p.about}</div>}
      {(p.phone || p.address) && <div className="sl-card sl-dim">{p.address}{p.address && p.phone ? ' · ' : ''}{p.phone && <a href={`tel:${p.phone}`} style={{ color: 'var(--blue)' }}>{p.phone}</a>}</div>}
      <div className="sl-sub" style={{ margin: '6px 0' }}>Майстри</div>
      {masters.filter((m) => m.profile?.active !== false).map((m) => (
        <div className="sl-card sl-row" key={m.id}>
          <div className="sl-grow"><div className="sl-title">{m.profile?.name || 'Майстер'}</div><div className="sl-dim">{m.profile?.spec || ''}</div></div>
          {m.rating?.count > 0 ? <div style={{ textAlign: 'right' }}><div className="sl-star">★ {m.rating.avg}</div><div className="sl-dim">{m.rating.count} оцінок</div></div> : <div className="sl-dim">без оцінок</div>}
        </div>
      ))}
    </>
  )
}

function ChatList({ ctx, masters, bookings }) {
  const nav = useNavigate()
  const ids = [...new Set(bookings.map((b) => b.masterId).filter(Boolean))]
  if (!ids.length) return <div className="sl-dim" style={{ textAlign: 'center', padding: 32 }}>Чати з’являться після першого запису</div>
  return ids.map((id) => {
    const m = masters.find((x) => x.id === id)
    return <ThreadRow key={id} ctx={ctx} id={id} name={m?.profile?.name || 'Майстер'} onOpen={() => nav(`/cabinet/chat?master=${id}`)} />
  })
}
function ThreadRow({ ctx, id, name, onOpen }) {
  const meta = useValue(() => sref(ctx.salonId, `masterChatMeta/${id}/${ctx.user.uid}`), [ctx.salonId, id, ctx.user.uid]).value
  return (
    <div className="sl-card sl-row" onClick={onOpen} style={{ cursor: 'pointer' }}>
      <div className="sl-grow"><div className="sl-title">{name}</div><div className="sl-dim" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta?.lastMsg || 'Написати майстру'}</div></div>
      {meta?.unreadForClient > 0 && <span className="sl-pill" style={{ background: 'var(--accent)', color: '#fff' }}>{meta.unreadForClient}</span>}
    </div>
  )
}

export default function SalonClientApp() {
  const user = useAuthUser()
  const loc = useLocation()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const slug = slugOf(loc.pathname) || storedSlug()
  const [salon, setSalon] = useState({ loading: true, data: null })
  const [ready, setReady] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)
  const toast = useCallback((m) => { setToastMsg(m); setTimeout(() => setToastMsg(null), 3200) }, [])

  useEffect(() => {
    let dead = false
    if (!slug) { setSalon({ loading: false, data: null }); return undefined }
    try { localStorage.setItem(SLUG_KEY, slug) } catch { /* ignore */ }
    resolveSalon(slug).then((d) => !dead && setSalon({ loading: false, data: d })).catch(() => !dead && setSalon({ loading: false, data: null }))
    return () => { dead = true }
  }, [slug])

  const salonId = salon.data?.salonId
  useEffect(() => {
    if (!user || !salonId) { setReady(false); return undefined }
    let dead = false
    ensureSalonUser(salonId, user).then(() => !dead && setReady(true)).catch(() => !dead && toast('Не вдалося відкрити кабінет'))
    return () => { dead = true }
  }, [user, salonId, toast])

  const mst = useValue(() => (salonId ? sref(salonId, 'masters') : null), [salonId])
  const masters = useMemo(() => toList(mst.value).sort((a, b) => (a.profile?.order ?? 0) - (b.profile?.order ?? 0)), [mst.value])
  const bk = useValue(() => (ready && salonId ? bookingsQuery(salonId, user.uid) : null), [ready, salonId, user?.uid])
  const bookings = useMemo(() => toList(bk.value), [bk.value])

  if (salon.loading || user === undefined) return <div className="sl-wrap"><div className="sl-dim" style={{ padding: 40, textAlign: 'center' }}>Завантаження…</div></div>
  if (!salon.data) return <div className="sl-wrap"><div className="sl-head"><h1>Салон не знайдено</h1><div className="sl-sub">Відкрийте посилання, яке надав салон (…/s/назва).</div></div></div>

  const name = user?.displayName || user?.email?.split('@')[0] || 'Клієнт'
  const ctx = { salonId, user, name, toast }
  const master = params.get('master')
  const pendingCnt = bookings.filter((b) => !isCancelled(b) && b.status === 'pending').length
  return (
    <div className="sl-wrap">
      <div className="sl-head"><h1>{salon.data.profile.name || 'Салон'}</h1><div className="sl-sub">{user ? name : 'Гість'}</div></div>
      {!user && loc.pathname !== `/s/${slug}` && <SignIn toast={toast} />}
      <Routes>
        <Route path="/s/:slug" element={<><Home salon={salon.data} masters={masters} />{!user && <SignIn toast={toast} />}</>} />
        <Route path="/cabinet/bookings" element={user && ready ? <Bookings ctx={ctx} bookings={bookings} masters={masters} /> : !user ? null : <div className="sl-dim">Завантаження…</div>} />
        <Route path="/cabinet/chat" element={user && ready ? (master ? <Chat key={master} ctx={ctx} masterId={master} bookings={bookings} /> : <ChatList ctx={ctx} masters={masters} bookings={bookings} />) : !user ? null : <div className="sl-dim">Завантаження…</div>} />
        <Route path="*" element={<Navigate to={`/s/${slug}`} replace />} />
      </Routes>
      <nav className="sl-nav">
        <button className="sl-btn ghost" onClick={() => nav(`/s/${slug}`)}>💈 Салон</button>
        <button className="sl-btn ghost" onClick={() => nav('/cabinet/bookings')}>📋 Записи{pendingCnt ? ` · ${pendingCnt}` : ''}</button>
        <button className="sl-btn ghost" onClick={() => nav('/cabinet/chat')}>💬 Чат</button>
        {user && <button className="sl-btn ghost" aria-label="Вийти" onClick={() => signOut()}>⎋</button>}
      </nav>
      {toastMsg && <div className="sl-toast" role="status">{toastMsg}</div>}
    </div>
  )
}
