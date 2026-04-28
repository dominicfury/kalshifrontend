import { Info, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  TBody,
  Td,
  THead,
  Th,
  Tr,
} from "@/components/ui/data-table";
import { PageHeader, Section } from "@/components/ui/section";
import { Stat } from "@/components/ui/stat";
import { clvColor, pct } from "@/lib/format";
import {
  fetchClvByCategory,
  fetchClvByEdgeBucket,
  fetchClvOverall,
} from "@/lib/queries";

export const revalidate = 60;


const INTERPRETATION = [
  { range: "> +1%", n: ">100", note: "Real edge — bet confidently", tone: "positive" as const },
  { range: "+0.3% to +1%", n: ">100", note: "Marginal edge — small or paper trade", tone: "info" as const },
  { range: "-0.3% to +0.3%", n: ">100", note: "No edge — stop alerting", tone: "muted" as const },
  { range: "< -0.3%", n: ">100", note: "Negative edge — model wrong here", tone: "negative" as const },
  { range: "any", n: "<50", note: "Insufficient data", tone: "muted" as const },
];


function clvTone(clv: number | null): "positive" | "negative" | "default" | "muted" {
  if (clv == null) return "muted";
  if (clv > 0.005) return "positive";
  if (clv < -0.005) return "negative";
  return "default";
}


export default async function ClvPage() {
  const [overall, byBucket, byCategory] = await Promise.all([
    fetchClvOverall(30),
    fetchClvByEdgeBucket(),
    fetchClvByCategory(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="30-day rolling window"
        title="CLV analysis"
        description="CLV converges to truth way faster than P&L. Average CLV positive across 100+ resolved signals = the model has edge."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Signals" value={overall.n.toString()} icon={<TrendingUp className="size-3" />} />
        <Stat
          label="Resolved"
          value={`${overall.n_resolved} / ${overall.n}`}
          tone="muted"
        />
        <Stat
          label="Avg CLV"
          value={pct(overall.avg_clv)}
          tone={clvTone(overall.avg_clv)}
          hint="weight all signals equally"
        />
        <Stat
          label="% Positive"
          value={
            overall.pct_positive == null
              ? "—"
              : `${(overall.pct_positive * 100).toFixed(0)}%`
          }
          tone="muted"
          hint={overall.avg_edge != null ? `avg edge ${pct(overall.avg_edge)}` : undefined}
        />
      </div>

      <Section
        eyebrow="diagnostic"
        title="CLV by edge bucket"
        description="If the 5%+ bucket has worse CLV than 1-2%, your big edges are mostly errors. Tighten validation gates."
      >
        <DataTable>
          <THead>
            <Tr>
              <Th>Edge bucket</Th>
              <Th align="right">n</Th>
              <Th align="right">Avg edge</Th>
              <Th align="right">Avg CLV</Th>
            </Tr>
          </THead>
          <TBody>
            {byBucket.length === 0 ? (
              <Tr>
                <Td className="text-center text-zinc-500" align="center">
                  no signals yet
                </Td>
                <Td>{null}</Td>
                <Td>{null}</Td>
                <Td>{null}</Td>
              </Tr>
            ) : (
              byBucket.map((b) => (
                <Tr key={b.bucket}>
                  <Td>
                    <Badge variant={b.bucket === "5%+" ? "warning" : "muted"} mono>
                      {b.bucket}
                    </Badge>
                  </Td>
                  <Td align="right" mono muted>{b.n}</Td>
                  <Td align="right" mono muted>{pct(b.avg_edge)}</Td>
                  <Td align="right" mono className={clvColor(b.avg_clv)}>
                    {pct(b.avg_clv)}
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </DataTable>
      </Section>

      <Section
        eyebrow="breakdown"
        title="CLV by market type · period"
        description="Look for categories where CLV is consistently positive — those are where the model has an edge worth alerting on."
      >
        <DataTable>
          <THead>
            <Tr>
              <Th>Market</Th>
              <Th>Period</Th>
              <Th align="right">n</Th>
              <Th align="right">Avg CLV</Th>
              <Th align="right">% positive</Th>
            </Tr>
          </THead>
          <TBody>
            {byCategory.length === 0 ? (
              <Tr>
                <Td align="center" className="text-zinc-500">no signals yet</Td>
                <Td>{null}</Td>
                <Td>{null}</Td>
                <Td>{null}</Td>
                <Td>{null}</Td>
              </Tr>
            ) : (
              byCategory.map((c, i) => (
                <Tr key={i}>
                  <Td>
                    <Badge variant="muted" mono>{c.market_type}</Badge>
                  </Td>
                  <Td muted>{c.period}</Td>
                  <Td align="right" mono>{c.n}</Td>
                  <Td align="right" mono className={clvColor(c.avg_clv)}>
                    {pct(c.avg_clv)}
                  </Td>
                  <Td align="right" mono muted>
                    {c.pct_positive == null
                      ? "—"
                      : `${(c.pct_positive * 100).toFixed(0)}%`}
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </DataTable>
      </Section>

      <Section
        eyebrow="reference"
        title={
          <span className="inline-flex items-center gap-2">
            <Info className="size-4 text-sky-400/80" /> Interpretation guide
          </span>
        }
      >
        <DataTable>
          <THead>
            <Tr>
              <Th>30-day avg CLV</Th>
              <Th>n</Th>
              <Th>Interpretation</Th>
            </Tr>
          </THead>
          <TBody>
            {INTERPRETATION.map((i) => (
              <Tr key={i.range}>
                <Td>
                  <Badge variant={i.tone} mono>
                    {i.range}
                  </Badge>
                </Td>
                <Td muted mono>{i.n}</Td>
                <Td>{i.note}</Td>
              </Tr>
            ))}
          </TBody>
        </DataTable>
      </Section>
    </>
  );
}
