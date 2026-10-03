// Доступ до даних салону: підписки RTDB, вхід, slug → salonId.
import { useEffect, useState } from 'react'
import { ref, onValue, get } from 'firebase/database'
import { onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '../firebase/config'
import { DEMO } from '../demo/demoMode'
import { salonPath, salonSlugPath } from '../utils/salonPaths'

export const DEMO_SALON_ID = 'demo-salon'
export const DEMO_SLUG = 'beauty-studio'
export const DEMO_CLIENT = { uid: 'demo-client', email: '', displayName: 'Ірина Шевченко', phoneNumber: '+380671234567' }

export const sref = (salonId, path) => ref(db, salonPath(salonId, path))
export const rootRef = (path) => ref(db, path)
export const toList = (obj) => Object.entries(obj || {}).map(([id, v]) => ({ id, ...(v && typeof v === 'object' ? v : {}) }))

// Підписка на вузол: makeRef() → ref/query або null. deps — ключ підписки (інші дані не показуємо, поки не прийшли нові)
export function useValue(makeRef, deps) {
  const key = JSON.stringify(deps)
  const [state, setState] = useState({ key: null, value: undefined })
  useEffect(() => {
    const r = makeRef()
    if (!r) { queueMicrotask(() => setState({ key, value: null })); return undefined }
    const unsub = onValue(r, (snap) => setState({ key, value: snap.val() }), () => setState({ key, value: null }))
    return () => { try { unsub() } catch { /* ignore */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const fresh = state.key === key
  return { value: fresh ? state.value : undefined, loading: !fresh }
}

// Кілька вузлів одразу (сітки слотів кількох майстрів): { id: value }
export function useValues(items, deps) {
  const key = JSON.stringify(deps)
  const [state, setState] = useState({ key: null, map: {} })
  useEffect(() => {
    const unsubs = items.map(({ id, ref: r }) => onValue(r, (snap) => setState((s) => ({ key, map: { ...(s.key === key ? s.map : {}), [id]: snap.val() || {} } }))))
    return () => unsubs.forEach((u) => { try { u() } catch { /* ignore */ } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state.key === key ? state.map : {}
}

export function useAuthUser() {
  const [user, setUser] = useState(DEMO ? DEMO_CLIENT : undefined)
  useEffect(() => {
    if (DEMO) return undefined
    const fb = setTimeout(() => setUser((p) => (p === undefined ? null : p)), 3000)
    const unsub = onAuthStateChanged(auth, (u) => { clearTimeout(fb); setUser(u || null) })
    return () => { clearTimeout(fb); unsub() }
  }, [])
  return user
}

export async function resolveSalonSlug(slug) {
  if (DEMO) return DEMO_SALON_ID
  const snap = await get(rootRef(salonSlugPath(slug)))
  return snap.exists() ? snap.val()?.salonId || null : null
}

const SLUG_KEY = 'salon_slug'
const COOKIE = 'salon_slug'
// slug дублюємо в cookie: iPhone при "На екран Домой" копіює cookie Safari у сховище ярлика (localStorage — ні)
export function storeSlug(slug) {
  try { localStorage.setItem(SLUG_KEY, slug); document.cookie = `${COOKIE}=${encodeURIComponent(slug)}; max-age=31536000; path=/; SameSite=Lax` } catch { /* ignore */ }
}
export function loadStoredSlug() {
  try {
    const v = localStorage.getItem(SLUG_KEY)
    if (v) return v
    const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'))
    return m ? decodeURIComponent(m[1]) : null
  } catch { return null }
}
