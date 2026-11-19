import { MetalIcon } from '../../MetalIcon'
// Пояснювальний надпис на всю ширину в «бульбашці» з іконкою «i» (метал + глянець).
// tone="warn" — жовта «бульбашка» зі знаком «!» для попереджень.
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
      <MetalIcon name={warn ? 'warn' : 'info'} size={22} square/>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>{children}</div>
    </div>
  )
}
