# Sportsbetbrain — Frontend

Next.js dashboard for Sportsbetbrain. Reads from Turso (libSQL) directly
and proxies admin operations + manual repolls to the backend.

Companion backend: [kalshibackend](https://github.com/dominicfury/kalshibackend).

## Documentation

- 👤 **[docs/USER.md](docs/USER.md)** — what the dashboard shows you,
  how to read each column, alerts setup, common issues. Linked from
  the in-app `/info` tab.
- 🛠 **[docs/ADMIN.md](docs/ADMIN.md)** — env-var checklist, user
  management, system config tuning, quota math, troubleshooting.
- 📘 **[../kalshibackend/docs/DEV.md](https://github.com/dominicfury/kalshibackend/blob/main/docs/DEV.md)** — architecture + how the betting math actually works.

## Pages

- `/` — Logged-out: marketing landing. Logged-in: signal table.
- `/login` — Username + password.
- `/signup` — Username + email + password + Turnstile CAPTCHA + 6-digit
  email verification code.
- `/info` — How the tool works + column reference (public).
- `/alerts` — User-defined email alert subscriptions (verified users).
- `/clv` — CLV analysis (admin).
- `/health` — Poller heartbeat + quota (admin).
- `/settings` — System config + user management + activity log (admin).

## Quickstart

```bash
npm install
cp .env.local.example .env.local   # fill in env vars (see docs/ADMIN.md)
npm run dev
```

## Deploy

Auto-deploys from `main` to Vercel. Required env vars (full list in
[docs/ADMIN.md](docs/ADMIN.md)):

- `JWT_SECRET` — `openssl rand -base64 64`, ≥ 16 chars.
- `TURSO_DB_URL`, `TURSO_AUTH_TOKEN`
- `RESEND_API_KEY`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
- `BACKEND_URL`, `REPOLL_TOKEN` — for admin manual-repoll button
- `OPENAI_API_KEY` — for AI chat

## Type-checking

```
npx tsc --noEmit
```
