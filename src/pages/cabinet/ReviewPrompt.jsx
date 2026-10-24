import { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { getMyReviews, createReview } from '../../firebase/db'
import { DEMO } from '../../demo/demoMode'

// Відгук просимо після кожних 10 завершених уроків (10, 20, 30…). Для перевірки: адреса з ?testreview=1
// показує запит незалежно від кількості уроків і НІЧОГО не записує в базу (?testreview=0 вимикає).
const TEST_KEY = 'dp_testreview'
function readTestMode() {
  try {
    const q = new URLSearchParams(window.location.search).get('testreview')
    if (q === '1') sessionStorage.setItem(TEST_KEY, '1')
    if (q === '0') sessionStorage.removeItem(TEST_KEY)
    return DEMO || sessionStorage.getItem(TEST_KEY) === '1'
  } catch { return DEMO }
}

const STEP = 10
const LATER_MS = 3 * 24 * 3600 * 1000

// «Ім'я Прізвище» → «Ім'я П.» (на лендингу показуємо без повного прізвища)
function publicName(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "Учень"
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`
}

export function useReviewPrompt(user, profile, bookingsData) {
  const [reviews, setReviews] = useState(null) // null — ще вантажимо
  const [sentNow, setSentNow] = useState(false)
  const [laterTick, setLaterTick] = useState(0)
  const test = readTestMode()
  const uid = user?.uid

  useEffect(() => {
    if (!uid || DEMO) { setReviews([]); return }
    getMyReviews(uid).then(setReviews).catch(() => setReviews([]))
  }, [uid])

  const completedCount = useMemo(
    () => (bookingsData?.completed || []).filter(b => b.status === 'confirmed').length,
    [bookingsData?.completed]
  )
  const milestone = Math.floor(completedCount / STEP) * STEP
  const lastReviewed = (reviews || []).reduce((m, r) => Math.max(m, Number(r.atLessons) || 0), 0)
  const laterKey = `dp_review_later_${uid}_${milestone}`
  const postponed = useMemo(() => {
    try { return Date.now() - Number(localStorage.getItem(laterKey) || 0) < LATER_MS } catch { return false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laterKey, laterTick])

  const due = test || (milestone >= STEP && milestone > lastReviewed && !sentNow)
  const eligible = reviews !== null && due
  const postpone = useCallback(() => {
    try { localStorage.setItem(laterKey, String(Date.now())) } catch { /* сховище недоступне */ }
    setLaterTick(n => n + 1)
  }, [laterKey])

  const submit = useCallback(async ({ rating, text }) => {
    if (test) return { test: true }
    await createReview(uid, { rating, text: (text || '').trim(), studentName: publicName(profile?.name), atLessons: milestone })
    setSentNow(true)
    return { test: false }
  }, [test, uid, profile?.name, milestone])

  return { eligible, postponed, test, completedCount: test ? Math.max(completedCount, STEP) : completedCount, postpone, submit }
}

export function ReviewModal({ onClose, onSubmit, test }) {
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const send = async () => {
    setBusy(true); setErr('')
    try { await onSubmit({ rating, text }); setDone(true) }
    catch { setErr("Не вдалося надіслати відгук. Спробуйте ще раз") }
    finally { setBusy(false) }
  }

  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9700, background:'rgba(0,0,0,0.78)', display:'flex', alignItems:'center', justifyContent:'center', padding:16, boxSizing:'border-box' }}>
      <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:400, background:'var(--bg-deep)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:20, padding:'18px 16px', boxSizing:'border-box', maxHeight:'94dvh', overflowY:'auto' }}>
        {done ? (
          <div style={{ textAlign:'center', padding:'12px 0' }}>
            <div style={{ fontSize:44 }}>🙏</div>
            <div style={{ fontSize:18, fontWeight:800, margin:'8px 0 6px' }}>Дякуємо за відгук!</div>
            <div style={{ fontSize:13, color:'var(--dim)', lineHeight:1.5 }}>
              {test ? "Це тестовий режим: відгук нікуди не збережено." : "Він з'явиться на сторінці інструктора."}
            </div>
            <button onClick={onClose} style={{ marginTop:16, width:'100%', padding:14, borderRadius:14, border:'none', background:'var(--accent)', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>Закрити</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize:18, fontWeight:800, textAlign:'center' }}>Ваш відгук</div>
            <div style={{ fontSize:13, color:'var(--dim)', textAlign:'center', margin:'4px 0 14px', lineHeight:1.4 }}>
              Поставте оцінку і розкажіть, як проходять уроки{test ? " (тестовий режим — нічого не зберігається)" : ''}
            </div>
            <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:14 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} з 5`}
                  style={{ width:48, height:48, fontSize:34, lineHeight:1, background:'none', border:'none', cursor:'pointer', padding:0, color: n <= rating ? 'var(--gold)' : 'var(--faint)' }}>★</button>
              ))}
            </div>
            <textarea value={text} onChange={e => setText(e.target.value.slice(0, 500))} rows={5} placeholder="Ваш відгук (необов'язково)"
              style={{ width:'100%', boxSizing:'border-box', padding:12, borderRadius:12, border:'1px solid var(--border)', background:'var(--surf-lo)', color:'var(--text)', fontSize:15, fontFamily:'inherit', resize:'vertical' }} />
            <div style={{ fontSize:11, color:'var(--faint)', textAlign:'right', margin:'2px 2px 8px' }}>{text.length}/500</div>
            <div style={{ fontSize:11.5, color:'var(--dim)', lineHeight:1.45, marginBottom:12 }}>
              Відгук побачать на сторінці запису інструктора разом із вашим ім'ям та першою літерою прізвища.
            </div>
            {err && <div style={{ color:'#fca5a5', fontSize:13, marginBottom:10 }}>{err}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={onClose} disabled={busy} style={{ flex:1, padding:14, borderRadius:14, border:'1px solid var(--border)', background:'rgba(255,255,255,0.05)', color:'var(--text)', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Скасувати</button>
              <button onClick={send} disabled={busy} style={{ flex:2, padding:14, borderRadius:14, border:'none', background:'var(--accent)', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', fontFamily:'inherit', opacity: busy ? 0.6 : 1 }}>{busy ? "Надсилаю…" : "Надіслати"}</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

// Картка угорі вкладки «Записи»
export function ReviewCard({ prompt }) {
  const [open, setOpen] = useState(false)
  if (!prompt.eligible || (prompt.postponed && !prompt.test)) return null
  return (
    <>
      <div style={{ background:'linear-gradient(135deg,rgba(247,201,72,0.16),rgba(247,201,72,0.06))', border:'1px solid rgba(247,201,72,0.35)', borderRadius:14, padding:'14px', margin:'8px 0', display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ fontSize:30 }}>⭐</span>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:800 }}>Ви пройшли {prompt.completedCount} уроків!</div>
            <div style={{ fontSize:13, color:'var(--dim)', marginTop:2, lineHeight:1.4 }}>Залиште відгук про інструктора: це займе хвилину і допоможе іншим учням</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setOpen(true)} style={{ flex:2, padding:'12px', borderRadius:12, border:'none', background:'var(--gold)', color:'#1a1a1a', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>Залишити відгук</button>
          <button onClick={prompt.postpone} style={{ flex:1, padding:'12px', borderRadius:12, border:'1px solid var(--border)', background:'rgba(255,255,255,0.05)', color:'var(--dim)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Пізніше</button>
        </div>
      </div>
      {open && <ReviewModal test={prompt.test} onClose={() => setOpen(false)} onSubmit={prompt.submit} />}
    </>
  )
}

// Кнопка в «Профілі»
export function ReviewProfileButton({ prompt }) {
  const [open, setOpen] = useState(false)
  if (!prompt.eligible) return null
  return (
    <>
      <div className="profile-section">
        <div className="section-title">⭐ Відгук про інструктора</div>
        <div style={{ fontSize:13, color:'var(--dim)', lineHeight:1.5, marginBottom:10 }}>Ви пройшли {prompt.completedCount} уроків. Поділіться враженнями — відгук побачать інші учні.</div>
        <button onClick={() => setOpen(true)} style={{ width:'100%', padding:14, borderRadius:14, border:'none', background:'var(--gold)', color:'#1a1a1a', fontSize:15, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>Залишити відгук</button>
      </div>
      {open && <ReviewModal test={prompt.test} onClose={() => setOpen(false)} onSubmit={prompt.submit} />}
    </>
  )
}
