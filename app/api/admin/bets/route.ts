import { NextResponse } from "next/server";

import { createBetForSignal } from "@/lib/bets";
import { getDb } from "@/lib/db";
import { suggestedContracts } from "@/lib/kelly";
import { isSameOrigin, requireAdmin } from "@/lib/session";
import { findUserById } from "@/lib/users";

export const runtime = "nodejs";

/**
 * POST /api/admin/bets
 *   body: { signal_id: number }
 *
 * Idempotent track-button handler. Reads the signal + admin's bankroll,
 * computes ¼-Kelly contracts at current fill price, inserts a bets row.
 * Returns the new bet, or { tracked: true } if the signal was already
 * tracked.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const claims = await requireAdmin();
  if (!claims) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { signal_id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const signal_id = Number(body.signal_id);
  if (!Number.isInteger(signal_id) || signal_id <= 0) {
    return NextResponse.json({ error: "signal_id required" }, { status: 400 });
  }

  // Pull the signal row + admin's bankroll in parallel.
  const db = getDb();
  const [sigResult, admin] = await Promise.all([
    db.execute({
      sql: `SELECT id, kalshi_market_id, side, kalshi_yes_ask, kalshi_no_ask,
                   fair_yes_prob, edge_pct_after_fees
            FROM signals WHERE id = ?`,
      args: [signal_id],
    }),
    findUserById(claims.sub),
  ]);
  if (sigResult.rows.length === 0) {
    return NextResponse.json({ error: "signal not found" }, { status: 404 });
  }
  if (!admin) {
    return NextResponse.json({ error: "admin lookup failed" }, { status: 500 });
  }
  const sigRow = sigResult.rows[0] as Record<string, unknown>;
  const sigSide = sigRow.side === "no" ? "no" : "yes";
  const sigForKelly = {
    side: sigSide as "yes" | "no",
    fair_yes_prob: Number(sigRow.fair_yes_prob),
    kalshi_yes_ask: Number(sigRow.kalshi_yes_ask),
    kalshi_no_ask: Number(sigRow.kalshi_no_ask),
    edge_pct_after_fees: Number(sigRow.edge_pct_after_fees),
  };
  const fill_price =
    sigSide === "yes" ? sigForKelly.kalshi_yes_ask : sigForKelly.kalshi_no_ask;
  const bankroll = Number(admin.bankroll_dollars) || 0;
  const n_contracts = suggestedContracts(sigForKelly, bankroll);

  if (n_contracts <= 0) {
    // Edge below 2% gate, or bankroll/price unworkable. Refuse rather than
    // create a zero-contract bet row that's just metadata noise.
    return NextResponse.json(
      {
        error:
          "no recommended stake — edge below 2% gate or bankroll insufficient",
      },
      { status: 400 },
    );
  }

  try {
    const bet = await createBetForSignal({
      signal_id,
      kalshi_market_id: Number(sigRow.kalshi_market_id),
      side: sigSide as "yes" | "no",
      fill_price,
      n_contracts,
    });
    if (!bet) {
      return NextResponse.json({ tracked: true, already: true });
    }
    return NextResponse.json({ tracked: true, bet });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "track failed" },
      { status: 500 },
    );
  }
}
