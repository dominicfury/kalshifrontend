"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/cn";

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "polling_kalshi" }
  | { kind: "polling_books" }
  | { kind: "ok" }
  | { kind: "error"; message: string; full?: string };

// Backend's /repoll endpoint returns immediately (fire-and-forget — Vercel
// hobby times out at 10s, far shorter than a full Kalshi cycle's 150-200s).
// To know when the poll cycle has ACTUALLY completed, we poll
// /api/admin/poll-status until api_status.last_success_at advances for
// both Kalshi and Odds past the timestamp captured before kickoff.
//
// Hard timeouts (in case Odds is COLD-skipped or Kalshi cycle drags):
//   - 240s overall — long enough for a slow Kalshi pass + an Odds pass
//   - On timeout we still router.refresh() and show 'ok' so the user
//     isn't stuck — better to under-promise than spin forever.
const POLL_STATUS_PROBE_INTERVAL_MS = 3000;
const POLL_STATUS_TOTAL_TIMEOUT_MS = 240_000;

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

  async function fetchPollStatus(signal: AbortSignal): Promise<{
    kalshi: number | null;
    odds: number | null;
  }> {
    const r = await fetch("/api/admin/poll-status", {
      method: "GET",
      cache: "no-store",
      signal,
    });
    if (!r.ok) throw new Error(`poll-status HTTP ${r.status}`);
    const body = (await r.json()) as {
      kalshi_last_success_at: string | null;
      odds_last_success_at: string | null;
    };
    const parse = (s: string | null) => {
      if (!s) return null;
      const t = Date.parse(s.endsWith("Z") || s.includes("+") ? s : s + "Z");
      return Number.isFinite(t) ? t : null;
    };
    return {
      kalshi: parse(body.kalshi_last_success_at),
      odds: parse(body.odds_last_success_at),
    };
  }

  async function trigger() {
    if (inFlight.current) return;
    const ctrl = new AbortController();
    inFlight.current = ctrl;
    setState({ kind: "running" });

    // Snapshot api_status BEFORE kickoff so we can detect advance.
    let preStatus: { kalshi: number | null; odds: number | null };
    try {
      preStatus = await fetchPollStatus(ctrl.signal);
    } catch (e) {
      inFlight.current = null;
      if (ctrl.signal.aborted) return;
      setState({
        kind: "error",
        message:
          e instanceof Error ? `pre-status: ${e.message}` : "pre-status fetch failed",
      });
      return;
    }

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
      setState({
        kind: "error",
        message: "non-JSON success response",
        full: text.slice(0, 800),
      });
      return;
    }

    // Wait for api_status timestamps to advance past pre-kickoff values.
    // Kalshi typically completes in 150-200s; books in 10-30s (often
    // first). Show "polling kalshi" until kalshi advances, then "polling
    // books" if books haven't yet, then "ok".
    setState({ kind: "polling_kalshi" });
    const startedAt = Date.now();
    let kalshiDone = false;
    let oddsDone = false;
    while (Date.now() - startedAt < POLL_STATUS_TOTAL_TIMEOUT_MS) {
      if (ctrl.signal.aborted) return;
      await new Promise((res) =>
        setTimeout(res, POLL_STATUS_PROBE_INTERVAL_MS),
      );
      if (ctrl.signal.aborted) return;
      try {
        const cur = await fetchPollStatus(ctrl.signal);
        if (
          !kalshiDone &&
          cur.kalshi != null &&
          (preStatus.kalshi == null || cur.kalshi > preStatus.kalshi)
        ) {
          kalshiDone = true;
        }
        if (
          !oddsDone &&
          cur.odds != null &&
          (preStatus.odds == null || cur.odds > preStatus.odds)
        ) {
          oddsDone = true;
        }
        if (kalshiDone && oddsDone) break;
        if (kalshiDone && !oddsDone) {
          setState({ kind: "polling_books" });
        }
      } catch {
        // Transient probe failure — keep trying until timeout.
      }
    }
    if (ctrl.signal.aborted) return;
    inFlight.current = null;
    // Refresh page to update LiveIndicator + signals table with the new
    // data. router.refresh() re-runs the server components.
    startTransition(() => router.refresh());
    setState({ kind: "ok" });
    setTimeout(() => setState({ kind: "idle" }), 6000);
  }

  const disabled =
    state.kind === "running" ||
    state.kind === "polling_kalshi" ||
    state.kind === "polling_books";

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
          : state.kind === "polling_kalshi"
            ? "Polling Kalshi…"
            : state.kind === "polling_books"
              ? "Polling books…"
              : "Repoll"}
      </button>
      {state.kind === "ok" && (
        <span className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">
          complete · refreshed
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
