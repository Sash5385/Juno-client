import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { SALON_MODE } from './salon/env.js'
import { initErrorReporter } from './errorReporter.js'
import { initI18n } from './i18n/index.js'
import { startLangSync } from './i18n/syncLang.js'
import { applyUiScale, readScale } from './hooks/useTheme'
import './styles/tokens.css'
import './styles/global.css'
import './styles/palettes.css'

// Режим салону (VITE_APP_MODE=salon або ?app=salon) — окремий чанк; без нього нічого не змінюється
const SalonApp = SALON_MODE ? lazy(() => import('./salon/index.jsx')) : null

initErrorReporter()
initI18n()
startLangSync()
applyUiScale(readScale()) // масштаб інтерфейсу (Профіль → Розмір інтерфейсу) — до першого рендеру

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      {SalonApp ? <Suspense fallback={null}><SalonApp /></Suspense> : <App />}
    </BrowserRouter>
  </React.StrictMode>,
)
