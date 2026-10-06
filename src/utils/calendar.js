function fmt(date, time, durationHours) {
  const [y, mo, d] = date.split('-')
  const [h, m] = time.split(':').map(Number)
  const startStr = `${y}${mo}${d}T${String(h).padStart(2,'0')}${String(m || 0).padStart(2,'0')}00`
  const endMin = h * 60 + (m || 0) + durationHours * 60
  const endStr = `${y}${mo}${d}T${String(Math.floor(endMin / 60)).padStart(2,'0')}${String(endMin % 60).padStart(2,'0')}00`
  return { startStr, endStr }
}

export function googleCalendarLink(booking) {
  const { date, time, durationHours = 1, serviceName } = booking
  const { startStr, endStr } = fmt(date, time, durationHours)
  // eventedit відкриває форму нової події з уже заповненими полями (і в браузері, і в застосунку Google
  // Календар); старий render?action=TEMPLATE на телефонах часто губить заповнені поля. ctz — щоб час
  // не «з'їхав» через часовий пояс. Подія зберігається після натискання «Зберегти» в самому Google Календарі.
  const params = new URLSearchParams({
    text: serviceName || 'Запис',
    dates: `${startStr}/${endStr}`,
    details: 'Juno — запис з майстром',
    ctz: 'Europe/Kyiv',
  })
  return `https://calendar.google.com/calendar/r/eventedit?${params}`
}

export function downloadICS(booking) {
  const { date, time, durationHours = 1, serviceName, id } = booking
  const { startStr, endStr } = fmt(date, time, durationHours)
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Juno//Juno//UK',
    'BEGIN:VEVENT',
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    // Час «плаваючий» (без TZID): календар телефону сам трактує його у місцевому часі.
    // TZID=Europe/Kyiv без блоку VTIMEZONE багато календарів відкидають або зсувають.
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:${serviceName || 'Запис'}`,
    'DESCRIPTION:Juno — запис з майстром',
    `UID:${id || date + time.replace(':', '')}@drivepad`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `juno-${date}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
