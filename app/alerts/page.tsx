import { Bell, Lock } from "lucide-react";

import { AlertsManager } from "@/components/alerts/alerts-manager";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader, Section } from "@/components/ui/section";
import { listSubscriptionsForUser, listAlertLog } from "@/lib/alerts";
import { getTrialState } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const trial = await getTrialState();

  // Verified-or-admin only. In-trial users see the gate; expired and
  // guest are handled by the layout / middleware before reaching here.
  if (
    trial.kind !== "verified" &&
    trial.kind !== "admin"
  ) {
    return (
      <>
        <PageHeader
          eyebrow="alerts"
          title={
            <span className="inline-flex items-center gap-2">
              <Bell className="size-5 text-orange-300" />
              Email alerts
            </span>
          }
          description="Get notified the moment a +EV signal matches your criteria."
        />
        <Card>
          <CardBody className="flex items-center gap-3">
            <Lock className="size-5 text-amber-400" />
            <div>
              <div className="font-semibold text-zinc-100">
                Awaiting admin verification
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                Email alerts unlock once an admin verifies your account.
                You&apos;ll keep dashboard access during the 12-hour trial in
                the meantime.
              </p>
            </div>
          </CardBody>
        </Card>
      </>
    );
  }

  const userId = trial.user.id;
  const [subs, log] = await Promise.all([
    listSubscriptionsForUser(userId),
    listAlertLog(userId, 30),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="alerts"
        title={
          <span className="inline-flex items-center gap-2">
            <Bell className="size-5 text-orange-300" />
            Email alerts
          </span>
        }
        description="Get an email the moment a Kalshi signal matches your trigger criteria. Cooldown prevents flooding when an edge persists across multiple poll cycles."
      />

      <Section eyebrow="your subscriptions" title="Triggers">
        <Card>
          <CardBody>
            <AlertsManager initial={subs} userEmail={trial.user.email} />
          </CardBody>
        </Card>
      </Section>

      {log.length > 0 && (
        <Section
          eyebrow="last 30"
          title="Recent sends"
          description="Successful sends and failures across all your subscriptions."
        >
          <Card>
            <CardBody>
              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                <table className="min-w-full text-xs">
                  <thead className="bg-zinc-900/60 text-[10px] uppercase tracking-[0.16em] text-zinc-300">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">When</th>
                      <th className="px-3 py-2 text-left font-medium">Subscription</th>
                      <th className="px-3 py-2 text-left font-medium">Signal</th>
                      <th className="px-3 py-2 text-left font-medium">To</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {log.map((row) => (
                      <tr key={row.id} className="hover:bg-zinc-900/40">
                        <td className="px-3 py-2 text-zinc-400">{row.sent_at}</td>
                        <td className="px-3 py-2 text-zinc-100">
                          {row.subscription_name ?? `#${row.subscription_id}`}
                        </td>
                        <td className="px-3 py-2 font-mono text-zinc-300">
                          #{row.signal_id}
                        </td>
                        <td className="px-3 py-2 text-zinc-300">
                          {row.sent_to_email ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          {row.error ? (
                            <span
                              className="text-rose-300"
                              title={row.error}
                            >
                              failed
                            </span>
                          ) : (
                            <span className="text-emerald-300">sent</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </Section>
      )}
    </>
  );
}
