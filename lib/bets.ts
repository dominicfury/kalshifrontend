/**
 * Bet tracking. A "bet" is a signal the admin marked as "I'm tracking
 * this for resolution and CLV." Lives in the bets table; settlement
 * worker fills closing_kalshi_price, outcome, realized_pnl, clv_pct
 * once the underlying game settles.
 *
 * Server-only (writes go through admin-gated API routes).
 */
import "server-only";

import { getDb } from "./db";


export interface BetRow {
  id: number;
  signal_id: number | null;
  placed_at: string;
  kalshi_market_id: number;
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
  notes: string | null;
  created_at: string;
}


/** Kalshi taker fee per contract for a given price + size. Mirrors
 *  backend/ev/fees.py:kalshi_taker_fee — total fee is ceil to whole
 *  cents (7n × p × (1-p)), so we ceil at total then divide. */
export function kalshiTakerFeeTotal(price: number, n_contracts: number): number {
  if (price <= 0 || price >= 1 || n_contracts <= 0) return 0;
  const raw = 7 * n_contracts * price * (1 - price); // cents (×100)
  return Math.ceil(raw) / 100;
}


/** Insert a bet for a signal. Returns null if a bet for that signal already
 *  exists (idempotent track button — clicking + on an already-tracked signal
 *  is a no-op). Throws on other DB errors so callers can surface them. */
export async function createBetForSignal(input: {
  signal_id: number;
  kalshi_market_id: number;
  side: "yes" | "no";
  fill_price: number;
  n_contracts: number;
}): Promise<BetRow | null> {
  const db = getDb();

  // Idempotency: bail if already tracked.
  const existing = await db.execute({
    sql: `SELECT id FROM bets WHERE signal_id = ? LIMIT 1`,
    args: [input.signal_id],
  });
  if (existing.rows.length > 0) return null;

  const stake = input.fill_price * input.n_contracts;
  const fees_paid = kalshiTakerFeeTotal(input.fill_price, input.n_contracts);
  const max_payout = input.n_contracts; // $1 per contract on win

  const result = await db.execute({
    sql: `INSERT INTO bets (
            signal_id, placed_at, kalshi_market_id, side,
            fill_price, n_contracts, stake, fees_paid, max_payout
          )
          VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?)
          RETURNING id, signal_id, placed_at, kalshi_market_id, side,
                    fill_price, n_contracts, stake, fees_paid, max_payout,
                    closing_kalshi_price, settled_at, outcome,
                    realized_pnl, clv_pct, notes, created_at`,
    args: [
      input.signal_id,
      input.kalshi_market_id,
      input.side,
      input.fill_price,
      input.n_contracts,
      stake,
      fees_paid,
      max_payout,
    ],
  });
  if (!result.rows.length) return null;
  return rowToBet(result.rows[0] as Record<string, unknown>);
}


export async function deleteBetBySignalId(signal_id: number): Promise<boolean> {
  const db = getDb();
  // Pre-count so we can report whether anything was actually deleted.
  // Turso's libsql_client occasionally throws KeyError('result') on DELETE
  // response parsing even when the delete applied — wrap to keep the
  // route responsive.
  const before = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM bets WHERE signal_id = ?`,
    args: [signal_id],
  });
  const had = Number((before.rows[0] as Record<string, unknown>).n) || 0;
  if (had === 0) return false;
  try {
    await db.execute({
      sql: `DELETE FROM bets WHERE signal_id = ?`,
      args: [signal_id],
    });
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("result")) throw e;
  }
  return true;
}


function rowToBet(o: Record<string, unknown>): BetRow {
  return {
    id: Number(o.id),
    signal_id: o.signal_id == null ? null : Number(o.signal_id),
    placed_at: String(o.placed_at),
    kalshi_market_id: Number(o.kalshi_market_id),
    side: o.side === "no" ? "no" : "yes",
    fill_price: Number(o.fill_price),
    n_contracts: Number(o.n_contracts),
    stake: Number(o.stake),
    fees_paid: Number(o.fees_paid),
    max_payout: Number(o.max_payout),
    closing_kalshi_price:
      o.closing_kalshi_price == null ? null : Number(o.closing_kalshi_price),
    settled_at: o.settled_at == null ? null : String(o.settled_at),
    outcome:
      o.outcome === "yes" || o.outcome === "no" || o.outcome === "void"
        ? o.outcome
        : null,
    realized_pnl: o.realized_pnl == null ? null : Number(o.realized_pnl),
    clv_pct: o.clv_pct == null ? null : Number(o.clv_pct),
    notes: o.notes == null ? null : String(o.notes),
    created_at: String(o.created_at),
  };
}
