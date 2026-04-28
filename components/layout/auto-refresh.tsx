"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";


/**
 * Silent auto-refresh: calls router.refresh() every `intervalMs`. Pauses while
 * the tab is hidden so we don't burn DB reads on background tabs. Renders a
 * small indicator showing seconds until next refresh.
 */
export function AutoRefresh({
  intervalMs = 30_000,
  className,
}: {
  intervalMs?: number;
  className?: string;
}) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(Math.round(intervalMs / 1000));
  const [paused, setPaused] = useState(false);
  const lastRefreshAt = useRef(Date.now());

  useEffect(() => {
    function tick() {
      if (document.hidden) {
        setPaused(true);
        return;
      }
      setPaused(false);
      const elapsed = Date.now() - lastRefreshAt.current;
      const remaining = Math.max(0, Math.round((intervalMs - elapsed) / 1000));
      setSecondsLeft(remaining);
      if (elapsed >= intervalMs) {
        lastRefreshAt.current = Date.now();
        router.refresh();
      }
    }
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [intervalMs, router]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-zinc-500",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          paused
            ? "bg-zinc-600"
            : "bg-emerald-500 shadow-[0_0_6px_1px_rgba(16,185,129,0.5)]",
        )}
      />
      {paused ? "paused" : `refresh ${secondsLeft}s`}
    </span>
  );
}
