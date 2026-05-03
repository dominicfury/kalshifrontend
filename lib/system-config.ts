/**
 * Read/write helpers for the system_config table — runtime-editable
 * settings shared between backend (pollers) and frontend (UI gates).
 *
 * Keys are seeded by the backend on boot (see backend/db/sysconfig.py).
 * The frontend reads any value with a typed default fallback so a
 * missing row degrades gracefully instead of crashing the page.
 */
import "server-only";

import { getDb } from "./db";

export interface SystemConfigRow {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
  updated_by: number | null;
}

export const KNOWN_KEYS = {
  KALSHI_POLL_INTERVAL_SEC: "kalshi_poll_interval_sec",
  BOOK_POLL_INTERVAL_SEC: "book_poll_interval_sec",
  DEFAULT_AI_QUOTA_DAILY: "default_ai_quota_daily",
  ODDS_QUOTA_RESERVE: "odds_quota_reserve",
  USER_REPOLL_QUOTA_DAILY: "user_repoll_quota_daily",
  SIGNUPS_ENABLED: "signups_enabled",
  SPORT_ENABLED_NHL: "sport_enabled_nhl",
  SPORT_ENABLED_NBA: "sport_enabled_nba",
  SPORT_ENABLED_MLB: "sport_enabled_mlb",
  SPORT_ENABLED_WNBA: "sport_enabled_wnba",
  SPORT_ENABLED_TENNIS_ATP: "sport_enabled_tennis_atp",
  SPORT_ENABLED_TENNIS_WTA: "sport_enabled_tennis_wta",
} as const;

export const DEFAULT_VALUES: Record<string, string> = {
  [KNOWN_KEYS.KALSHI_POLL_INTERVAL_SEC]: "30",
  [KNOWN_KEYS.BOOK_POLL_INTERVAL_SEC]: "1800",
  [KNOWN_KEYS.DEFAULT_AI_QUOTA_DAILY]: "10",
  [KNOWN_KEYS.ODDS_QUOTA_RESERVE]: "1000",
  [KNOWN_KEYS.USER_REPOLL_QUOTA_DAILY]: "0",
  [KNOWN_KEYS.SIGNUPS_ENABLED]: "1",
  [KNOWN_KEYS.SPORT_ENABLED_NHL]: "1",
  [KNOWN_KEYS.SPORT_ENABLED_NBA]: "1",
  [KNOWN_KEYS.SPORT_ENABLED_MLB]: "1",
  [KNOWN_KEYS.SPORT_ENABLED_WNBA]: "1",
  [KNOWN_KEYS.SPORT_ENABLED_TENNIS_ATP]: "1",
  [KNOWN_KEYS.SPORT_ENABLED_TENNIS_WTA]: "1",
};

export async function getInt(key: string, fallback: number): Promise<number> {
  const db = getDb();
  const r = await db.execute({
    sql: `SELECT value FROM system_config WHERE key = ? LIMIT 1`,
    args: [key],
  });
  if (!r.rows.length) return fallback;
  const v = (r.rows[0] as unknown as Record<string, unknown>).value;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function getString(key: string, fallback: string): Promise<string> {
  const db = getDb();
  const r = await db.execute({
    sql: `SELECT value FROM system_config WHERE key = ? LIMIT 1`,
    args: [key],
  });
  if (!r.rows.length) return fallback;
  const v = (r.rows[0] as unknown as Record<string, unknown>).value;
  return v == null ? fallback : String(v);
}

// Boolean-ish read for "0"/"1" toggles. Anything other than "1" is treated
// as off, so an admin can disable by clearing the value too.
export async function getBool(key: string, fallback: boolean): Promise<boolean> {
  const v = await getString(key, fallback ? "1" : "0");
  return v === "1";
}

export async function listConfig(): Promise<SystemConfigRow[]> {
  const db = getDb();
  const r = await db.execute(
    `SELECT key, value, description, updated_at, updated_by
     FROM system_config ORDER BY key ASC`,
  );
  return r.rows.map((row) => {
    const o = row as unknown as Record<string, unknown>;
    return {
      key: String(o.key),
      value: String(o.value),
      description: o.description == null ? null : String(o.description),
      updated_at: String(o.updated_at),
      updated_by: o.updated_by == null ? null : Number(o.updated_by),
    };
  });
}

export async function setValue(
  key: string,
  value: string,
  by_user_id: number | null,
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO system_config (key, value, updated_by, updated_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_by = excluded.updated_by,
            updated_at = datetime('now')`,
    args: [key, value, by_user_id],
  });
}
