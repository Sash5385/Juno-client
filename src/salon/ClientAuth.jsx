// Вхід клієнта (SMS, email, Google) і анкета (ім'я, телефон, згода) — вбудовується в запис і кабінет
import { useState, useEffect, useRef } from 'react'
import { set } from 'firebase/database'
import { sendSmsCode, verifySmsCode, resetRecaptcha, getSmsErrorMessage, renderRecaptcha, isIOSDevice, isInAppBrowser } from '../firebase/auth'
import { signInWithEmail, signUpWithEmail, sendPasswordReset, signInWithGoogle, getGoogleRedirectResult } from '../firebase/auth-email'
import { normalizePhone } from '../utils/format'
import { useSalon } from './ctx'
import { sref } from './data'
import { Btn, Chip, Field } from './kit'

const iosDevice = isIOSDevice()
const iosStandalone = iosDevice && (window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches)

const emailError = (code) => ({
  'auth/wrong-password': 'Невірний email або пароль', 'auth/invalid-credential': 'Невірний email або пароль', 'auth/user-not-found': 'Акаунт з таким email не знайдено',
  'auth/email-already-in-use': 'Email вже використовується — спробуйте увійти', 'auth/invalid-email': 'Невірний формат email', 'auth/too-many-requests': 'Забагато спроб. Спробуйте пізніше',
  'auth/weak-password': 'Пароль занадто простий (мінімум 6 символів)',
})[code] || 'Помилка. Перевірте дані й спробуйте ще раз'

export default function ClientAuth() {
  const { user, uProfile, uProfileReady } = useSalon()
  if (user && !uProfileReady) return null
  if (user && !uProfile) return <ProfileStep />
  return <LoginSteps />
}

function LoginSteps() {
  const [mode, setMode] = useState('sms') // sms | email-login | email-register
  const [step, setStep] = useState('phone')
  const [phoneInput, setPhoneInput] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [timer, setTimer] = useState(0)
  const [captcha, setCaptcha] = useState(!iosDevice)
  const codeRef = useRef(null)

  useEffect(() => {
    if (step !== 'phone' || mode !== 'sms') return
    const onSolved = iosDevice ? () => setCaptcha(true) : null
    renderRecaptcha('recaptcha-container', onSolved, null).catch((e) => iosDevice && setError(getSmsErrorMessage(e.code)))
  }, [step, mode])
  useEffect(() => { if (timer > 0) { const t = setTimeout(() => setTimer(timer - 1), 1000); return () => clearTimeout(t) } }, [timer])
  useEffect(() => { if (step === 'sms') codeRef.current?.focus() }, [step])
  useEffect(() => { getGoogleRedirectResult().catch((e) => setError('Не вдалось увійти через Google' + (e?.code ? ` (${e.code})` : ''))) }, [])

  const sendCode = async () => {
    setError('')
    const n = normalizePhone('+380' + phoneInput)
    if (!n) { setError('Введіть коректний номер'); return }
    setBusy(true)
    try { await sendSmsCode(n); setPhone(n); setStep('sms'); setTimer(45) }
    catch (e) { setError(getSmsErrorMessage(e.code)); await resetRecaptcha(); renderRecaptcha('recaptcha-container', iosDevice ? () => setCaptcha(true) : null, null).catch(() => {}) }
    finally { setBusy(false) }
  }
  const verify = async () => {
    setError('')
    if (code.length !== 6) { setError('Введіть 6-значний код'); return }
    setBusy(true)
    try { await verifySmsCode(code) } catch { setError('Невірний код') } finally { setBusy(false) }
  }
  const emailAuth = async () => {
    setError('')
    if (!email || !password) { setError('Заповніть обидва поля'); return }
    setBusy(true)
    try { mode === 'email-register' ? await signUpWithEmail(email.trim(), password) : await signInWithEmail(email.trim(), password) }
    catch (e) { setError(emailError(e.code)) } finally { setBusy(false) }
  }
  const google = async () => {
    setError(''); setBusy(true)
    try { await signInWithGoogle() }
    catch (e) { if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') setError('Не вдалось увійти через Google' + (e?.code ? ` (${e.code})` : '')) }
    finally { setBusy(false) }
  }
  const reset = async () => {
    if (!email) { setError('Введіть email для відновлення пароля'); return }
    try { await sendPasswordReset(email.trim()); setError('Лист для відновлення надіслано') } catch { setError('Не вдалося надіслати лист') }
  }

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Увійдіть, щоб завершити запис</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <Chip active={mode === 'sms'} onClick={() => { setMode('sms'); setStep('phone'); setError('') }}>📱 SMS</Chip>
        <Chip active={mode !== 'sms'} onClick={() => { setMode('email-login'); setError('') }}>✉️ Email</Chip>
      </div>
      {mode === 'sms' && step === 'phone' && (
        <>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--faint)', letterSpacing: 0.8, marginBottom: 5 }}>ТЕЛЕФОН</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ padding: '12px 12px', borderRadius: 12, background: 'var(--bg-deep)', border: '1px solid var(--border)', fontWeight: 700 }}>+380</div>
              <input value={phoneInput} onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="671234567" autoComplete="tel-national"
                style={{ flex: 1, minWidth: 0, background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 13px', color: 'var(--text)', fontSize: 15, outline: 'none', fontFamily: 'inherit' }} />
            </div>
          </label>
          <div id="recaptcha-container" style={{ marginBottom: 10 }} />
          <Btn onClick={sendCode} disabled={busy || phoneInput.length < 9 || !captcha}>{busy ? 'Надсилаю…' : 'Отримати код'}</Btn>
        </>
      )}
      {mode === 'sms' && step === 'sms' && (
        <>
          <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 10 }}>Код надіслано на {phone}</div>
          <Field label="Код з SMS" value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" onKeyDown={(e) => e.key === 'Enter' && verify()} />
          <Btn onClick={verify} disabled={busy || code.length !== 6}>{busy ? 'Перевіряю…' : 'Підтвердити'}</Btn>
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12.5, color: 'var(--dim)' }}>
            {timer > 0 ? `Повторно через ${timer} с` : <button onClick={() => { setStep('phone'); setCode(''); resetRecaptcha() }} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Змінити номер / надіслати ще раз</button>}
          </div>
        </>
      )}
      {mode !== 'sms' && (
        <>
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
          <Field label="Пароль" type="password" value={password} onChange={setPassword} autoComplete={mode === 'email-register' ? 'new-password' : 'current-password'} onKeyDown={(e) => e.key === 'Enter' && emailAuth()} />
          <Btn onClick={emailAuth} disabled={busy}>{busy ? 'Зачекайте…' : mode === 'email-register' ? 'Зареєструватись' : 'Увійти'}</Btn>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12.5 }}>
            <button onClick={() => { setMode(mode === 'email-register' ? 'email-login' : 'email-register'); setError('') }} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{mode === 'email-register' ? 'Уже є акаунт' : 'Створити акаунт'}</button>
            {mode === 'email-login' && <button onClick={reset} style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>Забули пароль?</button>}
          </div>
        </>
      )}
      {!iosStandalone && !isInAppBrowser() && <div style={{ marginTop: 14 }}><Btn variant="ghost" onClick={google} disabled={busy}>Увійти через Google</Btn></div>}
      {error && <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--accent)', textAlign: 'center' }}>{error}</div>}
    </div>
  )
}

function ProfileStep() {
  const { salonId, user, profile, payment } = useSalon()
  const [name, setName] = useState(user.displayName || '')
  const [phone, setPhone] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const needPhone = !user.phoneNumber
  const hours = payment.cancelFreeHours ?? 24
  const save = async () => {
    setError('')
    if (!name.trim()) { setError("Вкажіть ім'я"); return }
    const p = user.phoneNumber || normalizePhone('+380' + phone)
    if (!p) { setError('Вкажіть коректний номер телефону'); return }
    if (!agree) { setError('Підтвердіть умови'); return }
    setBusy(true)
    try { await set(sref(salonId, `users/${user.uid}/profile`), { name: name.trim(), phone: p, termsAccepted: true, createdAt: Date.now() }) }
    catch { setError('Не вдалось зберегти. Спробуйте ще раз') } finally { setBusy(false) }
  }
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Кілька слів про вас</div>
      <Field label="Ім'я" value={name} onChange={setName} autoComplete="name" />
      {needPhone && <Field label="Телефон (+380)" value={phone} onChange={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="671234567" />}
      <label style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, margin: '4px 0 12px', cursor: 'pointer' }}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 2 }} />
        <span>Погоджуюсь з умовами запису в «{profile.name || 'салоні'}»: безкоштовне скасування — не пізніше ніж за {hours} год до візиту{payment.enabled ? '; передоплата за пізнє скасування не повертається' : ''}.</span>
      </label>
      {error && <div style={{ marginBottom: 10, fontSize: 12.5, color: 'var(--accent)' }}>{error}</div>}
      <Btn onClick={save} disabled={busy}>{busy ? 'Зберігаю…' : 'Продовжити'}</Btn>
    </div>
  )
}
