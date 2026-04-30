import { NextResponse } from "next/server";

import { getCurrentUser, isSameOrigin } from "@/lib/session";
import { logActivity } from "@/lib/users";

export const runtime = "nodejs";
// Backend now kicks off the poll as a background task and returns
// immediately. Vercel hobby caps function duration at 10s anyway, so a
// long maxDuration was misleading — keep it tight to fail fast.
export const maxDuration = 15;

function jsonError(status: number, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

// Proxies a manual repoll request from the dashboard to the Railway-hosted
// backend. Holds the shared X-Repoll-Token server-side so it never leaves
// Vercel's edge — the browser only sees a same-origin POST. Always returns
// JSON, even on upstream HTML error pages, so the client never trips on
// JSON.parse and the user can see WHAT went wrong.
//
// Auth: admin-only. Non-admin users get a friendly 403; the button is
// also hidden in their nav so they shouldn't reach this in normal use.
export async function POST(req: Request) {
  try {
    if (!isSameOrigin(req)) {
      return jsonError(403, "forbidden");
    }
    const me = await getCurrentUser();
    if (!me) return jsonError(401, "not signed in");
    if (me.role !== "admin") {
      // Best-effort log; don't block the rejection on log failure.
      try {
        await logActivity({ user_id: me.sub, action: "repoll_quota_blocked" });
      } catch {
        /* noop */
      }
      return jsonError(403, "manual repoll is admin-only");
    }

    const rawBackendUrl = process.env.BACKEND_URL;
    const token = process.env.REPOLL_TOKEN;
    if (!rawBackendUrl) {
      return jsonError(503, "BACKEND_URL not configured on the dashboard");
    }
    if (!token) {
      return jsonError(503, "REPOLL_TOKEN not configured on the dashboard");
    }

    // Tolerate values pasted without the scheme. Railway's public-domain
    // UI shows "kalshibackend-production-xxxx.up.railway.app" without
    // https://, and people copy that exact string.
    let backendUrl = rawBackendUrl.trim().replace(/\/$/, "");
    if (!/^https?:\/\//i.test(backendUrl)) {
      backendUrl = `https://${backendUrl}`;
    }

    let r: Response;
    try {
      r = await fetch(`${backendUrl}/repoll`, {
        method: "POST",
        headers: {
          "X-Repoll-Token": token,
          // Forward the verified role so the backend can also enforce
          // admin-only at its end (defense in depth).
          "X-Caller-Role": me.role,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });
    } catch (e) {
      // Don't echo `e.message` — it leaks the backend hostname/port via
      // ECONNREFUSED-style errors. Log server-side, return generic.
      console.error("repoll: upstream fetch failed:", e);
      return jsonError(502, "upstream unreachable");
    }

    // Best-effort log so the admin sees their own repolls in /settings.
    try {
      await logActivity({ user_id: me.sub, action: "repoll" });
    } catch {
      /* noop */
    }

    const text = await r.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    if (parsed && typeof parsed === "object") {
      return NextResponse.json(parsed, { status: r.status });
    }

    // Upstream returned non-JSON (Railway 502 HTML, Vercel timeout HTML,
    // Cloudflare error page, etc.). Log the body+URL server-side for
    // debugging but don't ship them in the response — the upstream URL
    // contains the Railway hostname and the body could leak stack traces.
    if (text) {
      console.error("repoll: upstream non-JSON response", {
        status: r.status,
        url: `${backendUrl}/repoll`,
        body_preview: text.slice(0, 500),
      });
    }
    return jsonError(
      r.status >= 400 ? r.status : 502,
      `upstream returned non-JSON (HTTP ${r.status})`,
    );
  } catch (e) {
    // Anything else — log server-side, return generic to client.
    console.error("repoll: proxy error:", e);
    return jsonError(500, "proxy error");
  }
}
