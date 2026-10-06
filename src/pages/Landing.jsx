import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import { getAdminSettings, getApprovedReviews, getAdminServices, getUpcomingFreeSlots } from '../firebase/db'
import { parseYMD, getDayName, getMonthShort, formatDateYMD } from '../utils/date'
import './Landing.css'

// Та сама палітра, що й у виборі кольору послуги в адмінці (colorId) —
// бабл ціни на лендингу тонується в колір, обраний для послуги там.
const SERVICE_COLORS = {
  green: '#7ed957', yellow: '#f7c948', blue: '#5b9bff', purple: '#c084fc',
  red: '#ff5a3c', teal: '#2dd4bf', pink: '#f472b6', orange: '#fb923c',
  indigo: '#818cf8', lime: '#a3e635',
}
const colorOfService = (colorId) => SERVICE_COLORS[colorId] || SERVICE_COLORS.green

// Підпис дня для тизера найближчих вільних місць — "Сьогодні"/"Завтра"/скорочена назва дня.
function slotDayLabel(dateStr) {
  const today = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  if (dateStr === formatDateYMD(today)) return 'Сьогодні'
  if (dateStr === formatDateYMD(tomorrow)) return 'Завтра'
  return getDayName(parseYMD(dateStr).getDay())
}

// Коротка дата для тизера найближчих вільних місць — "13 вер".
function slotDateShort(dateStr) {
  const d = parseYMD(dateStr)
  return `${d.getDate()} ${getMonthShort(d.getMonth())}`
}

// Блоки лендингу "збираються" з дрібної мозаїчної плитки при прокрутці:
// поверх контенту лежить сітка маленьких плиток кольору фону, які по черзі
// (діагональною хвилею) ховаються, відкриваючи вже повністю відрендерений
// контент під собою. IntersectionObserver вмикає це один раз.
const REVEAL_COLS = 10
const REVEAL_ROWS = 6
const REVEAL_TILES = Array.from({ length: REVEAL_COLS * REVEAL_ROWS }, (_, i) => ({
  key: i,
  delay: (Math.floor(i / REVEAL_COLS) + (i % REVEAL_COLS)) * 28,
}))

function Reveal({ children }) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); io.disconnect() }
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className="reveal">
      {children}
      <div className={`reveal-tiles${inView ? ' reveal-in' : ''}`} aria-hidden="true">
        {REVEAL_TILES.map(t => (
          <div key={t.key} className="reveal-tile" style={{ transitionDelay: `${t.delay}ms` }} />
        ))}
      </div>
    </div>
  )
}

const HERO_PHOTO_SECONDS = 3.4 // тривалість показу одного фото в слоті

// Три "слоти" колажу, кожен циклічно перебирає СВОЮ підмножину фото
// (round-robin по індексу, щоб фото рівномірно розійшлись по трьох картках).
function PhotoCollageSlot({ photos, phase, className }) {
  if (!photos.length) return null
  if (photos.length === 1) {
    return (
      <div className={`hp-slot ${className}`}>
        <div className="hp-layer" style={{ backgroundImage: `url(${photos[0]})`, opacity: 1, filter: 'none' }} />
      </div>
    )
  }
  const duration = photos.length * HERO_PHOTO_SECONDS
  const animName = `hp-blur-dissolve-${photos.length}`
  return (
    <div className={`hp-slot ${className}`}>
      {photos.map((url, i) => (
        <div
          key={url + i}
          className="hp-layer"
          style={{
            backgroundImage: `url(${url})`,
            animationName: animName,
            animationDuration: `${duration}s`,
            animationDelay: `${-(i * HERO_PHOTO_SECONDS) + phase}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function Landing({ user, profile }) {
  const { theme, toggle } = useTheme()
  const nav = useNavigate()
  const [termsOpen, setTermsOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  const [instructorProfile, setInstructorProfile] = useState(null)
  useEffect(() => {
    getAdminSettings().then(s => { if (s.profile) setInstructorProfile(s.profile) }).catch(() => {})
  }, [])

  const [reviews, setReviews] = useState([])
  useEffect(() => {
    getApprovedReviews().then(setReviews).catch(() => {})
  }, [])

  const [services, setServices] = useState([])
  useEffect(() => {
    getAdminServices().then(setServices).catch(() => {})
  }, [])

  const [upcomingSlots, setUpcomingSlots] = useState([])
  useEffect(() => {
    getUpcomingFreeSlots(12).then(setUpcomingSlots).catch(() => {})
  }, [])

  // Ціна за годину для кожного напрямку — перша активна 1-годинна послуга цього типу.
  const schoolService = services.find(s => s.type === 'school' && Number(s.duration) === 60)
  const privateService = services.find(s => s.type === 'private' && Number(s.duration) === 60)
  const schoolService2h = services.find(s => s.type === 'school' && Number(s.duration) === 120)
  const privateService2h = services.find(s => s.type === 'private' && Number(s.duration) === 120)
  const nearestSlot = upcomingSlots[0]

  const instructorName = instructorProfile?.name || 'Майстер'
  const instructorPhone = instructorProfile?.phone || ''
  const instructorAddress = instructorProfile?.address || ''
  const instructorPhoto = instructorProfile?.photoUrl || ''
  const instructorTerms = instructorProfile?.terms || ''
  const instructorAbout = (instructorProfile?.about || '').trim()
  const aboutIsLong = instructorAbout.length > 280 || instructorAbout.split('\n').length > 6
  const meetLat = instructorProfile?.meetLat
  const meetLng = instructorProfile?.meetLng
  const hasMeetPin = meetLat != null && meetLng != null
  const mapQuery = hasMeetPin ? `${meetLat},${meetLng}` : instructorAddress
  const iPhoneDigits = instructorPhone.replace(/\D/g, '')
  const telegramHref = `https://t.me/+${iPhoneDigits}`

  const galleryPhotos = instructorProfile?.galleryPhotos || []
  const collageSlots = [[], [], []]
  galleryPhotos.forEach((p, i) => collageSlots[i % 3].push(p.url))

  const goAuth = () => nav(user && profile ? '/cabinet' : '/schedule')
  const goRegister = () => nav(user && profile ? '/cabinet' : '/auth')
  // Публічний розклад (PublicSchedule) сам веде вибором дати й часу — тут
  // просто відкриваємо його, конкретний слот з тизера клієнт обере там же.
  const goBookSlot = () => goAuth()

  return (
    <div className="landing-page">

      {/* TOP BAR */}
      <header className="landing-topbar">
        <div className="container landing-topbar-row">
          <div className="topbar-actions">
            <button className="icon-btn" onClick={() => nav(-1)} aria-label="Назад">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button className="icon-btn" onClick={() => window.location.reload()} aria-label="Оновити">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>
          <div className="logo">
            <div className="logo-icon"><img src="/icon-192.png" alt="Juno"/></div>
            Juno
          </div>
          <button className="btn-login landing-topbar-login" onClick={goRegister}>
            {user ? 'Кабінет' : 'Увійти'}
          </button>
        </div>
      </header>

      <div className="container">

        {/* HERO */}
        <section className="hero">
          {galleryPhotos.length > 0 && (
            <div className="photo-collage">
              <PhotoCollageSlot photos={collageSlots[0]} phase={0}  className="hp-slot-a" />
              <PhotoCollageSlot photos={collageSlots[1]} phase={-4} className="hp-slot-b" />
              <PhotoCollageSlot photos={collageSlots[2]} phase={-8} className="hp-slot-c" />
            </div>
          )}
          <h1>Уроки водіння</h1>
          <button className="hero-cta" onClick={goAuth}>📅 Записатись на урок</button>
        </section>

        {/* INSTRUCTOR */}
        <Reveal>
        <section className="lsection">
          <div className="instructor-card">
            <div className="instructor-avatar" style={{display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,background:'var(--accent-bg, #eee)',overflow:'hidden'}}>
              {instructorPhoto
                ? <img src={instructorPhoto} alt={instructorName} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                : '🧑‍🏫'}
            </div>
            <div className="instructor-info">
              <div className="instructor-name">{instructorName}</div>
              <div className="instructor-role">Майстер з водіння</div>
            </div>
          </div>
        </section>
        </Reveal>

        {/* PORTFOLIO — текст майстра про себе та переваги (Профіль → Портфоліо) */}
        {instructorAbout && (
        <Reveal>
        <section className="lsection">
          <h2>Портфоліо</h2>
          <div className={`about-text${aboutIsLong && !aboutOpen ? ' clamped' : ''}`}>{instructorAbout}</div>
          {aboutIsLong && (
            <button className="about-more" onClick={() => setAboutOpen(o => !o)}>
              {aboutOpen ? 'Згорнути' : 'Читати далі'}
            </button>
          )}
        </section>
        </Reveal>
        )}

        {/* PRICING */}
        {(schoolService || privateService) && (
        <Reveal>
        <section className="lsection">
          <h2>Скільки коштує урок</h2>
          <div className="pricing-bubbles">
            {schoolService && (
              <div className="pricing-bubble" style={{ '--c': colorOfService(schoolService.colorId) }}>
                <div className="pricing-bubble-icon">🎓</div>
                <div className="pricing-bubble-lbl">Автошкола</div>
                <div className="pricing-bubble-num">{schoolService.price}<span>₴/год</span></div>
                {schoolService2h && <div className="pricing-bubble-sub">2 год — <b>{schoolService2h.price}₴</b></div>}
              </div>
            )}
            {privateService && (
              <div className="pricing-bubble" style={{ '--c': colorOfService(privateService.colorId) }}>
                <div className="pricing-bubble-icon">🚙</div>
                <div className="pricing-bubble-lbl">Приватні</div>
                <div className="pricing-bubble-num">{privateService.price}<span>₴/год</span></div>
                {privateService2h && <div className="pricing-bubble-sub">2 год — <b>{privateService2h.price}₴</b></div>}
              </div>
            )}
          </div>
        </section>
        </Reveal>
        )}

        {/* NEAREST SLOTS */}
        {nearestSlot && (
        <Reveal>
        <section className="lsection">
          <h2>Найближчі вільні місця</h2>

          <div className="next-slot-card">
            <div className="next-slot-lbl">Найближче вікно</div>
            <div className="next-slot-big">{slotDayLabel(nearestSlot.date)}, {slotDateShort(nearestSlot.date)} · {nearestSlot.time}</div>
            <div className="next-slot-sub">
              {upcomingSlots.length > 1
                ? `Ще ${upcomingSlots.length - 1} вільних варіантів цього тижня`
                : 'Встигни записатись, поки є місце'}
            </div>
            <button className="next-slot-cta" onClick={goBookSlot}>📅 Забронювати</button>
          </div>

          {upcomingSlots.length > 1 && (
            <>
              <div className="slot-chips-lbl">Або обери інший час</div>
              <div className="slot-chips">
                {upcomingSlots.map((s, i) => (
                  <button
                    key={`${s.date}_${s.time}`}
                    className={`slot-chip${i === 0 ? ' active' : ''}`}
                    onClick={goBookSlot}
                  >
                    <div className="slot-chip-day">{slotDayLabel(s.date)}</div>
                    <div className="slot-chip-date">{slotDateShort(s.date)}</div>
                    <div className="slot-chip-time">{s.time}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
        </Reveal>
        )}

        {/* REVIEWS */}
        {reviews.length > 0 && (
        <Reveal>
        <section className="lsection">
          <h2>Що кажуть клієнти</h2>
          <div className="reviews-scroll">
            {reviews.map(rv => (
              <div className="review-card" key={`${rv.uid}_${rv.id}`}>
                <div className="review-stars">{'★'.repeat(rv.rating || 0)}{'☆'.repeat(5 - (rv.rating || 0))}</div>
                {rv.text && <div className="review-text">{rv.text}</div>}
                <div className="review-author">
                  <div className="review-avatar">{(rv.studentName || 'У').trim()[0].toUpperCase()}</div>
                  <div>
                    <div className="review-name">{rv.studentName || 'Клієнт'}</div>
                    {rv.createdAt && <div className="review-date">{new Date(rv.createdAt).toLocaleDateString('uk-UA')}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        </Reveal>
        )}

        {/* CONTACTS */}
        {instructorPhone && (
        <Reveal>
        <section className="lsection">
          <h2>Звʼязатись зі мною</h2>
          <div className="contacts">
            <div className="contact-icon-row">
              <a href={`tel:${instructorPhone}`} className="contact-icon-btn contact-icon-btn--call" aria-label="Зателефонувати">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.24 1.01l-2.21 2.21z"/></svg>
              </a>
              <a href={telegramHref} target="_blank" rel="noreferrer" className="contact-icon-btn contact-icon-btn--tg" aria-label="Telegram">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-1.7 8c-.12.57-.46.71-.93.44l-2.58-1.9-1.24 1.19c-.14.14-.25.25-.51.25l.18-2.62 4.72-4.26c.2-.18-.05-.28-.32-.1L7.6 14.47l-2.54-.79c-.55-.17-.56-.55.12-.82l9.93-3.83c.46-.17.86.11.53.77z"/></svg>
              </a>
              <a href={`viber://chat?number=%2B${iPhoneDigits}`} className="contact-icon-btn contact-icon-btn--viber" aria-label="Viber">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.4 1.5C7.5 1.7 4 4.4 3.2 8.2c-.4 2-.3 3.9.4 5.7.5 1.3 1.4 2.5 2.4 3.5l.3 3.3c.1.6.8.8 1.2.4l2.4-2.1c.6.1 1.2.2 1.8.2 4.3 0 7.9-3.2 8.3-7.4.5-4.8-3-9.6-8.6-10.3zm4.5 13.2c-.4.4-1 .7-1.6.8-.3.1-.7.1-1 0-.9-.2-1.7-.6-2.5-1.1-1.5-1-2.8-2.3-3.6-3.9-.4-.8-.7-1.6-.7-2.5 0-.6.2-1.2.6-1.6.3-.4.8-.6 1.3-.6.2 0 .4 0 .5.1.2.1.3.2.4.4l1.3 1.8c.1.2.2.4.2.6 0 .2-.1.4-.3.6l-.4.4c-.1.1-.2.2-.2.3s0 .2.1.3c.4.7 1 1.3 1.6 1.8.3.2.5.2.7 0l.4-.4c.2-.2.4-.3.6-.3.2 0 .4.1.6.2l1.8 1.2c.2.1.3.3.4.5.1.4-.1.8-.2 1.4z"/></svg>
              </a>
              <a href={`https://wa.me/${iPhoneDigits}`} target="_blank" rel="noreferrer" className="contact-icon-btn contact-icon-btn--wa" aria-label="WhatsApp">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.28-.14-1.64-.81-1.9-.9-.25-.1-.44-.14-.62.14-.18.28-.72.9-.88 1.09-.16.19-.32.21-.6.07-.28-.14-1.18-.44-2.25-1.39-.83-.74-1.39-1.66-1.56-1.94-.16-.28-.02-.43.12-.57.13-.12.28-.32.42-.48.14-.16.18-.28.28-.46.09-.18.05-.34-.02-.48-.07-.14-.62-1.5-.85-2.05-.22-.54-.45-.47-.62-.47-.16 0-.35-.02-.53-.02s-.48.07-.73.34c-.25.28-.96.94-.96 2.3 0 1.35.98 2.66 1.12 2.84.14.18 1.93 2.94 4.67 4.13.65.28 1.16.45 1.56.57.65.21 1.25.18 1.72.11.52-.08 1.64-.67 1.87-1.32.23-.65.23-1.2.16-1.32-.07-.12-.25-.19-.53-.33z"/><path d="M12.04 2C6.48 2 2 6.48 2 12.04c0 1.85.5 3.58 1.37 5.06L2 22l5.08-1.33A10.02 10.02 0 0012.04 22C17.6 22 22 17.52 22 12.04 22 6.48 17.6 2 12.04 2zm0 18.16c-1.7 0-3.28-.46-4.64-1.26l-.33-.2-3.42.9.91-3.34-.22-.34a8.15 8.15 0 01-1.28-4.38c0-4.5 3.66-8.16 8.16-8.16 4.5 0 8.16 3.66 8.16 8.16 0 4.5-3.66 8.16-8.16 8.16z"/></svg>
              </a>
            </div>
          </div>
        </section>
        </Reveal>
        )}

        {/* MAP */}
        {(hasMeetPin || instructorAddress) && (
        <Reveal>
        <section className="lsection">
          <h2>Місце зустрічі</h2>
          <div className="map-card">
            <iframe
              className="map-iframe"
              src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Карта"
            ></iframe>
            <div className="map-overlay">
              <div className="map-pin">📍</div>
              <div>
                <div className="contact-label">Адреса</div>
                <div className="contact-val">{instructorAddress || 'Точка зустрічі на карті'}</div>
              </div>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noreferrer" className="map-route-btn">Маршрут</a>
            </div>
          </div>
        </section>
        </Reveal>
        )}

        {/* TERMS */}
        {instructorTerms && (
        <Reveal>
        <section className="lsection">
          <button className="terms-btn" onClick={() => setTermsOpen(o => !o)}>
            <div className="terms-ico">📄</div>
            <div className="terms-btn-label">Умови відвідування уроків</div>
            <div className={`terms-chevron${termsOpen ? ' open' : ''}`}>›</div>
          </button>
          {termsOpen && (
            <div className="terms-content">
              <div className="terms-text" style={{whiteSpace:'pre-line',padding:'12px 16px'}}>{instructorTerms}</div>
            </div>
          )}
        </section>
        </Reveal>
        )}

        {/* FOOTER */}
        <div className="footer">
          <button className="footer-cta" onClick={goAuth}>🚗 Записатись зараз</button>
          <div>© 2026 Juno. Школа водіння.</div>
          <div className="devby">
            <small>Розробка та дизайн</small>
            <b>AlDemi Studio</b>
            <span>Founder &amp; Head of Product</span>
          </div>
        </div>

      </div>
    </div>
  )
}
