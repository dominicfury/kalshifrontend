"use client";

import { Loader2, Send } from "lucide-react";
import { useActionState } from "react";

import { cn } from "@/lib/cn";
import type { OpenSignalForBet } from "@/lib/bet-queries";

import { logBetAction, KNOWN_TAGS, type BetFormState } from "./actions";

const initial: BetFormState = { ok: false, message: "" };


export default function BetForm({ signals }: { signals: OpenSignalForBet[] }) {
  const [state, action, pending] = useActionState(logBetAction, initial);

  return (
    <form
      action={action}
      className="grid gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5 sm:grid-cols-2"
    >
      <Field label="Open signal (optional)" className="sm:col-span-2">
        <select
          name="signal_id"
          className={fieldStyle()}
          defaultValue=""
        >
          <option value="">— off-system bet (no signal) —</option>
          {signals.map((s) => (
            <option key={s.id} value={s.id}>
              #{s.id} · {s.ticker} · {s.side.toUpperCase()} (
              {(s.edge_pct_after_fees * 100).toFixed(2)}% edge)
            </option>
          ))}
        </select>
        {signals.length === 0 && (
          <p className="mt-1 text-xs text-zinc-500">
            No open signals right now. Bet via ticker below.
          </p>
        )}
      </Field>

      <Field label="Ticker">
        <input
          name="ticker"
          required
          placeholder="KXNHLGAME-26APR29MTLTB-TB"
          className={fieldStyle("font-mono")}
        />
      </Field>

      <Field label="Side">
        <select name="side" required className={fieldStyle()} defaultValue="yes">
          <option value="yes">YES</option>
          <option value="no">NO</option>
        </select>
      </Field>

      <Field label="Fill price (0–1)">
        <input
          type="number"
          name="fill_price"
          step="0.01"
          min="0.01"
          max="0.99"
          required
          className={fieldStyle("tabular-nums")}
        />
      </Field>

      <Field label="# Contracts">
        <input
          type="number"
          name="n_contracts"
          step="1"
          min="1"
          required
          className={fieldStyle("tabular-nums")}
        />
      </Field>

      <Field label="Fees paid ($)">
        <input
          type="number"
          name="fees_paid"
          step="0.01"
          min="0"
          defaultValue="0"
          className={fieldStyle("tabular-nums")}
        />
      </Field>

      <Field label="Placed at (UTC, optional)">
        <input
          type="datetime-local"
          name="placed_at"
          className={fieldStyle()}
        />
      </Field>

      <Field label="Tags" className="sm:col-span-2">
        <div className="flex flex-wrap gap-2">
          {KNOWN_TAGS.map((t) => (
            <label
              key={t}
              className="cursor-pointer select-none rounded-md border border-zinc-800 bg-zinc-900/40 px-2.5 py-1 text-xs font-mono text-zinc-300 transition-colors hover:border-zinc-700 has-checked:border-sky-500/60 has-checked:bg-sky-950/40 has-checked:text-sky-200"
            >
              <input
                type="checkbox"
                name="tags"
                value={t}
                className="sr-only"
              />
              {t}
            </label>
          ))}
        </div>
      </Field>

      <Field label="Notes" className="sm:col-span-2">
        <textarea name="notes" rows={2} className={fieldStyle()} />
      </Field>

      <div className="sm:col-span-2 flex items-center justify-between gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-emerald-950 transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Logging…
            </>
          ) : (
            <>
              <Send className="size-4" />
              Log bet
            </>
          )}
        </button>
        {state.message && (
          <span
            className={cn(
              "text-sm",
              state.ok ? "text-emerald-400" : "text-rose-400",
            )}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}


function fieldStyle(extra = ""): string {
  return cn(
    "w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 transition-colors focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/30",
    extra,
  );
}


function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </div>
      {children}
    </label>
  );
}
