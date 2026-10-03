// Демо-режим: застосунок показує ВИДУМАНІ дані, а Firebase не чіпає взагалі — ні читання,
// ні запису (для скріншотів/реклами). Вмикається адресою з ?demo=1 і пам'ятається
// до закриття вкладки; ?demo=0 вимикає. Без цього параметра нічого не змінюється.
// Демо-салон (src/salon/demoData.js): дивимось очима вигаданої клієнтки.
export const DEMO_CLIENT_UID = "demo_u03";
export const DEMO_USER = { uid: DEMO_CLIENT_UID, email: "demo@juno.app", displayName: "Ірина Бондаренко", phoneNumber: "+380990000003", isAnonymous: false };

const KEY = "juno_demo";

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
