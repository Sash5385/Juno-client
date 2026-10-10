// Публічна сторінка салону /s/{slug}: список майстрів салону з послугами. Клієнт обирає майстра й переходить на його
// посилання запису (/i/{slug майстра}). Дані публічні: salons/{slug}, а профіль і послуги майстра читаються з його
// admin_settings/profile та admin_data/services (читання відкрите — так само, як для лендингу майстра).
import { useState, useEffect } from 'react'
import { ref, get } from 'firebase/database'
import { db } from '../firebase/config'
import { getInitials } from '../utils/format'
import { salonMasters } from '../salon'
import { APP_VERSION } from '../version.js'

const SERVICE_COLORS = {
  green: '#7ed957', yellow: '#f7c948', blue: '#5b9bff', purple: '#c084fc', red: '#ff5a3c',
  teal: '#2dd4bf', pink: '#f472b6', orange: '#fb923c', indigo: '#818cf8', lime: '#a3e635',
}

async function loadMaster(iid) {
  const [profile, services] = await Promise.all([
    get(ref(db, `instructors/${iid}/admin_settings/profile`)).then(s => s.val()).catch(() => null),
    get(ref(db, `instructors/${iid}/admin_data/services`)).then(s => s.val()).catch(() => null),
  ])
  const list = Array.isArray(services) ? services : Object.values(services || {})
  return {
    iid,
    name: profile?.name || 'Майстер',
    slug: profile?.slug || null,
    photo: profile?.photo || null,
    city: profile?.city || '',
    services: list.filter(s => s && s.active && !s.archived).slice(0, 6),
  }
}

export default function SalonPage({ slug }) {
  const [state, setState] = useState({ loading: true, salon: null, masters: [] })

  useEffect(() => {
    let alive = true
    ;(async () => {
      let salon = null
      let masters = []
      try {
        salon = (await get(ref(db, `salons/${slug}`))).val()
        if (salon) masters = await Promise.all(salonMasters(salon).map(m => loadMaster(m.iid)))
      } catch { salon = null }
      return { salon, masters }
    })().then(r => { if (alive) setState({ loading: false, ...r }) })
    return () => { alive = false }
  }, [slug])

  const wrap = {
    minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '20px', paddingTop: 'calc(32px + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box',
  }

  if (state.loading) return <div style={{ ...wrap, justifyContent: 'center' }}><div className="spinner" /></div>
  if (!state.salon) {
    return (
      <div style={{ ...wrap, justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
        <p>Салон не знайдено. Перевірте посилання.</p>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 4px', textAlign: 'center' }}>{state.salon.name}</h1>
        <p style={{ margin: '0 0 20px', textAlign: 'center', color: 'var(--dim)', fontSize: 14 }}>Оберіть майстра й запишіться онлайн</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {state.masters.map(m => (
            <div key={m.iid} style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 14, boxShadow: 'var(--shadow)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {m.photo
                  ? <img src={m.photo} alt="" style={{ width: 56, height: 56, borderRadius: 16, objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 56, height: 56, borderRadius: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, color: '#fff', background: 'linear-gradient(145deg,#c084fc,#7c3aed)' }}>{getInitials(m.name)}</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                  {m.city && <div style={{ fontSize: 12, color: 'var(--dim)' }}>{m.city}</div>}
                </div>
              </div>
              {m.services.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {m.services.map(s => (
                    <span key={s.id} style={{
                      fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 99,
                      background: `${SERVICE_COLORS[s.colorId] || SERVICE_COLORS.green}22`, border: `1px solid ${SERVICE_COLORS[s.colorId] || SERVICE_COLORS.green}55`,
                    }}>{s.name}{s.price > 0 ? ` · ${s.price} ₴` : ''}</span>
                  ))}
                </div>
              )}
              <button
                className="btn-primary" style={{ marginTop: 12 }} disabled={!m.slug}
                onClick={() => window.location.assign(`/i/${encodeURIComponent(m.slug)}`)}
              >{m.slug ? 'Записатись' : 'Скоро'}</button>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--faint)', marginTop: 24 }}>Juno · {APP_VERSION}</div>
      </div>
    </div>
  )
}
