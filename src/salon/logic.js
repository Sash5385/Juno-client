// Чиста логіка клієнта салону (без Firebase) — тестується окремо: tests/unit/salonClient.test.mjs
export const isCancelled = (b) => !b || b.status === 'cancelled' || !!b.cancelledBy
export const validRating = (r) => Number.isInteger(r) && r >= 1 && r <= 5

// Стан кнопок нагадування за записом: що можна зробити з повідомлення «Підтверджую / Перенести»
// nowYmdHm — "YYYY-MM-DD HH:MM" за часом салону/пристрою (порівнюємо рядками)
export function reminderState(b, nowYmdHm) {
  if (!b) return 'gone'
  if (isCancelled(b)) return 'cancelled'
  if (b.status === 'completed' || b.status === 'no_show' || `${b.date} ${b.time}` < nowYmdHm) return 'past'
  return b.clientConfirmed ? 'confirmed' : 'open'
}

// Чи можна оцінити візит: завершений, ще без оцінки (правила БД ставлять ті самі умови)
export const canRate = (b) => !!b && b.status === 'completed' && !validRating(b.rating) && !isCancelled(b)

// Повідомлення клієнта про перенесення (одне на запис — перевіряємо наявність за kind+bookingId)
export const rescheduleText = (b) => `Прошу перенести мій запис ${b.date} о ${b.time}${b.serviceName ? ` (${b.serviceName})` : ''}. Підкажіть, будь ласка, коли є вільний час.`
export const hasRescheduleRequest = (msgs, bookingId) => msgs.some((m) => m.kind === 'reschedule_request' && m.bookingId === bookingId)

export const nowYmdHm = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
