import { useEffect, useState } from 'react'

// Палітри оформлення (styles/palettes.css). Режим (темний/світлий) — окремо, кнопка в шапці.
export const PALETTES = [
  { id: 'neon',  name: 'Неон-ніч', colors: ['#ff3d9a', '#22d3ee', '#8b5cf6'], bg: { dark: '#0a0614', light: '#f6f0ff' } },
  { id: 'ocean', name: 'Океан',    colors: ['#14b8a6', '#0ea5e9', '#6366f1'], bg: { dark: '#04121c', light: '#eaf6fb' } },
  // Початкове оформлення: без перекриттів, діють базові стилі (tokens.css) і скляні кнопки шапки
  { id: 'classic', name: 'Класична', colors: ['#ff5a3c', '#7ed957', '#5b9bff'], bg: { dark: '#1c1d21', light: '#f0f1f5' } },
]
const DEFAULT_PALETTE = 'neon'
const PALETTE_EVENT = 'dp-palette'

// Масштаб інтерфейсу: Мін / Середній / Макс (CSS zoom вмісту кабінету, зберігається в браузері)
export const UI_SCALES = [
  { id: 's', name: 'Мін',     zoom: 0.9 },
  { id: 'm', name: 'Середній', zoom: 1 },
  { id: 'l', name: 'Макс',    zoom: 1.15 },
]
const SCALE_EVENT = 'dp-scale'
export function readScale() {
  try {
    const v = localStorage.getItem('uiScale')
    return UI_SCALES.some(x => x.id === v) ? v : 'm'
  } catch { return 'm' }
}
export function applyUiScale(id) {
  const z = UI_SCALES.find(x => x.id === id)?.zoom || 1
  document.documentElement.style.setProperty('--ui-zoom', String(z)) // застосовується до вмісту кабінету (.cab-content); шапка й нижня панель не змінюються
}

function readPalette() {
  try {
    const p = localStorage.getItem('palette')
    return PALETTES.some(x => x.id === p) ? p : DEFAULT_PALETTE
  } catch { return DEFAULT_PALETTE }
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || saved === 'light') return saved
    return 'dark'
  })
  const [palette, setPaletteState] = useState(readPalette)
  const [uiScale, setUiScaleState] = useState(readScale)

  useEffect(() => {
    const onScale = (e) => setUiScaleState(e.detail)
    window.addEventListener(SCALE_EVENT, onScale)
    return () => window.removeEventListener(SCALE_EVENT, onScale)
  }, [])
  useEffect(() => {
    applyUiScale(uiScale)
    try { localStorage.setItem('uiScale', uiScale) } catch { /* сховище недоступне */ }
  }, [uiScale])

  // Кілька компонентів викликають useTheme — тримаємо палітру в синхроні подією
  useEffect(() => {
    const onChange = (e) => setPaletteState(e.detail)
    window.addEventListener(PALETTE_EVENT, onChange)
    return () => window.removeEventListener(PALETTE_EVENT, onChange)
  }, [])

  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
    document.documentElement.setAttribute('data-palette', palette)
    const bg = PALETTES.find(x => x.id === palette)?.bg[theme]
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', bg || (theme === 'dark' ? '#1c1d21' : '#f0f1f5'))
    try { localStorage.setItem('theme', theme); localStorage.setItem('palette', palette) } catch { /* сховище недоступне */ }
  }, [theme, palette])

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  const setPalette = (id) => {
    if (!PALETTES.some(x => x.id === id)) return
    setPaletteState(id)
    window.dispatchEvent(new CustomEvent(PALETTE_EVENT, { detail: id }))
  }

  const setUiScale = (id) => {
    if (!UI_SCALES.some(x => x.id === id)) return
    setUiScaleState(id)
    window.dispatchEvent(new CustomEvent(SCALE_EVENT, { detail: id }))
  }

  return { theme, toggle, setTheme, palette, setPalette, uiScale, setUiScale }
}
