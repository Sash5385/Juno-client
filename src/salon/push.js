// Push-токен клієнта: users/{uid}/fcmTokens/{device} (+ clientTokens для розсилок). Сервер шле data-only push (functions/salon/lib.js).
import { set } from 'firebase/database'
import { onMessage } from 'firebase/messaging'
import { initMessaging, getFirebaseSwReg } from '../firebase/push'
import { getToken } from 'firebase/messaging'
import { DEMO } from '../demo/demoMode'
import { sref } from './data'

function deviceId() {
  const KEY = 'juno_device_id'
  try {
    let id = localStorage.getItem(KEY)
    if (!id) { id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); localStorage.setItem(KEY, id) }
    return id
  } catch { return 'd' + Date.now().toString(36) }
}
export const pushPermission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

export async function registerClientPush(salonId, uid) {
  if (DEMO || !uid) return false
  const msg = initMessaging()
  if (!msg) return false
  try {
    if ((await Notification.requestPermission()) !== 'granted') return false
    const swReg = await getFirebaseSwReg()
    const token = await getToken(msg, { ...(swReg ? { serviceWorkerRegistration: swReg } : {}) })
    if (!token) return false
    const dev = deviceId()
    await set(sref(salonId, `users/${uid}/fcmTokens/${dev}`), token)
    await set(sref(salonId, `clientTokens/${uid}/${dev}`), token)
    return true
  } catch (e) { console.warn('salon push:', e.code || e.message); return false }
}
export function onSalonForegroundPush(cb) {
  if (DEMO) return () => {}
  const msg = initMessaging()
  return msg ? onMessage(msg, cb) : () => {}
}
