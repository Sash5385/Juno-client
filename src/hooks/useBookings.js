import { useEffect, useMemo, useState } from 'react'
import { parseYMD } from '../utils/date'
import { subscribeMyBookings, getConfirmedSchoolHours, getCompletedHours } from '../firebase/db'

// Кінець уроку (мс): початок + тривалість (за замовчуванням 1 год). Без часу — кінець доби цієї дати.
export function lessonEndMs(b) {
  if (!b?.date) return Infinity
  const d = parseYMD(b.date)
  if (!b.time) { d.setHours(23, 59, 59, 999); return d.getTime() }
  const [h, m] = b.time.split(':').map(Number)
  d.setHours(h, m || 0, 0, 0)
  return d.getTime() + (Number(b.durationHours) || 1) * 3600000
}

export function useBookings(uid, profile) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  // Раз на хвилину перераховуємо, що вже минуло: урок, що закінчився, одразу стає «завершеним»
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!uid) {
      setBookings([])
      setLoading(false)
      return
    }
    setLoading(true)
    const phone = profile?.phone || ''
    const unsub = subscribeMyBookings(uid, phone, (list) => {
      // Сортуємо: найближчі першими
      list.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time || '00:00'}`)
        const dateB = new Date(`${b.date}T${b.time || '00:00'}`)
        return dateA - dateB
      })
      setBookings(list)
      setLoading(false)
    })
    return unsub
  }, [uid, profile?.phone])

  const manualHours = profile?.hoursOffset || 0
  const schoolHours = getConfirmedSchoolHours(bookings) + manualHours
  const completedHours = getCompletedHours(bookings)
  // Майбутні — ті, що ще не закінчились (за часом, а не лише за датою); решта — історія, найновіші першими
  const { upcoming, completed } = useMemo(() => {
    const now = Date.now()
    const up = bookings.filter(b => b.status !== 'cancelled' && lessonEndMs(b) > now)
    const done = bookings
      .filter(b => lessonEndMs(b) <= now)
      .sort((a, b) => new Date(`${b.date}T${b.time || '00:00'}`) - new Date(`${a.date}T${a.time || '00:00'}`))
    return { upcoming: up, completed: done }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, tick])

  return {
    bookings,
    upcoming,
    completed,
    schoolHours,
    completedHours,
    manualHours,
    loading,
    canBookPrivate: schoolHours >= 40
  }
}
