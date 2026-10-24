import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { initErrorReporter } from './errorReporter.js'
import { applyUiScale, readScale } from './hooks/useTheme'
import { SALON_MODE } from './salon/env.js'
import './styles/tokens.css'
import './styles/global.css'
import './styles/palettes.css'

initErrorReporter()
applyUiScale(readScale()) // масштаб інтерфейсу (Профіль → Розмір інтерфейсу) — до першого рендеру

// Після деплою старі файли застосунку зникають із сервера: відкрита (або закешована) стара версія просить «чанк», якого вже немає,
// і замість JS отримує index.html (помилка «text/html is not a valid JavaScript MIME type»). Тоді просто перезавантажуємо сторінку
// на нову версію. Один раз за 30 с, щоб не зациклитись, якщо сервер справді недоступний.
window.addEventListener('vite:preloadError', (e) => {
  try {
    const last = Number(sessionStorage.getItem('dp_chunk_reload') || 0)
    if (Date.now() - last < 30000) return
    sessionStorage.setItem('dp_chunk_reload', String(Date.now()))
  } catch { /* сховище недоступне */ }
  // preventDefault тут не викликаємо: інакше import() повертає undefined і React.lazy падає з «reading 'default'»
  window.location.reload()
})

// Режим салону (src/salon, VITE_APP_MODE=salon або ?app=salon) — окремий чанк; без нього нічого не змінюється
const SalonApp = SALON_MODE ? lazy(() => import('./salon/index.jsx')) : null

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {SalonApp ? <Suspense fallback={null}><SalonApp /></Suspense> : <App />}
    </BrowserRouter>
  </React.StrictMode>,
)
