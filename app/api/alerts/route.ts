import { NextResponse } from "next/server";

import { createSubscription, listSubscriptionsForUser } from "@/lib/alerts";
import { getCurrentUser, isSameOrigin } from "@/lib/session";
import { findUserById } from "@/lib/users";

export const runtime = "nodejs";

async function requireVerified() {
  const me = await getCurrentUser();
  if (!me) return null;
  if (me.role === "admin") return me;
  const u = await findUserById(me.sub);
  if (!u || u.disabled || !u.verified) return null;
  return me;
}

export async function GET() {
  const me = await requireVerified();
  if (!me) {
    return NextResponse.json({ error: "verified users only" }, { status: 403 });
  }
  const subs = await listSubscriptionsForUser(me.sub);
  return NextResponse.json({ subscriptions: subs });
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const me = await requireVerified();
  if (!me) {
    return NextResponse.json({ error: "verified users only" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim().slice(0, 80);
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const min_edge = clamp(Number(body.min_edge ?? 0.02), 0, 0.5);
  const min_n_books = Math.round(clamp(Number(body.min_n_books ?? 2), 1, 20));
  const sport = body.sport ? String(body.sport) : null;
  const market_type = body.market_type ? String(body.market_type) : null;
  const sideValue = body.side === "yes" || body.side === "no" ? body.side : null;
  const require_at_size = body.require_at_size !== false;
  const cooldown_minutes = Math.round(
    clamp(Number(body.cooldown_minutes ?? 60), 1, 1440),
  );
  const enabled = body.enabled !== false;

  const sub = await createSubscription({
    user_id: me.sub,
    name,
    min_edge,
    min_n_books,
    sport,
    market_type,
    side: sideValue,
    require_at_size,
    cooldown_minutes,
    enabled,
  });
  return NextResponse.json({ subscription: sub });
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
