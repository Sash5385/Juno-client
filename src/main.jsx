import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import SalonApp from './salon/index.jsx'
import { initErrorReporter } from './errorReporter.js'
import './styles/tokens.css'
import './styles/global.css'
import './styles/palettes.css'

initErrorReporter()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SalonApp />
    </BrowserRouter>
  </React.StrictMode>,
)
