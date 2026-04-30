import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE, verifyToken } from "@/lib/auth";

// Routes that don't require auth at all. Login + signup pages, the
// auth API, and the landing page (renders different content based on
// whether the cookie is present, but middleware never blocks it).
const PUBLIC_PATHS = new Set<string>([
  "/",                           // landing for logged-out / dashboard for logged-in
  "/login",
  "/signup",
  "/info",                       // educational reference — open to everyone
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/signup",
  "/api/auth/verify-email",
]);

const ADMIN_ONLY_PREFIXES: string[] = [
  "/clv",
  "/health",
  "/settings",
  "/api/admin",
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Static + Next assets + favicon — let through. (Matcher already
  // excludes /_next, but be defensive on common public files.)
  if (
    pathname.startsWith("/logo") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico")
  ) {
    return true;
  }
  return false;
}

function isAdminOnly(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const claims = token ? await verifyToken(token) : null;

  // Logged-in users hitting /login or /signup → bounce to dashboard.
  // (Layout will replace with PendingApproval if their trial has expired.)
  if (claims && (pathname === "/login" || pathname === "/signup")) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isPublic(pathname)) return NextResponse.next();

  if (!token) {
    return redirectToLogin(req);
  }
  if (!claims) {
    // Stale / invalid cookie — clear it and redirect.
    const res = redirectToLogin(req);
    res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  if (isAdminOnly(pathname) && claims.role !== "admin") {
    // Surface as 404 rather than 403 so we don't tell non-admins that
    // admin pages exist.
    return NextResponse.rewrite(new URL("/not-found", req.url));
  }

  return NextResponse.next();
}

function redirectToLogin(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  // Preserve where they were trying to go so login can bounce back.
  if (req.nextUrl.pathname !== "/") {
    url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  } else {
    url.search = "";
  }
  return NextResponse.redirect(url);
}

// Run middleware on every page + API route except Next.js internals + static.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
