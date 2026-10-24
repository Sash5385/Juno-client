// Обмеження для учня з «Налаштування → Ліміти» адмінки. Одна логіка і для запису (BookTab),
// і для переносу (BookingsTab), щоб перенос не обходив правила звичайного запису.

const DAY_MS = 86400000
const dayNum = (ymd) => {
  const [y, m, d] = String(ymd || '').split('-').map(Number)
  return Math.round(Date.UTC(y, (m || 1) - 1, d || 1) / DAY_MS)
}

// «Мінімальний інтервал між записами» (minBookingIntervalDays): інший активний запис учня,
// ближчий ніж на N днів до dateStr, або null. exceptId — запис, який зараз переноситься.
export function minIntervalConflict(dateStr, bookings, days, exceptId = null) {
  const n = Number(days) || 0
  if (n <= 0 || !dateStr) return null
  const target = dayNum(dateStr)
  return (bookings || []).find(b =>
    b && b.id !== exceptId && b.date && b.status !== 'cancelled' &&
    Math.abs(dayNum(b.date) - target) < n
  ) || null
}

export function minIntervalMessage(days, conflict) {
  const d = conflict?.date ? conflict.date.split('-').reverse().slice(0, 2).join('.') : ''
  return `Між уроками має бути щонайменше ${days} дн.${d ? ` У вас уже є урок ${d}.` : ''}`
}

// Календар наперед: приватні й автошкільні учні мають окремі горизонти
export function maxBookDate(today, canPrivate, s = {}) {
  const days = canPrivate ? (s.calendarOpenDays ?? 30) : (s.schoolCalendarOpenDays ?? 14)
  const d = new Date(today)
  d.setDate(d.getDate() + days)
  return d
}

// «Заборона запису: годин до уроку» — слот, що починається раніше ніж через N год, закритий
export function withinCutoff(dateObj, time, hours, now = Date.now()) {
  const h = Number(hours) || 0
  if (!h || !dateObj || !time) return false
  const [hh, mm] = time.split(':').map(Number)
  const dt = new Date(dateObj)
  dt.setHours(hh, mm || 0, 0, 0)
  return now + h * 3600000 > dt.getTime()
}

// Чи може учень перенести урок: дозвіл інструктора («Учень може переносити запис») і той самий
// строк, що й для скасування — інакше перенос за годину до уроку обходив би заборону скасування.
export function rescheduleState(hoursLeft, s = {}, cutoff = 24) {
  if (s.studentCanReschedule === false) return { show: false, locked: true }
  return { show: true, locked: hoursLeft < cutoff }
}
