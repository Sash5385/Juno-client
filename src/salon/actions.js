// Дії клієнта: запис (атомарне захоплення слотів → бронь), скасування, перенесення, оцінка, черга, чат.
// Усі шляхи й поля відповідають rules (tests/rules/salonClientApp.test.mjs у репозиторії DrivePad).
import { push, set, update, remove, increment } from 'firebase/database'
import { sref } from './data'
import { slotIdOf, minToTime, timeToMin } from '../utils/salonLogic'

export const slotIdsFor = (time, durationMin, step) => {
  const need = Math.max(1, Math.ceil(durationMin / step)), start = timeToMin(time)
  return Array.from({ length: need }, (_, i) => slotIdOf(minToTime(start + i * step)))
}
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''))

// Усі слоти діапазону одним multi-path записом: або всі, або жоден (правила відхиляють зайнятий слот → permission_denied)
export async function claimSlots({ salonId, masterId, date, ids, uid }) {
  const upd = {}
  for (const id of ids) { upd[`timeslots/${masterId}/${date}/${id}/available`] = false; upd[`timeslots/${masterId}/${date}/${id}/bookedBy`] = uid }
  try { await update(sref(salonId, ''), upd) }
  catch (e) { throw Object.assign(new Error('slot_taken'), { code: 'slot_taken', cause: e }) }
}
export async function releaseSlots({ salonId, masterId, date, ids }) {
  const upd = {}
  for (const id of ids) { upd[`timeslots/${masterId}/${date}/${id}/available`] = true; upd[`timeslots/${masterId}/${date}/${id}/bookedBy`] = null }
  await update(sref(salonId, ''), upd)
}

// Запис: захоплюємо слоти, створюємо бронь (pending); якщо бронь не створилась — слоти повертаємо
export async function bookSlot({ salonId, user, uProfile, service, masterId, price, durationMin, date, time, step, payMethod, note, reschedule }) {
  const ids = slotIdsFor(time, durationMin, step)
  await claimSlots({ salonId, masterId, date, ids, uid: user.uid })
  const r = push(sref(salonId, 'bookings'))
  const booking = clean({
    id: r.key, masterId, serviceId: service.id, serviceName: service.name, price, durationMin, clientUid: user.uid,
    clientName: uProfile?.name || user.displayName || 'Клієнт', phone: uProfile?.phone || user.phoneNumber, date, time, status: 'pending',
    paymentMethod: payMethod === 'onsite' ? 'onsite' : 'online', clientNote: note, createdAt: Date.now(),
    rescheduledFrom: reschedule ? `${reschedule.date} ${reschedule.time}` : undefined, rescheduledFromId: reschedule?.id,
  })
  try { await set(r, booking) }
  catch (e) { await releaseSlots({ salonId, masterId, date, ids }).catch(() => {}); throw Object.assign(new Error('booking_failed'), { code: 'booking_failed', cause: e }) }
  return r.key
}

export const cancelBooking = (salonId, id, { reschedule = false } = {}) =>
  update(sref(salonId, `bookings/${id}`), { status: 'cancelled', cancelledBy: reschedule ? 'reschedule' : 'client', cancelledAt: Date.now() })
export const confirmAttendance = (salonId, id) => update(sref(salonId, `bookings/${id}`), { clientConfirmed: true })
export const rateBooking = (salonId, id, rating) => update(sref(salonId, `bookings/${id}`), { rating })
export const saveNote = (salonId, id, note) => update(sref(salonId, `bookings/${id}`), { clientNote: note || null })

// Лист очікування: queue/{masterId}/{date_time}/entries/{uid} + індекс клієнта userQueue/{uid}
export async function joinQueue({ salonId, user, uProfile, masterId, date, time, durationMin }) {
  const entry = { uid: user.uid, durationMin, name: uProfile?.name || '', phone: uProfile?.phone || '', addedAt: Date.now(), status: 'waiting' }
  await set(sref(salonId, `queue/${masterId}/${date}_${time}/entries/${user.uid}`), clean(entry))
  await set(sref(salonId, `userQueue/${user.uid}/${masterId}_${date}_${time}`), { masterId, date, time, durationMin })
}
export async function leaveQueue({ salonId, uid, masterId, date, time }) {
  await remove(sref(salonId, `queue/${masterId}/${date}_${time}/entries/${uid}`))
  await remove(sref(salonId, `userQueue/${uid}/${masterId}_${date}_${time}`))
  await remove(sref(salonId, `users/${uid}/queueOffers/${masterId}_${date}_${time}`)).catch(() => {})
}
export async function markQueueBooked({ salonId, uid, masterId, date, time }) {
  await update(sref(salonId, `queue/${masterId}/${date}_${time}/entries/${uid}`), { status: 'booked' }).catch(() => {})
  await remove(sref(salonId, `userQueue/${uid}/${masterId}_${date}_${time}`)).catch(() => {})
  await remove(sref(salonId, `users/${uid}/queueOffers/${masterId}_${date}_${time}`)).catch(() => {})
}

// Чат: салон (chats/{uid}) або майстер (masterChats/{masterId}/{uid}); метадані читає адмінка для бейджів і списків
export async function sendMessage({ salonId, uid, name, masterId, text }) {
  const ts = Date.now()
  const base = masterId ? `masterChats/${masterId}/${uid}` : `chats/${uid}`
  const meta = masterId ? `masterChatMeta/${masterId}/${uid}` : `chatMeta/${uid}`
  await push(sref(salonId, base), { from: 'client', text, name, ts, time: new Date(ts).toLocaleTimeString('uk', { hour: '2-digit', minute: '2-digit' }) })
  await update(sref(salonId, meta), { name, lastMsg: text, lastTs: ts, [masterId ? 'unreadForMaster' : 'unreadForAdmin']: increment(1), unreadForClient: 0 })
}
export const markChatRead = (salonId, uid, masterId) =>
  update(sref(salonId, masterId ? `masterChatMeta/${masterId}/${uid}` : `chatMeta/${uid}`), { unreadForClient: 0 }).catch(() => {})
