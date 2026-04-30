import { NextResponse } from "next/server";

import {
  deleteSubscription,
  findSubscription,
  updateSubscription,
} from "@/lib/alerts";
import { getCurrentUser } from "@/lib/session";
import { findUserById } from "@/lib/users";

export const runtime = "nodejs";

async function checkOwner(
  id: number,
): Promise<
  | { ok: true; user_id: number }
  | { ok: false; status: number; error: string }
> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, status: 401, error: "not signed in" };
  if (me.role !== "admin") {
    const u = await findUserById(me.sub);
    if (!u || u.disabled || !u.verified) {
      return { ok: false, status: 403, error: "verified users only" };
    }
  }
  const sub = await findSubscription(id);
  if (!sub) return { ok: false, status: 404, error: "not found" };
  if (sub.user_id !== me.sub && me.role !== "admin") {
    return { ok: false, status: 403, error: "not your subscription" };
  }
  return { ok: true, user_id: me.sub };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const subId = Number(id);
  if (!Number.isFinite(subId) || subId <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const owner = await checkOwner(subId);
  if (!owner.ok) {
    return NextResponse.json({ error: owner.error }, { status: owner.status });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const patch: Parameters<typeof updateSubscription>[1] = {};
  if (typeof body.name === "string") patch.name = body.name.trim().slice(0, 80);
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (Number.isFinite(Number(body.min_edge))) {
    patch.min_edge = Math.max(0, Math.min(0.5, Number(body.min_edge)));
  }
  if (Number.isFinite(Number(body.min_n_books))) {
    patch.min_n_books = Math.round(
      Math.max(1, Math.min(20, Number(body.min_n_books))),
    );
  }
  if (body.sport !== undefined) {
    patch.sport = body.sport ? String(body.sport) : null;
  }
  if (body.market_type !== undefined) {
    patch.market_type = body.market_type ? String(body.market_type) : null;
  }
  if (body.side !== undefined) {
    patch.side = body.side === "yes" || body.side === "no" ? body.side : null;
  }
  if (typeof body.require_at_size === "boolean") {
    patch.require_at_size = body.require_at_size;
  }
  if (Number.isFinite(Number(body.cooldown_minutes))) {
    patch.cooldown_minutes = Math.round(
      Math.max(1, Math.min(1440, Number(body.cooldown_minutes))),
    );
  }

  const updated = await updateSubscription(subId, patch);
  return NextResponse.json({ subscription: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const subId = Number(id);
  if (!Number.isFinite(subId) || subId <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const owner = await checkOwner(subId);
  if (!owner.ok) {
    return NextResponse.json({ error: owner.error }, { status: owner.status });
  }
  await deleteSubscription(subId);
  return NextResponse.json({ ok: true });
}
