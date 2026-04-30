import { listActivity } from "@/lib/users";

const ACTION_LABEL: Record<string, string> = {
  login: "login",
  login_failed: "login failed",
  logout: "logout",
  ai_chat: "AI chat",
  ai_quota_blocked: "AI quota blocked",
  repoll: "manual repoll",
  repoll_quota_blocked: "repoll blocked",
};

const ACTION_TONE: Record<string, string> = {
  login: "text-emerald-300",
  login_failed: "text-rose-300",
  logout: "text-zinc-400",
  ai_chat: "text-orange-300",
  ai_quota_blocked: "text-amber-300",
  repoll: "text-orange-300",
  repoll_quota_blocked: "text-amber-300",
};

function ago(iso: string): string {
  const t = Date.parse(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  if (Number.isNaN(t)) return iso;
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}

export async function ActivityCard() {
  const rows = await listActivity({ limit: 100 });
  if (!rows.length) {
    return (
      <p className="text-xs text-zinc-500">No activity in the last 30 days.</p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="min-w-full text-xs">
        <thead className="bg-zinc-900/60 text-[10px] uppercase tracking-[0.16em] text-zinc-300">
          <tr>
            <th className="px-3 py-2 text-left font-medium">When</th>
            <th className="px-3 py-2 text-left font-medium">User</th>
            <th className="px-3 py-2 text-left font-medium">Action</th>
            <th className="px-3 py-2 text-left font-medium">IP</th>
            <th className="px-3 py-2 text-left font-medium">Detail</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.map((r) => {
            let detail = "";
            if (r.metadata_json) {
              try {
                const obj = JSON.parse(r.metadata_json);
                detail = Object.entries(obj)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(" · ");
              } catch {
                detail = r.metadata_json.slice(0, 80);
              }
            }
            return (
              <tr key={r.id} className="hover:bg-zinc-900/40">
                <td className="px-3 py-2 text-zinc-400">{ago(r.created_at)}</td>
                <td className="px-3 py-2 font-mono text-zinc-100">{r.username}</td>
                <td className={`px-3 py-2 font-mono ${ACTION_TONE[r.action] ?? ""}`}>
                  {ACTION_LABEL[r.action] ?? r.action}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-500">
                  {r.ip ?? <span className="text-zinc-700">—</span>}
                </td>
                <td className="px-3 py-2 text-zinc-400">{detail}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
