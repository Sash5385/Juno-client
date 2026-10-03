// Контекст клієнта салону: slug → salonId, профіль/послуги/майстри салону, вхід і анкета клієнта
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { SalonCtx } from './ctx'
import { sref, useValue, useAuthUser, resolveSalonSlug, toList, storeSlug, loadStoredSlug, DEMO_SLUG } from './data'
import { useToastLite } from './kit'
import { DEMO } from '../demo/demoMode'

export default function SalonProvider({ children }) {
  const loc = useLocation()
  const fromUrl = /^\/s\/([^/]+)/.exec(loc.pathname)?.[1] || null
  const slug = fromUrl || (DEMO ? DEMO_SLUG : loadStoredSlug())
  const [res, setRes] = useState({ slug: null, salonId: null })
  const [toastEl, toast] = useToastLite()
  const user = useAuthUser()

  useEffect(() => {
    if (!slug) return undefined
    let dead = false
    resolveSalonSlug(slug).then((id) => { if (!dead) { setRes({ slug, salonId: id || false }); if (id) storeSlug(slug) } }).catch(() => { if (!dead) setRes({ slug, salonId: false }) })
    return () => { dead = true }
  }, [slug])

  const resolved = res.slug === slug
  const salonId = resolved && res.salonId ? res.salonId : null
  const prof = useValue(() => (salonId ? sref(salonId, 'profile') : null), [salonId])
  const svc = useValue(() => (salonId ? sref(salonId, 'services') : null), [salonId])
  const mst = useValue(() => (salonId ? sref(salonId, 'masters') : null), [salonId])
  const up = useValue(() => (salonId && user ? sref(salonId, `users/${user.uid}/profile`) : null), [salonId, user?.uid])

  const profile = useMemo(() => prof.value || {}, [prof.value])
  const services = useMemo(() => toList(svc.value).filter((s) => s.active !== false), [svc.value])
  const masters = useMemo(() => toList(mst.value).filter((m) => m.profile?.active !== false).map((m) => ({ id: m.id, ...m.profile })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [mst.value])
  const step = [10, 15, 20, 30, 60].includes(Number(profile.slotStep)) ? Number(profile.slotStep) : 30

  const value = useMemo(() => ({
    slug, salonId, profile, services, masters, step, payment: profile.payment || {}, tz: profile.timezone || 'Europe/Kyiv',
    user: user || null, authReady: user !== undefined, uProfile: up.value || null, uProfileReady: !up.loading || !user, toast,
    ready: !!salonId && !prof.loading && !svc.loading && !mst.loading, missing: !!slug && resolved && res.salonId === false, noSlug: !slug,
  }), [slug, salonId, profile, services, masters, step, user, up.value, up.loading, toast, prof.loading, svc.loading, mst.loading, resolved, res.salonId])

  return <SalonCtx.Provider value={value}>{children}{toastEl}</SalonCtx.Provider>
}
