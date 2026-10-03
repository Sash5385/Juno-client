import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { initErrorReporter } from './errorReporter.js'
import { SALON_MODE } from './salon/env.js'
import './styles/tokens.css'
import './styles/global.css'
import './styles/palettes.css'

initErrorReporter()

// Режим салону (src/salon, VITE_APP_MODE=salon або ?app=salon) — окремий чанк; без нього нічого не змінюється
const SalonApp = SALON_MODE ? lazy(() => import('./salon/index.jsx')) : null

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {SalonApp ? <Suspense fallback={null}><SalonApp /></Suspense> : <App />}
    </BrowserRouter>
  </React.StrictMode>,
)
