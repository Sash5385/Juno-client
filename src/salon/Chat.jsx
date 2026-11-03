// Чат клієнта з майстром: нагадування з кнопками «Підтверджую» / «Перенести» і прохання оцінити візит
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { chatQuery, markChatRead, sendChat, confirmBooking, rateBooking, requestReschedule, useValue, toList, sref } from './data'
import { reminderState, canRate, validRating, nowYmdHm } from './logic'

const Stars = ({ n }) => <span className="sl-star">{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>

function Reminder({ msg, booking, act }) {
  const st = reminderState(booking, nowYmdHm())
  if (st === 'confirmed') return <div className="sl-actions"><span className="sl-pill">✅ Ви підтвердили запис</span></div>
  if (st !== 'open') return <div className="sl-actions"><span className="sl-pill">{st === 'cancelled' ? 'Запис скасовано' : 'Запис неактуальний'}</span></div>
  return (
    <div className="sl-actions">
      <button className="sl-btn" onClick={() => act.confirm(booking)}>✅ Підтверджую</button>
      <button className="sl-btn ghost" onClick={() => act.reschedule(booking)}>🔄 Перенести</button>
    </div>
  )
}

function Rate({ booking, act }) {
  if (!booking) return null
  if (validRating(booking.rating)) return <div className="sl-actions"><span className="sl-pill">Ваша оцінка: <Stars n={booking.rating} /></span></div>
  if (!canRate(booking)) return null
  return <div className="sl-stars">{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-label={`${n} з 5`} onClick={() => act.rate(booking, n)}>★</button>)}</div>
}

export default function Chat({ ctx, masterId, bookings }) {
  const { salonId, user, name, toast } = ctx
  const nav = useNavigate()
  const msgs = useValue(() => chatQuery(salonId, masterId, user.uid), [salonId, masterId, user.uid])
  const master = useValue(() => sref(salonId, `masters/${masterId}`), [salonId, masterId]).value
  const list = useMemo(() => toList(msgs.value).sort((a, b) => (a.ts || 0) - (b.ts || 0)), [msgs.value])
  const byId = useMemo(() => Object.fromEntries(bookings.map((b) => [b.id, b])), [bookings])
  const [text, setText] = useState('')
  const endRef = useRef(null)
  useEffect(() => { markChatRead(salonId, masterId, user.uid) }, [salonId, masterId, user.uid, list.length])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [list.length])

  const guard = async (fn, ok) => { try { const r = await fn(); toast(r === false ? 'Запит уже надіслано' : ok) } catch { toast('Не вдалося, спробуйте ще раз') } }
  const act = {
    confirm: (b) => guard(() => confirmBooking(salonId, b.id), 'Дякуємо, візит підтверджено'),
    reschedule: (b) => guard(() => requestReschedule(salonId, user.uid, name, b), 'Запит на перенесення надіслано майстру'),
    rate: (b, n) => guard(() => rateBooking(salonId, b.id, n), 'Дякуємо за оцінку!'),
  }
  const send = async () => {
    const t = text.trim()
    if (!t) return
    setText('')
    try { await sendChat(salonId, masterId, user.uid, name, t) } catch { toast('Не вдалося надіслати'); setText(t) }
  }
  return (
    <>
      <div className="sl-row" style={{ padding: '14px 0 8px' }}>
        <button className="sl-btn ghost" onClick={() => nav('/cabinet/chat')} aria-label="Назад">‹</button>
        <div className="sl-grow"><div className="sl-title">{master?.profile?.name || 'Майстер'}</div>{master?.rating?.count > 0 && <div className="sl-dim"><span className="sl-star">★ {master.rating.avg}</span> · {master.rating.count} оцінок</div>}</div>
      </div>
      <div className="sl-msgs">
        {list.length === 0 && !msgs.loading && <div className="sl-dim" style={{ textAlign: 'center', padding: 24 }}>Повідомлень ще немає</div>}
        {list.map((m) => {
          const mine = m.from === 'client'
          return (
            <div key={m.id} className={`sl-msg${mine ? ' me' : ''}`}>
              <div className="sl-bubble">
                {m.text}
                {m.kind === 'reminder' && <Reminder msg={m} booking={byId[m.bookingId]} act={act} />}
                {m.kind === 'rate' && <Rate booking={byId[m.bookingId]} act={act} />}
                <div className="sl-time">{m.time || ''}</div>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <div className="sl-compose">
        <input className="sl-field" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Повідомлення…" />
        <button className="sl-btn" disabled={!text.trim()} onClick={send} aria-label="Надіслати">➤</button>
      </div>
    </>
  )
}
