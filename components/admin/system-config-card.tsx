import { listConfig } from "@/lib/system-config";

import { SystemConfigEditor } from "./system-config-editor";


/** Reference table rendered below the min_book_depth_dollars input —
 *  reminds the admin to bump the depth filter alongside flat-bet size. */
const DEPTH_FOR_BET_SIZE: Array<[string, string]> = [
  ["$5–25", "50"],
  ["$50–100", "100"],
  ["$100–200", "200"],
  ["$200–500", "500"],
];

function DepthReferenceTable() {
  return (
    <div className="mt-1.5 rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
      <div className="mb-1 text-[9px] uppercase tracking-[0.18em] text-zinc-500">
        suggested by flat-bet size
      </div>
      <table className="w-full font-mono text-[10px] tabular-nums">
        <thead>
          <tr className="text-zinc-500">
            <th className="pb-1 text-left font-normal">flat bet</th>
            <th className="pb-1 text-right font-normal">depth ≥</th>
          </tr>
        </thead>
        <tbody>
          {DEPTH_FOR_BET_SIZE.map(([bet, depth]) => (
            <tr key={bet} className="text-zinc-300">
              <td className="py-0.5">{bet}</td>
              <td className="py-0.5 text-right">${depth}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


const FIELD_DEFS: Array<{
  key: string;
  label: string;
  hint: string;
  unit: "sec" | "count" | "toggle";
}> = [
  {
    key: "kalshi_poll_interval_sec",
    label: "Kalshi poll interval",
    hint: "How often the Kalshi market poll runs. Free / no quota concern.",
    unit: "sec",
  },
  {
    key: "book_poll_interval_sec",
    label: "Book poll interval",
    hint: "How often Odds API runs. 10 min default fits the 100K/mo plan with sport-tier skip.",
    unit: "sec",
  },
  {
    key: "default_ai_quota_daily",
    label: "Default AI quota / day",
    hint: "Daily AI chat limit for non-admin users. Per-user override in user table beats this.",
    unit: "count",
  },
  {
    key: "odds_quota_reserve",
    label: "Odds API reserve",
    hint: "Stop polling Odds when remaining credits drop below this (safety buffer, ~2% of plan).",
    unit: "count",
  },
  {
    key: "user_repoll_quota_daily",
    label: "User repoll quota / day",
    hint: "Manual repolls per non-admin user / day. 0 = disabled (admin always unlimited).",
    unit: "count",
  },
];


// Signal-pipeline knobs (Filter A1 sensitivity, dedup heartbeat, EV
// engine sizing, depth filter). These tune the trade-off between
// "catch every edge" and "skip noise" without a backend redeploy.
const SIGNAL_FIELD_DEFS: Array<{
  key: string;
  label: string;
  hint: string;
  unit: "sec" | "count" | "toggle";
  extra?: React.ReactNode;
}> = [
  {
    key: "book_recent_move_sec",
    label: "Filter A1 trap window",
    hint: "Books must have moved within this many seconds for the news-trap filter to fire. Lower = less aggressive A1, more signals through.",
    unit: "sec",
  },
  {
    key: "signal_heartbeat_min",
    label: "Signal heartbeat (min)",
    hint: "Minutes between fresh rows for a stable, edge-unchanged signal. Lower = more table bloat. Must stay below the Live view recency cap (~8 min).",
    unit: "count",
  },
  {
    key: "target_bet_size_dollars",
    label: "Target bet size ($)",
    hint: "Hypothetical fill size used to compute the @size edge column. Set to your typical flat-bet so the @size number reads as the edge you'd actually capture.",
    unit: "count",
  },
  {
    key: "min_book_depth_dollars",
    label: "Min book depth ($)",
    hint: "Filter C: reject signals where top-of-book depth on the +EV side is less than this. Bump as flat-bet size grows so the system stops surfacing signals you can't fill cleanly.",
    unit: "count",
    extra: <DepthReferenceTable />,
  },
  {
    key: "live_huge_edge_cutoff_pct",
    label: "Live huge-edge cutoff (%)",
    hint: "Hide signals at or above this edge from the Live view (still visible in Audit). Default 7 lets sparse-coverage edges (5-7%, common in WNBA / niche tennis) through while filtering 10%+ line-drift traps where sharp books moved off the line. Set to 100 to disable.",
    unit: "count",
  },
  {
    key: "book_quote_max_age_sec",
    label: "Book quote max age",
    hint: "Drop book quotes older than this from the matcher consensus. With cross-line interpolation handling line drift directly, the cutoff is now about admitting books that briefly lag the poll cycle (rate limit, hiccup) without dropping them as stale. Default 7200 (2h, ~12 cycles of headroom). Lower = stricter (drops lagging books faster).",
    unit: "sec",
  },
];

const ACCESS_FIELD_DEFS: Array<{
  key: string;
  label: string;
  hint: string;
  unit: "toggle";
}> = [
  {
    key: "signups_enabled",
    label: "Public signups",
    hint: "Off = the /signup form is closed and the landing page hides the Sign up CTAs. Existing users + admin-created accounts still work.",
    unit: "toggle",
  },
];

const SPORT_FIELD_DEFS: Array<{
  key: string;
  label: string;
  hint: string;
  unit: "toggle";
}> = [
  {
    key: "sport_enabled_nhl",
    label: "NHL",
    hint: "Off = stop polling NHL odds and hide from the active bar.",
    unit: "toggle",
  },
  {
    key: "sport_enabled_nba",
    label: "NBA",
    hint: "Off = stop polling NBA odds and hide from the active bar.",
    unit: "toggle",
  },
  {
    key: "sport_enabled_mlb",
    label: "MLB",
    hint: "Off = stop polling MLB odds and hide from the active bar.",
    unit: "toggle",
  },
  {
    key: "sport_enabled_wnba",
    label: "WNBA",
    hint: "Off = stop polling WNBA odds and hide from the active bar.",
    unit: "toggle",
  },
  {
    key: "sport_enabled_tennis_atp",
    label: "ATP (men's tennis)",
    hint: "Off = skip ATP tournament discovery and hide from the active bar.",
    unit: "toggle",
  },
  {
    key: "sport_enabled_tennis_wta",
    label: "WTA (women's tennis)",
    hint: "Off = skip WTA tournament discovery and hide from the active bar.",
    unit: "toggle",
  },
];

export async function SystemConfigCard() {
  const rows = await listConfig();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const fields = FIELD_DEFS.map((d) => ({
    key: d.key,
    label: d.label,
    hint: d.hint,
    unit: d.unit,
    value: byKey.get(d.key)?.value ?? "",
  }));
  const signalFields = SIGNAL_FIELD_DEFS.map((d) => ({
    key: d.key,
    label: d.label,
    hint: d.hint,
    unit: d.unit,
    extra: d.extra,
    value: byKey.get(d.key)?.value ?? "",
  }));
  const accessFields = ACCESS_FIELD_DEFS.map((d) => ({
    key: d.key,
    label: d.label,
    hint: d.hint,
    unit: d.unit,
    // Default to "1" so a fresh DB renders "signups open" before the
    // backend's seed runs. Admin can flip to "0" to close them.
    value: byKey.get(d.key)?.value ?? "1",
  }));
  const sportFields = SPORT_FIELD_DEFS.map((d) => ({
    key: d.key,
    label: d.label,
    hint: d.hint,
    unit: d.unit,
    // Default to "1" for unseeded rows so a fresh DB doesn't render the
    // toggle as off before the backend's seed_defaults_if_missing runs.
    value: byKey.get(d.key)?.value ?? "1",
  }));
  return (
    <div className="space-y-6">
      <SystemConfigEditor fields={fields} />
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-300">
          Signal pipeline
        </div>
        <p className="text-[11px] leading-snug text-zinc-500">
          Tune Filter A1 sensitivity, dedup heartbeat, and the depth /
          fill-size assumptions the EV engine uses. Track impact via the{" "}
          <code className="rounded bg-zinc-900 px-1">signal_gen_runs</code>{" "}
          funnel in the DB.
        </p>
        <SystemConfigEditor fields={signalFields} />
      </div>
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-300">
          Access — toggle on/off
        </div>
        <p className="text-[11px] leading-snug text-zinc-500">
          Closing public signups blocks new account creation immediately
          (existing users keep working).
        </p>
        <SystemConfigEditor fields={accessFields} />
      </div>
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-300">
          Sports — toggle on/off
        </div>
        <p className="text-[11px] leading-snug text-zinc-500">
          Disabled sports are skipped by the Odds API poller and hidden from
          the active-sports bar above the table.
        </p>
        <SystemConfigEditor fields={sportFields} />
      </div>
    </div>
  );
}
