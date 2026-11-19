// Смоук-тест у демо-режимі (?demo=1, без Firebase): відкриває застосунок, проходить усі вкладки
// на вузькому екрані 320px і падає, якщо є помилка JS, порожній екран або горизонтальний скрол.
// Запуск: node tests/smoke/smoke.mjs <admin|client> [BASE_URL]   (потрібен запущений vite preview)
import { chromium } from "playwright";

const kind = process.argv[2];
const base = (process.argv[3] || "http://localhost:4173").replace(/\/$/, "");
const TABS = {
  admin: ["Записи", "Журнал", "Клієнти", "Черга", "Послуги", "Чати", "Шаблони", "Статист.", "Налашт."],
  client: ["Записи", "Черга", "Чат", "Події"],
};
if (!TABS[kind]) { console.error("usage: smoke.mjs <admin|client> [BASE_URL]"); process.exit(2); }

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await (await browser.newContext({ viewport: { width: 320, height: 640 }, serviceWorkers: "block" })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  const t = m.text();
  if (m.type() === "error" && !/net::ERR_|Failed to load resource/.test(t)) errors.push(`console.error: ${t.slice(0, 200)}`);
});

let fails = 0;
const check = (name, ok, info = "") => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : "  " + info}`); };
const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const textLen = () => page.evaluate(() => document.body.innerText.trim().length);

await page.goto(`${base}/?demo=1&lang=uk`);
await page.waitForTimeout(2500);
check("home renders", (await textLen()) > 50, `body text ${await textLen()}`);
check("home fits 320px", await noOverflow());

for (const tab of TABS[kind]) {
  const btn = page.locator("button", { hasText: tab }).last();
  const found = (await btn.count()) > 0;
  check(`tab «${tab}» exists`, found);
  if (!found) continue;
  await btn.click();
  await page.waitForTimeout(700);
  check(`tab «${tab}» renders`, (await textLen()) > 30);
  check(`tab «${tab}» fits 320px`, await noOverflow());
}

if (kind === "client") {
  const nav = (t) => page.locator(".botnav-btn", { hasText: t }).first();
  // (1) верхня панель: без перемикача теми; (5) усі круглі кнопки ≥ 32px
  check("top bar has no theme toggle", (await page.locator('button[aria-label="Тема"]').count()) === 0);
  const sizes = await page.$$eval(".cab-icon-btn", (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  check("top bar .cab-icon-btn all >= 32px", sizes.length > 0 && sizes.every(([w, h]) => w >= 32 && h >= 32), JSON.stringify(sizes));

  // (2) Профіль → «Оформлення»: рівно 3 палітри, клік по «Неон-ніч» ставить data-palette="neon"
  await page.locator('button[aria-label="Профіль"]').first().click();
  await page.waitForTimeout(700);
  const tiles = page.locator(".profile-section", { hasText: "Оформлення" }).first().locator(".edit-tiles").first().locator(".edit-tile");
  const names = (await tiles.allInnerTexts()).map((t) => t.trim());
  check("profile: 3 palette tiles", names.length === 3 && ["Стандартна", "Неон-ніч", "Океан"].every((n, i) => names[i] === n), JSON.stringify(names));
  if (names.length === 3) {
    await tiles.nth(1).click();
    await page.waitForTimeout(300);
    check('palette click sets html[data-palette="neon"]', (await page.evaluate(() => document.documentElement.dataset.palette)) === "neon");
  }

  // (3) Записатись: перший доступний день; «Зайняті (N)» розкриває додаткові слоти
  await page.locator(".botnav-fab").click();
  await page.waitForTimeout(700);
  const day = page.locator("button.cal-day:not([disabled])").first();
  const hasDay = (await day.count()) > 0;
  check("book: has an enabled day", hasDay);
  if (hasDay) {
    await day.click();
    await page.waitForTimeout(900);
    const busy = page.locator("button", { hasText: /^\s*Зайняті \(\d+\)/ }).first();
    if ((await busy.count()) > 0) {
      const before = await page.locator(".slot").count();
      await busy.click();
      await page.waitForTimeout(400);
      const after = await page.locator(".slot").count();
      check("book: «Зайняті» reveals more slots", after > before, `${before} -> ${after}`);
      check("book: button becomes «Сховати зайняті»", (await page.locator("button", { hasText: "Сховати зайняті" }).count()) > 0);
    } else console.log("skip «Зайняті» (no busy slots on first day)");
  }

  // (4) Записи: «Додати в календар» → Google Calendar
  await nav("Записи").click();
  await page.waitForTimeout(700);
  const add = page.locator("button.cal-add-btn", { hasText: "Додати в календар" });
  const nAdd = await add.count();
  check("bookings: «Додати в календар» shown", nAdd > 0);
  if (nAdd > 0) {
    await add.first().click();
    await page.waitForTimeout(300);
    check("bookings: click reveals Google Calendar", (await page.locator("a.cal-add-btn", { hasText: "Google Calendar" }).count()) > 0);
  }
}

check("no JS errors", errors.length === 0, "\n    " + errors.join("\n    "));
await browser.close();
console.log(fails ? `\n${fails} FAILED` : "\nSMOKE OK");
process.exit(fails ? 1 : 0);
