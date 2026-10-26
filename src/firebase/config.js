import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase, goOffline } from 'firebase/database'
import { DEMO, DEMO_USER } from '../demo/demoMode'

// Беремо з .env (Vite автоматично підставляє import.meta.env.VITE_*)
// Якщо .env немає — fallback на дефолти (треба підставити вручну)
// iPhone (Safari/ярлик) блокує сховище між різними доменами: вхід через Google робить
// редірект на juno-booking.firebaseapp.com і назад на juno-booking-client.web.app, а результат
// входу лишається в "чужому" сховищі — користувач повертається невійшовшим. Firebase Hosting
// віддає /__/auth/handler на КОЖНОМУ домені сайту, тож на iOS робимо authDomain тим самим,
// що й у сайту (same-origin). Потрібно один раз додати
// https://juno-booking-client.web.app/__/auth/handler в Authorized redirect URIs OAuth-клієнта
// (Google Cloud Console → Credentials). На інших платформах — як раніше.
function defaultAuthDomain() {
  const fallback = 'juno-booking.firebaseapp.com'
  try {
    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const host = window.location.host
    if (ios && /\.(web\.app|firebaseapp\.com)$/.test(host)) return host
  } catch {}
  return fallback
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDu4tWzXFZWWlaJGuhlibDKz1U96Uk3Q74",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaultAuthDomain(),
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://juno-booking-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "juno-booking",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "juno-booking.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "852885730629",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:852885730629:web:9a8f34b87d2538541cba2c"
}

export const app = initializeApp(firebaseConfig)
// Демо (?demo=1): фейковий вхід учня без звернень до Firebase Auth/бази.
const demoAuth = {
  currentUser: { ...DEMO_USER, getIdToken: async () => 'demo' },
  onAuthStateChanged(cb) { setTimeout(() => cb(demoAuth.currentUser), 0); return () => {} },
  signOut: async () => {},
}
export const auth = DEMO ? demoAuth : getAuth(app)
export const db = getDatabase(app)
if (DEMO) goOffline(db) // демо: жодних з'єднань зі справжньою базою
