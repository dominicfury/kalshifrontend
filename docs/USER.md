# Sportsbetbrain — User Guide

A signal generator for +EV trading on Kalshi sports markets. This guide
covers what the dashboard shows you and how to use it day-to-day.

---

## What this tool actually does

Sportsbetbrain compares the price of every Kalshi sports contract
against a **multi-book sportsbook consensus** (DraftKings, FanDuel,
Pinnacle, BetMGM, etc.). The bookmaker juice (vig) is stripped out, and
the result is treated as the "fair" probability of the YES outcome. When
Kalshi's price diverges from that consensus by more than the platform's
fees, we surface the row as a signal.

> **You only ever bet on Kalshi.** The sportsbooks are used as a
> fair-value oracle — we don't place bets there. Kalshi is a
> CFTC-regulated prediction exchange, which is why it's legal in many
> states where books aren't.

---

## Account lifecycle

1. **Sign up at `/signup`** — username, email, password, CAPTCHA.
2. **Email verification** — enter the 6-digit code from the email we send.
3. **12-hour trial** — you can use the dashboard immediately. The orange
   banner at the top of the page shows your remaining trial time.
4. **Admin verification** — within 12 hours, the admin reviews and
   verifies your account in their settings panel. Once verified, you
   keep dashboard access permanently AND unlock email alerts.
5. **If 12 hours pass without verification**, you'll see an "Awaiting
   admin approval" page when you next visit. Wait or contact the admin.

You'll need to **log in once a day** — the auth cookie expires after 24h.

---

## The signals page

The default table is the live ledger of currently-actionable +EV
opportunities. Each row passes a strict set of filters (see below).

### Each column

| Column     | Meaning                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| **When**   | How long ago we detected this signal. Newer is fresher.                                                |
| **Sport**  | NHL / NBA / MLB / WNBA.                                                                                |
| **Matchup**| `away_team @ home_team`.                                                                               |
| **Market** | Market type + line + side. `ML YES` = moneyline YES, `TOTAL 6.5 NO` = total under 6.5, etc.            |
| **Yes ask**| Kalshi YES contract price. Each contract pays $1 if YES happens.                                       |
| **Fair**   | Devigged consensus probability. If `Yes ask < Fair`, YES is +EV. If `Yes ask > Fair`, NO is +EV.       |
| **Edge**   | Post-fee ROI on stake at the touch (best) price.                                                       |
| **@ size** | Same edge, but recomputed against the average fill price after walking $200 of contracts up the book. |
| **Depth**  | Dollars worth of contracts available at the best ask price.                                            |
| **K stale**| Seconds since the Kalshi price last actually moved (not since polled).                                 |
| **B stale**| Seconds since the freshest sportsbook quote in the consensus moved.                                    |
| **Books**  | How many sportsbooks contributed to the consensus. More = sharper.                                     |
| **CLV**    | Closing Line Value — how much the Kalshi market moved toward your side after detection.                |
| **Status** | OPEN (pre-game), CLOSED (closing recorded), WIN/LOSS/VOID after settlement.                            |
| **AI**     | Click for an AI walkthrough of this specific signal.                                                   |

### What's filtered from the default view

The default list shows only signals that meet ALL of these:

- **Game hasn't started** (`start_time > now()`)
- **Closing line not recorded** (still pre-game)
- **Edge after fees < 5%** (anything bigger is almost always a data bug per spec §2)
- **Edge at size ≥ 0.5%** (signals where fillable edge collapsed are dropped)
- **Kalshi staleness ≤ 10 min** (Kalshi market actively quoted)
- **Depth ≥ $25** (per spec; thinner books are unfillable in any meaningful size)
- **At least 2 books in the consensus** (single-book "consensus" is one bookmaker's opinion — high uncertainty bars on fair value)
- **Latest detection per (market, side)** — duplicates collapsed

Even with `?all=1`, signals whose underlying game started **more than
12 hours ago** are hidden from the table. The rows stay in the DB so
the admin's CLV tab and audit queries still see them; the live ledger
just has no reason to display week-old closed signals.

To see everything (huge edges, started games, closed signals — useful
for CLV-bucket investigation), append `?all=1` to the URL.

### Sport activity strip

Above the filter bar, each sport has a colored chip:

- 🟢 **Live** — game starting in &lt; 2 hours, or in progress.
- 🟡 **Soon** — game in 2–24 hours.
- ⚪ **Dark** — no games scheduled in the next 24 hours.

If a sport is dark, no signals will appear for it — that's expected.

### Polling cadence chip

`polls · K30s · B30m` shows how often Kalshi and book data refresh. The
exact intervals are admin-tunable in `/settings`.

---

## Reading a signal — quick decision flow

1. **Edge in the 1–3% range?** Trustworthy zone. Continue.
2. **@ size close to touch edge?** Fillable. If @size collapses, skip.
3. **K stale &lt; 60s and B stale &lt; 90s?** Both sides actively moving.
   Stale is trap risk.
4. **Books ≥ 4?** Sharp consensus. 1–2 books = single-source.
5. **Depth ≥ $50?** Real fillable size.
6. **Status = OPEN?** Pre-game. CLOSED rows are historical.

> **Trust the CLV column over time, not your P&L.** P&L is variance for
> the first ~200 bets; CLV converges to truth in 50–100 signals.

---

## Edge magnitude rules of thumb

| Edge      | Meaning                                                                       |
| --------- | ----------------------------------------------------------------------------- |
| 0–0.5%    | Below the log threshold — not surfaced.                                       |
| 0.5–1%    | Marginal. Worth tracking but small expected value.                            |
| 1–3%      | Trustworthy zone — where real edges typically live.                           |
| 3–5%      | Investigate before betting. Often real but verify there's no news you missed. |
| 5%+       | Hidden by default. Almost always data bug or settlement-rule mismatch.        |

---

## Email alerts (verified users only)

Once an admin verifies you, the **Alerts** tab unlocks. There you can:

- Create one or more **subscriptions** with criteria you care about
  (sport, market type, minimum edge, minimum books, minimum depth).
- Set a **cooldown** so the same subscription doesn't spam you across
  many poll cycles.
- See **recent sends** (last 30) — confirms emails are being delivered.

When a fresh signal matches one of your subscriptions, we email you
through Resend with the matchup, prices, edge, depth, and a direct
link to the Kalshi market.

---

## AI chat

Click the ✨ icon on any signal row. The AI explains:

1. What the contract is.
2. Each column on the row, with the actual values.
3. Why it's flagged as +EV.
4. Exactly how to place the bet on Kalshi.
5. Risks to skip it.

You have a **daily AI quota** (10 chats by default; an admin can change it
per-user). Once you hit the limit, you'll see an error until 00:00 UTC.

---

## What you can NOT do

These are intentionally blocked for non-admin users:

- See the **CLV** tab (admin-only — used for model validation).
- See the **Health** tab (admin-only — pollers and quotas).
- See **Settings** (admin-only — system config + user management).
- Use the **Repoll** button (admin-only — burns Odds API quota).
- Sign up multiple accounts (Turnstile + admin verification gate it).

---

## Privacy + safety

- We never store your password in plaintext (bcrypt hashed).
- Your email is used for verification, alerts, and password reset only.
- AI chat history is not saved server-side beyond the request.
- We don't place trades on your behalf or custody funds. All trading
  happens on Kalshi under your own account.

---

## Common issues

**"My code didn't arrive."** Check spam. The verify form has a "Resend
code" link if needed. Codes expire after 15 minutes.

**"Login returns HTTP 500."** Server config issue (likely `JWT_SECRET`).
Tell the admin.

**"My alerts aren't sending."** Check `/alerts` → "Recent sends" for the
specific failure. Most common: `MAIL_FROM_ADDRESS` not on a verified
domain (admin issue, not yours).

**"The signals table is empty."** Could be a quiet window (no games in
the next few hours, or all current edges below threshold). Check the
sport activity strip — if everything is ⚪ dark, no games are scheduled.
Toggle `?all=1` to confirm there's data underneath.
