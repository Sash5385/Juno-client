// Сповіщення клієнта: notifications/{uid} (пишуть Cloud Functions)
import { useMemo } from 'react'
import { query, limitToLast } from 'firebase/database'
import { useSalon } from './ctx'
import { sref, useValue, toList } from './data'
import { Card, Empty, Spinner } from './kit'

const ICON = { booking_confirmed: '✅', booking_cancelled: '❌', booking_rescheduled: '🔄', reminder: '⏰', payment: '💳', queue_offer: '🎉', template: '💬', system: '🔔' }

export default function NotifTab() {
  const { salonId, user } = useSalon()
  const n = useValue(() => query(sref(salonId, `notifications/${user.uid}`), limitToLast(60)), [salonId, user.uid])
  const list = useMemo(() => toList(n.value).sort((a, b) => (b.ts || 0) - (a.ts || 0)), [n.value])
  if (n.loading) return <Spinner />
  if (!list.length) return <Empty icon="🔔" text="Сповіщень поки немає" />
  return list.map((x) => (
    <Card key={x.id} style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 12, padding: '12px 14px' }}>
        <div style={{ fontSize: 22 }}>{ICON[x.type] || '🔔'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{x.title}</div>
          <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 2, whiteSpace: 'pre-line' }}>{x.body}</div>
          <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>{x.date} {x.time}</div>
        </div>
      </div>
    </Card>
  ))
}
