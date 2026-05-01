import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { PendingApproval } from "@/components/auth/pending-approval";
import LiveIndicator from "@/components/layout/live-indicator";
import Nav from "@/components/layout/nav";
import { getTrialState, TRIAL_HOURS } from "@/lib/session";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sportsbetbrain",
  description: "Live +EV signals and CLV tracking.",
};

// Tells iOS Safari + Chrome on Android what to color the status bar /
// address bar with — matches the page's dark zinc-950 so there's no
// jarring white strip above the header.
export const viewport = {
  themeColor: "#09090b",
  initialScale: 1,
  // user-scalable left enabled (accessibility). Form inputs use 16px+
  // font-size to avoid iOS Safari's auto-zoom-on-focus behavior.
};

// Trial state changes when admin verifies — never cache the layout.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const trial = await getTrialState();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-950 text-zinc-100">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-950/30 via-transparent to-transparent" />

        {trial.kind === "expired" ? (
          // 12h trial elapsed without admin approval. Block the dashboard.
          <PendingApproval username={trial.user.username} />
        ) : trial.kind === "guest" ? (
          // No cookie — auth pages and landing render their own chrome.
          <>{children}</>
        ) : (
          <>
            <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60">
              {/* Subtle accent line at the top edge — gives the header a
                  finished feel without a heavy bottom border or shadow. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent"
              />
              <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-2.5 sm:gap-6 sm:px-6 sm:py-3">
                <div className="flex min-w-0 items-center gap-3 sm:gap-6">
                  <Link
                    href="/"
                    className="group flex shrink-0 items-center rounded-md py-1 pr-2 transition-colors hover:bg-zinc-900/40"
                    aria-label="Sportsbetbrain home"
                  >
                    <Image
                      src="/logo.png"
                      alt="Sportsbetbrain"
                      width={474}
                      height={530}
                      priority
                      className="h-9 w-auto sm:h-10"
                    />
                  </Link>
                  {/* Vertical divider — only visible at sm+ since the nav
                      flows below the logo on narrow screens. */}
                  <span
                    aria-hidden
                    className="hidden h-6 w-px bg-zinc-800 sm:inline-block"
                  />
                  <Nav role={trial.kind === "admin" ? "admin" : "user"} />
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  <Suspense fallback={null}>
                    <LiveIndicator />
                  </Suspense>
                  <span className="hidden items-center gap-2 text-xs text-zinc-300 md:inline-flex">
                    <span
                      aria-hidden
                      className="inline-flex size-6 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold uppercase text-zinc-300"
                    >
                      {trial.user.username.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="font-medium text-zinc-200">
                      {trial.user.username}
                    </span>
                    {trial.kind === "admin" && (
                      <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-200 ring-1 ring-orange-500/30">
                        admin
                      </span>
                    )}
                  </span>
                  <LogoutButton />
                </div>
              </div>
              {trial.kind === "trial" && (
                <div className="border-t border-amber-900/40 bg-amber-950/30">
                  <div className="mx-auto max-w-[1400px] px-6 py-1.5 text-center text-[11px] uppercase tracking-[0.16em] text-amber-200">
                    awaiting admin approval · {formatRemaining(trial.remaining_ms)} of{" "}
                    {TRIAL_HOURS}h trial remaining
                  </div>
                </div>
              )}
            </header>

            <main className="mx-auto w-full max-w-[1400px] px-6 py-8 space-y-8">
              {children}
            </main>

            <footer className="mx-auto max-w-[1400px] px-6 py-6 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
              v0 · forward-tracking · trust the CLV
            </footer>
          </>
        )}
      </body>
    </html>
  );
}

function formatRemaining(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}
