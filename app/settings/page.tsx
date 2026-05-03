import {
  AlertCircle,
  CheckCircle2,
  Cog,
  Database,
  History,
  Mail,
  Network,
  Sliders,
  Sparkles,
  Users,
} from "lucide-react";

import { ActivityCard } from "@/components/admin/activity-card";
import { SystemConfigCard } from "@/components/admin/system-config-card";
import { UsersCard } from "@/components/admin/users-card";
import { AutoRefresh } from "@/components/layout/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader, Section } from "@/components/ui/section";
import { StatusDot } from "@/components/ui/status-dot";
import { ago } from "@/lib/format";
import { fetchApiStatus, type ApiStatusRow } from "@/lib/queries";

export const dynamic = "force-dynamic";


type ApiId = "kalshi" | "odds" | "openai" | "resend";

interface ApiCard {
  id: ApiId;
  name: string;
  icon: React.ReactNode;
  desc: string;
  staleAfterSec: number;          // last_success older than this = stale
  configuredHint: string;
}

const API_CARDS: ApiCard[] = [
  {
    id: "kalshi",
    name: "Kalshi",
    icon: <Network className="size-4" />,
    desc: "Market data, orderbooks, settlement results.",
    staleAfterSec: 120,
    configuredHint: "KALSHI_API_KEY_ID + KALSHI_PRIVATE_KEY_PATH on Railway",
  },
  {
    id: "odds",
    name: "Odds API",
    icon: <Database className="size-4" />,
    desc: "Multi-book sportsbook consensus (the fair-value oracle).",
    staleAfterSec: 900,             // 15 min — 10-min cadence + slack for off-phase WARM ticks
    configuredHint: "ODDS_API_KEY on Railway",
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: <Sparkles className="size-4" />,
    desc: "Powers the AI assistant on the signals page.",
    staleAfterSec: Infinity,        // not polled, only used on demand
    configuredHint: "OPENAI_API_KEY on Vercel",
  },
  {
    id: "resend",
    name: "Resend (email alerts)",
    icon: <Mail className="size-4" />,
    desc: "Email alerts. Currently disabled until CLV proves edge.",
    staleAfterSec: Infinity,
    configuredHint: "RESEND_API_KEY + ALERTS_ENABLED=true",
  },
];


function tone(card: ApiCard, row: ApiStatusRow | undefined): "ok" | "warn" | "error" | "muted" {
  if (!row) return "muted";
  if (row.last_error_at && (!row.last_success_at || row.last_error_at > row.last_success_at)) {
    return "error";
  }
  if (row.last_success_at) {
    if (card.staleAfterSec === Infinity) return "ok";
    const t = Date.parse(
      row.last_success_at.endsWith("Z") ? row.last_success_at : row.last_success_at + "Z",
    );
    if (Number.isNaN(t)) return "muted";
    const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (sec > card.staleAfterSec * 2) return "error";
    if (sec > card.staleAfterSec) return "warn";
    return "ok";
  }
  return "muted";
}


function quotaTone(used: number | null, remaining: number | null): "ok" | "warn" | "error" {
  if (remaining == null) return "ok";
  if (remaining < 50) return "error";
  if (remaining < 100) return "warn";
  return "ok";
}


export default async function SettingsPage() {
  const apiStatus = await fetchApiStatus();
  const byApi = Object.fromEntries(apiStatus.map((r) => [r.api, r])) as Record<
    string,
    ApiStatusRow | undefined
  >;

  return (
    <>
      <PageHeader
        eyebrow="System config + diagnostics"
        title="Settings"
        description="Live API health, quota usage, and recent errors. Use this page to spot when something stopped working."
        actions={<AutoRefresh intervalMs={60_000} />}
      />

      <Section
        eyebrow="admin"
        title={
          <span className="inline-flex items-center gap-2">
            <Sliders className="size-4 text-orange-300" />
            System config
          </span>
        }
        description="Runtime-editable settings. Pollers re-read these on every tick — saves take effect within one cycle without a redeploy."
      >
        <Card>
          <CardBody>
            <SystemConfigCard />
          </CardBody>
        </Card>
      </Section>

      <Section
        eyebrow="admin"
        title={
          <span className="inline-flex items-center gap-2">
            <Users className="size-4 text-orange-300" />
            Users
          </span>
        }
        description="Verify pending signups, change AI quotas, disable bad actors. Self-signed-up users get 12 hours of access; verify them here to extend permanently."
      >
        <Card>
          <CardBody>
            <UsersCard />
          </CardBody>
        </Card>
      </Section>

      <Section
        eyebrow="admin"
        title={
          <span className="inline-flex items-center gap-2">
            <History className="size-4 text-orange-300" />
            Activity log
          </span>
        }
        description="Last 100 events across all users — logins, AI usage, repolls, blocked attempts."
      >
        <Card>
          <CardBody>
            <ActivityCard />
          </CardBody>
        </Card>
      </Section>

      <Section eyebrow="upstreams" title="API status">
        <div className="grid gap-3 md:grid-cols-2">
          {API_CARDS.map((card) => {
            const row = byApi[card.id];
            const t = tone(card, row);
            return (
              <Card key={card.id}>
                <CardHeader className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                    <span className="text-zinc-300">{card.icon}</span>
                    {card.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusDot tone={t} pulse={t === "ok"} />
                    <span
                      className={`text-[10px] uppercase tracking-[0.16em] font-semibold ${
                        t === "ok"
                          ? "text-emerald-300"
                          : t === "warn"
                            ? "text-amber-300"
                            : t === "error"
                              ? "text-rose-300"
                              : "text-zinc-400"
                      }`}
                    >
                      {t === "ok"
                        ? "OK"
                        : t === "warn"
                          ? "STALE"
                          : t === "error"
                            ? "ERROR"
                            : "UNKNOWN"}
                    </span>
                  </div>
                </CardHeader>
                <CardBody className="space-y-3">
                  <div className="text-sm text-zinc-200">{card.desc}</div>

                  <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
                    <dt className="text-zinc-300">Last success</dt>
                    <dd className="text-right tabular-nums font-mono text-zinc-100">
                      {row?.last_success_at ? ago(row.last_success_at) : "never"}
                    </dd>

                    {(row?.last_error_at || row?.last_error_message) && (
                      <>
                        <dt className="text-zinc-300">Last error</dt>
                        <dd className="text-right tabular-nums font-mono text-rose-200">
                          {row?.last_error_at ? ago(row.last_error_at) : "—"}
                        </dd>
                      </>
                    )}

                    {(row?.quota_remaining != null || row?.quota_used != null) && (
                      <>
                        <dt className="text-zinc-300">Quota</dt>
                        <dd className="text-right text-xs">
                          <Badge
                            variant={
                              quotaTone(row?.quota_used ?? null, row?.quota_remaining ?? null) === "error"
                                ? "negative"
                                : quotaTone(
                                      row?.quota_used ?? null,
                                      row?.quota_remaining ?? null,
                                    ) === "warn"
                                  ? "warning"
                                  : "muted"
                            }
                            mono
                          >
                            {row?.quota_remaining ?? "?"} left
                          </Badge>
                          {row?.quota_used != null && (
                            <span className="ml-2 text-zinc-300 font-mono">
                              ({row.quota_used} used)
                            </span>
                          )}
                        </dd>
                      </>
                    )}
                  </dl>

                  {row?.last_error_message && (
                    <div className="rounded-md border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200 font-mono break-words">
                      {row.last_error_message}
                    </div>
                  )}

                  {!row && (
                    <div className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300">
                      No status recorded yet — this API hasn&apos;t been
                      called since last reset, or the status table was
                      created after its last call.
                    </div>
                  )}

                  <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                    configured via {card.configuredHint}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section
        eyebrow="reference"
        title={
          <span className="inline-flex items-center gap-2">
            <Cog className="size-4 text-orange-300" />
            Configuration values
          </span>
        }
        description="Read from the backend's environment variables. Change them in Railway (backend) or Vercel (frontend) — they live in code only as defaults."
      >
        <Card>
          <CardBody>
            <ul className="space-y-2 text-sm">
              <ConfigRow
                label="Kalshi poll interval (active)"
                value="30s"
                hint="every 30 seconds while there's an upcoming game"
              />
              <ConfigRow
                label="Sportsbook poll interval (active)"
                value="10 min default · respects Odds quota reserve"
                hint="us+eu, ~5 credits per call, sport-tier skip applies (HOT every tick, WARM every 2nd, COLD skipped)"
              />
              <ConfigRow
                label="Settlement worker"
                value="every 15 min"
                hint="records closing prices + resolves outcomes"
              />
              <ConfigRow
                label="Daily rollup"
                value="04:00 UTC"
                hint="aggregates signals into performance_rollups"
              />
              <ConfigRow
                label="Signal log threshold"
                value="≥ 0.5% edge after fees"
                hint="logs distribution; alert threshold is higher"
              />
              <ConfigRow
                label="Alert threshold"
                value="≥ 2.0% edge at $200 fill"
                hint="DISABLED until CLV validates the model"
              />
              <ConfigRow
                label="Pregame gate"
                value="event start_time > now + 15 min"
                hint="skip in-progress games (Kalshi suspends, books update — phantom edges)"
              />
              <ConfigRow
                label="Signal dedup"
                value="5 min window, 0.2pp band"
                hint="skip if same market+side recently within similar edge"
              />
              <ConfigRow
                label="Odds API quota reserve"
                value="2000 credits"
                hint="stop polling Odds when remaining < 2000 (~2% of the 100K/mo plan)"
              />
            </ul>
          </CardBody>
        </Card>
      </Section>

      <Section
        eyebrow="how to read this page"
        title="Status meanings"
      >
        <Card>
          <CardBody className="space-y-2 text-sm">
            <Row tone="ok" label="OK">
              Last successful call within the freshness window. Pulsing dot.
            </Row>
            <Row tone="warn" label="STALE">
              Last success older than expected. Probably backed off, hit
              quota, or polling is paused.
            </Row>
            <Row tone="error" label="ERROR">
              Most recent call failed. Check the message — usually 401
              (auth bad), 429 (rate limited), or 5xx (provider down).
            </Row>
            <Row tone="muted" label="UNKNOWN">
              No record yet — service hasn&apos;t been called since the
              status table was created.
            </Row>
          </CardBody>
        </Card>
      </Section>
    </>
  );
}


function ConfigRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <div>
        <div className="text-zinc-100">{label}</div>
        {hint && <div className="text-xs text-zinc-300">{hint}</div>}
      </div>
      <div className="font-mono tabular-nums text-zinc-100">{value}</div>
    </li>
  );
}


function Row({
  tone: t,
  label,
  children,
}: {
  tone: "ok" | "warn" | "error" | "muted";
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
        {t === "ok" || t === "muted" ? (
          <CheckCircle2
            className={t === "ok" ? "size-3.5 text-emerald-300" : "size-3.5 text-zinc-500"}
          />
        ) : (
          <AlertCircle
            className={t === "warn" ? "size-3.5 text-amber-300" : "size-3.5 text-rose-300"}
          />
        )}
        <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-zinc-100">
          {label}
        </span>
      </div>
      <span className="text-zinc-200">{children}</span>
    </div>
  );
}
