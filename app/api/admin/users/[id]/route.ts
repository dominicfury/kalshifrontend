import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/session";
import {
  adminVerifyUser,
  findUserById,
  updateUser,
} from "@/lib/users";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  let body: {
    action?: "verify" | "disable" | "enable" | "reset_password" | "update";
    role?: "user" | "admin";
    email?: string | null;
    ai_quota_daily?: number;
    repoll_quota_daily?: number;
    password?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const target = await findUserById(userId);
  if (!target) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  // The admin can't lock themselves out — disabling / demoting the only
  // admin would leave the system unmanageable.
  const isLastAdmin = target.role === "admin" && target.id === admin.sub;
  if (
    isLastAdmin &&
    (body.action === "disable" || body.role === "user")
  ) {
    return NextResponse.json(
      { error: "cannot demote or disable the current admin from their own session" },
      { status: 400 },
    );
  }

  switch (body.action) {
    case "verify":
      await adminVerifyUser(userId, admin.sub);
      break;
    case "disable":
      await updateUser(userId, { disabled: true });
      break;
    case "enable":
      await updateUser(userId, { disabled: false });
      break;
    case "reset_password":
      if (!body.password || body.password.length < 8) {
        return NextResponse.json(
          { error: "password must be at least 8 characters" },
          { status: 400 },
        );
      }
      await updateUser(userId, { password: body.password });
      break;
    case "update":
    default:
      await updateUser(userId, {
        email: body.email,
        role: body.role,
        ai_quota_daily: body.ai_quota_daily,
        repoll_quota_daily: body.repoll_quota_daily,
      });
      break;
  }

  const updated = await findUserById(userId);
  return NextResponse.json({ user: updated });
}
