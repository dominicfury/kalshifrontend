import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  TBody,
  Td,
  THead,
  Th,
  Tr,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, Section } from "@/components/ui/section";
import { Stat } from "@/components/ui/stat";
import { fetchBetAggregate, fetchBets, fetchOpenSignalsForBet } from "@/lib/bet-queries";
import { ago, clvColor, dollars, pct, teamLabel } from "@/lib/format";

import BetForm from "./bet-form";

export const dynamic = "force-dynamic";


function parseTags(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}


export default async function BetsPage() {
  const [bets, agg, signals] = await Promise.all([
    fetchBets(200),
    fetchBetAggregate(),
    fetchOpenSignalsForBet(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="manual entry · v1"
        title="Bets"
        description="Log every bet you place. Tags surface patterns ('gut_override' costing you, 'lineup_news' actually working, etc.)."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Bets" value={agg.n_bets} />
        <Stat label="Resolved" value={`${agg.realized_n} / ${agg.n_bets}`} tone="muted" />
        <Stat label="Total stake" value={dollars(agg.total_stake)} tone="muted" />
        <Stat
          label="Realized P&L"
          value={dollars(agg.total_pnl)}
          tone={
            agg.total_pnl > 0 ? "positive" : agg.total_pnl < 0 ? "negative" : "muted"
          }
        />
        <Stat
          label="Avg CLV"
          value={pct(agg.avg_clv)}
          tone={
            agg.avg_clv == null
              ? "muted"
              : agg.avg_clv > 0.005
                ? "positive"
                : agg.avg_clv < -0.005
                  ? "negative"
                  : "default"
          }
          hint="P&L is variance — CLV is truth"
        />
      </div>

      <Section eyebrow="entry" title="Log a bet">
        <BetForm signals={signals} />
      </Section>

      <Section
        eyebrow="ledger"
        title="History"
        description={`${bets.length} bet${bets.length === 1 ? "" : "s"} · sorted newest first`}
      >
        {bets.length === 0 ? (
          <EmptyState
            title="No bets logged yet"
            description="Use the form above. Off-system bets (no signal_id) are also welcome — tag them so you can analyze separately."
          />
        ) : (
          <DataTable>
            <THead>
              <Tr>
                <Th>When</Th>
                <Th>Matchup</Th>
                <Th>Market</Th>
                <Th>Side</Th>
                <Th align="right">Fill</Th>
                <Th align="right">N</Th>
                <Th align="right">Stake</Th>
                <Th align="right">P&L</Th>
                <Th align="right">CLV</Th>
                <Th>Tags</Th>
                <Th>Outcome</Th>
              </Tr>
            </THead>
            <TBody>
              {bets.map((b) => (
                <Tr key={b.id}>
                  <Td muted>{ago(b.placed_at)}</Td>
                  <Td>
                    {teamLabel(b.away_team)} @ {teamLabel(b.home_team)}
                  </Td>
                  <Td>
                    <Badge variant="muted" mono>
                      {b.market_type}
                      {b.line != null ? ` ${b.line}` : ""}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge variant={b.side === "yes" ? "info" : "muted"} mono>
                      {b.side.toUpperCase()}
                    </Badge>
                  </Td>
                  <Td align="right" mono>
                    {b.fill_price.toFixed(3)}
                  </Td>
                  <Td align="right" mono muted>
                    {b.n_contracts}
                  </Td>
                  <Td align="right" mono>
                    {dollars(b.stake)}
                  </Td>
                  <Td
                    align="right"
                    mono
                    className={
                      b.realized_pnl == null
                        ? "text-zinc-600"
                        : b.realized_pnl >= 0
                          ? "text-emerald-400"
                          : "text-rose-400"
                    }
                  >
                    {b.realized_pnl == null ? "—" : dollars(b.realized_pnl)}
                  </Td>
                  <Td align="right" mono className={clvColor(b.clv_pct)}>
                    {pct(b.clv_pct)}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {parseTags(b.tags).map((t) => (
                        <Badge key={t} variant="outline" mono>
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    {b.outcome === "yes" && (
                      <Badge variant="positive" mono>WIN</Badge>
                    )}
                    {b.outcome === "no" && (
                      <Badge variant="negative" mono>LOSS</Badge>
                    )}
                    {b.outcome === "void" && <Badge variant="muted" mono>VOID</Badge>}
                    {b.outcome == null && b.closing_kalshi_price != null && (
                      <Badge variant="info" mono>CLOSED</Badge>
                    )}
                    {b.outcome == null && b.closing_kalshi_price == null && (
                      <span className="text-xs text-zinc-600">open</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </DataTable>
        )}
      </Section>
    </>
  );
}
