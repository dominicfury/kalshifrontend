# Sportsbetbrain — Admin Guide

For the admin (you). Covers env vars, user management, system config,
quota tuning, and the operational discipline the spec asks for.

---

## Initial deploy checklist

### Vercel (frontend) env vars

| Var                           | Value                                                | Purpose                                         |
| ----------------------------- | ---------------------------------------------------- | ----------------------------------------------- |
| `JWT_SECRET`                  | `openssl rand -base64 64` (≥ 16 chars)               | Signs the auth_token cookie.                    |
| `TURSO_DB_URL`                | `libsql://your-db.turso.io`                          | Database connection.                            |
| `TURSO_AUTH_TOKEN`            | from Turso dashboard                                 | DB auth.                                        |
| `RESEND_API_KEY`              | `re_…` from Resend dashboard                         | Signup verification + user alerts.              |
| `MAIL_FROM_ADDRESS`           | `noreply@<your-verified-domain>.com`                 | Send-from email; domain must be verified in Resend. |
| `MAIL_FROM_NAME`              | `Sportsbetbrain`                                     | Display name in email From field.               |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | from Cloudflare Turnstile                          | CAPTCHA widget on signup.                       |
| `TURNSTILE_SECRET_KEY`        | from Cloudflare Turnstile                            | Server-side CAPTCHA verification.               |
| `BACKEND_URL`                 | Railway public domain (e.g. `https://kalshibackend-production-xxxx.up.railway.app`) | Repoll button proxies here. |
| `REPOLL_TOKEN`                | random secret (must match Railway)                   | Shared secret for /repoll.                      |
| `OPENAI_API_KEY`              | from OpenAI dashboard                                | AI chat.                                        |

### Railway (backend) env vars

| Var                          | Value                                                | Purpose                                           |
| ---------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| `ADMIN_USERNAME`             | the admin login you want                             | Seeded on first boot if no admin exists.          |
| `ADMIN_PASSWORD`             | strong password                                      | Seeded + bcrypt hashed.                           |
| `KALSHI_API_KEY_ID`          | from Kalshi dashboard                                | Public market data (orderbooks, settlement).      |
| `KALSHI_PRIVATE_KEY_PATH`    | path to RSA pem in image                             | Auth for trading endpoints (later).               |
| `ODDS_API_KEY`               | from the-odds-api.com                                | Sportsbook consensus data.                        |
| `TURSO_DB_URL`               | same as Vercel                                       | DB connection.                                    |
| `TURSO_AUTH_TOKEN`           | same as Vercel                                       | DB auth.                                          |
| `REPOLL_TOKEN`               | same as Vercel                                       | Shared secret.                                    |
| `RESEND_API_KEY`             | same as Vercel                                       | User alert emails.                                |
| `MAIL_FROM_ADDRESS`          | same as Vercel                                       | Email From.                                       |
| `MAIL_FROM_NAME`             | same as Vercel                                       | Email From display name.                          |
| `ODDS_SPORTS` (optional)     | `icehockey_nhl,basketball_nba,baseball_mlb,basketball_wnba` | Override default sport list.                |
| `ODDS_REGIONS` (optional)    | `us,eu`                                              | `eu` brings in Pinnacle (highest-weight book).    |

### After both are set

1. Push code (Railway + Vercel auto-deploy from `main`).
2. Backend boot logs `admin_user_seeded` if the admin row was created.
3. Sign in at `https://your-domain.com/login`.
4. Tab to `/settings` to confirm everything's wired.

---

## What admins see that users don't

| Feature                | Path                  | Notes                                                       |
| ---------------------- | --------------------- | ----------------------------------------------------------- |
| **CLV tab**            | `/clv`                | Validation primitive. Watch CLV by category over time.      |
| **Health tab**         | `/health`             | Poller heartbeat, quota, unmatched markets, anomaly counts. |
| **Settings tab**       | `/settings`           | All admin tools (below).                                    |
| **Repoll button**      | top of signals page   | Force-poll on demand. Burns 6+ Odds credits per click.      |
| **Unlimited AI chat**  | (everywhere)          | Per-user quotas don't apply to admins.                      |

---

## `/settings` admin sections

### System config

Five runtime-editable values. Pollers re-read these on every tick;
saves take effect within one cycle without a redeploy.

| Key                        | Default | Notes                                                         |
| -------------------------- | ------- | ------------------------------------------------------------- |
| `kalshi_poll_interval_sec` | 30      | Free, no quota. Lower = fresher Kalshi prices.                |
| `book_poll_interval_sec`   | 1800    | 30 min — tuned for the 20K/mo Odds API plan + sport-tier.     |
| `default_ai_quota_daily`   | 10      | Daily AI chats per non-admin user.                            |
| `odds_quota_reserve`       | 1000    | Stop polling Odds when remaining credits drop below this.     |
| `user_repoll_quota_daily`  | 0       | Manual repolls per non-admin user / day. 0 disables.          |

### Users

Lists every user. Per-user actions:

- **Verify** — only visible for unverified self-signups. Clicking sets
  `verified=1` and stamps `verified_at` + `verified_by`. The user gets
  full access on their next request without having to log out.
- **Quota** — change a single user's `ai_quota_daily`. Setting to `0`
  reverts them to the global default.
- **Disable** — sets `disabled=1`. Their cookie still verifies, but
  every request returns 401 from the API routes (effectively logged out).
  You can't disable yourself in the same session.
- **Enable** — reverses Disable.
- **Create user** — new row with `signup_method='admin'` (auto-verified;
  no email confirmation needed). Useful when you want to add a
  trusted user without making them go through signup.

### Activity log

Last 100 events across all users:

- `login` / `login_failed` / `logout`
- `ai_chat` / `ai_quota_blocked`
- `repoll` / `repoll_quota_blocked`

Each row shows the user, action, IP, parsed metadata, and time. Use
this to spot brute-force attempts (many `login_failed` from one IP),
quota abuse, or to confirm a user actually used the tool.

---

## Quota tuning for the 20K/mo Odds API plan

### The math

| Config                              | Credits/tick | Daily | Monthly |
|-------------------------------------|-------------:|------:|--------:|
| 4 sports, us+eu, 5-min              | 24           | 6,912 | 207K ❌ |
| 4 sports, us+eu, 30-min (current)   | 24           | 1,152 | 35K ❌  |
| 4 sports, us+eu, **30-min + sport-tier (HOT every / WARM 1/3 / COLD skip)** | ~10 avg | ~480 | **~14K ✅** |

The sport-tier system in `scripts/poll_once.py` is what makes the 20K
plan workable across 4 sports + Pinnacle. Each book poll tick checks
each configured sport's nearest upcoming event:

- **HOT** (game in &lt; 2h): fetch every tick.
- **WARM** (game 2–24h): fetch every 3rd tick (phased per sport).
- **COLD** (no game in 24h): skip entirely.

### Tuning levers

If quota burn looks high in `/health`:

1. **Increase `book_poll_interval_sec`** in System Config (1800 → 3600
   = 30min → 60min). Halves quota.
2. **Drop `eu` from `ODDS_REGIONS`** on Railway (eu = Pinnacle, but
   doubles credit cost per call). Use as a temporary measure.
3. **Drop a sport** from `ODDS_SPORTS` if its CLV has been bad for
   weeks (e.g. WNBA off-season).

If quota usage is low and you want fresher data:

1. **Decrease `book_poll_interval_sec`** to 900 (15 min). Doubles
   responsiveness near pre-game.

The Health tab shows `Odds quota remaining` — keep an eye on it daily.

---

## Operational discipline (per spec §16)

**Pre-commitments to write down BEFORE betting real money:**

- Min signals before trusting model: **200 resolved**.
- Min CLV before trusting: **+0.5% sustained over 200+ signals**.
- Max bet size: **1% of bankroll** per bet.
- Daily exposure cap: **5% of bankroll**.
- Kill switch: **30-day CLV &lt; 0% → stop alerts and rebuild**.
- Kelly fraction: **quarter-Kelly maximum** for sizing.

**Daily review (10 min/day):**

- `/health` — all polls succeeded?
- `/health` — unmatched markets count near zero?
- `/clv` — rolling CLV trending the right way?

**Weekly review (1 hour/week):**

- CLV by category — anything trending negative?
- CLV by edge bucket — are big edges trustworthy?
- Activity log — any pattern of abuse?
- Anomaly review — `signal_anomalies` table.
- Calibration — do fair_probs match outcome rates?

---

## Troubleshooting

### "Login returns HTTP 500"

The verify route now returns `auth_token signing failed — check
JWT_SECRET env var on Vercel`. If you see that, your `JWT_SECRET` isn't
set on Vercel or is &lt; 16 chars.

### "Repoll button errors"

Check the expanded error details (click `err · …` to expand). Common
causes:

- `BACKEND_URL not configured` — set on Vercel.
- `non-JSON upstream response` (HTML body) — Railway service is down
  or restarting. Check Railway dashboard.
- `403 manual repoll is admin-only` — you're not signed in as admin.

### "AI chat returns 429 daily limit"

That's the per-user quota working. Go to `/settings → Users → Quota` to
raise the user's `ai_quota_daily`, or change `default_ai_quota_daily`
in System Config.

### "Pollers stopped writing data"

`/health` shows `last_kalshi_poll` and `last_book_poll`. If both are
stale &gt; 5 min, the Railway service is likely down. SSH or check
Railway logs. Common causes:

- Build error after a code push (look at deploy log).
- DB connection lost (Turso outage — rare).
- `ODDS_API_KEY` invalid (look at api_status table).

### "Verification emails aren't arriving"

- Confirm domain in Resend is **Verified** (green dot).
- Confirm `MAIL_FROM_ADDRESS` matches a verified domain.
- Check Resend dashboard → Logs for delivery status.
- Spam folder.

---

## Wiping the production DB

`scripts/wipe_all.py` in the backend repo clears every dynamic table.
Useful only after a schema change you can't reconcile against existing
rows. Schema is preserved.

```
.venv/Scripts/python.exe -m scripts.wipe_all
```

The admin user gets re-seeded on the next backend boot from
`ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars.

**Don't run this lightly.** It deletes signals, bets, CLV history,
activity logs, and user accounts.
