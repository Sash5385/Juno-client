// Показується замість форми запису, коли підписка майстра не оплачена (режим читання)
export default function BookingPaused() {
  return (
    <div style={{
      margin: '24px 4px', padding: '22px 18px', borderRadius: 16, textAlign: 'center',
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
      color: 'var(--text)',
    }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>⏸️</div>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Запис тимчасово недоступний</div>
      <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>
        Майстер зараз не приймає нові записи. Ваші заплановані записи можна переглянути у вкладці «Мої записи».
        За потреби зв'яжіться з майстром.
      </div>
    </div>
  )
}
