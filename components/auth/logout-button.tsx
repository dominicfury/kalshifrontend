"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";

export function LogoutButton({ variant = "icon" }: { variant?: "icon" | "link" }) {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
    } finally {
      // Hard-navigate so middleware re-evaluates with the cleared cookie.
      window.location.href = "/login";
    }
  }

  if (variant === "link") {
    return (
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        className="text-xs text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline disabled:opacity-50"
      >
        Log out
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      title="Log out"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-50",
        "disabled:cursor-not-allowed disabled:opacity-60",
      )}
    >
      <LogOut className="size-3.5" />
      Log out
    </button>
  );
}
