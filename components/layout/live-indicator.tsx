import { fetchHealth } from "@/lib/queries";
import { ago } from "@/lib/format";
import { getInt, KNOWN_KEYS } from "@/lib/system-config";

import { StatusDot } from "@/components/ui/status-dot";

export const dynamic = "force-dynamic";


function tone(lastIso: string | null, expectedIntervalSec: number) {
  // Healthy when the last poll is within ~1.5× the configured interval
  // (allows for jitter), warn at 1.5–3×, error past 3×. This makes the
  // indicators self-tune to whatever the admin sets in System Config.
  if (!lastIso) return "muted" as const;
  const t = Date.parse(lastIso.endsWith("Z") || lastIso.includes("+") ? lastIso : lastIso + "Z");
  if (Number.isNaN(t)) return "muted" as const;
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  // Floor the warn threshold so very-fast intervals (e.g. 30s) still
  // give the poller a 60s grace before going amber.
  const warnAfter = Math.max(60, Math.round(expectedIntervalSec * 1.5));
  const errorAfter = Math.max(120, Math.round(expectedIntervalSec * 3));
  if (sec > errorAfter) return "error" as const;
  if (sec > warnAfter) return "warn" as const;
  return "ok" as const;
}


export default async function LiveIndicator() {
  let lastK: string | null = null;
  let lastB: string | null = null;
  let kInterval = 30;
  let bInterval = 1800;
  try {
    const [h, k, b] = await Promise.all([
      fetchHealth(),
      getInt(KNOWN_KEYS.KALSHI_POLL_INTERVAL_SEC, 30),
      getInt(KNOWN_KEYS.BOOK_POLL_INTERVAL_SEC, 1800),
    ]);
    lastK = h.last_kalshi_poll;
    lastB = h.last_book_poll;
    kInterval = k;
    bInterval = b;
  } catch {
    // surface as offline without breaking the header
  }

  const kTone = tone(lastK, kInterval);
  const bTone = tone(lastB, bInterval);

  return (
    <div className="hidden md:flex items-center gap-4 text-xs font-mono tabular-nums">
      <div className="flex items-center gap-1.5">
        <StatusDot tone={kTone} pulse={kTone === "ok"} />
        <span className="text-zinc-300">Kalshi</span>
        <span className={kTone === "ok" ? "text-zinc-100" : "text-zinc-400"}>
          {ago(lastK)}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <StatusDot tone={bTone} pulse={bTone === "ok"} />
        <span className="text-zinc-300">Books</span>
        <span className={bTone === "ok" ? "text-zinc-100" : "text-zinc-400"}>
          {ago(lastB)}
        </span>
      </div>
    </div>
  );
}
