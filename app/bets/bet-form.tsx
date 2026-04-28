"use client";

import { useActionState } from "react";

import type { OpenSignalForBet } from "@/lib/bet-queries";
import { logBetAction, KNOWN_TAGS, type BetFormState } from "./actions";

const initial: BetFormState = { ok: false, message: "" };

export default function BetForm({ signals }: { signals: OpenSignalForBet[] }) {
  const [state, action, pending] = useActionState(logBetAction, initial);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 rounded border border-zinc-800 p-4 bg-zinc-900/40">
      <h2 className="sm:col-span-2 text-sm uppercase tracking-wide text-zinc-400">
        Log a bet
      </h2>

      <Field label="Open signal (optional)">
        <select
          name="signal_id"
          className="w-full rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-sm"
          defaultValue=""
        >
          <option value="">— off-system bet —</option>
          {signals.map((s) => (
            <option key={s.id} value={s.id}>
              #{s.id} · {s.ticker} · {s.side.toUpperCase()} ({(s.edge_pct_after_fees * 100).toFixed(2)}% edge)
            </option>
          ))}
        </select>
      </Field>

      <Field label="Ticker">
        <input
          name="ticker"
          required
          placeholder="KXNHLGAME-26APR29MTLTB-TB"
          className="w-full rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-sm font-mono"
        />
      </Field>

      <Field label="Side">
        <select
          name="side"
          required
          className="w-full rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-sm"
          defaultValue="yes"
        >
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
          className="w-full rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-sm tabular-nums"
        />
      </Field>

      <Field label="# contracts">
        <input
          type="number"
          name="n_contracts"
          step="1"
          min="1"
          required
          className="w-full rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-sm tabular-nums"
        />
      </Field>

      <Field label="Fees paid ($)">
        <input
          type="number"
          name="fees_paid"
          step="0.01"
          min="0"
          defaultValue="0"
          className="w-full rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-sm tabular-nums"
        />
      </Field>

      <Field label="Placed at (UTC, optional)">
        <input
          type="datetime-local"
          name="placed_at"
          className="w-full rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-sm"
        />
      </Field>

      <Field label="Tags">
        <div className="flex flex-wrap gap-2">
          {KNOWN_TAGS.map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" name="tags" value={t} className="accent-emerald-500" />
              <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono">{t}</span>
            </label>
          ))}
        </div>
      </Field>

      <div className="sm:col-span-2">
        <label className="text-xs uppercase text-zinc-500">Notes</label>
        <textarea
          name="notes"
          rows={2}
          className="mt-1 w-full rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="sm:col-span-2 flex items-center justify-between gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 text-sm font-medium"
        >
          {pending ? "Logging…" : "Log bet"}
        </button>
        {state.message && (
          <span
            className={`text-sm ${state.ok ? "text-emerald-400" : "text-rose-400"}`}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs uppercase text-zinc-500 mb-1">{label}</div>
      {children}
    </label>
  );
}
