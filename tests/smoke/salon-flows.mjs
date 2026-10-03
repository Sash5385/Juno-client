// Сценарії клієнта салону в демо-режимі (?demo=1, пам'ять замість Firebase): запис, скасування за політикою,
// перенесення, оцінка, чат, сповіщення, профіль — на екрані 320px.
// Запуск: node tests/smoke/salon-flows.mjs [BASE_URL]   (потрібен запущений vite preview)
import { chromium } from "playwright";
const base = (process.argv[2] || "http://localhost:4173").replace(/\/$/, "");
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await (await browser.newContext({ viewport: { width: 320, height: 640 }, serviceWorkers: "block" })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error" && !/net::ERR_|Failed to load resource/.test(m.text())) errors.push(`console.error: ${m.text().slice(0, 200)}`); });
let fails = 0;
const check = (name, ok, info = "") => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : "  " + info}`); };
const has = async (text, timeout = 2500) => { try { await page.getByText(text, { exact: false }).first().waitFor({ timeout }); return true; } catch { return false; } };
const flow = () => page.getByTestId("book-flow");
const fhas = async (text, timeout = 2500) => { try { await flow().getByText(text, { exact: false }).first().waitFor({ timeout }); return true; } catch { return false; } };
const btn = (t) => page.locator("button", { hasText: t }).first();
const navTab = (t) => page.locator("nav button", { hasText: t }).first().click();

console.log("── публічна сторінка");
await page.goto(`${base}/?demo=1`);
await page.waitForTimeout(2000);
check("redirects to /s/{slug}, shows salon, masters, prices", page.url().includes("/s/beauty-studio") && await has("Beauty Studio") && await has("Анна Мельник") && await has("від 550"));

console.log("── запис: послуга → майстер → час → підтвердження");
await btn("Записатись онлайн").click();
check("services grouped by category", await fhas("Стрижка") && await fhas("Манікюр з покриттям"));
await flow().getByText("Жіноча стрижка").first().click();
check("master step: any + both masters with their own prices", await fhas("Будь-який майстер") && await fhas("Борис Литвин") && await fhas("550"));
await flow().getByText("Борис Литвин").first().click();
check("time step: date strip and free times", await fhas("Дата і час") && (await flow().locator("button", { hasText: /^\d\d:\d\d$/ }).count()) > 0);
await flow().locator("button", { hasText: /^\d\d:\d\d$/ }).last().click();
check("confirm: summary with master price and payment options", await fhas("Підтвердження") && await fhas("550 ₴") && await fhas("Передоплата") && await fhas("Оплатити в салоні"));
await flow().getByText("Оплатити в салоні").first().click();
await flow().getByPlaceholder("Наприклад: френч, коротка довжина").fill("Прошу без феном");
await flow().locator("button", { hasText: /^Записатись$/ }).click();
check("done screen", await fhas("Запис створено"));
await flow().locator("button", { hasText: "Мої записи" }).click();
check("cabinet lists the new booking", page.url().includes("/cabinet/bookings") && await has("Борис Литвин") && await has("Очікує підтвердження"));

console.log("── мої записи: політика скасування, перенесення, оцінка");
check("payment status shown (deposit paid / waiting)", await has("Передоплата внесена") && await has("Чекає оплати"));
check("unpaid online booking shows hold deadline", await has("Оплатіть до"));
check("other client's booking is not shown", !(await has("Чужий запис", 800)));
await page.locator("button", { hasText: "Скасувати" }).first().click();
check("cancel dialog explains the policy for the paid booking", await has("Скасувати запис?") && (await has("безкоштовне") || await has("не повертається")) && await has("210"));
await page.locator("button", { hasText: "Залишити" }).click();
check("dialog closes without cancelling", !(await has("Скасувати запис?", 600)));
await page.locator("div").filter({ hasText: "Доплатити" }).last().locator("button", { hasText: "Перенести" }).click();
await flow().locator("button", { hasText: /^\d\d:\d\d$/ }).first().waitFor();
check("reschedule opens at the time step (same master, date strip)", await fhas("Перенести запис") && (await flow().locator("button", { hasText: /^\d\d:\d\d$/ }).count()) > 0);
await flow().locator("button", { hasText: /^\d\d:\d\d$/ }).nth(2).click();
check("paid booking: deposit moves, no payment choice offered", await fhas("Передоплата 210") && !(await fhas("Оплатити в салоні", 500)));
await flow().locator("button", { hasText: /^Перенести$/ }).click();
check("reschedule done", await fhas("Запис перенесено"));
await flow().locator("button", { hasText: "Мої записи" }).click();
await page.getByText("Оцініть візит").first().scrollIntoViewIfNeeded().catch(() => {});
await page.locator('button[aria-label="5"]').first().click();
check("rating saved", await has("Ваша оцінка"));
await page.locator("button", { hasText: "Скасувати" }).first().click();
await page.locator("button", { hasText: "Скасувати запис" }).last().click();
check("confirmed cancellation moves booking to history as cancelled", await has("Скасовано"));

console.log("── чат, сповіщення, профіль");
await navTab("Чат");
check("chat: salon and master threads", await has("Beauty Studio") && await has("Ваш майстер"));
await page.getByText("Адміністратор салону").first().click();
check("thread history", await has("Так, чекаємо вас!"));
await page.getByPlaceholder("Повідомлення…").fill("Дякую, буду вчасно");
await page.locator("button", { hasText: "➤" }).click();
check("sent message appears", await has("Дякую, буду вчасно"));
await navTab("Сповіщ.");
check("notifications list", await has("Запис підтверджено") && await has("Оплату отримано"));
await navTab("Профіль");
check("profile shows saved data and version", (await page.locator("input").first().inputValue()) === "Ірина Шевченко" && await has("Версія"));
await page.locator('input').first().fill("Ірина Шевченко-Коваль");
await btn("Зберегти").click();
check("profile saved (toast)", await has("Збережено"));

check("no JS errors", errors.length === 0, "\n    " + errors.join("\n    "));
await browser.close();
console.log(fails ? `\n${fails} FAILED` : "\nSALON CLIENT FLOWS OK");
process.exit(fails ? 1 : 0);
