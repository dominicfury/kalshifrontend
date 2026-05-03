import { ArrowDown, ArrowRight, ArrowUp, BookOpen, Lightbulb, Scale, ShieldAlert, Workflow } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader, Section } from "@/components/ui/section";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";


interface ColumnDef {
  label: string;
  field: string;
  what: string;          // 1-line meaning
  example: string;       // example value
  reading: string;       // how to read it
  redFlag?: string;      // when to ignore the signal
}

const COLUMNS: ColumnDef[] = [
  {
    label: "When",
    field: "detected_at",
    what: "How long ago we detected this opportunity.",
    example: "12m",
    reading:
      "Newer is better. Edges decay quickly — if a row is older than 30 minutes the price has likely moved.",
  },
  {
    label: "Sport",
    field: "sport",
    what: "Which league the contract is for.",
    example: "NHL",
    reading: "NHL, NBA, MLB, or WNBA.",
  },
  {
    label: "Matchup",
    field: "away_team @ home_team",
    what: "The game.",
    example: "Edmonton Oilers @ Anaheim Ducks",
    reading: "Click the row for the per-book breakdown.",
  },
  {
    label: "Market",
    field: "market_type / line / side",
    what: "What kind of contract and which side is +EV.",
    example: "TOTAL 6.5 NO",
    reading:
      "ML = moneyline (who wins). TOTAL = combined goals/runs/points over or under the line. PUCKLINE = NHL spread (similar for runline / spread in other sports). YES/NO is which side of the binary contract is the +EV side.",
  },
  {
    label: "Yes ask",
    field: "kalshi_yes_ask",
    what: "What you'd pay on Kalshi to buy a YES contract right now.",
    example: "$0.485",
    reading:
      "Each contract pays out $1 if YES happens, $0 if not. NO is the mirror — costs $1 - YES_BID. Always shown as YES even if the +EV side is NO; the table's Market column tells you which side the signal is for.",
  },
  {
    label: "Fair",
    field: "fair_yes_prob",
    what: "Our best estimate of the true probability the YES side actually happens.",
    example: "0.520",
    reading:
      "Computed from a multi-book sportsbook consensus, with the bookmaker juice (vig) stripped out. Pinnacle is weighted highest. If Yes ask < Fair, YES is +EV. If Yes ask > Fair, NO is +EV.",
  },
  {
    label: "Edge",
    field: "edge_pct_after_fees",
    what: "Expected ROI on your stake at the touch price, after Kalshi fees.",
    example: "+2.45%",
    reading:
      "The headline edge number. 1–3% is the trustworthy zone — that's where real edges typically live. 0.5–1% is marginal but worth tracking.",
    redFlag:
      ">5% almost always means a data bug, settlement-rule mismatch, or news you haven't seen. Hidden by default; visible in the Recent (24h) view.",
  },
  {
    label: "@ size",
    field: "edge_pct_after_fees_at_size",
    what: "Edge after walking $200 worth of contracts up the order book — i.e. the realistic edge at fillable size.",
    example: "+1.95%",
    reading:
      "The honest number. Touch edge is what you see; @size is what you'd actually capture on a $200 fill. The two should be close. If @size collapses or goes negative, the book is too thin to actually take the bet.",
  },
  {
    label: "Depth",
    field: "yes_book_depth",
    what: "Dollars worth of contracts available at the best ask price.",
    example: "$180",
    reading:
      "Higher = more confident you can fill at touch. Spec rule of thumb: <$25 is thin / unfillable, >$100 is comfortable.",
  },
  {
    label: "K stale",
    field: "kalshi_staleness_sec",
    what: "Seconds since the Kalshi price last moved (not since we polled).",
    example: "45s",
    reading:
      "Low = market is being actively quoted. We poll every 30s, so 30-60s is normal. >5min means the Kalshi market is sitting still while the consensus may have moved — usually the dangerous side of an 'edge'.",
    redFlag:
      ">10min triggers an automatic skip. We don't log the signal at all. Hidden rows are listed in the activity log.",
  },
  {
    label: "B stale",
    field: "book_staleness_sec",
    what: "Seconds since the freshest sportsbook quote in the consensus actually moved.",
    example: "20s",
    reading:
      "Healthy = <60s. >90s means the books are also drifting and the 'fair' value is suspect.",
  },
  {
    label: "Books",
    field: "n_books_used",
    what: "How many sportsbooks contributed to the consensus.",
    example: "8",
    reading:
      "More = sharper. With Pinnacle in the mix, 4+ is solid. 1–2 books = single-source consensus, treat with caution.",
  },
  {
    label: "CLV",
    field: "clv_pct",
    what: "Closing Line Value — did the Kalshi market move toward your side after we detected the signal?",
    example: "+3.10%",
    reading:
      "Recorded automatically right before puck/tip-off. Positive CLV across many signals = the tool is identifying real edges. Negative CLV = the market disagreed with us. Single CLV is noise — you need 50–100 signals before the average means anything.",
  },
  {
    label: "Status",
    field: "status",
    what: "Where this signal is in its lifecycle.",
    example: "OPEN",
    reading:
      "OPEN = pre-game. CLOSED = closing line recorded, awaiting settlement. WIN / LOSS / VOID after the game settles. Closed signals are hidden from the default view.",
  },
  {
    label: "AI",
    field: "—",
    what: "Click for an AI walkthrough of this specific signal.",
    example: "✨",
    reading:
      "Explains the row column-by-column with the actual numbers, why it's flagged +EV, exactly how to place the bet on Kalshi, and the biggest risks to skip it.",
  },
];

export default async function InfoPage() {
  const me = await getCurrentUser();
  return (
    <div className={me ? "" : "mx-auto max-w-[1000px] px-6 py-12"}>
      <PageHeader
        eyebrow="reference"
        title={
          <span className="inline-flex items-center gap-2">
            <BookOpen className="size-5 text-orange-300" />
            How Sportsbetbrain works
          </span>
        }
        description="A short read on what the signals table shows you and how to read each column."
      />

      {!me && (
        <div className="mt-6 mb-2 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-200">
          <Lightbulb className="size-4 text-orange-300" />
          <span className="flex-1">
            You&apos;re reading this without an account. Sign up to see the live
            signals table.
          </span>
          <Link
            href="/signup"
            className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-400"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-800"
          >
            Login
          </Link>
        </div>
      )}

      <Section
        eyebrow="thesis"
        title={
          <span className="inline-flex items-center gap-2">
            <Workflow className="size-4 text-orange-300" />
            What the tool actually does
          </span>
        }
      >
        <Card>
          <CardBody className="space-y-3 text-sm leading-relaxed text-zinc-100">
            <p>
              Sportsbetbrain is a <strong>signal generator</strong>. We compare
              the price of every Kalshi sports contract against a consensus we
              build from <em>multiple sportsbooks</em> (DraftKings, FanDuel,
              Pinnacle, BetMGM, etc.), strip out the bookmaker juice (the vig),
              and surface the cases where Kalshi&apos;s price diverges from that
              consensus by more than it should.
            </p>
            <p>
              <strong className="text-orange-300">Important:</strong> you only
              ever bet on Kalshi. The sportsbooks are used as a fair-value
              oracle — we don&apos;t place bets there. Kalshi is a CFTC-regulated
              prediction exchange, which is why it&apos;s legal in many states
              where books aren&apos;t.
            </p>
            <p className="flex items-center gap-2 text-zinc-200">
              <ArrowRight className="size-3.5 text-zinc-400" />
              Realistic edges live in the <strong>1–3% range</strong> after fees.
              Anything bigger usually means a data issue, settlement-rule
              mismatch, or news the consensus hasn&apos;t priced yet.
            </p>
          </CardBody>
        </Card>
      </Section>

      <Section
        eyebrow="signals table"
        title={
          <span className="inline-flex items-center gap-2">
            <Scale className="size-4 text-orange-300" />
            What each column means
          </span>
        }
        description="Click a row in the live table to drill in. Hover any header tooltip for a refresher."
      >
        <Card>
          <CardBody className="space-y-4">
            {COLUMNS.map((col) => (
              <div
                key={col.field}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info" mono>{col.label}</Badge>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                    {col.field}
                  </span>
                  <span className="ml-auto font-mono text-xs text-zinc-300">
                    e.g. {col.example}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-zinc-100">
                  {col.what}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-200">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                    How to read:
                  </span>{" "}
                  {col.reading}
                </p>
                {col.redFlag && (
                  <p className="mt-2 inline-flex items-start gap-1.5 rounded-md border border-rose-900/50 bg-rose-950/30 p-2 text-xs leading-relaxed text-rose-200">
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-rose-300" />
                    <span>{col.redFlag}</span>
                  </p>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      </Section>

      <Section
        eyebrow="reading the row"
        title="Quick decision flow"
      >
        <Card>
          <CardBody className="space-y-3 text-sm leading-relaxed text-zinc-100">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <strong>Edge in the 1–3% range?</strong> That&apos;s the trustworthy
                zone. Continue.
              </li>
              <li>
                <strong>Does the @size edge stay close to the touch edge?</strong>{" "}
                If yes, the book is fillable. If @size collapses, skip.
              </li>
              <li>
                <strong>Is K stale &lt; 60s and B stale &lt; 90s?</strong> Both
                sides are actively trading. Stale = trap risk.
              </li>
              <li>
                <strong>Books ≥ 4?</strong> The consensus is sharp. 1–2 books = single-source.
              </li>
              <li>
                <strong>Depth ≥ $50?</strong> You can actually fill enough size to matter.
              </li>
              <li>
                <strong>Status = OPEN?</strong> Game hasn&apos;t started. CLOSED rows are
                historical only.
              </li>
            </ol>
            <p className="text-xs text-zinc-300">
              Trust the CLV column over time, not your P&amp;L. P&amp;L is variance for
              the first ~200 bets; CLV converges to truth in 50–100.
            </p>
          </CardBody>
        </Card>
      </Section>

      <Section
        eyebrow="visual flags"
        title="Row tinting + status badges"
      >
        <Card>
          <CardBody>
            <ul className="space-y-2 text-sm text-zinc-100">
              <li className="flex items-center gap-2">
                <span className="inline-block size-3 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                <span>
                  <strong>Live</strong> sport chip — game starting in &lt; 2 hours.
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block size-3 rounded-full bg-amber-400" />
                <span>
                  <strong>Soon</strong> chip — game in 2–24 hours.
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block size-3 rounded-full bg-zinc-700" />
                <span>
                  <strong>Dark</strong> chip — no games for that sport in the next 24 hours.
                </span>
              </li>
              <li className="flex items-center gap-2">
                <ArrowUp className="size-4 text-emerald-300" />
                <span>
                  Green CLV = market moved your way after detection (good).
                </span>
              </li>
              <li className="flex items-center gap-2">
                <ArrowDown className="size-4 text-rose-300" />
                <span>
                  Red CLV = market moved against you (the signal was wrong, or got eaten before you could act on it).
                </span>
              </li>
            </ul>
          </CardBody>
        </Card>
      </Section>

      <Section eyebrow="next" title="Set up alerts">
        <Card>
          <CardBody className="space-y-3 text-sm leading-relaxed text-zinc-100">
            <p>
              Once an admin verifies your account, you can subscribe to email
              alerts for signals matching your own criteria — sport, market
              type, minimum edge, minimum books, cooldown to prevent spam.
            </p>
            <Link
              href="/alerts"
              className="inline-flex items-center gap-1.5 rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-400"
            >
              Manage your alerts
              <ArrowRight className="size-3.5" />
            </Link>
          </CardBody>
        </Card>
      </Section>
    </div>
  );
}
