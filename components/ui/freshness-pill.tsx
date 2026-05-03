"use client";

import { memo, useEffect, useState } from "react";


// Treat a signal as "fresh" if detected within the last 5 minutes. The
// freshness window matches the server-side isFreshSignal() helper so the
// client and server agree on the boundary.
const NEW_WINDOW_MS = 5 * 60_000;


function parseIsoMs(iso: string): number {
  const normalized = iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`;
  const t = Date.parse(normalized);
  return Number.isNaN(t) ? Date.now() : t;
}


/**
 * Live freshness pill — answers "is this market being actively polled
 * RIGHT NOW?" using kalshi_quotes.polled_at delivered as a server-rendered
 * baseline, then incremented client-side on a 5-second tick so the displayed
 * age and NEW badge stay accurate between auto-refresh cycles.
 *
 * Tone scales with quote age:
 *   🟢 ≤60s, 🟡 60–300s, 🔴 >5min
 *
 * The Live filter rejects rows older than 3 min, so the red state only shows
 * in Recent / Audit views.
 */
function FreshnessPillImpl({
  // Server-side baseline values (computed at render time).
  ageSec,
  detectedAt,
  // Used to anchor the client-side timer to the moment the server payload
  // was generated, so when the user finally sees this row N seconds later
  // the displayed age accounts for that lag.
  serverNowMs,
}: {
  ageSec: number | null;
  detectedAt: string | null;
  serverNowMs: number;
}) {
  // Tick the displayed values every 1s so the row freshness reads as a
  // live counter alongside the AutoRefresh "refresh Xs" countdown — they
  // were noticeably out of sync at 5s. Re-render cost: ~100 rows × 1Hz =
  // 100 lightweight re-renders/sec on the table, fine on modern browsers.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (ageSec == null) {
    return <span className="text-zinc-500 text-xs">—</span>;
  }

  // Live-extrapolated age: server-rendered ageSec + (now - serverNow).
  const elapsedSinceRender = Math.max(0, Math.floor((now - serverNowMs) / 1000));
  const liveAge = ageSec + elapsedSinceRender;

  let tone = "text-emerald-400";
  if (liveAge >= 60) tone = "text-amber-300";
  if (liveAge >= 300) tone = "text-rose-300";
  const label = liveAge < 60 ? `${liveAge}s` : `${Math.round(liveAge / 60)}m`;

  // Live "NEW" badge — uses the actual detected_at clock, not a snapshot.
  const fresh = detectedAt
    ? now - parseIsoMs(detectedAt) < NEW_WINDOW_MS
    : false;

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`inline-flex items-center gap-1 ${tone}`}>
        <span className="size-1.5 rounded-full bg-current" />
        <span className="font-mono tabular-nums text-xs">{label}</span>
      </span>
      {fresh && (
        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/40">
          NEW
        </span>
      )}
    </span>
  );
}


// Memoize on the (ageSec, detectedAt, serverNowMs) tuple so a parent
// re-render with identical row data doesn't blow away the per-row tick state.
export const FreshnessPill = memo(FreshnessPillImpl);
