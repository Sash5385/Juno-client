import {
  ref, get, set, update, push, onValue, off, remove, increment, onDisconnect, runTransaction
} from 'firebase/database'
import { db } from './config'
import { blockRangeUpdates, restoreRangeUpdates } from '../utils/slotRules'

// ─── МУЛЬТИТЕНАНТНІСТЬ ──────────────────────────────────────────────
// Один застосунок обслуговує студентів БАГАТЬОХ інструкторів — кожен
// інструктор це instructors/{iid} в базі (iid = його Firebase Auth uid).
// Поточний iid визначається один раз при заході (посилання /i/{slug} або
// збережений з попереднього візиту) і зберігається тут на весь сеанс.
const IID_KEY = 'dp_tenant_iid'
const SLUG_KEY = 'dp_tenant_slug'
let _iid = null
let _slug = null

const TENANT_COOKIE = 'dp_tenant'

// Дублюємо інструктора в cookie: iPhone при додаванні на екран Домой копіює cookie
// Safari у сховище ярлика (localStorage НЕ копіюється) — так ярлик відкривається вже
// прив'язаним до інструктора, навіть якщо адреса запуску втратила /i/{slug}.
function writeTenantCookie(iid, slug) {
  try {
    if (iid) document.cookie = `${TENANT_COOKIE}=${encodeURIComponent(iid + '|' + (slug || ''))}; max-age=31536000; path=/; SameSite=Lax`
    else document.cookie = `${TENANT_COOKIE}=; max-age=0; path=/`
  } catch {}
}
function readTenantCookie() {
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + TENANT_COOKIE + '=([^;]*)'))
    if (!m) return null
    const [iid, slug] = decodeURIComponent(m[1]).split('|')
    return iid ? { iid, slug: slug || null } : null
  } catch { return null }
}

export function setCurrentTenant(iid, slug) {
  _iid = iid || null
  _slug = slug || null
  try {
    if (_iid) localStorage.setItem(IID_KEY, _iid); else localStorage.removeItem(IID_KEY)
    if (_slug) localStorage.setItem(SLUG_KEY, _slug); else localStorage.removeItem(SLUG_KEY)
  } catch {}
  writeTenantCookie(_iid, _slug)
}

export function loadStoredTenant() {
  try {
    const iid = localStorage.getItem(IID_KEY)
    const slug = localStorage.getItem(SLUG_KEY)
    if (iid) { _iid = iid; _slug = slug || null; writeTenantCookie(_iid, _slug); return { iid, slug } }
  } catch {}
  const c = readTenantCookie()
  if (c) {
    _iid = c.iid; _slug = c.slug
    try { localStorage.setItem(IID_KEY, c.iid); if (c.slug) localStorage.setItem(SLUG_KEY, c.slug) } catch {}
    return c
  }
  return null
}

export function getCurrentIid() { return _iid }
export function getCurrentSlug() { return _slug }

// Резолвить посилання-запрошення інструктора (/i/{slug}) в його iid.
// Читання публічне (slugs/.read: true в database.rules.json) — не потребує авторизації.
export async function resolveSlug(slug) {
  const snap = await get(ref(db, `slugs/${slug}`))
  return snap.exists() ? snap.val()?.iid || null : null
}

export const iRef = (path) => ref(db, _iid ? `instructors/${_iid}${path ? '/' + path : ''}` : '/__no_tenant__')

// ─── ACCESS CONTROL ─────────────────────────────────────
// Заблокований адміном учень не бачить явного повідомлення про блок —
// замість цього розклад виглядає повністю зайнятим, а приєднання до черги
// мовчки нічого не записує. Прапорець виставляється в getUserProfile()
// (викликається завжди тільки для поточного залогіненого користувача).
let _blocked = false
function maskSlotsIfBlocked(slotsObj) {
  if (!_blocked || !slotsObj) return slotsObj
  const out = {}
  Object.entries(slotsObj).forEach(([k, s]) => { out[k] = { ...s, available: false } })
  return out
}

// в”Ђв”Ђв”Ђ USERS в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
export async function getUserProfile(uid) {
  const snap = await get(iRef(`users/${uid}`))
  if (!snap.exists()) { _blocked = false; return null }
  const data = snap.val()
  _blocked = !!data.blocked
  return { ...(data.profile || {}), isVip: data.isVip || false, discount: data.discount || 0, hoursOffset: data.hoursOffset || 0, lessonBalance: data.lessonBalance || 0 }
}

export async function saveUserProfile(uid, profile) {
  await set(iRef(`users/${uid}/profile`), {
    ...profile,
    updatedAt: Date.now()
  })
}

export async function updateUserProfile(uid, patch) {
  await update(iRef(`users/${uid}/profile`), patch)
}

// в”Ђв”Ђв”Ђ TIMESLOTS в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
export async function getSlotsForDate(date) {
  // date Сѓ С„РѕСЂРјР°С‚С– YYYY-MM-DD
  const snap = await get(iRef(`timeslots/${date}`))
  return maskSlotsIfBlocked(snap.exists() ? snap.val() : {})
}

// Найближчі вільні слоти для тизера на лендингу — публічний запит,
// без прив'язки до конкретного учня (маскування заблокованих тут не
// потрібне: незалогінений відвідувач ще не має _blocked).
export async function getUpcomingFreeSlots(limit = 6) {
  const snap = await get(iRef('timeslots'))
  if (!snap.exists()) return []
  const all = snap.val()
  const now = new Date()
  const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const result = []
  for (const date of Object.keys(all).filter(d => d >= todayYMD).sort()) {
    const slotsObj = all[date]
    if (!slotsObj) continue
    const times = Object.entries(slotsObj)
      .filter(([key, s]) => /^slot\d{4}$/.test(key) && s && s.available !== false && !s.adminBlocked)
      .map(([key]) => `${key.slice(4, 6)}:${key.slice(6, 8)}`)
      .filter(time => {
        if (date !== todayYMD) return true
        const [h, m] = time.split(':').map(Number)
        return h * 60 + m > nowMin
      })
      .sort()
    for (const time of times) {
      result.push({ date, time })
      if (result.length >= limit) return result
    }
  }
  return result
}

function classifyDay(slotsObj) {
  if (!slotsObj) return null
  const slots = Object.values(slotsObj).filter(s => s && s.time && !s.adminBlocked)
  if (slots.length === 0) return null
  const free  = slots.filter(s => s.available !== false).length
  const taken = slots.filter(s => s.available === false).length
  if (taken === 0) return 'free'
  if (free  === 0) return 'full'
  return 'partial'
}

export function subscribeMonthAvailability(year, month, callback) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
  const r = iRef('timeslots')
  const handler = onValue(r, snap => {
    const all = snap.val() || {}
    const result = {}
    Object.entries(all).forEach(([date, slotsObj]) => {
      if (date.startsWith(prefix)) result[date] = classifyDay(maskSlotsIfBlocked(slotsObj))
    })
    callback(result)
  })
  return () => off(r, 'value', handler)
}

export function subscribeSlotsForDate(date, callback) {
  const r = iRef(`timeslots/${date}`)
  const handler = onValue(r, snap => {
    callback(maskSlotsIfBlocked(snap.exists() ? snap.val() : {}))
  })
  return () => off(r, 'value', handler)
}

// в”Ђв”Ђв”Ђ BOOKINGS в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
export function subscribeMyBookings(uid, _phone, callback) {
  const r = iRef(`bookings/${uid}`)
  const handler = onValue(r, snap => {
    callback(snap.exists() ? Object.entries(snap.val()).map(([id, b]) => ({ id, ...b })) : [])
  })
  return () => off(r, 'value', handler)
}

export async function createBooking(uid, booking) {
  if (_blocked) throw new Error('Не вдалося виконати запис, спробуйте пізніше')
  const r = push(iRef(`bookings/${uid}`))
  const clean = Object.fromEntries(Object.entries(booking).filter(([,v]) => v !== undefined))
  await set(r, {
    ...clean,
    id: r.key,
    status: 'pending',
    createdAt: Date.now()
  })
  push(iRef('newBookingAlerts'), {
    uid,
    date: booking.date,
    time: booking.time,
    studentName: booking.studentName || '',
    serviceName: booking.serviceName || '',
    ts: Date.now(),
  }).catch(() => {})
  return r.key
}

export async function confirmAttendance(uid, bookingId) {
  await update(iRef(`bookings/${uid}/${bookingId}`), { studentConfirmed: true })
}

export async function rateBooking(uid, bookingId, rating) {
  await update(iRef(`bookings/${uid}/${bookingId}`), { rating })
}

export async function saveGoals(uid, bookingId, goals) {
  await update(iRef(`bookings/${uid}/${bookingId}`), { goals: goals.length ? goals : null })
}

export async function saveStudentNote(uid, bookingId, note) {
  await update(iRef(`bookings/${uid}/${bookingId}`), { studentNote: note || null })
}

export async function cancelBooking(uid, bookingId, { isReschedule = false } = {}) {
  const snap = await get(iRef(`bookings/${uid}/${bookingId}`))
  const booking = snap.val()
  if (!booking) return

  await update(iRef(`bookings/${uid}/${bookingId}`), {
    status: 'cancelled',
    cancelledAt: Date.now(),
    cancelledBy: isReschedule ? 'reschedule' : 'student',
  })

  // Повертаємо день до стану ДО запису: phantom видаляємо, справжні слоти
  // відновлюємо, відсутні не створюємо (єдині правила — utils/slotRules.js)
  if (booking.date && booking.time) {
    const [h, m] = booking.time.split(':').map(Number)
    const startMin = h * 60 + m
    const durMin = (booking.durationHours || 1) * 60
    const daySnap = await get(iRef(`timeslots/${booking.date}`))
    const updates = restoreRangeUpdates(daySnap.val() || {}, `timeslots/${booking.date}/`, startMin, durMin)
    if (Object.keys(updates).length) await update(iRef(""), updates)
  }
}

// в”Ђв”Ђв”Ђ QUEUE (Р»РёСЃС‚ РѕС‡С–РєСѓРІР°РЅРЅСЏ) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
export async function joinQueue(uid, date, time, studentType, durationHours = 1, name = '', phone = '') {
  if (_blocked) throw new Error('Не вдалося приєднатись до черги, спробуйте пізніше')
  const slotKey = `${date}_${time}`
  await set(iRef(`queue/${slotKey}/entries/${uid}`), {
    uid,
    studentType,
    durationHours,
    name,
    phone,
    addedAt: Date.now(),
    status: 'waiting'
  })
}

export async function claimReservedSlot(date, time, uid) {
  const slotKey = `${date}_${time}`
  const slotId = `slot${time.replace(':', '')}`
  const updates = {}
  updates[`queue/${slotKey}/entries/${uid}/status`] = 'booked'
  updates[`timeslots/${date}/${slotId}/offeredTo/${uid}`] = null
  updates[`timeslots/${date}/${slotId}/reservedFor`] = null
  updates[`timeslots/${date}/${slotId}/reservedUntil`] = null
  await update(iRef(""), updates)
}

export async function leaveQueue(uid, date, time) {
  const slotKey = `${date}_${time}`
  await remove(iRef(`queue/${slotKey}/entries/${uid}`))
}

export async function getQueueForSlot(date, time) {
  const slotKey = `${date}_${time}`
  const snap = await get(iRef(`queue/${slotKey}/entries`))
  if (!snap.exists()) return []
  return Object.values(snap.val())
}

export function subscribeQueueForSlot(date, time, callback) {
  const slotKey = `${date}_${time}`
  const r = iRef(`queue/${slotKey}/entries`)
  const handler = onValue(r, snap => {
    if (!snap.exists()) return callback([])
    callback(Object.values(snap.val()))
  })
  return () => off(r, 'value', handler)
}

// в”Ђв”Ђв”Ђ HELPERS в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
export function getConfirmedSchoolHours(bookings) {
  return bookings
    .filter(b => b.serviceType === 'school' && (b.status === 'confirmed' || b.status === 'completed') && new Date(b.date) < new Date())
    .reduce((sum, b) => sum + (b.durationHours || 1), 0)
}

export function getCompletedHours(bookings) {
  return bookings
    .filter(b => b.status === 'confirmed' && new Date(b.date) < new Date())
    .reduce((sum, b) => sum + (b.durationHours || 1), 0)
}

// ─── TIMESLOTS ───────────────────────────────────────────────────
// Атомарно займає ВЕСЬ діапазон бронювання (кожні intervalMin хвилин,
// включно з проміжними "фантомними" слотами всередині години), а не
// лише стартовий слот. Раніше атомарно захоплювався тільки старт, а
// решта діапазону позначалась недоступною вже ПІСЛЯ createBooking()
// звичайним update() (markSlotsUnavailable) — у цьому вікні інший
// учень міг встигнути атомарно застовпити проміжний/наступний слот під
// власний запис, і обидва записи проходили одночасно на ту саму годину.
// Якщо хоч один слот у діапазоні вже зайнятий — звільняє всі раніше
// захоплені в цій же спробі й повертає false.
export async function claimSlot(date, startTime, durationHours = 1, intervalMin = 30) {
  if (_blocked) return false
  const [h, m] = startTime.split(':').map(Number)
  const startMin = h * 60 + m
  const endMin = startMin + durationHours * 60
  const claimedIds = []
  for (let min = startMin; min < endMin; min += intervalMin) {
    const slotH = String(Math.floor(min / 60)).padStart(2, '0')
    const slotM = String(min % 60).padStart(2, '0')
    const slotId = `slot${slotH}${slotM}`
    const slotRef = iRef(`timeslots/${date}/${slotId}`)
    const result = await runTransaction(slotRef, current => {
      if (current && current.available === false) {
        return undefined // вже зайнятий — скасувати транзакцію
      }
      // Документа не було (current === null) — він існує лише під цей запис: phantom,
      // щоб скасування видалило його, а не лишило окремим вільним слотом.
      return { ...(current || {}), ...(current ? {} : { phantom: true }), available: false, time: `${slotH}:${slotM}` }
    })
    if (!result.committed) {
      await Promise.all(claimedIds.map(id =>
        runTransaction(iRef(`timeslots/${date}/${id}`), current =>
          current ? (current.phantom ? null : { ...current, available: true }) : current
        ).catch(() => {})
      ))
      return false
    }
    claimedIds.push(slotId)
  }
  return true
}

// Позначає недоступними слоти діапазону БЕЗ атомарного захоплення —
// лише для випадку, коли перший слот діапазону вже гарантовано
// заброньований одержувачем через чергу (offeredTo/reservedFor
// блокує інших від початку), тож гонки за нього немає.
export async function markSlotsUnavailable(date, startTime, durationHours, intervalMin = 30) {
  const [h, m] = startTime.split(':').map(Number)
  const startMin = h * 60 + m
  const daySnap = await get(iRef(`timeslots/${date}`))
  const updates = blockRangeUpdates(daySnap.val() || {}, `timeslots/${date}/`, startMin, durationHours * 60, { step: intervalMin })
  await update(iRef(""), updates)
}

// ─── VIEWING (live presence on slot) ─────────────────────────────
export async function setViewingSlot(date, time, uid) {
  const slotId = `slot${time.replace(':', '')}`
  const r = iRef(`timeslots/${date}/${slotId}/viewing/${uid}`)
  await set(r, Date.now())
  onDisconnect(r).remove()
}

export async function clearViewingSlot(date, time, uid) {
  const slotId = `slot${time.replace(':', '')}`
  await remove(iRef(`timeslots/${date}/${slotId}/viewing/${uid}`))
}

// ─── QUEUE OFFERS ────────────────────────────────────────────────
export function subscribeQueueOffers(uid, callback) {
  const r = iRef(`users/${uid}/queueOffers`)
  const handler = onValue(r, snap => callback(snap.val() || {}))
  return () => off(r, 'value', handler)
}

export async function clearQueueOffer(uid, slotKey) {
  await remove(iRef(`users/${uid}/queueOffers/${slotKey}`))
}

export async function claimQueueOffer(uid, slotKey, offer, profile) {
  const entrySnap = await get(iRef(`queue/${slotKey}/entries/${uid}`))
  const entry = entrySnap.val()
  if (!entry) throw new Error('Queue entry not found')
  const durationHours = entry.durationHours || 1
  await createBooking(uid, {
    date: offer.date,
    time: offer.time,
    serviceType: entry.studentType,
    durationHours,
    studentName: entry.name || profile?.name || '',
    phone: entry.phone || profile?.phone || '',
  })
  await markSlotsUnavailable(offer.date, offer.time, durationHours, 30)
  await claimReservedSlot(offer.date, offer.time, uid)
  await clearQueueOffer(uid, slotKey)
}

export function subscribeUserQueue(uid, callback) {
  const r = iRef('queue')
  const handler = onValue(r, snap => {
    const data = snap.val() || {}
    const slots = []
    Object.entries(data).forEach(([slotKey, slotData]) => {
      const entry = slotData?.entries?.[uid]
      if (!entry) return
      const parts = slotKey.split('_')
      const date = parts[0]
      const time = parts.slice(1).join('_')
      slots.push({ slotKey, date, time, ...entry })
    })
    slots.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.time.localeCompare(b.time)
    })
    callback(slots)
  })
  return () => off(r, 'value', handler)
}

export async function declineQueueOffer(uid, slotKey, date, time) {
  const slotId = `slot${time.replace(':', '')}`
  await update(iRef(""), {
    [`queue/${slotKey}/entries/${uid}`]: null,
    [`timeslots/${date}/${slotId}/offeredTo/${uid}`]: null,
    [`users/${uid}/queueOffers/${slotKey}`]: null,
  })
}

// ─── ADMIN SETTINGS ──────────────────────────────────────────────
export async function getAdminSettings() {
  const snap = await get(iRef('admin_settings'))
  return snap.exists() ? snap.val() : { lunchEnabled: false, lunchStart: 12, lunchEnd: 13, workStart: 9, workEnd: 18, interval: 30 }
}

export async function getAdminServices() {
  const snap = await get(iRef('admin_data/services'))
  if (!snap.exists()) return []
  const val = snap.val()
  const arr = Array.isArray(val) ? val : Object.values(val)
  return arr.filter(s => s && s.active && !s.archived)
}

// ─── REVIEWS (публічні, для лендингу) ──────────────────────────────
// Те саме дерево reviews/{uid}/{id}, що читає адмінка (id4drive-settings.jsx
// toggleReviewHidden) — сюди ж вона пише status:"hidden" для схованих.
export async function getApprovedReviews(max = 12) {
  const snap = await get(iRef('reviews'))
  if (!snap.exists()) return []
  const data = snap.val()
  const list = []
  Object.entries(data).forEach(([uid, userReviews]) => {
    Object.entries(userReviews || {}).forEach(([id, v]) => {
      if (v && v.status !== 'hidden') list.push({ id, uid, ...v })
    })
  })
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  return list.slice(0, max)
}

// ─── CHAT ────────────────────────────────────────────────────────
export function subscribeStudentChat(uid, callback) {
  const r = iRef(`chats/${uid}`)
  const handler = onValue(r, snap => {
    const data = snap.val() || {}
    const msgs = Object.entries(data)
      .map(([id, m]) => ({ ...m, id }))
      .sort((a, b) => (a.ts || 0) - (b.ts || 0))
    callback(msgs)
  })
  return () => off(r, 'value', handler)
}

export async function sendStudentMessage(uid, text) {
  const time = new Date().toLocaleTimeString('uk', { hour: '2-digit', minute: '2-digit' })
  await push(iRef(`chats/${uid}`), {
    from: 'student',
    text,
    time,
    ts: Date.now(),
  })
  await update(iRef(`chatMeta/${uid}`), {
    unreadForAdmin: increment(1),
    lastMsg: text,
    lastTs: Date.now(),
  })
}

export async function markDirectChatRead(uid) {
  await set(iRef(`chatMeta/${uid}/unreadForStudent`), 0)
}

export async function clearStudentChat(uid) {
  await remove(iRef(`chats/${uid}`))
  await set(iRef(`chatMeta/${uid}/unreadForStudent`), 0)
  await set(iRef(`chatMeta/${uid}/unreadForAdmin`), 0)
}

export function subscribeDirectUnread(uid, callback) {
  const r = iRef(`chatMeta/${uid}/unreadForStudent`)
  const handler = onValue(r, snap => callback(snap.val() || 0))
  return () => off(r, 'value', handler)
}

// ─── GENERAL CHAT ─────────────────────────────────────────────────
export function subscribeGeneralChat(callback) {
  const r = iRef('chats/general')
  const handler = onValue(r, snap => {
    const data = snap.val() || {}
    const msgs = Object.entries(data)
      .map(([id, m]) => ({ ...m, id }))
      .sort((a, b) => (a.ts || 0) - (b.ts || 0))
    callback(msgs)
  })
  return () => off(r, 'value', handler)
}

export async function sendGeneralMessage(uid, name, text) {
  const time = new Date().toLocaleTimeString('uk', { hour: '2-digit', minute: '2-digit' })
  await push(iRef('chats/general'), {
    uid,
    name,
    from: 'student',
    text,
    time,
    ts: Date.now(),
  })
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────
export function subscribeNotifications(uid, callback) {
  const r = iRef(`notifications/${uid}`)
  const handler = onValue(r, snap => {
    const data = snap.val() || {}
    const items = Object.entries(data)
      .map(([id, n]) => ({ ...n, id }))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    callback(items)
  })
  return () => off(r, 'value', handler)
}

export function clearNotification(uid, notifId) {
  return remove(iRef(`notifications/${uid}/${notifId}`))
}

export function clearAllNotifications(uid) {
  return remove(iRef(`notifications/${uid}`))
}

export async function sendWelcomeIfEnabled(uid) {
  try {
    const [settingsSnap, userSnap] = await Promise.all([
      get(iRef('admin_settings/autoWelcome')),
      get(iRef(`users/${uid}/welcomeSent`)),
    ])
    if (!settingsSnap.exists() || settingsSnap.val()?.enabled === false) return
    if (userSnap.exists()) return
    const _n = new Date()
    const _dl = `${String(_n.getDate()).padStart(2,'0')}.${String(_n.getMonth()+1).padStart(2,'0')}`
    const _tl = `${String(_n.getHours()).padStart(2,'0')}:${String(_n.getMinutes()).padStart(2,'0')}`
    await Promise.all([
      push(iRef(`notifications/${uid}`), { type:'system', title:'Вітаємо! 🎉', body:'Ваш профіль підключено. Забронюйте перший урок у вкладці «Запис».', date:_dl, time:_tl, ts:Date.now() }),
      update(iRef(`users/${uid}`), { welcomeSent: true }),
    ])
  } catch (_) {}
}
