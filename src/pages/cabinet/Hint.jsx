// Пояснювальний надпис на всю ширину в «бульбашці» з іконкою «i» (метал + глянець).
// tone="warn" — жовта «бульбашка» зі знаком «!» для попереджень.
const I = <><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="7.5" x2="12" y2="7.6"/></>
const W = <><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17.01"/></>

export default function Hint({ children, style = {}, tone }) {
  const warn = tone === 'warn'
  return (
    <div style={{
      width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'flex-start', gap: 9,
      padding: '11px 12px', borderRadius: 14, fontSize: 12.5, lineHeight: 1.45, color: 'var(--dim)', textAlign: 'left',
      background: warn ? 'rgba(245,158,11,0.12)' : 'color-mix(in srgb, var(--text) 6%, transparent)',
      border: warn ? '1px solid rgba(245,158,11,0.38)' : '1px solid color-mix(in srgb, var(--text) 10%, transparent)',
      ...style,
    }}>
      <span style={{
        width: 22, height: 22, flexShrink: 0, borderRadius: 7, position: 'relative', overflow: 'hidden',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(145deg,#fbfcfe,#a3abba 45%,#eef1f6 55%,#7a8394)',
        boxShadow: '0 2px 5px rgba(0,0,0,0.4),inset 0 1px 0 #fff,inset 0 -2px 3px rgba(0,0,0,0.2)',
      }}>
        <span style={{ position: 'absolute', left: '6%', right: '6%', top: '4%', height: '46%', borderRadius: '40% 40% 60% 60%/60% 60% 40% 40%', background: 'linear-gradient(180deg,rgba(255,255,255,0.85),rgba(255,255,255,0.05))' }}/>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={warn ? '#b45309' : '#2563eb'} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative' }}>{warn ? W : I}</svg>
      </span>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>{children}</div>
    </div>
  )
}
