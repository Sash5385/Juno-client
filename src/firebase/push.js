import { getMessaging, onMessage } from 'firebase/messaging'
import { app, firebaseConfig } from './config'
import { DEMO } from '../demo/demoMode'

// VAPID-ключ навмисно НЕ задаємо: без vapidKey SDK бере ключ за замовчуванням, який працює для будь-якого проєкту.
// Токен пристрою зберігає src/salon/push.js (salons/{salonId}/users/{uid}/fcmTokens).

let messaging = null

export async function getFirebaseSwReg() {
  if (!('serviceWorker' in navigator)) return undefined
  const regs = await navigator.serviceWorker.getRegistrations()
  // Унікальний scope, щоб SW пушів не конфліктував із sw.js від VitePWA (обидва за замовчуванням на /)
  const existing = regs.find(r => r.scope?.includes('firebase-push'))
  if (existing) return existing
  // Конфіг Firebase-проєкту передаємо SW у query — у файлі нічого не зашито
  return navigator.serviceWorker.register('/firebase-messaging-sw.js?c=' + encodeURIComponent(JSON.stringify(firebaseConfig)), { scope: '/firebase-push/' })
}

export function initMessaging() {
  if (DEMO) return null // демо: без push і запиту дозволу на сповіщення
  if (!('Notification' in window)) {
    console.warn('Браузер не підтримує сповіщення')
    return null
  }
  if (!messaging) {
    messaging = getMessaging(app)
  }
  return messaging
}

export function onForegroundMessage(callback) {
  const msg = initMessaging()
  if (!msg) return () => {}
  return onMessage(msg, callback)
}
