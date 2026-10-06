// Демо-режим: застосунок показує ВИДУМАНІ дані, а Firebase не чіпає взагалі — ні читання,
// ні запису (для скріншотів/реклами). Вмикається адресою з ?demo=1 і пам'ятається
// до закриття вкладки; ?demo=0 вимикає. Без цього параметра нічого не змінюється.
// Дані спільні з адмінкою (див. DrivePad/src/demo): тут дивимось очима клієнтки Ірини Бондаренко.
export const DEMO_UID = "demo-instructor"; // ключ майстра в демо-дереві (спільний з адмінкою)
export const DEMO_IID = DEMO_UID;
export const DEMO_SLUG = "demo";
export const DEMO_STUDENT_UID = "demo_u03";
export const DEMO_USER = { uid: DEMO_STUDENT_UID, email: "demo@drivepad.pro", displayName: "Ірина Бондаренко", phoneNumber: "+380990000003", isAnonymous: false };

const KEY = "dp_demo";

function detect() {
  try {
    const d = new URLSearchParams(window.location.search).get("demo");
    if (d === "0") { sessionStorage.removeItem(KEY); return false; }
    if (d === "1") sessionStorage.setItem(KEY, "1");
    return sessionStorage.getItem(KEY) === "1";
  } catch { return false; }
}

export const DEMO = detect();
export const demoTheme = () => "dark";
