import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE, verifyToken } from "@/lib/auth";
import { logActivity } from "@/lib/users";

export const runtime = "nodejs";

export async function POST() {
  const c = await cookies();
  const token = c.get(AUTH_COOKIE)?.value;
  if (token) {
    const claims = await verifyToken(token);
    if (claims) {
      try {
        await logActivity({ user_id: claims.sub, action: "logout" });
      } catch {
        // best-effort; don't block logout
      }
    }
  }
  c.set(AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
