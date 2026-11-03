// Мої записи в салоні: підтвердити візит, попросити перенести, оцінити майстра після візиту
import { useNavigate } from 'react-router-dom'
import { confirmBooking, rateBooking, requestReschedule } from './data'
import { reminderState, canRate, validRating, isCancelled, nowYmdHm } from './logic'

const STATUS = { pending: 'Очікує', confirmed: 'Підтверджено', completed: 'Завершено', no_show: 'Неявка', cancelled: 'Скасовано' }

export default function Bookings({ ctx, bookings, masters }) {
  const { salonId, user, name, toast } = ctx
  const nav = useNavigate()
  const now = nowYmdHm()
  const sorted = [...bookings].filter((b) => b.status !== 'personal').sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
  const upcoming = sorted.filter((b) => !isCancelled(b) && `${b.date} ${b.time}` >= now && b.status !== 'completed').reverse()
  const rest = sorted.filter((b) => !upcoming.includes(b))
  const nameOf = (id) => masters.find((m) => m.id === id)?.profile?.name || 'Майстер'
  const guard = async (fn, ok) => { try { const r = await fn(); toast(r === false ? 'Запит уже надіслано' : ok) } catch { toast('Не вдалося, спробуйте ще раз') } }

  const Card = ({ b }) => {
    const st = reminderState(b, now)
    return (
      <div className="sl-card">
        <div className="sl-row"><div className="sl-grow"><div className="sl-title">{b.date} · {b.time}</div><div className="sl-dim">{b.serviceName || 'Послуга'} · {nameOf(b.masterId)}</div></div><span className="sl-pill">{isCancelled(b) ? STATUS.cancelled : STATUS[b.status] || STATUS.pending}</span></div>
        {validRating(b.rating) && <div className="sl-dim" style={{ marginTop: 6 }}>Ваша оцінка: <span className="sl-star">{'★'.repeat(b.rating)}{'☆'.repeat(5 - b.rating)}</span></div>}
        {st === 'open' && (
          <div className="sl-actions">
            <button className="sl-btn" onClick={() => guard(() => confirmBooking(salonId, b.id), 'Дякуємо, візит підтверджено')}>✅ Підтверджую</button>
            <button className="sl-btn ghost" onClick={async () => { await guard(() => requestReschedule(salonId, user.uid, name, b), 'Запит на перенесення надіслано майстру'); nav(`/cabinet/chat?master=${b.masterId}`) }}>🔄 Перенести</button>
          </div>
        )}
        {st === 'confirmed' && <div className="sl-actions"><span className="sl-pill">✅ Ви підтвердили запис</span></div>}
        {canRate(b) && (
          <div className="sl-stars" role="group" aria-label={`Оцініть майстра ${nameOf(b.masterId)}`}>
            {[1, 2, 3, 4, 5].map((n) => <button key={n} aria-label={`${n} з 5`} onClick={() => guard(() => rateBooking(salonId, b.id, n), 'Дякуємо за оцінку!')}>★</button>)}
          </div>
        )}
      </div>
    )
  }
  if (!sorted.length) return <div className="sl-dim" style={{ textAlign: 'center', padding: 32 }}>Записів поки немає</div>
  return (
    <>
      {upcoming.length > 0 && <div className="sl-sub" style={{ margin: '6px 0' }}>Найближчі</div>}
      {upcoming.map((b) => <Card key={b.id} b={b} />)}
      {rest.length > 0 && <div className="sl-sub" style={{ margin: '12px 0 6px' }}>Минулі та скасовані</div>}
      {rest.map((b) => <Card key={b.id} b={b} />)}
    </>
  )
}
