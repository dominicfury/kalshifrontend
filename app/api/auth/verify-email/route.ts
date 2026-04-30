import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE,
  signToken,
} from "@/lib/auth";
import {
  consumeEmailVerificationCode,
  findUserById,
  logActivity,
  recordLogin,
  setEmailVerificationCode,
} from "@/lib/users";
import { sendEmail, verificationEmail } from "@/lib/email";

export const runtime = "nodejs";

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

  const ok = await consumeEmailVerificationCode(user_id, code);
  if (!ok) {
    return NextResponse.json(
      { error: "incorrect or expired code" },
      { status: 400 },
    );
  }

  // Email verified → auto-log them in for the 12-hour trial. Admin still
  // needs to flip verified=1 within 12h or they get locked out.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const ua = req.headers.get("user-agent") || null;

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

  await recordLogin(user.id);
  await logActivity({
    user_id: user.id,
    action: "login",
    metadata: { via: "email_verify" },
    ip,
    user_agent: ua,
  });

  return NextResponse.json({
    ok: true,
    user: { id: user.id, username: user.username, role: user.role },
  });
}
