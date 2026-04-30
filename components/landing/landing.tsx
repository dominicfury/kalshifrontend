import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Brain,
  LineChart,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
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

// Static visual sample of what a row in the live signal feed looks like.
// Not a screenshot — an annotated mock that loads instantly and adapts to
// the user's color scheme tokens.
const SAMPLE_ROWS = [
  {
    sport: "NHL",
    matchup: "Bruins @ Rangers",
    bet: "Rangers ML · YES",
    price: "0.485",
    fair: "0.512",
    edge: "+2.7%",
    badge: "fresh",
  },
  {
    sport: "NBA",
    matchup: "Heat @ Celtics",
    bet: "Over 213.5 · NO",
    price: "0.472",
    fair: "0.494",
    edge: "+2.3%",
    badge: "fresh",
  },
  {
    sport: "MLB",
    matchup: "Dodgers @ Giants",
    bet: "Dodgers ML · YES",
    price: "0.612",
    fair: "0.634",
    edge: "+1.8%",
    badge: null,
  },
];


function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/55">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="Sportsbetbrain home"
        >
          <Image
            src="/logo.png"
            alt=""
            width={474}
            height={530}
            priority
            className="h-9 w-auto sm:h-11"
          />
          <span className="hidden text-sm font-semibold tracking-tight text-white sm:inline">
            Sportsbetbrain
          </span>
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
          <Link
            href="/signup"
            className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 transition-colors hover:bg-orange-400"
          >
            Sign up
          </Link>
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


function SignalPreview() {
  return (
    <div className="relative mx-auto mt-16 w-full max-w-3xl">
      <div className="absolute inset-x-6 -bottom-4 -z-10 h-12 rounded-full bg-orange-500/20 blur-2xl" />
      <div
        role="img"
        aria-label="Sample of the live signal feed: three rows showing sport, matchup, bet, price, fair value, and edge."
        className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-2xl shadow-black/40 backdrop-blur"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_1px_rgba(16,185,129,0.6)]" />
            live · refreshing
          </span>
          <span className="hidden font-mono text-zinc-500 sm:inline">
            polled 12s ago
          </span>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/60 text-[10px] uppercase tracking-[0.12em] text-zinc-400">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Sport</th>
              <th className="px-3 py-2 text-left font-medium">Matchup</th>
              <th className="px-3 py-2 text-left font-medium">Bet</th>
              <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">
                Price
              </th>
              <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">
                Fair
              </th>
              <th className="px-3 py-2 text-right font-medium">Edge</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {SAMPLE_ROWS.map((r) => (
              <tr key={r.matchup} className="transition-colors hover:bg-zinc-900/60">
                <td className="px-3 py-2.5">
                  <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-200">
                    {r.sport}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-zinc-100">{r.matchup}</td>
                <td className="px-3 py-2.5">
                  <span className="rounded bg-orange-500/10 px-1.5 py-0.5 font-mono text-[11px] text-orange-200 ring-1 ring-orange-500/20">
                    {r.bet}
                  </span>
                </td>
                <td className="hidden px-3 py-2.5 text-right font-mono tabular-nums text-zinc-200 sm:table-cell">
                  {r.price}
                </td>
                <td className="hidden px-3 py-2.5 text-right font-mono tabular-nums text-zinc-300 sm:table-cell">
                  {r.fair}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/30">
                    {r.edge}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-zinc-800 bg-zinc-950/60 px-4 py-2 text-[10px] text-zinc-500">
          Sample preview · live data after sign-in
        </div>
      </div>
    </div>
  );
}


export function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <LandingHeader />

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
          </div>

          <SignalPreview />
        </section>

        {/* Stats strip */}
        <section className="px-4 pb-16 sm:px-6">
          <div className="mx-auto grid max-w-5xl gap-px overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-800/60 sm:grid-cols-3">
            <Stat label="Books in consensus" value="9+" sub="incl. Pinnacle, Circa" />
            <Stat label="Refresh cadence" value="60s" sub="auto · visibility-aware" />
            <Stat label="Validation horizon" value="50–100 signals" sub="for stable CLV signal" />
          </div>
        </section>

        {/* Features */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Built like a desk, not a content site
              </h2>
              <p className="mt-3 text-base leading-relaxed text-zinc-300">
                Every column on the table answers a question a serious trader
                would ask before clicking buy. Nothing that looks impressive
                but isn&apos;t.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <article
                  key={f.title}
                  className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
                >
                  <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-300 ring-1 ring-orange-500/20">
                    <f.icon className="size-5" />
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    {f.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Process */}
        <section className="border-t border-zinc-800 bg-zinc-950 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-10 max-w-2xl text-2xl font-bold tracking-tight text-white sm:text-3xl">
              How a signal gets to your screen
            </h2>
            <ol className="grid gap-4 sm:grid-cols-3">
              <ProcessStep
                index="01"
                icon={<TrendingUp className="size-5" />}
                title="Pull odds"
                body="Polled every minute from Kalshi and from a panel of sportsbooks. Stale quotes are dropped before they pollute the consensus."
              />
              <ProcessStep
                index="02"
                icon={<LineChart className="size-5" />}
                title="Devig & price"
                body="Each book is devigged independently, then weighted into a fair-value probability. Fees are subtracted on both legs — the edge you see is the edge you'd realize."
              />
              <ProcessStep
                index="03"
                icon={<ShieldCheck className="size-5" />}
                title="Gate & ship"
                body="Signal must clear edge, depth, multi-book, and freshness checks. CLV is recorded the moment the line closes — every call gets graded."
              />
            </ol>
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


function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-zinc-950 px-6 py-6 text-center sm:py-8">
      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
        {value}
      </div>
      <div className="mt-1 text-xs text-zinc-400">{sub}</div>
    </div>
  );
}


function ProcessStep({
  index,
  icon,
  title,
  body,
}: {
  index: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <div className="flex items-center gap-3 text-orange-300">
        <span className="font-mono text-xs tracking-widest text-zinc-500">
          {index}
        </span>
        <span className="inline-flex size-8 items-center justify-center rounded-md bg-orange-500/10 ring-1 ring-orange-500/20">
          {icon}
        </span>
      </div>
      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">{body}</p>
    </li>
  );
}
