# Kalshi NHL +EV Frontend

Next.js dashboard for the Kalshi NHL +EV signals system. Reads directly from
Turso (libSQL) and posts bet logs to the backend.

Companion backend: [kalshibackend](https://github.com/dominicfury/kalshibackend).

The full design lives in `KALSHI_NHL_EV_SPEC.md` at the parent project root
(spec §13 covers dashboard pages).

## Quickstart

```bash
npm install
cp .env.example .env.local   # then fill in TURSO_DB_URL + TURSO_AUTH_TOKEN
npm run dev
```

## Pages

- `/` — Live signals (auto-refresh)
- `/clv` — CLV analysis
- `/bets` — Bet log + entry form
- `/persistence` — Edge persistence histograms
- `/health` — System health

## Status

Phase 1 scaffold. Page bodies are stubs; data fetching + interactivity land
in Phases 5 and 6.
