import { ArrowDown, ArrowUp, Activity, ExternalLink, Zap } from "lucide-react";
import Link from "next/link";

import { AutoRefresh } from "@/components/layout/auto-refresh";
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
import { SortHeader } from "@/components/ui/sort-header";
import { ago, num, pct, teamLabel } from "@/lib/format";
import {
  fetchRecentSignals,
  type SignalFilters,
  type SignalRow,
  type SignalSortKey,
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
  if (edge == null) return <span className="text-zinc-400">—</span>;
  if (edge >= 0.05)
    return (
      <Badge variant="warning" mono>
        ⚠ {pct(edge)}
      </Badge>
    );
  if (edge >= 0.02) return <Badge variant="positive" mono>{pct(edge)}</Badge>;
  if (edge >= 0.005) return <Badge variant="info" mono>{pct(edge)}</Badge>;
  return <span className="font-mono tabular-nums text-zinc-200">{pct(edge)}</span>;
}

function clvBadge(clv: number | null) {
  if (clv == null) return <span className="text-zinc-400">pending</span>;
  if (clv > 0.005)
    return (
      <span className="font-mono tabular-nums font-semibold text-emerald-200 inline-flex items-center gap-0.5">
        <ArrowUp className="size-3" />
        {pct(clv)}
      </span>
    );
  if (clv < -0.005)
    return (
      <span className="font-mono tabular-nums font-semibold text-rose-200 inline-flex items-center gap-0.5">
        <ArrowDown className="size-3" />
        {pct(clv)}
      </span>
    );
  return <span className="font-mono tabular-nums text-zinc-200">{pct(clv)}</span>;
}

function stalenessCell(sec: number | null, staleAt: number) {
  if (sec == null) return <span className="text-zinc-400">—</span>;
  const tone =
    sec > staleAt ? "text-rose-200" : sec > staleAt / 2 ? "text-amber-200" : "text-zinc-200";
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
    showAll: get("all") === "1",
  };
}


const VALID_SORT_KEYS: SignalSortKey[] = [
  "detected_at",
  "edge",
  "edge_at_size",
  "kalshi_yes_ask",
  "fair",
  "kalshi_stale",
  "book_stale",
  "n_books",
  "clv",
];


function parseSort(sp: Record<string, string | string[] | undefined>): {
  key: SignalSortKey;
  dir: "asc" | "desc";
} {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const rawKey = (get("sort") || "detected_at") as SignalSortKey;
  const key: SignalSortKey = VALID_SORT_KEYS.includes(rawKey) ? rawKey : "detected_at";
  const dir: "asc" | "desc" = get("dir") === "asc" ? "asc" : "desc";
  return { key, dir };
}


function buildSortHref(
  current: { key: SignalSortKey; dir: "asc" | "desc" },
  filters: SignalFilters,
  next: { key: SignalSortKey; dir: "asc" | "desc" },
): string {
  const params = new URLSearchParams();
  if (filters.todayOnly) params.set("today", "1");
  if (filters.minEdge != null && filters.minEdge > 0) {
    params.set("minEdge", String(filters.minEdge));
  }
  if (filters.alertedOnly) params.set("alerted", "1");
  if (filters.unresolvedOnly) params.set("unresolved", "1");
  if (next.key !== "detected_at" || next.dir !== "desc") {
    params.set("sort", next.key);
    if (next.dir !== "desc") params.set("dir", next.dir);
  }
  const qs = params.toString();
  void current;  // dependency for memo callsites; current.key handled above
  return qs ? `/?${qs}` : "/";
}


export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const sort = parseSort(sp);
  const sortHref = (key: SignalSortKey, dir: "asc" | "desc") =>
    buildSortHref(sort, filters, { key, dir });

  let signals: SignalRow[] = [];
  let error: string | null = null;
  try {
    signals = await fetchRecentSignals(100, filters, sort);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const flagged = signals.filter((s) => s.edge_pct_after_fees >= 0.05).length;
  const positiveClv = signals.filter((s) => s.clv_pct != null && s.clv_pct > 0).length;
  const withClv = signals.filter((s) => s.clv_pct != null).length;

  return (
    <>
      <PageHeader
        eyebrow="Live · auto-refreshing"
        title="Kalshi +EV signals"
        description="Each row is a Kalshi NHL contract priced below fair value. 'Fair' is the multi-book sportsbook consensus (used as the oracle, not as a bet target — you can only trade on Kalshi). Click a row to see the per-book breakdown and buy."
        actions={
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <AutoRefresh intervalMs={30_000} />
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
              <Th>
                <SortHeader
                  label="When"
                  sortKey="detected_at"
                  active={sort.key === "detected_at"}
                  dir={sort.dir}
                  href={sortHref}
                />
              </Th>
              <Th>Matchup</Th>
              <Th>Market</Th>
              <Th align="right">
                <SortHeader
                  label="Yes ask"
                  sortKey="kalshi_yes_ask"
                  active={sort.key === "kalshi_yes_ask"}
                  dir={sort.dir}
                  href={sortHref}
                  align="right"
                />
              </Th>
              <Th align="right">
                <SortHeader
                  label="Fair"
                  sortKey="fair"
                  active={sort.key === "fair"}
                  dir={sort.dir}
                  href={sortHref}
                  align="right"
                />
              </Th>
              <Th align="right">
                <SortHeader
                  label="Edge"
                  sortKey="edge"
                  active={sort.key === "edge"}
                  dir={sort.dir}
                  href={sortHref}
                  align="right"
                />
              </Th>
              <Th align="right">
                <SortHeader
                  label="@ size"
                  sortKey="edge_at_size"
                  active={sort.key === "edge_at_size"}
                  dir={sort.dir}
                  href={sortHref}
                  align="right"
                />
              </Th>
              <Th align="right">Depth</Th>
              <Th align="right">
                <SortHeader
                  label="K stale"
                  sortKey="kalshi_stale"
                  active={sort.key === "kalshi_stale"}
                  dir={sort.dir}
                  href={sortHref}
                  align="right"
                />
              </Th>
              <Th align="right">
                <SortHeader
                  label="B stale"
                  sortKey="book_stale"
                  active={sort.key === "book_stale"}
                  dir={sort.dir}
                  href={sortHref}
                  align="right"
                />
              </Th>
              <Th align="right">
                <SortHeader
                  label="Books"
                  sortKey="n_books"
                  active={sort.key === "n_books"}
                  dir={sort.dir}
                  href={sortHref}
                  align="right"
                />
              </Th>
              <Th align="right">
                <SortHeader
                  label="CLV"
                  sortKey="clv"
                  active={sort.key === "clv"}
                  dir={sort.dir}
                  href={sortHref}
                  align="right"
                />
              </Th>
              <Th>Status</Th>
              <Th>Action</Th>
            </Tr>
          </THead>
          <TBody>
            {signals.map((s) => (
              <Tr key={s.id}>
                <Td muted>
                  <Link
                    href={`/signals/${s.id}`}
                    className="inline-flex items-center gap-1 hover:text-zinc-200"
                  >
                    {ago(s.detected_at)}
                    <ExternalLink className="size-3 opacity-40" />
                  </Link>
                </Td>
                <Td>
                  <Link
                    href={`/signals/${s.id}`}
                    className="hover:text-zinc-50"
                  >
                    {matchupLabel(s)}
                  </Link>
                </Td>
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
                    <Badge variant="outline" mono>OPEN</Badge>
                  )}
                </Td>
                <Td>
                  <a
                    href={`https://kalshi.com/markets/${s.ticker}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-sky-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm transition-colors hover:bg-sky-400"
                    title={`Buy ${s.side.toUpperCase()} on Kalshi at ${(s.side === "yes" ? s.kalshi_yes_ask : s.kalshi_no_ask).toFixed(3)}`}
                  >
                    Buy {s.side.toUpperCase()}
                    <ExternalLink className="size-3" />
                  </a>
                </Td>
              </Tr>
            ))}
          </TBody>
        </DataTable>
      )}
    </>
  );
}
