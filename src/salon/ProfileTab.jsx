// Профіль клієнта: дані, сповіщення, тема, вихід
import { useState } from 'react'
import { update } from 'firebase/database'
import { useNavigate } from 'react-router-dom'
import { useSalon } from './ctx'
import { sref } from './data'
import { registerClientPush, pushPermission } from './push'
import { signOut } from '../firebase/auth-email'
import { useTheme } from '../hooks/useTheme'
import { APP_VERSION } from '../version.js'
import { normalizePhone, formatPhone } from '../utils/format'
import { callFn, errText } from './api'
import { Btn, Card, Chip, Confirm, Field } from './kit'

export default function ProfileTab() {
  const { salonId, user, uProfile, profile, slug, toast } = useSalon()
  const nav = useNavigate()
  const { theme, toggle } = useTheme()
  const [name, setName] = useState(uProfile?.name || '')
  const [phone, setPhone] = useState(formatPhone(uProfile?.phone || ''))
  const [busy, setBusy] = useState(false)
  const [perm, setPerm] = useState(pushPermission())
  const [ask, setAsk] = useState(false)
  const changed = name.trim() !== (uProfile?.name || '') || phone !== formatPhone(uProfile?.phone || '')
  const save = async () => {
    const p = normalizePhone(phone) || null
    if (!name.trim()) { toast("Вкажіть ім'я", 'err'); return }
    if (!p) { toast('Невірний номер телефону', 'err'); return }
    setBusy(true)
    try { await update(sref(salonId, `users/${user.uid}/profile`), { name: name.trim(), phone: p }); toast('Збережено') } catch { toast('Не вдалося зберегти', 'err') } finally { setBusy(false) }
  }
  const removeAccount = async () => {
    setBusy(true)
    try { await callFn('salonDeleteAccount', { type: 'client' }); toast('Акаунт видалено'); await signOut().catch(() => {}); nav(`/s/${slug}`) }
    catch (e) { toast(errText(e), 'err'); setBusy(false); setAsk(false) }
  }
  const enable = async () => { const ok = await registerClientPush(salonId, user.uid); setPerm(pushPermission()); toast(ok ? 'Сповіщення увімкнено' : 'Не вдалося увімкнути сповіщення', ok ? 'ok' : 'err') }
  return (
    <div>
      <Card style={{ padding: '14px 16px', marginBottom: 12 }}>
        <Field label="Ім'я" value={name} onChange={setName} />
        <Field label="Телефон" value={phone} onChange={setPhone} type="tel" />
        {changed && <Btn onClick={save} disabled={busy}>{busy ? 'Зберігаю…' : 'Зберегти'}</Btn>}
        {user.email && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 8 }}>{user.email}</div>}
      </Card>
      <Card style={{ padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>🔔 Сповіщення</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 10 }}>{perm === 'granted' ? 'Увімкнено на цьому пристрої: підтвердження, нагадування, оплати' : perm === 'denied' ? 'Заблоковано в налаштуваннях браузера' : perm === 'unsupported' ? 'Браузер не підтримує сповіщення' : 'Вимкнено'}</div>
        {perm === 'default' && <Btn onClick={enable}>Увімкнути сповіщення</Btn>}
      </Card>
      <Card style={{ padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Вигляд</div>
        <div style={{ display: 'flex', gap: 8 }}><Chip active={theme === 'dark'} onClick={() => theme !== 'dark' && toggle()}>Темна</Chip><Chip active={theme === 'light'} onClick={() => theme !== 'light' && toggle()}>Світла</Chip></div>
      </Card>
      <Btn variant="ghost" onClick={() => nav(`/s/${slug}`)} style={{ marginBottom: 8 }}>Сторінка салону «{profile.name}»</Btn>
      <Btn variant="ghost" danger onClick={async () => { await signOut(); nav(`/s/${slug}`) }}>Вийти</Btn>
      <Btn variant="ghost" danger onClick={() => setAsk(true)} style={{ marginTop: 8 }}>Видалити акаунт</Btn>
      {ask && <Confirm danger title="Видалити акаунт?" text={'Ваші дані, чати й сповіщення буде видалено в усіх салонах, майбутні записи скасовуються. Скасувати це неможливо.'} yes={busy ? 'Видаляю…' : 'Видалити назавжди'} onYes={() => !busy && removeAccount()} onNo={() => setAsk(false)} />}
      <div style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center', marginTop: 16 }}>Версія {APP_VERSION}</div>
    </div>
  )
}
