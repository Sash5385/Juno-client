import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { set } from 'firebase/database'
import { app } from './config'
import { iRef } from './db'

// VAPID-ключ навмисно НЕ задаємо: раніше тут стояв ключ проєкту ID4, а DrivePad працює на
// іншому проєкті (drivepad-86fe1) — Firebase відхиляв getToken, токени учнів не
// зберігались. Без vapidKey SDK бере ключ за замовчуванням, який працює для будь-якого проєкту.

let messaging = null

// Стабільний id цього браузера/пристрою — щоб токени з різних пристроїв
// (ПК і телефон одного учня) не перезаписували один одного в БД.
function getDeviceId() {
  const KEY = 'id4_device_id'
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  }
}

export async function getFirebaseSwReg() {
  if (!('serviceWorker' in navigator)) return undefined
  const regs = await navigator.serviceWorker.getRegistrations()
  // Use a unique scope to avoid conflict with VitePWA's sw.js (both default to scope /)
  // Without a unique scope, Firebase SW stays in "waiting" and push events go to VitePWA SW
  const existing = regs.find(r => r.scope?.includes('firebase-push'))
  if (existing) return existing
  return navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/firebase-push/' })
}

export function initMessaging() {
  if (!('Notification' in window)) {
    console.warn('Браузер не підтримує сповіщення')
    return null
  }
  if (!messaging) {
    messaging = getMessaging(app)
  }
  return messaging
}

export async function requestNotificationPermission(uid) {
  const msg = initMessaging()
  if (!msg) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  try {
    const swReg = await getFirebaseSwReg()
    const token = await getToken(msg, { ...(swReg ? { serviceWorkerRegistration: swReg } : {}) })
    if (token && uid) {
      const deviceId = getDeviceId()
      await set(iRef(`users/${uid}/fcmTokens/${deviceId}`), token)
      await set(iRef(`studentTokens/${uid}/${deviceId}`), token)
    }
    return token
  } catch (e) {
    console.error('FCM token error:', e)
    return null
  }
}

export function onForegroundMessage(callback) {
  const msg = initMessaging()
  if (!msg) return () => {}
  return onMessage(msg, callback)
}
