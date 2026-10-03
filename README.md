# Juno-client — запис до салонів і майстрів

PWA для клієнтів: сторінка салону `/s/{slug}`, запис (послуга → майстер → час), оплата, мої записи, чат, сповіщення. React 18 + Vite + Firebase.
Бекенд (правила, Cloud Functions, адмінка) — репозиторій Juno.

```bash
npm ci
npm run dev        # http://localhost:5173/cabinet/bookings?demo=1 — демо без Firebase
npm run build
```
Свій Firebase-проєкт: `.env.example` → `.env.local`. Тести й деплой: див. CLAUDE.md. Гілка `main` — повна копія DrivePad-Client на момент створення Juno.
