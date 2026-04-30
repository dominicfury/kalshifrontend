import { NextResponse } from "next/server";

import { isSameOrigin, requireAdmin } from "@/lib/session";
import { createUser, listUsers } from "@/lib/users";

export const runtime = "nodejs";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: {
    username?: string;
    email?: string | null;
    password?: string;
    role?: "user" | "admin";
    ai_quota_daily?: number;
    repoll_quota_daily?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
    return NextResponse.json(
      { error: "username must be 3-32 chars, letters/digits/_- only" },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "password must be at least 8 characters" },
      { status: 400 },
    );
  }

  try {
    // Admin-created users skip both verification gates — admin trust is
    // already established. Email field is optional (no verification email
    // sent on this path).
    const user = await createUser({
      username,
      email: body.email ?? null,
      password,
      role: body.role === "admin" ? "admin" : "user",
      ai_quota_daily: body.ai_quota_daily,
      repoll_quota_daily: body.repoll_quota_daily,
      signup_method: "admin",
      email_verified: true,
    });
    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "create failed" },
      { status: 500 },
    );
  }
}
