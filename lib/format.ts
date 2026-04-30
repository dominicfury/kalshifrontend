/** Display helpers shared across pages. */

export function pct(n: number | null, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(digits)}%`;
}

export function dollars(n: number | null, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `$${n.toFixed(digits)}`;
}

export function num(n: number | null, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

export function ago(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  if (Number.isNaN(t)) return iso;
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h`;
  return `${Math.round(sec / 86400)}d`;
}

/** Kalshi market URL.
 *
 * Full ticker URLs (e.g. /markets/KXNHLGAME-26APR29MTLTB-TB) currently
 * 404 on Kalshi's site. The event-level page exists at the lowercased
 * event_ticker, which we derive by stripping the side suffix.
 *
 * Examples:
 *   KXNHLGAME-26APR29MTLTB-TB  → /markets/kxnhlgame-26apr29mtltb
 *   KXNHLSPREAD-26APR29MTLTB-TB2 → /markets/kxnhlspread-26apr29mtltb
 *   KXNHLTOTAL-26APR29MTLTB-9  → /markets/kxnhltotal-26apr29mtltb
 */
export function kalshiUrl(ticker: string): string {
  const eventTicker = ticker.includes("-")
    ? ticker.slice(0, ticker.lastIndexOf("-"))
    : ticker;
  return `https://kalshi.com/markets/${eventTicker.toLowerCase()}`;
}

export function teamLabel(slug: string): string {
  return slug
    .split("_")
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
}


/** Translate (market_type, market_side, side, line) into a plain-English
 * description of the actual bet. Single source of truth shared by the
 * signals table, signal detail page, AI chat title/payload, and the
 * backend email template (which has its own mirror in user_alerts.py).
 *
 * Output always includes the Kalshi YES/NO side as a suffix so the user
 * knows which button to click after the Kalshi link opens the contract.
 * Examples:
 *   moneyline → "Lakers ML · YES" or "Lakers ML · NO"
 *   total     → "Over 6.5 · YES" / "Under 6.5 · NO"
 *   puckline  → "Tampa Bay -1.5 · YES" / "Edmonton +1.5 · NO"
 *
 * The Kalshi market is "Did [market_side team / outcome] hit?" YES/NO is
 * which side of THAT contract is +EV. The team / over-under resolution
 * tells you WHAT you're betting on; the YES/NO suffix tells you WHICH
 * Kalshi button to click on the contract page.
 */
export function resolveBet(s: {
  market_type: string;
  market_side: "home" | "away" | "over" | "under" | null;
  side: "yes" | "no";
  line: number | null;
  home_team: string;
  away_team: string;
}): string {
  const home = teamLabel(s.home_team);
  const away = teamLabel(s.away_team);
  const yesNo = s.side.toUpperCase();

  if (s.market_type === "moneyline") {
    const marketIsHome = s.market_side === "home";
    const team =
      (marketIsHome && s.side === "yes") || (!marketIsHome && s.side === "no")
        ? home
        : away;
    return `${team} ML · ${yesNo}`;
  }

  if (s.market_type === "match_winner") {
    // Tennis. Same home/away resolution as moneyline; the "team" here is
    // a single player. No "ML" suffix since the bet is implicitly "win
    // the match" — just the player's name reads cleanly.
    const marketIsHome = s.market_side === "home";
    const player =
      (marketIsHome && s.side === "yes") || (!marketIsHome && s.side === "no")
        ? home
        : away;
    return `${player} · ${yesNo}`;
  }

  if (s.market_type === "total") {
    // Kalshi's totals contracts are ALWAYS named "Over X.5" (our
    // normalizer enforces this). Show the contract name verbatim plus
    // the YES/NO suffix — same noun-then-button pattern as moneyline.
    //
    // Don't be tempted to flip the description to "Under X.5" on no-side
    // signals: users read predicates like "Under" as something to be
    // negated by NO, then mentally invert twice and arrive at Over —
    // the wrong answer. Keeping the contract name fixed and letting
    // YES/NO mean "which button" matches the moneyline pattern they
    // already parse correctly, AND matches what they'll see when they
    // click through to Kalshi.
    const line = s.line ?? 0;
    return `Over ${line} · ${yesNo}`;
  }

  if (
    s.market_type === "puckline" ||
    s.market_type === "runline" ||
    s.market_type === "spread"
  ) {
    const marketIsHome = s.market_side === "home";
    const yesPicksMarketTeam = s.side === "yes";
    const line = s.line ?? 0;
    const team = marketIsHome === yesPicksMarketTeam ? home : away;
    const teamLine = marketIsHome === yesPicksMarketTeam ? line : -line;
    if (teamLine > 0) return `${team} +${teamLine} · ${yesNo}`;
    if (teamLine < 0) return `${team} ${teamLine} · ${yesNo}`;
    return `${team} PK · ${yesNo}`;
  }

  // Fallback for unrecognized market types
  return `${s.market_type.toUpperCase()}${s.line != null ? ` ${s.line}` : ""} · ${yesNo}`;
}

export function clvColor(clv: number | null): string {
  if (clv == null) return "text-zinc-500";
  if (clv > 0.005) return "text-emerald-400";
  if (clv < -0.005) return "text-rose-400";
  return "text-zinc-300";
}

export function edgeColor(edge: number | null): string {
  if (edge == null) return "text-zinc-500";
  if (edge >= 0.05) return "text-amber-400";  // suspicious
  if (edge >= 0.02) return "text-emerald-400";
  if (edge >= 0.005) return "text-emerald-300";
  return "text-zinc-400";
}
