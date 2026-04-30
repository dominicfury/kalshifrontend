import { AlertTriangle, Database, Mail, Network } from "lucide-react";

import { AutoRefresh } from "@/components/layout/auto-refresh";
import { Card, CardBody } from "@/components/ui/card";
import {
  DataTable,
  TBody,
  Td,
  THead,
  Th,
  Tr,
} from "@/components/ui/data-table";
import { PageHeader, Section } from "@/components/ui/section";
import { Stat } from "@/components/ui/stat";
import { StatusDot } from "@/components/ui/status-dot";
import { ago } from "@/lib/format";
import { fetchHealth, fetchUnmatchedBreakdown } from "@/lib/queries";

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
  let unmatched: Awaited<ReturnType<typeof fetchUnmatchedBreakdown>> = [];
  let error: string | null = null;
  try {
    [h, unmatched] = await Promise.all([
      fetchHealth(),
      fetchUnmatchedBreakdown(),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <>
      <PageHeader
        eyebrow="updated every 30s"
        title="System health"
        description="Poller freshness, signal counts, and matcher coverage at a glance."
        actions={<AutoRefresh intervalMs={60_000} />}
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
            description={
              <>
                <span className="block">
                  <strong className="text-zinc-200">Unmatched now</strong> is
                  the count of currently active, pre-game Kalshi markets with
                  no book row at the same (event, market_type, period, line).
                  Some baseline is normal — Kalshi has period totals,
                  intermission props, and tournament tennis that books don&apos;t
                  cover. Drill down via the breakdown below to see which
                  buckets are driving it.
                </span>
                <span className="block mt-2 text-zinc-500">
                  The "Logged (cumulative)" number is the
                  unmatched_kalshi_markets table — one row per (market,
                  reason) per day, retained forever — useful for trends but
                  not health.
                </span>
              </>
            }
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Active markets" value={h.active_kalshi_markets} />
              <Stat label="Events (24h)" value={h.events_active} tone="muted" />
              <Stat
                label="Unmatched now"
                value={h.unmatched_kalshi_now}
                tone={
                  h.active_kalshi_markets > 0 &&
                  h.unmatched_kalshi_now / h.active_kalshi_markets > 0.5
                    ? "warning"
                    : h.unmatched_kalshi_now === 0
                      ? "positive"
                      : "muted"
                }
                icon={
                  h.active_kalshi_markets > 0 &&
                  h.unmatched_kalshi_now / h.active_kalshi_markets > 0.5 ? (
                    <AlertTriangle className="size-3" />
                  ) : undefined
                }
              />
              <Stat
                label="Logged (cumulative)"
                value={h.unmatched_kalshi_count_cumulative}
                tone="muted"
              />
              <Stat
                label="Anomalies"
                value={h.signal_anomalies_count}
                tone={h.signal_anomalies_count > 0 ? "warning" : "positive"}
              />
            </div>

            {unmatched.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Unmatched breakdown · top {unmatched.length}
                </div>
                <DataTable>
                  <THead>
                    <Tr>
                      <Th>Sport</Th>
                      <Th>Market type</Th>
                      <Th>Period</Th>
                      <Th align="right">Markets</Th>
                      <Th>Sample ticker</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {unmatched.map((u, idx) => (
                      <Tr
                        key={`${u.sport}-${u.market_type}-${u.period}-${idx}`}
                      >
                        <Td mono>{u.sport.toUpperCase()}</Td>
                        <Td>{u.market_type}</Td>
                        <Td muted>{u.period}</Td>
                        <Td align="right" mono>
                          {u.n_markets}
                        </Td>
                        <Td muted>
                          <span className="font-mono text-xs">
                            {u.sample_ticker ?? "—"}
                          </span>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </DataTable>
              </div>
            )}
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
