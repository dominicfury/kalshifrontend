/**
 * Alert subscription queries. Server-only.
 */
import "server-only";

import { getDb } from "./db";

export interface AlertSubscription {
  id: number;
  user_id: number;
  name: string;
  enabled: boolean;
  min_edge: number;
  min_n_books: number;
  sport: string | null;
  market_type: string | null;
  side: "yes" | "no" | null;
  require_at_size: boolean;
  cooldown_minutes: number;
  last_fired_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertLogRow {
  id: number;
  subscription_id: number;
  subscription_name: string | null;
  signal_id: number;
  sent_to_email: string | null;
  sent_at: string;
  error: string | null;
}

function rowToSub(o: Record<string, unknown>): AlertSubscription {
  return {
    id: Number(o.id),
    user_id: Number(o.user_id),
    name: String(o.name),
    enabled: Number(o.enabled) === 1,
    min_edge: Number(o.min_edge),
    min_n_books: Number(o.min_n_books),
    sport: o.sport == null ? null : String(o.sport),
    market_type: o.market_type == null ? null : String(o.market_type),
    side: o.side === "yes" || o.side === "no" ? o.side : null,
    require_at_size: Number(o.require_at_size) === 1,
    cooldown_minutes: Number(o.cooldown_minutes),
    last_fired_at: o.last_fired_at == null ? null : String(o.last_fired_at),
    created_at: String(o.created_at),
    updated_at: String(o.updated_at),
  };
}

const SUB_COLS = `id, user_id, name, enabled, min_edge, min_n_books, sport,
  market_type, side, require_at_size, cooldown_minutes, last_fired_at,
  created_at, updated_at`;

export async function listSubscriptionsForUser(
  user_id: number,
): Promise<AlertSubscription[]> {
  const db = getDb();
  const r = await db.execute({
    sql: `SELECT ${SUB_COLS} FROM alert_subscriptions
          WHERE user_id = ? ORDER BY created_at ASC`,
    args: [user_id],
  });
  return r.rows.map((row) => rowToSub(row as unknown as Record<string, unknown>));
}

export async function createSubscription(input: {
  user_id: number;
  name: string;
  min_edge: number;
  min_n_books: number;
  sport: string | null;
  market_type: string | null;
  side: "yes" | "no" | null;
  require_at_size: boolean;
  cooldown_minutes: number;
  enabled: boolean;
}): Promise<AlertSubscription> {
  const db = getDb();
  const r = await db.execute({
    sql: `INSERT INTO alert_subscriptions
            (user_id, name, enabled, min_edge, min_n_books, sport,
             market_type, side, require_at_size, cooldown_minutes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING ${SUB_COLS}`,
    args: [
      input.user_id,
      input.name,
      input.enabled ? 1 : 0,
      input.min_edge,
      input.min_n_books,
      input.sport,
      input.market_type,
      input.side,
      input.require_at_size ? 1 : 0,
      input.cooldown_minutes,
    ],
  });
  return rowToSub(r.rows[0] as unknown as Record<string, unknown>);
}

export async function findSubscription(
  id: number,
): Promise<AlertSubscription | null> {
  const db = getDb();
  const r = await db.execute({
    sql: `SELECT ${SUB_COLS} FROM alert_subscriptions WHERE id = ? LIMIT 1`,
    args: [id],
  });
  if (!r.rows.length) return null;
  return rowToSub(r.rows[0] as unknown as Record<string, unknown>);
}

export async function updateSubscription(
  id: number,
  patch: {
    name?: string;
    enabled?: boolean;
    min_edge?: number;
    min_n_books?: number;
    sport?: string | null;
    market_type?: string | null;
    side?: "yes" | "no" | null;
    require_at_size?: boolean;
    cooldown_minutes?: number;
  },
): Promise<AlertSubscription | null> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  if (patch.name !== undefined) {
    sets.push("name = ?");
    args.push(patch.name);
  }
  if (patch.enabled !== undefined) {
    sets.push("enabled = ?");
    args.push(patch.enabled ? 1 : 0);
  }
  if (patch.min_edge !== undefined) {
    sets.push("min_edge = ?");
    args.push(patch.min_edge);
  }
  if (patch.min_n_books !== undefined) {
    sets.push("min_n_books = ?");
    args.push(patch.min_n_books);
  }
  if (patch.sport !== undefined) {
    sets.push("sport = ?");
    args.push(patch.sport);
  }
  if (patch.market_type !== undefined) {
    sets.push("market_type = ?");
    args.push(patch.market_type);
  }
  if (patch.side !== undefined) {
    sets.push("side = ?");
    args.push(patch.side);
  }
  if (patch.require_at_size !== undefined) {
    sets.push("require_at_size = ?");
    args.push(patch.require_at_size ? 1 : 0);
  }
  if (patch.cooldown_minutes !== undefined) {
    sets.push("cooldown_minutes = ?");
    args.push(patch.cooldown_minutes);
  }
  if (!sets.length) return findSubscription(id);
  sets.push("updated_at = datetime('now')");
  args.push(id);
  const db = getDb();
  await db.execute({
    sql: `UPDATE alert_subscriptions SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
  return findSubscription(id);
}

export async function deleteSubscription(id: number): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `DELETE FROM alert_subscriptions WHERE id = ?`,
    args: [id],
  });
}

export async function listAlertLog(
  user_id: number,
  limit = 50,
): Promise<AlertLogRow[]> {
  const db = getDb();
  const r = await db.execute({
    sql: `SELECT a.id, a.subscription_id, s.name AS subscription_name,
                 a.signal_id, a.sent_to_email, a.sent_at, a.error
          FROM alert_log a
          JOIN alert_subscriptions s ON s.id = a.subscription_id
          WHERE s.user_id = ?
          ORDER BY a.sent_at DESC
          LIMIT ?`,
    args: [user_id, limit],
  });
  return r.rows.map((row) => {
    const o = row as unknown as Record<string, unknown>;
    return {
      id: Number(o.id),
      subscription_id: Number(o.subscription_id),
      subscription_name: o.subscription_name == null ? null : String(o.subscription_name),
      signal_id: Number(o.signal_id),
      sent_to_email: o.sent_to_email == null ? null : String(o.sent_to_email),
      sent_at: String(o.sent_at),
      error: o.error == null ? null : String(o.error),
    };
  });
}
