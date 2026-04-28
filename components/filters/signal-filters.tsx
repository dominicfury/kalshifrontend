import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { SignalFilters } from "@/lib/queries";


interface ChipProps {
  label: string;
  active: boolean;
  href: string;
  hint?: string;
}

function Chip({ label, active, href, hint }: ChipProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
        active
          ? "border-sky-400 bg-sky-500 text-white shadow-sm hover:bg-sky-400"
          : "border-zinc-600 bg-zinc-800 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-700",
      )}
    >
      {label}
      {active && hint && (
        <span className="text-[10px] uppercase tracking-wide text-sky-400">
          {hint}
        </span>
      )}
    </Link>
  );
}


function buildHref(current: SignalFilters, patch: Partial<SignalFilters>): string {
  const merged = { ...current, ...patch };
  const params = new URLSearchParams();
  if (merged.todayOnly) params.set("today", "1");
  if (merged.minEdge && merged.minEdge > 0) {
    params.set("minEdge", String(merged.minEdge));
  }
  if (merged.alertedOnly) params.set("alerted", "1");
  if (merged.unresolvedOnly) params.set("unresolved", "1");
  if (merged.showAll) params.set("all", "1");
  if (merged.sport) params.set("sport", merged.sport);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}


const SPORT_LABELS: Record<string, string> = {
  nhl: "NHL",
  nba: "NBA",
  mlb: "MLB",
  wnba: "WNBA",
  tennis_atp: "ATP",
  tennis_wta: "WTA",
  ncaab: "NCAAB",
  nfl: "NFL",
};


export function SignalFilterBar({
  filters,
  total,
  sports = [],
}: {
  filters: SignalFilters;
  total: number;
  sports?: { sport: string; n: number }[];
}) {
  const minEdgePresets: { value: number; label: string }[] = [
    { value: 0.005, label: "≥ 0.5%" },
    { value: 0.01, label: "≥ 1%" },
    { value: 0.02, label: "≥ 2%" },
    { value: 0.05, label: "≥ 5%" },
  ];

  const anyFilter =
    filters.todayOnly ||
    (filters.minEdge != null && filters.minEdge > 0) ||
    filters.alertedOnly ||
    filters.unresolvedOnly ||
    !!filters.sport;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] uppercase tracking-[0.16em] text-zinc-300 mr-1">
        filter
      </span>
      <Chip
        label={filters.showAll ? "All detections" : "Latest only"}
        active={!filters.showAll}
        href={buildHref(filters, { showAll: !filters.showAll })}
      />
      <span className="ml-2 text-zinc-500">·</span>
      <Chip
        label="Today"
        active={!!filters.todayOnly}
        href={buildHref(filters, { todayOnly: !filters.todayOnly })}
      />
      <Chip
        label="Unresolved"
        active={!!filters.unresolvedOnly}
        href={buildHref(filters, { unresolvedOnly: !filters.unresolvedOnly })}
      />
      <Chip
        label="Alerted"
        active={!!filters.alertedOnly}
        href={buildHref(filters, { alertedOnly: !filters.alertedOnly })}
      />
      <span className="ml-2 text-zinc-500">·</span>
      {minEdgePresets.map((p) => (
        <Chip
          key={p.value}
          label={p.label}
          active={filters.minEdge === p.value}
          href={buildHref(filters, {
            minEdge: filters.minEdge === p.value ? undefined : p.value,
          })}
        />
      ))}
      {sports.length > 0 && (
        <>
          <span className="ml-2 text-zinc-500">·</span>
          {sports.map((s) => (
            <Chip
              key={s.sport}
              label={`${SPORT_LABELS[s.sport] ?? s.sport.toUpperCase()} (${s.n})`}
              active={filters.sport === s.sport}
              href={buildHref(filters, {
                sport: filters.sport === s.sport ? undefined : s.sport,
              })}
            />
          ))}
        </>
      )}
      {anyFilter && (
        <Link
          href="/"
          className="ml-2 text-xs text-zinc-300 hover:text-zinc-100 underline"
        >
          clear filters
        </Link>
      )}
      <span className="ml-auto">
        <Badge variant="muted" mono>
          {total} match{total === 1 ? "" : "es"}
        </Badge>
      </span>
    </div>
  );
}
