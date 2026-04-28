// Mirror of backend/db/models.py — keep in sync with KALSHI_NHL_EV_SPEC.md §5.

export type Side = "yes" | "no";
export type MarketType =
  | "moneyline"
  | "total"
  | "puckline"
  | "period_total"
  | "period_moneyline"
  | "first_to_score"
  | "both_teams_score";
export type Period = "full_game" | "p1" | "p2" | "p3" | "regulation" | "overtime";

export interface SignalRow {
  id: number;
  detected_at: string;
  kalshi_market_id: number;
  kalshi_yes_ask: number;
  fair_yes_prob: number;
  side: Side;
  edge_pct_after_fees: number;
  edge_pct_after_fees_at_size: number | null;
  kalshi_staleness_sec: number | null;
  book_staleness_sec: number | null;
  match_confidence: number;
  alert_sent: 0 | 1;
  clv_pct: number | null;
  resolved_outcome: "yes" | "no" | "void" | null;
  ticker: string;
  market_type: MarketType;
  period: Period;
  line: number | null;
  raw_title: string;
}
