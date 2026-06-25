import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

// Беремо з .env (Vite автоматично підставляє import.meta.env.VITE_*)
// Якщо .env немає — fallback на дефолти (треба підставити вручну)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAJFqq9jMrc2RgkceappeGt9EJ2bM2xKBI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "drivepad-86fe1.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://drivepad-86fe1-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "drivepad-86fe1",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "drivepad-86fe1.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "221725287898",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:221725287898:web:59ee63287a825801104ce3"
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getDatabase(app)
