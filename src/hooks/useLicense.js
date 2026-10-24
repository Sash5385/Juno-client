import { useState, useEffect, createContext } from "react";
import { onValue } from "firebase/database";
import { iRef } from "../firebase/db";

// undefined = ще завантажується, null = вузла license нема в базі (доступ
// дозволено як і раніше — фіча вимкнена, поки для інстансу не заведено ліцензію).
// Учню правила дають читати лише ці поля license (не весь вузол з платіжними даними),
// тому слухаємо кожне окремо — раніше читання всього вузла падало з permission_denied,
// і режим «лише перегляд» ніколи не вмикався.
const LICENSE_FIELDS = ["status", "trialEndsAt", "expiresAt", "free"];

export function useLicense(iid) {
  const [license, setLicense] = useState(undefined);
  useEffect(() => {
    if (!iid) { setLicense(undefined); return; }
    const vals = {};
    let loaded = 0;
    const emit = () => {
      if (loaded < LICENSE_FIELDS.length) return;
      const has = LICENSE_FIELDS.some(f => vals[f] != null);
      setLicense(has ? { ...vals } : null);
    };
    const unsubs = LICENSE_FIELDS.map(f => {
      let first = true;
      const done = () => { if (first) { first = false; loaded++; } emit(); };
      return onValue(iRef(`license/${f}`), snap => { vals[f] = snap.val(); done(); }, () => { vals[f] = null; done(); });
    });
    return () => unsubs.forEach(u => u());
  }, [iid]);
  return license;
}

// Стани ліцензії (дзеркало DrivePad/src/hooks/useLicense.js). readonly — термін + 1 пільгова доба
// минули або інструктора призупинено: учні бачать свої записи, але записатись/переносити не можуть.
export const LICENSE_GRACE_MS = 24 * 3600 * 1000;

export function licenseState(license, now = Date.now()) {
  if (!license || license.free) return { level: "ok" }; // free — «без оплат» від суперадміна
  if (license.status === "suspended") return { level: "readonly" };
  const until = license.status === "trial" ? license.trialEndsAt : license.expiresAt;
  if (until && now > until + LICENSE_GRACE_MS) return { level: "readonly" };
  return { level: "ok" };
}

export function isLicenseReadOnly(license) {
  return licenseState(license).level === "readonly";
}

// { readOnly: boolean } — читає Cabinet/BookingsTab, щоб вимкнути запис і перенесення
export const LicenseContext = createContext({ readOnly: false });
