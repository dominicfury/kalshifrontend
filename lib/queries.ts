import { getDb } from "./db";

export async function fetchRecentSignals(limit = 100) {
  const db = getDb();
  const result = await db.execute({
    sql: `
      SELECT s.id, s.detected_at, s.kalshi_market_id,
             s.kalshi_yes_ask, s.fair_yes_prob,
             s.side, s.edge_pct_after_fees, s.edge_pct_after_fees_at_size,
             s.kalshi_staleness_sec, s.book_staleness_sec,
             s.match_confidence, s.alert_sent,
             s.clv_pct, s.resolved_outcome,
             km.ticker, km.market_type, km.period, km.line, km.raw_title
      FROM signals s
      JOIN kalshi_markets km ON s.kalshi_market_id = km.id
      ORDER BY s.detected_at DESC
      LIMIT ?
    `,
    args: [limit],
  });
  return result.rows;
}
