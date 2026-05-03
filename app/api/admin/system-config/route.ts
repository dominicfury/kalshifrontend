import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { isSameOrigin, requireAdmin } from "@/lib/session";
import { listConfig, setValue } from "@/lib/system-config";

export const runtime = "nodejs";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const config = await listConfig();
  return NextResponse.json({ config });
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
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

  let touchedSportToggle = false;
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
    // Sport toggles + the public signup gate are strict booleans-as-strings.
    if (/^sport_enabled_/.test(e.key) || e.key === "signups_enabled") {
      if (e.value !== "0" && e.value !== "1") {
        return NextResponse.json(
          { error: `${e.key} must be "0" or "1"` },
          { status: 400 },
        );
      }
      if (/^sport_enabled_/.test(e.key)) touchedSportToggle = true;
    }
    await setValue(e.key, e.value, admin.sub);
  }

  // Activity bar is cached for 60s — expire it immediately so the change
  // is visible on the next page load instead of after the cache window.
  if (touchedSportToggle) {
    revalidateTag("sport-activity", { expire: 0 });
  }

  return NextResponse.json({ ok: true, saved: entries.length });
}
