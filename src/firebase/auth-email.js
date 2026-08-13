import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail as fbSendReset,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth'
import { auth } from './config'

const googleProvider = new GoogleAuthProvider()

// Popup-вхід не працює у частині мобільних браузерів (Samsung Internet,
// вбудовані webview тощо) — блокують popup або сторонні cookie без явної
// помилки "заблоковано". У цих випадках падаємо назад на signInWithRedirect
// (повне перенаправлення на сторінку Google і назад), яке працює скрізь.
// Явну відмову користувача (закрив вікно) не підміняємо редіректом.
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider)
    return result.user
  } catch (e) {
    if (e.code === 'auth/popup-closed-by-user') throw e
    await signInWithRedirect(auth, googleProvider)
    return null // сторінка переходить на Google — сюди вже не повернемось
  }
}

// Викликати один раз при завантаженні застосунку — забирає результат
// signInWithRedirect() після повернення з Google (якщо він був).
export async function getGoogleRedirectResult() {
  const result = await getRedirectResult(auth)
  return result?.user ?? null
}

export async function signUpWithEmail(email, password) {
  const result = await createUserWithEmailAndPassword(auth, email, password)
  return result.user
}

export async function signInWithEmail(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password)
  return result.user
}

export async function signOut() {
  await fbSignOut(auth)
}

export async function sendPasswordReset(email) {
  await fbSendReset(auth, email)
}