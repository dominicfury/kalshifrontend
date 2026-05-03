import type { SignalRow } from "@/lib/queries";

/**
 * Minimum edge_pct_after_fees at which we surface a stake suggestion.
 * Below this, ¼-Kelly rounds toward zero and surfacing a stake number
 * tempts action on signals the system explicitly hasn't validated yet
 * via CLV. Track-only for sub-2% rows.
 */
export const STAKE_GATE_EDGE_PCT = 0.02;

/**
 * Quarter-Kelly stake as a fraction of bankroll (e.g. 0.0061 = 0.61%).
 * Bankroll-agnostic so any user multiplies by their own bankroll size:
 *   stake_dollars = bankroll_dollars × suggestedStakeFraction(s)
 *
 * Returns null when edge is below the gate, or when Kelly evaluates
 * non-positive (shouldn't happen on a +EV row, but guard anyway).
 *
 * Math (with Kalshi taker fee approximated as 0.07 × p × (1-p)):
 *   net_odds b = (1 - price - fee) / (price + fee)
 *   full_kelly = (p_win × b − (1 − p_win)) / b
 *   ¼ Kelly  = 0.25 × full_kelly
 *
 * Quarter Kelly absorbs edge-estimate uncertainty: every consensus model
 * overstates edge sometimes, and full Kelly assumes the estimate is
 * exact. ¼ is the standard professional safety factor.
 */
export function suggestedStakeFraction(
  s: Pick<
    SignalRow,
    "side" | "fair_yes_prob" | "kalshi_yes_ask" | "kalshi_no_ask" | "edge_pct_after_fees"
  >,
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
  return 0.25 * fullKelly;
}


/** Concrete contract count for the +track button: floor(¼-Kelly × bankroll / fill_price).
 *  Returns 0 if the signal isn't eligible for a stake suggestion (below 2% gate, etc.).
 *  Never returns a fractional number — Kalshi only fills whole contracts. */
export function suggestedContracts(
  s: Pick<
    import("@/lib/queries").SignalRow,
    "side" | "fair_yes_prob" | "kalshi_yes_ask" | "kalshi_no_ask" | "edge_pct_after_fees"
  >,
  bankroll: number,
): number {
  const frac = suggestedStakeFraction(s);
  if (frac == null || bankroll <= 0) return 0;
  const fillPrice = s.side === "yes" ? s.kalshi_yes_ask : s.kalshi_no_ask;
  if (fillPrice <= 0 || fillPrice >= 1) return 0;
  const stakeDollars = bankroll * frac;
  return Math.max(0, Math.floor(stakeDollars / fillPrice));
}
