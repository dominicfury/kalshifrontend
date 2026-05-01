import type { SignalRow } from "@/lib/queries";

/**
 * Default bankroll (USD). Hardcoded for v1 — should become a per-user
 * setting once `users.bankroll_dollars` exists. Anyone with a different
 * bankroll can mentally scale the suggested stake by their actual size.
 */
export const DEFAULT_BANKROLL = 100;

/**
 * Minimum edge_pct_after_fees at which we surface a stake suggestion.
 * Below this, ¼-Kelly rounds to pennies; surfacing a stake number on a
 * 0.5%-edge row tempts action that the system explicitly hasn't validated
 * yet (CLV pipeline). Track-only for sub-2% rows.
 */
export const STAKE_GATE_EDGE_PCT = 0.02;

/**
 * Quarter-Kelly stake in dollars for the +EV side of a signal. Returns
 * null when edge is below the gate, or when Kelly evaluates non-positive
 * (shouldn't happen on a +EV row, but guard anyway).
 *
 * Math (with Kalshi taker fee approximated as 0.07 × p × (1-p)):
 *   net_odds b = (1 - price - fee) / (price + fee)
 *   full_kelly = (p_win × b − (1 − p_win)) / b
 *   ¼ Kelly  = 0.25 × full_kelly × bankroll
 *
 * Quarter Kelly absorbs edge-estimate uncertainty: every consensus model
 * overstates edge sometimes, and full Kelly assumes the estimate is
 * exact. ¼ is the standard professional safety factor.
 */
export function suggestedStakeDollars(
  s: Pick<
    SignalRow,
    "side" | "fair_yes_prob" | "kalshi_yes_ask" | "kalshi_no_ask" | "edge_pct_after_fees"
  >,
  bankroll: number = DEFAULT_BANKROLL,
): number | null {
  if (s.edge_pct_after_fees < STAKE_GATE_EDGE_PCT) return null;
  const p_win = s.side === "yes" ? s.fair_yes_prob : 1 - s.fair_yes_prob;
  const price = s.side === "yes" ? s.kalshi_yes_ask : s.kalshi_no_ask;
  if (price <= 0 || price >= 1) return null;
  const fee = 0.07 * price * (1 - price);
  const profitIfWin = 1 - price - fee;
  const lossIfLose = price + fee;
  if (profitIfWin <= 0 || lossIfLose <= 0) return null;
  const b = profitIfWin / lossIfLose;
  const fullKelly = (p_win * b - (1 - p_win)) / b;
  if (fullKelly <= 0) return null;
  return 0.25 * fullKelly * bankroll;
}
