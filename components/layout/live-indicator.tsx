import { fetchApiStatus, fetchHealth, type ApiStatusRow } from "@/lib/queries";
import { ago } from "@/lib/format";

import { StatusDot } from "@/components/ui/status-dot";

export const dynamic = "force-dynamic";


function parseIso(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  return Number.isNaN(t) ? null : t;
}


/** Health verdict for one source (Kalshi or books).
 *
 * Red ONLY if the most recent attempt FAILED — i.e. last_error_at is
 * present AND newer than last_success_at. A delayed poll (overdue but
 * not failed) stays green; the timestamp text shows "5m ago" so the
 * user can see the lag without the dot screaming "broken." Muted when
 * we have no data yet (fresh deploy, never polled).
 *
 * `lastSuccessIso` is the value rendered as "Xm ago" — the most recent
 * successful poll. We prefer the api_status row when present (which the
 * pollers explicitly stamp on every attempt) and fall back to the most
 * recent quote row's polled_at when api_status hasn't been populated. */
function verdict(
  status: ApiStatusRow | undefined,
  fallbackSuccessIso: string | null,
): { tone: "ok" | "error" | "muted"; lastSuccessIso: string | null } {
  const successAtIso = status?.last_success_at ?? fallbackSuccessIso;
  const successAt = parseIso(successAtIso);
  const errorAt = parseIso(status?.last_error_at ?? null);

  // Failed: last error is strictly newer than last success.
  if (errorAt != null && (successAt == null || errorAt > successAt)) {
    return { tone: "error", lastSuccessIso: successAtIso };
  }
  // Healthy: we have a success on record (regardless of how long ago).
  if (successAt != null) {
    return { tone: "ok", lastSuccessIso: successAtIso };
  }
  // No data yet.
  return { tone: "muted", lastSuccessIso: null };
}


export default async function LiveIndicator() {
  let kalshi: ApiStatusRow | undefined;
  let odds: ApiStatusRow | undefined;
  let lastK: string | null = null;
  let lastB: string | null = null;
  try {
    const [statuses, h] = await Promise.all([fetchApiStatus(), fetchHealth()]);
    kalshi = statuses.find((s) => s.api === "kalshi");
    odds = statuses.find((s) => s.api === "odds");
    lastK = h.last_kalshi_poll;
    lastB = h.last_book_poll;
  } catch {
    // surface as muted without breaking the header
  }

  const k = verdict(kalshi, lastK);
  const b = verdict(odds, lastB);

  return (
    <div className="hidden md:flex items-center gap-4 text-xs font-mono tabular-nums">
      <div
        className="flex items-center gap-1.5"
        title={
          kalshi?.last_error_message && k.tone === "error"
            ? `Last Kalshi poll failed: ${kalshi.last_error_message}`
            : "Time since the most recent successful Kalshi poll"
        }
      >
        <StatusDot tone={k.tone} pulse={k.tone === "ok"} />
        <span className="text-zinc-300">Kalshi</span>
        <span className={k.tone === "error" ? "text-rose-300" : "text-zinc-100"}>
          {ago(k.lastSuccessIso)}
        </span>
      </div>
      <div
        className="flex items-center gap-1.5"
        title={
          odds?.last_error_message && b.tone === "error"
            ? `Last book poll failed: ${odds.last_error_message}`
            : "Time since the most recent successful book poll"
        }
      >
        <StatusDot tone={b.tone} pulse={b.tone === "ok"} />
        <span className="text-zinc-300">Books</span>
        <span className={b.tone === "error" ? "text-rose-300" : "text-zinc-100"}>
          {ago(b.lastSuccessIso)}
        </span>
      </div>
    </div>
  );
}
