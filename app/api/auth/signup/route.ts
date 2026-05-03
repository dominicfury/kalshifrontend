import { NextResponse } from "next/server";

import { sendEmail, verificationEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getBool, KNOWN_KEYS } from "@/lib/system-config";
import { verifyTurnstile } from "@/lib/turnstile";
import {
  createUser,
  findUserByEmail,
  findUserByUsername,
} from "@/lib/users";

export const runtime = "nodejs";

// Per-IP signup limit — caps disposable account creation and protects the
// Resend email quota from a misbehaving client.
const SIGNUP_IP_MAX = 5;
const SIGNUP_IP_WINDOW_SEC = 60 * 60;          // 1 hour
const SIGNUP_EMAIL_MAX = 1;
const SIGNUP_EMAIL_WINDOW_SEC = 24 * 60 * 60;  // 1 day per email

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
  // Admin-controlled gate — checked before any work so a closed signup
  // can't burn CAPTCHA budget, hit the DB, or send emails.
  const signupsOpen = await getBool(KNOWN_KEYS.SIGNUPS_ENABLED, true);
  if (!signupsOpen) {
    return NextResponse.json(
      { error: "signups are currently closed" },
      { status: 403 },
    );
  }

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
  const ip = getClientIp(req);
  const cap = await verifyTurnstile(captcha_token, ip);
  if (!cap.ok) {
    return NextResponse.json({ error: cap.error }, { status: 400 });
  }

  // Rate limits — applied after CAPTCHA so we don't waste limiter budget
  // on bot traffic. Per-IP throttles aggregate signup spam; per-email
  // makes "create 100 accounts on the same address" infeasible.
  if (ip) {
    const ipRl = await checkRateLimit({
      bucket: "signup:ip",
      key: ip,
      max: SIGNUP_IP_MAX,
      windowSec: SIGNUP_IP_WINDOW_SEC,
    });
    if (!ipRl.allowed) {
      return NextResponse.json(
        { error: "too many signups from this network, try again later" },
        { status: 429, headers: { "Retry-After": String(ipRl.retryAfterSec) } },
      );
    }
  }
  const emailRl = await checkRateLimit({
    bucket: "signup:email",
    key: email,
    max: SIGNUP_EMAIL_MAX,
    windowSec: SIGNUP_EMAIL_WINDOW_SEC,
  });
  if (!emailRl.allowed) {
    return NextResponse.json(
      { error: "this email already requested a signup recently" },
      { status: 429, headers: { "Retry-After": String(emailRl.retryAfterSec) } },
    );
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
