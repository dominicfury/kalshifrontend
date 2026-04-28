import { AlertTriangle, Database, Mail, Network } from "lucide-react";

import { AutoRefresh } from "@/components/layout/auto-refresh";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader, Section } from "@/components/ui/section";
import { Stat } from "@/components/ui/stat";
import { StatusDot } from "@/components/ui/status-dot";
import { ago } from "@/lib/format";
import { fetchHealth } from "@/lib/queries";

export const dynamic = "force-dynamic";


function freshnessTone(lastIso: string | null, staleAfterSec: number) {
  if (!lastIso) return "error" as const;
  const t = Date.parse(
    lastIso.endsWith("Z") || lastIso.includes("+") ? lastIso : lastIso + "Z",
  );
  if (Number.isNaN(t)) return "error" as const;
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec > staleAfterSec * 2) return "error" as const;
  if (sec > staleAfterSec) return "warn" as const;
  return "ok" as const;
}

const TONE_LABEL = {
  ok: "OK",
  warn: "STALE",
  error: "DOWN",
} as const;

const TONE_TEXT_CLASS = {
  ok: "text-emerald-400",
  warn: "text-amber-400",
  error: "text-rose-400",
} as const;


export default async function HealthPage() {
  let h = null;
  let error: string | null = null;
  try {
    h = await fetchHealth();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <>
      <PageHeader
        eyebrow="updated every 30s"
        title="System health"
        description="Poller freshness, signal counts, and matcher coverage at a glance."
        actions={<AutoRefresh intervalMs={30_000} />}
      />

      {error && (
        <div className="rounded-xl border border-rose-900/80 bg-rose-950/40 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {h && (
        <>
          <Section
            eyebrow="upstreams"
            title="Pollers"
            description="Polls write to kalshi_quotes / book_quotes on every tick. Stale = upstream not updating, downstream signals can't be trusted."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <PollerCard
                name="Kalshi"
                icon={<Network className="size-4" />}
                lastIso={h.last_kalshi_poll}
                staleAfterSec={120}
              />
              <PollerCard
                name="Sportsbooks (Odds API)"
                icon={<Database className="size-4" />}
                lastIso={h.last_book_poll}
                staleAfterSec={300}
              />
            </div>
          </Section>

          <Section eyebrow="output" title="Signals">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Total" value={h.signals_total} />
              <Stat label="Last 24h" value={h.signals_last_24h} tone="muted" />
              <Stat label="With CLV" value={h.signals_with_clv} tone="muted" />
              <Stat label="Resolved" value={h.signals_resolved} tone="muted" />
              <Stat
                label="Alerted"
                value={h.signals_alerted}
                tone={h.signals_alerted === 0 ? "muted" : "default"}
                icon={<Mail className="size-3" />}
              />
            </div>
          </Section>

          <Section
            eyebrow="matcher"
            title="Coverage"
            description="Unmatched markets indicate normalizer bugs. Anomalies are signals that fired but tripped a sanity-check rule."
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Active markets" value={h.active_kalshi_markets} />
              <Stat label="Events (24h)" value={h.events_active} tone="muted" />
              <Stat
                label="Unmatched"
                value={h.unmatched_kalshi_count}
                tone={
                  h.unmatched_kalshi_count > 5
                    ? "warning"
                    : h.unmatched_kalshi_count === 0
                      ? "positive"
                      : "muted"
                }
                icon={
                  h.unmatched_kalshi_count > 5 ? (
                    <AlertTriangle className="size-3" />
                  ) : undefined
                }
              />
              <Stat
                label="Anomalies"
                value={h.signal_anomalies_count}
                tone={
                  h.signal_anomalies_count > 0 ? "warning" : "positive"
                }
              />
            </div>
          </Section>
        </>
      )}
    </>
  );
}


function PollerCard({
  name,
  icon,
  lastIso,
  staleAfterSec,
}: {
  name: string;
  icon: React.ReactNode;
  lastIso: string | null;
  staleAfterSec: number;
}) {
  const t = freshnessTone(lastIso, staleAfterSec);
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <span className="text-zinc-500">{icon}</span>
            {name}
          </div>
          <div className="flex items-center gap-2">
            <StatusDot tone={t} pulse={t === "ok"} />
            <span
              className={`text-[10px] uppercase tracking-[0.16em] ${TONE_TEXT_CLASS[t]}`}
            >
              {TONE_LABEL[t]}
            </span>
          </div>
        </div>
        <div className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
          {lastIso ? ago(lastIso) : "never"}
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          stale threshold {staleAfterSec}s · last successful poll
        </div>
      </CardBody>
    </Card>
  );
}
