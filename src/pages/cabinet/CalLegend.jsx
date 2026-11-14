// Легенда кольорів днів у календарі запису/перенесення: вільно / мало місць / зайнято
const dot = (c) => ({ width: 9, height: 9, borderRadius: '50%', background: c, display: 'inline-block', flexShrink: 0 })
export default function CalLegend() {
  const item = { display: 'inline-flex', alignItems: 'center', gap: 5 }
  return (
    <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '4px 14px', marginTop: 10, fontSize: 11, color: 'var(--dim)' }}>
      <span style={item}><span style={dot('#22c55e')} />Вільно</span>
      <span style={item}><span style={dot('#f59e0b')} />Мало місць</span>
      <span style={item}><span style={dot('#ef4444')} />Зайнято</span>
    </div>
  )
}
