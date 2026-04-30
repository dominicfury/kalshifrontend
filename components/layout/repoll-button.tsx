"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/cn";

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "kicked_off" }
  | { kind: "ok" }
  | { kind: "error"; message: string; full?: string };

// Backend kicks the poll off as a background task and returns immediately
// (fire-and-forget — Vercel hobby times out functions at 10s, much shorter
// than a full poll cycle). After kickoff we poll /api/health on a tight
// interval to detect when the server is actually responsive again, falling
// back to a hard timeout if the poll itself drags. Previously a fixed 18s
// wait raced against poll cycles that occasionally ran longer; the new
// behavior refreshes as soon as the server is reachable and bounded above.
const POST_KICKOFF_MAX_WAIT_MS = 30_000;
const POST_KICKOFF_PROBE_INTERVAL_MS = 1500;

export default function RepollButton() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const router = useRouter();
  // Block re-entry while a repoll is in flight: the backend rate-limits
  // /api/repoll and we don't want overlapping refresh()es racing each other.
  const inFlight = useRef<AbortController | null>(null);

  // Cancel any pending probe loop on unmount.
  useEffect(() => {
    return () => {
      inFlight.current?.abort();
      inFlight.current = null;
    };
  }, []);

  async function trigger() {
    if (inFlight.current) return;
    const ctrl = new AbortController();
    inFlight.current = ctrl;
    setState({ kind: "running" });
    let r: Response;
    try {
      r = await fetch("/api/repoll", {
        method: "POST",
        cache: "no-store",
        signal: ctrl.signal,
      });
    } catch (e) {
      inFlight.current = null;
      if (ctrl.signal.aborted) return;
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "fetch failed",
      });
      return;
    }

    // Read as text first so non-JSON error pages (Vercel timeout HTML,
    // Railway 502 page, etc.) don't crash the JSON parser. We surface the
    // first chunk of the raw body so the user can see WHAT broke.
    const text = await r.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    const asObj = (body && typeof body === "object" ? body : {}) as Record<
      string,
      unknown
    >;

    if (!r.ok) {
      inFlight.current = null;
      const message =
        (typeof asObj.error === "string" && asObj.error) ||
        (typeof asObj.detail === "string" && asObj.detail) ||
        `HTTP ${r.status}`;
      setState({
        kind: "error",
        message,
        full: text.slice(0, 800),
      });
      return;
    }

    if (body == null) {
      inFlight.current = null;
      // 200 OK but body wasn't JSON — exotic but possible if a proxy
      // rewrote the response. Surface raw text so we can debug.
      setState({
        kind: "error",
        message: "non-JSON success response",
        full: text.slice(0, 800),
      });
      return;
    }

    setState({ kind: "kicked_off" });
    const startedAt = Date.now();
    while (Date.now() - startedAt < POST_KICKOFF_MAX_WAIT_MS) {
      if (ctrl.signal.aborted) return;
      try {
        const probe = await fetch("/api/health", {
          method: "GET",
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (probe.ok) break;
      } catch {
        // Probe failure means the worker is still busy or the backend is
        // restarting — keep polling until the deadline.
      }
      await new Promise((res) => setTimeout(res, POST_KICKOFF_PROBE_INTERVAL_MS));
    }
    if (ctrl.signal.aborted) return;
    inFlight.current = null;
    startTransition(() => router.refresh());
    setState({ kind: "ok" });
    setTimeout(() => setState({ kind: "idle" }), 6000);
  }

  const disabled = state.kind === "running" || state.kind === "kicked_off";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={trigger}
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
          "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-50",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
        title="Manually trigger a Kalshi + sportsbook poll"
      >
        {disabled ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
        {state.kind === "running"
          ? "Sending…"
          : state.kind === "kicked_off"
            ? "Polling…"
            : "Repoll"}
      </button>
      {state.kind === "ok" && (
        <span className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">
          ok · refreshed
        </span>
      )}
      {state.kind === "error" && (
        <details className="text-[10px] uppercase tracking-[0.16em] text-rose-300">
          <summary className="cursor-pointer">err · {state.message}</summary>
          {state.full && (
            <pre className="mt-1 max-h-48 max-w-md overflow-auto rounded border border-rose-900/60 bg-rose-950/40 p-2 text-[10px] font-mono normal-case text-rose-100 whitespace-pre-wrap break-all">
              {state.full}
            </pre>
          )}
        </details>
      )}
    </div>
  );
}
