"use client";

import { Loader2, LogIn } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const justVerified = searchParams.get("verified") === "1";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        cache: "no-store",
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body?.error || `HTTP ${r.status}`);
        return;
      }
      // Use a hard navigation so middleware re-evaluates on the next request.
      window.location.href = next;
    } catch (e) {
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border border-zinc-700 bg-zinc-900/60 p-6 shadow-2xl backdrop-blur"
    >
      {justVerified && (
        <div className="rounded-md border border-emerald-900/60 bg-emerald-950/30 p-2 text-xs text-emerald-200">
          Email verified — sign in to start your 12h trial.
        </div>
      )}
      <div className="space-y-1.5">
        <label
          htmlFor="username"
          className="text-[10px] uppercase tracking-[0.16em] text-zinc-300"
        >
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-base text-zinc-100 placeholder:text-zinc-500 focus:border-orange-400/60 focus:outline-none focus:ring-2 focus:ring-orange-500/30 sm:text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="text-[10px] uppercase tracking-[0.16em] text-zinc-300"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-base text-zinc-100 placeholder:text-zinc-500 focus:border-orange-400/60 focus:outline-none focus:ring-2 focus:ring-orange-500/30 sm:text-sm"
        />
      </div>
      {error && (
        <div className="rounded-md border border-rose-900/60 bg-rose-950/40 p-2 text-xs text-rose-200">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={busy || !username || !password}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
          "bg-orange-500 text-white hover:bg-orange-400",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
