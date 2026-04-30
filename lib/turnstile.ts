/**
 * Cloudflare Turnstile token verification — call this from any signup
 * or write endpoint that should be guarded against bots.
 *
 * Frontend renders the Turnstile widget with NEXT_PUBLIC_TURNSTILE_SITE_KEY.
 * The widget produces a one-time token. Backend POSTs that token to
 * Cloudflare's siteverify endpoint with our secret key. Tokens are
 * single-use — verify once per request.
 */
import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  token: string | null | undefined,
  remoteip?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: false, error: "TURNSTILE_SECRET_KEY not configured" };
  }
  if (!token) {
    return { ok: false, error: "missing captcha token" };
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteip) form.set("remoteip", remoteip);

  let r: Response;
  try {
    r = await fetch(VERIFY_URL, {
      method: "POST",
      body: form,
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "verify fetch failed" };
  }

  let body: { success?: boolean; "error-codes"?: string[] };
  try {
    body = await r.json();
  } catch {
    return { ok: false, error: `siteverify returned non-JSON (HTTP ${r.status})` };
  }
  if (!body.success) {
    const codes = (body["error-codes"] || []).join(",");
    return { ok: false, error: codes ? `captcha failed: ${codes}` : "captcha failed" };
  }
  return { ok: true };
}
