"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";


type Status = "active" | "paused" | "offline";


/**
 * Silent auto-refresh: probes /api/health then calls router.refresh() every
 * `intervalMs`. Pauses while the tab is hidden so we don't burn DB reads on
 * background tabs. On health-probe failure, shows an "offline" indicator and
 * backs off exponentially up to 5× the base interval before trying again,
 * so a flaky connection doesn't pin the user to silently stale data.
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
  const [status, setStatus] = useState<Status>("active");
  const lastRefreshAt = useRef<number | null>(null);
  const failureCount = useRef(0);

  useEffect(() => {
    if (lastRefreshAt.current === null) {
      lastRefreshAt.current = Date.now();
    }
    let cancelled = false;

    async function attemptRefresh() {
      // Probe connectivity before issuing the refresh — router.refresh() is
      // fire-and-forget so we'd otherwise have no way to detect that the
      // server is unreachable.
      try {
        const r = await fetch("/api/health", {
          method: "GET",
          cache: "no-store",
          // Belt-and-suspenders: cap probe time so a hung connection doesn't
          // wedge the refresh loop.
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      } catch {
        if (cancelled) return;
        failureCount.current += 1;
        setStatus("offline");
        return;
      }
      if (cancelled) return;
      failureCount.current = 0;
      setStatus("active");
      router.refresh();
    }

    function tick() {
      if (cancelled) return;
      if (document.hidden) {
        setStatus("paused");
        return;
      }
      // Exponential backoff while offline, capped at 5×. As soon as a probe
      // succeeds we drop back to the configured interval.
      const failureMultiplier = Math.min(5, 2 ** failureCount.current);
      const effectiveInterval =
        failureCount.current > 0 ? intervalMs * failureMultiplier : intervalMs;
      const elapsed = Date.now() - (lastRefreshAt.current ?? Date.now());
      const remaining = Math.max(
        0,
        Math.round((effectiveInterval - elapsed) / 1000),
      );
      setSecondsLeft(remaining);
      if (status !== "offline" && status !== "paused") {
        // Don't overwrite the offline label with "active" mid-backoff —
        // attemptRefresh resets it on success.
      }
      if (elapsed >= effectiveInterval) {
        lastRefreshAt.current = Date.now();
        void attemptRefresh();
      }
    }

    const id = window.setInterval(tick, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // status is intentionally excluded — we read its current value from a
    // ref-shaped pattern via failureCount; including it would re-arm the
    // interval on every status change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, router]);

  const dotClass =
    status === "offline"
      ? "bg-rose-500 shadow-[0_0_6px_1px_rgba(244,63,94,0.5)]"
      : status === "paused"
        ? "bg-zinc-600"
        : "bg-emerald-500 shadow-[0_0_6px_1px_rgba(16,185,129,0.5)]";

  const label =
    status === "offline"
      ? `offline · retry ${secondsLeft}s`
      : status === "paused"
        ? "paused"
        : `refresh ${secondsLeft}s`;

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-zinc-500",
        status === "offline" && "text-rose-300",
        className,
      )}
    >
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", dotClass)} />
      {label}
    </span>
  );
}
