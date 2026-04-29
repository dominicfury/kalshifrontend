"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cn } from "@/lib/cn";

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; kalshi: number; books: number }
  | { kind: "error"; message: string };

export default function RepollButton() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function trigger() {
    setState({ kind: "running" });
    try {
      const r = await fetch("/api/repoll", { method: "POST", cache: "no-store" });
      const body = await r.json();
      if (!r.ok) {
        setState({
          kind: "error",
          message: body?.error || body?.detail || `HTTP ${r.status}`,
        });
        return;
      }
      setState({
        kind: "ok",
        kalshi: body?.kalshi_count ?? 0,
        books: body?.books_count ?? 0,
      });
      // Refresh server-rendered data so new quotes/signals show up.
      startTransition(() => router.refresh());
      // Auto-reset to idle after 4s so the button is reusable.
      setTimeout(() => setState({ kind: "idle" }), 4000);
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "request failed",
      });
    }
  }

  const disabled = state.kind === "running";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={trigger}
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
          "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-50",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
        title="Manually trigger a Kalshi + sportsbook poll"
      >
        {state.kind === "running" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
        {state.kind === "running" ? "Polling…" : "Repoll"}
      </button>
      {state.kind === "ok" && (
        <span className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">
          ok · {state.kalshi}k · {state.books}b
        </span>
      )}
      {state.kind === "error" && (
        <span
          className="max-w-[14rem] truncate text-[10px] uppercase tracking-[0.16em] text-rose-300"
          title={state.message}
        >
          err · {state.message}
        </span>
      )}
    </div>
  );
}
