"use client";

import { Loader2, Mail, UserPlus } from "lucide-react";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "invisible";
        },
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

type Stage =
  | { kind: "form" }
  | { kind: "code"; user_id: number; warning?: string }
  | { kind: "done" };

export function SignupForm({ turnstileSiteKey }: { turnstileSiteKey: string }) {
  const [stage, setStage] = useState<Stage>({ kind: "form" });
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Render the Turnstile widget once the script + container are ready.
  useEffect(() => {
    if (stage.kind !== "form") return;
    if (!turnstileSiteKey) return;
    const tryRender = () => {
      if (!window.turnstile || !widgetRef.current) return false;
      if (widgetIdRef.current) return true;
      widgetIdRef.current = window.turnstile.render(widgetRef.current, {
        sitekey: turnstileSiteKey,
        theme: "dark",
        callback: (t) => setCaptchaToken(t),
        "expired-callback": () => setCaptchaToken(null),
        "error-callback": () => setCaptchaToken(null),
      });
      return true;
    };
    if (!tryRender()) {
      const id = setInterval(() => {
        if (tryRender()) clearInterval(id);
      }, 200);
      return () => clearInterval(id);
    }
  }, [stage.kind, turnstileSiteKey]);

  async function submitSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          password,
          captcha_token: captchaToken,
        }),
        cache: "no-store",
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body?.error || `HTTP ${r.status}`);
        if (window.turnstile && widgetIdRef.current) {
          window.turnstile.reset(widgetIdRef.current);
          setCaptchaToken(null);
        }
        return;
      }
      setStage({ kind: "code", user_id: body.user_id, warning: body.warning });
    } catch (e) {
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (stage.kind !== "code") return;
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: stage.user_id, code }),
        cache: "no-store",
      });
      const body = await r.json().catch(() => ({}));
      // 409 "email already verified" means a previous attempt succeeded
      // server-side (e.g. cookie-set failed but email_verified flipped).
      // Treat it as success — push the user to /login.
      if (r.status === 409 && body?.error?.toString().includes("already verified")) {
        window.location.href = "/login?verified=1";
        return;
      }
      if (!r.ok) {
        setError(body?.error || `HTTP ${r.status}`);
        return;
      }
      // If the verify endpoint couldn't set the cookie (e.g. JWT_SECRET
      // misconfigured), it returns ok=true with needs_login=true. Bounce
      // them to /login instead of dashboard.
      if (body?.needs_login) {
        window.location.href = "/login?verified=1";
        return;
      }
      // Cookie is set by the verify endpoint. Hard-navigate so middleware
      // re-evaluates and the layout fetches the now-logged-in user state.
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (stage.kind !== "code") return;
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: stage.user_id, resend: true }),
        cache: "no-store",
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body?.error || `HTTP ${r.status}`);
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  if (stage.kind === "code") {
    return (
      <div className="space-y-4 rounded-xl border border-zinc-700 bg-zinc-900/60 p-6 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-2 text-sm text-zinc-200">
          <Mail className="size-4 text-orange-300" />
          Check your email
        </div>
        <p className="text-xs text-zinc-400">
          We sent a 6-digit code to <span className="text-zinc-200">{email}</span>.
          It expires in 15 minutes.
        </p>
        {stage.warning && (
          <div className="rounded-md border border-amber-900/60 bg-amber-950/40 p-2 text-xs text-amber-200">
            {stage.warning}
          </div>
        )}
        <form onSubmit={submitCode} className="space-y-3">
          <input
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-center text-2xl font-mono tracking-[0.35em] text-zinc-100 placeholder:text-zinc-700 focus:border-orange-400/60 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          />
          {error && (
            <div className="rounded-md border border-rose-900/60 bg-rose-950/40 p-2 text-xs text-rose-200">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
              "bg-orange-500 text-white hover:bg-orange-400",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Verify and continue
          </button>
        </form>
        <button
          type="button"
          onClick={resendCode}
          disabled={busy}
          className="text-xs text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline disabled:opacity-50"
        >
          Resend code
        </button>
      </div>
    );
  }

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <form
        onSubmit={submitSignup}
        className="space-y-4 rounded-xl border border-zinc-700 bg-zinc-900/60 p-6 shadow-2xl backdrop-blur"
      >
        <div className="space-y-1.5">
          <label htmlFor="username" className="text-[10px] uppercase tracking-[0.16em] text-zinc-300">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            minLength={3}
            maxLength={32}
            pattern="[a-zA-Z0-9_-]+"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-orange-400/60 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-[10px] uppercase tracking-[0.16em] text-zinc-300">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-orange-400/60 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-[10px] uppercase tracking-[0.16em] text-zinc-300">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-orange-400/60 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          />
        </div>
        <div ref={widgetRef} className="cf-turnstile" />
        {!turnstileSiteKey && (
          <div className="rounded-md border border-amber-900/60 bg-amber-950/40 p-2 text-xs text-amber-200">
            Turnstile not configured — set NEXT_PUBLIC_TURNSTILE_SITE_KEY on Vercel.
          </div>
        )}
        {error && (
          <div className="rounded-md border border-rose-900/60 bg-rose-950/40 p-2 text-xs text-rose-200">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={busy || !username || !email || !password || !captchaToken}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
            "bg-orange-500 text-white hover:bg-orange-400",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="text-center text-[11px] text-zinc-500">
          Account is reviewed by an admin within 12 hours of signup.
        </p>
      </form>
    </>
  );
}
