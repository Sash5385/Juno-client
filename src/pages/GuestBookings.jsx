import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ref, get } from 'firebase/database'
import { db } from '../firebase/config'

const BG    = "#111214"
const SURF  = "#1e2024"
const BRD   = "rgba(255,255,255,0.07)"
const TEXT  = "#e8e8ea"
const DIM   = "#8b8d93"
const ACCENT = "#ff5a3c"
const GREEN = "#34d399"

export default function GuestBookings() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()

  const [iid, setIid] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [phone, setPhone] = useState(searchParams.get('phone') || '')
  const [bookings, setBookings] = useState(null)
  const [loading, setLoading] = useState(false)
  const [instrProfile, setInstrProfile] = useState(null)

  // Resolve slug → iid
  useEffect(() => {
    if (!slug) return
    get(ref(db, `slugs/${slug}`)).then(snap => {
      if (!snap.exists()) { setNotFound(true); return }
      const resolvedIid = snap.val().iid
      setIid(resolvedIid)
      get(ref(db, `instructors/${resolvedIid}/admin_settings/profile`)).then(s => {
        if (s.exists()) setInstrProfile(s.val())
      }).catch(() => {})
    }).catch(() => setNotFound(true))
  }, [slug])

  // Auto-search if phone in URL
  useEffect(() => {
    if (iid && searchParams.get('phone')) search(searchParams.get('phone'))
  }, [iid]) // eslint-disable-line react-hooks/exhaustive-deps

  const search = async (ph) => {
    const raw = (ph || phone).replace(/\D/g, '')
    if (!raw || !iid) return
    setLoading(true)
    try {
      const uid = `guest_${raw}`
      const snap = await get(ref(db, `instructors/${iid}/bookings/${uid}`))
      if (!snap.exists()) { setBookings([]); return }
      const all = Object.entries(snap.val())
        .map(([id, b]) => ({ ...b, id }))
        .filter(b => b.status !== 'cancelled')
        .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : (a.time > b.time ? 1 : -1)))
      setBookings(all)
    } catch {
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  if (notFound) return (
    <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ textAlign:'center', color:TEXT }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🔍</div>
        <div style={{ fontSize:18, fontWeight:800 }}>Інструктора не знайдено</div>
      </div>
    </div>
  )

  const fmt = (date) =>
    new Date(date + 'T12:00:00').toLocaleDateString('uk-UA', { weekday:'short', day:'numeric', month:'long' })

  return (
    <div style={{ minHeight:'100vh', background:BG, color:TEXT,
      fontFamily:'ui-sans-serif,-apple-system,BlinkMacSystemFont,system-ui,sans-serif' }}>
      <div style={{ maxWidth:480, margin:'0 auto', padding:'20px 16px 60px' }}>

        {/* Header */}
        <div style={{ marginBottom:24 }}>
          {instrProfile?.name && (
            <div style={{ fontSize:13, color:DIM, marginBottom:4 }}>
              Інструктор: <span style={{ color:TEXT, fontWeight:600 }}>{instrProfile.name}</span>
            </div>
          )}
          <div style={{ fontSize:20, fontWeight:800 }}>Мої записи</div>
        </div>

        {/* Phone input */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, color:DIM, marginBottom:6 }}>Ваш номер телефону</div>
          <div style={{ display:'flex', gap:8 }}>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="+380XXXXXXXXX"
              type="tel"
              style={{
                flex:1, background:SURF, border:`1px solid ${BRD}`, borderRadius:12,
                padding:'11px 14px', color:TEXT, fontSize:14, outline:'none'
              }}
            />
            <button
              onClick={() => search()}
              disabled={loading || !phone.trim()}
              style={{
                padding:'11px 18px', borderRadius:12, border:'none', cursor:'pointer',
                background: loading ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg,${ACCENT},#e04428)`,
                color:'#fff', fontSize:14, fontWeight:700, flexShrink:0,
              }}
            >
              {loading ? '...' : 'Знайти'}
            </button>
          </div>
        </div>

        {/* Results */}
        {bookings !== null && (
          <>
            {bookings.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:DIM }}>
                <div style={{ fontSize:32, marginBottom:12 }}>📭</div>
                <div>Записів не знайдено</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {bookings.map(b => {
                  const isPast = b.date < new Date().toISOString().slice(0, 10)
                  return (
                    <div key={b.id} style={{
                      padding:'14px 16px', background:SURF, borderRadius:14,
                      border:`1px solid ${isPast ? 'rgba(255,255,255,0.04)' : BRD}`,
                      opacity: isPast ? 0.5 : 1,
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                        <div style={{ fontWeight:700, fontSize:15 }}>{fmt(b.date)}</div>
                        <div style={{
                          fontSize:12, fontWeight:700, padding:'3px 8px', borderRadius:6,
                          background: isPast ? 'rgba(255,255,255,0.06)' :
                            b.status === 'confirmed' ? 'rgba(52,211,153,0.15)' : 'rgba(255,90,60,0.15)',
                          color: isPast ? DIM : b.status === 'confirmed' ? GREEN : ACCENT,
                        }}>
                          {isPast ? 'Минуло' : b.status === 'confirmed' ? 'Підтверджено' : b.status}
                        </div>
                      </div>
                      <div style={{ fontSize:13, color:DIM }}>
                        о {b.time} · {b.serviceName || b.serviceType}
                        {b.price > 0 && <span style={{ marginLeft:8, color:GREEN, fontWeight:600 }}>{b.price} ₴</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {instrProfile?.phone && (
              <div style={{ marginTop:24, padding:'12px 16px', background:SURF, borderRadius:14, border:`1px solid ${BRD}` }}>
                <div style={{ fontSize:12, color:DIM, marginBottom:4 }}>Скасування або питання</div>
                <a href={`tel:${instrProfile.phone}`} style={{ fontSize:16, fontWeight:700, color:ACCENT, textDecoration:'none' }}>
                  {instrProfile.phone}
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
