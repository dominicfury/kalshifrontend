/**
 * User and activity-log queries. Server-only (the frontend never sees
 * password hashes). All callers must check role gates before invoking
 * the admin-scoped functions.
 */
import "server-only";

import bcrypt from "bcryptjs";

import { getDb } from "./db";

export interface UserRow {
  id: number;
  username: string;
  email: string | null;
  role: "user" | "admin";
  ai_quota_daily: number;
  repoll_quota_daily: number;
  disabled: boolean;
  last_login_at: string | null;
  created_at: string;
  email_verified: boolean;
  signup_method: "admin" | "self";
  verified: boolean;
  verified_at: string | null;
  verified_by: number | null;
}

export interface UserWithHash extends UserRow {
  password_hash: string;
}

export type ActivityAction =
  | "login"
  | "login_failed"
  | "logout"
  | "ai_chat"
  | "ai_quota_blocked"
  | "repoll"
  | "repoll_quota_blocked";

export interface ActivityRow {
  id: number;
  user_id: number;
  username: string;
  action: ActivityAction;
  metadata_json: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

function rowToUser(o: Record<string, unknown>): UserRow {
  return {
    id: Number(o.id),
    username: String(o.username),
    email: o.email == null ? null : String(o.email),
    role: o.role === "admin" ? "admin" : "user",
    ai_quota_daily: Number(o.ai_quota_daily),
    repoll_quota_daily: Number(o.repoll_quota_daily),
    disabled: Number(o.disabled) === 1,
    last_login_at: o.last_login_at == null ? null : String(o.last_login_at),
    created_at: String(o.created_at),
    email_verified: Number(o.email_verified ?? 0) === 1,
    signup_method: o.signup_method === "self" ? "self" : "admin",
    verified: Number(o.verified ?? 0) === 1,
    verified_at: o.verified_at == null ? null : String(o.verified_at),
    verified_by: o.verified_by == null ? null : Number(o.verified_by),
  };
}

const USER_SELECT_COLS = `id, username, email, role, ai_quota_daily,
  repoll_quota_daily, disabled, last_login_at, created_at,
  email_verified, signup_method, verified, verified_at, verified_by`;

export async function findUserByUsername(
  username: string,
): Promise<UserWithHash | null> {
  const db = getDb();
  const r = await db.execute({
    sql: `SELECT ${USER_SELECT_COLS}, password_hash
          FROM users WHERE username = ? COLLATE NOCASE LIMIT 1`,
    args: [username],
  });
  if (!r.rows.length) return null;
  const o = r.rows[0] as unknown as Record<string, unknown>;
  return { ...rowToUser(o), password_hash: String(o.password_hash) };
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const db = getDb();
  const r = await db.execute({
    sql: `SELECT ${USER_SELECT_COLS} FROM users
          WHERE email = ? COLLATE NOCASE LIMIT 1`,
    args: [email],
  });
  if (!r.rows.length) return null;
  return rowToUser(r.rows[0] as unknown as Record<string, unknown>);
}

export async function findUserById(id: number): Promise<UserRow | null> {
  const db = getDb();
  const r = await db.execute({
    sql: `SELECT ${USER_SELECT_COLS} FROM users WHERE id = ? LIMIT 1`,
    args: [id],
  });
  if (!r.rows.length) return null;
  return rowToUser(r.rows[0] as unknown as Record<string, unknown>);
}

export async function listUsers(): Promise<UserRow[]> {
  const db = getDb();
  const r = await db.execute(
    `SELECT ${USER_SELECT_COLS} FROM users
     ORDER BY role DESC, created_at ASC`,
  );
  return r.rows.map((row) => rowToUser(row as unknown as Record<string, unknown>));
}

export async function createUser(input: {
  username: string;
  email?: string | null;
  password: string;
  role?: "user" | "admin";
  ai_quota_daily?: number;
  repoll_quota_daily?: number;
  signup_method?: "admin" | "self";
  email_verified?: boolean;     // admin-created users skip email verify
  email_verification_code?: string | null;
  email_verification_expires_at?: string | null;
}): Promise<UserRow> {
  const password_hash = await bcrypt.hash(input.password, 12);
  const role = input.role ?? "user";
  const signup_method = input.signup_method ?? "admin";
  // Admin-created users are auto-verified on both gates. Self-signups
  // need email verify first AND admin verify within 12h.
  const auto_verified = signup_method === "admin" ? 1 : 0;
  const email_verified = input.email_verified ? 1 : auto_verified;
  const db = getDb();
  const r = await db.execute({
    sql: `INSERT INTO users
            (username, email, password_hash, role, ai_quota_daily, repoll_quota_daily, disabled,
             email_verified, email_verification_code, email_verification_expires_at,
             signup_method, verified, verified_at)
          VALUES (?, ?, ?, ?, ?, ?, 0,
                  ?, ?, ?,
                  ?, ?, ?)
          RETURNING ${USER_SELECT_COLS}`,
    args: [
      input.username,
      input.email ?? null,
      password_hash,
      role,
      input.ai_quota_daily ?? 10,
      input.repoll_quota_daily ?? 3,
      email_verified,
      input.email_verification_code ?? null,
      input.email_verification_expires_at ?? null,
      signup_method,
      auto_verified,
      auto_verified ? new Date().toISOString() : null,
    ],
  });
  return rowToUser(r.rows[0] as unknown as Record<string, unknown>);
}

/** Set/replace the email verification code on a user (used on signup
 * and resend-code flows). Code expires after 15 minutes. */
export async function setEmailVerificationCode(
  user_id: number,
  code: string,
): Promise<void> {
  const expires = new Date(Date.now() + 15 * 60_000).toISOString();
  const db = getDb();
  await db.execute({
    sql: `UPDATE users SET email_verification_code = ?,
                            email_verification_expires_at = ?,
                            updated_at = datetime('now')
          WHERE id = ?`,
    args: [code, expires, user_id],
  });
}

/** Verify a code; on success, clear it and mark email_verified=1.
 * Returns true if verification succeeded. */
export async function consumeEmailVerificationCode(
  user_id: number,
  code: string,
): Promise<boolean> {
  const db = getDb();
  const r = await db.execute({
    sql: `SELECT email_verification_code AS c, email_verification_expires_at AS e
          FROM users WHERE id = ?`,
    args: [user_id],
  });
  if (!r.rows.length) return false;
  const o = r.rows[0] as unknown as Record<string, unknown>;
  const stored = o.c == null ? null : String(o.c);
  const expires = o.e == null ? null : String(o.e);
  if (!stored || !expires) return false;
  if (stored !== code) return false;
  if (new Date(expires).getTime() < Date.now()) return false;
  await db.execute({
    sql: `UPDATE users SET email_verified = 1,
                            email_verification_code = NULL,
                            email_verification_expires_at = NULL,
                            updated_at = datetime('now')
          WHERE id = ?`,
    args: [user_id],
  });
  return true;
}

/** Admin verify (the second gate). Sets verified=1 and stamps who/when. */
export async function adminVerifyUser(
  user_id: number,
  admin_id: number,
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `UPDATE users SET verified = 1,
                            verified_at = datetime('now'),
                            verified_by = ?,
                            updated_at = datetime('now')
          WHERE id = ?`,
    args: [admin_id, user_id],
  });
}

export async function updateUser(
  id: number,
  patch: {
    email?: string | null;
    role?: "user" | "admin";
    ai_quota_daily?: number;
    repoll_quota_daily?: number;
    disabled?: boolean;
    password?: string;
  },
): Promise<UserRow | null> {
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (patch.email !== undefined) {
    sets.push("email = ?");
    args.push(patch.email ?? "");
  }
  if (patch.role !== undefined) {
    sets.push("role = ?");
    args.push(patch.role);
  }
  if (patch.ai_quota_daily !== undefined) {
    sets.push("ai_quota_daily = ?");
    args.push(patch.ai_quota_daily);
  }
  if (patch.repoll_quota_daily !== undefined) {
    sets.push("repoll_quota_daily = ?");
    args.push(patch.repoll_quota_daily);
  }
  if (patch.disabled !== undefined) {
    sets.push("disabled = ?");
    args.push(patch.disabled ? 1 : 0);
  }
  if (patch.password !== undefined) {
    sets.push("password_hash = ?");
    args.push(await bcrypt.hash(patch.password, 12));
  }
  if (!sets.length) return findUserById(id);
  sets.push("updated_at = datetime('now')");
  args.push(id);
  const db = getDb();
  await db.execute({
    sql: `UPDATE users SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
  return findUserById(id);
}

/** Hard-delete a user + all dependent rows (activity, alert subs, alert
 * log). Useful for clearing out test accounts. The CLV pipeline keeps
 * working because signals don't reference user_id. */
export async function deleteUser(id: number): Promise<void> {
  const db = getDb();
  // Delete in FK-respecting order. SQLite enforces FKs only when the
  // pragma is on; libsql does. We don't rely on cascade — explicit is
  // simpler to reason about than schema-defined cascades that can
  // surprise people later.
  await db.execute({
    sql: `DELETE FROM alert_log
          WHERE subscription_id IN (
            SELECT id FROM alert_subscriptions WHERE user_id = ?
          )`,
    args: [id],
  });
  await db.execute({
    sql: `DELETE FROM alert_subscriptions WHERE user_id = ?`,
    args: [id],
  });
  await db.execute({
    sql: `DELETE FROM user_activity WHERE user_id = ?`,
    args: [id],
  });
  await db.execute({
    sql: `DELETE FROM users WHERE id = ?`,
    args: [id],
  });
}


export async function recordLogin(id: number): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `UPDATE users SET last_login_at = datetime('now') WHERE id = ?`,
    args: [id],
  });
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ----------------------------------------------------------------------
// Activity log
// ----------------------------------------------------------------------

export async function logActivity(input: {
  user_id: number;
  action: ActivityAction;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  user_agent?: string | null;
}): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO user_activity (user_id, action, metadata_json, ip, user_agent)
          VALUES (?, ?, ?, ?, ?)`,
    args: [
      input.user_id,
      input.action,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.ip ?? null,
      input.user_agent ?? null,
    ],
  });
}

export async function countActivityToday(
  user_id: number,
  action: ActivityAction,
): Promise<number> {
  const db = getDb();
  const r = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM user_activity
          WHERE user_id = ? AND action = ?
            AND created_at >= datetime('now', 'start of day')`,
    args: [user_id, action],
  });
  return Number((r.rows[0] as unknown as Record<string, unknown>).n) || 0;
}

export async function listActivity(opts: {
  user_id?: number;
  action?: ActivityAction;
  limit?: number;
}): Promise<ActivityRow[]> {
  const db = getDb();
  const where: string[] = ["a.created_at >= datetime('now', '-30 days')"];
  const args: (string | number)[] = [];
  if (opts.user_id != null) {
    where.push("a.user_id = ?");
    args.push(opts.user_id);
  }
  if (opts.action) {
    where.push("a.action = ?");
    args.push(opts.action);
  }
  args.push(opts.limit ?? 200);
  const r = await db.execute({
    sql: `SELECT a.id, a.user_id, u.username, a.action, a.metadata_json,
                 a.ip, a.user_agent, a.created_at
          FROM user_activity a
          LEFT JOIN users u ON u.id = a.user_id
          WHERE ${where.join(" AND ")}
          ORDER BY a.created_at DESC
          LIMIT ?`,
    args,
  });
  return r.rows.map((row) => {
    const o = row as unknown as Record<string, unknown>;
    return {
      id: Number(o.id),
      user_id: Number(o.user_id),
      username: String(o.username ?? "?"),
      action: o.action as ActivityAction,
      metadata_json: o.metadata_json == null ? null : String(o.metadata_json),
      ip: o.ip == null ? null : String(o.ip),
      user_agent: o.user_agent == null ? null : String(o.user_agent),
      created_at: String(o.created_at),
    };
  });
}
