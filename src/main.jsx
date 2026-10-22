import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { initErrorReporter } from './errorReporter.js'
import { initI18n } from './i18n/index.js'
import { startLangSync } from './i18n/syncLang.js'
import './styles/tokens.css'
import './styles/global.css'
import './styles/palettes.css'

initErrorReporter()
initI18n()
startLangSync()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
