import { ArrowDown, ArrowUp, Activity, ExternalLink } from "lucide-react";
import Link from "next/link";

import { AIChatTrigger } from "@/components/ai/ai-chat";
import { LandingPage } from "@/components/landing/landing";
import { AutoRefresh } from "@/components/layout/auto-refresh";
import RepollButton from "@/components/layout/repoll-button";
import { SportActivityBar } from "@/components/layout/sport-activity-bar";
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
import { SortHeader } from "@/components/ui/sort-header";
import { ago, num, pct, resolveBet, teamLabel } from "@/lib/format";
import {
  fetchActiveSports,
  fetchRecentSignals,
  fetchSportActivity,
  type SignalFilters,
  type SignalRow,
  type SignalSortKey,
  type SportActivity,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { getInt, KNOWN_KEYS } from "@/lib/system-config";

// Filters are URL-driven, so we render on every request rather than ISR.
export const dynamic = "force-dynamic";
export const revalidate = 0;


function matchupLabel(s: SignalRow): string {
  return `${teamLabel(s.away_team)} @ ${teamLabel(s.home_team)}`;
}

function marketChip(s: SignalRow) {
  const bet = resolveBet(s);
  const variant = s.market_type === "moneyline" ? "info" : "muted";
  return (
    <Badge variant={variant} mono>
      {bet}
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


function formatInterval(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const h = (sec / 3600).toFixed(min % 60 === 0 ? 0 : 1);
  return `${h}h`;
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
    sport: get("sport") || undefined,
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
  if (filters.sport) params.set("sport", filters.sport);
  const qs = params.toString();
  void current;  // dependency for memo callsites; current.key handled above
  return qs ? `/?${qs}` : "/";
}


export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Logged-out visitors get the marketing landing page; the rest of this
  // function only runs once auth is established.
  const me = await getCurrentUser();
  if (!me) {
    return <LandingPage />;
  }

  const sp = await searchParams;
  const filters = parseFilters(sp);
  const sort = parseSort(sp);
  const sortHref = (key: SignalSortKey, dir: "asc" | "desc") =>
    buildSortHref(sort, filters, { key, dir });

  let signals: SignalRow[] = [];
  let activeSports: { sport: string; n: number }[] = [];
  let sportActivity: SportActivity[] = [];
  let kalshiIntervalSec = 30;
  let bookIntervalSec = 1800;
  let error: string | null = null;
  try {
    [signals, activeSports, sportActivity, kalshiIntervalSec, bookIntervalSec] =
      await Promise.all([
        fetchRecentSignals(100, filters, sort),
        fetchActiveSports(),
        fetchSportActivity(),
        getInt(KNOWN_KEYS.KALSHI_POLL_INTERVAL_SEC, 30),
        getInt(KNOWN_KEYS.BOOK_POLL_INTERVAL_SEC, 1800),
      ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const isAdmin = me.role === "admin";

  const positiveClv = signals.filter((s) => s.clv_pct != null && s.clv_pct > 0).length;
  const withClv = signals.filter((s) => s.clv_pct != null).length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <SportActivityBar activity={sportActivity} />
          <span
            className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-400"
            title="Polling cadence — admin can change in Settings"
          >
            polls · K{formatInterval(kalshiIntervalSec)} · B{formatInterval(bookIntervalSec)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-300">
          {isAdmin && <RepollButton />}
          <AutoRefresh intervalMs={60_000} />
          <span className="inline-flex items-center gap-1.5">
            <Activity className="size-3.5" />
            {signals.length} rows
          </span>
          {isAdmin && withClv > 0 && (
            <span className="text-zinc-300">
              {positiveClv}/{withClv} CLV+
            </span>
          )}
        </div>
      </div>

      <SignalFilterBar
        filters={filters}
        total={signals.length}
        sports={activeSports}
      />

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
          description="Every active market is below the 0.5% edge threshold — try again at a more active betting time."
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
              <Th>Sport</Th>
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
              {isAdmin && (
                <>
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
                </>
              )}
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
              {isAdmin && (
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
              )}
              <Th>Status</Th>
              <Th>AI</Th>
            </Tr>
          </THead>
          <TBody>
            {signals.map((s) => {
              // Visual flag for rows that need extra investigation:
              //   - rose tint: Kalshi market hasn't moved in >10 min (stale book →
              //     consensus is moving on info, Kalshi isn't, edge is a trap)
              //   - amber tint: edge >= 5% — spec says "treat with deep suspicion"
              //
              // Stale takes priority because new generation now filters those out
              // — any stale row visible is legacy data from before the filter.
              const isStale =
                s.kalshi_staleness_sec != null && s.kalshi_staleness_sec > 600;
              const isHugeEdge = s.edge_pct_after_fees >= 0.05;
              const rowTone = isStale
                ? "bg-rose-950/30"
                : isHugeEdge
                  ? "bg-amber-950/20"
                  : "";
              return (
              <Tr key={s.id} className={rowTone}>
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
                  <Badge variant="muted" mono>
                    {s.sport.toUpperCase()}
                  </Badge>
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
                {isAdmin && (
                  <>
                    <Td align="right">{stalenessCell(s.kalshi_staleness_sec, 600)}</Td>
                    <Td align="right">{stalenessCell(s.book_staleness_sec, 90)}</Td>
                  </>
                )}
                <Td align="right" mono muted>{s.n_books_used}</Td>
                {isAdmin && (
                  <Td align="right">{clvBadge(s.clv_pct)}</Td>
                )}
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
                  <AIChatTrigger
                    variant="icon"
                    context={{
                      type: "single_signal",
                      title: `${teamLabel(s.away_team)} @ ${teamLabel(s.home_team)} · ${resolveBet(s)}`,
                      payload: {
                        id: s.id,
                        ticker: s.ticker,
                        matchup: `${teamLabel(s.away_team)} @ ${teamLabel(s.home_team)}`,
                        market_type: s.market_type,
                        market_side: s.market_side,
                        line: s.line,
                        side: s.side,
                        // Pre-resolved bet so the AI doesn't have to derive
                        // it from market_side + side and risk getting the
                        // home/away mapping wrong.
                        bet: resolveBet(s),
                        action: `Buy ${s.side.toUpperCase()} on Kalshi at $${(s.side === "yes" ? s.kalshi_yes_ask : s.kalshi_no_ask).toFixed(3)}`,
                        kalshi_yes_ask: s.kalshi_yes_ask,
                        kalshi_no_ask: s.kalshi_no_ask,
                        fair_yes_prob: s.fair_yes_prob,
                        edge_pct_after_fees: s.edge_pct_after_fees,
                        edge_pct_after_fees_at_size: s.edge_pct_after_fees_at_size,
                        yes_book_depth: s.yes_book_depth,
                        n_books_used: s.n_books_used,
                        book_staleness_sec: s.book_staleness_sec,
                        kalshi_staleness_sec: s.kalshi_staleness_sec,
                        clv_pct: s.clv_pct,
                        detected_at: s.detected_at,
                        start_time: s.start_time,
                        home_team: s.home_team,
                        away_team: s.away_team,
                      },
                      seedPrompt:
                        "Walk me through this signal column-by-column. Explain what each number on the row means AND the specific value here, why this is flagged as +EV, exactly how to place the bet on Kalshi, and the biggest risks.",
                    }}
                  />
                </Td>
              </Tr>
              );
            })}
          </TBody>
        </DataTable>
      )}
    </>
  );
}
