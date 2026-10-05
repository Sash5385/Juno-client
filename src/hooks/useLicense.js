import { useState, useEffect, createContext } from "react";
import { onValue } from "firebase/database";
import { iRef } from "../firebase/db";

// undefined = ще завантажується, null = вузла license нема в базі (доступ
// дозволено як і раніше — фіча вимкнена, поки для інстансу не заведено ліцензію)
export function useLicense(iid) {
  const [license, setLicense] = useState(undefined);
  useEffect(() => {
    if (!iid) { setLicense(undefined); return; }
    return onValue(iRef("license"), snap => setLicense(snap.val()), () => setLicense(null));
  }, [iid]);
  return license;
}

// Стани ліцензії (дзеркало DrivePad/src/hooks/useLicense.js). readonly — термін + 1 пільгова доба
// минули або інструктора призупинено: учні бачать свої записи, але записатись/переносити не можуть.
export const LICENSE_GRACE_MS = 24 * 3600 * 1000;

export function licenseState(license, now = Date.now()) {
  if (!license) return { level: "ok" };
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
