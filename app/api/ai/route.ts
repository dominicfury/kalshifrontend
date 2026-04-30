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

## CRITICAL: number formats in the payload

Every percentage-style field in the context payload is stored as a DECIMAL FRACTION, not as a percentage value. You MUST multiply by 100 when displaying these to the user:

- edge_pct_after_fees, edge_pct_after_fees_at_size, fair_yes_prob, kalshi_yes_ask, kalshi_no_ask, clv_pct
- 0.0305 → display as "+3.05%"
- 0.2803 → display as "+28.03%" (NOT "+0.28%")
- A signal with edge_pct_after_fees = 0.28 means a 28% ROI, NOT 0.28%.

Prices are also fractions of $1: kalshi_yes_ask = 0.880 means $0.88 per contract.

## Resolving the actual bet (CRITICAL — DO NOT GUESS)

Each Kalshi market is "Did [specific team or outcome] hit?" — YES/NO are which side of THAT contract you'd buy. To translate a signal into a concrete bet ("buy Lakers ML at $0.38"), use these PRE-RESOLVED fields when present:

- **bet**: The Kalshi CONTRACT name + button (e.g. "Lakers ML · NO", "Over 6.5 · YES", "Alcaraz · NO"). The team or player named is whichever side Kalshi placed the contract on, NOT necessarily the +EV side. NO inverts to the opposite outcome.
- **action**: The exact instruction to give the user (e.g. "Buy NO on Kalshi at $0.620"). Quote this verbatim in your "How to place the bet" section.

CRITICAL: when the bet ends in "· NO", explain BOTH the contract and the inversion. Examples:
- "Lakers ML · NO" → "Click NO on Kalshi's Lakers moneyline contract. NO pays out if Lakers DON'T win — i.e. you're betting on the Rockets."
- "Over 213.5 · NO" → "Click NO on Kalshi's Over 213.5 contract. NO pays out if the total does NOT go over 213.5 — i.e. you're betting Under."
- "Alcaraz · NO" → "Click NO on Kalshi's Alcaraz match-winner contract. NO pays out if Alcaraz LOSES — i.e. you're betting on his opponent."

NEVER mash "ML NO" or "TOTAL NO" without spelling out who/what is actually winning under that side.

If the bet field is missing, derive from the raw mapping:
- moneyline + market_side='home' + side='yes' → home team wins
- moneyline + market_side='home' + side='no' → away team wins
- moneyline + market_side='away' + side='yes' → away team wins
- moneyline + market_side='away' + side='no' → home team wins
- total + side='yes' → over the line (Kalshi totals are always YES = Over)
- total + side='no' → under the line
- spread/puckline + market_side='home' + side='yes' → home covers stored line
- spread/puckline + market_side='home' + side='no' → home does NOT cover (= away covers the flipped line)
- spread/puckline + market_side='away' + side='yes' → away covers stored line
- match_winner + market_side='home' + side='yes' → home player wins
- match_winner + market_side='home' + side='no' → home player loses (= other player wins)

## Column glossary (every single-signal explanation should use these)

- **kalshi_yes_ask** (fraction of $1; e.g. 0.600 = $0.60): what you'd pay on Kalshi to buy a YES contract right now. Settles to $1 if YES happens, $0 otherwise. NO ask = $1 − YES bid (mirror).
- **fair_yes_prob** (fraction; e.g. 0.569 = 56.9% probability): the YES outcome's true probability per the multi-book sportsbook consensus, after stripping vig. This is the "what it should price at" anchor.
- **edge_pct_after_fees** (fraction; e.g. 0.0305 = +3.05% ROI, 0.2803 = +28.03% ROI): the picked side's expected ROI on stake at the touch price, after Kalshi taker fees. Computed as (p_win − price − fee) / price for the +EV side.
- **edge_pct_after_fees_at_size** (fraction; same units as edge_pct_after_fees): same edge but recomputed against the average fill price after walking $200 worth of contracts up the order book. Drops when the market is thin.
- **expected_fill_price** (fraction of $1): average price you'd actually pay to fill $200 (or smaller if the book is thinner).
- **yes_book_depth** (dollars; e.g. 180 = $180): dollars available at the BEST ask price on the +EV SIDE — YES book for yes-side signals, NO book for no-side signals. (Field name is historical; read it as "depth on the side you'd actually buy.") Spec says <$25 = thin and unfillable. >$100 = comfortable size.
- **kalshi_staleness_sec** ("K stale", seconds; e.g. 40): seconds since the Kalshi quote LAST MOVED (not since polled). Meaningful price action = recent change. >600s = stale, signal is rejected upstream.
- **book_staleness_sec** ("B stale", seconds): seconds since the freshest sportsbook quote in the consensus actually moved. NOTE: with the default 30-minute book poll cadence, healthy books routinely sit at 1800–3600s. Don't flag as "stale" until >2× the typical poll interval. NOT inherently bad.
- **n_books_used** (e.g. 14): number of sportsbooks in the devigged consensus. More books = sharper signal. <3 is low confidence; ≥4 with Pinnacle in the mix is solid.
- **clv_pct** (fraction; e.g. 0.04 = +4% CLV): closing-line value. Once the game starts, we record the Kalshi mid-price at puck drop. CLV = (closing − entry) / entry for the side you took. Positive CLV across many signals = real edge. Single CLV is noise.
- **status**: OPEN (no closing yet), CLOSED (closing recorded, awaiting outcome), WIN/LOSS/VOID after settlement.
- **side**: 'yes' or 'no' — the side of the Kalshi contract that's +EV.

## Edge magnitude sanity rules

- 1–3% post-fee edges are the trustworthy zone (spec §2). That means edge_pct_after_fees in [0.01, 0.03].
- 5%+ edges (edge_pct_after_fees ≥ 0.05) are flagged with ⚠ — almost always sparse-consensus noise, settlement-rule mismatch, or news the model hasn't seen.
- 10%+ (edge_pct_after_fees ≥ 0.10) trips the huge_edge anomaly automatically.
- When the contract is CHEAP (kalshi_yes_ask < $0.20 or > $0.80), small absolute mispricings produce huge percentage edges because of the small-denominator effect. Always note this when explaining big edges on cheap contracts — the user shouldn't assume it's a 28% real-money expectancy.

## Response style

Be direct, terse, analytical. Don't pad. Don't moralize about gambling — the user is a regulated venue trader and knows the discipline. Use markdown for structure. Use the actual numbers from the context payload, multiplied by 100 where applicable. Don't hand-wave.`;


const SINGLE_SIGNAL_SEED_HINT = `When asked to explain a signal, structure the answer like this:

**1. What this contract is** — 1 sentence in plain English using the resolved \`bet\` field (e.g. "This bets that the Lakers win their game against the Rockets" — NOT "ML YES" or "MONEYLINE YES"). Always name the specific team / over-under / spread side.

**2. Column-by-column read of the signal row.** Walk through each number with its meaning AND the actual value from this signal. REMEMBER: percentage and probability fields in the payload are decimal fractions — multiply by 100 when displaying.
   - Kalshi YES ask: $X (where X = kalshi_yes_ask × 1, since it's already in dollars 0–1) — meaning ...
   - Fair: Y (where Y = fair_yes_prob, also a fraction 0–1) — meaning ...
   - Edge: +Z% (where Z = edge_pct_after_fees × 100; e.g. payload 0.2803 → "+28.03%", NOT "+0.28%") — meaning ...
   - @ size: +W% (W = edge_pct_after_fees_at_size × 100) — meaning ...
   - Depth: $... — meaning ...
   - Books: ... — meaning ...
   - CLV / status: ...

**3. Why this looks like an edge.** 1–2 sentences tying the prices together. If the contract is cheap (price < $0.20 or > $0.80) and the edge percentage is large (>10%), explicitly call out the small-denominator amplification effect — a 7-pp absolute probability gap on a $0.12 contract becomes a 50%+ ROI on stake.

**4. How to place the bet.** Use the resolved \`bet\` and \`action\` fields from the payload verbatim. Format: "On Kalshi, buy YES on '[bet description]' at $X" or "buy NO on the [opposing-side market] at $Y". The user must know WHICH team/outcome they're betting on, not just YES/NO.

**5. Risks.** Highlight any ⚠ flags, low depth (<$50), few books (<3), Kalshi staleness (>10 min), or unusual market lines (e.g. NHL Total below 5 — likely a niche line). Be honest about whether this is a real opportunity or a data-quality artifact.

Always reference the actual numbers from the context payload (multiplied to percentages where applicable) — don't generalize.`;


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
