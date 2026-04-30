import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { getInt, KNOWN_KEYS } from "@/lib/system-config";
import {
  countActivityToday,
  findUserById,
  logActivity,
} from "@/lib/users";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: Message[];
  context?: {
    type: "single_signal" | "all_signals";
    payload: unknown;
  };
}

const SYSTEM_PROMPT = `You are an assistant inside a Kalshi +EV trading dashboard. The user trades on Kalshi (a CFTC-regulated peer-to-peer prediction exchange) — they CANNOT bet on sportsbooks. Sportsbook odds are used only as a fair-value oracle.

Each "signal" is a Kalshi contract whose price diverges from multi-book sportsbook consensus by enough to suggest a +EV opportunity, AFTER fees.

## Column glossary (every single-signal explanation should use these)

- **kalshi_yes_ask** (e.g. 0.600): what you'd pay on Kalshi to buy a YES contract right now. Settles to $1 if YES happens, $0 otherwise. NO ask = $1 - YES bid (mirror).
- **fair_yes_prob** (e.g. 0.569): the YES outcome's true probability per the multi-book sportsbook consensus, after stripping vig. This is the "what it should price at" anchor.
- **edge_pct_after_fees** (e.g. +3.05%): the picked side's expected ROI at the touch price, after Kalshi taker fees. Computed as (fair_prob × payout − price − fees) / price for the +EV side.
- **edge_pct_after_fees_at_size** (e.g. +3.05%): same edge but recomputed against the average fill price after walking $200 worth of contracts up the order book. Drops when the market is thin.
- **expected_fill_price**: the average price you'd actually pay to fill $200 (or smaller if the book is thinner).
- **yes_book_depth** (e.g. $180): dollars available at the BEST ask price on Kalshi. Spec says <$25 = thin and unfillable. >$100 = comfortable size.
- **kalshi_staleness_sec** ("K stale", e.g. 40s): seconds since the Kalshi quote LAST MOVED (not since polled). Meaningful price action = recent change. Long stale = no one trading = price might be wrong.
- **book_staleness_sec** ("B stale", e.g. 14s): seconds since the freshest sportsbook quote in the consensus moved. <60s is healthy. >90s blocks alerts (per spec).
- **n_books_used** (e.g. 14): number of sportsbooks in the devigged consensus. More books = sharper signal. Spec requires ≥2 to alert; <3 is low confidence.
- **clv_pct**: closing-line value. Once the game starts, we record the Kalshi mid-price at puck drop. CLV = (closing − entry) / entry for the side you took. Positive CLV across many signals = real edge. Single CLV is noise.
- **status**: OPEN (no closing yet), CLOSED (closing recorded, awaiting outcome), WIN/LOSS/VOID after settlement.
- **side**: YES or NO — the side of the Kalshi contract that's +EV. The Buy button takes you straight to that side.

## Edge magnitude sanity rules

- 1-3% post-fee edges are the trustworthy zone (spec §2).
- 5%+ edges are flagged with ⚠ — almost always stale data, matcher bug, or news the model hasn't seen.
- 10%+ trips the huge_edge anomaly automatically.

## Response style

Be direct, terse, analytical. Don't pad. Don't moralize about gambling — the user is a regulated venue trader and knows the discipline. Use markdown for structure. Use the actual numbers from the context payload, don't hand-wave.`;


const SINGLE_SIGNAL_SEED_HINT = `When asked to explain a signal, structure the answer like this:

**1. What this contract is** — 1 sentence in plain English about what's being bet.

**2. Column-by-column read of the signal row.** Walk through each number with its meaning AND the actual value from this signal:
   - Kalshi YES ask: $X — meaning ...
   - Fair: Y — meaning ...
   - Edge: +Z% — meaning ...
   - @ size: ... — meaning ...
   - Depth: $... — meaning ...
   - K stale / B stale: ... — meaning ...
   - Books: ... — meaning ...
   - CLV / status: ...

**3. Why this looks like an edge.** 1-2 sentences tying the prices together.

**4. How to place the bet.** Buy YES at $X (or Buy NO at $Y) on Kalshi. Mention the side suggested by the signal and current ask.

**5. Risks.** Highlight any ⚠ flags, low depth, few books, suspect staleness, or other reasons to skip. Be honest.

Always reference the actual numbers from the context payload — don't generalize.`;


export async function POST(req: Request): Promise<NextResponse> {
  // Auth + per-user daily quota. Admins are unlimited; everyone else
  // gets the user-row's ai_quota_daily (which falls back to the global
  // default in system_config). Quota window is per UTC calendar day.
  const claims = await getCurrentUser();
  if (!claims) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  if (claims.role !== "admin") {
    const user = await findUserById(claims.sub);
    if (!user || user.disabled) {
      return NextResponse.json({ error: "not signed in" }, { status: 401 });
    }
    const defaultQuota = await getInt(KNOWN_KEYS.DEFAULT_AI_QUOTA_DAILY, 10);
    // Per-user override on the user row beats the global default.
    const quota = user.ai_quota_daily > 0 ? user.ai_quota_daily : defaultQuota;
    const usedToday = await countActivityToday(claims.sub, "ai_chat");
    if (usedToday >= quota) {
      try {
        await logActivity({
          user_id: claims.sub,
          action: "ai_quota_blocked",
          metadata: { used: usedToday, quota },
        });
      } catch {
        /* noop */
      }
      return NextResponse.json(
        {
          error: `daily AI limit reached (${usedToday}/${quota}). Resets at 00:00 UTC.`,
          used: usedToday,
          quota,
        },
        { status: 429 },
      );
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "OPENAI_API_KEY is not set in the environment.",
      },
      { status: 500 },
    );
  }

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];

  // Single-signal contexts get an additional response-structure guide so
  // the model walks every column instead of summarizing.
  if (body.context?.type === "single_signal") {
    messages.push({ role: "system", content: SINGLE_SIGNAL_SEED_HINT });
  }

  // Inject the signal context as an additional system message so it's
  // available for follow-up questions without re-sending each turn.
  if (body.context) {
    messages.push({
      role: "system",
      content: `Signal context (${body.context.type}):\n${JSON.stringify(body.context.payload, null, 2)}`,
    });
  }

  for (const m of body.messages || []) {
    if (m.role === "user" || m.role === "assistant") {
      messages.push({ role: m.role, content: String(m.content) });
    }
  }

  if (messages.length === (body.context ? 2 : 1)) {
    return NextResponse.json({ error: "no user message" }, { status: 400 });
  }

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.3,
        max_tokens: 800,
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json(
        { error: `OpenAI ${r.status}: ${text.slice(0, 300)}` },
        { status: 502 },
      );
    }
    const data = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "(empty response)";
    // Log a successful AI request for quota accounting + admin visibility.
    try {
      await logActivity({
        user_id: claims.sub,
        action: "ai_chat",
        metadata: { context_type: body.context?.type ?? null },
      });
    } catch {
      /* noop */
    }
    return NextResponse.json({ message: content });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
