"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";

export interface BetFormState {
  ok: boolean;
  message: string;
  betId?: number;
}

const ALL_TAGS = [
  "model_only",
  "gut_override",
  "lineup_news",
  "late_money",
  "pinnacle_only",
  "sharp_action",
] as const;

function asNumber(form: FormData, key: string): number | null {
  const v = form.get(key);
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}


export async function logBetAction(
  _prev: BetFormState,
  form: FormData,
): Promise<BetFormState> {
  const ticker = String(form.get("ticker") || "").trim();
  const side = String(form.get("side") || "").trim() as "yes" | "no";
  const fillPrice = asNumber(form, "fill_price");
  const nContracts = asNumber(form, "n_contracts");
  const feesPaid = asNumber(form, "fees_paid") ?? 0;
  const placedAtRaw = String(form.get("placed_at") || "").trim();
  const signalIdRaw = form.get("signal_id");
  const signalId =
    signalIdRaw == null || signalIdRaw === "" ? null : Number(signalIdRaw);
  const notes = String(form.get("notes") || "").trim() || null;
  const tagsRaw = form.getAll("tags").map(String);
  const tags = ALL_TAGS.filter((t) => tagsRaw.includes(t));

  if (!ticker) return { ok: false, message: "ticker is required" };
  if (side !== "yes" && side !== "no") {
    return { ok: false, message: "side must be 'yes' or 'no'" };
  }
  if (fillPrice == null || fillPrice <= 0 || fillPrice >= 1) {
    return { ok: false, message: "fill_price must be between 0 and 1" };
  }
  if (nContracts == null || nContracts <= 0) {
    return { ok: false, message: "n_contracts must be > 0" };
  }

  const placedAt = placedAtRaw ? new Date(placedAtRaw).toISOString() : new Date().toISOString();

  const db = getDb();
  const lookup = await db.execute({
    sql: "SELECT id FROM kalshi_markets WHERE ticker = ?",
    args: [ticker],
  });
  if (lookup.rows.length === 0) {
    return { ok: false, message: `no kalshi_market with ticker '${ticker}'` };
  }
  const kalshiMarketId = Number(
    (lookup.rows[0] as unknown as Record<string, unknown>).id,
  );

  const stake = fillPrice * nContracts;
  const maxPayout = nContracts;

  const insert = await db.execute({
    sql: `
      INSERT INTO bets (
        signal_id, placed_at, kalshi_market_id, side, fill_price,
        n_contracts, stake, fees_paid, max_payout, tags, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
    args: [
      signalId,
      placedAt,
      kalshiMarketId,
      side,
      fillPrice,
      nContracts,
      stake,
      feesPaid,
      maxPayout,
      JSON.stringify(tags),
      notes,
    ],
  });
  const betId = Number(
    (insert.rows[0] as unknown as Record<string, unknown>).id,
  );

  revalidatePath("/bets");
  return { ok: true, message: `bet #${betId} logged`, betId };
}


export const KNOWN_TAGS = ALL_TAGS;
