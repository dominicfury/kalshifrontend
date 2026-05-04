import { ArrowDown, ArrowUp, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";

import { AIChatTrigger } from "@/components/ai/ai-chat";
import { TrackButton } from "@/components/admin/track-button";
import { Badge } from "@/components/ui/badge";
import { Td, Tr } from "@/components/ui/data-table";
import { num, pct, resolveBet, teamLabel } from "@/lib/format";
import { suggestedStakeFraction } from "@/lib/kelly";
import type { SignalRow } from "@/lib/queries";


/** Helpers — kept here so both the flat-table render in app/page.tsx and the
 *  grouped-live-body client component share identical cell rendering.
 *  Pure JSX functions (no hooks) so this file works in both server and
 *  client component contexts. */

export function matchupLabel(s: SignalRow): string {
  return `${teamLabel(s.away_team)} @ ${teamLabel(s.home_team)}`;
}

export function edgeBadge(edge: number | null) {
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

export function clvBadge(clv: number | null) {
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

export function stalenessCell(sec: number | null, staleAt: number) {
  if (sec == null) return <span className="text-zinc-400">—</span>;
  const tone =
    sec > staleAt ? "text-rose-200" : sec > staleAt / 2 ? "text-amber-200" : "text-zinc-200";
  return <span className={`font-mono tabular-nums ${tone}`}>{sec}s</span>;
}

export function formatTimeToStart(min: number | null): string {
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

export function timeToStartCell(min: number | null) {
  if (min == null) return <span className="text-zinc-400">—</span>;
  let tone = "text-zinc-200";
  if (min < 0) tone = "text-rose-300";
  else if (min < 30) tone = "text-amber-300 font-semibold";
  else if (min < 120) tone = "text-emerald-300";
  return (
    <span className={`font-mono tabular-nums ${tone}`}>{formatTimeToStart(min)}</span>
  );
}

/** SQLite datetime() output (space-separated naive UTC) → relative "Xm ago".
 *  Matches the helper in app/page.tsx; both inputs and outputs identical. */
export function formatAgo(iso: string, nowMs: number): string {
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

function marketChip(s: SignalRow) {
  const bet = resolveBet(s);
  const variant = s.market_type === "moneyline" ? "info" : "muted";
  return (
    <Badge variant={variant} mono>
      {bet}
    </Badge>
  );
}


export interface SignalRowProps {
  signal: SignalRow;
  isAdmin: boolean;
  showDiagCols: boolean;
  showStatusCol: boolean;
  serverNowMs: number;
  /** Group-control props for the grouped Live view. When `groupCount` is
   *  given (and > 1), the matchup cell renders a chevron + "+N more"
   *  badge so the row doubles as the expand/collapse handle for its
   *  game group. Detail rows (siblings underneath the primary) pass
   *  `isDetailRow=true` for a subtle indent + tinted background that
   *  visually shows they belong to the row above. */
  groupCount?: number;
  isExpanded?: boolean;
  onToggleGroup?: () => void;
  isDetailRow?: boolean;
}


export function SignalRow({
  signal: s,
  isAdmin,
  showDiagCols,
  showStatusCol,
  serverNowMs,
  groupCount,
  isExpanded,
  onToggleGroup,
  isDetailRow = false,
}: SignalRowProps) {
  // Visual flag for rows that need investigation:
  //   - rose tint: actual stale-trap pattern (Kalshi quiet AND books
  //     just moved). Mirrors backend Filter A1.
  //   - amber tint: edge >= 5% — spec §2 "treat with deep suspicion"
  // Detail rows get a subtle blue tint instead so they read as
  // "belonging to the group above" without obscuring stale/huge tints.
  const isStaleTrap =
    s.kalshi_staleness_sec != null &&
    s.kalshi_staleness_sec > 600 &&
    s.book_staleness_sec != null &&
    s.book_staleness_sec < 600 &&
    s.kalshi_staleness_sec > s.book_staleness_sec * 2;
  const isHugeEdge = s.edge_pct_after_fees >= 0.05;
  const detailTint = "bg-zinc-900/30 border-l-2 border-zinc-700";
  const rowTone = isStaleTrap
    ? "bg-rose-950/30"
    : isHugeEdge
      ? "bg-amber-950/20"
      : isDetailRow
        ? detailTint
        : "";
  const price = s.side === "yes" ? s.kalshi_yes_ask : s.kalshi_no_ask;
  const fair = s.side === "yes" ? s.fair_yes_prob : 1 - s.fair_yes_prob;
  const showAtSize =
    s.edge_pct_after_fees_at_size != null &&
    Math.abs(s.edge_pct_after_fees_at_size - s.edge_pct_after_fees) > 0.001;

  const isGroupHeader = groupCount != null && groupCount > 1 && onToggleGroup != null;

  return (
    <Tr className={rowTone}>
      <Td>{timeToStartCell(s.time_to_start_min)}</Td>
      <Td>
        <Badge variant="muted" mono>
          {s.sport.toUpperCase()}
        </Badge>
      </Td>
      <Td>
        <div className={`flex items-center gap-1.5 ${isDetailRow ? "pl-4" : ""}`}>
          {isGroupHeader && (
            <button
              type="button"
              onClick={onToggleGroup}
              aria-label={isExpanded ? "Collapse game" : "Expand game"}
              className="inline-flex items-center justify-center rounded text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </button>
          )}
          <Link
            href={`/signals/${s.id}`}
            title={matchupLabel(s)}
            className="hover:text-zinc-50 block max-w-[14rem] truncate sm:max-w-[20rem] sm:whitespace-nowrap md:max-w-none"
          >
            {matchupLabel(s)}
          </Link>
          {isGroupHeader && (
            <span
              className="rounded border border-zinc-700 bg-zinc-900/60 px-1 py-px font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-400"
              title={`This game has ${groupCount} +EV signals. Click the chevron to expand.`}
            >
              +{groupCount - 1} more
            </span>
          )}
        </div>
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
          if (stake == null) return <span className="text-zinc-500">—</span>;
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
        {s.yes_book_depth == null ? "—" : `$${Math.round(s.yes_book_depth)}`}
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
          <div className="inline-flex items-center gap-1">
            {s.resolved_outcome === "yes" ? (
              <Badge variant="positive" mono>WIN</Badge>
            ) : s.resolved_outcome === "no" ? (
              <Badge variant="negative" mono>LOSS</Badge>
            ) : s.resolved_outcome === "void" ? (
              <Badge variant="muted" mono>VOID</Badge>
            ) : s.closing_kalshi_yes_price != null ? (
              <Badge variant="info" mono>CLOSED</Badge>
            ) : s.invalidated_at != null ? (
              <Badge variant="muted" mono>INVALID</Badge>
            ) : (
              <Badge variant="outline" mono>OPEN</Badge>
            )}
            {s.is_calibration_only === 1 && (
              <span
                className="rounded border border-zinc-700 bg-zinc-900/60 px-1 py-px font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-400"
                title="Calibration-only: edge was below 0.5% actionable threshold but above 0.1% logging floor. Recorded for offline CLV analysis; not surfaced in Live or alerted on."
              >
                calib
              </span>
            )}
          </div>
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
}
