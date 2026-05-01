"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { SignalFilters } from "@/lib/queries";


const SPORT_LABELS: Record<string, string> = {
  nhl: "NHL",
  nba: "NBA",
  mlb: "MLB",
  wnba: "WNBA",
  tennis_atp: "ATP",
  tennis_wta: "WTA",
};


const MIN_EDGE_PRESETS: { value: number; label: string }[] = [
  { value: 0.005, label: "≥ 0.5%" },
  { value: 0.01, label: "≥ 1%" },
  { value: 0.02, label: "≥ 2%" },
  { value: 0.05, label: "≥ 5%" },
];


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


// Shared close-on-select context so MenuItem can dismiss its parent Dropdown
// without a prop-drilling dance.
const DropdownContext = createContext<{ close: () => void } | null>(null);


interface DropdownProps {
  label: string;
  summary: string;
  active: boolean;
  align?: "left" | "right";
  children: React.ReactNode;
}


function Dropdown({ label, summary, active, align = "left", children }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
          active
            ? "border-orange-400 bg-orange-500 text-white shadow-sm hover:bg-orange-400"
            : "border-zinc-600 bg-zinc-800 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-700",
        )}
      >
        <span
          className={cn(
            "font-normal",
            active ? "text-orange-100/80" : "text-zinc-400",
          )}
        >
          {label}:
        </span>
        <span className="max-w-[10rem] truncate">{summary}</span>
        <ChevronDown
          className={cn(
            "size-3 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <DropdownContext.Provider value={{ close: () => setOpen(false) }}>
          <div
            id={menuId}
            role="menu"
            aria-label={label}
            className={cn(
              "absolute z-30 mt-2 max-h-[min(70vh,24rem)] min-w-[12rem] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-1 shadow-xl shadow-black/40",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            {children}
          </div>
        </DropdownContext.Provider>
      )}
    </div>
  );
}


interface MenuItemProps {
  label: string;
  href: string;
  active: boolean;
  hint?: string;
}


function MenuItem({ label, href, active, hint }: MenuItemProps) {
  const ctx = useContext(DropdownContext);
  return (
    <Link
      href={href}
      role="menuitemradio"
      aria-checked={active}
      title={hint}
      onClick={() => ctx?.close()}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-xs whitespace-nowrap",
        active
          ? "bg-orange-500/15 text-orange-100"
          : "text-zinc-100 hover:bg-zinc-800 hover:text-zinc-50",
      )}
    >
      <span>{label}</span>
      {active && <Check className="size-3.5 text-orange-300 shrink-0" />}
    </Link>
  );
}


export function SignalFilterBar({
  filters,
  total,
  sports = [],
}: {
  filters: SignalFilters;
  total: number;
  sports?: { sport: string; n: number }[];
}) {
  const anyFilter =
    filters.todayOnly ||
    (filters.minEdge != null && filters.minEdge > 0) ||
    filters.alertedOnly ||
    filters.unresolvedOnly ||
    !!filters.sport;

  const viewSummary = filters.showAll ? "All" : "Live";

  const edgePreset = MIN_EDGE_PRESETS.find((p) => p.value === filters.minEdge);
  const edgeSummary = edgePreset?.label ?? "any";

  const sportSummary = filters.sport
    ? SPORT_LABELS[filters.sport] ?? filters.sport.toUpperCase()
    : "all";

  const quickActiveLabels = [
    filters.todayOnly && "Today",
    filters.unresolvedOnly && "Unresolved",
    filters.alertedOnly && "Alerted",
  ].filter(Boolean) as string[];
  const quickSummary =
    quickActiveLabels.length === 0
      ? "none"
      : quickActiveLabels.length === 1
        ? quickActiveLabels[0]
        : `${quickActiveLabels.length} active`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* View — Live vs All. Conceptually a primary toggle, but rendered
          as a dropdown for visual consistency with the other filters. */}
      <Dropdown label="View" summary={viewSummary} active={!!filters.showAll}>
        <MenuItem
          label="Live"
          hint="Pre-game, fillable, edge under 5%"
          active={!filters.showAll}
          href={buildHref(filters, { showAll: false })}
        />
        <MenuItem
          label="All"
          hint="Includes closed, started, flagged ≥5%, and signals from games up to 12h ago"
          active={!!filters.showAll}
          href={buildHref(filters, { showAll: true })}
        />
      </Dropdown>

      <Dropdown
        label="Filters"
        summary={quickSummary}
        active={quickActiveLabels.length > 0}
      >
        <MenuItem
          label="Today only"
          active={!!filters.todayOnly}
          href={buildHref(filters, { todayOnly: !filters.todayOnly })}
        />
        <MenuItem
          label="Unresolved"
          active={!!filters.unresolvedOnly}
          href={buildHref(filters, { unresolvedOnly: !filters.unresolvedOnly })}
        />
        <MenuItem
          label="Alerted"
          active={!!filters.alertedOnly}
          href={buildHref(filters, { alertedOnly: !filters.alertedOnly })}
        />
      </Dropdown>

      <Dropdown
        label="Min edge"
        summary={edgeSummary}
        active={filters.minEdge != null && filters.minEdge > 0}
      >
        <MenuItem
          label="Any"
          active={filters.minEdge == null || filters.minEdge === 0}
          href={buildHref(filters, { minEdge: undefined })}
        />
        {MIN_EDGE_PRESETS.map((p) => (
          <MenuItem
            key={p.value}
            label={p.label}
            active={filters.minEdge === p.value}
            href={buildHref(filters, { minEdge: p.value })}
          />
        ))}
      </Dropdown>

      {sports.length > 0 && (
        <Dropdown
          label="Sport"
          summary={sportSummary}
          active={!!filters.sport}
        >
          <MenuItem
            label="All sports"
            active={!filters.sport}
            href={buildHref(filters, { sport: undefined })}
          />
          {sports.map((s) => (
            <MenuItem
              key={s.sport}
              label={`${SPORT_LABELS[s.sport] ?? s.sport.toUpperCase()} (${s.n})`}
              active={filters.sport === s.sport}
              href={buildHref(filters, { sport: s.sport })}
            />
          ))}
        </Dropdown>
      )}

      {anyFilter && (
        <Link
          href="/"
          className="text-xs text-zinc-300 underline hover:text-zinc-100"
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
