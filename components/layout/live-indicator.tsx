import { fetchHealth } from "@/lib/queries";
import { ago } from "@/lib/format";

import { StatusDot } from "@/components/ui/status-dot";

export const dynamic = "force-dynamic";


function tone(lastIso: string | null, staleAfterSec: number) {
  if (!lastIso) return "muted" as const;
  const t = Date.parse(lastIso.endsWith("Z") || lastIso.includes("+") ? lastIso : lastIso + "Z");
  if (Number.isNaN(t)) return "muted" as const;
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec > staleAfterSec * 2) return "error" as const;
  if (sec > staleAfterSec) return "warn" as const;
  return "ok" as const;
}


export default async function LiveIndicator() {
  let lastK: string | null = null;
  let lastB: string | null = null;
  try {
    const h = await fetchHealth();
    lastK = h.last_kalshi_poll;
    lastB = h.last_book_poll;
  } catch {
    // surface as offline without breaking the header
  }

  const kTone = tone(lastK, 120);
  const bTone = tone(lastB, 300);

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
