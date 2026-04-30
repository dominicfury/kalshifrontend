"use client";

import {
  Bell,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

interface AlertSubscription {
  id: number;
  user_id: number;
  name: string;
  enabled: boolean;
  min_edge: number;
  min_n_books: number;
  sport: string | null;
  market_type: string | null;
  side: "yes" | "no" | null;
  require_at_size: boolean;
  cooldown_minutes: number;
  last_fired_at: string | null;
  created_at: string;
  updated_at: string;
}

const SPORTS: Array<{ value: string; label: string }> = [
  { value: "", label: "Any sport" },
  { value: "nhl", label: "NHL" },
  { value: "nba", label: "NBA" },
  { value: "mlb", label: "MLB" },
  { value: "wnba", label: "WNBA" },
];

const MARKET_TYPES: Array<{ value: string; label: string }> = [
  { value: "", label: "Any market" },
  { value: "moneyline", label: "Moneyline" },
  { value: "total", label: "Total" },
  { value: "puckline", label: "Puckline / spread" },
];

const SIDES: Array<{ value: string; label: string }> = [
  { value: "", label: "Either side" },
  { value: "yes", label: "YES only" },
  { value: "no", label: "NO only" },
];

const DEFAULT_NEW: Omit<AlertSubscription, "id" | "user_id" | "created_at" | "updated_at" | "last_fired_at"> = {
  name: "",
  enabled: true,
  min_edge: 0.02,
  min_n_books: 3,
  sport: null,
  market_type: null,
  side: null,
  require_at_size: true,
  cooldown_minutes: 60,
};

export function AlertsManager({
  initial,
  userEmail,
}: {
  initial: AlertSubscription[];
  userEmail: string | null;
}) {
  const [subs, setSubs] = useState<AlertSubscription[]>(initial);
  const [editingId, setEditingId] = useState<number | "new" | null>(
    initial.length === 0 ? "new" : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | "new" | null>(null);
  const router = useRouter();

  async function save(id: number | "new", form: typeof DEFAULT_NEW & { name: string }) {
    setBusy(id);
    setError(null);
    try {
      const isNew = id === "new";
      const r = await fetch(isNew ? "/api/alerts" : `/api/alerts/${id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        cache: "no-store",
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data?.error || `HTTP ${r.status}`);
        return;
      }
      const sub: AlertSubscription = data.subscription;
      setSubs((list) =>
        isNew
          ? [...list, sub]
          : list.map((x) => (x.id === sub.id ? sub : x)),
      );
      setEditingId(null);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this alert subscription?")) return;
    setBusy(id);
    setError(null);
    try {
      const r = await fetch(`/api/alerts/${id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data?.error || `HTTP ${r.status}`);
        return;
      }
      setSubs((list) => list.filter((x) => x.id !== id));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function toggle(s: AlertSubscription) {
    await save(s.id, { ...s, enabled: !s.enabled });
  }

  return (
    <div className="space-y-4">
      {!userEmail && (
        <div className="rounded-md border border-amber-900/60 bg-amber-950/30 p-3 text-xs text-amber-200">
          Your account has no email on file. Add one in Settings before
          subscriptions will deliver.
        </div>
      )}
      {error && (
        <div className="rounded-md border border-rose-900/60 bg-rose-950/40 p-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      {subs.length === 0 && editingId !== "new" && (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 p-6 text-center">
          <Bell className="mx-auto size-6 text-zinc-500" />
          <p className="mt-2 text-sm text-zinc-300">No alert subscriptions yet.</p>
          <button
            type="button"
            onClick={() => setEditingId("new")}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-400"
          >
            <Plus className="size-3.5" />
            Create your first alert
          </button>
        </div>
      )}

      {subs.map((s) => (
        <div key={s.id}>
          {editingId === s.id ? (
            <SubscriptionEditor
              initial={s}
              busy={busy === s.id}
              onCancel={() => setEditingId(null)}
              onSave={(form) => save(s.id, form)}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Bell
                  className={cn(
                    "size-4",
                    s.enabled ? "text-orange-300" : "text-zinc-600",
                  )}
                />
                <span
                  className={cn(
                    "font-semibold",
                    s.enabled ? "text-zinc-100" : "text-zinc-500 line-through",
                  )}
                >
                  {s.name}
                </span>
                <Badge variant="muted" mono>
                  ≥ {(s.min_edge * 100).toFixed(2)}%
                </Badge>
                {s.sport && <Badge variant="muted" mono>{s.sport.toUpperCase()}</Badge>}
                {s.market_type && (
                  <Badge variant="muted" mono>{s.market_type}</Badge>
                )}
                {s.side && <Badge variant="muted" mono>{s.side.toUpperCase()}</Badge>}
                <Badge variant="muted" mono>
                  ≥ {s.min_n_books} books
                </Badge>
                <span className="text-[11px] text-zinc-500">
                  cooldown {s.cooldown_minutes}m
                  {s.last_fired_at && ` · last fired ${s.last_fired_at}`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={busy === s.id}
                  onClick={() => toggle(s)}
                  title={s.enabled ? "Disable" : "Enable"}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-zinc-100 hover:bg-zinc-800"
                >
                  {s.enabled ? <PowerOff className="size-3" /> : <Power className="size-3" />}
                  {s.enabled ? "Off" : "On"}
                </button>
                <button
                  type="button"
                  disabled={busy === s.id}
                  onClick={() => setEditingId(s.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-zinc-100 hover:bg-zinc-800"
                >
                  <Pencil className="size-3" />
                  Edit
                </button>
                <button
                  type="button"
                  disabled={busy === s.id}
                  onClick={() => remove(s.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-rose-900/60 bg-rose-950/30 px-2 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-950/50"
                >
                  {busy === s.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {editingId === "new" && (
        <SubscriptionEditor
          initial={null}
          busy={busy === "new"}
          onCancel={() => setEditingId(null)}
          onSave={(form) => save("new", form)}
        />
      )}

      {editingId !== "new" && subs.length > 0 && (
        <button
          type="button"
          onClick={() => setEditingId("new")}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-800"
        >
          <Plus className="size-3.5" />
          New subscription
        </button>
      )}
    </div>
  );
}


function SubscriptionEditor({
  initial,
  busy,
  onCancel,
  onSave,
}: {
  initial: AlertSubscription | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (form: typeof DEFAULT_NEW & { name: string }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [minEdgePct, setMinEdgePct] = useState(
    initial ? (initial.min_edge * 100).toFixed(2) : "2.00",
  );
  const [minBooks, setMinBooks] = useState(String(initial?.min_n_books ?? 3));
  const [sport, setSport] = useState(initial?.sport ?? "");
  const [marketType, setMarketType] = useState(initial?.market_type ?? "");
  const [sideValue, setSideValue] = useState<string>(initial?.side ?? "");
  const [requireAtSize, setRequireAtSize] = useState(
    initial?.require_at_size ?? true,
  );
  const [cooldownMin, setCooldownMin] = useState(
    String(initial?.cooldown_minutes ?? 60),
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const min_edge = Math.max(0, Math.min(50, Number(minEdgePct) || 0)) / 100;
    onSave({
      name: name.trim(),
      enabled,
      min_edge,
      min_n_books: Math.max(1, Math.min(20, Number(minBooks) || 1)),
      sport: sport || null,
      market_type: marketType || null,
      side: (sideValue === "yes" || sideValue === "no") ? sideValue : null,
      require_at_size: requireAtSize,
      cooldown_minutes: Math.max(1, Math.min(1440, Number(cooldownMin) || 60)),
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-lg border border-orange-900/40 bg-orange-950/10 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input
            required
            placeholder="e.g. NHL totals 2%+"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100"
          />
        </Field>
        <Field label="Min edge (%)">
          <input
            type="number"
            step="0.1"
            min="0"
            max="50"
            value={minEdgePct}
            onChange={(e) => setMinEdgePct(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 font-mono text-sm text-zinc-100"
          />
        </Field>
        <Field label="Sport">
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100"
          >
            {SPORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Market type">
          <select
            value={marketType}
            onChange={(e) => setMarketType(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100"
          >
            {MARKET_TYPES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Side">
          <select
            value={sideValue}
            onChange={(e) => setSideValue(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100"
          >
            {SIDES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Min books in consensus">
          <input
            type="number"
            min="1"
            max="20"
            value={minBooks}
            onChange={(e) => setMinBooks(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 font-mono text-sm text-zinc-100"
          />
        </Field>
        <Field label="Cooldown (minutes)">
          <input
            type="number"
            min="1"
            max="1440"
            value={cooldownMin}
            onChange={(e) => setCooldownMin(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 font-mono text-sm text-zinc-100"
          />
        </Field>
        <Field label="Options" className="sm:col-span-2">
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-zinc-200">
              <input
                type="checkbox"
                checked={requireAtSize}
                onChange={(e) => setRequireAtSize(e.target.checked)}
              />
              Require @size edge to also pass min
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-zinc-200">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Enabled
            </label>
          </div>
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
            "bg-orange-500 text-white hover:bg-orange-400",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {initial ? "Save changes" : "Create subscription"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="block text-[10px] uppercase tracking-[0.16em] text-zinc-300">
        {label}
      </label>
      {children}
    </div>
  );
}
