import { getDb } from "./db";

export interface BetRow {
  id: number;
  signal_id: number | null;
  placed_at: string;
  side: "yes" | "no";
  fill_price: number;
  n_contracts: number;
  stake: number;
  fees_paid: number;
  max_payout: number;
  closing_kalshi_price: number | null;
  settled_at: string | null;
  outcome: "yes" | "no" | "void" | null;
  realized_pnl: number | null;
  clv_pct: number | null;
  tags: string;  // JSON-encoded list
  notes: string | null;
  ticker: string;
  market_type: string;
  period: string;
  line: number | null;
  home_team: string;
  away_team: string;
  start_time: string;
}

export async function fetchBets(limit = 200): Promise<BetRow[]> {
  const db = getDb();
  const r = await db.execute({
    sql: `
      SELECT
        b.id, b.signal_id, b.placed_at, b.side, b.fill_price, b.n_contracts,
        b.stake, b.fees_paid, b.max_payout,
        b.closing_kalshi_price, b.settled_at, b.outcome,
        b.realized_pnl, b.clv_pct,
        b.tags, b.notes,
        km.ticker, km.market_type, km.period, km.line,
        e.home_team, e.away_team, e.start_time
      FROM bets b
      JOIN kalshi_markets km ON km.id = b.kalshi_market_id
      JOIN events e ON e.id = km.event_id
      ORDER BY b.placed_at DESC
      LIMIT ?
    `,
    args: [limit],
  });
  return r.rows as unknown as BetRow[];
}


export interface BetAggregate {
  n_bets: number;
  total_stake: number;
  total_pnl: number;
  realized_n: number;
  roi: number | null;
  avg_clv: number | null;
}

export async function fetchBetAggregate(): Promise<BetAggregate> {
  const db = getDb();
  const r = await db.execute(`
    SELECT
      COUNT(*) AS n,
      COALESCE(SUM(stake), 0) AS stake,
      COALESCE(SUM(realized_pnl), 0) AS pnl,
      SUM(CASE WHEN outcome IS NOT NULL THEN 1 ELSE 0 END) AS resolved,
      AVG(clv_pct) AS avg_clv
    FROM bets
  `);
  const o = r.rows[0] as unknown as Record<string, unknown>;
  const stake = Number(o.stake) || 0;
  const pnl = Number(o.pnl) || 0;
  const resolved = Number(o.resolved) || 0;
  return {
    n_bets: Number(o.n) || 0,
    total_stake: stake,
    total_pnl: pnl,
    realized_n: resolved,
    roi: resolved > 0 && stake > 0 ? pnl / stake : null,
    avg_clv: o.avg_clv == null ? null : Number(o.avg_clv),
  };
}


export interface OpenSignalForBet {
  id: number;
  ticker: string;
  side: "yes" | "no";
  edge_pct_after_fees: number;
  kalshi_yes_ask: number;
  kalshi_no_ask: number;
  market_type: string;
  home_team: string;
  away_team: string;
  start_time: string;
}

export async function fetchOpenSignalsForBet(): Promise<OpenSignalForBet[]> {
  const db = getDb();
  const r = await db.execute(`
    SELECT s.id, km.ticker, s.side, s.edge_pct_after_fees,
           s.kalshi_yes_ask, s.kalshi_no_ask, km.market_type,
           e.home_team, e.away_team, e.start_time
    FROM signals s
    JOIN kalshi_markets km ON km.id = s.kalshi_market_id
    JOIN events e ON e.id = km.event_id
    WHERE s.resolved_outcome IS NULL
      AND e.start_time >= datetime('now', '-1 hour')
    ORDER BY s.detected_at DESC
    LIMIT 50
  `);
  return r.rows as unknown as OpenSignalForBet[];
}
