/** Display helpers shared across pages. */

export function pct(n: number | null, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(digits)}%`;
}

export function dollars(n: number | null, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `$${n.toFixed(digits)}`;
}

export function num(n: number | null, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

export function ago(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  if (Number.isNaN(t)) return iso;
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h`;
  return `${Math.round(sec / 86400)}d`;
}

export function teamLabel(slug: string): string {
  return slug
    .split("_")
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
}

export function clvColor(clv: number | null): string {
  if (clv == null) return "text-zinc-500";
  if (clv > 0.005) return "text-emerald-400";
  if (clv < -0.005) return "text-rose-400";
  return "text-zinc-300";
}

export function edgeColor(edge: number | null): string {
  if (edge == null) return "text-zinc-500";
  if (edge >= 0.05) return "text-amber-400";  // suspicious
  if (edge >= 0.02) return "text-emerald-400";
  if (edge >= 0.005) return "text-emerald-300";
  return "text-zinc-400";
}
