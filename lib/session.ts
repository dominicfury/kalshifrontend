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
