import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { initErrorReporter } from './errorReporter.js'
import { initI18n } from './i18n/index.js'
import './styles/tokens.css'
import './styles/global.css'
import './styles/palettes.css'

initErrorReporter()
initI18n()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
