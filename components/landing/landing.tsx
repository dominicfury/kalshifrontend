import { Activity, BadgeCheck, Brain, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const FEATURES = [
  {
    icon: Brain,
    title: "Multi-book consensus",
    body:
      "Sportsbook odds across Pinnacle, DraftKings, FanDuel, and more — devigged and weighted into a fair-value oracle for every Kalshi market.",
  },
  {
    icon: Activity,
    title: "Live signal feed",
    body:
      "Kalshi NHL, NBA, MLB, and WNBA contracts priced below fair value, refreshed every poll cycle, with edge-at-fillable-size and depth.",
  },
  {
    icon: BadgeCheck,
    title: "CLV-tracked validation",
    body:
      "Closing line value recorded on every signal. CLV converges to truth in 50–100 signals — long before P&L can.",
  },
  {
    icon: Sparkles,
    title: "AI explanations",
    body:
      "Plain-English breakdown of any signal: column-by-column meaning, why it's flagged, exact placement instructions, biggest risks.",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav with login/signup CTAs */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center" aria-label="Sportsbetbrain home">
            <Image
              src="/logo.png"
              alt="Sportsbetbrain"
              width={474}
              height={530}
              priority
              className="h-16 w-auto sm:h-24"
            />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-100 hover:bg-zinc-800 hover:text-white"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-400"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero — solid dark backdrop directly behind the text so the
            global orange-950 radial gradient never washes it out. */}
        <section className="relative mx-auto max-w-[1280px] px-6 pt-16 pb-24 text-center">
          <div className="pointer-events-none absolute inset-x-4 inset-y-8 -z-10 rounded-3xl bg-zinc-950/70" />
          <Image
            src="/logo.png"
            alt="Sportsbetbrain"
            width={474}
            height={530}
            priority
            className="mx-auto h-48 w-auto sm:h-72 lg:h-96 drop-shadow-[0_0_24px_rgba(0,0,0,0.6)]"
          />
          <h1 className="mt-8 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            +EV trading on Kalshi sports markets
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-zinc-100">
            Live signal generator that compares Kalshi NHL, NBA, MLB, and WNBA
            contracts against multi-book sportsbook consensus. Validates with
            closing line value, not P&amp;L theater.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-md bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-400"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-zinc-600 bg-zinc-900/60 px-5 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-800 hover:text-white"
            >
              I have an account
            </Link>
          </div>
          <p className="mt-4 text-xs text-zinc-300">
            New accounts are reviewed by an admin within 12 hours.
          </p>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-[1280px] px-6 pb-24">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-6 shadow-sm"
              >
                <f.icon className="size-6 text-orange-300" />
                <h3 className="mt-4 text-base font-semibold text-white">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-100">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Disclaimer */}
        <section className="mx-auto max-w-[1280px] px-6 pb-24">
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-6 text-xs leading-relaxed text-zinc-200">
            Sportsbetbrain surfaces information for personal use. It does
            not place trades, custody funds, or offer financial advice. All
            trading happens on Kalshi (a CFTC-regulated exchange) under
            your own account. Sportsbook odds are consulted as a
            fair-value oracle only.
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800 bg-zinc-950">
        <div className="mx-auto max-w-[1280px] px-6 py-6 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
          v0 · trust the CLV
        </div>
      </footer>
    </div>
  );
}
