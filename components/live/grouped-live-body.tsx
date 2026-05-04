"use client";

import { Fragment, useState } from "react";

import { SignalRow } from "@/components/signals/signal-row";
import type { SignalRow as SignalRowData } from "@/lib/queries";


interface Props {
  signals: SignalRowData[];
  isAdmin: boolean;
  showDiagCols: boolean;
  showStatusCol: boolean;
  serverNowMs: number;
}


/** Live view body with per-game expand/collapse.
 *
 * Multiple +EV signals on the same event (different markets, sides, or
 * Kalshi-contract directions) used to clutter Live as separate rows.
 * The grouping here folds all signals on one event under a single
 * "primary" row — the highest-edge signal of the group, with a chevron
 * to expand the rest. Recent and Audit views keep flat layout because
 * dedup semantics differ there (Recent already deduped per market+side;
 * Audit is intentionally exhaustive).
 *
 * Group order: preserved from the input `signals` order. The first
 * signal-of-its-event that appears in the input determines that group's
 * position. So whichever sort key the user picked at the page level
 * propagates naturally — sort by edge → groups ordered by their max
 * edge; sort by start_time → groups ordered by tip-off; etc.
 *
 * Within each group, the highest-edge signal is the "primary" (always
 * rendered, with chevron + count badge). The rest render as detail
 * rows below it when the group is expanded.
 */
export function GroupedLiveBody({
  signals,
  isAdmin,
  showDiagCols,
  showStatusCol,
  serverNowMs,
}: Props) {
  // Default: all groups collapsed. Single group expansion at a time
  // would be tempting (less noise) but loses the ability to compare
  // multiple games' signal stacks side-by-side, which is the exact
  // workflow this feature exists for. So allow many open at once.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (eventId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  // Group by event_id, preserving the FIRST appearance order so the
  // user's chosen page-level sort dictates which group leads.
  const groupOrder: number[] = [];
  const groupMap: Map<number, SignalRowData[]> = new Map();
  for (const s of signals) {
    const arr = groupMap.get(s.event_id);
    if (arr == null) {
      groupOrder.push(s.event_id);
      groupMap.set(s.event_id, [s]);
    } else {
      arr.push(s);
    }
  }
  // Within each group, sort by edge DESC so the BEST opportunity is the
  // primary. Different Kalshi contracts on the same game can price the
  // same economic bet differently (DET YES at 0.55 vs BOS NO at 0.59);
  // we want the cheaper / higher-edge one front-and-center.
  for (const arr of groupMap.values()) {
    arr.sort((a, b) => b.edge_pct_after_fees - a.edge_pct_after_fees);
  }

  return (
    <>
      {groupOrder.map((eventId) => {
        const groupSignals = groupMap.get(eventId)!;
        const isExpanded = expanded.has(eventId);
        const primary = groupSignals[0];
        const others = groupSignals.slice(1);
        return (
          <Fragment key={eventId}>
            <SignalRow
              signal={primary}
              isAdmin={isAdmin}
              showDiagCols={showDiagCols}
              showStatusCol={showStatusCol}
              serverNowMs={serverNowMs}
              groupCount={groupSignals.length}
              isExpanded={isExpanded}
              onToggleGroup={() => toggle(eventId)}
            />
            {isExpanded &&
              others.map((s) => (
                <SignalRow
                  key={s.id}
                  signal={s}
                  isAdmin={isAdmin}
                  showDiagCols={showDiagCols}
                  showStatusCol={showStatusCol}
                  serverNowMs={serverNowMs}
                  isDetailRow={true}
                />
              ))}
          </Fragment>
        );
      })}
    </>
  );
}
