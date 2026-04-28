import {
  fetchClvByCategory,
  fetchClvByEdgeBucket,
  fetchClvOverall,
} from "@/lib/queries";
import { clvColor, pct } from "@/lib/format";

export const revalidate = 60;

const INTERPRETATION = [
  { range: "> +1%", n: ">100", note: "Real edge — bet confidently" },
  { range: "+0.3% to +1%", n: ">100", note: "Marginal edge — small or paper trade" },
  { range: "-0.3% to +0.3%", n: ">100", note: "No edge — stop alerting" },
  { range: "< -0.3%", n: ">100", note: "Negative edge — model wrong here" },
  { range: "any", n: "<50", note: "Insufficient data" },
];


export default async function ClvPage() {
  const [overall, byBucket, byCategory] = await Promise.all([
    fetchClvOverall(30),
    fetchClvByEdgeBucket(),
    fetchClvByCategory(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">CLV analysis</h1>
        <p className="text-sm text-zinc-400 mt-1">
          CLV converges to truth way faster than P&amp;L. If your average CLV is
          positive across 100+ resolved signals, the model has edge.
        </p>
      </div>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-zinc-400 mb-3">
          Last 30 days · all signals
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Signals" value={overall.n.toString()} />
          <Stat
            label="Resolved"
            value={`${overall.n_resolved} / ${overall.n}`}
          />
          <Stat
            label="Avg CLV"
            value={pct(overall.avg_clv)}
            colorClass={clvColor(overall.avg_clv)}
          />
          <Stat
            label="% positive"
            value={overall.pct_positive == null ? "—" : `${(overall.pct_positive * 100).toFixed(0)}%`}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Avg detected edge across these signals: {pct(overall.avg_edge)}
        </p>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-zinc-400 mb-3">
          CLV by edge bucket
        </h2>
        <p className="text-xs text-zinc-500 mb-3">
          If the &quot;5%+&quot; bucket has worse CLV than &quot;1-2%&quot;,
          your big edges are mostly errors. Tighten validation gates.
        </p>
        <BucketTable
          rows={byBucket.map((b) => ({
            label: b.bucket,
            n: b.n,
            avgClv: b.avg_clv,
            avgEdge: b.avg_edge,
          }))}
        />
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-zinc-400 mb-3">
          CLV by market_type · period
        </h2>
        <table className="min-w-full text-sm border border-zinc-800 rounded">
          <thead className="bg-zinc-900 text-xs uppercase text-zinc-400">
            <tr>
              <th className="px-3 py-2 text-left">market_type</th>
              <th className="px-3 py-2 text-left">period</th>
              <th className="px-3 py-2 text-right">n</th>
              <th className="px-3 py-2 text-right">avg CLV</th>
              <th className="px-3 py-2 text-right">% positive</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {byCategory.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                  no signals yet
                </td>
              </tr>
            )}
            {byCategory.map((c, i) => (
              <tr key={i}>
                <td className="px-3 py-1.5">{c.market_type}</td>
                <td className="px-3 py-1.5 text-zinc-400">{c.period}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{c.n}</td>
                <td className={`px-3 py-1.5 text-right tabular-nums ${clvColor(c.avg_clv)}`}>
                  {pct(c.avg_clv)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-zinc-400">
                  {c.pct_positive == null ? "—" : `${(c.pct_positive * 100).toFixed(0)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-zinc-400 mb-3">
          Interpretation guide
        </h2>
        <table className="min-w-full text-sm border border-zinc-800 rounded">
          <thead className="bg-zinc-900 text-xs uppercase text-zinc-400">
            <tr>
              <th className="px-3 py-2 text-left">30d avg CLV</th>
              <th className="px-3 py-2 text-left">n</th>
              <th className="px-3 py-2 text-left">interpretation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {INTERPRETATION.map((i) => (
              <tr key={i.range}>
                <td className="px-3 py-1.5 font-mono">{i.range}</td>
                <td className="px-3 py-1.5 text-zinc-400">{i.n}</td>
                <td className="px-3 py-1.5">{i.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
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


function BucketTable({
  rows,
}: {
  rows: { label: string; n: number; avgClv: number | null; avgEdge: number | null }[];
}) {
  return (
    <table className="min-w-full text-sm border border-zinc-800 rounded">
      <thead className="bg-zinc-900 text-xs uppercase text-zinc-400">
        <tr>
          <th className="px-3 py-2 text-left">edge bucket</th>
          <th className="px-3 py-2 text-right">n</th>
          <th className="px-3 py-2 text-right">avg edge</th>
          <th className="px-3 py-2 text-right">avg CLV</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-800">
        {rows.length === 0 && (
          <tr>
            <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
              no signals yet
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.label}>
            <td className="px-3 py-1.5 font-mono">{r.label}</td>
            <td className="px-3 py-1.5 text-right tabular-nums">{r.n}</td>
            <td className="px-3 py-1.5 text-right tabular-nums text-zinc-400">
              {pct(r.avgEdge)}
            </td>
            <td className={`px-3 py-1.5 text-right tabular-nums ${clvColor(r.avgClv)}`}>
              {pct(r.avgClv)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
