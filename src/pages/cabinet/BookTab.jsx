import { useState, useEffect, useRef, useMemo } from 'react'
import { subscribeSlotsForDate, createBooking, joinQueue, leaveQueue, subscribeQueueForSlot, getAdminSettings, getAdminServices, claimSlot, claimReservedSlot, setViewingSlot, clearViewingSlot, subscribeMonthAvailability } from '../../firebase/db'
import { getMonthGrid, getMonthName, formatDateYMD, isPast, isSameDay, parseYMD } from '../../utils/date'
import { getInitials, pluralize } from '../../utils/format'
import { googleCalendarLink, downloadICS } from '../../utils/calendar'
import { useToast } from '../../hooks/useToast'
import './BookTab.css'

const FALLBACK_SERVICES = [
  { id:'sv1', name:'Стандарт', type:'school',  duration:60, price:0, colorId:'blue'   },
  { id:'sv2', name:'Індивідуальний', type:'private', duration:60, price:0, colorId:'purple' },
]

// Ціна послуги на дату запису: заплановану зміну (nextPrice з дати nextPriceFrom) задає майстер в «Послугах»
function servicePriceOn(svc, dateStr) {
  if (!svc) return 0
  if (svc.nextPrice != null && svc.nextPriceFrom && dateStr && dateStr >= svc.nextPriceFrom) return svc.nextPrice
  return svc.price || 0
}

// Прибираємо дублювання тривалості з назви на плитці ("Стандарт 1 год" → "Стандарт") —
// тривалість вже показана окремим підписом нижче.
function stripDurationSuffix(name) {
  return (name || '').replace(/\s+\d+(?:[.,]\d+)?\s*год\S*\.?\s*$/iu, '').trim() || name
}

function timeToMin(t) {
  const [h, m] = (t || '0:0').split(':').map(Number)
  return h * 60 + m
}
function formatDurShort(min) {
  const h = Math.floor(min / 60), m = min % 60
  return h === 0 ? `${m} хв` : m === 0 ? `${h} год` : `${h} год ${m} хв`
}

export default function BookTab({ user, profile, bookingsData, notifParams }) {
  const { showToast, ToastEl } = useToast()
  const isSchool = profile?.studentType === 'school'
  const isPrivateStudent = profile?.studentType === 'private'
  // Індивідуальний клієнт бачить календар і слоти за налаштуваннями «Індивідуальний», «Стандарт» — за своїми
  const canPrivate = isPrivateStudent
  const isVipStudent = profile?.isVip === true
  // Знижка клієнта — фіксована сума ₴ за годину (так її задає майстер в картці клієнта і так
  // рахує адмінка та ID4-клієнт), а НЕ відсотки. customPrice — індивідуальна ціна ₴/год,
  // що повністю замінює тарифну (знижка тоді не діє).
  const discountAmt = Number(profile?.discount) || 0
  const customPriceAmt = profile?.customPrice > 0 ? Number(profile.customPrice) : null
  const applyDiscount = (price, hours = 1) => discountAmt > 0 ? Math.max(0, Math.round(price - discountAmt * hours)) : price
  const [selectedService, setSelectedService] = useState(null)
  const [today] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [viewMonth, setViewMonth] = useState(() => {
    if (notifParams?.date) {
      const d = new Date(notifParams.date + 'T12:00:00')
      return new Date(d.getFullYear(), d.getMonth(), 1)
    }
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(() => {
    if (notifParams?.date) return new Date(notifParams.date + 'T12:00:00')
    return null
  })
  const [slots, setSlots] = useState({})
  const [queueMap, setQueueMap] = useState({}) // time → count
  const [selectedTime, setSelectedTime] = useState(notifParams?.time || null)
  // Другий обраний годинний слот: два сусідні вільні години об'єднуються в один запис на 2 години
  const [selectedTime2, setSelectedTime2] = useState(null)
  const [loading, setLoading] = useState(() => !!notifParams?.date)
  const initialDateSet = useRef(true)
  useEffect(() => {
    if (initialDateSet.current) { initialDateSet.current = false; return }
    setSelectedTime(null)
    setSelectedTime2(null)
  }, [selectedDate])
  const [adminSettings, setAdminSettings] = useState({ lunchEnabled: true, lunchStart: 12, lunchEnd: 13 })
  const [monthAvail, setMonthAvail] = useState({})
  const timeSectionRef = useRef(null)
  const ctaSectionRef = useRef(null)

  // Dialog state
  const [dialogSlot, setDialogSlot] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [successData, setSuccessData] = useState(null) // {type:'booking'|'queue', date, time, service, duration}
  const [studentNote, setStudentNote] = useState("")

  useEffect(() => { setSelectedTime2(null) }, [selectedService?.id])

  useEffect(() => {
    getAdminSettings().then(s => setAdminSettings(s)).catch(() => {})
    getAdminServices().then(list => {
      const final = list.length > 0 ? list : FALLBACK_SERVICES
      const defaultSvc = final.find(s => canPrivate ? s.type === 'private' : s.type === 'school') || final[0]
      setSelectedService(defaultSvc)
    }).catch(() => {
      const defaultSvc = FALLBACK_SERVICES.find(s => canPrivate ? s.type === 'private' : s.type === 'school') || FALLBACK_SERVICES[0]
      setSelectedService(defaultSvc)
    })
  }, [])

  // Базова тривалість — з послуги. Якщо послуга годинна, клієнт може обрати два сусідні
  // годинні слоти поспіль — тоді запис триває 2 години (як в ID4).
  const baseDurationHours = selectedService ? selectedService.duration / 60 : 1
  // Тривалість слота задає адмін (durMin — розтягнутий слот, напр. "2 год"); без durMin — з послуги.
  const slotDurOf = (slot) => (slot && slot.durMin ? slot.durMin / 60 : baseDurationHours)
  const selectedSlotDur = slotDurOf(selectedTime ? slots[`slot${selectedTime.replace(':', '')}`] : null)
  const durationHours = selectedTime2 ? 2 : selectedSlotDur
  // Базова ціна запису заданої тривалості (індивідуальна ціна або тариф послуги), без надбавки/знижки
  const lessonBase = (hours) => customPriceAmt != null
    ? Math.round(customPriceAmt * hours)
    : Math.round(servicePriceOn(selectedService, formatDateYMD(selectedDate)) * (hours / baseDurationHours))
  const lessonPrice = (hours, surcharge = 0) => customPriceAmt != null
    ? lessonBase(hours) + surcharge
    : applyDiscount(lessonBase(hours) + surcharge, hours)

  function getLunchForDate(date) {
    if (!date) return { lunchEnabled: adminSettings.lunchEnabled, lunchStart: adminSettings.lunchStart || 12, lunchEnd: adminSettings.lunchEnd || 13 }
    const dateStr = formatDateYMD(date)
    const ov = (adminSettings.dateOverrides || []).find(o => o.date === dateStr)
    if (ov && ov.type !== 'closed') return { lunchEnabled: ov.lunchEnabled ?? adminSettings.lunchEnabled, lunchStart: ov.lunchStart ?? adminSettings.lunchStart ?? 12, lunchEnd: ov.lunchEnd ?? adminSettings.lunchEnd ?? 13 }
    const dow = (date.getDay() + 6) % 7
    const ws = (adminSettings.weekSchedule || [])[dow]
    if (ws) return { lunchEnabled: ws.lunchEnabled ?? true, lunchStart: ws.lunchStart ?? 12, lunchEnd: ws.lunchEnd ?? 13 }
    return { lunchEnabled: adminSettings.lunchEnabled, lunchStart: adminSettings.lunchStart || 12, lunchEnd: adminSettings.lunchEnd || 13 }
  }

  function isBlockedByLunch(slotTime, durHours) {
    const { lunchEnabled, lunchStart, lunchEnd } = getLunchForDate(selectedDate)
    if (!lunchEnabled) return false
    const [h, m] = slotTime.split(':').map(Number)
    const startMin = h * 60 + m
    const endMin = startMin + durHours * 60
    return startMin < lunchEnd * 60 && endMin > lunchStart * 60
  }

  function overlapsMyBooking(dateStr, slotTime, durHours) {
    const [nh, nm] = slotTime.split(':').map(Number)
    const newStart = nh * 60 + nm
    const newEnd = newStart + durHours * 60
    return bookingsData.upcoming.some(b => {
      if (b.date !== dateStr || b.status === 'cancelled') return false
      const [bh, bm] = (b.time || '0:0').split(':').map(Number)
      const bStart = bh * 60 + bm
      const bEnd = bStart + (b.durationHours || 1) * 60
      return newStart < bEnd && newEnd > bStart
    })
  }

  function wouldOverlapTaken(slotTime, durHours) {
    const [h, m] = slotTime.split(':').map(Number)
    const startMin = h * 60 + m
    const endMin = startMin + durHours * 60
    // Перевіряємо що всі годинні кроки всередині бронювання мають вільні слоти.
    // Якщо потрібний слот відсутній (кінець дня) — блокуємо.
    for (let i = 60; i < durHours * 60; i += 60) {
      const nextMin = startMin + i
      const nextKey = `slot${String(Math.floor(nextMin/60)).padStart(2,'0')}${String(nextMin%60).padStart(2,'0')}`
      if (!slots[nextKey]) return true
      if (slots[nextKey].available === false) return true
    }
    return Object.values(slots).some(s => {
      const [sh, sm] = (s.time || '').split(':').map(Number)
      const sMin = sh * 60 + sm
      if (sMin <= startMin || sMin >= endMin) return false
      const offsetMin = sMin - startMin
      // Слоти на рівній годинній межі — обов'язкові для багатогодинного запису,
      // блокують тільки якщо вони вже зайняті.
      if (offsetMin % 60 === 0) return s.available === false
      // Нестандартне зміщення (+30хв) — конфлікт лише якщо слот зайнятий (як в ID4).
      return s.available === false
    })
  }

  // Авто-скрол до секції часу після вибору дати
  useEffect(() => {
    if (!selectedDate || !timeSectionRef.current) return
    setTimeout(() => {
      timeSectionRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' })
    }, 100)
  }, [selectedDate])

  // Авто-скрол вікна в самий низ після вибору часу
  useEffect(() => {
    if (!selectedTime) return
    setTimeout(() => {
      const container = document.querySelector('.cab-content')
      if (container) container.scrollTop = container.scrollHeight
    }, 100)
  }, [selectedTime])

  // Реальний-тайм підписка на слоти (щоб резервування оновлювалось одразу)
  useEffect(() => {
    if (!selectedDate) { setSlots({}); return }
    setLoading(true)
    const unsub = subscribeSlotsForDate(formatDateYMD(selectedDate), data => {
      setSlots(data || {})
      setLoading(false)
    })
    return unsub
  }, [selectedDate])

  // Підписка на чергу для всіх зайнятих слотів
  useEffect(() => {
    if (!selectedDate) return
    const dateKey = formatDateYMD(selectedDate)
    const unsubs = []
    Object.values(slots).forEach(slot => {
      if (slot.available === false) {
        const unsub = subscribeQueueForSlot(dateKey, slot.time, entries => {
          const sorted = [...entries].sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0))
          const myIdx = sorted.findIndex(e => e.uid === user?.uid && (e.status === 'waiting' || e.status === 'offered'))
          const waitingCount = entries.filter(e => e.status === 'waiting').length
          setQueueMap(prev => ({
            ...prev,
            [slot.time]: { count: waitingCount, mine: myIdx >= 0, position: myIdx + 1 }
          }))
        })
        unsubs.push(unsub)
      }
    })
    return () => unsubs.forEach(u => u())
  }, [slots, selectedDate, user?.uid])

  // Сигналізуємо адміну що клієнт дивиться на цей слот
  useEffect(() => {
    if (!selectedDate || !selectedTime || !user?.uid) return
    const dateStr = formatDateYMD(selectedDate)
    setViewingSlot(dateStr, selectedTime, user.uid).catch(() => {})
    return () => { clearViewingSlot(dateStr, selectedTime, user.uid).catch(() => {}) }
  }, [selectedDate, selectedTime, user?.uid])

  useEffect(() => {
    setMonthAvail({})
    const unsub = subscribeMonthAvailability(
      viewMonth.getFullYear(),
      viewMonth.getMonth(),
      avail => setMonthAvail(avail)
    )
    return unsub
  }, [viewMonth])

  const days = useMemo(() => getMonthGrid(viewMonth.getFullYear(), viewMonth.getMonth()), [viewMonth])

  const handleSlotClick = (slot) => {
    if (slot.lunchBlocked || slot.overlapBlocked || (slot.cutoffBlocked && slot.available !== false)) return
    if (slot.offeredTo?.[user?.uid]) {
      // Слот зарезервований для мене → одразу до бронювання
      setSelectedTime(slot.time)
      setSelectedTime2(null)
      return
    }
    if (slot.available === false) {
      // Зайнятий або зарезервований для іншого
      // якщо слот запропонований комусь — і не мені — дозволяємо стати в чергу
      const q = queueMap[slot.time]
      if (q?.mine) return
      setDialogSlot({ ...slot, queueCount: q?.count || 0 })
      return
    }
    // Повторний тап на вже обраний слот — знімає його з вибору.
    if (slot.time === selectedTime) {
      if (selectedTime2) { setSelectedTime(selectedTime2); setSelectedTime2(null) }
      else setSelectedTime(null)
      return
    }
    if (slot.time === selectedTime2) {
      setSelectedTime2(null)
      return
    }
    // Тап на сусідній вільний годинний слот, коли вже обрано один — об'єднуємо в один
    // запис на 2 години замість заміни вибору (лише для годинної послуги).
    if (slot.slotDurHours === 1 && selectedTime && !selectedTime2 && !slot.vipOnly
        && Math.abs(timeToMin(slot.time) - timeToMin(selectedTime)) === 60) {
      const first = slots[`slot${selectedTime.replace(':', '')}`]
      if (first && first.available !== false && !first.vipOnly && !first.offeredTo?.[user?.uid] && slotDurOf(first) === 1) {
        setSelectedTime2(slot.time)
        return
      }
    }
    setSelectedTime(slot.time)
    setSelectedTime2(null)
  }

  const handleBook = async () => {
    if (!selectedDate || !selectedTime || !selectedService) return
    const startTime = selectedTime2 && timeToMin(selectedTime2) < timeToMin(selectedTime) ? selectedTime2 : selectedTime
    const slotDt = new Date(selectedDate)
    const [slotH, slotM] = startTime.split(':').map(Number)
    slotDt.setHours(slotH, slotM, 0, 0)
    if (slotDt <= new Date()) {
      showToast('Не можна записатись на минулий час')
      return
    }
    const dateStr = formatDateYMD(selectedDate)
    if (overlapsMyBooking(dateStr, startTime, durationHours)) {
      showToast('Ви вже записані на цей час')
      return
    }
    setSubmitting(true)
    try {
      const dateStr = formatDateYMD(selectedDate)
      const [bh, bm] = startTime.split(':').map(Number)
      const bookStartMin = bh * 60 + bm
      let surcharge = 0
      for (let i = 0; i < Math.ceil(durationHours); i++) {
        const slotMin = bookStartMin + i * 60
        const key = `slot${String(Math.floor(slotMin/60)).padStart(2,'0')}${String(slotMin%60).padStart(2,'0')}`
        surcharge += slots[key]?.surcharge || 0
        // Фінальна перевірка: заборонити якщо будь-який покритий слот є VIP (для звичайних клієнтів)
        if (i > 0 && !isVipStudent && slots[key]?.vipOnly) {
          showToast('Неможливо записатись: наступна година є VIP-слотом')
          setSubmitting(false)
          return
        }
      }
      // Фіксована ціна слота (адмін) повністю замінює тарифну (не для злитих двох слотів)
      const fixedPrice = !selectedTime2 ? (slots[`slot${startTime.replace(':', '')}`]?.fixedPrice ?? null) : null
      const totalPrice = fixedPrice != null
        ? fixedPrice
        : lessonPrice(durationHours, surcharge)
      const currentSlot = slots[`slot${startTime.replace(':', '')}`]
      const isOfferedToMe = !!currentSlot?.offeredTo?.[user?.uid]
      // Атомарно займаємо весь діапазон (перша година вже зарезервована
      // саме для мене через чергу — атомарно займаємо лише решту, якщо
      // бронювання довше 1 год)
      if (!isOfferedToMe) {
        const claimed = await claimSlot(dateStr, startTime, durationHours, adminSettings.interval || 30)
        if (!claimed) {
          showToast('Цей слот щойно зайняли. Оберіть інший час.')
          setSubmitting(false)
          return
        }
      } else if (durationHours > 1) {
        const nextMin = bookStartMin + 60
        const nextTime = `${String(Math.floor(nextMin / 60)).padStart(2, '0')}:${String(nextMin % 60).padStart(2, '0')}`
        const claimed = await claimSlot(dateStr, nextTime, durationHours - 1, adminSettings.interval || 30)
        if (!claimed) {
          showToast('Наступна година щойно зайнята. Оберіть коротшу тривалість або інший час.')
          setSubmitting(false)
          return
        }
      }
      await createBooking(user.uid, {
        date: dateStr,
        time: startTime,
        serviceType: selectedService.type,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        price: totalPrice || undefined,
        surcharge: fixedPrice != null ? undefined : (surcharge || undefined),
        discountAmt: (fixedPrice != null || customPriceAmt != null) ? undefined : (discountAmt || undefined),
        durationHours,
        studentName: profile.name,
        phone: profile.phone || user.phoneNumber,
        studentNote: studentNote.trim() || undefined,
      })
      setStudentNote("")
      if (isOfferedToMe) {
        await claimReservedSlot(dateStr, startTime, user.uid)
      }
      setSelectedTime(null)
      setSelectedTime2(null)
      setSuccessData({ type: 'booking', date: formatDateYMD(selectedDate), time: startTime, service: selectedService, surcharge, durationHours, price: totalPrice, pending: !!adminSettings.pendingEnabled })
    } catch (e) {
      showToast('Помилка: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleJoinQueue = async () => {
    if (!dialogSlot || !selectedDate || !selectedService) return
    const slotDt = new Date(selectedDate)
    const [slotH, slotM] = (dialogSlot.time || '0:0').split(':').map(Number)
    slotDt.setHours(slotH, slotM, 0, 0)
    if (slotDt <= new Date()) {
      setDialogSlot(null)
      showToast('Не можна стати в чергу на минулий час')
      return
    }
    const dateStr = formatDateYMD(selectedDate)
    const queueDur = dialogSlot.slotDurHours || baseDurationHours
    if (overlapsMyBooking(dateStr, dialogSlot.time, queueDur)) {
      setDialogSlot(null)
      showToast('Ви вже записані на цей час')
      return
    }
    setSubmitting(true)
    try {
      await joinQueue(user.uid, dateStr, dialogSlot.time, selectedService.type, queueDur, profile?.name || '', profile?.phone || user?.phoneNumber || '')
      setDialogSlot(null)
      setSuccessData({ type: 'queue', date: formatDateYMD(selectedDate), time: dialogSlot.time, service: selectedService, durationHours: queueDur, surcharge: dialogSlot.surcharge || 0 })
    } catch (e) {
      showToast('Помилка: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Напрям останньої зміни місяця — для пружинної анімації гортання календаря.
  const [calSlideDir, setCalSlideDir] = useState(0) // 1 = вперед (в наступний), -1 = назад
  const prevMonth = () => { setCalSlideDir(-1); setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1)) }
  const nextMonth = () => { setCalSlideDir(1); setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1)) }

  // Свайп вліво/вправо по календарю — зміна місяця. Зупиняємо спливання (stopPropagation),
  // інакше цей же свайп ловить обробник перемикання вкладок у Cabinet.jsx (на батьківському
  // .cab-content) і замість зміни місяця перемикає всю сторінку на іншу вкладку.
  const calTouchRef = useRef(null)
  const handleCalTouchStart = (e) => {
    const t = e.touches[0]
    calTouchRef.current = { x: t.clientX, y: t.clientY }
  }
  const handleCalTouchEnd = (e) => {
    const start = calTouchRef.current
    calTouchRef.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    e.stopPropagation()
    if (dx < 0) nextMonth()
    else prevMonth()
  }

  const slotsList = useMemo(() => {
    const isVip = profile?.isVip === true
    const dateStr = selectedDate ? formatDateYMD(selectedDate) : ''

    // День без робочого графіка (закритий явно або вимкнений у тижневому шаблоні, напр. неділя):
    // слоти, які адмін ВІДКРИВ ВРУЧНУ, клієнт бачить — джерело істини сам timeslots/{date}.
    // Для такого дня не застосовуємо обід із шаблону (його немає). closedDay — явний override
    // "closed": там показуємо лише вільні слоти (мітки зайнятості зі старих записів не потрібні).
    let offDay = false
    let closedDay = false
    if (selectedDate) {
      const ov = (adminSettings.dateOverrides || []).find(o => o.date === dateStr)
      if (ov?.type === 'closed') { offDay = true; closedDay = true }
      if (!ov) {
        const dow = (selectedDate.getDay() + 6) % 7  // Mon=0..Sun=6
        const ws = (adminSettings.weekSchedule || [])[dow]
        if (ws && ws.enabled === false) {
          if (Object.keys(slots).length === 0) return []
          offDay = true
        }
      }
    }


    // "Липкий час" — як в ID4: ВИМКНЕНО за замовчуванням (раніше тут було "!== false", тобто
    // увімкнено, навіть якщо адмін його ніколи не вмикав — і в клієнта лишались лише слоти
    // впритул до запису самого клієнта). Коли адмін вмикає — показуємо вільні слоти лише впритул
    // до вже зайнятих (по ВСІХ записах дня з slots, а не лише власних клієнта).
    const stickyEnabled = !!adminSettings.stickyTimeEnabled
    const stickyMode = adminSettings.stickyTime || 'both'
    const takenIntervals = Object.values(slots)
      .filter(s => s.available === false && s.time)
      .map(s => { const start = timeToMin(s.time); return { start, end: start + (s.durMin || 60) } })
    const dayStartTimes = Object.values(slots).map(s => timeToMin(s.time))
    const dayStartMin = dayStartTimes.length ? Math.min(...dayStartTimes) : null
    const { lunchEnabled: dayLunchEnabled, lunchStart: dayLunchStart, lunchEnd: dayLunchEnd } = getLunchForDate(selectedDate)
    const lunchEndMin = dayLunchEnabled ? dayLunchEnd * 60 : null
    const lunchStartMin = dayLunchEnabled ? dayLunchStart * 60 : null

    return Object.values(slots)
      .filter(slot => !!(slot.time))
      .filter(slot => !closedDay || (slot.available !== false && !slot.adminBlocked))
      .filter(slot => !slot.vipOnly || isVipStudent)
      .filter(slot => !slot.privateOnly || isPrivateStudent)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
      .map(slot => {
        let vipBlocked = false
        if (slot.vipOnly && !isVip) {
          if (selectedDate) {
            const [h, m] = (slot.time || '0:0').split(':').map(Number)
            const slotDt = new Date(selectedDate)
            slotDt.setHours(h, m, 0, 0)
            vipBlocked = Date.now() + 48 * 60 * 60 * 1000 < slotDt.getTime()
          } else {
            vipBlocked = true
          }
        }
        const [th, tm] = (slot.time || '0:0').split(':').map(Number)
        const slotStartMin = th * 60 + tm
        // Тривалість цього слота (адмін міг розтягнути його) — вона ж і тривалість запису
        const slotDurHours = slotDurOf(slot)
        const isCustomDur = !!slot.durMin && slot.durMin !== 60
        let totalSurcharge = 0
        for (let i = 0; i < Math.ceil(slotDurHours); i++) {
          const coveredMin = slotStartMin + i * 60
          const coveredKey = `slot${String(Math.floor(coveredMin/60)).padStart(2,'0')}${String(coveredMin%60).padStart(2,'0')}`
          totalSurcharge += slots[coveredKey]?.surcharge || 0
        }
        const [th2, tm2] = (slot.time || '0:0').split(':').map(Number)
        const slotMin = th2 * 60 + tm2
        const isExactlyMine = bookingsData.upcoming.some(b => {
          if (b.date !== dateStr || b.status === 'cancelled') return false
          const [bh, bm] = (b.time || '0:0').split(':').map(Number)
          return slotMin === bh * 60 + bm
        })
        const isPartOfMyBooking = bookingsData.upcoming.some(b => {
          if (b.date !== dateStr || b.status === 'cancelled') return false
          const [bh, bm] = (b.time || '0:0').split(':').map(Number)
          const bStart = bh * 60 + bm
          const bEnd = bStart + (b.durationHours || 1) * 60
          return slotMin >= bStart && slotMin < bEnd
        })
        const slotDurMin = slotDurHours * 60
        const isSticky = !stickyEnabled || takenIntervals.length === 0 || slot.available === false || slotStartMin === dayStartMin
          || (stickyMode !== 'before' && slotStartMin === lunchEndMin)
          || (stickyMode !== 'after'  && slotStartMin + slotDurMin === lunchStartMin)
          ? true
          : takenIntervals.some(iv =>
              (stickyMode !== 'after'  && slotStartMin + slotDurMin === iv.start) ||
              (stickyMode !== 'before' && slotStartMin === iv.end)
            )
        return {
          ...slot,
          slotDurHours,
          isSticky,
          // lunchOverride — адмін вручну відкрив цей слот під час обіду: не ховаємо
          lunchBlocked:   !slot.lunchOverride && !offDay && isBlockedByLunch(slot.time, slotDurHours),
          // Розтягнутий слот — цілісний блок: проміжні документи годин поглинуті навмисно
          overlapBlocked: slot.available !== false && (isCustomDur ? false : wouldOverlapTaken(slot.time, slotDurHours)),
          // Обмеження "не пізніше ніж за N годин до запису" (налаштування адміна bookCutoffHours)
          cutoffBlocked:  (() => {
            const hrs = adminSettings.bookCutoffHours || 0
            if (!hrs || !selectedDate) return false
            const slotDt = new Date(selectedDate)
            slotDt.setHours(th, tm, 0, 0)
            return Date.now() + hrs * 60 * 60 * 1000 > slotDt.getTime()
          })(),
          isMyBooked:     overlapsMyBooking(dateStr, slot.time, slotDurHours),
          isExactlyMine,
          isPartOfMyBooking,
          vipBlocked,
          totalSurcharge,
          // Фіксована ціна слота повністю замінює тарифну
          totalPrice: slot.fixedPrice != null
            ? slot.fixedPrice
            : lessonPrice(slotDurHours, totalSurcharge), // та сама формула, що в діалозі й на кнопці: тариф/індивідуальна ціна, надбавка, знижка клієнта
        }
      })
      .filter(slot => !slot.lunchBlocked && !slot.overlapBlocked && !(slot.cutoffBlocked && slot.available !== false))
      .filter(slot => slot.isSticky || slot.isMyBooked)
      .filter(slot => {
        // Для заблокованих слотів: показуємо тільки кожен годинний блок від старту бронювання.
        // Наприклад, бронювання 17:30 (2г) → показуємо 17:30 і 18:30, ховаємо 18:00 і 19:00.
        if (slot.available !== false) return true
        const [h, m] = (slot.time || '0:0').split(':').map(Number)
        let curMin = h * 60 + m
        while (curMin >= 30) {
          const prevMin = curMin - 30
          const prevKey = `slot${String(Math.floor(prevMin / 60)).padStart(2, '0')}${String(prevMin % 60).padStart(2, '0')}`
          if (!slots[prevKey] || slots[prevKey].available !== false) break
          curMin = prevMin
        }
        return (h * 60 + m - curMin) % 60 === 0
      })
      .filter(slot => {
        if (!selectedDate || !isSameDay(selectedDate, new Date())) return true
        const [h, m] = (slot.time || '0:0').split(':').map(Number)
        const slotDt = new Date(selectedDate)
        slotDt.setHours(h, m, 0, 0)
        return slotDt > new Date()
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, baseDurationHours, adminSettings, profile?.isVip, profile?.discount, profile?.customPrice, selectedDate, selectedService, bookingsData.upcoming])

  const nextLesson = useMemo(() => {
    const now = Date.now()
    return (bookingsData?.upcoming || [])
      .filter(b => b.status !== 'cancelled' && b.date && b.time)
      .map(b => {
        const d = parseYMD(b.date)
        const [h, m] = b.time.split(':').map(Number)
        d.setHours(h, m, 0, 0)
        return { ...b, _ts: d.getTime() }
      })
      .filter(b => b._ts > now)
      .sort((a, b) => a._ts - b._ts)[0] || null
  }, [bookingsData?.upcoming])

  const nextLessonLabel = useMemo(() => {
    if (!nextLesson) return null
    const ms = nextLesson._ts - Date.now()
    const hours = ms / 3600000
    if (hours < 1) return `через ${Math.ceil(ms / 60000)} хв`
    // «сьогодні/завтра» — за календарним днем, а не за кількістю годин до запису
    const dayStart = t => { const x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime() }
    const dayDiff = Math.round((dayStart(nextLesson._ts) - dayStart(Date.now())) / 86400000)
    if (dayDiff === 0) return `сьогодні о ${nextLesson.time}`
    if (dayDiff === 1) return `завтра о ${nextLesson.time}`
    const d = new Date(nextLesson._ts)
    const DAY = ['нд','пн','вт','ср','чт','пт','сб']
    const MON = ['','Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру']
    return `${d.getDate()} ${MON[d.getMonth()+1]}, ${DAY[d.getDay()]} о ${nextLesson.time}`
  }, [nextLesson])

  const QueueIcons = ({ n }) => {
    const max = Math.min(n, 3)
    return (
      <div className="slot-queue">
        {Array.from({length: max}).map((_, i) => (
          <svg key={i} viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="7" r="4"/>
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>
          </svg>
        ))}
        {n > 3 && <span className="slot-queue-num">+{n - 3}</span>}
      </div>
    )
  }

  return (
    <div className="fade-up">
      {ToastEl}

      {/* USER BANNER */}
      <div className="user-banner">
        <div className="banner-avatar">{getInitials(profile?.name)}</div>
        <div className="banner-info">
          <div className="banner-greet">Привіт,</div>
          <div className="banner-name">{profile?.name?.split(' ')[0] || 'Клієнт'}</div>
          <div className="banner-tag">
            {selectedService?.type === 'school' ? '🎓 Стандарт' : '🚙 Індивідуальний'}
          </div>
        </div>
      </div>

      {/* NEXT LESSON BANNER */}
      {nextLesson && nextLessonLabel && (
        <div style={{
          background:'linear-gradient(135deg,rgba(91,155,255,0.13),rgba(37,99,235,0.08))',
          border:'1px solid rgba(91,155,255,0.25)',
          borderRadius:12, padding:'10px 14px',
          display:'flex', alignItems:'center', gap:10, marginTop:8, marginBottom:8,
        }}>
          <span style={{fontSize:22}}>📅</span>
          <div style={{flex:1, minWidth:0}}>
            <div className="nl-title" style={{fontWeight:700, fontSize:13}}>Найближчий запис</div>
            <div style={{color:'var(--text)', fontSize:12, marginTop:2}}>{nextLessonLabel}</div>
          </div>
          {nextLesson.status === 'pending' && (
            <div className="nl-pending" style={{fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:6, flexShrink:0}}>очікує</div>
          )}
        </div>
      )}

      {/* LESSON BALANCE BANNER */}
      {(profile?.lessonBalance > 0) && (
        <div style={{
          background:'linear-gradient(135deg, #16a34a22, #4ade8022)',
          border:'1px solid #4ade8044',
          borderRadius:12,
          padding:'10px 14px',
          display:'flex',
          alignItems:'center',
          gap:10,
          marginTop: nextLesson && nextLessonLabel ? 0 : 8,
          marginBottom:8,
        }}>
          <span style={{fontSize:22}}>🎫</span>
          <div>
            <div style={{color:'#4ade80', fontWeight:600, fontSize:14}}>
              Передоплачено {profile.lessonBalance} {profile.lessonBalance === 1 ? 'запис' : profile.lessonBalance < 5 ? 'записи' : 'записів'}
            </div>
            <div style={{color:'var(--dim)', fontSize:12}}>Бронюйте — записи вже оплачені</div>
          </div>
        </div>
      )}

      {/* 1. ДАТА */}
      <div className="section-title" style={{color:'var(--text)', fontSize:13, textAlign:'center'}}>1. Дата</div>
      <div className="cal-card" onTouchStart={handleCalTouchStart} onTouchEnd={handleCalTouchEnd}>
        <div className="cal-head">
          <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
          <div className="cal-month">
            {getMonthName(viewMonth.getMonth())}
            <span style={{color:'var(--faint)', fontWeight:600, marginLeft:5}}>{viewMonth.getFullYear()}</span>
          </div>
          <button className="cal-nav-btn" onClick={nextMonth}>›</button>
        </div>
        <div className="cal-weekdays">
          {['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].map(d => <div key={d} className="cal-wd">{d}</div>)}
        </div>
        <div
          key={`${viewMonth.getFullYear()}-${viewMonth.getMonth()}`}
          className={`cal-days ${calSlideDir === 1 ? 'cal-days-spring-next' : calSlideDir === -1 ? 'cal-days-spring-prev' : ''}`}
        >
          {days.map((d, i) => {
            if (!d) return <div key={i} className="cal-day empty"></div>
            // Приватні й автошкільні клієнти мають окремі горизонти видимості календаря
            // (Налаштування → Обмеження). Клієнт зі «Стандартом» — за schoolCalendarOpenDays.
            const maxDays = canPrivate
              ? (adminSettings.calendarOpenDays ?? 30)
              : (adminSettings.schoolCalendarOpenDays ?? 14)
            const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + maxDays)
            const disabled = isPast(d) || d > maxDate
            const isToday = isSameDay(d, today)
            const selected = selectedDate && isSameDay(d, selectedDate)
            const dateStr = formatDateYMD(d)
            const avail = monthAvail[dateStr]      // undefined=loading, null=empty, 'free'/'partial'/'full'
            const dayClass = disabled ? '' :
              avail === undefined ? 'has-slots' :  // loading - show neutral
              avail ? `day-${avail}` : ''          // loaded: colored or plain
            return (
              <button
                key={i}
                className={`cal-day ${disabled ? 'disabled' : ''} ${isToday ? 'today' : ''} ${selected ? 'selected' : ''} ${dayClass}`}
                onClick={() => { if (!disabled) { setLoading(true); setSelectedDate(d) } }}
                disabled={disabled}
              >
                {d.getDate()}
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. ЧАС */}
      {selectedDate && (
        <>
          <div ref={timeSectionRef} className="section-title" style={{color:'var(--text)', fontSize:13, textAlign:'center'}}>
            3. Час ({selectedDate.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' })})
          </div>
          {loading ? (
            <div style={{textAlign:'center', padding:'24px'}}><div className="spinner" style={{margin:'0 auto'}}></div></div>
          ) : slotsList.length === 0 ? (
            <div style={{textAlign:'center', padding:'24px', color:'var(--dim)', fontSize:'13px'}}>
              На цю дату немає слотів
            </div>
          ) : (
            <>
              <div className="slots-grid">
                {slotsList.map(slot => {
                  const q = queueMap[slot.time]
                  const isAvailable = slot.available !== false
                  const isMyQueue = q?.mine
                  const isSelected = selectedTime === slot.time || selectedTime2 === slot.time
                  const isLunch = slot.lunchBlocked
                  const isOverlap = slot.overlapBlocked
                  const isMyReserved = !!(slot.offeredTo?.[user?.uid])
                  const isVipLocked = slot.vipBlocked
                  const isMyBooked = slot.isMyBooked
                  const isExactlyMine = slot.isExactlyMine
                  const isPartOfMyBooking = slot.isPartOfMyBooking
                  const isTaken = !isAvailable && !isMyReserved
                  const isTakenByOthers = isTaken && !isPartOfMyBooking
                  const isUnavailable = isLunch || isOverlap || isVipLocked || isTaken || isMyBooked
                  return (
                    <div key={slot.time} style={{position:'relative'}}>
                      <button
                        className={`slot ${isMyReserved || isMyQueue ? 'my-queue' : isPartOfMyBooking ? 'my-booked' : isUnavailable ? 'taken' : ''} ${isSelected ? 'selected' : ''}`}
                        style={{width:'100%'}}
                        onClick={() => !isMyQueue && !isMyBooked && handleSlotClick(slot)}
                        disabled={isLunch || isOverlap || isMyBooked}
                        title={isExactlyMine ? 'Ваш запис' : isPartOfMyBooking ? 'Ваш запис (продовження)' : isMyBooked ? 'Перетин з вашим записом' : isLunch ? 'Обідня перерва' : isOverlap ? 'Перетин з іншим записом' : isVipLocked ? 'VIP слот' : isMyReserved ? 'Зарезервовано для вас!' : isTaken ? 'Зайнято — стати в чергу?' : undefined}
                      >
                        <div className="slot-time">{slot.time}</div>
                        {isExactlyMine ? (
                          <div className="slot-mine" style={{fontSize:8, fontWeight:700}}>ваш</div>
                        ) : isPartOfMyBooking ? null
                        : isMyReserved ? (
                          <div style={{fontSize:8, color:'white', fontWeight:700}}>ваш!</div>
                        ) : isLunch ? (
                          <div style={{fontSize:8, opacity:0.5}}>обід</div>
                        ) : isVipLocked ? (
                          <div style={{fontSize:8, opacity:0.5}}>👑</div>
                        ) : isTakenByOthers || isOverlap ? (
                          <div style={{fontSize:8, opacity:0.7}}>зайнято</div>
                        ) : slot.totalSurcharge ? (
                          <div className="slot-sur" style={{fontSize:8, fontWeight:700}}>{slot.totalPrice}₴</div>
                        ) : isMyQueue ? (
                          <div className="slot-queue">
                            <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="7" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
                            <span className="slot-queue-num">ти {q.position}-й</span>
                          </div>
                        ) : q?.count > 0 ? (
                          <QueueIcons n={q.count} />
                        ) : (
                          // Тривалість і ціна прямо на плитці — як в ID4
                          <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:1}}>
                            <div className="slot-dur" style={{fontSize:10, fontWeight:700}}>{formatDurShort((slot.slotDurHours || baseDurationHours) * 60)}</div>
                            {slot.totalPrice > 0 && (
                              <div className="slot-price" style={{fontSize:10, fontWeight:700}}>{slot.totalPrice}₴</div>
                            )}
                          </div>
                        )}
                      </button>
                      {isMyQueue && (
                        <button
                          onClick={() => leaveQueue(user.uid, formatDateYMD(selectedDate), slot.time)}
                          style={{
                            position:'absolute', top:-6, right:-6,
                            width:16, height:16, borderRadius:'50%',
                            background:'rgba(239,68,68,0.9)', border:'none', cursor:'pointer',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:9, color:'white', fontWeight:900, lineHeight:1,
                            boxShadow:'0 2px 6px rgba(239,68,68,0.6)', zIndex:5,
                          }}
                          title="Вийти з черги"
                        >✕</button>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="slot-legend">
                <div className="leg-item"><div className="leg-dot free"></div> Вільно</div>
                <div className="leg-item"><div className="leg-dot taken"></div> Зайнято</div>
                <div className="leg-item">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#f7c948"><circle cx="12" cy="7" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
                  в черзі
                </div>
              </div>
              <div style={{
                marginTop:8, padding:'8px 12px', borderRadius:10,
                background:'rgba(247,201,72,0.06)', border:'1px solid rgba(247,201,72,0.18)',
                fontSize:11, color:'var(--dim)', textAlign:'center', lineHeight:1.4,
              }}>
                ⏳ Якщо ваш бажаний час зайнятий — ви можете стати на нього в чергу. Як тільки він звільниться, ви зможете записатися.
              </div>
              {baseDurationHours === 1 && (
                <div style={{
                  marginTop:8, padding:'8px 12px', borderRadius:10,
                  background:'rgba(74,222,128,0.06)', border:'1px solid rgba(74,222,128,0.2)',
                  fontSize:11, color:'var(--dim)', textAlign:'center', lineHeight:1.4,
                }}>
                  🕐 Щоб записатись на 2 години поспіль — оберіть два сусідні вільні слоти.
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* CTA */}
      {selectedTime && selectedService && (() => {
        const ctaStart = selectedTime2 && timeToMin(selectedTime2) < timeToMin(selectedTime) ? selectedTime2 : selectedTime
        const [sh, sm] = ctaStart.split(':').map(Number)
        const startMin = sh * 60 + sm
        let surcharge = 0
        for (let i = 0; i < Math.ceil(durationHours); i++) {
          const slotMin = startMin + i * 60
          const key = `slot${String(Math.floor(slotMin/60)).padStart(2,'0')}${String(slotMin%60).padStart(2,'0')}`
          surcharge += slots[key]?.surcharge || 0
        }
        const ctaFixed = !selectedTime2 ? (slots[`slot${ctaStart.replace(':', '')}`]?.fixedPrice ?? null) : null
        const baseP = lessonBase(durationHours)
        const totalPrice = ctaFixed != null ? ctaFixed : lessonPrice(durationHours, surcharge)
        const dateLabel = formatDateYMD(selectedDate).slice(-5).split('-').reverse().join('.')
        return (
          <div ref={ctaSectionRef}>
            {ctaFixed != null ? (
              <div style={{
                marginTop:12, padding:'10px 14px', borderRadius:12,
                background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.35)',
                fontSize:13, color:'#4ade80', fontWeight:700, textAlign:'center',
              }}>
                Фіксована ціна: <strong>{ctaFixed}₴</strong>
              </div>
            ) : surcharge > 0 ? (
              <div style={{
                marginTop:12, padding:'12px 14px', borderRadius:12,
                background:'rgba(247,201,72,0.08)', border:'1px solid rgba(247,201,72,0.35)',
                display:'flex', flexDirection:'column', gap:4,
              }}>
                <div style={{fontSize:13, color:'#f7c948', fontWeight:700}}>
                  ⚠️ Ціна за цей час: <strong>{totalPrice}₴</strong>
                </div>
                <div style={{fontSize:11, color:'rgba(247,201,72,0.7)'}}>
                  {customPriceAmt != null ? 'Індивідуальна' : 'Стандартна'} {baseP}₴ + надбавка +{surcharge}₴{customPriceAmt == null && discountAmt > 0 ? ` − знижка ${discountAmt * durationHours}₴` : ''}
                </div>
              </div>
            ) : totalPrice > 0 ? (
              <div style={{
                marginTop:12, padding:'8px 14px', borderRadius:12,
                background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                fontSize:12, color:'var(--dim)', textAlign:'center',
              }}>
                Вартість запису: <strong style={{color:'var(--text)'}}>{totalPrice}₴</strong>
                {customPriceAmt == null && discountAmt > 0 && <span style={{marginLeft:6, color:'#4ade80', fontSize:11}}>−{discountAmt * durationHours}₴</span>}
              </div>
            ) : null}
            <textarea
              value={studentNote}
              onChange={e => setStudentNote(e.target.value)}
              placeholder="Коментар для майстра (необов'язково)…"
              maxLength={120}
              rows={2}
              style={{
                width:'100%', marginTop:10, padding:'10px 12px',
                borderRadius:12, border:'1px solid rgba(255,255,255,0.1)',
                background:'rgba(255,255,255,0.04)', color:'var(--text)',
                fontSize:13, fontFamily:'inherit', resize:'none',
                boxSizing:'border-box', outline:'none',
              }}
            />
            <button className="btn-primary" style={{marginTop:8}} onClick={handleBook} disabled={submitting}>
              {submitting ? 'Записуємо...' : `✓ Записатись ${dateLabel} о ${ctaStart}${durationHours > baseDurationHours ? ` на ${durationHours} год` : ''}${totalPrice ? ` · ${totalPrice}₴` : ''}`}
            </button>
          </div>
        )
      })()}

      {/* DIALOG: успішний запис / черга */}
      {successData && (
        <div className="dialog-backdrop show" onClick={e => e.target.classList.contains('dialog-backdrop') && setSuccessData(null)}>
          <div className="dialog">
            <div className="dialog-handle"></div>
            <div className="dialog-icon" style={{
              background: successData.type === 'booking'
                ? 'linear-gradient(165deg, #4ade80, #16a34a)'
                : 'linear-gradient(165deg, #fcd34d, #d97706)'
            }}>
              {successData.type === 'booking' ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                  <circle cx="12" cy="7" r="4"/>
                  <path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>
                </svg>
              )}
            </div>
            <div className="dialog-title">
              {successData.type === 'booking'
                ? (successData.pending ? 'Запит надіслано!' : 'Запис заброньовано!')
                : 'Ти в черзі!'}
            </div>
            {successData.type === 'booking' && successData.pending && (
              <div className="dialog-sub">Очікуйте підтвердження від майстра.</div>
            )}
            {successData.type === 'queue' && (
              <div className="dialog-sub">Як тільки слот звільниться — отримаєте сповіщення.</div>
            )}
            <div className="dialog-info-card">
              <div className="dialog-info-row">
                <span className="lbl">Дата</span>
                <span className="val">
                  {new Date(successData.date + 'T12:00:00').toLocaleDateString('uk-UA', { weekday:'short', day:'numeric', month:'long' })}
                </span>
              </div>
              <div className="dialog-info-row">
                <span className="lbl">Час</span>
                <span className="val">{successData.time}</span>
              </div>
              <div className="dialog-info-row">
                <span className="lbl">Послуга</span>
                <span className="val">{successData.service?.name || successData.service}</span>
              </div>
              <div className="dialog-info-row" style={{borderTop:'1px solid var(--border)', paddingTop:10, marginTop:4}}>
                <span className="lbl">Тривалість</span>
                <span className="val">{successData.durationHours} {successData.durationHours === 1 ? 'година' : 'години'}</span>
              </div>
              {successData.service?.price > 0 && (
                <div className="dialog-info-row">
                  <span className="lbl">Ціна</span>
                  <span className="val" style={{color:'var(--gold)'}}>
                    {successData.price != null ? successData.price : lessonPrice(successData.durationHours, successData.surcharge || 0)} ₴
                    {successData.surcharge > 0 && <span style={{fontSize:10, color:'var(--gold)', opacity:0.7}}> (+{successData.surcharge}₴)</span>}
                    {customPriceAmt == null && discountAmt > 0 && <span style={{fontSize:10, color:'#4ade80', marginLeft:4}}>−{discountAmt * successData.durationHours}₴</span>}
                  </span>
                </div>
              )}
            </div>
            {successData.type === 'booking' && (
              <div style={{display:'flex', gap:8, padding:'0 4px 4px'}}>
                <a
                  href={googleCalendarLink({ date:successData.date, time:successData.time, durationHours:successData.durationHours, serviceName:successData.service?.name || successData.service })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dialog-btn"
                  style={{flex:1, textDecoration:'none', textAlign:'center', fontSize:13}}
                >📅 Google</a>
                <button
                  className="dialog-btn"
                  style={{flex:1, fontSize:13}}
                  onClick={() => downloadICS({ date:successData.date, time:successData.time, durationHours:successData.durationHours, serviceName:successData.service?.name || successData.service })}
                >🍎 Apple</button>
              </div>
            )}
            {successData.type === 'booking' && (
              <div style={{fontSize:11, color:'var(--dim)', textAlign:'center', padding:'0 8px 8px', lineHeight:1.4}}>
                Google відкриє подію з уже заповненими полями — натисніть там «Зберегти». «Apple» завантажить файл, який відкривається в будь-якому календарі.
              </div>
            )}
            <div className="dialog-actions">
              <button className="dialog-btn primary" onClick={() => setSuccessData(null)}>Закрити</button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG: стати в чергу */}
      {dialogSlot && (
        <div className="dialog-backdrop show" onClick={(e) => e.target.classList.contains('dialog-backdrop') && setDialogSlot(null)}>
          <div className="dialog">
            <div className="dialog-handle"></div>
            <div className="dialog-icon">{dialogSlot.vipOnly ? '👑' : '⏰'}</div>
            <div className="dialog-title">{dialogSlot.vipOnly ? 'VIP черга' : 'Стати в чергу?'}</div>
            <div className="dialog-sub">
              {dialogSlot.vipOnly
                ? 'Коли адмін відкриє цей VIP слот — ти отримаєш сповіщення'
                : 'Якщо клієнт скасує — отримаєте сповіщення, запис стане вашим'}
            </div>
            <div className="dialog-info-card">
              <div className="dialog-info-row">
                <span className="lbl">Дата</span>
                <span className="val">{selectedDate?.toLocaleDateString('uk-UA', { weekday:'short', day:'numeric', month:'long' })}</span>
              </div>
              <div className="dialog-info-row">
                <span className="lbl">Час</span>
                <span className="val">{dialogSlot.time}</span>
              </div>
              {dialogSlot.surcharge > 0 && (
                <>
                  <div className="dialog-info-row">
                    <span className="lbl">Базова ціна</span>
                    <span className="val">{lessonBase(dialogSlot.slotDurHours || baseDurationHours)}₴</span>
                  </div>
                  <div className="dialog-info-row">
                    <span className="lbl" style={{color:'var(--gold)'}}>⚡ Надбавка</span>
                    <span className="val" style={{color:'var(--gold)'}}>+{dialogSlot.surcharge}₴</span>
                  </div>
                  {customPriceAmt == null && discountAmt > 0 && (
                    <div className="dialog-info-row">
                      <span className="lbl" style={{color:'#4ade80'}}>Знижка</span>
                      <span className="val" style={{color:'#4ade80'}}>−{discountAmt * (dialogSlot.slotDurHours || baseDurationHours)}₴</span>
                    </div>
                  )}
                  <div className="dialog-info-row" style={{borderTop:'1px solid rgba(255,255,255,0.07)', marginTop:4, paddingTop:4}}>
                    <span className="lbl" style={{fontWeight:700}}>Разом</span>
                    <span className="val" style={{fontWeight:800}}>{lessonPrice(dialogSlot.slotDurHours || baseDurationHours, dialogSlot.surcharge)}₴</span>
                  </div>
                </>
              )}
              <div className="dialog-info-row">
                <span className="lbl">У черзі вже</span>
                <span className="val">
                  {dialogSlot.queueCount} {pluralize(dialogSlot.queueCount, ['клієнт','клієнти','клієнтів'])}
                </span>
              </div>
              <div className="dialog-info-row">
                <span className="lbl">Твоя позиція</span>
                <span className="val" style={{color:'var(--gold)'}}>{dialogSlot.queueCount + 1}-й</span>
              </div>
            </div>
            <div className="dialog-actions">
              <button className="dialog-btn secondary" onClick={() => setDialogSlot(null)}>Скасувати</button>
              <button className="dialog-btn primary" onClick={handleJoinQueue} disabled={submitting}>
                {submitting ? '...' : '✓ В чергу'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
