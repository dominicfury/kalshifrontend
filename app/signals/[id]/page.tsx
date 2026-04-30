import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AIChatTrigger } from "@/components/ai/ai-chat";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, TBody, Td, THead, Th, Tr } from "@/components/ui/data-table";
import { PageHeader, Section } from "@/components/ui/section";
import { Stat } from "@/components/ui/stat";
import { ago, num, pct, resolveBet, teamLabel } from "@/lib/format";
import { fetchSignalDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";


export default async function SignalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const detail = await fetchSignalDetail(numericId);
  if (!detail) notFound();

  const s = detail.signal;
  const matchup = `${teamLabel(s.away_team)} @ ${teamLabel(s.home_team)}`;
  const sideTone = s.side === "yes" ? "info" : "muted";
  const bet = resolveBet(s);
  const action = `Buy ${s.side.toUpperCase()} on Kalshi at $${(s.side === "yes" ? s.kalshi_yes_ask : s.kalshi_no_ask).toFixed(3)}`;

  return (
    <>
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200 -mt-2"
      >
        <ArrowLeft className="size-3.5" />
        Back to signals
      </Link>

      <PageHeader
        eyebrow={`Signal #${s.id} · ${ago(s.detected_at)} ago · ${s.ticker}`}
        title={
          <span className="inline-flex items-center gap-3">
            {matchup}
            <Badge variant={sideTone} mono>
              {bet}
            </Badge>
          </span>
        }
        description={s.raw_title}
        actions={
          <div className="flex items-center gap-2">
            <AIChatTrigger
              variant="button"
              context={{
                type: "single_signal",
                title: `${matchup} · ${bet}`,
                payload: {
                  id: s.id,
                  ticker: s.ticker,
                  raw_title: s.raw_title,
                  matchup,
                  market_type: s.market_type,
                  market_side: s.market_side,
                  line: s.line,
                  side: s.side,
                  bet,
                  action,
                  home_team: s.home_team,
                  away_team: s.away_team,
                  kalshi_yes_ask: s.kalshi_yes_ask,
                  kalshi_no_ask: s.kalshi_no_ask,
                  fair_yes_prob: s.fair_yes_prob,
                  edge_pct_after_fees: s.edge_pct_after_fees,
                  edge_pct_after_fees_at_size: s.edge_pct_after_fees_at_size,
                  expected_fill_price: s.expected_fill_price,
                  yes_book_depth: s.yes_book_depth,
                  n_books_used: s.n_books_used,
                  book_staleness_sec: s.book_staleness_sec,
                  kalshi_staleness_sec: s.kalshi_staleness_sec,
                  clv_pct: s.clv_pct,
                  detected_at: s.detected_at,
                  start_time: s.start_time,
                  contributing_books: detail.contributing_books.slice(0, 12),
                },
                seedPrompt:
                  "Walk me through this signal column-by-column. Explain what each number on the row means AND the specific value here, why this is flagged as +EV, exactly how to place the bet on Kalshi, and the biggest risks. Reference the per-book consensus contributions to identify the sharpest sources.",
              }}
            />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Edge after fees"
          value={pct(s.edge_pct_after_fees)}
          tone={
            s.edge_pct_after_fees >= 0.05
              ? "warning"
              : s.edge_pct_after_fees >= 0.02
                ? "positive"
                : "default"
          }
          hint="vs sportsbook consensus"
        />
        <Stat
          label="@ $200 fill"
          value={pct(s.edge_pct_after_fees_at_size)}
          tone={
            s.edge_pct_after_fees_at_size != null && s.edge_pct_after_fees_at_size >= 0.02
              ? "positive"
              : "muted"
          }
          hint={
            s.expected_fill_price != null
              ? `avg fill ${num(s.expected_fill_price, 3)}`
              : undefined
          }
        />
        <Stat
          label="CLV"
          value={pct(s.clv_pct)}
          tone={
            s.clv_pct == null
              ? "muted"
              : s.clv_pct > 0.005
                ? "positive"
                : s.clv_pct < -0.005
                  ? "negative"
                  : "default"
          }
          hint={
            s.closing_kalshi_yes_price != null
              ? `closing yes mid ${num(s.closing_kalshi_yes_price, 3)}`
              : "pending close"
          }
        />
        <Stat
          label="Books in consensus"
          value={s.n_books_used}
          tone={s.n_books_used <= 2 ? "warning" : "default"}
          hint={`match conf ${s.match_confidence.toFixed(2)}`}
        />
      </div>

      <Section
        eyebrow="upstreams"
        title="Per-book consensus contribution"
        description="Each row is one sportsbook's devigged probability for the YES side of this market. The signal's fair_yes_prob is the BOOK_WEIGHTS-weighted mean."
      >
        {detail.contributing_books.length === 0 ? (
          <Card>
            <CardBody>
              <div className="text-sm text-zinc-500">
                No matched book quotes captured. (matcher only retains rows
                where both sides of the devig pair are present.)
              </div>
            </CardBody>
          </Card>
        ) : (
          <DataTable>
            <THead>
              <Tr>
                <Th>Book</Th>
                <Th align="right">{s.side.toUpperCase()} odds</Th>
                <Th align="right">Other odds</Th>
                <Th align="right">Fair {s.side.toUpperCase()}</Th>
                <Th align="right">Polled</Th>
              </Tr>
            </THead>
            <TBody>
              {detail.contributing_books.map((b) => (
                <Tr key={b.book}>
                  <Td>
                    <Badge variant={b.book === "pinnacle" ? "info" : "muted"} mono>
                      {b.book}
                    </Badge>
                  </Td>
                  <Td align="right" mono>{num(b.this_side_odds, 2)}</Td>
                  <Td align="right" mono muted>{num(b.other_side_odds, 2)}</Td>
                  <Td align="right" mono>{num(b.fair_prob, 4)}</Td>
                  <Td align="right" muted>{ago(b.polled_at)}</Td>
                </Tr>
              ))}
            </TBody>
          </DataTable>
        )}
      </Section>

      <Section
        eyebrow="kalshi orderbook"
        title="Top 5 ask levels"
        description="Asks are derived from the cross-side bid book (yes_ask = 1 − max(no_bids))."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader>
              <span className="text-xs uppercase tracking-wide text-zinc-400">
                YES asks
              </span>
            </CardHeader>
            <CardBody>
              <BookList levels={detail.yes_book} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <span className="text-xs uppercase tracking-wide text-zinc-400">
                NO asks
              </span>
            </CardHeader>
            <CardBody>
              <BookList levels={detail.no_book} />
            </CardBody>
          </Card>
        </div>
      </Section>

      {detail.history.length > 1 && (
        <Section
          eyebrow="history"
          title={`Signal history on this market (${detail.history.length})`}
          description="Multiple detections of edge on the same market over time. Watch the edge drift."
        >
          <DataTable>
            <THead>
              <Tr>
                <Th>When</Th>
                <Th>Side</Th>
                <Th align="right">Price</Th>
                <Th align="right">Fair</Th>
                <Th align="right">Edge</Th>
              </Tr>
            </THead>
            <TBody>
              {detail.history.map((h) => (
                <Tr key={h.id}>
                  <Td muted>{ago(h.detected_at)}</Td>
                  <Td>
                    <Badge variant={h.side === "yes" ? "info" : "muted"} mono>
                      {h.side.toUpperCase()}
                    </Badge>
                  </Td>
                  <Td align="right" mono>
                    {num(h.side === "yes" ? h.kalshi_yes_ask : h.kalshi_no_ask, 3)}
                  </Td>
                  <Td align="right" mono>
                    {num(h.side === "yes" ? h.fair_yes_prob : 1 - h.fair_yes_prob, 3)}
                  </Td>
                  <Td align="right" mono>{pct(h.edge_pct_after_fees)}</Td>
                </Tr>
              ))}
            </TBody>
          </DataTable>
        </Section>
      )}
    </>
  );
}


function BookList({ levels }: { levels: { price: number; size: number }[] }) {
  if (levels.length === 0) {
    return <div className="text-sm text-zinc-500">empty</div>;
  }
  return (
    <div className="space-y-1">
      {levels.map((lvl, i) => (
        <div
          key={i}
          className="flex items-center justify-between text-sm font-mono tabular-nums"
        >
          <span className="text-zinc-200">{lvl.price.toFixed(3)}</span>
          <span className="text-zinc-500">
            {Math.round(lvl.size)}{" "}
            <span className="text-zinc-600">@ ${(lvl.price * lvl.size).toFixed(0)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
