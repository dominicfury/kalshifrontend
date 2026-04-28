import { fetchRecentSignals, type SignalRow } from "@/lib/queries";
import { ago, clvColor, edgeColor, num, pct, teamLabel } from "@/lib/format";

export const revalidate = 30;

function matchupLabel(s: SignalRow): string {
  return `${teamLabel(s.away_team)} @ ${teamLabel(s.home_team)}`;
}

function marketLabel(s: SignalRow): string {
  if (s.market_type === "moneyline") return `ML ${s.side.toUpperCase()}`;
  if (s.market_type === "total")
    return `${s.line} ${s.side.toUpperCase()}`;
  if (s.market_type === "puckline")
    return `${s.line} ${s.side.toUpperCase()}`;
  return `${s.market_type} ${s.side}`;
}

export default async function SignalsPage() {
  let signals: SignalRow[] = [];
  let error: string | null = null;
  try {
    signals = await fetchRecentSignals(100);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Live signals</h1>
        <span className="text-xs text-zinc-500">
          {signals.length} rows · refreshes every 30s
        </span>
      </div>

      {error && (
        <div className="rounded border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-200">
          Database error: {error}
        </div>
      )}

      {!error && signals.length === 0 && (
        <div className="rounded border border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-400">
          No signals yet. Run <code className="rounded bg-zinc-800 px-1">python -m scripts.poll_once</code> +
          <code className="rounded bg-zinc-800 px-1 ml-1">python -m scripts.generate_signals</code> in the
          backend project, or wait for the deployed scheduler to fire.
        </div>
      )}

      {signals.length > 0 && (
        <div className="overflow-x-auto rounded border border-zinc-800">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-3 py-2 text-left">when</th>
                <th className="px-3 py-2 text-left">matchup</th>
                <th className="px-3 py-2 text-left">market</th>
                <th className="px-3 py-2 text-right">k yes ask</th>
                <th className="px-3 py-2 text-right">fair</th>
                <th className="px-3 py-2 text-right">edge</th>
                <th className="px-3 py-2 text-right">@ size</th>
                <th className="px-3 py-2 text-right">depth</th>
                <th className="px-3 py-2 text-right">k stale</th>
                <th className="px-3 py-2 text-right">b stale</th>
                <th className="px-3 py-2 text-right">books</th>
                <th className="px-3 py-2 text-right">clv</th>
                <th className="px-3 py-2 text-left">outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {signals.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-900/40">
                  <td className="px-3 py-1.5 text-zinc-400 whitespace-nowrap">
                    {ago(s.detected_at)}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{matchupLabel(s)}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap font-mono text-xs">
                    {marketLabel(s)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {num(s.kalshi_yes_ask, 3)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {num(s.fair_yes_prob, 3)}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right tabular-nums ${edgeColor(s.edge_pct_after_fees)}`}
                  >
                    {pct(s.edge_pct_after_fees)}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right tabular-nums ${edgeColor(s.edge_pct_after_fees_at_size)}`}
                  >
                    {pct(s.edge_pct_after_fees_at_size)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-zinc-400">
                    {s.yes_book_depth == null ? "—" : `$${Math.round(s.yes_book_depth)}`}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-zinc-500">
                    {s.kalshi_staleness_sec == null ? "—" : `${s.kalshi_staleness_sec}s`}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-zinc-500">
                    {s.book_staleness_sec == null ? "—" : `${s.book_staleness_sec}s`}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-zinc-400">
                    {s.n_books_used}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right tabular-nums ${clvColor(s.clv_pct)}`}
                  >
                    {pct(s.clv_pct)}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-xs text-zinc-400">
                    {s.resolved_outcome ?? (s.closing_kalshi_yes_price != null ? "closed" : "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
