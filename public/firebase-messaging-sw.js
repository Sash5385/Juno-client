// firebase-messaging-sw.js
// Кладеться в /public/ — Firebase повинен мати доступ за URL /firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js')

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => self.clients.claim())

firebase.initializeApp({
  apiKey: "AIzaSyAJFqq9jMrc2RgkceappeGt9EJ2bM2xKBI",
  authDomain: "drivepad-86fe1.firebaseapp.com",
  databaseURL: "https://drivepad-86fe1-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "drivepad-86fe1",
  storageBucket: "drivepad-86fe1.firebasestorage.app",
  messagingSenderId: "221725287898",
  appId: "1:221725287898:web:59ee63287a825801104ce3"
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  // Раніше тут була перевірка "чи є видима вкладка" з раннім return — але
  // Firebase SDK і так сам розводить foreground (onMessage) і фонові
  // (onBackgroundMessage) повідомлення; ця додаткова перевірка based on
  // client.visibilityState на Android/PWA часто застаріла (вкладка у фоні,
  // а visibilityState ще "visible"), і сповіщення тихо не показувалось
  // узагалі — ні тут, ні у foreground-обробнику (бо JS вкладки не активний).
  // Data-only push (без top-level/webpush "notification") — payload.notification
  // тут завжди undefined, тому title/body й досі бралися з нього ніколи не
  // існуючого поля, і фонове сповіщення завжди показувалось порожнім.
  const title = payload.data?.title || 'DrivePad'
  const url = payload.data?.url || 'https://drivepad-client.web.app/cabinet'
  const options = {
    body: payload.data?.body || '',
    icon: '/icon-192.png',
    badge: '/badge-dp.png', // монохромний «DP» для шторки сповіщень
    // Унікальний tag — з тим самим сталим tag кожне наступне повідомлення
    // (напр. друге в чаті поспіль) тихо замінює попереднє сповіщення без
    // нового звуку/вібрації на деяких Android/Chrome.
    tag: payload.data?.tag || ('drivepad-notif-' + Date.now()),
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { url, ...(payload.data || {}) },
  }
  self.registration.showNotification(title, options)
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const data = e.notification.data || {}
  const target = data.url || 'https://drivepad-client.web.app/cabinet'
  const fullUrl = target.startsWith('http') ? target : ('https://drivepad-client.web.app' + target)
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith('https://drivepad-client.web.app') && 'focus' in c) {
          c.focus()
          return c.navigate(fullUrl)
        }
      }
      if (clients.openWindow) return clients.openWindow(fullUrl)
    })
  )
})
