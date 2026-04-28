import { fetchBetAggregate, fetchBets, fetchOpenSignalsForBet } from "@/lib/bet-queries";
import { dollars, pct, teamLabel, clvColor, ago } from "@/lib/format";

import BetForm from "./bet-form";

// Render on every request — Server Actions + form state need request context
// rather than static prerender.
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
    <div className="space-y-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Bet log</h1>
        <span className="text-xs text-zinc-500">
          {bets.length} bets · refreshes every 30s
        </span>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Bets" value={agg.n_bets.toString()} />
        <Stat label="Resolved" value={`${agg.realized_n} / ${agg.n_bets}`} />
        <Stat label="Total stake" value={dollars(agg.total_stake)} />
        <Stat
          label="Realized P&L"
          value={dollars(agg.total_pnl)}
          colorClass={agg.total_pnl >= 0 ? "text-emerald-400" : "text-rose-400"}
        />
        <Stat
          label="Avg CLV"
          value={pct(agg.avg_clv)}
          colorClass={clvColor(agg.avg_clv)}
        />
      </section>

      <BetForm signals={signals} />

      <section>
        <h2 className="text-sm uppercase tracking-wide text-zinc-400 mb-3">History</h2>
        {bets.length === 0 ? (
          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-400">
            No bets yet. Use the form above.
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-zinc-800">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-900 text-xs uppercase text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-left">when</th>
                  <th className="px-3 py-2 text-left">matchup</th>
                  <th className="px-3 py-2 text-left">market</th>
                  <th className="px-3 py-2 text-left">side</th>
                  <th className="px-3 py-2 text-right">fill</th>
                  <th className="px-3 py-2 text-right">contracts</th>
                  <th className="px-3 py-2 text-right">stake</th>
                  <th className="px-3 py-2 text-right">P&L</th>
                  <th className="px-3 py-2 text-right">CLV</th>
                  <th className="px-3 py-2 text-left">tags</th>
                  <th className="px-3 py-2 text-left">outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {bets.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-900/40">
                    <td className="px-3 py-1.5 text-zinc-400 whitespace-nowrap">
                      {ago(b.placed_at)}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {teamLabel(b.away_team)} @ {teamLabel(b.home_team)}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs whitespace-nowrap">
                      {b.market_type}
                      {b.line != null ? ` ${b.line}` : ""}
                    </td>
                    <td className="px-3 py-1.5 uppercase text-xs">{b.side}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {b.fill_price.toFixed(3)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-zinc-400">
                      {b.n_contracts}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {dollars(b.stake)}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right tabular-nums ${
                        b.realized_pnl == null
                          ? "text-zinc-500"
                          : b.realized_pnl >= 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                      }`}
                    >
                      {b.realized_pnl == null ? "—" : dollars(b.realized_pnl)}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right tabular-nums ${clvColor(b.clv_pct)}`}
                    >
                      {pct(b.clv_pct)}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {parseTags(b.tags).map((t) => (
                        <span
                          key={t}
                          className="mr-1 inline-block rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-300"
                        >
                          {t}
                        </span>
                      ))}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-zinc-400">
                      {b.outcome ?? (b.closing_kalshi_price != null ? "closed" : "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}


function Stat({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string;
  colorClass?: string;
}) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums mt-1 ${colorClass ?? ""}`}>
        {value}
      </div>
    </div>
  );
}
