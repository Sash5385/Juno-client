import { useEffect, useMemo, useState } from 'react'
import { subscribeMasters, subscribeDirectUnread, getCurrentIid } from '../firebase/db'

// Треди чату клієнта з майстрами салону (окремо від треду «Салон»): майстри з його записів (masterId; для власника поля немає).
// Салон з одним майстром / інструктор — масив порожній, чат працює як раніше.
export function useChatThreads(uid, bookings, bookingsLoading) {
  const iid = getCurrentIid()
  const mids = useMemo(() => {
    const set = new Set()
    ;(bookings || []).forEach(b => { if (b && b.masterId && b.masterId !== iid) set.add(String(b.masterId)) })
    return [...set].sort()
  }, [bookings, iid])
  const midsKey = mids.join(',')
  const [names, setNames] = useState(null)
  const [unread, setUnread] = useState({})

  useEffect(() => {
    if (!mids.length) { setNames(null); return undefined }
    return subscribeMasters(list => {
      const n = {}
      list.forEach(m => { n[m.id] = m.name })
      setNames(n)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midsKey])

  useEffect(() => {
    if (!uid || !mids.length) { setUnread({}); return undefined }
    const offs = mids.map(mid => subscribeDirectUnread(uid, n => setUnread(u => ({ ...u, [mid]: n })), mid))
    return () => offs.forEach(f => f())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, midsKey])

  const threads = useMemo(() => mids.map(id => ({ id, name: names?.[id] || 'Майстер' })), [midsKey, names])
  const total = mids.reduce((s, m) => s + (unread[m] || 0), 0)
  const ready = !bookingsLoading && (!mids.length || names !== null)
  return { threads, unread, total, ready }
}
