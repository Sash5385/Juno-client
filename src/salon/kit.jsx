// Дрібні UI-елементи клієнта салону на CSS-змінних tokens.css (темна/світла теми працюють самі)
import { useState, useCallback } from 'react'
import { fromYMD } from '../utils/salonLogic'

const WD = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
const MON = ['січ.', 'лют.', 'бер.', 'кві.', 'тра.', 'чер.', 'лип.', 'сер.', 'вер.', 'жов.', 'лис.', 'гру.']
export const dateLabel = (ymd) => { const d = fromYMD(ymd); return `${WD[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}` }
export const money = (n) => `${Math.round((Number(n) || 0) * 100) / 100} ₴`
export const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'

export function Spinner() { return <div style={{ display: 'flex', justifyContent: 'center', padding: 28 }}><div className="spinner" /></div> }
export function Empty({ icon = '🗓', text }) { return <div style={{ textAlign: 'center', padding: '30px 14px', color: 'var(--dim)', fontSize: 13 }}><div style={{ fontSize: 32, marginBottom: 6 }}>{icon}</div>{text}</div> }

export function Card({ children, style, onClick }) {
  return <div onClick={onClick} style={{ background: 'linear-gradient(155deg,var(--surf-hi),var(--surface))', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow)', overflow: 'hidden', cursor: onClick ? 'pointer' : 'default', ...style }}>{children}</div>
}
export function Btn({ children, onClick, variant = 'primary', disabled, style, danger }) {
  const primary = variant === 'primary' && !disabled
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      width: '100%', padding: '13px 14px', borderRadius: 14, border: primary ? 'none' : '1px solid var(--border)', cursor: disabled ? 'default' : 'pointer',
      fontSize: 14, fontWeight: 800, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      background: primary ? 'linear-gradient(145deg,var(--acc-hi),var(--accent))' : 'var(--surface)', color: primary ? '#fff' : danger ? 'var(--accent)' : disabled ? 'var(--faint)' : 'var(--dim)',
      boxShadow: primary ? '0 6px 18px rgba(255,90,60,0.3)' : 'none', ...style,
    }}>{children}</button>
  )
}
export function Chip({ active, onClick, children, disabled, style }) {
  return <button onClick={disabled ? undefined : onClick} style={{ padding: '9px 13px', borderRadius: 11, border: active ? '1px solid var(--accent)' : '1px solid var(--border)', cursor: disabled ? 'default' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
    background: active ? 'color-mix(in srgb, var(--accent) 22%, transparent)' : 'var(--surface)', color: active ? 'var(--accent)' : disabled ? 'var(--faint)' : 'var(--text)', opacity: disabled ? 0.6 : 1, ...style }}>{children}</button>
}
export function Pill({ label, color }) {
  return <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 800, color, background: `color-mix(in srgb, ${color} 17%, transparent)`, whiteSpace: 'nowrap' }}>{label}</span>
}
export function Field({ label, value, onChange, type = 'text', placeholder, textarea, rows = 3, autoComplete, onKeyDown, inputMode }) {
  const base = { width: '100%', background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 13px', color: 'var(--text)', fontSize: 15, outline: 'none', fontFamily: 'inherit' }
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      {label && <div style={{ fontSize: 11, color: 'var(--faint)', letterSpacing: 0.8, marginBottom: 5, textTransform: 'uppercase' }}>{label}</div>}
      {textarea ? <textarea value={value} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{ ...base, resize: 'vertical' }} />
        : <input type={type} value={value} placeholder={placeholder} autoComplete={autoComplete} inputMode={inputMode} onKeyDown={onKeyDown} onChange={(e) => onChange(e.target.value)} style={base} />}
    </label>
  )
}

// Нижній лист (sheet) / повноекранний шар
export function Sheet({ onClose, title, children, footer, full }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: full ? '96dvh' : '90dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg-deep)', borderRadius: '22px 22px 0 0', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px 10px', flexShrink: 0 }}>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>{title}</div>
          <button onClick={onClose} aria-label="Закрити" style={{ width: 30, height: 30, borderRadius: 9, border: 'none', background: 'var(--surface)', color: 'var(--dim)', fontSize: 15, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 18px 18px' }}>{children}</div>
        {footer && <div style={{ padding: '10px 18px calc(14px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>
  )
}

export function Confirm({ title, text, yes = 'Так', no = 'Ні', danger, onYes, onNo }) {
  return <Sheet onClose={onNo} title={title} footer={<><Btn variant="ghost" onClick={onNo}>{no}</Btn><Btn danger={danger} onClick={onYes}>{yes}</Btn></>}><div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{text}</div></Sheet>
}

export function useToastLite() {
  const [msg, setMsg] = useState(null)
  const show = useCallback((text, kind = 'ok') => { setMsg({ text, kind }); setTimeout(() => setMsg(null), 3400) }, [])
  const el = msg ? (
    <div style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(env(safe-area-inset-bottom,0px) + 86px)', zIndex: 500, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ background: 'var(--surface)', color: msg.kind === 'err' ? 'var(--accent)' : 'var(--green)', borderLeft: `3px solid ${msg.kind === 'err' ? 'var(--accent)' : 'var(--green)'}`, borderRadius: 12, padding: '11px 15px', fontSize: 13, fontWeight: 700, boxShadow: 'var(--shadow)', maxWidth: 420 }}>{msg.text}</div>
    </div>
  ) : null
  return [el, show]
}

// Аватар: фото (URL) або ініціали на кольоровому тлі
export function Avatar({ url, name, size = 44, radius = 14, color = 'var(--blue)', style = {} }) {
  const box = { width: size, height: size, borderRadius: radius, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }
  if (url) return <div style={box}><img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
  return <div style={{ ...box, background: `color-mix(in srgb, ${color} 22%, transparent)`, color, fontWeight: 900, fontSize: Math.round(size * 0.36) }}>{initials(name)}</div>
}
