import { ArrowDown, ArrowUp, Activity } from "lucide-react";
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
import { SortHeader } from "@/components/ui/sort-header";
import { num, pct, resolveBet, teamLabel } from "@/lib/format";
import {
  fetchActiveSports,
  fetchLiveStats,
  fetchRecentSignals,
  fetchSportActivity,
  type LiveStats,
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


function formatTimeToStart(min: number | null): string {
  if (min == null) return "—";
  if (min < -1) return "live";
  if (min <= 0) return "now";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m === 0 ? `${h}h` : `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH === 0 ? `${d}d` : `${d}d ${remH}h`;
}


function timeToStartCell(min: number | null) {
  if (min == null) return <span className="text-zinc-400">—</span>;
  // Color by proximity: started/live = rose, <30m = amber, <2h = emerald,
  // anything farther out is plain zinc.
  let tone = "text-zinc-200";
  if (min < 0) tone = "text-rose-300";
  else if (min < 30) tone = "text-amber-300 font-semibold";
  else if (min < 120) tone = "text-emerald-300";
  return (
    <span className={`font-mono tabular-nums ${tone}`}>{formatTimeToStart(min)}</span>
  );
}


// Treat a signal as "fresh" if detected within the last 5 minutes of
// server-render time. AutoRefresh re-renders the page every 60s so the
// badge naturally clears as rows age out.
function isFreshSignal(detectedAt: string): boolean {
  const iso = detectedAt.endsWith("Z") || detectedAt.includes("+")
    ? detectedAt
    : `${detectedAt}Z`;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 5 * 60_000;
}


/** Live freshness pill — answers "is this market being actively polled
 * RIGHT NOW?" using kalshi_quotes.polled_at joined at query time, not the
 * stored kalshi_staleness_sec snapshot. Tone scales with quote age:
 * 🟢 ≤60s, 🟡 60–300s, 🔴 >5min. The Live filter rejects rows older than
 * 3 min, so the red state only shows in ?all=1 mode. */
function freshnessPill(ageSec: number | null, fresh: boolean) {
  if (ageSec == null) {
    return <span className="text-zinc-500 text-xs">—</span>;
  }
  let tone = "text-emerald-400";
  if (ageSec >= 60) tone = "text-amber-300";
  if (ageSec >= 300) tone = "text-rose-300";
  const label = ageSec < 60 ? `${ageSec}s` : `${Math.round(ageSec / 60)}m`;
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
  "best",
  "start_time",
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


// "Best" — bucket games by proximity (live/imminent → soon → later) and
// sort biggest edge first within each bucket. The actionable view: what's
// about to start AND mispriced. Backed by a multi-column ORDER BY in the
// query layer (see SORT_SQL "best").
const DEFAULT_SORT: { key: SignalSortKey; dir: "asc" | "desc" } = {
  key: "best",
  dir: "asc",
};


function parseSort(sp: Record<string, string | string[] | undefined>): {
  key: SignalSortKey;
  dir: "asc" | "desc";
} {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const rawKey = get("sort") as SignalSortKey | undefined;
  if (!rawKey) return { ...DEFAULT_SORT };
  const key: SignalSortKey = VALID_SORT_KEYS.includes(rawKey)
    ? rawKey
    : DEFAULT_SORT.key;
  const naturalDir: "asc" | "desc" =
    key === "start_time" || key === "best" ? "asc" : "desc";
  const explicit = get("dir");
  const dir: "asc" | "desc" =
    explicit === "asc" ? "asc" : explicit === "desc" ? "desc" : naturalDir;
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
  if (filters.showAll) params.set("all", "1");
  if (next.key !== DEFAULT_SORT.key || next.dir !== DEFAULT_SORT.dir) {
    params.set("sort", next.key);
    const naturalDir =
      next.key === "start_time" || next.key === "best" ? "asc" : "desc";
    if (next.dir !== naturalDir) params.set("dir", next.dir);
  }
  if (filters.sport) params.set("sport", filters.sport);
  const qs = params.toString();
  void current;
  return qs ? `/?${qs}` : "/";
}


function LiveEmptyState({
  stats,
  filters,
}: {
  stats: LiveStats | null;
  filters: SignalFilters;
}) {
  const hasOtherFilters =
    filters.todayOnly ||
    filters.alertedOnly ||
    filters.unresolvedOnly ||
    filters.sport ||
    (filters.minEdge != null && filters.minEdge > 0.005);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
      <div className="text-sm font-medium text-zinc-200">
        No +EV opportunities right now
      </div>
      <div className="mt-2 max-w-md mx-auto text-xs text-zinc-400">
        We&apos;re continuously polling Kalshi against the sportsbook consensus.
        When a contract drifts past the fee threshold, it shows up here.
      </div>

      {stats && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs">
          <span className="text-zinc-300">
            <span className="font-mono tabular-nums text-zinc-100">
              {stats.active_markets}
            </span>{" "}
            markets actively quoted
          </span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-300">
            <span className="font-mono tabular-nums text-zinc-100">
              {stats.signals_total}
            </span>{" "}
            detections in last 15m
          </span>
          {stats.next_event_min != null && (
            <>
              <span className="text-zinc-500">·</span>
              <span className="text-zinc-300">
                Next game:{" "}
                <span className="font-medium text-zinc-100">
                  {(stats.next_event_sport ?? "").toUpperCase()}
                </span>{" "}
                in{" "}
                <span className="font-mono tabular-nums text-emerald-300">
                  {formatTimeToStart(stats.next_event_min)}
                </span>
              </span>
            </>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs">
        {hasOtherFilters && (
          <Link
            href="/"
            className="rounded-full border border-zinc-700 px-3 py-1 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Clear filters
          </Link>
        )}
        <Link
          href="/?all=1"
          className="rounded-full border border-emerald-700/60 bg-emerald-900/20 px-3 py-1 text-emerald-300 hover:bg-emerald-900/40"
        >
          View flagged signals →
        </Link>
      </div>
    </div>
  );
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
  let liveStats: LiveStats | null = null;
  let kalshiIntervalSec = 30;
  let bookIntervalSec = 1800;
  let error: string | null = null;
  try {
    [signals, activeSports, sportActivity, liveStats, kalshiIntervalSec, bookIntervalSec] =
      await Promise.all([
        fetchRecentSignals(100, filters, sort),
        fetchActiveSports(),
        fetchSportActivity(),
        fetchLiveStats(),
        getInt(KNOWN_KEYS.KALSHI_POLL_INTERVAL_SEC, 30),
        getInt(KNOWN_KEYS.BOOK_POLL_INTERVAL_SEC, 1800),
      ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const isAdmin = me.role === "admin";
  const showAll = !!filters.showAll;

  const positiveClv = signals.filter((s) => s.clv_pct != null && s.clv_pct > 0).length;
  const withClv = signals.filter((s) => s.clv_pct != null).length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <SportActivityBar activity={sportActivity} />
          <span
            className="hidden md:inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-400"
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
        <LiveEmptyState stats={liveStats} filters={filters} />
      )}

      {signals.length > 0 && (
        <DataTable>
          <THead>
            <Tr>
              {/* Live freshness — replaces the old "When" column. Always shown. */}
              <Th>
                <span className="text-zinc-300">Live</span>
              </Th>
              {/* Game in — always shown. Sortable. */}
              <Th>
                <SortHeader
                  label="Game in"
                  sortKey="start_time"
                  active={sort.key === "start_time"}
                  dir={sort.dir}
                  href={sortHref}
                  naturalDir="asc"
                />
              </Th>
              {/* Sport — hidden below md. */}
              <Th className="hidden md:table-cell">Sport</Th>
              {/* Matchup — always shown but truncated on mobile. */}
              <Th>Matchup</Th>
              {/* Bet — the resolved description. Always shown. */}
              <Th>Bet</Th>
              {/* Price — always shown, sortable. */}
              <Th align="right">
                <SortHeader
                  label="Price"
                  sortKey="kalshi_yes_ask"
                  active={sort.key === "kalshi_yes_ask"}
                  dir={sort.dir}
                  href={sortHref}
                  align="right"
                />
              </Th>
              {/* Fair — hidden below sm. Sortable. */}
              <Th align="right" className="hidden sm:table-cell">
                <SortHeader
                  label="Fair"
                  sortKey="fair"
                  active={sort.key === "fair"}
                  dir={sort.dir}
                  href={sortHref}
                  align="right"
                />
              </Th>
              {/* Edge — always shown. Folds @size into the cell. */}
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
              {/* Depth — hidden below md. */}
              <Th align="right" className="hidden md:table-cell">Depth</Th>
              {/* Books — hidden below md. Sortable. */}
              <Th align="right" className="hidden md:table-cell">
                <SortHeader
                  label="Books"
                  sortKey="n_books"
                  active={sort.key === "n_books"}
                  dir={sort.dir}
                  href={sortHref}
                  align="right"
                />
              </Th>
              {/* Admin or All-mode — extra columns for inspection. */}
              {(isAdmin || showAll) && (
                <>
                  <Th align="right" className="hidden lg:table-cell">
                    <SortHeader
                      label="K stale"
                      sortKey="kalshi_stale"
                      active={sort.key === "kalshi_stale"}
                      dir={sort.dir}
                      href={sortHref}
                      align="right"
                    />
                  </Th>
                  <Th align="right" className="hidden lg:table-cell">
                    <SortHeader
                      label="B stale"
                      sortKey="book_stale"
                      active={sort.key === "book_stale"}
                      dir={sort.dir}
                      href={sortHref}
                      align="right"
                    />
                  </Th>
                  <Th align="right" className="hidden lg:table-cell">
                    <SortHeader
                      label="CLV"
                      sortKey="clv"
                      active={sort.key === "clv"}
                      dir={sort.dir}
                      href={sortHref}
                      align="right"
                    />
                  </Th>
                </>
              )}
              {/* Status — only meaningful in All mode (Live filter excludes
                  closed/resolved rows by definition). */}
              {showAll && <Th>Status</Th>}
              <Th>AI</Th>
            </Tr>
          </THead>
          <TBody>
            {signals.map((s) => {
              // Visual flag for rows that need investigation:
              //   - rose tint: actual stale-trap pattern — Kalshi quiet
              //     for >10 min AND >2× longer than books (books moving on
              //     info Kalshi hasn't priced in). Mostly impossible in
              //     default Live view since the filter requires the market
              //     to be actively polled, but kept for ?all=1 audit.
              //   - amber tint: edge >= 5% — spec §2 "treat with deep suspicion"
              const isStaleTrap =
                s.kalshi_staleness_sec != null &&
                s.kalshi_staleness_sec > 600 &&
                (s.book_staleness_sec == null ||
                  s.kalshi_staleness_sec > s.book_staleness_sec * 2);
              const isHugeEdge = s.edge_pct_after_fees >= 0.05;
              const rowTone = isStaleTrap
                ? "bg-rose-950/30"
                : isHugeEdge
                  ? "bg-amber-950/20"
                  : "";
              const fresh = isFreshSignal(s.detected_at);
              const price = s.side === "yes" ? s.kalshi_yes_ask : s.kalshi_no_ask;
              const fair =
                s.side === "yes" ? s.fair_yes_prob : 1 - s.fair_yes_prob;
              const showAtSize =
                s.edge_pct_after_fees_at_size != null &&
                Math.abs(s.edge_pct_after_fees_at_size - s.edge_pct_after_fees) >
                  0.001;
              return (
                <Tr key={s.id} className={rowTone}>
                  <Td>
                    <Link
                      href={`/signals/${s.id}`}
                      className="hover:opacity-80"
                      title={`Detected ${s.detected_at}`}
                    >
                      {freshnessPill(s.live_quote_age_sec, fresh)}
                    </Link>
                  </Td>
                  <Td>{timeToStartCell(s.time_to_start_min)}</Td>
                  <Td className="hidden md:table-cell">
                    <Badge variant="muted" mono>
                      {s.sport.toUpperCase()}
                    </Badge>
                  </Td>
                  <Td>
                    <Link
                      href={`/signals/${s.id}`}
                      className="hover:text-zinc-50 whitespace-nowrap"
                    >
                      {matchupLabel(s)}
                    </Link>
                  </Td>
                  <Td>{marketChip(s)}</Td>
                  <Td align="right" mono>{num(price, 3)}</Td>
                  <Td align="right" mono className="hidden sm:table-cell">
                    {num(fair, 3)}
                  </Td>
                  <Td align="right">
                    <div className="flex flex-col items-end gap-0.5">
                      {edgeBadge(s.edge_pct_after_fees)}
                      {showAtSize && (
                        <span
                          className="font-mono tabular-nums text-[10px] text-zinc-500"
                          title="Edge after walking $200 of fills up the book"
                        >
                          @${" "}
                          {pct(s.edge_pct_after_fees_at_size, 1)}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td align="right" mono muted className="hidden md:table-cell">
                    {s.yes_book_depth == null
                      ? "—"
                      : `$${Math.round(s.yes_book_depth)}`}
                  </Td>
                  <Td align="right" mono muted className="hidden md:table-cell">
                    {s.n_books_used}
                  </Td>
                  {(isAdmin || showAll) && (
                    <>
                      <Td align="right" className="hidden lg:table-cell">
                        {stalenessCell(s.kalshi_staleness_sec, 600)}
                      </Td>
                      <Td align="right" className="hidden lg:table-cell">
                        {stalenessCell(s.book_staleness_sec, 90)}
                      </Td>
                      <Td align="right" className="hidden lg:table-cell">
                        {clvBadge(s.clv_pct)}
                      </Td>
                    </>
                  )}
                  {showAll && (
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
                      {s.resolved_outcome == null &&
                        s.closing_kalshi_yes_price != null && (
                          <Badge variant="info" mono>CLOSED</Badge>
                        )}
                      {s.resolved_outcome == null &&
                        s.closing_kalshi_yes_price == null && (
                          <Badge variant="outline" mono>OPEN</Badge>
                        )}
                    </Td>
                  )}
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
                          live_quote_age_sec: s.live_quote_age_sec,
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
