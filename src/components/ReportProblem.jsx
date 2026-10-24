import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useBackClose } from '../hooks/useBackButton'
import { auth } from '../firebase/config'
import { DEMO } from '../demo/demoMode'
import { APP_VERSION } from '../version.js'

// «Щось не працює?»: учень описує проблему текстом, звернення йде власнику сервісу (суперадмінка → «Звернення»).
// Відкривається подією з кнопки в Профілі.
export const REPORT_PROBLEM_EVENT = 'dp-report-problem'
export const openReportProblem = () => window.dispatchEvent(new Event(REPORT_PROBLEM_EVENT))

function ReportDialog({ onClose }) {
  useBackClose(true, onClose)
  const [text, setText] = useState('')
  const [state, setState] = useState('idle') // idle | sending | done | error
  const ok = text.trim().length >= 5

  const send = async () => {
    if (!ok || state === 'sending') return
    setState('sending')
    try {
      if (DEMO) { await new Promise(r => setTimeout(r, 400)); setState('done'); return }
      const token = await auth.currentUser?.getIdToken().catch(() => null)
      const r = await fetch('/api/report-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ app: 'client', message: text.trim(), page: location.pathname, version: APP_VERSION, ua: navigator.userAgent }),
      })
      if (r.status === 429) { setState('rate'); return }
      setState(r.ok ? 'done' : 'error')
    } catch { setState('error') }
  }

  return createPortal(
    <div className="dialog-backdrop show" style={{ zIndex: 240 }} onClick={e => e.target.classList.contains('dialog-backdrop') && onClose()}>
      <div className="dialog">
        <div className="dialog-handle" />
        {state === 'done' ? (
          <>
            <div style={{ textAlign: 'center', fontSize: 42, lineHeight: 1 }}>✅</div>
            <div className="dialog-title" style={{ textAlign: 'center', margin: '10px 0 6px' }}>Дякуємо!</div>
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>Ми отримали ваше повідомлення і розберемось якнайшвидше.</div>
            <div className="dialog-actions" style={{ marginTop: 16 }}>
              <button className="dialog-btn primary" onClick={onClose}>Закрити</button>
            </div>
          </>
        ) : (
          <>
            <div className="dialog-title" style={{ fontSize: 17, margin: '4px 0 6px' }}>🛠 Щось не працює?</div>
            <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 10 }}>Опишіть, що саме пішло не так: на якому екрані і що ви натискали. Повідомлення одразу піде розробнику.</div>
            <textarea
              value={text} onChange={e => setText(e.target.value)} maxLength={2000} rows={6} autoFocus
              placeholder="Наприклад: на екрані «Записатись» не з’являється вільний час…"
              style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 120, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.25)', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', outline: 'none' }}
            />
            {(state === 'error' || state === 'rate') && (
              <div style={{ color: '#ff6a4d', fontSize: 12.5, marginTop: 8 }}>{state === 'rate' ? "Забагато повідомлень. Спробуйте трохи пізніше." : "Не вдалося надіслати. Перевірте інтернет і спробуйте ще раз."}</div>
            )}
            <div className="dialog-actions" style={{ marginTop: 14 }}>
              <button className="dialog-btn secondary" onClick={onClose}>Скасувати</button>
              <button className="dialog-btn primary" onClick={send} disabled={!ok || state === 'sending'} style={{ opacity: ok ? 1 : 0.45 }}>{state === 'sending' ? "Надсилаємо…" : "Надіслати"}</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

// Монтується в кабінеті один раз
export default function ReportProblem() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const on = () => setOpen(true)
    window.addEventListener(REPORT_PROBLEM_EVENT, on)
    return () => window.removeEventListener(REPORT_PROBLEM_EVENT, on)
  }, [])
  if (!open) return null
  return <ReportDialog onClose={() => setOpen(false)} />
}
