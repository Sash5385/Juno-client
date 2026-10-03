// Запис: послуга → майстер (або будь-який) → дата й час (лише вільні вікна) → підтвердження і оплата.
// Той самий потік переносить запис (reschedule): послуга й майстер фіксовані, передоплата переїжджає на новий час.
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSalon } from './ctx'
import { sref, useValues } from './data'
import { callFn, errText } from './api'
import { bookSlot, cancelBooking, joinQueue, markQueueBooked } from './actions'
import ClientAuth from './ClientAuth'
import { Btn, Chip, Card, Empty, Sheet, money, dateLabel, initials } from './kit'
import { freeStartTimes, priceFor, serviceDuration, offersService, datesAhead, minToTime, timeToMin } from '../utils/salonLogic'

const LEAD_MIN = 30   // ближче ніж за 30 хв до початку не записуємо
const DAYS = 30

// Поточна дата й хвилини доби в часовому поясі салону
function nowInTz(tz) {
  const ms = Date.now()
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms)
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms).split(':').map(Number)
  return { date, min: h * 60 + m }
}

export default function BookFlow({ onClose, initial = {}, reschedule = null }) {
  const ctx = useSalon()
  const nav = useNavigate()
  const { salonId, services, masters, step: gridStep, payment, tz, user, uProfile, profile } = ctx
  const old = reschedule
  const service0 = old ? services.find((s) => s.id === old.serviceId) || null : null
  const [serviceId, setServiceId] = useState(old ? old.serviceId : '')
  const [masterSel, setMasterSel] = useState(old ? old.masterId : initial.masterId || '')
  const [date, setDate] = useState(initial.date || '')
  const [time, setTime] = useState(initial.time || '')
  const [pick, setPick] = useState(initial.masterId || '')
  const [stage, setStage] = useState(old ? 'time' : 'service')
  const [note, setNote] = useState(old?.clientNote || '')
  const [pay, setPay] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [waitMsg, setWaitMsg] = useState('')

  const service = services.find((s) => s.id === serviceId) || (old ? service0 : null)
  const candidates = useMemo(() => (service ? masters.filter((m) => offersService(service, m.id)) : []), [service, masters])
  const duration = service ? serviceDuration(service) : old?.durationMin || 60
  const ids = masterSel === 'any' ? candidates.map((m) => m.id) : masterSel ? [masterSel] : []
  const grids = useValues(ids.map((id) => ({ id, ref: sref(salonId, `timeslots/${id}`) })), [salonId, ids.join(',')])

  const today = nowInTz(tz)
  const dates = useMemo(() => datesAhead(today.date, DAYS), [today.date])
  // свободные времена по датам: { date: Map(time → masterId) }
  const byDate = useMemo(() => {
    const out = {}
    for (const d of dates) {
      const map = new Map()
      for (const id of ids) {
        for (const t of freeStartTimes(grids[id]?.[d], duration, gridStep, { minStart: d === today.date ? today.min + LEAD_MIN : 0 })) if (!map.has(t)) map.set(t, id)
      }
      out[d] = map
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, grids, duration, gridStep, ids.join(','), today.date, today.min])
  const firstFree = dates.find((d) => byDate[d]?.size)
  const selDate = date || firstFree || dates[0]
  const times = [...(byDate[selDate]?.keys() || [])].sort()

  const masterObj = (id) => masters.find((m) => m.id === id)
  const finalMaster = masterSel === 'any' ? pick : masterSel
  const price = service && finalMaster ? priceFor(service, finalMaster) : 0
  const paidOld = Number(old?.paidAmount) || 0
  const onlineOk = !!payment.enabled && !!payment.hasToken
  const depositAmt = payment.depositPercent > 0 ? Math.min(price, Math.ceil(price * payment.depositPercent) / 100) : 0
  const payOptions = useMemo(() => {
    const o = []
    if (onlineOk && depositAmt > 0 && depositAmt < price) o.push(['deposit', `Передоплата ${money(depositAmt)}`, 'залишок — на місці'])
    if (onlineOk && payment.allowFull !== false) o.push(['full', `Оплатити повністю ${money(price)}`, 'онлайн карткою'])
    o.push(['onsite', 'Оплатити в салоні', 'готівкою або карткою'])
    return o
  }, [onlineOk, depositAmt, price, payment.allowFull])
  const payChoice = pay && payOptions.some(([k]) => k === pay) ? pay : payOptions[0]?.[0] || 'onsite'

  // вхід завершено — закриваємо лист входу
  useEffect(() => { if (authOpen && user && uProfile) setAuthOpen(false) }, [authOpen, user, uProfile])

  const back = () => {
    setError('')
    if (stage === 'confirm') setStage('time')
    else if (stage === 'time') { if (old) onClose(); else setStage(candidates.length > 1 ? 'master' : 'service') }
    else if (stage === 'master') setStage('service')
    else onClose()
  }
  const chooseService = (s) => {
    setServiceId(s.id); setTime(''); setPick('')
    const c = masters.filter((m) => offersService(s, m.id))
    if (initial.masterId && c.some((m) => m.id === initial.masterId)) { setMasterSel(initial.masterId); setStage('time') }
    else if (c.length === 1) { setMasterSel(c[0].id); setStage('time') }
    else { setMasterSel(''); setStage('master') }
  }
  const chooseMaster = (id) => { setMasterSel(id); setTime(''); setPick(''); setStage('time') }
  const chooseTime = (t) => { setTime(t); setPick(byDate[selDate]?.get(t) || masterSel); setStage('confirm') }

  const submit = useCallback(async () => {
    setBusy(true); setError('')
    try {
      const method = old && paidOld > 0 ? 'online' : payChoice === 'onsite' ? 'onsite' : 'online'
      const bookingId = await bookSlot({
        salonId, user, uProfile, service: service || { id: old.serviceId, name: old.serviceName }, masterId: finalMaster, price, durationMin: duration,
        date: selDate, time, step: gridStep, payMethod: method, note: note.trim(), reschedule: old ? { id: old.id, date: old.date, time: old.time } : null,
      })
      let warn = ''
      if (old) { try { await cancelBooking(salonId, old.id, { reschedule: true }) } catch { warn = 'Новий запис створено, але попередній не вдалося скасувати — скасуйте його вручну в «Записах».' } }
      if (initial.masterId && initial.time && initial.date) markQueueBooked({ salonId, uid: user.uid, masterId: initial.masterId, date: initial.date, time: initial.time })
      if (method === 'online' && !(old && paidOld > 0)) {
        try { const r = await callFn('salonCreateBookingInvoice', { salonId, bookingId, mode: payChoice }); if (r.pageUrl && r.pageUrl !== '#demo-pay') { window.location.href = r.pageUrl; return } }
        catch (e) { warn = `${errText(e)}. Запис збережено — оплатіть його в «Записах», поки діє резерв.` }
      }
      setResult({ bookingId, warn, moved: !!old }); setStage('done')
    } catch (e) {
      if (e.code === 'slot_taken') { setError('Цей час щойно зайняли. Оберіть інший.'); setStage('time'); setTime('') }
      else setError('Не вдалося створити запис. Можливо, ціну чи послугу щойно змінили — оновіть сторінку й спробуйте ще раз.')
    } finally { setBusy(false) }
  }, [old, paidOld, payChoice, salonId, user, uProfile, service, finalMaster, price, duration, selDate, time, gridStep, note, initial])

  const joinWait = async (masterId, t) => {
    if (!user || !uProfile) { setAuthOpen(true); return }
    try { await joinQueue({ salonId, user, uProfile, masterId, date: selDate, time: t, durationMin: duration }); setWaitMsg(`Ви в черзі на ${dateLabel(selDate)} о ${t}. Сповістимо, якщо час звільниться.`) }
    catch { setWaitMsg('Не вдалося стати в чергу. Спробуйте ще раз.') }
  }
  // зайняті (не заблоковані власником) слоти обраної дати — для листа очікування
  const taken = useMemo(() => {
    if (times.length) return []
    const out = []
    for (const id of ids) for (const s of Object.values(grids[id]?.[selDate] || {})) if (s && s.time && !s.phantom && s.available === false && !s.adminBlocked) out.push({ id, t: s.time })
    return out.sort((a, b) => a.t.localeCompare(b.t)).slice(0, 24)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [times.length, grids, selDate, ids.join(',')])

  const TITLES = { service: 'Оберіть послугу', master: 'Оберіть майстра', time: 'Дата і час', confirm: 'Підтвердження', done: old ? 'Запис перенесено' : 'Готово' }
  const groups = useMemo(() => { const g = {}; for (const s of services.filter((x) => masters.some((m) => offersService(x, m.id)))) (g[s.category || 'Інше'] ||= []).push(s); return Object.entries(g) }, [services, masters])
  const range = (s) => { const p = masters.filter((m) => offersService(s, m.id)).map((m) => priceFor(s, m.id)); const lo = Math.min(...p), hi = Math.max(...p); return lo === hi ? money(lo) : `від ${money(lo)}` }

  return (
    <div data-testid="book-flow" style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'var(--bg-deep)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 'calc(10px + env(safe-area-inset-top,0px)) 12px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={stage === 'done' ? onClose : back} aria-label="Назад" style={{ width: 38, height: 38, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 20, cursor: 'pointer' }}>{stage === 'done' ? '✕' : '‹'}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{old && stage !== 'done' ? 'Перенести запис' : TITLES[stage]}</div>
          {stage !== 'done' && <div style={{ fontSize: 11.5, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{service ? service.name : profile.name}{service && finalMaster ? ` · ${masterObj(finalMaster)?.name || ''}` : ''}</div>}
        </div>
        {stage !== 'done' && <button onClick={onClose} aria-label="Закрити" style={{ width: 38, height: 38, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 15, cursor: 'pointer' }}>✕</button>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 24px' }}>
        {stage === 'service' && (groups.length === 0 ? <Empty icon="✂️" text="Салон ще не додав послуги" /> : groups.map(([cat, list]) => (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--dim)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>{cat}</div>
            {list.map((s) => (
              <Card key={s.id} onClick={() => chooseService(s)} style={{ marginBottom: 8 }}>
                <div style={{ padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 800 }}>{s.name}</div><div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>{serviceDuration(s)} хв</div></div>
                  <div style={{ fontWeight: 900, fontSize: 15, flexShrink: 0 }}>{range(s)}</div>
                </div>
              </Card>
            ))}
          </div>
        )))}

        {stage === 'master' && (
          <>
            {candidates.length > 1 && (
              <Card onClick={() => chooseMaster('any')} style={{ marginBottom: 8 }}>
                <div style={{ padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'color-mix(in srgb, var(--accent) 22%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎲</div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 800 }}>Будь-який майстер</div><div style={{ fontSize: 12.5, color: 'var(--dim)' }}>Найближчий вільний час</div></div>
                </div>
              </Card>
            )}
            {candidates.map((m) => (
              <Card key={m.id} onClick={() => chooseMaster(m.id)} style={{ marginBottom: 8 }}>
                <div style={{ padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'color-mix(in srgb, var(--blue) 22%, transparent)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{initials(m.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 800 }}>{m.name}</div><div style={{ fontSize: 12.5, color: 'var(--dim)' }}>{m.spec || 'Майстер'}</div></div>
                  <div style={{ fontWeight: 900 }}>{money(priceFor(service, m.id))}</div>
                </div>
              </Card>
            ))}
          </>
        )}

        {stage === 'time' && (
          <>
            {old && !service && <div style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 10 }}>Послугу цього запису вже видалено — створіть новий запис.</div>}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 8 }}>
              {dates.map((d) => {
                const has = byDate[d]?.size > 0, sel = d === selDate
                const [w, n] = [dateLabel(d).split(',')[0], Number(d.slice(8))]
                return (
                  <button key={d} onClick={() => { setDate(d); setTime(''); setWaitMsg('') }} style={{ flex: '0 0 auto', width: 52, padding: '8px 0', borderRadius: 13, border: sel ? '1px solid var(--accent)' : '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', background: sel ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'var(--surface)', color: sel ? 'var(--accent)' : has ? 'var(--text)' : 'var(--faint)' }}>
                    <div style={{ fontSize: 11 }}>{w}</div><div style={{ fontSize: 17, fontWeight: 900 }}>{n}</div>
                    <div style={{ width: 6, height: 6, borderRadius: 3, margin: '3px auto 0', background: has ? 'var(--green)' : 'transparent' }} />
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, margin: '4px 0 8px' }}>{dateLabel(selDate)}</div>
            {error && <div style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 8 }}>{error}</div>}
            {times.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{times.map((t) => <Chip key={t} onClick={() => chooseTime(t)} style={{ minWidth: 70 }}>{t}</Chip>)}</div>
            ) : (
              <>
                <Empty icon="😔" text="На цей день вільного часу немає" />
                {firstFree && <Btn variant="ghost" onClick={() => { setDate(firstFree); setTime('') }}>Найближча вільна дата — {dateLabel(firstFree)}</Btn>}
                {taken.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--dim)', marginBottom: 8 }}>🔔 ЛИСТ ОЧІКУВАННЯ — сповістимо, якщо час звільниться</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{taken.map(({ id, t }) => <Chip key={`${id}${t}`} onClick={() => joinWait(id, t)}>{masterSel === 'any' ? `${masterObj(id)?.name?.split(' ')[0] || ''} · ` : ''}{t}</Chip>)}</div>
                  </div>
                )}
                {waitMsg && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--green)' }}>{waitMsg}</div>}
              </>
            )}
          </>
        )}

        {stage === 'confirm' && service && (
          <>
            <Card style={{ marginBottom: 14 }}>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 17, fontWeight: 900 }}>{service.name}</div>
                <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 6, lineHeight: 1.7 }}>
                  📅 {dateLabel(selDate)}, {time}–{minToTime(timeToMin(time) + duration)}<br />💇 {masterObj(finalMaster)?.name}<br />⏱ {duration} хв
                  {profile.address ? <><br />📍 {profile.address}</> : null}
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, marginTop: 10 }}>{money(price)}</div>
              </div>
            </Card>
            {old && paidOld > 0 ? (
              <div style={{ fontSize: 13, color: 'var(--green)', marginBottom: 12 }}>💳 Внесена передоплата {money(paidOld)} перенесеться на новий час.</div>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--dim)', marginBottom: 8 }}>ОПЛАТА</div>
                {payOptions.map(([k, title, sub]) => (
                  <Card key={k} onClick={() => setPay(k)} style={{ marginBottom: 8, border: payChoice === k ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                    <div style={{ padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 20, height: 20, borderRadius: 10, border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{payChoice === k && <div style={{ width: 10, height: 10, borderRadius: 5, background: 'var(--accent)' }} />}</div>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div><div style={{ fontSize: 12, color: 'var(--dim)' }}>{sub}</div></div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--faint)', letterSpacing: 0.8, marginBottom: 5 }}>ПОБАЖАННЯ (НЕОБОВ'ЯЗКОВО)</div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Наприклад: френч, коротка довжина" style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 13px', color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
            </label>
            <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.55, marginBottom: 14 }}>Безкоштовне скасування — не пізніше ніж за {payment.cancelFreeHours ?? 24} год до візиту{payChoice !== 'onsite' || paidOld > 0 ? '. Передоплата за пізніше скасування не повертається' : ''}.</div>
            {error && <div style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
            {user && uProfile ? <Btn onClick={submit} disabled={busy}>{busy ? 'Оформлюю…' : old ? 'Перенести' : payChoice === 'onsite' ? 'Записатись' : 'Записатись і оплатити'}</Btn> : <Card style={{ padding: '14px 16px' }}><ClientAuth /></Card>}
          </>
        )}

        {stage === 'done' && result && (
          <div style={{ textAlign: 'center', padding: '30px 6px' }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>{result.moved ? 'Запис перенесено' : 'Запис створено'}</div>
            <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.6, marginBottom: 16 }}>{service?.name} · {dateLabel(selDate)}, {time}<br />{result.moved ? 'Салон отримав новий час.' : 'Салон підтвердить запис — ми надішлемо сповіщення.'}</div>
            {result.warn && <div style={{ fontSize: 13, color: 'var(--gold)', marginBottom: 14, lineHeight: 1.5 }}>{result.warn}</div>}
            <Btn onClick={() => { onClose(); nav('/cabinet/bookings') }}>Мої записи</Btn>
            <div style={{ height: 8 }} /><Btn variant="ghost" onClick={onClose}>Закрити</Btn>
          </div>
        )}
      </div>
      {authOpen && <Sheet title="Вхід" onClose={() => setAuthOpen(false)}><ClientAuth /></Sheet>}
    </div>
  )
}
