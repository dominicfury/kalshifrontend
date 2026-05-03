import { ArrowDown, ArrowUp, Activity } from "lucide-react";
import Link from "next/link";

import { AIChatTrigger } from "@/components/ai/ai-chat";
import { TrackButton } from "@/components/admin/track-button";
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
import { SignalAnnouncer } from "@/components/ui/signal-announcer";
import { SortHeader } from "@/components/ui/sort-header";
import { num, pct, resolveBet, teamLabel } from "@/lib/format";
import { suggestedStakeFraction } from "@/lib/kelly";
import {
  fetchActiveSports,
  fetchLiveStats,
  fetchRecentSignals,
  fetchSportActivity,
  type LiveStats,
  type SignalFilters,
  type SignalRow,
  type SignalSortKey,
  type SignalView,
  type SportActivity,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { getBool, KNOWN_KEYS } from "@/lib/system-config";
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


// Relative time-ago string for the Detected column in Recent / Audit views.
// SQLite datetime() emits UTC without a Z marker (e.g. "2026-05-03 05:11:18"),
// so we manually append the marker before Date.parse so the browser doesn't
// fall back to local-time interpretation.
function formatAgo(iso: string, nowMs: number): string {
  const parseable = iso.includes("T") ? iso : iso.replace(" ", "T") + "Z";
  const t = Date.parse(parseable);
  if (!Number.isFinite(t)) return "—";
  const ageSec = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (ageSec < 60) return `${ageSec}s ago`;
  const ageMin = Math.floor(ageSec / 60);
  if (ageMin < 60) return `${ageMin}m ago`;
  const h = Math.floor(ageMin / 60);
  const m = ageMin % 60;
  if (h < 24) return m === 0 ? `${h}h ago` : `${h}h ${m}m ago`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH === 0 ? `${d}d ago` : `${d}d ${remH}h ago`;
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




function parseFilters(sp: Record<string, string | string[] | undefined>): SignalFilters {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const minEdgeRaw = get("minEdge");
  const minEdge = minEdgeRaw ? Number(minEdgeRaw) : undefined;
  const rawView = get("view");
  const view: SignalView | undefined =
    rawView === "live" || rawView === "recent" || rawView === "audit"
      ? rawView
      : undefined;
  return {
    todayOnly: get("today") === "1",
    minEdge: Number.isFinite(minEdge) ? minEdge : undefined,
    alertedOnly: get("alerted") === "1",
    unresolvedOnly: get("unresolved") === "1",
    view,
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
  if (filters.view && filters.view !== "live") params.set("view", filters.view);
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
          href="/?view=recent"
          className="rounded-full border border-emerald-700/60 bg-emerald-900/20 px-3 py-1 text-emerald-300 hover:bg-emerald-900/40"
        >
          See last 24h →
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
    const signupsOpen = await getBool(KNOWN_KEYS.SIGNUPS_ENABLED, true);
    return <LandingPage signupsOpen={signupsOpen} />;
  }

  const sp = await searchParams;
  const rawFilters = parseFilters(sp);
  const isAdmin = me.role === "admin";
  // Audit clamp: non-admin users requesting `?view=audit` (URL-typed or
  // bookmarked) get downgraded to Recent. Audit's an unfiltered detection
  // dump and only useful for debugging the pipeline — there's no reason
  // to expose it to non-admin users, and the volume would be confusing.
  const filters: SignalFilters = {
    ...rawFilters,
    view:
      rawFilters.view === "audit" && !isAdmin ? "recent" : rawFilters.view,
  };
  const view: SignalView = filters.view ?? "live";
  const sort = parseSort(sp);
  const sortHref = (key: SignalSortKey, dir: "asc" | "desc") =>
    buildSortHref(sort, filters, { key, dir });

  let signals: SignalRow[] = [];
  let activeSports: { sport: string; n: number }[] = [];
  let sportActivity: SportActivity[] = [];
  let liveStats: LiveStats | null = null;
  let error: string | null = null;
  try {
    [signals, activeSports, sportActivity, liveStats] = await Promise.all([
      fetchRecentSignals(100, filters, sort),
      fetchActiveSports(),
      fetchSportActivity(),
      fetchLiveStats(),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  // Show the diagnostic columns (K stale, B stale, CLV) and the Status
  // column whenever we're outside the strict Live view — Recent shows
  // historical state, Audit shows raw detection rows. Admins also see
  // the diagnostics in Live (they always have for triage).
  const showStatusCol = view !== "live";
  const showDiagCols = isAdmin || view !== "live";
  // Anchor client-side freshness ticks to the moment this server payload was
  // built. Without this anchor, "5s old" stays "5s old" until the next refresh.
  // Date.now() is fine here — this runs on the server during SSR, not in a
  // React render path the purity linter cares about.
  // eslint-disable-next-line react-hooks/purity
  const serverNowMs = Date.now();

  const positiveClv = signals.filter((s) => s.clv_pct != null && s.clv_pct > 0).length;
  const withClv = signals.filter((s) => s.clv_pct != null).length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <SportActivityBar activity={sportActivity} />
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-300">
          {isAdmin && <RepollButton />}
          {/* AutoRefresh's visible countdown is hidden — the LiveIndicator
              (Kalshi/Books status in the header) gives the same freshness
              signal in a single place. The component still runs its 60s
              timer + router.refresh() so the page keeps updating. */}
          <div className="hidden">
            <AutoRefresh intervalMs={60_000} />
          </div>
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
        isAdmin={isAdmin}
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

      <SignalAnnouncer
        latestId={signals.length > 0 ? Math.max(...signals.map((s) => s.id)) : null}
      />

      {signals.length > 0 && (
        <DataTable
          aria-label="Live signal table"
          role="region"
        >
          <THead>
            <Tr>
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
              {/* Sport — always shown. */}
              <Th>Sport</Th>
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
              {/* Fair — always shown. Sortable. */}
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
              {/* Stake — ¼ Kelly suggested stake, surfaced only on rows
                  with edge >= 2% (see lib/kelly.ts STAKE_GATE_EDGE_PCT).
                  Sub-2% rows show "—" so the column doesn't disappear
                  visually as edges fluctuate. */}
              <Th align="right">Stake</Th>
              {/* Depth — always shown. Disambiguates @$ omission for thin books. */}
              <Th align="right">Depth</Th>
              {/* Books — always shown. Sortable. */}
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
              {/* Admin or All-mode — extra columns for inspection. */}
              {showDiagCols && (
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
              {showStatusCol && (
                <Th align="right" className="hidden md:table-cell whitespace-nowrap">
                  <SortHeader
                    label="Detected"
                    sortKey="detected_at"
                    active={sort.key === "detected_at"}
                    dir={sort.dir}
                    href={sortHref}
                    align="right"
                  />
                </Th>
              )}
              {showStatusCol && <Th>Status</Th>}
              {/* Track is admin-only — non-admins still see AI but no track icon. */}
              {isAdmin && <Th>Track</Th>}
              <Th>AI</Th>
            </Tr>
          </THead>
          <TBody>
            {signals.map((s) => {
              // Visual flag for rows that need investigation:
              //   - rose tint: actual stale-trap pattern — Kalshi quiet AND
              //     books JUST moved (suggesting news-driven repricing the
              //     Kalshi MMs haven't caught up to). Books also-quiet means
              //     no news event, so the staleness ratio alone is just
              //     illiquidity (common on tennis match_winner). This logic
              //     mirrors backend Filter A1 in generate_signals.py.
              //   - amber tint: edge >= 5% — spec §2 "treat with deep suspicion"
              const isStaleTrap =
                s.kalshi_staleness_sec != null &&
                s.kalshi_staleness_sec > 600 &&
                s.book_staleness_sec != null &&
                s.book_staleness_sec < 600 &&
                s.kalshi_staleness_sec > s.book_staleness_sec * 2;
              const isHugeEdge = s.edge_pct_after_fees >= 0.05;
              const rowTone = isStaleTrap
                ? "bg-rose-950/30"
                : isHugeEdge
                  ? "bg-amber-950/20"
                  : "";
              const price = s.side === "yes" ? s.kalshi_yes_ask : s.kalshi_no_ask;
              const fair =
                s.side === "yes" ? s.fair_yes_prob : 1 - s.fair_yes_prob;
              const showAtSize =
                s.edge_pct_after_fees_at_size != null &&
                Math.abs(s.edge_pct_after_fees_at_size - s.edge_pct_after_fees) >
                  0.001;
              return (
                <Tr key={s.id} className={rowTone}>
                  <Td>{timeToStartCell(s.time_to_start_min)}</Td>
                  <Td>
                    <Badge variant="muted" mono>
                      {s.sport.toUpperCase()}
                    </Badge>
                  </Td>
                  <Td>
                    <Link
                      href={`/signals/${s.id}`}
                      title={matchupLabel(s)}
                      className="hover:text-zinc-50 block max-w-[14rem] truncate sm:max-w-[20rem] sm:whitespace-nowrap md:max-w-none"
                    >
                      {matchupLabel(s)}
                    </Link>
                  </Td>
                  <Td>{marketChip(s)}</Td>
                  <Td align="right" mono>{num(price, 3)}</Td>
                  <Td align="right" mono>
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
                          @${" "}
                          {pct(s.edge_pct_after_fees_at_size, 1)}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td align="right" mono>
                    {(() => {
                      const stake = suggestedStakeFraction(s);
                      if (stake == null)
                        return <span className="text-zinc-500">—</span>;
                      return (
                        <span
                          className="text-emerald-200"
                          title="Quarter-Kelly as a percentage of bankroll. Multiply by your own bankroll to get the dollar stake."
                        >
                          {(stake * 100).toFixed(2)}%
                        </span>
                      );
                    })()}
                  </Td>
                  <Td align="right" mono muted>
                    {s.yes_book_depth == null
                      ? "—"
                      : `$${Math.round(s.yes_book_depth)}`}
                  </Td>
                  <Td align="right" mono muted>
                    <div className="inline-flex items-center justify-end gap-1">
                      <span>{s.n_books_used}</span>
                      {s.n_books_interpolated > 0 && (
                        <span
                          className="rounded border border-amber-700/60 bg-amber-950/40 px-1 py-px font-mono text-[9px] uppercase tracking-[0.1em] text-amber-200"
                          title={`${s.n_books_interpolated} of ${s.n_books_used} books were quoted at adjacent lines and interpolated to Kalshi's line. Sanity-check signals where most books are interpolated, especially on extreme Kalshi lines.`}
                        >
                          {s.n_books_interpolated === s.n_books_used
                            ? "all interp"
                            : `${s.n_books_interpolated} interp`}
                        </span>
                      )}
                    </div>
                  </Td>
                  {showDiagCols && (
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
                  {showStatusCol && (
                    <Td align="right" mono muted className="hidden md:table-cell whitespace-nowrap">
                      {formatAgo(s.detected_at, serverNowMs)}
                    </Td>
                  )}
                  {showStatusCol && (
                    <Td>
                      {s.resolved_outcome === "yes" ? (
                        <Badge variant="positive" mono>WIN</Badge>
                      ) : s.resolved_outcome === "no" ? (
                        <Badge variant="negative" mono>LOSS</Badge>
                      ) : s.resolved_outcome === "void" ? (
                        <Badge variant="muted" mono>VOID</Badge>
                      ) : s.closing_kalshi_yes_price != null ? (
                        <Badge variant="info" mono>CLOSED</Badge>
                      ) : s.invalidated_at != null ? (
                        // Re-eval found the edge no longer holds (B/C/D
                        // failed). The signal was visible in Live until
                        // this moment; Recent shows it as stamped-out so
                        // the user can see what fired and how it ended.
                        <Badge variant="muted" mono>INVALID</Badge>
                      ) : (
                        <Badge variant="outline" mono>OPEN</Badge>
                      )}
                    </Td>
                  )}
                  {isAdmin && (
                    <Td>
                      <TrackButton signalId={s.id} tracked={s.tracked === 1} />
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
                          suggested_stake_pct_of_bankroll: suggestedStakeFraction(s),
                          stake_basis: "quarter-kelly fraction of bankroll",
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
