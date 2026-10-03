// Публічна сторінка салону /s/{slug}: інформація, послуги, майстри, кнопка запису (вхід — лише на останньому кроці)
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSalon } from './ctx'
import BookFlow from './BookFlow'
import { Btn, Card, Empty, Spinner, money, initials } from './kit'
import { priceFor, serviceDuration, offersService } from '../utils/salonLogic'

export default function Public() {
  const ctx = useSalon()
  const nav = useNavigate()
  const [flow, setFlow] = useState(false)
  const { profile, services, masters, ready, missing, noSlug } = ctx
  const groups = useMemo(() => {
    const g = {}
    for (const s of services.filter((x) => masters.some((m) => offersService(x, m.id)))) (g[s.category || 'Інше'] ||= []).push(s)
    return Object.entries(g)
  }, [services, masters])
  if (noSlug) return <Empty icon="💈" text="Відкрийте посилання для запису, яке дав вам салон" />
  if (missing) return <Empty icon="🔍" text="Салон не знайдено. Перевірте посилання." />
  if (!ready) return <Spinner />
  const range = (s) => { const p = masters.filter((m) => offersService(s, m.id)).map((m) => priceFor(s, m.id)); const lo = Math.min(...p), hi = Math.max(...p); return lo === hi ? money(lo) : `від ${money(lo)}` }
  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 'calc(96px + env(safe-area-inset-bottom,0px))' }}>
      <div style={{ padding: 'calc(28px + env(safe-area-inset-top,0px)) 20px 22px', textAlign: 'center', background: 'linear-gradient(160deg,color-mix(in srgb,var(--accent) 30%,transparent),transparent)' }}>
        <div style={{ fontSize: 46 }}>💈</div>
        <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{profile.name}</div>
        {profile.about && <div style={{ fontSize: 14, color: 'var(--dim)', marginTop: 6, lineHeight: 1.5 }}>{profile.about}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12 }}>
          {profile.address && <a href={`https://maps.google.com/?q=${encodeURIComponent(profile.address)}`} target="_blank" rel="noreferrer" style={chip}>📍 {profile.address}</a>}
          {profile.phone && <a href={`tel:${profile.phone}`} style={chip}>📞 {profile.phone}</a>}
        </div>
      </div>
      <div style={{ padding: '4px 14px 0', maxWidth: 560, margin: '0 auto' }}>
        {masters.length > 0 && (
          <>
            <div style={h}>Майстри</div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
              {masters.map((m) => (
                <div key={m.id} style={{ flex: '0 0 auto', width: 92, textAlign: 'center' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 20, margin: '0 auto 6px', background: 'color-mix(in srgb, var(--blue) 22%, transparent)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20 }}>{initials(m.name)}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.25 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--dim)' }}>{m.spec}</div>
                </div>
              ))}
            </div>
          </>
        )}
        <div style={h}>Послуги і ціни</div>
        {groups.length === 0 ? <Empty icon="✂️" text="Послуги скоро з'являться" /> : groups.map(([cat, list]) => (
          <div key={cat} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{cat}</div>
            <Card>{list.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', gap: 10, padding: '11px 14px', borderTop: i ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14.5, fontWeight: 700 }}>{s.name}</div><div style={{ fontSize: 12, color: 'var(--dim)' }}>{serviceDuration(s)} хв</div></div>
                <div style={{ fontWeight: 900 }}>{range(s)}</div>
              </div>))}</Card>
          </div>
        ))}
        <div style={{ textAlign: 'center', margin: '18px 0' }}><button onClick={() => nav('/cabinet/bookings')} style={{ background: 'none', border: 'none', color: 'var(--dim)', textDecoration: 'underline', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Мій кабінет і записи</button></div>
      </div>
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '12px 14px calc(12px + env(safe-area-inset-bottom,0px))', background: 'linear-gradient(180deg,transparent,var(--bg-deep) 40%)' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}><Btn onClick={() => setFlow(true)} disabled={groups.length === 0}>Записатись онлайн</Btn></div>
      </div>
      {flow && <BookFlow onClose={() => setFlow(false)} />}
    </div>
  )
}
const chip = { padding: '7px 12px', borderRadius: 11, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, textDecoration: 'none', fontWeight: 600 }
const h = { fontSize: 15, fontWeight: 900, margin: '18px 0 10px' }
