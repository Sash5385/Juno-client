// Режим «салон»: збірка з VITE_APP_MODE=salon (npm run build:salon) або адреса з ?app=salon (для розробки; ?app=dr вимикає,
// вибір пам'ятається до закриття вкладки). Без нього застосунок лишається клієнтом інструктора Juno — нічого не змінюється.
function detect() {
  try {
    if (import.meta.env.VITE_APP_MODE === 'salon') return true
    const q = new URLSearchParams(window.location.search).get('app')
    if (q === 'dr') { sessionStorage.removeItem('jn_app'); return false }
    if (q === 'salon') sessionStorage.setItem('jn_app', 'salon')
    return sessionStorage.getItem('jn_app') === 'salon'
  } catch { return false }
}
export const SALON_MODE = detect()
