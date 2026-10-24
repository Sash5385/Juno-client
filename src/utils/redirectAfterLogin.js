// Збереження глибокого посилання (наприклад, /cabinet?date=...&time=... з push-сповіщення),
// щоб після входу повернутись на нього. Ключ збігається з OLH-клієнтом.
const KEY = 'redirectAfterLogin'
// /i/{slug}/... — мультитенантний префікс інструктора
const SLUG_RE = /^\/i\/([^/]+)(\/.*)?$/

// Перетворює /i/{slug}/rest?x=1 на /rest?x=1&i={slug}, щоб після входу застосунок знову прив'язав інструктора
export function buildRedirectTarget(pathname, search = '') {
  let path = pathname || '/'
  const params = new URLSearchParams(search)
  const m = path.match(SLUG_RE)
  if (m) {
    path = m[2] || '/'
    params.set('i', decodeURIComponent(m[1]))
  }
  const qs = params.toString()
  return path + (qs ? '?' + qs : '')
}

// Дозволяє лише same-origin відносні шляхи, що починаються з "/" (без "//" і "/\" — protocol-relative)
export function safeRedirectPath(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null
  try {
    const u = new URL(raw, window.location.origin)
    if (u.origin !== window.location.origin) return null
    return u.pathname + u.search + u.hash
  } catch { return null }
}

export function saveRedirectAfterLogin(pathname, search = '') {
  try { localStorage.setItem(KEY, buildRedirectTarget(pathname, search)) } catch { /* сховище недоступне */ }
}

// Читає і одразу очищає збережену ціль; при відсутності або недозволеному значенні — fallback
export function consumeRedirectAfterLogin(fallback = '/cabinet') {
  let raw = null
  try { raw = localStorage.getItem(KEY); localStorage.removeItem(KEY) } catch { /* сховище недоступне */ }
  return safeRedirectPath(raw) || fallback
}
