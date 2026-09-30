// Публічна сторінка "Що таке DrivePad" — показується на голій адресі
// (drivepad-client.web.app без /i/{slug}), коли ще ніхто не переходив за
// посиланням-запрошенням конкретного інструктора. На відміну від екрана
// "недійсне посилання" (App.jsx: коли slug був, але не резолвнувся), тут
// відвідувач просто вперше на домені — потрібен опис сервісу як такого
// (напр. для перевірки мерчанта платіжними системами LiqPay/Monobank).
import { useState } from 'react'

// Витягує slug з введеного коду або повного посилання (…/i/{slug}, …?i={slug}, {slug})
function parseSlug(input) {
  const t = (input || '').trim()
  if (!t) return ''
  const m = t.match(/\/i\/([^/?#\s]+)/) || t.match(/[?&]i=([^&#\s]+)/)
  return decodeURIComponent(m ? m[1] : t.replace(/^\/+|\/+$/g, ''))
}

export default function About() {
  const [code, setCode] = useState('')
  const slug = parseSlug(code)
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px',
      paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))',
      paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))',
      textAlign: 'center',
      fontFamily: 'inherit',
    }}>
      <img src="/icon-192.png" alt="DrivePad" style={{ width: 72, height: 72, borderRadius: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }} />
      <h1 style={{ fontSize: 26, fontWeight: 900, margin: '18px 0 6px', letterSpacing: -0.5 }}>DrivePad</h1>
      <div style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 700, marginBottom: 28 }}>
        Онлайн-запис на уроки водіння
      </div>

      <div style={{ maxWidth: 480, width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--dim)', margin: 0 }}>
          DrivePad — сервіс онлайн-запису для інструкторів з водіння та автошкіл.
          Кожен інструктор отримує власний кабінет для ведення розкладу та персональне
          посилання, яке роздає своїм учням — учні записуються на уроки самостійно,
          без дзвінків і листування.
        </p>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            Як це працює
          </div>
          {[
            'Інструктор веде розклад вільних і зайнятих годин у своєму кабінеті',
            'Учень переходить за персональним посиланням і бачить вільні місця',
            'Запис, перенос і скасування уроку — прямо в застосунку, без дзвінків',
            'Учень і інструктор отримують автоматичні нагадування про урок',
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < 3 ? 10 : 0 }}>
              <div style={{
                flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                background: 'linear-gradient(145deg,var(--acc-hi),var(--accent))',
                color: '#fff', fontSize: 11, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{i + 1}</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>{step}</div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--dim)', margin: 0 }}>
          Якщо у вас є персональне посилання від свого інструктора — перейдіть за ним,
          щоб побачити вільні уроки саме в нього.
        </p>

        {/* Ярлик на екрані Домой (iPhone) має власне сховище і може відкритись без
            посилання інструктора — тут його можна ввести вручну один раз. */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Вже маєте посилання від інструктора?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Вставте посилання або код"
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 }}
            />
            <button
              disabled={!slug}
              onClick={() => { window.location.href = '/i/' + encodeURIComponent(slug) }}
              style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(145deg,var(--acc-hi),var(--accent))', color: '#fff', fontWeight: 800, fontSize: 14, opacity: slug ? 1 : 0.5 }}
            >Відкрити</button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 40, fontSize: 11, color: 'var(--dim)' }}>© {new Date().getFullYear()} DrivePad</div>
    </div>
  )
}
