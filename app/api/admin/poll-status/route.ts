import { NextResponse } from "next/server";

import { fetchApiStatus } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";

export const runtime = "nodejs";


/**
 * GET /api/admin/poll-status
 *
 * Returns just the bits the repoll button needs to know whether a
 * triggered poll cycle has finished:
 *  - kalshi_last_success_at, odds_last_success_at (ISO strings)
 *  - now (server time, so the client can advance its "press timestamp"
 *    against the same clock and not its own browser clock)
 *
 * Admin-only — same gate as the /api/repoll caller. Lightweight read,
 * intended to be polled every ~3s while the button waits.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const rows = await fetchApiStatus();
  const kalshi = rows.find((r) => r.api === "kalshi");
  const odds = rows.find((r) => r.api === "odds");

  return NextResponse.json({
    kalshi_last_success_at: kalshi?.last_success_at ?? null,
    odds_last_success_at: odds?.last_success_at ?? null,
    now: new Date().toISOString(),
  });
}
