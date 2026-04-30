/**
 * Server-component helper to read the current user from the auth cookie.
 * Middleware already verified the JWT (Edge-safe) before the request
 * reached the page; this re-decodes the cookie for role checks AND
 * (optionally) hits the DB for the always-fresh trial state.
 */
import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { AUTH_COOKIE, verifyToken, type UserClaims } from "./auth";
import { findUserById, type UserRow } from "./users";

// React's cache() dedupes within a single server request — so the
// layout, the page, and any nested server components calling
// getCurrentUser() / getTrialState() during the same render share one
// DB lookup instead of N. Big read-burn reduction on the dashboard.
export const getCurrentUser = cache(async (): Promise<UserClaims | null> => {
  const c = await cookies();
  const token = c.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
});

export async function requireAdmin(): Promise<UserClaims | null> {
  const u = await getCurrentUser();
  return u && u.role === "admin" ? u : null;
}


/**
 * Same-origin check for state-changing admin requests. Defense in depth on
 * top of the sameSite=lax cookie: a misconfigured browser, an extension, or
 * a future cookie-policy change shouldn't be the only thing standing
 * between a logged-in admin and a CSRF on /api/admin/*. Returns true when
 * the Origin header matches the request host (or, for environments behind
 * a proxy, the X-Forwarded-Host).
 *
 * Use as: `if (!isSameOrigin(req)) return NextResponse.json(...403)`.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) {
    // Modern browsers always send Origin on cross-origin AND same-origin
    // POST/PATCH/DELETE. Missing Origin on a mutating request is suspicious
    // — block it. (GET requests can have null Origin and aren't covered
    // by this helper anyway.)
    return false;
  }
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  // Prefer X-Forwarded-Host when present (Vercel/Railway), since the
  // request URL inside a Node runtime can reflect the internal hostname.
  const fwdHost = req.headers.get("x-forwarded-host")?.toLowerCase();
  const reqHost = (() => {
    try {
      return new URL(req.url).host.toLowerCase();
    } catch {
      return "";
    }
  })();
  const expected = fwdHost || reqHost;
  return !!expected && originHost === expected;
}

export type TrialState =
  | { kind: "guest" }              // not logged in
  | { kind: "admin"; user: UserRow }
  | { kind: "verified"; user: UserRow }
  | { kind: "trial"; user: UserRow; ends_at: number; remaining_ms: number }
  | { kind: "expired"; user: UserRow }
  | { kind: "disabled"; user: UserRow };

export const TRIAL_HOURS = 12;

/** Single source of truth for "what should this user see right now?".
 * Layout consults this on every render so the moment an admin flips
 * verified=1 in /settings, the user's next request gets unblocked
 * without a forced re-login. Wrapped in React.cache() so the layout
 * and child server components share one DB lookup per request. */
export const getTrialState = cache(async (): Promise<TrialState> => {
  const claims = await getCurrentUser();
  if (!claims) return { kind: "guest" };
  const user = await findUserById(claims.sub);
  if (!user || user.disabled) {
    return user ? { kind: "disabled", user } : { kind: "guest" };
  }
  if (user.role === "admin") return { kind: "admin", user };
  if (user.verified) return { kind: "verified", user };

  // Self-signup user awaiting admin approval. 12h grace period from
  // signup → expired if past it.
  const ends_at =
    new Date(user.created_at).getTime() + TRIAL_HOURS * 3_600_000;
  const remaining_ms = ends_at - Date.now();
  if (remaining_ms > 0) {
    return { kind: "trial", user, ends_at, remaining_ms };
  }
  return { kind: "expired", user };
});
