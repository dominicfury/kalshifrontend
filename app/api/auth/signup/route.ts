import { NextResponse } from "next/server";

import { sendEmail, verificationEmail } from "@/lib/email";
import { verifyTurnstile } from "@/lib/turnstile";
import {
  createUser,
  findUserByEmail,
  findUserByUsername,
  setEmailVerificationCode,
} from "@/lib/users";

export const runtime = "nodejs";

function generateCode(): string {
  // 6-digit zero-padded numeric code
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

function isPlausibleEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isOkPassword(s: string): boolean {
  return s.length >= 8 && s.length <= 200;
}

function isOkUsername(s: string): boolean {
  return /^[a-zA-Z0-9_-]{3,32}$/.test(s);
}

export async function POST(req: Request) {
  let body: {
    username?: string;
    email?: string;
    password?: string;
    captcha_token?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const captcha_token = String(body.captcha_token ?? "");

  if (!isOkUsername(username)) {
    return NextResponse.json(
      { error: "username must be 3-32 chars, letters/digits/_- only" },
      { status: 400 },
    );
  }
  if (!isPlausibleEmail(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  if (!isOkPassword(password)) {
    return NextResponse.json(
      { error: "password must be at least 8 characters" },
      { status: 400 },
    );
  }

  // CAPTCHA — block before doing any DB or email work
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const cap = await verifyTurnstile(captcha_token, ip);
  if (!cap.ok) {
    return NextResponse.json({ error: cap.error }, { status: 400 });
  }

  // Uniqueness checks (case-insensitive). We don't disclose which is taken
  // — generic "already in use" reveals less than "username taken".
  if (await findUserByUsername(username)) {
    return NextResponse.json(
      { error: "username or email already in use" },
      { status: 409 },
    );
  }
  if (await findUserByEmail(email)) {
    return NextResponse.json(
      { error: "username or email already in use" },
      { status: 409 },
    );
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  let user;
  try {
    user = await createUser({
      username,
      email,
      password,
      role: "user",
      signup_method: "self",
      email_verified: false,
      email_verification_code: code,
      email_verification_expires_at: expiresAt,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "signup failed" },
      { status: 500 },
    );
  }

  const tpl = verificationEmail(code);
  const sent = await sendEmail({
    to: email,
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
  });
  if (!sent.ok) {
    // Don't roll back the user — they can request another code via
    // /resend-code. Surface the send error so the form shows it.
    return NextResponse.json(
      {
        ok: true,
        user_id: user.id,
        warning: `account created but verification email failed to send: ${sent.error}`,
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, user_id: user.id });
}
