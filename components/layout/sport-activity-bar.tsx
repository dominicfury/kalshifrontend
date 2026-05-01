import type { SportActivity, SportActivityStatus } from "@/lib/queries";

const SPORT_LABEL: Record<string, string> = {
  nhl: "NHL",
  nba: "NBA",
  mlb: "MLB",
  wnba: "WNBA",
  tennis_atp: "ATP",
  tennis_wta: "WTA",
};

const STATUS_DOT: Record<SportActivityStatus, string> = {
  // 🟢 game live / starting in <2h. Lit + pulsing.
  live: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] animate-pulse",
  // 🟡 game in 2-24h. Lit, no pulse.
  soon: "bg-amber-400",
  // ⚪ no game in next 24h. Dim.
  dark: "bg-zinc-700",
};

const STATUS_TEXT: Record<SportActivityStatus, string> = {
  live: "text-emerald-100",
  soon: "text-amber-100",
  dark: "text-zinc-400",
};

const STATUS_BORDER: Record<SportActivityStatus, string> = {
  live: "border-emerald-700/60 bg-emerald-950/30",
  soon: "border-amber-800/50 bg-amber-950/20",
  dark: "border-zinc-800 bg-zinc-900/40",
};

function tooltip(a: SportActivity): string {
  if (a.status === "live") {
    return a.next_event_in_hours != null && a.next_event_in_hours > 0
      ? `Live · next game in ${Math.max(1, Math.round(a.next_event_in_hours * 60))}m`
      : "Live · game in progress";
  }
  if (a.status === "soon") {
    return `Game in ${Math.round(a.next_event_in_hours ?? 0)}h · ${a.events_24h} in next 24h`;
  }
  return "No games scheduled in next 24h";
}

export function SportActivityBar({ activity }: { activity: SportActivity[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
      <span className="text-[11px] uppercase tracking-[0.16em] text-zinc-300 mr-1">
        active
      </span>
      {activity.map((a) => (
        <div
          key={a.sport}
          title={tooltip(a)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${STATUS_BORDER[a.status]} ${STATUS_TEXT[a.status]}`}
        >
          <span className={`size-2 rounded-full ${STATUS_DOT[a.status]}`} />
          {SPORT_LABEL[a.sport] ?? a.sport.toUpperCase()}
        </div>
      ))}
    </div>
  );
}
