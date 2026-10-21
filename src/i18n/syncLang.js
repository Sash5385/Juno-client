// Мова клієнта → БД (instructors/{iid}/users/{uid}/lang): сервер (Cloud Functions) надсилає push і автоповідомлення цією мовою.
// Пишемо лише коли значення відрізняється від збереженого і лише коли анкета клієнта вже існує (users/{uid} без profile
// getUserProfile вважав би зареєстрованим). Тенант (майстер) визначається асинхронно — стежимо за ним і пишемо в кожного, у кого клієнт заходить.
import { onAuthStateChanged } from 'firebase/auth'
import { get, set, onValue, off } from 'firebase/database'
import { auth } from '../firebase/config'
import { iRef, getCurrentIid } from '../firebase/db'
import { DEMO } from '../demo/demoMode'
import { getLang } from './index.js'

export function startLangSync() {
  if (DEMO) return
  let uid = null
  const synced = new Set()   // "iid/uid/lang" — уже записано або збігається
  const watching = new Map() // "iid/uid" → відписка від очікування анкети
  const sync = (iid) => {
    const lang = getLang()
    const key = `${iid}/${uid}`
    if (synced.has(`${key}/${lang}`) || watching.has(key)) return
    const profName = iRef(`users/${uid}/profile/name`)
    const cb = async (snap) => {
      if (!snap.exists()) return // анкети ще нема — чекаємо (підписка лишається)
      off(profName, 'value', cb); watching.delete(key)
      try {
        const cur = (await get(iRef(`users/${uid}/lang`))).val()
        if (cur !== lang) await set(iRef(`users/${uid}/lang`), lang)
        synced.add(`${key}/${lang}`)
      } catch { /* немає мережі/прав — спробуємо при наступному запуску */ }
    }
    watching.set(key, () => off(profName, 'value', cb))
    onValue(profName, cb, () => { watching.delete(key) })
  }
  onAuthStateChanged(auth, (u) => {
    watching.forEach((stop) => stop()); watching.clear()
    uid = u?.uid || null
  })
  setInterval(() => { const iid = getCurrentIid(); if (uid && iid) sync(iid) }, 1500)
}
