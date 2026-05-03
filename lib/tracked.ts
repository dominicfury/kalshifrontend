/**
 * Tracked-signal CRUD. A "tracked" signal is one the admin marked
 * (+track button) so it gets counted toward CLV/resolution rollups
 * on the /clv tab. Pure marker semantics — no fill price, contracts,
 * or stake. CLV math reads from signals.clv_pct (filled by the
 * settlement worker for every signal automatically); the join through
 * tracked_signals is what filters the /clv view to "what I marked."
 */
import "server-only";

import { getDb } from "./db";


export async function trackSignal(signal_id: number): Promise<boolean> {
  const db = getDb();
  // Idempotent: PRIMARY KEY on signal_id makes a re-insert a no-op via
  // INSERT OR IGNORE. Returns whether anything was actually written.
  const before = await db.execute({
    sql: `SELECT 1 FROM tracked_signals WHERE signal_id = ? LIMIT 1`,
    args: [signal_id],
  });
  if (before.rows.length > 0) return false;
  try {
    await db.execute({
      sql: `INSERT OR IGNORE INTO tracked_signals (signal_id) VALUES (?)`,
      args: [signal_id],
    });
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("result")) throw e;
  }
  return true;
}


export async function untrackSignal(signal_id: number): Promise<boolean> {
  const db = getDb();
  const before = await db.execute({
    sql: `SELECT 1 FROM tracked_signals WHERE signal_id = ? LIMIT 1`,
    args: [signal_id],
  });
  if (before.rows.length === 0) return false;
  try {
    await db.execute({
      sql: `DELETE FROM tracked_signals WHERE signal_id = ?`,
      args: [signal_id],
    });
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("result")) throw e;
  }
  return true;
}
