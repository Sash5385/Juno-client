// Виклики HTTP-функцій салону (functions/salon/*) з ID-токеном клієнта. У демо — заглушки.
import { auth } from '../firebase/config'
import { DEMO } from '../demo/demoMode'
import { FUNCTIONS_BASE } from './env'

const base = () => FUNCTIONS_BASE || `https://europe-west1-${auth.app.options.projectId}.cloudfunctions.net`

export const ERR_TEXT = {
  unauthorized: 'Увійдіть знову', forbidden: 'Немає доступу', booking_not_found: 'Запис не знайдено', booking_closed: 'Запис уже закрито',
  payments_disabled: 'Онлайн-оплата в цьому салоні недоступна', salon_unavailable: 'Салон тимчасово не приймає записи',
  hold_expired: 'Час на оплату вийшов — запис скасовано. Створіть новий', mode_not_allowed: 'Цей спосіб оплати недоступний',
  deposit_already_paid: 'Передоплату вже внесено', already_paid: 'Запис уже оплачено', no_price: 'Для запису не вказано ціну',
  amount_too_small: 'Сума занадто мала для онлайн-оплати', too_many_attempts: 'Забагато спроб оплати. Спробуйте пізніше',
  monobank_error: 'Платіжний сервіс не відповів. Спробуйте ще раз', bad_mode: 'Невірний спосіб оплати', server: 'Помилка сервера. Спробуйте пізніше',
}

export async function callFn(name, body = {}) {
  if (DEMO) return { pageUrl: '#demo-pay', invoiceId: 'demo', paymentId: 'demo', amount: 0, ok: true }
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw Object.assign(new Error('unauthorized'), { code: 'unauthorized' })
  const r = await fetch(`${base()}/${name}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  let json = {}
  try { json = await r.json() } catch { /* порожня відповідь */ }
  if (!r.ok) throw Object.assign(new Error(json.error || `http_${r.status}`), { code: json.error || `http_${r.status}`, status: r.status })
  return json
}
export const errText = (e) => ERR_TEXT[e?.code] || 'Не вдалося виконати. Спробуйте ще раз.'
