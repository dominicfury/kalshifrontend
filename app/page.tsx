import { ArrowDown, ArrowUp, Activity, Zap } from "lucide-react";

import { SignalFilterBar } from "@/components/filters/signal-filters";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  TBody,
  Td,
  THead,
  Th,
  Tr,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/section";
import { ago, num, pct, teamLabel } from "@/lib/format";
import {
  fetchRecentSignals,
  type SignalFilters,
  type SignalRow,
} from "@/lib/queries";

// Filters are URL-driven, so we render on every request rather than ISR.
export const dynamic = "force-dynamic";
export const revalidate = 0;


function matchupLabel(s: SignalRow): string {
  return `${teamLabel(s.away_team)} @ ${teamLabel(s.home_team)}`;
}

function marketChip(s: SignalRow) {
  if (s.market_type === "moneyline") {
    return (
      <Badge variant={s.side === "yes" ? "info" : "muted"} mono>
        ML {s.side.toUpperCase()}
      </Badge>
    );
  }
  return (
    <Badge variant="muted" mono>
      {s.market_type.toUpperCase()} {s.line ?? ""} {s.side.toUpperCase()}
    </Badge>
  );
}

function edgeBadge(edge: number | null) {
  if (edge == null) return <span className="text-zinc-600">—</span>;
  if (edge >= 0.05)
    return (
      <Badge variant="warning" mono>
        ⚠ {pct(edge)}
      </Badge>
    );
  if (edge >= 0.02) return <Badge variant="positive" mono>{pct(edge)}</Badge>;
  if (edge >= 0.005) return <Badge variant="info" mono>{pct(edge)}</Badge>;
  return <span className="font-mono tabular-nums text-zinc-500">{pct(edge)}</span>;
}

function clvBadge(clv: number | null) {
  if (clv == null) return <span className="text-zinc-600">pending</span>;
  if (clv > 0.005)
    return (
      <span className="font-mono tabular-nums text-emerald-400 inline-flex items-center gap-0.5">
        <ArrowUp className="size-3" />
        {pct(clv)}
      </span>
    );
  if (clv < -0.005)
    return (
      <span className="font-mono tabular-nums text-rose-400 inline-flex items-center gap-0.5">
        <ArrowDown className="size-3" />
        {pct(clv)}
      </span>
    );
  return <span className="font-mono tabular-nums text-zinc-400">{pct(clv)}</span>;
}

function stalenessCell(sec: number | null, staleAt: number) {
  if (sec == null) return <span className="text-zinc-600">—</span>;
  const tone =
    sec > staleAt ? "text-rose-400" : sec > staleAt / 2 ? "text-amber-400" : "text-zinc-400";
  return <span className={`font-mono tabular-nums ${tone}`}>{sec}s</span>;
}


function parseFilters(sp: Record<string, string | string[] | undefined>): SignalFilters {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const minEdgeRaw = get("minEdge");
  const minEdge = minEdgeRaw ? Number(minEdgeRaw) : undefined;
  return {
    todayOnly: get("today") === "1",
    minEdge: Number.isFinite(minEdge) ? minEdge : undefined,
    alertedOnly: get("alerted") === "1",
    unresolvedOnly: get("unresolved") === "1",
  };
}


export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);

  let signals: SignalRow[] = [];
  let error: string | null = null;
  try {
    signals = await fetchRecentSignals(100, filters);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const flagged = signals.filter((s) => s.edge_pct_after_fees >= 0.05).length;
  const positiveClv = signals.filter((s) => s.clv_pct != null && s.clv_pct > 0).length;
  const withClv = signals.filter((s) => s.clv_pct != null).length;

  return (
    <>
      <PageHeader
        eyebrow="Live · refreshes on each request"
        title="Signals"
        description="Real-time +EV opportunities across NHL game-line markets. Edge ≥ 0.5% after fees, sorted by detection time."
        actions={
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <Activity className="size-3.5" />
              {signals.length} rows
            </span>
            {flagged > 0 && (
              <Badge variant="warning">
                <Zap className="size-3" />
                {flagged} flagged ≥ 5%
              </Badge>
            )}
            {withClv > 0 && (
              <span className="text-zinc-500">
                {positiveClv}/{withClv} CLV+
              </span>
            )}
          </div>
        }
      />

      <SignalFilterBar filters={filters} total={signals.length} />

      {error && (
        <div className="rounded-xl border border-rose-900/80 bg-rose-950/40 p-4 text-sm text-rose-200">
          <div className="font-medium text-rose-100">Database error</div>
          <div className="mt-1 font-mono text-xs">{error}</div>
          <div className="mt-3 text-xs text-rose-300/80">
            Check that <code className="rounded bg-rose-900/60 px-1">TURSO_DB_URL</code> and{" "}
            <code className="rounded bg-rose-900/60 px-1">TURSO_AUTH_TOKEN</code> are set in this environment.
          </div>
        </div>
      )}

      {!error && signals.length === 0 && (
        <EmptyState
          title="No signals yet"
          description="Either polling hasn't started, or every active market is below the 0.5% edge threshold."
          hint={
            <>
              From the backend project run{" "}
              <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono">
                python -m scripts.poll_once
              </code>{" "}
              then{" "}
              <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono">
                python -m scripts.generate_signals
              </code>
              .
            </>
          }
        />
      )}

      {signals.length > 0 && (
        <DataTable>
          <THead>
            <Tr>
              <Th>When</Th>
              <Th>Matchup</Th>
              <Th>Market</Th>
              <Th align="right">Yes ask</Th>
              <Th align="right">Fair</Th>
              <Th align="right">Edge</Th>
              <Th align="right">@ size</Th>
              <Th align="right">Depth</Th>
              <Th align="right">K stale</Th>
              <Th align="right">B stale</Th>
              <Th align="right">Books</Th>
              <Th align="right">CLV</Th>
              <Th>Status</Th>
            </Tr>
          </THead>
          <TBody>
            {signals.map((s) => (
              <Tr key={s.id}>
                <Td muted>{ago(s.detected_at)}</Td>
                <Td>{matchupLabel(s)}</Td>
                <Td>{marketChip(s)}</Td>
                <Td align="right" mono>{num(s.kalshi_yes_ask, 3)}</Td>
                <Td align="right" mono>{num(s.fair_yes_prob, 3)}</Td>
                <Td align="right">{edgeBadge(s.edge_pct_after_fees)}</Td>
                <Td align="right">{edgeBadge(s.edge_pct_after_fees_at_size)}</Td>
                <Td align="right" mono muted>
                  {s.yes_book_depth == null ? "—" : `$${Math.round(s.yes_book_depth)}`}
                </Td>
                <Td align="right">{stalenessCell(s.kalshi_staleness_sec, 600)}</Td>
                <Td align="right">{stalenessCell(s.book_staleness_sec, 90)}</Td>
                <Td align="right" mono muted>{s.n_books_used}</Td>
                <Td align="right">{clvBadge(s.clv_pct)}</Td>
                <Td>
                  {s.resolved_outcome === "yes" && (
                    <Badge variant="positive" mono>WIN</Badge>
                  )}
                  {s.resolved_outcome === "no" && (
                    <Badge variant="negative" mono>LOSS</Badge>
                  )}
                  {s.resolved_outcome === "void" && (
                    <Badge variant="muted" mono>VOID</Badge>
                  )}
                  {s.resolved_outcome == null && s.closing_kalshi_yes_price != null && (
                    <Badge variant="info" mono>CLOSED</Badge>
                  )}
                  {s.resolved_outcome == null && s.closing_kalshi_yes_price == null && (
                    <span className="text-xs text-zinc-600">open</span>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </DataTable>
      )}
    </>
  );
}
