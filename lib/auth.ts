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
  if (!s || s.length < 16) {
    throw new Error(
      "JWT_SECRET not configured (or < 16 chars). Generate with: openssl rand -base64 64",
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
