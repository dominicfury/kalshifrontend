import { ArrowRight, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";


function LandingHeader({ signupsOpen }: { signupsOpen: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/55">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 sm:px-6 sm:py-3">
        <Link
          href="/"
          className="flex items-center"
          aria-label="Sportsbetbrain home"
        >
          {/* Match the authenticated header's logo dimensions
              (app/layout.tsx) so the brand reads at the same scale
              before and after sign-in. The image carries the wordmark
              at this size, so no separate text label is needed. */}
          <Image
            src="/logo.png"
            alt="Sportsbetbrain"
            width={474}
            height={530}
            priority
            className="h-[108px] w-auto sm:h-[120px]"
          />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/info"
            className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white sm:inline-block"
          >
            How it works
          </Link>
          <Link
            href="/login"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-900 hover:text-white"
          >
            Log in
          </Link>
          {signupsOpen ? (
            <Link
              href="/signup"
              className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 transition-colors hover:bg-orange-400"
            >
              Sign up
            </Link>
          ) : (
            <span
              aria-label="Signups are currently closed"
              title="Signups are currently closed"
              className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-500"
            >
              <Lock className="size-3.5" />
              Signups closed
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}


function HeroBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* Soft top-left orange glow, fading into deep zinc. Gives the hero
          dimension without the body-level radial gradient washing the
          text out. */}
      <div className="absolute -top-32 left-1/2 h-[640px] w-[860px] -translate-x-1/2 rounded-full bg-orange-500/15 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
      {/* Faint grid texture for tactile background interest. Pure CSS so
          there's no image fetch on first paint. */}
      <div
        className="absolute inset-0 opacity-[0.07] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(244,244,245,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(244,244,245,0.4) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
    </div>
  );
}


export function LandingPage({ signupsOpen = true }: { signupsOpen?: boolean }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <LandingHeader signupsOpen={signupsOpen} />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28">
          <HeroBackground />
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-200">
              <span className="inline-block size-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_1px_rgba(251,146,60,0.65)]" />
              CLV-tracked, never P&amp;L theater
            </span>
            <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              +EV trading on{" "}
              <span className="bg-gradient-to-br from-orange-300 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                Kalshi sports markets
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-zinc-300 sm:text-xl">
              A live signal generator that compares Kalshi NHL, NBA, MLB, and
              WNBA contracts against a multi-book sportsbook consensus — and
              proves itself with closing-line value, not P&amp;L theater.
            </p>
            {signupsOpen ? (
              <>
                <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link
                    href="/signup"
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-md bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5 hover:bg-orange-400 hover:shadow-orange-500/30 sm:w-auto"
                  >
                    Get started
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex w-full items-center justify-center rounded-md border border-zinc-700 bg-zinc-900/60 px-5 py-3 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-white sm:w-auto"
                  >
                    I have an account
                  </Link>
                </div>
                <p className="mt-5 text-xs text-zinc-400">
                  New accounts are reviewed by an admin within 12 hours.
                </p>
              </>
            ) : (
              <>
                <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <span
                    aria-label="Signups are currently closed"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-5 py-3 text-sm font-semibold text-zinc-400 sm:w-auto"
                  >
                    <Lock className="size-4" />
                    Signups currently closed
                  </span>
                  <Link
                    href="/login"
                    className="inline-flex w-full items-center justify-center rounded-md border border-zinc-700 bg-zinc-900/60 px-5 py-3 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-white sm:w-auto"
                  >
                    I have an account
                  </Link>
                </div>
                <p className="mt-5 text-xs text-zinc-400">
                  New account creation is paused. Check back soon — existing
                  users can still log in.
                </p>
              </>
            )}
          </div>
        </section>

        {/* Disclaimer */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm leading-relaxed text-zinc-300">
            <strong className="text-zinc-100">Disclosure.</strong>{" "}
            Sportsbetbrain surfaces information for personal use. It does not
            place trades, custody funds, or offer financial advice. All
            trading happens on Kalshi (a CFTC-regulated exchange) under your
            own account. Sportsbook odds are consulted as a fair-value oracle
            only.
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800 bg-zinc-950">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 sm:flex-row sm:px-6">
          <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">
            v0 · trust the CLV
          </span>
          <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            <Link href="/info" className="hover:text-zinc-300">
              How it works
            </Link>
            {" · "}
            <Link href="/login" className="hover:text-zinc-300">
              Log in
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
