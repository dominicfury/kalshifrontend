import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE,
  signToken,
} from "@/lib/auth";
import {
  findUserByUsername,
  logActivity,
  recordLogin,
  verifyPassword,
} from "@/lib/users";

// Node runtime — bcryptjs is not Edge-compatible, and this route hashes/
// compares passwords. Middleware runs on Edge and only verifies JWTs.
export const runtime = "nodejs";

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

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const ua = req.headers.get("user-agent") || null;

  let user;
  try {
    user = await findUserByUsername(username);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "auth lookup failed" },
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
    await logActivity({ user_id: user.id, action: "login_failed", ip, user_agent: ua });
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  const token = await signToken({ sub: user.id, username: user.username, role: user.role });
  const c = await cookies();
  c.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE,
  });

  await recordLogin(user.id);
  await logActivity({ user_id: user.id, action: "login", ip, user_agent: ua });

  return NextResponse.json({
    ok: true,
    user: { id: user.id, username: user.username, role: user.role },
  });
}
