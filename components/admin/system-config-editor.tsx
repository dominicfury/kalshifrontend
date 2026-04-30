"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

interface Field {
  key: string;
  label: string;
  hint: string;
  unit: "sec" | "count";
  value: string;
}

function describe(unit: "sec" | "count", n: number): string {
  if (unit === "count") return `${n}`;
  if (n < 60) return `${n}s`;
  if (n < 3600) return `${Math.round(n / 60)}m`;
  return `${(n / 3600).toFixed(1)}h`;
}

export function SystemConfigEditor({ fields }: { fields: Field[] }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, f.value])),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  // Re-sync if a fresh server render arrives with different values
  // (admin saved on another tab, etc.).
  useEffect(() => {
    setValues(Object.fromEntries(fields.map((f) => [f.key, f.value])));
  }, [fields]);

  const dirty =
    JSON.stringify(values) !==
    JSON.stringify(Object.fromEntries(fields.map((f) => [f.key, f.value])));

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const entries = fields
        .filter((f) => values[f.key] !== f.value)
        .map((f) => ({ key: f.key, value: values[f.key] }));
      if (!entries.length) {
        setBusy(false);
        return;
      }
      const r = await fetch("/api/admin/system-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
        cache: "no-store",
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body?.error || `HTTP ${r.status}`);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const numeric = Number(values[f.key]);
          const valid = Number.isFinite(numeric) && numeric >= 0;
          return (
            <div key={f.key} className="space-y-1">
              <label className="flex items-baseline justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-300">
                <span>{f.label}</span>
                {valid && (
                  <span className="font-mono normal-case text-[10px] text-zinc-500">
                    {describe(f.unit, numeric)}
                  </span>
                )}
              </label>
              <input
                type="number"
                min={0}
                value={values[f.key]}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.key]: e.target.value }))
                }
                className={cn(
                  "w-full rounded-md border bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:ring-2",
                  valid
                    ? "border-zinc-700 focus:border-orange-400/60 focus:ring-orange-500/30"
                    : "border-rose-800 focus:border-rose-500 focus:ring-rose-500/30",
                )}
              />
              <p className="text-[11px] leading-snug text-zinc-500">{f.hint}</p>
            </div>
          );
        })}
      </div>
      {error && (
        <div className="rounded-md border border-rose-900/60 bg-rose-950/40 p-2 text-xs text-rose-200">
          {error}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
            "bg-orange-500 text-white hover:bg-orange-400",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Save changes
        </button>
        {saved && !dirty && (
          <span className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">
            saved · pollers pick up next tick
          </span>
        )}
      </div>
    </div>
  );
}
