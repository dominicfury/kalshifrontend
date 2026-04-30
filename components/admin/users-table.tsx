"use client";

import {
  BadgeCheck,
  Ban,
  Check,
  Loader2,
  ShieldQuestion,
  UserCog,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

interface UserRow {
  id: number;
  username: string;
  email: string | null;
  role: "user" | "admin";
  ai_quota_daily: number;
  repoll_quota_daily: number;
  disabled: boolean;
  last_login_at: string | null;
  created_at: string;
  email_verified: boolean;
  signup_method: "admin" | "self";
  verified: boolean;
  verified_at: string | null;
  verified_by: number | null;
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const t = Date.parse(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  if (Number.isNaN(t)) return iso;
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}

export function UsersTable({ initial }: { initial: UserRow[] }) {
  const [users, setUsers] = useState<UserRow[]>(initial);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  async function patch(id: number, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const r = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data?.error || `HTTP ${r.status}`);
        return;
      }
      setUsers((u) => u.map((x) => (x.id === id ? data.user : x)));
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function changeQuota(u: UserRow) {
    const next = window.prompt(
      `Daily AI quota for ${u.username} (current: ${u.ai_quota_daily}, 0 = use global default)`,
      String(u.ai_quota_daily),
    );
    if (next == null) return;
    const n = Number(next);
    if (!Number.isFinite(n) || n < 0) return;
    await patch(u.id, { action: "update", ai_quota_daily: n });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">
          {users.length} user{users.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-zinc-100 hover:bg-zinc-800"
        >
          <UserPlus className="size-3.5" />
          {showCreate ? "Cancel" : "Create user"}
        </button>
      </div>

      {showCreate && (
        <CreateUserForm
          onCreated={(u) => {
            setUsers((list) => [...list, u]);
            setShowCreate(false);
            router.refresh();
          }}
          onError={setError}
        />
      )}

      {error && (
        <div className="rounded-md border border-rose-900/60 bg-rose-950/40 p-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-900/60 text-[10px] uppercase tracking-[0.16em] text-zinc-300">
            <tr>
              <th className="px-3 py-2 text-left font-medium">User</th>
              <th className="px-3 py-2 text-left font-medium">Role</th>
              <th className="px-3 py-2 text-left font-medium">Email</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">AI / day</th>
              <th className="px-3 py-2 text-left font-medium">Last login</th>
              <th className="px-3 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {users.map((u) => {
              const isBusy = busyId === u.id;
              return (
                <tr key={u.id} className="hover:bg-zinc-900/40">
                  <td className="px-3 py-2">
                    <div className="font-mono text-zinc-100">{u.username}</div>
                    <div className="text-[10px] text-zinc-500">
                      {u.signup_method === "self" ? "self-signup" : "admin-created"}
                      {" · "}
                      {ago(u.created_at)}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {u.role === "admin" ? (
                      <Badge variant="info" mono>ADMIN</Badge>
                    ) : (
                      <Badge variant="muted" mono>USER</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-300">
                    {u.email ?? <span className="text-zinc-600">—</span>}
                    {u.email && !u.email_verified && (
                      <span className="ml-1 text-[10px] text-amber-300">unverified</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {u.disabled ? (
                      <Badge variant="negative" mono>DISABLED</Badge>
                    ) : u.role === "admin" || u.verified ? (
                      <Badge variant="positive" mono>
                        <Check className="size-3" /> VERIFIED
                      </Badge>
                    ) : (
                      <Badge variant="warning" mono>
                        <ShieldQuestion className="size-3" /> PENDING
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-200">
                    {u.role === "admin" ? "∞" : u.ai_quota_daily > 0 ? u.ai_quota_daily : "default"}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{ago(u.last_login_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {!u.verified && u.role !== "admin" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => patch(u.id, { action: "verify" })}
                          title="Approve this user (extends access past the 12h trial)"
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md bg-emerald-600/80 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500",
                            "disabled:cursor-not-allowed disabled:opacity-60",
                          )}
                        >
                          {isBusy ? <Loader2 className="size-3 animate-spin" /> : <BadgeCheck className="size-3" />}
                          Verify
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => changeQuota(u)}
                        title="Change AI quota / day"
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-zinc-100 hover:bg-zinc-800 disabled:opacity-60"
                      >
                        <UserCog className="size-3" />
                        Quota
                      </button>
                      {!u.disabled && u.role !== "admin" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => patch(u.id, { action: "disable" })}
                          title="Disable this user"
                          className="inline-flex items-center gap-1 rounded-md border border-rose-900/60 bg-rose-950/30 px-2 py-1 text-[10px] font-semibold text-rose-200 hover:bg-rose-950/50 disabled:opacity-60"
                        >
                          <Ban className="size-3" />
                          Disable
                        </button>
                      )}
                      {u.disabled && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => patch(u.id, { action: "enable" })}
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-zinc-100 hover:bg-zinc-800 disabled:opacity-60"
                        >
                          Enable
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function CreateUserForm({
  onCreated,
  onError,
}: {
  onCreated: (u: UserRow) => void;
  onError: (e: string | null) => void;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email: email || null, password, role }),
        cache: "no-store",
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        onError(data?.error || `HTTP ${r.status}`);
        return;
      }
      onCreated(data.user);
      setUsername("");
      setEmail("");
      setPassword("");
      setRole("user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 sm:grid-cols-5"
    >
      <input
        required
        minLength={3}
        maxLength={32}
        pattern="[a-zA-Z0-9_-]+"
        placeholder="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100"
      />
      <input
        type="email"
        placeholder="email (optional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100"
      />
      <input
        required
        type="password"
        minLength={8}
        placeholder="password (≥8)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value === "admin" ? "admin" : "user")}
        className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100"
      >
        <option value="user">user</option>
        <option value="admin">admin</option>
      </select>
      <button
        type="submit"
        disabled={busy || !username || !password}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
          "bg-orange-500 text-white hover:bg-orange-400",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
        Create
      </button>
    </form>
  );
}
