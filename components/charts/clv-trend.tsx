"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ClvDayPoint } from "@/lib/queries";


export default function ClvTrendChart({ data }: { data: ClvDayPoint[] }) {
  // Recharts wants numeric data; convert clv to percentage and drop nulls.
  const chartData = data.map((d) => ({
    day: d.day,
    clv: d.avg_clv == null ? null : d.avg_clv * 100,
    n: d.n,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-zinc-500">
        No CLV data yet — needs resolved signals to chart.
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
        >
          <defs>
            <linearGradient id="clv-pos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(16,185,129)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="rgb(16,185,129)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgb(39,39,42)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: "rgb(113,113,122)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            tick={{ fill: "rgb(113,113,122)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            width={48}
          />
          <ReferenceLine y={0} stroke="rgb(82,82,91)" strokeDasharray="3 3" />
          <Tooltip
            cursor={{ stroke: "rgb(82,82,91)", strokeDasharray: "2 2" }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const row = payload[0].payload as {
                day: string;
                clv: number | null;
                n: number;
              };
              return (
                <div className="rounded-md border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-xs">
                  <div className="font-mono text-zinc-400">{row.day}</div>
                  <div
                    className={`font-mono tabular-nums ${
                      row.clv == null
                        ? "text-zinc-500"
                        : row.clv >= 0
                          ? "text-emerald-300"
                          : "text-rose-300"
                    }`}
                  >
                    {row.clv == null ? "—" : `${row.clv.toFixed(2)}%`}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                    n = {row.n}
                  </div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="clv"
            stroke="rgb(16,185,129)"
            strokeWidth={2}
            fill="url(#clv-pos)"
            connectNulls
            dot={{ r: 2.5, fill: "rgb(16,185,129)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
