/**
 * JWT cookie auth helpers. The cookie is set on /api/auth/login and
 * verified on every request by middleware (Edge runtime — uses jose, not
 * bcrypt). Password hashing only happens in /api/auth/login (Node
 * runtime), since bcryptjs is not Edge-compatible.
 *
 * Cookie name: `auth_token`. httpOnly, secure in prod, 24h expiry —
 * meets the "users must log in once a day" requirement.
 */
import { jwtVerify, SignJWT } from "jose";

const TOKEN_COOKIE = "auth_token";
const ALGO = "HS256";

export interface UserClaims {
  sub: number;            // user id
  username: string;
  role: "user" | "admin";
}

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "JWT_SECRET not configured (or < 32 chars). Generate with: openssl rand -base64 64",
    );
  }
  return new TextEncoder().encode(s);
}

export async function signToken(claims: UserClaims): Promise<string> {
  return new SignJWT({ username: claims.username, role: claims.role })
    .setProtectedHeader({ alg: ALGO })
    .setSubject(String(claims.sub))
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<UserClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALGO] });
    const sub = payload.sub;
    const username = payload.username;
    const role = payload.role;
    if (
      typeof sub !== "string" ||
      typeof username !== "string" ||
      (role !== "user" && role !== "admin")
    ) {
      return null;
    }
    return { sub: Number(sub), username, role };
  } catch {
    return null;
  }
}

export const AUTH_COOKIE = TOKEN_COOKIE;
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24; // 24h in seconds


/**
 * Validate that a redirect target is a same-origin path. Used by the login
 * flow's `?next=` param to prevent open-redirects (e.g. `?next=//evil.com`
 * or `?next=https://evil.com/path`). Returns a safe path or "/" as the
 * default fallback.
 *
 * Allowed shapes:
 *   "/", "/foo", "/foo/bar?x=1", "/foo#frag"
 * Rejected:
 *   "//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)",
 *   "", null, undefined, anything not starting with a single forward slash.
 */
export function safeRedirectPath(input: unknown, fallback = "/"): string {
  if (typeof input !== "string" || input.length === 0) return fallback;
  // Must start with a single "/".
  if (input[0] !== "/") return fallback;
  // Reject "//..." (protocol-relative) and "/\..." (some browsers normalize
  // backslashes to forward slashes, opening up "/\\evil.com" as "//evil.com").
  if (input.length > 1 && (input[1] === "/" || input[1] === "\\")) return fallback;
  // Reject anything containing a protocol scheme — defense in depth, since
  // a colon early in the path could still trick some downstream code.
  if (/^\/[^/]*:/.test(input)) return fallback;
  return input;
}
