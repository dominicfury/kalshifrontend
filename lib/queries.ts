import { unstable_cache } from "next/cache";
import { z } from "zod";

import { getDb } from "./db";
import { getInt, KNOWN_KEYS } from "./system-config";


// Helpers — libsql returns numbers as JS numbers, but bigints in some envs
// land as `bigint` and "1.0" can come back as a string when the column is
// stored as TEXT. Coerce gently before validating.
const numLike = z.preprocess((v) => {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && v !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return v;
}, z.number());

const numLikeNullable = z.preprocess((v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && v !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return v;
}, z.number().nullable());

const intLike = z.preprocess((v) => {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && v !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return v;
}, z.number().int());

const intLikeNullable = z.preprocess((v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && v !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return v;
}, z.number().int().nullable());


const SignalRowSchema = z.object({
  id: intLike,
  detected_at: z.string(),
  kalshi_yes_ask: numLike,
  kalshi_no_ask: numLike,
  fair_yes_prob: numLike,
  side: z.enum(["yes", "no"]),
  edge_pct_after_fees: numLike,
  edge_pct_after_fees_at_size: numLikeNullable,
  expected_fill_price: numLikeNullable,
  yes_book_depth: numLikeNullable,
  kalshi_staleness_sec: intLikeNullable,
  book_staleness_sec: intLikeNullable,
  match_confidence: numLike,
  alert_sent: intLike,
  n_books_used: intLike,
  closing_kalshi_yes_price: numLikeNullable,
  clv_pct: numLikeNullable,
  resolved_outcome: z.enum(["yes", "no", "void"]).nullable(),
  hypothetical_pnl: numLikeNullable,
  ticker: z.string(),
  market_type: z.string(),
  period: z.string(),
  line: numLikeNullable,
  raw_title: z.string(),
  market_side: z.enum(["home", "away", "over", "under"]).nullable(),
  home_team: z.string(),
  away_team: z.string(),
  start_time: z.string(),
  sport: z.string(),
  time_to_start_min: intLike,
  live_polled_at: z.string().nullable(),
  live_quote_age_sec: intLikeNullable,
});

export interface SignalRow {
  id: number;
  detected_at: string;
  kalshi_yes_ask: number;
  kalshi_no_ask: number;
  fair_yes_prob: number;
  side: "yes" | "no";
  edge_pct_after_fees: number;
  edge_pct_after_fees_at_size: number | null;
  expected_fill_price: number | null;
  // Dollars available at the best ask on the +EV SIDE — YES book for
  // yes-side signals, NO book for no-side signals. Field name is legacy
  // (the column was originally YES-only); semantically it's "depth on
  // the side you'd buy." Backend engine writes it correctly as of v2.
  yes_book_depth: number | null;
  kalshi_staleness_sec: number | null;
  book_staleness_sec: number | null;
  match_confidence: number;
  alert_sent: number;
  n_books_used: number;
  closing_kalshi_yes_price: number | null;
  clv_pct: number | null;
  resolved_outcome: "yes" | "no" | "void" | null;
  hypothetical_pnl: number | null;
  ticker: string;
  market_type: string;
  period: string;
  line: number | null;
  raw_title: string;
  // The Kalshi market's perspective: which team / outcome the YES side
  // is asking about. Combined with `side` (yes/no), this resolves to
  // the actual team or outcome being bet on.
  //   moneyline / spread: 'home' or 'away' (which team the contract is for)
  //   total: 'over' or 'under' (always 'over' in our normalizer for Kalshi totals)
  market_side: "home" | "away" | "over" | "under" | null;
  home_team: string;
  away_team: string;
  start_time: string;
  sport: string;
  // Minutes from now to event start — computed server-side so it stays
  // consistent with whatever clock the SQL filters use. Negative means
  // already started (only visible via ?all=1 + 12h cutoff).
  time_to_start_min: number;
  // Latest Kalshi quote freshness for this market — joined from
  // kalshi_quotes at query time, NOT a snapshot from detection. The
  // Live view uses this to answer "is the market still being polled
  // RIGHT NOW?" instead of trusting detected_at as a proxy.
  live_polled_at: string | null;
  live_quote_age_sec: number | null;
}

export interface SignalFilters {
  todayOnly?: boolean;       // detected today (UTC)
  minEdge?: number;          // edge_pct_after_fees >= minEdge
  alertedOnly?: boolean;     // alert_sent = 1
  unresolvedOnly?: boolean;  // resolved_outcome IS NULL
  showAll?: boolean;         // false (default) = latest signal per market+side; true = full history
  sport?: string;            // 'nhl' | 'nba' | 'mlb' | 'wnba' | 'tennis_atp' | 'tennis_wta'
}


export type SignalSortKey =
  | "best"
  | "start_time"
  | "detected_at"
  | "edge"
  | "edge_at_size"
  | "kalshi_yes_ask"
  | "fair"
  | "kalshi_stale"
  | "book_stale"
  | "n_books"
  | "clv";

const SORT_SQL: Record<SignalSortKey, string> = {
  // "Best" is the default — bucket by game proximity (live/imminent vs
  // soon vs later) primary, biggest edge first within each bucket. Lets
  // the user scan by "what's both about to start AND mispriced."
  // Implemented as a multi-column ORDER BY in the assembly below.
  best: "__best__",
  start_time: "e.start_time",
  detected_at: "s.detected_at",
  edge: "s.edge_pct_after_fees",
  edge_at_size: "COALESCE(s.edge_pct_after_fees_at_size, s.edge_pct_after_fees)",
  // "Price" column: the price you'd actually pay on Kalshi for the +EV
  // side. yes_ask for yes-side signals, no_ask for no-side. The sort key
  // is still named kalshi_yes_ask for URL stability, but it sorts on the
  // displayed value, not the raw YES ask.
  kalshi_yes_ask:
    "(CASE WHEN s.side = 'yes' THEN s.kalshi_yes_ask ELSE s.kalshi_no_ask END)",
  // "Fair" column: bet-side fair probability. For NO bets, fair on YES is
  // inverted to 1 - fair_yes_prob so column reads consistently with bet.
  fair: "(CASE WHEN s.side = 'yes' THEN s.fair_yes_prob ELSE 1.0 - s.fair_yes_prob END)",
  kalshi_stale: "s.kalshi_staleness_sec",
  book_stale: "s.book_staleness_sec",
  n_books: "s.n_books_used",
  clv: "s.clv_pct",
};


export async function fetchRecentSignals(
  limit = 100,
  filters: SignalFilters = {},
  sort: { key: SignalSortKey; dir: "asc" | "desc" } = {
    key: "detected_at",
    dir: "desc",
  },
): Promise<SignalRow[]> {
  const db = getDb();
  const where: string[] = [];
  const args: (string | number)[] = [];

  if (filters.todayOnly) {
    where.push("s.detected_at >= datetime('now', 'start of day')");
  }
  if (filters.minEdge != null && filters.minEdge > 0) {
    where.push("s.edge_pct_after_fees >= ?");
    args.push(filters.minEdge);
  }
  if (filters.alertedOnly) {
    where.push("s.alert_sent = 1");
  }
  if (filters.unresolvedOnly) {
    where.push("s.resolved_outcome IS NULL");
  }
  if (filters.sport) {
    where.push(
      "s.kalshi_market_id IN (SELECT km.id FROM kalshi_markets km JOIN events e ON km.event_id = e.id WHERE e.sport = ?)",
    );
    args.push(filters.sport);
  }
  // Always: hide signals whose underlying game started > 12h ago, even
  // in the ?all=1 view. The rows stay in the DB (the /clv tab queries
  // run their own SQL and still see them), but the live ledger has no
  // reason to display week-old closed signals.
  where.push(
    "s.kalshi_market_id IN (SELECT km.id FROM kalshi_markets km " +
      "JOIN events e ON e.id = km.event_id " +
      "WHERE e.start_time > datetime('now', '-12 hours'))",
  );
  // Default ("Live") view — show what's actionable RIGHT NOW. Filters:
  //   1. PRE-GAME: event hasn't started yet (you can't bet a game in progress)
  //   2. NOT CLOSED: closing line not yet recorded
  //   3. NOT HUGE: edge < 5% (huge edges are almost always data bugs per spec §2)
  //   4. AT-SIZE PASS: edge_at_size also ≥ 0.5% (fillable, not phantom edge)
  //   5. FILLABLE: depth on the +EV side ≥ $25 (spec §10 thin-book rule).
  //      yes_book_depth column stores side-relevant depth as of v2.
  //   6. MULTI-BOOK CONSENSUS: ≥ 2 books in the devig.
  //   7. ACTIVELY POLLED: latest kalshi_quote.polled_at within the last
  //      3 minutes. This replaces the old detected_at-based recency cap.
  //      detected_at was a PROXY for "is the market still being polled,"
  //      and the proxy broke whenever signal generation skipped a market
  //      (filter A reject, COLD sport, etc.). Joining the live quote
  //      table answers the question directly — if Kalshi is being polled
  //      for this market, the signal is current.
  //
  // We deliberately do NOT filter on:
  //   - kalshi_staleness_sec: generate_signals already rejects via the
  //     relative-staleness rule, so all stored signals satisfy this.
  //   - book_staleness_sec: measures "time since the consensus PRICE
  //     MOVED." With a 30-min book poll cadence a healthy quiet book
  //     routinely sits at 1800–3600s, which is fine.
  //
  // Visible via ?all=1 for full audit trail / CLV bucket review.
  if (!filters.showAll) {
    where.push("s.closing_kalshi_yes_price IS NULL");
    where.push("s.edge_pct_after_fees < 0.05");
    where.push("s.edge_pct_after_fees_at_size >= 0.005");
    where.push("s.yes_book_depth >= 25");
    where.push("s.n_books_used >= 2");
    where.push("lq.polled_at >= datetime('now', '-3 minutes')");
    where.push(
      "s.kalshi_market_id IN (SELECT km.id FROM kalshi_markets km " +
        "JOIN events e ON e.id = km.event_id " +
        "WHERE e.start_time > datetime('now'))",
    );
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // The live-quote subquery: latest kalshi_quotes.polled_at per market.
  // Joined as `lq` so every signal row gets the current freshness of its
  // underlying Kalshi market, not the stale snapshot from detection time.
  // The (market_id, polled_at DESC) index makes the GROUP BY cheap.
  const LIVE_QUOTE_JOIN = `
    LEFT JOIN (
      SELECT market_id, MAX(polled_at) AS polled_at
      FROM kalshi_quotes
      GROUP BY market_id
    ) lq ON lq.market_id = s.kalshi_market_id
  `;
  const LIVE_QUOTE_SELECT = `
    lq.polled_at AS live_polled_at,
    CAST((julianday('now') - julianday(lq.polled_at)) * 86400 AS INTEGER) AS live_quote_age_sec
  `;

  // Default: collapse to one row per (market_id, side) — the most recent
  // detection — so the ledger reads as "current open opportunities" instead
  // of an audit log. showAll=true returns every detection (useful for
  // analyzing edge persistence on a single market).
  const baseSql = filters.showAll
    ? `
        SELECT s.id, s.detected_at,
               s.kalshi_yes_ask, s.kalshi_no_ask, s.fair_yes_prob,
               s.side, s.edge_pct_after_fees, s.edge_pct_after_fees_at_size,
               s.expected_fill_price, s.yes_book_depth,
               s.kalshi_staleness_sec, s.book_staleness_sec,
               s.match_confidence, s.alert_sent, s.n_books_used,
               s.closing_kalshi_yes_price, s.clv_pct, s.resolved_outcome,
               s.hypothetical_pnl,
               km.ticker, km.market_type, km.period, km.line, km.raw_title, km.side AS market_side,
               e.home_team, e.away_team, e.start_time, e.sport,
               CAST((julianday(e.start_time) - julianday('now')) * 1440 AS INTEGER) AS time_to_start_min,
               ${LIVE_QUOTE_SELECT}
        FROM signals s
        JOIN kalshi_markets km ON s.kalshi_market_id = km.id
        JOIN events e ON km.event_id = e.id
        ${LIVE_QUOTE_JOIN}
        ${whereSql}
      `
    : `
        WITH ranked AS (
          SELECT s.*,
                 ROW_NUMBER() OVER (
                   PARTITION BY s.kalshi_market_id, s.side
                   ORDER BY s.detected_at DESC
                 ) AS rn
          FROM signals s
          ${LIVE_QUOTE_JOIN}
          ${whereSql}
        )
        SELECT s.id, s.detected_at,
               s.kalshi_yes_ask, s.kalshi_no_ask, s.fair_yes_prob,
               s.side, s.edge_pct_after_fees, s.edge_pct_after_fees_at_size,
               s.expected_fill_price, s.yes_book_depth,
               s.kalshi_staleness_sec, s.book_staleness_sec,
               s.match_confidence, s.alert_sent, s.n_books_used,
               s.closing_kalshi_yes_price, s.clv_pct, s.resolved_outcome,
               s.hypothetical_pnl,
               km.ticker, km.market_type, km.period, km.line, km.raw_title, km.side AS market_side,
               e.home_team, e.away_team, e.start_time, e.sport,
               CAST((julianday(e.start_time) - julianday('now')) * 1440 AS INTEGER) AS time_to_start_min,
               ${LIVE_QUOTE_SELECT}
        FROM ranked s
        JOIN kalshi_markets km ON s.kalshi_market_id = km.id
        JOIN events e ON km.event_id = e.id
        ${LIVE_QUOTE_JOIN}
        WHERE s.rn = 1
      `;

  // Hybrid "best" sort: bucket by game proximity (tipping off / soon /
  // later / started-or-past), biggest edge first inside each bucket.
  // Lets the user scan for "what's both about to start AND mispriced"
  // without having to sort one column then squint at the other.
  //
  // Started/past games go to the LAST bucket so they don't pollute the
  // top of ?all=1 — a CLOSED row from 11h ago shouldn't share a bucket
  // with a market tipping off in 30 min.
  const PROXIMITY_BUCKET = `
    CASE
      WHEN (julianday(e.start_time) - julianday('now')) * 1440 < 0 THEN 3
      WHEN (julianday(e.start_time) - julianday('now')) * 1440 < 120 THEN 0
      WHEN (julianday(e.start_time) - julianday('now')) * 1440 < 1440 THEN 1
      ELSE 2
    END
  `;

  let orderBy: string;
  if (sort.key === "best") {
    orderBy = `${PROXIMITY_BUCKET} ASC, s.edge_pct_after_fees DESC, s.id DESC`;
  } else {
    const sortColumn = SORT_SQL[sort.key];
    const sortDir = sort.dir.toUpperCase() === "ASC" ? "ASC" : "DESC";
    orderBy = `${sortColumn} ${sortDir} NULLS LAST, s.id DESC`;
  }

  args.push(limit);
  const result = await db.execute({
    sql: `${baseSql}
      ORDER BY ${orderBy}
      LIMIT ?
    `,
    args,
  });
  // Validate at the DB boundary: the libsql column types are erased once
  // serialized and a backend column rename / type drift would silently corrupt
  // the table (string values would lexicographically sort, etc.). Skip rows
  // that don't parse rather than tearing down the whole page — the SR will
  // log them so the bad data is visible without taking down /signals.
  const validated: SignalRow[] = [];
  for (const raw of result.rows) {
    const parsed = SignalRowSchema.safeParse(raw);
    if (parsed.success) {
      validated.push(parsed.data as SignalRow);
    } else if (process.env.NODE_ENV !== "production") {
      console.warn("[fetchRecentSignals] dropped malformed row", parsed.error.issues);
    }
  }
  return validated;
}


/** Quick counts for the Live empty state. */
export interface LiveStats {
  signals_total: number;          // any +EV detection in the last 15m
  next_event_min: number | null;
  next_event_sport: string | null;
}

export async function fetchLiveStats(): Promise<LiveStats> {
  const db = getDb();
  const r = await db.execute(`
    WITH recent_signals AS (
      SELECT s.id,
             ROW_NUMBER() OVER (
               PARTITION BY s.kalshi_market_id, s.side
               ORDER BY s.detected_at DESC
             ) AS rn
      FROM signals s
      WHERE s.detected_at >= datetime('now', '-15 minutes')
    ),
    next_event AS (
      SELECT sport,
             CAST((julianday(start_time) - julianday('now')) * 1440 AS INTEGER) AS min_to_start
      FROM events
      WHERE start_time > datetime('now')
      ORDER BY start_time ASC
      LIMIT 1
    )
    SELECT
      (SELECT COUNT(*) FROM recent_signals WHERE rn = 1) AS signals_total,
      (SELECT min_to_start FROM next_event) AS next_event_min,
      (SELECT sport FROM next_event) AS next_event_sport
  `);
  const row = r.rows[0] as unknown as Record<string, unknown>;
  return {
    signals_total: Number(row.signals_total) || 0,
    next_event_min: row.next_event_min == null ? null : Number(row.next_event_min),
    next_event_sport: row.next_event_sport == null ? null : String(row.next_event_sport),
  };
}

export interface ClvOverall {
  n: number;
  n_resolved: number;
  avg_clv: number | null;
  pct_positive: number | null;
  avg_edge: number | null;
}

export async function fetchClvOverall(daysBack = 30): Promise<ClvOverall> {
  const db = getDb();
  const r = await db.execute({
    sql: `
      SELECT
        COUNT(*) AS n,
        SUM(CASE WHEN resolved_outcome IS NOT NULL THEN 1 ELSE 0 END) AS n_resolved,
        AVG(clv_pct) AS avg_clv,
        AVG(CASE WHEN clv_pct IS NULL THEN NULL WHEN clv_pct > 0 THEN 1.0 ELSE 0.0 END) AS pct_positive,
        AVG(edge_pct_after_fees) AS avg_edge
      FROM signals
      WHERE detected_at >= datetime('now', ?)
    `,
    args: [`-${daysBack} days`],
  });
  const row = r.rows[0] as unknown as Record<string, unknown>;
  return {
    n: Number(row.n) || 0,
    n_resolved: Number(row.n_resolved) || 0,
    avg_clv: row.avg_clv == null ? null : Number(row.avg_clv),
    pct_positive: row.pct_positive == null ? null : Number(row.pct_positive),
    avg_edge: row.avg_edge == null ? null : Number(row.avg_edge),
  };
}

export async function fetchActiveSports(): Promise<{ sport: string; n: number }[]> {
  const db = getDb();
  const r = await db.execute(`
    SELECT e.sport, COUNT(*) AS n
    FROM signals s
    JOIN kalshi_markets km ON s.kalshi_market_id = km.id
    JOIN events e ON km.event_id = e.id
    GROUP BY e.sport
    ORDER BY n DESC
  `);
  return r.rows.map((row) => {
    const o = row as unknown as Record<string, unknown>;
    return { sport: String(o.sport), n: Number(o.n) || 0 };
  });
}


export type SportActivityStatus = "live" | "soon" | "dark";

export interface SportActivity {
  sport: string;
  status: SportActivityStatus;
  next_event_in_hours: number | null;
  events_24h: number;
}

// Bucket cutoffs for the per-sport indicator dot. We only count FUTURE
// events — "active" should mean "we'd act on a signal right now," and
// signal generation skips in-progress games anyway. A game that ended
// two hours ago contributes nothing actionable to the dashboard, so
// having a sport stay green while its game finishes was misleading.
const SPORT_LIVE_HOURS = 2;     // game in next 2h → 🟢 (pre-game / actionable)
const SPORT_SOON_HOURS = 24;    // game in next 24h → 🟡 (signals coming)

// Cached across requests — the underlying event schedule changes
// roughly hourly (when new games get added) so a 60s revalidate is
// plenty fresh. Saves the dashboard from running this scan on every
// page render.
export const fetchSportActivity = unstable_cache(
  _fetchSportActivityImpl,
  ["fetch-sport-activity-v1"],
  { revalidate: 60, tags: ["sport-activity"] },
);

async function _fetchSportActivityImpl(): Promise<SportActivity[]> {
  const db = getDb();
  const r = await db.execute({
    sql: `
      SELECT
        sport,
        COUNT(*) AS events_24h,
        MIN((julianday(start_time) - julianday('now')) * 24) AS hours_to_next
      FROM events
      WHERE start_time >= datetime('now')
        AND start_time <= datetime('now', '+' || ? || ' hours')
      GROUP BY sport
    `,
    args: [SPORT_SOON_HOURS],
  });

  const rows = r.rows.map((row) => {
    const o = row as unknown as Record<string, unknown>;
    const hours = o.hours_to_next == null ? null : Number(o.hours_to_next);
    let status: SportActivityStatus = "dark";
    if (hours != null && hours <= SPORT_LIVE_HOURS) status = "live";
    else if (hours != null && hours <= SPORT_SOON_HOURS) status = "soon";
    return {
      sport: String(o.sport),
      status,
      next_event_in_hours: hours,
      events_24h: Number(o.events_24h) || 0,
    };
  });

  // Per-sport admin toggles. Default 1 (enabled) when the row is missing
  // so a fresh DB shows everything until the admin opts out.
  const enabled = new Map<string, number>([
    ["nhl", await getInt(KNOWN_KEYS.SPORT_ENABLED_NHL, 1)],
    ["nba", await getInt(KNOWN_KEYS.SPORT_ENABLED_NBA, 1)],
    ["mlb", await getInt(KNOWN_KEYS.SPORT_ENABLED_MLB, 1)],
    ["wnba", await getInt(KNOWN_KEYS.SPORT_ENABLED_WNBA, 1)],
    ["tennis_atp", await getInt(KNOWN_KEYS.SPORT_ENABLED_TENNIS_ATP, 1)],
    ["tennis_wta", await getInt(KNOWN_KEYS.SPORT_ENABLED_TENNIS_WTA, 1)],
  ]);

  // Drop rows for sports the admin has switched off.
  const visible = rows.filter((r) => (enabled.get(r.sport) ?? 1) === 1);

  // Backfill the sports we support but have no upcoming events for so the
  // dashboard shows them as 'dark' rather than hiding them entirely (silence
  // tells you "off-season / off-day," not "we forgot about this sport").
  // Tennis tournaments rotate weekly; the backend auto-discovers active
  // ATP/WTA tournament keys from the Odds API /sports endpoint and folds
  // them into the polling list, so tennis_atp / tennis_wta appear here
  // when there's a live tournament running.
  const known = ["nhl", "nba", "mlb", "wnba", "tennis_atp", "tennis_wta"];
  const seen = new Set(visible.map((r) => r.sport));
  for (const sport of known) {
    if (!seen.has(sport) && (enabled.get(sport) ?? 1) === 1) {
      visible.push({ sport, status: "dark", next_event_in_hours: null, events_24h: 0 });
    }
  }

  // Sort: live → soon → dark, then alphabetical within each.
  const order: Record<SportActivityStatus, number> = { live: 0, soon: 1, dark: 2 };
  visible.sort((a, b) => order[a.status] - order[b.status] || a.sport.localeCompare(b.sport));
  return visible;
}


export interface SignalDetail {
  signal: SignalRow;
  yes_book: { price: number; size: number }[];
  no_book: { price: number; size: number }[];
  contributing_books: {
    book: string;
    this_side_odds: number;
    other_side_odds: number;
    fair_prob: number;
    polled_at: string;
  }[];
  history: {
    id: number;
    detected_at: string;
    edge_pct_after_fees: number;
    side: "yes" | "no";
    kalshi_yes_ask: number;
    kalshi_no_ask: number;
    fair_yes_prob: number;
  }[];
}


export async function fetchSignalDetail(id: number): Promise<SignalDetail | null> {
  const db = getDb();

  const sigRes = await db.execute({
    sql: `
      SELECT s.id, s.detected_at,
             s.kalshi_yes_ask, s.kalshi_no_ask, s.fair_yes_prob,
             s.side, s.edge_pct_after_fees, s.edge_pct_after_fees_at_size,
             s.expected_fill_price, s.yes_book_depth,
             s.kalshi_staleness_sec, s.book_staleness_sec,
             s.match_confidence, s.alert_sent, s.n_books_used,
             s.closing_kalshi_yes_price, s.clv_pct, s.resolved_outcome,
             s.hypothetical_pnl,
             km.id AS kalshi_market_id,
             km.ticker, km.market_type, km.period, km.line, km.raw_title, km.side AS market_side,
             e.id AS event_id, e.home_team, e.away_team, e.start_time, e.sport,
             CAST((julianday(e.start_time) - julianday('now')) * 1440 AS INTEGER) AS time_to_start_min,
             lq.polled_at AS live_polled_at,
             CAST((julianday('now') - julianday(lq.polled_at)) * 86400 AS INTEGER) AS live_quote_age_sec
      FROM signals s
      JOIN kalshi_markets km ON s.kalshi_market_id = km.id
      JOIN events e ON km.event_id = e.id
      LEFT JOIN (
        SELECT market_id, MAX(polled_at) AS polled_at
        FROM kalshi_quotes
        GROUP BY market_id
      ) lq ON lq.market_id = s.kalshi_market_id
      WHERE s.id = ?
    `,
    args: [id],
  });
  if (sigRes.rows.length === 0) return null;
  const signalRow = sigRes.rows[0] as unknown as SignalRow & {
    kalshi_market_id: number;
    event_id: number;
  };

  // Latest Kalshi quote → orderbook JSON
  const quoteRes = await db.execute({
    sql: `
      SELECT yes_book_json, no_book_json
      FROM kalshi_quotes
      WHERE market_id = ?
      ORDER BY polled_at DESC
      LIMIT 1
    `,
    args: [signalRow.kalshi_market_id],
  });
  const quoteRow = quoteRes.rows[0] as unknown as
    | { yes_book_json: string | null; no_book_json: string | null }
    | undefined;

  function parseBook(json: string | null | undefined): { price: number; size: number }[] {
    if (!json) return [];
    try {
      const v = JSON.parse(json);
      return Array.isArray(v)
        ? v.filter((x) => x && typeof x === "object").map((x: { price: unknown; size: unknown }) => ({
            price: Number(x.price),
            size: Number(x.size),
          }))
        : [];
    } catch {
      return [];
    }
  }

  // Latest book quotes per book for both sides of the devig pair.
  // Mirrors the backend PAIRS dict in matcher/engine.py — keep them in sync.
  const PAIRS: Record<string, [string, string]> = {
    moneyline: ["home", "away"],
    puckline: ["home", "away"],
    runline: ["home", "away"],
    spread: ["home", "away"],
    total: ["over", "under"],
    period_total: ["over", "under"],
    period_moneyline: ["home", "away"],
    match_winner: ["home", "away"],  // tennis
  };
  const pair = PAIRS[signalRow.market_type];
  const otherSide = pair ? (signalRow.side === pair[0] ? pair[1] : pair[0]) : null;
  let contributing: SignalDetail["contributing_books"] = [];
  if (pair && otherSide) {
    const lineParam = signalRow.line ?? -9999;
    const booksRes = await db.execute({
      sql: `
        WITH latest AS (
          SELECT bm.id AS book_market_id, bm.book, bm.side, bq.decimal_odds, bq.polled_at,
                 ROW_NUMBER() OVER (PARTITION BY bm.id ORDER BY bq.polled_at DESC) AS rn
          FROM book_markets bm
          JOIN book_quotes bq ON bq.book_market_id = bm.id
          WHERE bm.event_id = ? AND bm.market_type = ? AND bm.period = ?
            AND bm.line = ? AND bm.side IN (?, ?)
        )
        SELECT book, side, decimal_odds, polled_at FROM latest WHERE rn = 1
      `,
      args: [
        signalRow.event_id,
        signalRow.market_type,
        signalRow.period,
        lineParam,
        signalRow.side,
        otherSide,
      ],
    });
    const byBook: Record<string, { this?: number; other?: number; polled?: string }> = {};
    for (const row of booksRes.rows) {
      const o = row as unknown as Record<string, unknown>;
      const book = String(o.book);
      const side = String(o.side);
      const odds = Number(o.decimal_odds);
      const polled = String(o.polled_at);
      const slot = byBook[book] ?? {};
      if (side === signalRow.side) slot.this = odds;
      else if (side === otherSide) slot.other = odds;
      slot.polled = !slot.polled || polled > slot.polled ? polled : slot.polled;
      byBook[book] = slot;
    }
    contributing = Object.entries(byBook)
      .filter(([, v]) => v.this != null && v.other != null)
      .map(([book, v]) => {
        const t = v.this!;
        const o = v.other!;
        const sumImplied = 1 / t + 1 / o;
        const fair = 1 / t / sumImplied;
        return {
          book,
          this_side_odds: t,
          other_side_odds: o,
          fair_prob: fair,
          polled_at: v.polled || "",
        };
      })
      .sort((a, b) => b.fair_prob - a.fair_prob);
  }

  // History of signals on this market (last 20).
  const histRes = await db.execute({
    sql: `
      SELECT id, detected_at, edge_pct_after_fees, side, kalshi_yes_ask, kalshi_no_ask, fair_yes_prob
      FROM signals
      WHERE kalshi_market_id = ?
      ORDER BY detected_at DESC
      LIMIT 20
    `,
    args: [signalRow.kalshi_market_id],
  });

  return {
    signal: signalRow,
    yes_book: parseBook(quoteRow?.yes_book_json),
    no_book: parseBook(quoteRow?.no_book_json),
    contributing_books: contributing,
    history: histRes.rows as unknown as SignalDetail["history"],
  };
}


export interface ClvDayPoint {
  day: string;          // YYYY-MM-DD UTC
  n: number;
  avg_clv: number | null;
}


export async function fetchClvDailyTrend(daysBack = 30): Promise<ClvDayPoint[]> {
  const db = getDb();
  const r = await db.execute({
    sql: `
      SELECT substr(detected_at, 1, 10) AS day,
             COUNT(*) AS n,
             AVG(clv_pct) AS avg_clv
      FROM signals
      WHERE detected_at >= datetime('now', ?)
        AND clv_pct IS NOT NULL
      GROUP BY day
      ORDER BY day
    `,
    args: [`-${daysBack} days`],
  });
  return r.rows.map((row) => {
    const o = row as unknown as Record<string, unknown>;
    return {
      day: String(o.day),
      n: Number(o.n) || 0,
      avg_clv: o.avg_clv == null ? null : Number(o.avg_clv),
    };
  });
}


export interface ClvBucket {
  bucket: string;
  n: number;
  avg_clv: number | null;
  avg_edge: number | null;
}

export async function fetchClvByEdgeBucket(): Promise<ClvBucket[]> {
  const db = getDb();
  const r = await db.execute(`
    SELECT
      CASE
        WHEN edge_pct_after_fees < 0.01 THEN '0-1%'
        WHEN edge_pct_after_fees < 0.02 THEN '1-2%'
        WHEN edge_pct_after_fees < 0.03 THEN '2-3%'
        WHEN edge_pct_after_fees < 0.05 THEN '3-5%'
        ELSE '5%+'
      END AS bucket,
      COUNT(*) AS n,
      AVG(clv_pct) AS avg_clv,
      AVG(edge_pct_after_fees) AS avg_edge
    FROM signals
    GROUP BY bucket
    ORDER BY MIN(edge_pct_after_fees)
  `);
  return r.rows.map((row) => {
    const o = row as unknown as Record<string, unknown>;
    return {
      bucket: String(o.bucket),
      n: Number(o.n),
      avg_clv: o.avg_clv == null ? null : Number(o.avg_clv),
      avg_edge: o.avg_edge == null ? null : Number(o.avg_edge),
    };
  });
}

export interface ClvByCategory {
  market_type: string;
  period: string;
  n: number;
  avg_clv: number | null;
  pct_positive: number | null;
}

export async function fetchClvByCategory(): Promise<ClvByCategory[]> {
  const db = getDb();
  const r = await db.execute(`
    SELECT km.market_type, km.period,
           COUNT(*) AS n,
           AVG(s.clv_pct) AS avg_clv,
           AVG(CASE WHEN s.clv_pct IS NULL THEN NULL WHEN s.clv_pct > 0 THEN 1.0 ELSE 0.0 END) AS pct_positive
    FROM signals s
    JOIN kalshi_markets km ON s.kalshi_market_id = km.id
    GROUP BY km.market_type, km.period
    ORDER BY n DESC
  `);
  return r.rows.map((row) => {
    const o = row as unknown as Record<string, unknown>;
    return {
      market_type: String(o.market_type),
      period: String(o.period),
      n: Number(o.n),
      avg_clv: o.avg_clv == null ? null : Number(o.avg_clv),
      pct_positive: o.pct_positive == null ? null : Number(o.pct_positive),
    };
  });
}

/** Breakdown of currently-unmatched Kalshi markets, grouped by what
 * they ARE so the gap is diagnosable.
 *
 * The cumulative `unmatched_kalshi_markets` table logs one row per
 * (market, reason) per day, so its size grows roughly linearly even
 * when nothing's wrong (any market without book coverage adds ~1 row
 * per day, forever). What actually matters is "which Kalshi markets
 * have NO matched book pair right now" — this query answers that. */
export interface UnmatchedBreakdownRow {
  sport: string;
  market_type: string;
  period: string;
  n_markets: number;
  sample_ticker: string | null;
}

export async function fetchUnmatchedBreakdown(): Promise<UnmatchedBreakdownRow[]> {
  const db = getDb();
  // A market is "currently unmatched" if it's active, pre-game, AND no
  // book quote exists for the same (event, market_type, period, line)
  // covering both sides of the devig pair. We approximate via an
  // anti-join on book_markets — any book row at all means we'd at
  // least try to match. (Imperfect: a one-sided book row would still
  // fail the matcher's PAIRS check, but it's a good enough first cut.)
  const r = await db.execute(`
    SELECT
      e.sport,
      km.market_type,
      km.period,
      COUNT(*) AS n_markets,
      MIN(km.ticker) AS sample_ticker
    FROM kalshi_markets km
    JOIN events e ON e.id = km.event_id
    WHERE km.status = 'active'
      AND e.start_time > datetime('now')
      AND NOT EXISTS (
        SELECT 1 FROM book_markets bm
        WHERE bm.event_id = km.event_id
          AND bm.market_type = km.market_type
          AND bm.period = km.period
          AND COALESCE(bm.line, -9999) = COALESCE(km.line, -9999)
      )
    GROUP BY e.sport, km.market_type, km.period
    ORDER BY n_markets DESC
    LIMIT 30
  `);
  return r.rows.map((row) => {
    const o = row as unknown as Record<string, unknown>;
    return {
      sport: String(o.sport),
      market_type: String(o.market_type),
      period: String(o.period),
      n_markets: Number(o.n_markets) || 0,
      sample_ticker: o.sample_ticker == null ? null : String(o.sample_ticker),
    };
  });
}


export interface ApiStatusRow {
  api: string;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  quota_remaining: number | null;
  quota_used: number | null;
  quota_reset_hint: string | null;
  metadata_json: string | null;
  updated_at: string;
}


export async function fetchApiStatus(): Promise<ApiStatusRow[]> {
  const db = getDb();
  try {
    const r = await db.execute(`
      SELECT api, last_success_at, last_error_at, last_error_message,
             quota_remaining, quota_used, quota_reset_hint,
             metadata_json, updated_at
      FROM api_status
      ORDER BY api
    `);
    return r.rows as unknown as ApiStatusRow[];
  } catch {
    return [];
  }
}


export interface HealthSnapshot {
  last_kalshi_poll: string | null;
  last_book_poll: string | null;
  signals_total: number;
  signals_last_24h: number;
  signals_resolved: number;
  signals_with_clv: number;
  signals_alerted: number;
  // "Currently unmatched" — pre-game active Kalshi markets with NO
  // book_markets row at the same (event, market_type, period, line).
  // The number that actually matters for matcher coverage. The
  // log table version (`unmatched_kalshi_count_cumulative`) grows
  // forever even when nothing's wrong.
  unmatched_kalshi_now: number;
  unmatched_kalshi_count_cumulative: number;
  signal_anomalies_count: number;
  events_active: number;
  active_kalshi_markets: number;
}

export async function fetchHealth(): Promise<HealthSnapshot> {
  const db = getDb();
  const [k, b, s, e, m, a, anomalies, unmatchedNow] = await Promise.all([
    db.execute("SELECT MAX(polled_at) FROM kalshi_quotes"),
    db.execute("SELECT MAX(polled_at) FROM book_quotes"),
    db.execute(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN detected_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END) AS last_24h,
        SUM(CASE WHEN resolved_outcome IS NOT NULL THEN 1 ELSE 0 END) AS resolved,
        SUM(CASE WHEN clv_pct IS NOT NULL THEN 1 ELSE 0 END) AS with_clv,
        SUM(CASE WHEN alert_sent = 1 THEN 1 ELSE 0 END) AS alerted
      FROM signals
    `),
    db.execute(`SELECT COUNT(*) FROM events WHERE start_time >= datetime('now', '-1 day')`),
    db.execute(`SELECT COUNT(*) FROM kalshi_markets WHERE status = 'active'`),
    db.execute(`SELECT COUNT(*) FROM unmatched_kalshi_markets`),
    db.execute(`SELECT COUNT(*) FROM signal_anomalies`),
    db.execute(`
      SELECT COUNT(*) AS n
      FROM kalshi_markets km
      JOIN events e ON e.id = km.event_id
      WHERE km.status = 'active'
        AND e.start_time > datetime('now')
        AND NOT EXISTS (
          SELECT 1 FROM book_markets bm
          WHERE bm.event_id = km.event_id
            AND bm.market_type = km.market_type
            AND bm.period = km.period
            AND COALESCE(bm.line, -9999) = COALESCE(km.line, -9999)
        )
    `),
  ]);
  const sRow = s.rows[0] as unknown as Record<string, unknown>;
  const unRow = unmatchedNow.rows[0] as unknown as Record<string, unknown>;
  return {
    last_kalshi_poll: (k.rows[0] as unknown as Record<string, unknown>)["MAX(polled_at)"] as
      | string
      | null,
    last_book_poll: (b.rows[0] as unknown as Record<string, unknown>)["MAX(polled_at)"] as
      | string
      | null,
    signals_total: Number(sRow.total) || 0,
    signals_last_24h: Number(sRow.last_24h) || 0,
    signals_resolved: Number(sRow.resolved) || 0,
    signals_with_clv: Number(sRow.with_clv) || 0,
    signals_alerted: Number(sRow.alerted) || 0,
    events_active: Number((e.rows[0] as unknown as Record<string, unknown>)["COUNT(*)"]) || 0,
    active_kalshi_markets: Number((m.rows[0] as unknown as Record<string, unknown>)["COUNT(*)"]) || 0,
    unmatched_kalshi_count_cumulative:
      Number((a.rows[0] as unknown as Record<string, unknown>)["COUNT(*)"]) || 0,
    unmatched_kalshi_now: Number(unRow.n) || 0,
    signal_anomalies_count:
      Number((anomalies.rows[0] as unknown as Record<string, unknown>)["COUNT(*)"]) || 0,
  };
}
