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
}

export async function fetchRecentSignals(limit = 100): Promise<SignalRow[]> {
  const db = getDb();
  const result = await db.execute({
    sql: `
      SELECT s.id, s.detected_at,
             s.kalshi_yes_ask, s.kalshi_no_ask, s.fair_yes_prob,
             s.side, s.edge_pct_after_fees, s.edge_pct_after_fees_at_size,
             s.expected_fill_price, s.yes_book_depth,
             s.kalshi_staleness_sec, s.book_staleness_sec,
             s.match_confidence, s.alert_sent, s.n_books_used,
             s.closing_kalshi_yes_price, s.clv_pct, s.resolved_outcome,
             s.hypothetical_pnl,
             km.ticker, km.market_type, km.period, km.line, km.raw_title,
             e.home_team, e.away_team, e.start_time
      FROM signals s
      JOIN kalshi_markets km ON s.kalshi_market_id = km.id
      JOIN events e ON km.event_id = e.id
      ORDER BY s.detected_at DESC
      LIMIT ?
    `,
    args: [limit],
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
