import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Proxies a manual repoll request from the dashboard to the Railway-hosted
// backend. Holds the shared X-Repoll-Token server-side so it never leaves
// Vercel's edge — the browser only sees a same-origin POST.
export async function POST() {
  const backendUrl = process.env.BACKEND_URL;
  const token = process.env.REPOLL_TOKEN;
  if (!backendUrl) {
    return NextResponse.json(
      { error: "BACKEND_URL not configured on the dashboard" },
      { status: 503 },
    );
  }
  if (!token) {
    return NextResponse.json(
      { error: "REPOLL_TOKEN not configured on the dashboard" },
      { status: 503 },
    );
  }

  let r: Response;
  try {
    r = await fetch(`${backendUrl.replace(/\/$/, "")}/repoll`, {
      method: "POST",
      headers: {
        "X-Repoll-Token": token,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 },
    );
  }

  // Pass through the backend's status + body so 429/503 reach the user.
  const text = await r.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return NextResponse.json(body, { status: r.status });
}
