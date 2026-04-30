import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/session";
import { listActivity, type ActivityAction } from "@/lib/users";

export const runtime = "nodejs";

const VALID_ACTIONS: ActivityAction[] = [
  "login",
  "login_failed",
  "logout",
  "ai_chat",
  "ai_quota_blocked",
  "repoll",
  "repoll_quota_blocked",
];

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const userParam = url.searchParams.get("user_id");
  const actionParam = url.searchParams.get("action");
  const limitParam = url.searchParams.get("limit");

  const opts: {
    user_id?: number;
    action?: ActivityAction;
    limit?: number;
  } = {};
  if (userParam) {
    const id = Number(userParam);
    if (Number.isFinite(id)) opts.user_id = id;
  }
  if (actionParam && (VALID_ACTIONS as string[]).includes(actionParam)) {
    opts.action = actionParam as ActivityAction;
  }
  if (limitParam) {
    const n = Number(limitParam);
    if (Number.isFinite(n) && n > 0 && n <= 1000) opts.limit = n;
  }

  const rows = await listActivity(opts);
  return NextResponse.json({ activity: rows });
}
