import { fetchHealth } from "@/lib/queries";
import { ago } from "@/lib/format";

export const revalidate = 30;

export default async function HealthPage() {
  let h = null;
  let error: string | null = null;
  try {
    h = await fetchHealth();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">System health</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Last poll times, signal counts, and matcher coverage. Refreshes every 30s.
        </p>
      </div>

      {error && (
        <div className="rounded border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {h && (
        <>
          <section>
            <h2 className="text-sm uppercase tracking-wide text-zinc-400 mb-3">
              Pollers
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <PollerCard
                name="Kalshi"
                lastIso={h.last_kalshi_poll}
                staleAfterSec={120}
              />
              <PollerCard
                name="Sportsbooks"
                lastIso={h.last_book_poll}
                staleAfterSec={300}
              />
            </div>
          </section>

          <section>
            <h2 className="text-sm uppercase tracking-wide text-zinc-400 mb-3">
              Signals
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Stat label="Total" value={h.signals_total.toString()} />
              <Stat label="Last 24h" value={h.signals_last_24h.toString()} />
              <Stat label="With CLV" value={h.signals_with_clv.toString()} />
              <Stat label="Resolved" value={h.signals_resolved.toString()} />
              <Stat label="Alerted" value={h.signals_alerted.toString()} />
            </div>
          </section>

          <section>
            <h2 className="text-sm uppercase tracking-wide text-zinc-400 mb-3">
              Coverage
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat
                label="Active markets"
                value={h.active_kalshi_markets.toString()}
              />
              <Stat label="Events (last 24h)" value={h.events_active.toString()} />
              <Stat
                label="Unmatched"
                value={h.unmatched_kalshi_count.toString()}
                colorClass={h.unmatched_kalshi_count > 5 ? "text-amber-400" : "text-emerald-400"}
              />
              <Stat
                label="Anomalies"
                value={h.signal_anomalies_count.toString()}
                colorClass={h.signal_anomalies_count > 0 ? "text-amber-400" : "text-emerald-400"}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}


function PollerCard({
  name,
  lastIso,
  staleAfterSec,
}: {
  name: string;
  lastIso: string | null;
  staleAfterSec: number;
}) {
  const t = lastIso
    ? Date.parse(lastIso.endsWith("Z") || lastIso.includes("+") ? lastIso : lastIso + "Z")
    : null;
  const sec = t == null ? Infinity : Math.max(0, Math.round((Date.now() - t) / 1000));
  const isStale = sec > staleAfterSec;

  return (
    <div
      className={`rounded border p-4 ${
        isStale ? "border-rose-700 bg-rose-950/40" : "border-emerald-800 bg-emerald-950/20"
      }`}
    >
      <div className="text-xs uppercase text-zinc-400">{name}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1">
        {lastIso ? ago(lastIso) : "never"}
      </div>
      <div className={`text-xs mt-1 ${isStale ? "text-rose-300" : "text-emerald-300"}`}>
        {isStale ? "STALE" : "OK"} · threshold {staleAfterSec}s
      </div>
    </div>
  );
}


function Stat({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string;
  colorClass?: string;
}) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums mt-1 ${colorClass ?? ""}`}>
        {value}
      </div>
    </div>
  );
}
