/**
 * DB-backed sliding-window rate limiter.
 *
 * Backed by `auth_rate_limit_events` (created idempotently). One row per
 * event; counted within a window. Suitable for low-volume auth endpoints
 * (login, signup, verify-email) where the cost of a DB write per attempt
 * is negligible compared to the cost of bcrypt or email send.
 *
 * Edge cases:
 *   - The table is created lazily on first use via CREATE IF NOT EXISTS.
 *     This avoids requiring a migration step on deploy.
 *   - Old rows are pruned opportunistically (5% of calls do a DELETE of
 *     rows older than 24h) to keep the table bounded without a cron.
 *   - Failures to write the event are non-fatal: if the DB is down we
 *     fall back to allowing the request (better than locking everyone out
 *     during an outage). The actual bcrypt / email cost still applies.
 */
import "server-only";

import { getDb } from "./db";


let _tableReady = false;

async function ensureTable(): Promise<void> {
  if (_tableReady) return;
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS auth_rate_limit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bucket TEXT NOT NULL,
      key TEXT NOT NULL,
      ts TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_arl_bucket_key_ts
      ON auth_rate_limit_events(bucket, key, ts)
  `);
  _tableReady = true;
}


export interface RateLimitResult {
  allowed: boolean;
  /** Recent attempt count inside the window (including the current one if recorded). */
  count: number;
  /** Suggested seconds the client should back off if blocked. */
  retryAfterSec: number;
}


/**
 * Check + record an attempt against a (bucket, key) pair. Returns
 * `allowed: false` when the recent count is at or above `max` within the
 * sliding window.
 *
 * `record` controls whether this call writes an event row. Pass `false`
 * for a pre-flight peek (e.g. show "rate limited" UX before bcrypt) and
 * `true` for the actual attempt. Most callers want `true`.
 */
export async function checkRateLimit(opts: {
  bucket: string;
  key: string;
  max: number;
  windowSec: number;
  record?: boolean;
}): Promise<RateLimitResult> {
  const { bucket, key, max, windowSec, record = true } = opts;
  if (!key) return { allowed: true, count: 0, retryAfterSec: 0 };
  try {
    await ensureTable();
    const db = getDb();
    const r = await db.execute({
      sql: `SELECT COUNT(*) AS n FROM auth_rate_limit_events
            WHERE bucket = ? AND key = ?
              AND ts >= datetime('now', ?)`,
      args: [bucket, key, `-${windowSec} seconds`],
    });
    const count = Number(
      (r.rows[0] as unknown as Record<string, unknown>).n ?? 0,
    );
    const allowed = count < max;
    if (record && allowed) {
      await db.execute({
        sql: `INSERT INTO auth_rate_limit_events (bucket, key) VALUES (?, ?)`,
        args: [bucket, key],
      });
    }
    // Opportunistic prune of rows >24h old to keep the table small.
    if (Math.random() < 0.05) {
      try {
        await db.execute(
          `DELETE FROM auth_rate_limit_events
           WHERE ts < datetime('now', '-24 hours')`,
        );
      } catch {
        // Pruning is best-effort.
      }
    }
    return {
      allowed,
      count: allowed && record ? count + 1 : count,
      retryAfterSec: allowed ? 0 : windowSec,
    };
  } catch (e) {
    // Fail open: a DB outage shouldn't lock everyone out.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[rate-limit] failure (failing open):", e);
    }
    return { allowed: true, count: 0, retryAfterSec: 0 };
  }
}


export function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // Take the first hop. xff is comma-separated and the leftmost is the
    // originating client (subsequent hops are proxies). On Vercel/Cloudflare
    // this is reasonably trustworthy for rate-limit purposes; an attacker
    // who can spoof XFF directly to the origin (no upstream proxy) gets per-
    // header keying which is still better than nothing.
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}
