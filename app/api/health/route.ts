import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tiny connectivity probe. AutoRefresh hits this before issuing a
// router.refresh() so it can distinguish "online but server says no new
// data" from "the user lost network and is staring at stale rows".
export async function GET() {
  return NextResponse.json({ ok: true, t: Date.now() });
}
