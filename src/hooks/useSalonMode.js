import { useState, useEffect } from 'react'
import { getAdminSettings, getCurrentIid } from '../firebase/db'

// Салон-режим клієнта: admin_settings/accountType === 'salon'. Для інструктора/solo повертає false (нічого не змінюємо).
const cache = {}
export function useSalonMode() {
  const iid = getCurrentIid()
  const [salon, setSalon] = useState(() => !!cache[iid])
  useEffect(() => {
    let alive = true
    getAdminSettings().then(s => {
      const v = s?.accountType === 'salon'
      cache[iid] = v
      if (alive) setSalon(v)
    }).catch(() => {})
    return () => { alive = false }
  }, [iid])
  return salon
}
