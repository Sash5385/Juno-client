// Мої записи: найближчі і минулі, оплата/доплата, скасування за політикою салону, перенесення, оцінка, лист очікування
import { useState, useEffect, useMemo } from 'react'
import { useSalon } from './ctx'
import { sref, useValue, toList } from './data'
import { callFn, errText } from './api'
import { cancelBooking, confirmAttendance, rateBooking, leaveQueue } from './actions'
import BookFlow from './BookFlow'
import { Btn, Card, Confirm, Empty, Pill, Sheet, Spinner, dateLabel, money } from './kit'
import { cancelPolicy, localToMs, minToTime, timeToMin, isCancelledBooking } from '../utils/salonLogic'

const ST = { pending: ['Очікує підтвердження', 'var(--gold)'], confirmed: ['Підтверджено', 'var(--blue)'], completed: ['Завершено', 'var(--green)'], cancelled: ['Скасовано', 'var(--accent)'] }
const PAYP = { deposit_paid: ['Передоплата внесена', '#2dd4bf'], paid: ['Оплачено', 'var(--green)'], refunded: ['Кошти повернено', 'var(--dim)'] }

export default function MyBookings({ bookings, loading, openChat }) {
  const ctx = useSalon()
  const { salonId, user, masters, payment, tz, toast } = ctx
  const [flow, setFlow] = useState(null)       // { initial?, reschedule? }
  const [cancel, setCancel] = useState(null)
  const [paySheet, setPaySheet] = useState(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t) }, [])

  const queue = useValue(() => sref(salonId, `userQueue/${user.uid}`), [salonId, user.uid])
  const offers = useValue(() => sref(salonId, `users/${user.uid}/queueOffers`), [salonId, user.uid])
  const mName = (id) => masters.find((m) => m.id === id)?.name || 'Майстер'
  const startMs = (b) => localToMs(b.date, b.time, tz)

  const { upcoming, past } = useMemo(() => {
    const up = [], pa = []
    for (const b of bookings) {
      const over = startMs(b) + (Number(b.durationMin) || 60) * 60000 < now
      if (!isCancelledBooking(b) && b.status !== 'completed' && !over) up.push(b); else pa.push(b)
    }
    up.sort((a, b) => startMs(a) - startMs(b)); pa.sort((a, b) => startMs(b) - startMs(a))
    return { upcoming: up, past: pa }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, now, tz])

  const onlineOk = !!payment.enabled && !!payment.hasToken
  const pay = async (b, mode) => {
    setBusy(true)
    try { const r = await callFn('salonCreateBookingInvoice', { salonId, bookingId: b.id, mode }); if (r.pageUrl && r.pageUrl !== '#demo-pay') window.location.href = r.pageUrl; else toast('Демо: перехід до оплати') }
    catch (e) { toast(errText(e), 'err') } finally { setBusy(false); setPaySheet(null) }
  }
  const doCancel = async () => {
    const b = cancel; setBusy(true)
    try { await cancelBooking(salonId, b.id); toast('Запис скасовано', 'ok') } catch { toast('Не вдалося скасувати. Спробуйте ще раз', 'err') } finally { setBusy(false); setCancel(null) }
  }
  const policyText = (b) => {
    const paid = Number(b.paidAmount) || 0
    const p = cancelPolicy(startMs(b), now, payment.cancelFreeHours)
    const head = `${b.serviceName} · ${dateLabel(b.date)} ${b.time}`
    if (!paid) return `${head}\nСкасувати запис? Час звільниться.`
    return p.free ? `${head}\nСкасування безкоштовне. Передоплату ${money(paid)} повернемо на картку автоматично.`
      : `${head}\nДо візиту менше ніж ${p.hours} год — передоплата ${money(paid)} не повертається (так вказано в умовах салону). Все одно скасувати?`
  }

  if (loading) return <Spinner />
  const hold = payment.holdMinutes ?? 15
  const activeOffers = toList(offers.value).filter((o) => (o.until || 0) > now)
  const waiting = toList(queue.value)

  const renderBooking = (b, isPast) => {
    const [label, color] = isCancelledBooking(b) ? ST.cancelled : ST[b.status] || ST.pending
    const paid = Number(b.paidAmount) || 0, price = Number(b.price) || 0, remaining = Math.max(0, price - paid)
    const pp = PAYP[b.paymentStatus]
    const closed = isCancelledBooking(b) || b.status === 'completed'
    const unpaidOnline = b.paymentMethod === 'online' && paid === 0 && !closed
    const holdTill = unpaidOnline && b.status === 'pending' ? new Date((b.createdAt || now) + hold * 60000) : null
    const canMove = !isPast && !closed && startMs(b) > now
    return (
      <Card key={b.id} style={{ marginBottom: 10, opacity: isCancelledBooking(b) ? 0.65 : 1 }}>
        <div style={{ display: 'flex' }}>
          <div style={{ width: 4, background: color, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.serviceName}</div>
              <div style={{ fontWeight: 900, flexShrink: 0 }}>{money(price)}</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 3 }}>{dateLabel(b.date)}, {b.time}–{minToTime(timeToMin(b.time) + (Number(b.durationMin) || 60))} · {mName(b.masterId)}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <Pill label={label} color={color} />
              {pp && <Pill label={pp[0]} color={pp[1]} />}
              {unpaidOnline && <Pill label="Чекає оплати" color="var(--gold)" />}
            </div>
            {holdTill && <div style={{ fontSize: 12, color: 'var(--gold)', marginTop: 8 }}>Оплатіть до {holdTill.toLocaleTimeString('uk', { hour: '2-digit', minute: '2-digit' })}, інакше запис скасується</div>}
            {b.status === 'completed' && !b.rating && <Stars onRate={(r) => rateBooking(salonId, b.id, r).then(() => toast('Дякуємо за оцінку!'))} />}
            {b.rating ? <div style={{ fontSize: 13, marginTop: 8 }}>Ваша оцінка: {'★'.repeat(b.rating)}{'☆'.repeat(5 - b.rating)}</div> : null}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {onlineOk && !closed && remaining > 0 && <Btn disabled={busy} style={{ width: 'auto', flex: '1 1 140px', padding: '10px 12px', fontSize: 13 }} onClick={() => (paid > 0 ? pay(b, 'full') : setPaySheet(b))}>{paid > 0 ? `Доплатити ${money(remaining)}` : 'Оплатити онлайн'}</Btn>}
              {!closed && b.status === 'confirmed' && !b.clientConfirmed && startMs(b) - now < 48 * 3600000 && <Btn variant="ghost" style={{ width: 'auto', flex: '1 1 140px', padding: '10px 12px', fontSize: 13 }} onClick={() => confirmAttendance(salonId, b.id).then(() => toast('Дякуємо, чекаємо вас!'))}>Підтверджую візит</Btn>}
              {canMove && <Btn variant="ghost" style={{ width: 'auto', flex: '1 1 110px', padding: '10px 12px', fontSize: 13 }} onClick={() => setFlow({ reschedule: b })}>Перенести</Btn>}
              {canMove && <Btn variant="ghost" danger style={{ width: 'auto', flex: '1 1 110px', padding: '10px 12px', fontSize: 13 }} onClick={() => setCancel(b)}>Скасувати</Btn>}
              <Btn variant="ghost" style={{ width: 'auto', padding: '10px 14px', fontSize: 13 }} onClick={() => openChat(b.masterId)}>💬</Btn>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div>
      {activeOffers.map((o) => (
        <Card key={o.id} style={{ marginBottom: 10, border: '1px solid var(--accent)' }}>
          <div style={{ padding: '12px 14px' }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>🎉 Звільнився час {dateLabel(o.date)} о {o.time}</div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)', margin: '3px 0 10px' }}>{mName(o.masterId)} · резерв діє до {new Date(o.until).toLocaleTimeString('uk', { hour: '2-digit', minute: '2-digit' })}</div>
            <Btn onClick={() => setFlow({ initial: { masterId: o.masterId, date: o.date, time: o.time } })}>Записатись на цей час</Btn>
          </div>
        </Card>
      ))}
      {upcoming.length === 0 && <><Empty icon="📅" text="Найближчих записів немає" /><Btn onClick={() => setFlow({})} style={{ marginBottom: 16 }}>＋ Записатись</Btn></>}
      {upcoming.map((b) => renderBooking(b, false))}
      {waiting.length > 0 && (
        <>
          <div style={sec}>Лист очікування</div>
          {waiting.map((w) => (
            <Card key={w.id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                <div style={{ flex: 1, fontSize: 13.5 }}>🔔 {dateLabel(w.date)}, {w.time}<div style={{ fontSize: 12, color: 'var(--dim)' }}>{mName(w.masterId)}</div></div>
                <Btn variant="ghost" style={{ width: 'auto', padding: '8px 12px', fontSize: 12.5 }} onClick={() => leaveQueue({ salonId, uid: user.uid, masterId: w.masterId, date: w.date, time: w.time })}>Вийти</Btn>
              </div>
            </Card>
          ))}
        </>
      )}
      {past.length > 0 && <><div style={sec}>Історія</div>{past.slice(0, 30).map((b) => renderBooking(b, true))}</>}
      {flow && <BookFlow initial={flow.initial} reschedule={flow.reschedule} onClose={() => setFlow(null)} />}
      {cancel && <Confirm danger title="Скасувати запис?" text={policyText(cancel)} yes={busy ? '…' : 'Скасувати запис'} no="Залишити" onNo={() => setCancel(null)} onYes={doCancel} />}
      {paySheet && (
        <Sheet title="Оплата" onClose={() => setPaySheet(null)}>
          {payment.depositPercent > 0 && Math.ceil(paySheet.price * payment.depositPercent) / 100 < paySheet.price && <Btn disabled={busy} onClick={() => pay(paySheet, 'deposit')} style={{ marginBottom: 8 }}>Передоплата {money(Math.ceil(paySheet.price * payment.depositPercent) / 100)}</Btn>}
          {payment.allowFull !== false && <Btn disabled={busy} variant="ghost" onClick={() => pay(paySheet, 'full')}>Оплатити повністю {money(paySheet.price)}</Btn>}
        </Sheet>
      )}
    </div>
  )
}
const sec = { fontSize: 13, fontWeight: 900, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: 0.6, margin: '20px 0 10px' }

function Stars({ onRate }) {
  return <div style={{ marginTop: 8, display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ fontSize: 12.5, color: 'var(--dim)', marginRight: 4 }}>Оцініть візит:</span>{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => onRate(n)} aria-label={`${n}`} style={{ border: 'none', background: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--gold)', padding: 0 }}>★</button>)}</div>
}
