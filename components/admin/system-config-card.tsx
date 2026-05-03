import { listConfig } from "@/lib/system-config";

import { SystemConfigEditor } from "./system-config-editor";

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
