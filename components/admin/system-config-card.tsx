import { listConfig } from "@/lib/system-config";

import { SystemConfigEditor } from "./system-config-editor";

const FIELD_DEFS: Array<{
  key: string;
  label: string;
  hint: string;
  unit: "sec" | "count";
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
    hint: "How often Odds API runs. 30 min default fits the 20K/mo plan with sport-tier skip.",
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
    hint: "Stop polling Odds when remaining credits drop below this (safety buffer).",
    unit: "count",
  },
  {
    key: "user_repoll_quota_daily",
    label: "User repoll quota / day",
    hint: "Manual repolls per non-admin user / day. 0 = disabled (admin always unlimited).",
    unit: "count",
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
  return <SystemConfigEditor fields={fields} />;
}
