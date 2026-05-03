import { NextResponse } from "next/server";

import { deleteBetBySignalId } from "@/lib/bets";
import { isSameOrigin, requireAdmin } from "@/lib/session";

export const runtime = "nodejs";

/**
 * DELETE /api/admin/bets/by-signal/[id]
 *
 * Untrack a signal. Idempotent — returns ok even if no bet existed.
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const signal_id = Number(id);
  if (!Number.isInteger(signal_id) || signal_id <= 0) {
    return NextResponse.json({ error: "invalid signal id" }, { status: 400 });
  }

  try {
    const removed = await deleteBetBySignalId(signal_id);
    return NextResponse.json({ tracked: false, removed });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "untrack failed" },
      { status: 500 },
    );
  }
}
