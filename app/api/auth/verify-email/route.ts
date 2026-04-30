import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE,
  signToken,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  consumeEmailVerificationCode,
  findUserById,
  logActivity,
  recordLogin,
  setEmailVerificationCode,
} from "@/lib/users";
import { sendEmail, verificationEmail } from "@/lib/email";

export const runtime = "nodejs";

// 6-digit codes are 1-in-1M; without a brute-force cap an attacker can
// guess every code in a few minutes. 5 attempts per 15 min per user_id is
// well below brute-force feasibility while still tolerating fat-fingers.
const VERIFY_USER_MAX = 5;
const VERIFY_WINDOW_SEC = 15 * 60;
// Resend has a separate, looser bucket: max 3 sends per user per hour to
// keep the Resend quota safe and discourage email-bombing a target.
const RESEND_USER_MAX = 3;
const RESEND_WINDOW_SEC = 60 * 60;

export async function POST(req: Request) {
  let body: { user_id?: number; code?: string; resend?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const user_id = Number(body.user_id);
  if (!Number.isFinite(user_id) || user_id <= 0) {
    return NextResponse.json({ error: "invalid user_id" }, { status: 400 });
  }
  const user = await findUserById(user_id);
  if (!user || user.disabled) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }
  if (user.email_verified) {
    return NextResponse.json({ error: "email already verified" }, { status: 409 });
  }

  // Resend code path: same endpoint, body { user_id, resend: true }
  if (body.resend) {
    if (!user.email) {
      return NextResponse.json({ error: "no email on file" }, { status: 400 });
    }
    const resendRl = await checkRateLimit({
      bucket: "verify-email:resend",
      key: String(user_id),
      max: RESEND_USER_MAX,
      windowSec: RESEND_WINDOW_SEC,
    });
    if (!resendRl.allowed) {
      return NextResponse.json(
        { error: "too many resend requests, try again later" },
        { status: 429, headers: { "Retry-After": String(resendRl.retryAfterSec) } },
      );
    }
    const newCode = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    await setEmailVerificationCode(user_id, newCode);
    const tpl = verificationEmail(newCode);
    const sent = await sendEmail({
      to: user.email,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });
    if (!sent.ok) {
      return NextResponse.json({ error: sent.error }, { status: 502 });
    }
    return NextResponse.json({ ok: true, resent: true });
  }

  const code = String(body.code ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "code must be 6 digits" }, { status: 400 });
  }

  // Brute-force cap: count attempts (success or fail) inside the window.
  // Recording happens before the consume call so an exhausted attacker
  // can't burn the last attempt to learn the code.
  const verifyRl = await checkRateLimit({
    bucket: "verify-email:attempt",
    key: String(user_id),
    max: VERIFY_USER_MAX,
    windowSec: VERIFY_WINDOW_SEC,
  });
  if (!verifyRl.allowed) {
    return NextResponse.json(
      { error: "too many verification attempts, try again later" },
      { status: 429, headers: { "Retry-After": String(verifyRl.retryAfterSec) } },
    );
  }

  const ok = await consumeEmailVerificationCode(user_id, code);
  if (!ok) {
    return NextResponse.json(
      { error: "incorrect or expired code" },
      { status: 400 },
    );
  }

  // Email verified. Try to auto-log them in — but if cookie signing or any
  // post-verification side-effect throws, we still return success because
  // the verification itself already succeeded. Otherwise the user sees 500
  // on the first click, retries, and gets "already verified" stuck. The
  // frontend will fall back to redirecting them to /login on `needs_login`.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const ua = req.headers.get("user-agent") || null;

  let cookieSet = false;
  try {
    const token = await signToken({
      sub: user.id,
      username: user.username,
      role: user.role,
    });
    const c = await cookies();
    c.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_COOKIE_MAX_AGE,
    });
    cookieSet = true;
  } catch (e) {
    // Most likely cause: JWT_SECRET missing/short on Vercel. Don't crash
    // the verification — the user is verified; they can log in manually.
    console.error("verify-email: auto-login cookie failed:", e);
  }

  // Best-effort logging. Failures here MUST NOT throw past the response.
  try {
    await recordLogin(user.id);
  } catch (e) {
    console.error("verify-email: recordLogin failed:", e);
  }
  try {
    await logActivity({
      user_id: user.id,
      action: "login",
      metadata: { via: "email_verify" },
      ip,
      user_agent: ua,
    });
  } catch (e) {
    console.error("verify-email: logActivity failed:", e);
  }

  return NextResponse.json({
    ok: true,
    user: { id: user.id, username: user.username, role: user.role },
    needs_login: !cookieSet,
  });
}
