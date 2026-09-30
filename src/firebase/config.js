import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

// Беремо з .env (Vite автоматично підставляє import.meta.env.VITE_*)
// Якщо .env немає — fallback на дефолти (треба підставити вручну)
// iPhone (Safari/ярлик) блокує сховище між різними доменами: вхід через Google робить
// редірект на drivepad-86fe1.firebaseapp.com і назад на drivepad-client.web.app, а результат
// входу лишається в "чужому" сховищі — користувач повертається невійшовшим. Firebase Hosting
// віддає /__/auth/handler на КОЖНОМУ домені сайту, тож на iOS робимо authDomain тим самим,
// що й у сайту (same-origin). Потрібно один раз додати
// https://drivepad-client.web.app/__/auth/handler в Authorized redirect URIs OAuth-клієнта
// (Google Cloud Console → Credentials). На інших платформах — як раніше.
function defaultAuthDomain() {
  const fallback = 'drivepad-86fe1.firebaseapp.com'
  try {
    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const host = window.location.host
    if (ios && /\.(web\.app|firebaseapp\.com)$/.test(host)) return host
  } catch {}
  return fallback
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAJFqq9jMrc2RgkceappeGt9EJ2bM2xKBI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaultAuthDomain(),
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://drivepad-86fe1-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "drivepad-86fe1",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "drivepad-86fe1.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "221725287898",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:221725287898:web:59ee63287a825801104ce3"
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getDatabase(app)
