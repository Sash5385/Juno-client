// Доступ клієнта до даних салону (salons/{salonId}/…). Правила: docs у репо адмінки Juno (docs/SALON-SCHEMA.md).
import { useEffect, useState } from 'react'
import { ref, get, onValue, update, set, push, increment, query, orderByChild, equalTo, limitToLast } from 'firebase/database'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '../firebase/config'
import { salonPath, salonSlugPath } from '../salonPaths'

export const SLUG_KEY = 'jn_salon_slug'
export const sref = (salonId, path) => ref(db, salonPath(salonId, path))
export const toList = (o) => Object.entries(o || {}).map(([id, v]) => ({ id, ...(v && typeof v === 'object' ? v : {}) }))

export function useAuthUser() {
  const [user, setUser] = useState(undefined)
  useEffect(() => {
    const t = setTimeout(() => setUser((p) => (p === undefined ? null : p)), 3000)
    const off = onAuthStateChanged(auth, (u) => { clearTimeout(t); setUser(u || null) })
    return () => { clearTimeout(t); off() }
  }, [])
  return user
}

// Підписка на вузол/запит; makeRef() → ref | null
export function useValue(makeRef, deps) {
  const key = JSON.stringify(deps)
  const [st, setSt] = useState({ key: null, value: undefined })
  useEffect(() => {
    const r = makeRef()
    if (!r) { queueMicrotask(() => setSt({ key, value: null })); return undefined }
    const off = onValue(r, (s) => setSt({ key, value: s.val() }), () => setSt({ key, value: null }))
    return () => { try { off() } catch { /* ignore */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return { value: st.key === key ? st.value : undefined, loading: st.key !== key }
}

export async function resolveSalon(slug) {
  const s = (await get(ref(db, salonSlugPath(slug)))).val()
  const salonId = s?.salonId || (typeof s === 'string' ? s : null)
  if (!salonId) return null
  const profile = (await get(sref(salonId, 'profile'))).val()
  return profile ? { salonId, profile } : null
}

// Клієнт має існувати в салоні (users/{uid}), інакше правила не дадуть писати в чат. Створюємо анкету при першому вході.
export async function ensureSalonUser(salonId, user) {
  const p = sref(salonId, `users/${user.uid}/profile`)
  if ((await get(p)).exists()) return
  await set(p, { name: user.displayName || (user.email || '').split('@')[0] || 'Клієнт', email: user.email || null, phone: user.phoneNumber || null, createdAt: Date.now() })
}

export const bookingsQuery = (salonId, uid) => query(sref(salonId, 'bookings'), orderByChild('clientUid'), equalTo(uid))
export const confirmBooking = (salonId, id) => update(sref(salonId, `bookings/${id}`), { clientConfirmed: true })
export const rateBooking = (salonId, id, rating) => update(sref(salonId, `bookings/${id}`), { rating })

export const chatQuery = (salonId, masterId, uid) => query(sref(salonId, `masterChats/${masterId}/${uid}`), limitToLast(100))
export const markChatRead = (salonId, masterId, uid) => update(sref(salonId, `masterChatMeta/${masterId}/${uid}`), { unreadForClient: 0 }).catch(() => {})
// Повідомлення клієнта майстру (+ метадані чату для списку в адмінці й лічильник непрочитаних майстра)
export async function sendChat(salonId, masterId, uid, name, text, extra = {}) {
  const ts = Date.now()
  await push(sref(salonId, `masterChats/${masterId}/${uid}`), { from: 'client', text, name, ts, time: new Date(ts).toLocaleTimeString('uk', { hour: '2-digit', minute: '2-digit' }), ...extra })
  await update(sref(salonId, `masterChatMeta/${masterId}/${uid}`), { lastMsg: text, lastTs: ts, name, unreadForMaster: increment(1), unreadForClient: 0 })
}

// «Перенести» з нагадування/картки запису: одне повідомлення майстру на запис (повторне натискання нічого не дублює)
import { hasRescheduleRequest, rescheduleText } from './logic'
export async function requestReschedule(salonId, uid, name, b) {
  const snap = await get(chatQuery(salonId, b.masterId, uid))
  if (hasRescheduleRequest(toList(snap.val()), b.id)) return false
  await sendChat(salonId, b.masterId, uid, name, rescheduleText(b), { kind: 'reschedule_request', bookingId: b.id })
  return true
}
