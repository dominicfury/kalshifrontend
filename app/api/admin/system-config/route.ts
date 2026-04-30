import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/session";
import { listConfig, setValue } from "@/lib/system-config";

export const runtime = "nodejs";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const config = await listConfig();
  return NextResponse.json({ config });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { entries?: Array<{ key: string; value: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const entries = Array.isArray(body.entries) ? body.entries : [];
  if (!entries.length) {
    return NextResponse.json({ error: "no entries to save" }, { status: 400 });
  }

  for (const e of entries) {
    if (typeof e.key !== "string" || typeof e.value !== "string") {
      return NextResponse.json(
        { error: "each entry must have string key + value" },
        { status: 400 },
      );
    }
    // Validate numeric keys to avoid bad config breaking pollers.
    if (/_sec$|_daily$|_reserve$/.test(e.key)) {
      const n = Number(e.value);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: `${e.key} must be a non-negative number` },
          { status: 400 },
        );
      }
    }
    await setValue(e.key, e.value, admin.sub);
  }

  return NextResponse.json({ ok: true, saved: entries.length });
}
