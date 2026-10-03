import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase, goOffline } from 'firebase/database'
import { DEMO, DEMO_USER } from '../demo/demoMode'

// Конфіг окремого Firebase-проєкту Juno — з .env (VITE_FIREBASE_*, див. .env.example).
// Без нього — демо-проєкт "demo-juno" (префікс demo- зарезервований під емулятор): справжні дані нікуди не пишуться,
// працює демо-режим (?demo=1).
// iPhone (Safari/ярлик) блокує сховище між різними доменами: вхід через Google робить редірект на authDomain і назад,
// а результат лишається в "чужому" сховищі. Firebase Hosting віддає /__/auth/handler на КОЖНОМУ домені сайту, тож на iOS
// робимо authDomain тим самим, що й у сайту (same-origin). Один раз додайте https://<домен клієнта>/__/auth/handler
// в Authorized redirect URIs OAuth-клієнта (Google Cloud Console → Credentials).
const env = import.meta.env
const projectId = env.VITE_FIREBASE_PROJECT_ID || 'demo-juno'

function defaultAuthDomain() {
  const fallback = `${projectId}.firebaseapp.com`
  try {
    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const host = window.location.host
    if (ios && /\.(web\.app|firebaseapp\.com)$/.test(host)) return host
  } catch {}
  return fallback
}

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || defaultAuthDomain(),
  databaseURL: env.VITE_FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.europe-west1.firebasedatabase.app`,
  projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '0',
  appId: env.VITE_FIREBASE_APP_ID || '1:0:web:0',
}

export const app = initializeApp(firebaseConfig)
// Демо (?demo=1): фейковий вхід клієнта без звернень до Firebase Auth/бази.
const demoAuth = {
  currentUser: { ...DEMO_USER, getIdToken: async () => 'demo' },
  onAuthStateChanged(cb) { setTimeout(() => cb(demoAuth.currentUser), 0); return () => {} },
  signOut: async () => {},
}
export const auth = DEMO ? demoAuth : getAuth(app)
export const db = getDatabase(app)
if (DEMO) goOffline(db) // демо: жодних з'єднань зі справжньою базою
