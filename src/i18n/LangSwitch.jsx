import { LANGS, LANG_NAMES, getLang, setLang } from './index.js'

// Перемикач мови інтерфейсу (зберігається в localStorage, сторінка перезавантажується)
export default function LangSwitch({ style }) {
  return (
    <select
      data-no-i18n
      aria-label="Language"
      value={getLang()}
      onChange={(e) => setLang(e.target.value)}
      style={{ font: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', minHeight: 44, cursor: 'pointer', ...style }}
    >
      {LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
    </select>
  )
}
