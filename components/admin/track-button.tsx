"use client";

import { Check, Plus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cn } from "@/lib/cn";


/**
 * Admin-only +track / ✓ tracked toggle on each signal row.
 *
 * Click "+":  POST /api/admin/bets {signal_id} → server reads admin
 *              bankroll + signal price + ¼-Kelly to compute n_contracts,
 *              inserts a bets row.
 * Click "✓":  DELETE /api/admin/bets/by-signal/[id] → removes the bet.
 *
 * After either, calls router.refresh() so the SignalRow.tracked field
 * re-reads from the LEFT JOIN bets.
 */
export function TrackButton({
  signalId,
  tracked,
}: {
  signalId: number;
  tracked: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    startTransition(async () => {
      try {
        const res = tracked
          ? await fetch(`/api/admin/bets/by-signal/${signalId}`, {
              method: "DELETE",
            })
          : await fetch(`/api/admin/bets`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ signal_id: signalId }),
            });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error ?? `HTTP ${res.status}`);
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "track failed");
      }
    });
  }

  const Icon = pending ? Loader2 : tracked ? Check : Plus;
  const label = tracked ? "Tracked — click to untrack" : "Track this signal";
  const titleWithError = error ? `${label} (last error: ${error})` : label;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={titleWithError}
      title={titleWithError}
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-md border transition-colors",
        tracked
          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
          : "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700",
        pending && "opacity-60",
      )}
    >
      <Icon className={cn("size-3.5", pending && "animate-spin")} />
    </button>
  );
}
