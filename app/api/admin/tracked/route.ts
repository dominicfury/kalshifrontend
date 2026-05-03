import { NextResponse } from "next/server";

import { isSameOrigin, requireAdmin } from "@/lib/session";
import { trackSignal } from "@/lib/tracked";

export const runtime = "nodejs";

/**
 * POST /api/admin/tracked
 *   body: { signal_id: number }
 *
 * Mark a signal as tracked for CLV/resolution rollups. Idempotent —
 * re-marking an already-tracked signal returns ok with already=true.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { signal_id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const signal_id = Number(body.signal_id);
  if (!Number.isInteger(signal_id) || signal_id <= 0) {
    return NextResponse.json({ error: "signal_id required" }, { status: 400 });
  }

  try {
    const inserted = await trackSignal(signal_id);
    return NextResponse.json({ tracked: true, already: !inserted });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "track failed" },
      { status: 500 },
    );
  }
}
