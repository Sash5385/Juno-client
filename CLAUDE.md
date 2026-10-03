# CLAUDE.md — правила для Juno-client

Juno-client — клієнтський застосунок (PWA) запису до салонів і майстрів: публічна сторінка салону `/s/{slug}`, запис, кабінет (`/cabinet/*`).
React 18 + Vite + react-router, Firebase (Realtime Database, Auth, FCM), оплата — Monobank через Cloud Functions репозиторію Juno.
Схема, правила бази і функції — у репозиторії **Juno** (`docs/SALON-SCHEMA.md`); тут їх копій немає.

## Порядок роботи
1. Проаналізувати код і знайти зв'язані файли; для великих змін (запис, скасування/перенесення, оплата, календар) — спершу план: що зміниться, файли, ризики, відкат.
2. Мінімальні зміни; не ламати запис, перенесення, скасування за політикою, сповіщення, часові пояси.
3. Не змінювати візуальний стиль без прямого запиту. Екрани працюють від 320px.
4. Перед пушем: `npm run build`, смоук і сценарії (`tests/smoke`, див. нижче). Якщо змінюються записи в базу — прогнати rules-тест `salonClientApp.test.mjs` у репозиторії Juno.
5. Підсумок: список змінених файлів, ризики, ідеї — окремим списком.

## Тести
```bash
npm run build && (npx vite preview --port 4173 &) && cd tests/smoke && npm install && npx playwright install chromium && cd ../..
node tests/smoke/smoke.mjs http://localhost:4173          # усі вкладки кабінету, 320px, демо-режим (?demo=1)
node tests/smoke/salon-flows.mjs http://localhost:4173    # запис, скасування за політикою, перенесення, оцінка, чат, профіль
```

## Спільні файли з Juno
`src/utils/salonLogic.js` і `src/utils/salonPaths.js` — ті самі файли, що `src/salonLogic.js` / `src/salonPaths.js` у Juno: змінювати в обох.

## Версіонування
`src/version.js` (`export const APP_VERSION = "vДД.ММ.N"`), показується у вкладці Профіль. Версія ведеться окремо від DrivePad;
повідомлення коміту починається з версії: `v03.10.1 — опис`.

## Git і деплой
- `main` — незмінна копія DrivePad-Client (довідка); розробка йде у робочій гілці.
- Деплой тільки вручну: Actions → «Deploy to Firebase Hosting». Автодеплою немає.
- Нативні оболонки (Capacitor android/ios) видалені: після створення Firebase-проєкту Juno згенерувати наново (`npx cap add android|ios`, appId `app.juno.client`).
- Без підтвердження не виконувати: `rm -rf`, `git reset --hard`, `git push --force`, `claude --dangerously-skip-permissions`.

## Стиль спілкування
Коротко: що зроблено (1–2 рядки), файл і рядок за потреби.
