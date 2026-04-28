import { NextResponse } from "next/server";

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

const SYSTEM_PROMPT = `You are an assistant inside a Kalshi NHL +EV trading dashboard. The user trades on Kalshi (a CFTC-regulated peer-to-peer prediction exchange) — they CANNOT bet on sportsbooks. Sportsbook odds are used only as a fair-value oracle.

Each "signal" is a Kalshi contract whose price diverges from multi-book sportsbook consensus by enough to suggest a +EV opportunity, AFTER fees.

Key terminology:
- "Yes ask" / "No ask": the Kalshi price (in dollars) the user would pay to buy that side. Both sum to ~$1.00.
- "Fair": the sportsbook consensus probability of the YES outcome, devigged across multiple books.
- "Edge": (fair - kalshi_price) / kalshi_price for whichever side is +EV, after Kalshi taker fees.
- "@ size": edge after walking the Kalshi order book to a $200 fill — the actual edge you'd realize at that size.
- "CLV": closing line value — how the market priced this contract at puck drop vs. the user's entry. CLV is the truth signal; P&L is variance.
- "K stale" / "B stale": seconds since the Kalshi / sportsbook side last moved. High staleness means the data may be wrong.
- "Books": number of sportsbooks contributing to the consensus.

Edge magnitude sanity rules (from the project spec):
- 1-3% post-fee edges are the trustworthy zone.
- 5%+ edges are flagged with ⚠ — almost always stale data, matcher bug, or news the model hasn't seen.
- 10%+ trips the huge_edge anomaly.

When asked to explain a signal, give a 3-5 sentence answer covering:
1. What the contract resolves to (in plain English)
2. Why this looks like an edge (Kalshi price vs fair)
3. How to actually place the bet on Kalshi (Buy YES at ~$X, or Buy NO at ~$Y)
4. The biggest risk / reason to be skeptical (e.g. ⚠ flag, low book depth, few books, late news)
5. Quarter-Kelly suggested bankroll fraction if applicable, but never specific dollar amounts unless the user gives a bankroll.

Be direct, terse, and analytical. Don't pad. Don't moralize about gambling — the user is a regulated venue trader and knows the discipline.`;


export async function POST(req: Request): Promise<NextResponse> {
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
    return NextResponse.json({ message: content });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
