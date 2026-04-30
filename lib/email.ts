/**
 * Resend wrapper. Sends transactional emails (signup verification today;
 * password reset etc. later). All sends are server-side only.
 */
import "server-only";

interface SendArgs {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(args: SendArgs): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = buildFrom();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  if (!from) {
    return {
      ok: false,
      error: "MAIL_FROM_ADDRESS not configured",
    };
  }

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: args.to,
      subject: args.subject,
      text: args.text,
      ...(args.html ? { html: args.html } : {}),
    }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    return { ok: false, error: `resend ${r.status}: ${body.slice(0, 200)}` };
  }
  return { ok: true };
}

function buildFrom(): string | null {
  const addr = process.env.MAIL_FROM_ADDRESS;
  if (!addr) return null;
  const name = process.env.MAIL_FROM_NAME?.trim();
  return name ? `${name} <${addr}>` : addr;
}

/** Plain-text body for the verification code email. */
export function verificationEmail(code: string): { subject: string; text: string; html: string } {
  return {
    subject: `Your Sportsbetbrain verification code: ${code}`,
    text: [
      `Your Sportsbetbrain verification code is:`,
      ``,
      `    ${code}`,
      ``,
      `It expires in 15 minutes. If you didn't request this, ignore this email.`,
    ].join("\n"),
    html: `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0a0a0a;color:#e4e4e7;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#18181b;border:1px solid #27272a;border-radius:12px;padding:32px;">
    <h1 style="font-size:18px;margin:0 0 16px;color:#fff;">Sportsbetbrain</h1>
    <p style="margin:0 0 24px;line-height:1.5;">Use this code to confirm your email:</p>
    <div style="font-size:36px;font-weight:700;letter-spacing:8px;text-align:center;padding:16px;background:#0a0a0a;border-radius:8px;color:#fb923c;font-family:monospace;">${code}</div>
    <p style="margin:24px 0 0;font-size:12px;color:#71717a;">It expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
  </div>
</body></html>`,
  };
}
