import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { ref, get, onValue, push, set, update, runTransaction, off } from 'firebase/database'
import { db } from '../firebase/config'
import { getMonthGrid, getMonthName, formatDateYMD, isPast, isSameDay } from '../utils/date'
import './cabinet/BookTab.css'

const BG    = "#111214"
const SURF  = "#1e2024"
const BRD   = "rgba(255,255,255,0.07)"
const TEXT  = "#e8e8ea"
const DIM   = "#8b8d93"
const ACCENT = "#ff5a3c"
const GREEN = "#34d399"

export default function BookPublic() {
  const { slug } = useParams()
  const [iid, setIid] = useState(null)

  // Build a Firebase ref for this instructor's namespace
  const mkRef = (path) => ref(db, path ? `instructors/${iid}/${path}` : `instructors/${iid}`)

  const [notFound, setNotFound]         = useState(false)
  const [instrProfile, setInstrProfile] = useState(null)
  const [services, setServices]         = useState([])
  const [settings, setSettings]         = useState({})
  const [selectedSvc, setSelectedSvc]   = useState(null)
  const [today]                          = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [viewMonth, setViewMonth]        = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(null)
  const [monthAvail, setMonthAvail]     = useState({})
  const [slots, setSlots]               = useState({})
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedTime, setSelectedTime] = useState(null)
  const [step, setStep]                 = useState(1) // 1=pick, 2=form, 3=done
  const [name, setName]                 = useState('')
  const [phone, setPhone]               = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [error, setError]               = useState('')
  const [doneData, setDoneData]         = useState(null)
  const timeSectionRef = useRef(null)

  // Resolve slug → iid
  useEffect(() => {
    if (!slug) return
    get(ref(db, `slugs/${slug}`)).then(snap => {
      if (!snap.exists()) { setNotFound(true); return }
      setIid(snap.val().iid)
    }).catch(() => setNotFound(true))
  }, [slug])

  // Load instructor profile + settings + services
  useEffect(() => {
    if (!iid) return
    get(mkRef('admin_settings/profile')).then(snap => {
      if (!snap.exists()) { setNotFound(true); return }
      setInstrProfile(snap.val())
    }).catch(() => setNotFound(true))

    get(mkRef('admin_settings')).then(snap => {
      if (snap.exists()) setSettings(snap.val())
    }).catch(() => {})

    get(mkRef('admin_data/services')).then(snap => {
      if (!snap.exists()) return
      const val = snap.val()
      const arr = (Array.isArray(val) ? val : Object.values(val)).filter(s => s?.active && !s.archived)
      setServices(arr)
      if (arr.length) setSelectedSvc(arr[0])
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iid])

  // Month availability subscription
  useEffect(() => {
    if (!iid) return
    setMonthAvail({})
    const prefix = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth()+1).padStart(2,'0')}-`
    const r = ref(db, `instructors/${iid}/timeslots`)
    const handler = onValue(r, snap => {
      const all = snap.val() || {}
      const result = {}
      Object.entries(all).forEach(([date, slotsObj]) => {
        if (!date.startsWith(prefix) || !slotsObj) return
        const list = Object.values(slotsObj).filter(s => s?.time && !s.adminBlocked)
        if (!list.length) return
        const free  = list.filter(x => x.available !== false).length
        const taken = list.filter(x => x.available === false).length
        result[date] = taken === 0 ? 'free' : free === 0 ? 'full' : 'partial'
      })
      setMonthAvail(result)
    })
    return () => off(r, 'value', handler)
  }, [iid, viewMonth])

  // Slots for selected date
  useEffect(() => {
    if (!iid || !selectedDate) { setSlots({}); return }
    setSlotsLoading(true)
    const dateStr = formatDateYMD(selectedDate)
    const r = ref(db, `instructors/${iid}/timeslots/${dateStr}`)
    const handler = onValue(r, snap => {
      setSlots(snap.exists() ? snap.val() : {})
      setSlotsLoading(false)
    })
    return () => off(r, 'value', handler)
  }, [iid, selectedDate])

  // Scroll to time section after date pick
  useEffect(() => {
    if (!selectedDate || !timeSectionRef.current) return
    setTimeout(() => timeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }, [selectedDate])

  const durationHours = selectedSvc ? selectedSvc.duration / 60 : 1

  function isBlockedByLunch(slotTime) {
    if (!settings.lunchEnabled) return false
    const [h, m] = slotTime.split(':').map(Number)
    const startMin = h * 60 + m
    const endMin = startMin + durationHours * 60
    return startMin < (settings.lunchEnd || 13) * 60 && endMin > (settings.lunchStart || 12) * 60
  }

  function wouldOverlap(slotTime) {
    const [h, m] = slotTime.split(':').map(Number)
    const startMin = h * 60 + m
    for (let i = 60; i < durationHours * 60; i += 60) {
      const nextMin = startMin + i
      const key = `slot${String(Math.floor(nextMin/60)).padStart(2,'0')}${String(nextMin%60).padStart(2,'0')}`
      if (!slots[key] || slots[key].available === false) return true
    }
    const endMin = startMin + durationHours * 60
    return Object.values(slots).some(s => {
      if (s.available !== false) return false
      const [sh, sm] = (s.time || '').split(':').map(Number)
      const sMin = sh * 60 + sm
      return sMin > startMin && sMin < endMin
    })
  }

  const days = useMemo(() => getMonthGrid(viewMonth.getFullYear(), viewMonth.getMonth()), [viewMonth])

  const slotsList = useMemo(() => Object.values(slots)
    .filter(s => s?.time && s.time.endsWith(':00'))
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    .map(slot => ({
      ...slot,
      lunchBlocked:   isBlockedByLunch(slot.time),
      overlapBlocked: slot.available !== false && wouldOverlap(slot.time),
    }))
    .filter(slot => {
      if (!selectedDate || !isSameDay(selectedDate, today)) return true
      const [h, m] = (slot.time || '0:0').split(':').map(Number)
      const dt = new Date(selectedDate); dt.setHours(h, m, 0, 0)
      return dt > new Date()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  , [slots, durationHours, settings, selectedDate])

  const handleSubmit = async () => {
    if (!name.trim())  { setError("Введіть ваше ім'я"); return }
    if (!phone.trim()) { setError('Введіть номер телефону'); return }
    if (!selectedDate || !selectedTime || !selectedSvc) return
    setSubmitting(true); setError('')
    try {
      const dateStr = formatDateYMD(selectedDate)
      const slotId  = `slot${selectedTime.replace(':', '')}`

      // Atomic slot claim via transaction
      const slotRef = ref(db, `instructors/${iid}/timeslots/${dateStr}/${slotId}`)
      const txResult = await runTransaction(slotRef, cur => {
        if (cur && cur.available === false) return undefined // abort — taken
        return { ...(cur || {}), available: false, time: selectedTime }
      })
      if (!txResult.committed) {
        setError('Цей час щойно зайняли. Оберіть інший.'); setSubmitting(false); return
      }

      // Block additional hour slot for 2h booking
      if (durationHours === 2) {
        const [h, m] = selectedTime.split(':').map(Number)
        const nMin = h * 60 + m + 60
        const nId  = `slot${String(Math.floor(nMin/60)).padStart(2,'0')}${String(nMin%60).padStart(2,'0')}`
        await update(ref(db, `instructors/${iid}/timeslots/${dateStr}`), {
          [`${nId}/available`]: false,
          [`${nId}/time`]: `${String(Math.floor(nMin/60)).padStart(2,'0')}:${String(nMin%60).padStart(2,'0')}`,
        }).catch(() => {})
      }

      // Write booking (guest, no auth — phone is identifier)
      const uid        = 'guest_' + phone.replace(/\D/g, '')
      const bookingRef = push(ref(db, `instructors/${iid}/bookings/${uid}`))
      await set(bookingRef, {
        id:           bookingRef.key,
        userId:       uid,
        date:         dateStr,
        time:         selectedTime,
        serviceName:  selectedSvc.name,
        serviceType:  selectedSvc.type,
        durationHours,
        price:        selectedSvc.price || 0,
        studentName:  name.trim(),
        phone:        phone.trim(),
        status:       'confirmed',
        createdAt:    Date.now(),
        createdBy:    'public',
      })

      setDoneData({ date: dateStr, time: selectedTime, svc: selectedSvc })
      setStep(3)
    } catch {
      setError("Помилка з'єднання. Спробуйте ще раз.")
    } finally {
      setSubmitting(false)
    }
  }

  // ─── LOADING (resolving slug) ──────────────────────────────────
  if (!iid && !notFound) return (
    <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div className="spinner" />
    </div>
  )

  // ─── 404 ───────────────────────────────────────────────────────
  if (notFound) return (
    <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ textAlign:'center', color:TEXT }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🔍</div>
        <div style={{ fontSize:18, fontWeight:800, marginBottom:8 }}>Інструктора не знайдено</div>
        <div style={{ fontSize:13, color:DIM }}>Перевірте посилання або зверніться до інструктора</div>
      </div>
    </div>
  )

  // ─── DONE ──────────────────────────────────────────────────────
  if (step === 3 && doneData) return (
    <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ textAlign:'center', color:TEXT, maxWidth:360, width:'100%' }}>
        <div style={{ fontSize:56, marginBottom:12 }}>✅</div>
        <div style={{ fontSize:22, fontWeight:800, marginBottom:4, color:GREEN }}>Записано!</div>
        <div style={{ fontSize:13, color:DIM, marginBottom:20 }}>Збережіть деталі нижче</div>

        {/* Booking summary card */}
        <div style={{ padding:'16px', background:SURF, borderRadius:16, border:`1px solid ${BRD}`, marginBottom:16, textAlign:'left' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:10 }}>
            <span style={{ color:DIM }}>Послуга</span>
            <span style={{ fontWeight:700 }}>{doneData.svc.name}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:10 }}>
            <span style={{ color:DIM }}>Дата</span>
            <span style={{ fontWeight:700 }}>
              {new Date(doneData.date+'T12:00:00').toLocaleDateString('uk-UA', { weekday:'short', day:'numeric', month:'long' })}
            </span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:10 }}>
            <span style={{ color:DIM }}>Час</span>
            <span style={{ fontWeight:800, fontSize:15 }}>{doneData.time}</span>
          </div>
          <div style={{ height:1, background:'rgba(255,255,255,0.06)', margin:'10px 0' }} />
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
            <span style={{ color:DIM }}>Ваш телефон</span>
            <span style={{ fontWeight:600, color:DIM }}>{phone}</span>
          </div>
        </div>

        {instrProfile?.phone && (
          <div style={{ padding:'12px 16px', background:SURF, borderRadius:14, border:`1px solid ${BRD}`, marginBottom:16 }}>
            <div style={{ fontSize:12, color:DIM, marginBottom:4 }}>Скасування або питання — інструктор</div>
            <a href={`tel:${instrProfile.phone}`} style={{ fontSize:16, fontWeight:700, color:ACCENT, textDecoration:'none' }}>
              {instrProfile.phone}
            </a>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <a
            href={`/my/${slug}?phone=${encodeURIComponent(phone)}`}
            style={{ display:'block', width:'100%', padding:'13px', borderRadius:14, border:`1px solid ${BRD}`,
              background:SURF, color:GREEN, fontSize:14, fontWeight:700, textAlign:'center', textDecoration:'none',
              boxSizing:'border-box' }}
          >
            Переглянути мої записи
          </a>
          <button
            onClick={() => { setStep(1); setSelectedDate(null); setSelectedTime(null); setName(''); setPhone('') }}
            style={{ width:'100%', padding:'13px', borderRadius:14, border:'none', cursor:'pointer',
              background:'rgba(255,255,255,0.06)', color:DIM, fontSize:14, fontWeight:700 }}
          >
            Записатись ще раз
          </button>
        </div>
      </div>
    </div>
  )

  const INP = {
    width:'100%', background:BG, border:`1px solid ${BRD}`, borderRadius:10,
    padding:'10px 14px', color:TEXT, fontSize:14, outline:'none', boxSizing:'border-box'
  }
  const LBL = { fontSize:12, color:DIM, marginBottom:6 }

  return (
    <div style={{ minHeight:'100vh', background:BG, color:TEXT,
      fontFamily:'ui-sans-serif,-apple-system,BlinkMacSystemFont,system-ui,sans-serif' }}>
      <div style={{ maxWidth:480, margin:'0 auto', padding:'0 16px 80px', paddingTop:'max(16px,env(safe-area-inset-top))' }}>

        {/* ─── HEADER ─────────────────────────────────────────── */}
        {instrProfile ? (
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 0 20px' }}>
            {instrProfile.photo
              ? <img src={instrProfile.photo} alt="" style={{ width:52, height:52, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/>
              : <div style={{ width:52, height:52, borderRadius:'50%', background:'linear-gradient(135deg,#ff7a5c,#ff5a3c)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:900, flexShrink:0 }}>
                  {(instrProfile.name||'?')[0]}
                </div>
            }
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:18, fontWeight:800, lineHeight:1.2 }}>{instrProfile.name}</div>
              {instrProfile.address && <div style={{ fontSize:12, color:DIM, marginTop:2 }}>📍 {instrProfile.address}</div>}
              {instrProfile.experience > 0 && <div style={{ fontSize:11, color:DIM }}>Досвід {instrProfile.experience} р.</div>}
            </div>
          </div>
        ) : (
          <div style={{ height:80, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div className="spinner" />
          </div>
        )}

        {/* ─── STEP 1: PICK SERVICE + DATE + TIME ─────────────── */}
        {step === 1 && instrProfile && (
          <>
            {/* Services */}
            {services.length > 0 && (
              <>
                <div className="section-title">1. Послуга</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {services.map(svc => {
                    const isSelected = selectedSvc?.id === svc.id
                    return (
                      <div
                        key={svc.id}
                        className={`svc-tile${isSelected ? ' selected' : ''}`}
                        style={{ padding:'10px 8px', textAlign:'center', borderRadius:12 }}
                        onClick={() => { setSelectedSvc(svc); setSelectedTime(null) }}
                      >
                        <div style={{ fontSize:20, marginBottom:4 }}>{svc.type === 'school' ? '🎓' : '🚙'}</div>
                        <div style={{ fontSize:11, fontWeight:800, lineHeight:1.3 }}>{svc.name}</div>
                        {svc.price > 0 && <div style={{ fontSize:10, color:DIM, marginTop:2 }}>{svc.price} ₴</div>}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Calendar */}
            <div className="section-title" style={{ marginTop:16 }}>{services.length ? '2.' : '1.'} Дата</div>
            <div className="cal-card">
              <div className="cal-head">
                <button className="cal-nav-btn" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth()-1, 1))}>‹</button>
                <div className="cal-month">{getMonthName(viewMonth.getMonth())} {viewMonth.getFullYear()}</div>
                <button className="cal-nav-btn" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth()+1, 1))}>›</button>
              </div>
              <div className="cal-weekdays">
                {['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].map(d => <div key={d} className="cal-wd">{d}</div>)}
              </div>
              <div className="cal-days">
                {days.map((d, i) => {
                  if (!d) return <div key={i} className="cal-day empty" />
                  const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + (settings.calendarOpenDays || 30))
                  const disabled = isPast(d) || d > maxDate
                  const isToday  = isSameDay(d, today)
                  const selected = selectedDate && isSameDay(d, selectedDate)
                  const dateStr  = formatDateYMD(d)
                  const avail    = monthAvail[dateStr]
                  const dayClass = disabled ? '' : avail === undefined ? 'has-slots' : avail ? `day-${avail}` : ''
                  return (
                    <button
                      key={i}
                      className={`cal-day ${disabled?'disabled':''} ${isToday?'today':''} ${selected?'selected':''} ${dayClass}`}
                      onClick={() => { if (!disabled) { setSlotsLoading(true); setSelectedDate(d); setSelectedTime(null) } }}
                      disabled={disabled}
                    >
                      {d.getDate()}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Time slots */}
            {selectedDate && (
              <>
                <div ref={timeSectionRef} className="section-title">
                  {services.length ? '3.' : '2.'} Час ({selectedDate.toLocaleDateString('uk-UA', { weekday:'short', day:'numeric', month:'long' })})
                </div>
                {slotsLoading ? (
                  <div style={{ textAlign:'center', padding:24 }}><div className="spinner" style={{ margin:'0 auto' }} /></div>
                ) : slotsList.length === 0 ? (
                  <div style={{ textAlign:'center', padding:24, color:DIM, fontSize:13 }}>На цю дату немає слотів</div>
                ) : (
                  <>
                    <div className="slots-grid">
                      {slotsList.map(slot => {
                        const taken     = slot.available === false
                        const blocked   = slot.lunchBlocked || slot.overlapBlocked
                        const isSelected = selectedTime === slot.time
                        return (
                          <button
                            key={slot.time}
                            className={`slot ${taken||blocked?'taken':''} ${isSelected?'selected':''}`}
                            onClick={() => !taken && !blocked && setSelectedTime(slot.time)}
                            disabled={taken || blocked}
                          >
                            <div className="slot-time">{slot.time}</div>
                            {slot.lunchBlocked && <div style={{ fontSize:8, opacity:0.5 }}>обід</div>}
                            {taken && !slot.lunchBlocked && <div style={{ fontSize:8, opacity:0.6 }}>зайнято</div>}
                          </button>
                        )
                      })}
                    </div>
                    <div className="slot-legend">
                      <div className="leg-item"><div className="leg-dot free" /> Вільно</div>
                      <div className="leg-item"><div className="leg-dot taken" /> Зайнято</div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* CTA */}
            {selectedTime && (
              <button
                className="btn-primary"
                style={{ marginTop:16 }}
                onClick={() => setStep(2)}
              >
                Далі → {formatDateYMD(selectedDate).slice(-5).split('-').reverse().join('.')} о {selectedTime}
              </button>
            )}
          </>
        )}

        {/* ─── STEP 2: CONTACT FORM ───────────────────────────── */}
        {step === 2 && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0 20px' }}>
              <button
                onClick={() => setStep(1)}
                style={{ width:34, height:34, borderRadius:10, background:SURF, border:'none',
                  cursor:'pointer', color:TEXT, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div style={{ fontSize:16, fontWeight:800 }}>Ваші дані</div>
            </div>

            {/* Summary card */}
            <div style={{ padding:'14px 16px', background:SURF, borderRadius:14, border:`1px solid ${BRD}`, marginBottom:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
                <span style={{ color:DIM }}>Послуга</span>
                <span style={{ fontWeight:700 }}>{selectedSvc?.name || '—'}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
                <span style={{ color:DIM }}>Дата</span>
                <span style={{ fontWeight:700 }}>
                  {new Date(formatDateYMD(selectedDate)+'T12:00:00').toLocaleDateString('uk-UA', { weekday:'short', day:'numeric', month:'long' })}
                </span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                <span style={{ color:DIM }}>Час</span>
                <span style={{ fontWeight:700 }}>{selectedTime}</span>
              </div>
              {(selectedSvc?.price || 0) > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, marginTop:10, paddingTop:10, borderTop:`1px solid ${BRD}` }}>
                  <span style={{ color:DIM }}>Ціна</span>
                  <span style={{ fontWeight:800, color:GREEN }}>{selectedSvc.price} ₴</span>
                </div>
              )}
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={LBL}>Ім'я та прізвище *</div>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Олег Петренко" style={INP}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            <div style={{ marginBottom:24 }}>
              <div style={LBL}>Телефон *</div>
              <input
                value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+380XXXXXXXXX" type="tel" style={INP}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            {error && (
              <div style={{ fontSize:12, color:ACCENT, textAlign:'center', marginBottom:14,
                padding:8, borderRadius:8, background:'rgba(255,90,60,0.1)' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{ width:'100%', padding:'14px', borderRadius:14, border:'none', cursor: submitting ? 'default' : 'pointer',
                background: submitting ? 'rgba(52,211,153,0.3)' : `linear-gradient(135deg,#4ade80,${GREEN})`,
                color:'#0a2e1a', fontSize:15, fontWeight:800,
                boxShadow: submitting ? 'none' : '0 4px 16px rgba(52,211,153,0.4)' }}
            >
              {submitting ? 'Записуємо...' : 'Підтвердити запис ✓'}
            </button>
          </>
        )}

      </div>
    </div>
  )
}
