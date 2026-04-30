import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE,
  signToken,
} from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  findUserByUsername,
  logActivity,
  recordLogin,
  verifyPassword,
} from "@/lib/users";

// Node runtime — bcryptjs is not Edge-compatible, and this route hashes/
// compares passwords. Middleware runs on Edge and only verifies JWTs.
export const runtime = "nodejs";

// Rate limits: 10 login attempts per IP per 15 min and 8 attempts per
// username per 15 min. Per-username gives extra cover when an attacker
// rotates IPs to credential-stuff a single user; per-IP catches the
// inverse case (one IP guessing across many usernames).
const LOGIN_IP_MAX = 10;
const LOGIN_USER_MAX = 8;
const LOGIN_WINDOW_SEC = 15 * 60;

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!username || !password) {
    return NextResponse.json({ error: "username and password required" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent") || null;

  // IP-bound limiter — runs before bcrypt so an attacker spamming us
  // can't burn CPU. Username-bound limiter runs after we identify the
  // user (or against the supplied username if we don't, to slow
  // enumeration of valid accounts).
  if (ip) {
    const rl = await checkRateLimit({
      bucket: "login:ip",
      key: ip,
      max: LOGIN_IP_MAX,
      windowSec: LOGIN_WINDOW_SEC,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "too many attempts, try again later" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }
  }

  const userKey = username.toLowerCase();
  const rlUser = await checkRateLimit({
    bucket: "login:user",
    key: userKey,
    max: LOGIN_USER_MAX,
    windowSec: LOGIN_WINDOW_SEC,
  });
  if (!rlUser.allowed) {
    return NextResponse.json(
      { error: "too many attempts, try again later" },
      { status: 429, headers: { "Retry-After": String(rlUser.retryAfterSec) } },
    );
  }

  let user;
  try {
    user = await findUserByUsername(username);
  } catch {
    return NextResponse.json(
      { error: "auth lookup failed" },
      { status: 500 },
    );
  }
  if (!user || user.disabled) {
    // Constant-ish response; don't differentiate "user not found" from
    // "wrong password" so attackers can't enumerate usernames.
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    try {
      await logActivity({ user_id: user.id, action: "login_failed", ip, user_agent: ua });
    } catch (e) {
      console.error("login: logActivity(failed) error:", e);
    }
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  let token: string;
  try {
    token = await signToken({ sub: user.id, username: user.username, role: user.role });
  } catch (e) {
    // Most likely: JWT_SECRET missing or below the minimum length on Vercel.
    // Don't leak the underlying error to the client; log server-side.
    console.error("login: signToken failed:", e);
    return NextResponse.json(
      { error: "internal authentication error" },
      { status: 500 },
    );
  }

  const c = await cookies();
  c.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE,
  });

  // Best-effort post-login bookkeeping. The cookie is already set above —
  // a libsql blip on these UPDATE/INSERT calls must not crash the login.
  try {
    await recordLogin(user.id);
  } catch (e) {
    console.error("login: recordLogin failed:", e);
  }
  try {
    await logActivity({ user_id: user.id, action: "login", ip, user_agent: ua });
  } catch (e) {
    console.error("login: logActivity failed:", e);
  }

  return NextResponse.json({
    ok: true,
    user: { id: user.id, username: user.username, role: user.role },
  });
}
