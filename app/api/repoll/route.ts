import { NextResponse } from "next/server";

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
export async function POST() {
  try {
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
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });
    } catch (e) {
      return jsonError(
        502,
        e instanceof Error ? e.message : "fetch failed",
        { backend: backendUrl },
      );
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
    // Cloudflare error page, etc.). Wrap it so the client can render it.
    const trimmed = text.length > 1500 ? text.slice(0, 1500) + "…" : text;
    return jsonError(
      r.status >= 400 ? r.status : 502,
      `upstream returned non-JSON (HTTP ${r.status})`,
      { upstream_body: trimmed, upstream_url: `${backendUrl}/repoll` },
    );
  } catch (e) {
    // Anything else — return JSON so the client error display works.
    return jsonError(
      500,
      e instanceof Error ? `proxy error: ${e.message}` : "proxy error",
    );
  }
}
