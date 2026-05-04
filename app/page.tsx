import { Activity } from "lucide-react";
import Link from "next/link";

import { LandingPage } from "@/components/landing/landing";
import { AutoRefresh } from "@/components/layout/auto-refresh";
import RepollButton from "@/components/layout/repoll-button";
import { SportActivityBar } from "@/components/layout/sport-activity-bar";
import { SignalFilterBar } from "@/components/filters/signal-filters";
import { GroupedLiveBody } from "@/components/live/grouped-live-body";
import { SignalRow, formatTimeToStart } from "@/components/signals/signal-row";
import {
  DataTable,
  TBody,
  THead,
  Th,
  Tr,
} from "@/components/ui/data-table";
import { SignalAnnouncer } from "@/components/ui/signal-announcer";
import { SortHeader } from "@/components/ui/sort-header";
import {
  fetchActiveSports,
  fetchLiveStats,
  fetchRecentSignals,
  fetchSportActivity,
  type LiveStats,
  type SignalFilters,
  type SignalRow as SignalRowData,
  type SignalSortKey,
  type SignalView,
  type SportActivity,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { getBool, KNOWN_KEYS } from "@/lib/system-config";
// Filters are URL-driven, so we render on every request rather than ISR.
export const dynamic = "force-dynamic";
export const revalidate = 0;


// Per-row rendering and formatting helpers live in
// components/signals/signal-row.tsx so the same code is reused by the
// flat-table render here (recent / audit) and the GroupedLiveBody
// client component (Live view). Only formatTimeToStart is re-imported
// at the top of this file because the empty-state block below uses it.




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

  let signals: SignalRowData[] = [];
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
            {/* Live: collapse rows by event so multiple +EV signals on one
                game (different markets, sides) show as a single primary
                row with chevron-to-expand. Recent / Audit keep flat
                layout: Recent already deduped per (market, side); Audit is
                intentionally exhaustive so the admin can compare heartbeats
                and equivalent-bet pairs side-by-side. */}
            {view === "live" ? (
              <GroupedLiveBody
                signals={signals}
                isAdmin={isAdmin}
                showDiagCols={showDiagCols}
                showStatusCol={showStatusCol}
                serverNowMs={serverNowMs}
              />
            ) : (
              signals.map((s) => (
                <SignalRow
                  key={s.id}
                  signal={s}
                  isAdmin={isAdmin}
                  showDiagCols={showDiagCols}
                  showStatusCol={showStatusCol}
                  serverNowMs={serverNowMs}
                />
              ))
            )}
          </TBody>
        </DataTable>
      )}
    </>
  );
}
