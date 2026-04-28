import { getDb } from "./db";

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
  home_team: string;
  away_team: string;
  start_time: string;
  sport: string;
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
  detected_at: "s.detected_at",
  edge: "s.edge_pct_after_fees",
  edge_at_size: "COALESCE(s.edge_pct_after_fees_at_size, s.edge_pct_after_fees)",
  kalshi_yes_ask: "s.kalshi_yes_ask",
  fair: "s.fair_yes_prob",
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

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sortColumn = SORT_SQL[sort.key];
  const sortDir = sort.dir.toUpperCase() === "ASC" ? "ASC" : "DESC";

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
               km.ticker, km.market_type, km.period, km.line, km.raw_title,
               e.home_team, e.away_team, e.start_time, e.sport
        FROM signals s
        JOIN kalshi_markets km ON s.kalshi_market_id = km.id
        JOIN events e ON km.event_id = e.id
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
          ${whereSql.replace(/s\./g, "s.")}
        )
        SELECT s.id, s.detected_at,
               s.kalshi_yes_ask, s.kalshi_no_ask, s.fair_yes_prob,
               s.side, s.edge_pct_after_fees, s.edge_pct_after_fees_at_size,
               s.expected_fill_price, s.yes_book_depth,
               s.kalshi_staleness_sec, s.book_staleness_sec,
               s.match_confidence, s.alert_sent, s.n_books_used,
               s.closing_kalshi_yes_price, s.clv_pct, s.resolved_outcome,
               s.hypothetical_pnl,
               km.ticker, km.market_type, km.period, km.line, km.raw_title,
               e.home_team, e.away_team, e.start_time, e.sport
        FROM ranked s
        JOIN kalshi_markets km ON s.kalshi_market_id = km.id
        JOIN events e ON km.event_id = e.id
        WHERE s.rn = 1
      `;

  args.push(limit);
  const result = await db.execute({
    sql: `${baseSql}
      ORDER BY ${sortColumn} ${sortDir} NULLS LAST, s.id DESC
      LIMIT ?
    `,
    args,
  });
  return result.rows as unknown as SignalRow[];
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
             km.ticker, km.market_type, km.period, km.line, km.raw_title,
             e.id AS event_id, e.home_team, e.away_team, e.start_time, e.sport
      FROM signals s
      JOIN kalshi_markets km ON s.kalshi_market_id = km.id
      JOIN events e ON km.event_id = e.id
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
  const PAIRS: Record<string, [string, string]> = {
    moneyline: ["home", "away"],
    puckline: ["home", "away"],
    total: ["over", "under"],
    period_total: ["over", "under"],
    period_moneyline: ["home", "away"],
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
      SELECT id, detected_at, edge_pct_after_fees, side, kalshi_yes_ask, fair_yes_prob
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
  unmatched_kalshi_count: number;
  signal_anomalies_count: number;
  events_active: number;
  active_kalshi_markets: number;
}

export async function fetchHealth(): Promise<HealthSnapshot> {
  const db = getDb();
  const [k, b, s, e, m, a, an, anom] = await Promise.all([
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
    db.execute(`SELECT COUNT(*) FROM signal_anomalies`),
  ]);
  void anom;
  const sRow = s.rows[0] as unknown as Record<string, unknown>;
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
    unmatched_kalshi_count: Number((a.rows[0] as unknown as Record<string, unknown>)["COUNT(*)"]) || 0,
    signal_anomalies_count: Number((an.rows[0] as unknown as Record<string, unknown>)["COUNT(*)"]) || 0,
  };
}
