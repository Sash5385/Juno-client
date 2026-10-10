import { useState, useEffect, useMemo, useContext } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '../../hooks/useToast'
import { useBackClose } from '../../hooks/useBackButton'
import { cancelBooking, rateBooking, saveStudentNote, createBooking, claimSlot, subscribeSlotsForDate, getAdminSettings, subscribeMonthAvailability } from '../../firebase/db'
import { formatDurHours } from '../../utils/format'
import { normAddons, addonsLabel, bufferOf, rangeTaken } from '../../addons'
import { parseYMD, getMonthShort, getMonthGrid, getMonthName, formatDateYMD, isPast, isSameDay, formatDateLabel } from '../../utils/date'
import { googleCalendarLink, downloadICS } from '../../utils/calendar'
import { LicenseContext } from '../../hooks/useLicense'
import './BookingsTab.css'
import './BookTab.css'

// Мінімальний час до запису, коли клієнт ще може самостійно скасувати (год)
const CANCEL_WINDOW_HOURS = 24

function hoursUntilLesson(booking) {
  if (!booking?.date || !booking?.time) return Infinity
  const [h, m] = booking.time.split(':').map(Number)
  const d = parseYMD(booking.date)
  d.setHours(h, m || 0, 0, 0)
  return (d.getTime() - Date.now()) / 3600000
}

// Кінець запису (мс): початок + тривалість. Без дати/часу — нескінченність (не відкидаємо запис)
function lessonEndMs(b) {
  if (!b?.date || !b?.time) return Infinity
  const [h, m] = b.time.split(':').map(Number)
  const d = parseYMD(b.date)
  d.setHours(h, m || 0, 0, 0)
  return d.getTime() + (b.durationHours || 1) * 3600000
}

function lessonCountdown(b) {
  if (!b?.date || !b?.time) return null
  const [h, m] = b.time.split(':').map(Number)
  const d = parseYMD(b.date)
  d.setHours(h, m || 0, 0, 0)
  const diff = d.getTime() - Date.now()
  if (diff <= 0) return null
  const days = Math.floor(diff / 86400000)
  const hrs = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `${days} д ${hrs} год`
  if (hrs > 0) return `${hrs} год ${mins} хв`
  return `${mins} хв`
}

// ─── RESCHEDULE MODAL ────────────────────────────────────────────
function RescheduleModal({ booking, user, profile, onClose, onDone }) {
  useBackClose(true, onClose)
  const { showToast: showModalToast, ToastEl: ModalToastEl } = useToast()
  const isVipStudent = profile?.isVip === true
  const [today] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(null)
  const [slots, setSlots] = useState({})
  const [selectedTime, setSelectedTime] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [adminSettings, setAdminSettings] = useState({ lunchEnabled: true, lunchStart: 12, lunchEnd: 13 })
  const [monthAvail, setMonthAvail] = useState({})

  const durationHours = booking.durationHours || 1
  // Перерва після запису (з послуги на момент запису) переходить на нове місце разом із записом
  const bufferMin = bufferOf(booking)

  useEffect(() => {
    getAdminSettings().then(s => setAdminSettings(s)).catch(() => {})
  }, [])

  useEffect(() => {
    setMonthAvail({})
    const unsub = subscribeMonthAvailability(viewMonth.getFullYear(), viewMonth.getMonth(), avail => setMonthAvail(avail))
    return unsub
  }, [viewMonth])

  useEffect(() => {
    if (!selectedDate) { setSlots({}); setSelectedTime(null); return }
    setLoading(true)
    const unsub = subscribeSlotsForDate(formatDateYMD(selectedDate), data => {
      setSlots(data || {})
      setLoading(false)
    })
    return unsub
  }, [selectedDate])

  function isBlockedByLunch(time) {
    if (!adminSettings.lunchEnabled) return false
    const [h, m] = time.split(':').map(Number)
    const startMin = h * 60 + m
    const endMin = startMin + durationHours * 60
    return startMin < adminSettings.lunchEnd * 60 && endMin > adminSettings.lunchStart * 60
  }

  function wouldOverlap(time) {
    const [h, m] = time.split(':').map(Number)
    const startMin = h * 60 + m
    const endMin = startMin + durationHours * 60
    if (Object.values(slots).some(s => {
      if (s.available !== false) return false
      const [sh, sm] = (s.time || '').split(':').map(Number)
      const sMin = sh * 60 + sm
      return sMin >= startMin && sMin < endMin
    })) return true
    // Слоти одразу після запису мають бути вільні — там перерва
    return bufferMin > 0 && rangeTaken(slots, endMin, endMin + bufferMin, { ignoreClosed: true })
  }

  const slotsList = useMemo(() => Object.values(slots)
    .filter(s => (s.time || '').endsWith(':00'))
    .filter(s => !s.vipOnly || isVipStudent)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    .map(s => ({
      ...s,
      lunchBlocked: isBlockedByLunch(s.time),
      overlapBlocked: s.available !== false && wouldOverlap(s.time),
    }))
    .filter(s => !s.lunchBlocked)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  , [slots, adminSettings, durationHours, isVipStudent])

  const days = useMemo(() => getMonthGrid(viewMonth.getFullYear(), viewMonth.getMonth()), [viewMonth])

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime) return
    setSaving(true)
    try {
      const newDate = formatDateYMD(selectedDate)

      // Перерахунок надбавки за новими слотами + заборона VIP-годин для не-VIP
      const [nh, nm] = selectedTime.split(':').map(Number)
      const newStartMin = nh * 60 + (nm || 0)
      let newSurcharge = 0
      for (let i = 0; i < durationHours; i++) {
        const slotMin = newStartMin + i * 60
        const key = `slot${String(Math.floor(slotMin / 60)).padStart(2, '0')}${String(slotMin % 60).padStart(2, '0')}`
        newSurcharge += slots[key]?.surcharge || 0
        if (i > 0 && !isVipStudent && slots[key]?.vipOnly) {
          showModalToast('Неможливо перенести: наступна година є VIP-слотом')
          setSaving(false)
          return
        }
      }
      // Ціна = стара ціна + різниця надбавки. Знижка клієнта — фіксована сума за годину (а не %),
      // тож вона вже врахована в старій ціні і на різницю надбавки не діє.
      const oldSurcharge = booking.surcharge || 0
      let newPrice = booking.price
      if (booking.price != null) {
        newPrice = Math.max(0, booking.price + (newSurcharge - oldSurcharge))
      } else if (newSurcharge > 0) {
        newPrice = newSurcharge
      }

      // 1. Атомарно займаємо весь новий діапазон ДО скасування старого
      const claimed = await claimSlot(newDate, selectedTime, durationHours, adminSettings.interval || 30, bufferMin)
      if (!claimed) {
        showModalToast('Цей слот щойно зайняли. Оберіть інший час.')
        setSaving(false)
        return
      }
      // 2. Скасовуємо старий запис (відновлює старі слоти)
      await cancelBooking(user.uid, booking.id, { isReschedule: true })
      // 3. Створюємо новий
      await createBooking(user.uid, {
        date: newDate,
        time: selectedTime,
        serviceType: booking.serviceType,
        serviceId: booking.serviceId,
        serviceName: booking.serviceName,
        price: newPrice,
        surcharge: newSurcharge || undefined,
        discountAmt: booking.discountAmt || undefined,
        durationHours,
        addons: normAddons(booking.addons).length ? normAddons(booking.addons) : undefined,
        addonsPrice: booking.addonsPrice || undefined,
        bufferMin: bufferMin || undefined,
        studentName: booking.studentName,
        phone: booking.phone,
        rescheduledFrom: `${booking.date} ${booking.time}`,
      })
      onDone()
    } catch (e) {
      showModalToast('Помилка: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="dialog-backdrop show" onClick={e => e.target.classList.contains('dialog-backdrop') && onClose()} ref={el => el && (el.scrollTop = 0)}>
      {ModalToastEl}
      <div className="dialog">
        <div className="dialog-handle" />
        <div className="dialog-title" style={{ fontSize: 16, marginBottom: 4 }}>📅 Перенести запис</div>
        <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 14, textAlign: 'center' }}>
          {booking.serviceName} · {booking.date} о {booking.time}
        </div>

        {/* CALENDAR */}
        <div className="cal-card" style={{ marginBottom: 14 }}>
          <div className="cal-head">
            <button className="cal-nav-btn" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>‹</button>
            <div className="cal-month">{getMonthName(viewMonth.getMonth())} {viewMonth.getFullYear()}</div>
            <button className="cal-nav-btn" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>›</button>
          </div>
          <div className="cal-weekdays">
            {['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].map(d => <div key={d} className="cal-wd">{d}</div>)}
          </div>
          <div className="cal-days">
            {days.map((d, i) => {
              if (!d) return <div key={i} className="cal-day empty" />
              const disabled = isPast(d)
              const isToday = isSameDay(d, today)
              const selected = selectedDate && isSameDay(d, selectedDate)
              const isCurrent = d && formatDateYMD(d) === booking.date
              const dateStr = formatDateYMD(d)
              const avail = monthAvail[dateStr]
              const availClass = (!disabled && !isCurrent) ? (avail ? `day-${avail}` : '') : ''
              return (
                <button
                  key={i}
                  className={`cal-day ${disabled || isCurrent ? 'disabled' : ''} ${isToday ? 'today' : ''} ${selected ? 'selected' : ''} ${availClass}`}
                  onClick={() => !disabled && !isCurrent && setSelectedDate(d)}
                  disabled={disabled || isCurrent}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        </div>

        {/* TIME SLOTS */}
        {selectedDate && (
          <>
            <div className="section-title" style={{ marginTop: 0 }}>
              Час · {formatDateLabel(selectedDate)}
            </div>
            {loading ? (
              <div style={{ textAlign:'center', padding:16 }}><div className="spinner" style={{ margin:'0 auto' }} /></div>
            ) : slotsList.length === 0 ? (
              <div style={{ textAlign:'center', color:'var(--dim)', fontSize:13, padding:16 }}>На цю дату немає слотів</div>
            ) : (
              <div className="slots-grid" style={{ marginBottom: 16 }}>
                {slotsList.map(slot => {
                  const unavail = slot.available === false || slot.overlapBlocked
                  const isSelected = selectedTime === slot.time
                  return (
                    <button
                      key={slot.time}
                      className={`slot ${unavail ? 'taken' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => !unavail && setSelectedTime(slot.time)}
                      disabled={unavail}
                    >
                      <div className="slot-time">{slot.time}</div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        <div className="dialog-actions">
          <button className="dialog-btn secondary" onClick={onClose}>Скасувати</button>
          <button
            className="dialog-btn primary"
            onClick={handleConfirm}
            disabled={!selectedDate || !selectedTime || saving}
          >
            {saving ? 'Зберігаємо...' : 'Перенести →'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── MAIN ────────────────────────────────────────────────────────
export default function BookingsTab({ user, profile, bookingsData }) {
  const { readOnly: licenseReadOnly } = useContext(LicenseContext)
  const { upcoming, completed, loading } = bookingsData
  const [rescheduleBooking, setRescheduleBooking] = useState(null)
  const [cancelConfirmId, setCancelConfirmId] = useState(null)
  const [noteOpenId, setNoteOpenId] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [toast, setToast] = useState(null)
  const [adminCfg, setAdminCfg] = useState({ bookCutoffHours: 24, studentCanCancel: true })
  useEffect(() => { getAdminSettings().then(s => setAdminCfg(s)).catch(() => {}) }, [])
  const cancelCutoff = adminCfg.bookCutoffHours ?? 24
  const cancelAllowed = adminCfg.studentCanCancel !== false
  const totalDebt = useMemo(
    () => completed.filter(b => b.status === 'confirmed' && !b.isPaid && b.price > 0).reduce((s, b) => s + (b.price || 0), 0),
    [completed]
  )
  const [showAllCompleted, setShowAllCompleted] = useState(false)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  const handleCancel = async (booking) => {
    if (!cancelAllowed || hoursUntilLesson(booking) < cancelCutoff) {
      showToast(`Скасувати запис можна не пізніше ніж за ${cancelCutoff} год до початку. Зверніться до майстра.`, 'error')
      return
    }
    if (cancelConfirmId !== booking.id) {
      setCancelConfirmId(booking.id)
      return
    }
    setCancelConfirmId(null)
    try {
      await cancelBooking(user.uid, booking.id)
      showToast(`Запис ${booking.date} о ${booking.time} скасовано`)
    } catch (e) {
      showToast('Помилка: ' + e.message, 'error')
    }
  }

  const renderCard = (b, isPast = false) => {
    const d = parseYMD(b.date)
    const endTime = b.time && b.durationHours
      ? (() => {
          const [h, m] = b.time.split(':').map(Number)
          const total = h * 60 + (m || 0) + Math.round(b.durationHours * 60)
          return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`
        })()
      : null
    const cancelLocked = !cancelAllowed || hoursUntilLesson(b) < cancelCutoff
    const statusClass = b.status === 'confirmed' ? 'status-confirmed'
      : b.status === 'cancelled' ? 'status-cancelled' : 'status-pending'
    const statusText = b.status === 'confirmed' ? (isPast ? 'Завершено' : 'Підтверджено')
      : b.status === 'cancelled' ? 'Скасовано' : 'Очікує'

    return (
      <div key={b.id} className="booking-card" style={isPast ? {opacity:0.6} : {}}>
        <div className="booking-date">
          <div className="booking-day">{d.getDate()}</div>
          <div className="booking-mon">{getMonthShort(d.getMonth())}</div>
        </div>
        <div className="booking-body">
          <div className="booking-time">
            {b.time}{endTime ? ` — ${endTime}` : ''}
          </div>
          <div className="booking-type">
            {b.serviceType === 'school' ? '🎓' : '🚙'} {b.serviceName} · {formatDurHours(b.durationHours || 1)}
            {(b.price > 0) && (
              <span style={{marginLeft:6, color:'var(--gold)', fontWeight:700}}>
                {b.price} ₴{b.surcharge > 0 ? ` (+${b.surcharge}₴)` : ''}
              </span>
            )}
          </div>
          {normAddons(b.addons).length > 0 && (
            <div style={{fontSize:11, color:'var(--dim)', margin:'2px 0 4px'}}>➕ {addonsLabel(normAddons(b.addons))}</div>
          )}
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
            {(b.status === 'confirmed' || b.status === 'cancelled') && (
              <div className={`booking-status ${statusClass}`}>{statusText}</div>
            )}
            {b.isPaid && <div style={{fontSize:10,fontWeight:700,color:"#63d37b",padding:"2px 7px",borderRadius:6,background:"rgba(99,211,120,0.12)"}}>✓ Оплачено</div>}
            {!isPast && b.status === 'confirmed' && lessonCountdown(b) && (
              <div style={{fontSize:10,fontWeight:700,color:'#fb923c',padding:'2px 7px',borderRadius:6,background:'rgba(251,146,60,0.1)'}}>⏱ {lessonCountdown(b)}</div>
            )}
          </div>
          {isPast && b.status === 'confirmed' && b.instructorNote && (
            <div style={{marginTop:6,padding:'7px 10px',borderRadius:9,
              background:'rgba(59,130,246,0.08)',border:'1px solid rgba(59,130,246,0.2)',
              fontSize:11,color:'var(--text)',lineHeight:1.5}}>
              <span style={{fontSize:9,fontWeight:700,color:'rgba(96,165,250,0.8)',display:'block',marginBottom:2}}>📝 Нотатка майстра</span>
              {b.instructorNote}
            </div>
          )}
          {isPast && b.status === 'confirmed' && (
            <div style={{marginTop:6,display:'flex',alignItems:'center',gap:4}}>
              <span style={{fontSize:10,color:'var(--dim)',marginRight:2}}>Оцінка:</span>
              {[1,2,3,4,5].map(star => (
                <span
                  key={star}
                  onClick={() => rateBooking(user.uid, b.id, star).catch(()=>{})}
                  style={{
                    fontSize:18, cursor:'pointer', lineHeight:1,
                    color: (b.rating || 0) >= star ? '#fbbf24' : 'rgba(255,255,255,0.15)',
                    transition:'color 0.15s',
                  }}
                >★</span>
              ))}
            </div>
          )}
          {!isPast && b.status !== 'cancelled' && b.studentConfirmed && (
            <div className="booking-meta" style={{ color: '#4caf50', marginTop: 4 }}>
              ✓ Ви підтвердили присутність
            </div>
          )}
          {!isPast && b.status !== 'cancelled' && cancelLocked && cancelAllowed && (
            <div className="booking-meta" style={{ color: 'var(--dim)', marginTop: 4 }}>
              ⏳ Скасування — не пізніше ніж за {cancelCutoff} год
            </div>
          )}
          {!isPast && b.status !== 'cancelled' && (
            <div className="booking-cal-row">
              <a href={googleCalendarLink(b)} target="_blank" rel="noopener noreferrer" className="cal-add-btn">
                Google Calendar
              </a>
              <button className="cal-add-btn" onClick={() => downloadICS(b)}>
                Apple Calendar
              </button>
            </div>
          )}
          {!isPast && b.status !== 'cancelled' && (
            <div style={{marginTop:6}}>
              {noteOpenId === b.id ? (
                <div>
                  <textarea
                    value={noteDraft}
                    onChange={e=>setNoteDraft(e.target.value)}
                    placeholder="Що хочете відпрацювати на уроці?"
                    maxLength={150}
                    rows={2}
                    style={{width:'100%',padding:'8px 10px',borderRadius:10,border:'1px solid rgba(99,211,120,0.25)',background:'rgba(99,211,120,0.05)',color:'var(--text)',fontSize:12,fontFamily:'inherit',resize:'none',boxSizing:'border-box',outline:'none',marginBottom:5}}
                  />
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={()=>{saveStudentNote(user.uid,b.id,noteDraft.trim()).catch(()=>{});setNoteOpenId(null);}} style={{flex:1,padding:'5px 10px',borderRadius:10,border:'none',cursor:'pointer',background:'rgba(99,211,120,0.15)',color:'#63d37b',fontSize:12,fontWeight:700,fontFamily:'inherit'}}>Зберегти</button>
                    <button onClick={()=>setNoteOpenId(null)} style={{padding:'5px 10px',borderRadius:10,border:'none',cursor:'pointer',background:'rgba(255,255,255,0.06)',color:'var(--dim)',fontSize:12,fontFamily:'inherit'}}>✕</button>
                  </div>
                </div>
              ) : (
                <button onClick={()=>{setNoteOpenId(b.id);setNoteDraft(b.studentNote||'');}} style={{fontSize:11,padding:'3px 10px',borderRadius:9,border:'1px dashed rgba(99,211,120,0.25)',background:'none',color:'var(--dim)',cursor:'pointer',fontFamily:'inherit'}}>
                  {b.studentNote ? `💬 ${b.studentNote}` : '💬 Нотатка майстру'}
                </button>
              )}
            </div>
          )}
        </div>
        {!isPast && b.status !== 'cancelled' && (
          <div className="booking-actions">
            {!licenseReadOnly && <button className="action-btn" title="Перенести" onClick={() => setRescheduleBooking(b)}>📅</button>}
            {cancelConfirmId === b.id ? (
              <>
                <button className="action-btn" style={{ color: '#e53935', fontSize: 11, padding: '2px 6px' }} onClick={() => handleCancel(b)}>Так</button>
                <button className="action-btn" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => setCancelConfirmId(null)}>Ні</button>
              </>
            ) : (
              <button
                className="action-btn"
                title={cancelLocked ? `Скасування доступне не пізніше ніж за ${cancelCutoff} год` : 'Скасувати'}
                onClick={() => handleCancel(b)}
                disabled={cancelLocked}
                style={cancelLocked ? { opacity: 0.4 } : {}}
              >✕</button>
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return <div style={{textAlign:'center', padding:'60px'}}><div className="spinner" style={{margin:'0 auto'}}></div></div>
  }

  return (
    <div className="fade-up">
      {upcoming.length === 0 && completed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-emoji">📅</div>
          <div className="empty-state-title">Поки нема записів</div>
          <div className="empty-state-desc">Перейди на вкладку Запис і вибери час запису</div>
        </div>
      ) : (
        <>
          {totalDebt > 0 && (
            <div style={{borderRadius:14,background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.2)',padding:'12px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
              <div style={{fontSize:22,flexShrink:0}}>💳</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:800,color:'#fca5a5'}}>Заборгованість: {totalDebt} ₴</div>
                <div style={{fontSize:11,color:'var(--dim)',marginTop:2}}>Зверніться до майстра для оплати</div>
              </div>
            </div>
          )}
          {upcoming.length > 0 && (() => {
            // Сьогоднішні записи, що вже закінчились, не вважаємо «наступним»
            const next = upcoming.find(b => lessonEndMs(b) > Date.now())
            if (!next) return null
            const hrs = hoursUntilLesson(next)
            const d = parseYMD(next.date)
            const countdown = !isFinite(hrs) ? '' : hrs <= 0 ? 'Триває зараз' : hrs < 1 ? 'Менше за годину' : hrs < 24 ? `Через ${Math.round(hrs)} год` : `Через ${Math.ceil(hrs / 24)} дн`
            return (
              <div style={{borderRadius:18,background:'linear-gradient(135deg,rgba(99,155,255,0.1) 0%,rgba(120,80,255,0.06) 100%)',border:'1px solid rgba(99,155,255,0.18)',padding:'16px',marginBottom:16}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <div style={{fontSize:11,color:'var(--dim)',fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>Наступний запис</div>
                  {countdown && <div className="nl-pill" style={{fontSize:11,fontWeight:800,padding:'3px 9px',borderRadius:8}}>{countdown}</div>}
                </div>
                <div style={{fontSize:28,fontWeight:900,color:'var(--text)',lineHeight:1}}>{next.time}</div>
                <div style={{fontSize:14,fontWeight:700,color:'var(--text)',margin:'4px 0 2px'}}>{d.getDate()} {getMonthShort(d.getMonth())} · {next.serviceName}</div>
                <div style={{fontSize:12,color:'var(--dim)',marginBottom:12}}>{formatDurHours(next.durationHours || 1)}{normAddons(next.addons).length > 0 ? ` · ➕ ${addonsLabel(normAddons(next.addons))}` : ''}</div>
                <div className="booking-cal-row">
                  <a href={googleCalendarLink(next)} target="_blank" rel="noopener noreferrer" className="cal-add-btn">Google Calendar</a>
                  <button className="cal-add-btn" onClick={() => downloadICS(next)}>Apple Calendar</button>
                </div>
              </div>
            )
          })()}
          {upcoming.length > 0 && (
            <>
              <div className="section-title" style={{ fontSize: 14, fontWeight: 800, color: '#fff', textAlign: 'center' }}>Найближчі</div>
              {upcoming.map(b => renderCard(b))}
            </>
          )}
          {completed.length > 0 && (
            <>
              <div className="section-title" style={{ fontSize: 14, fontWeight: 800, color: '#fff', textAlign: 'center' }}>Завершені ({completed.length})</div>
              {(showAllCompleted ? completed : completed.slice(0, 10)).map(b => renderCard(b, true))}
              {completed.length > 10 && (
                <button
                  onClick={() => setShowAllCompleted(v => !v)}
                  style={{
                    display:'block', width:'100%', marginTop:8, padding:'10px 16px',
                    borderRadius:12, border:'1px solid rgba(255,255,255,0.1)',
                    background:'rgba(255,255,255,0.04)', color:'var(--dim)',
                    fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                  }}
                >
                  {showAllCompleted ? '▲ Сховати' : `▼ Показати всі (${completed.length})`}
                </button>
              )}
            </>
          )}
        </>
      )}

      {rescheduleBooking && (
        <RescheduleModal
          booking={rescheduleBooking}
          user={user}
          profile={profile}
          onClose={() => setRescheduleBooking(null)}
          onDone={() => { setRescheduleBooking(null); showToast('Запис перенесено') }}
        />
      )}

      {toast && (
        <div style={{
          position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)',
          background:'var(--surface)', color: toast.type === 'error' ? 'var(--accent)' : 'var(--green)',
          padding:'11px 18px', borderRadius:12, fontSize:13, fontWeight:600,
          boxShadow:'var(--shadow)', zIndex:9999, maxWidth:340, width:'calc(100% - 32px)',
          borderLeft: `3px solid ${toast.type === 'error' ? 'var(--accent)' : 'var(--green)'}`,
          animation:'fadeInUp .2s ease', pointerEvents:'none',
        }}>
          {toast.type !== 'error' && '✓ '}{toast.msg}
        </div>
      )}
    </div>
  )
}
