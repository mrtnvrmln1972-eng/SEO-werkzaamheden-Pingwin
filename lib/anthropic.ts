// Dunne Claude-client via fetch (geen SDK). Vereist ANTHROPIC_API_KEY in Vercel.

export type ChatMsg = { role: "user" | "assistant"; content: string };

// Verbruik-context: welke klant + welke actie, zodat we het Claude-verbruik per
// klant kunnen optellen. Optioneel: zonder context wordt er niets gemeten.
export type UsageCtx = { slug?: string; action: string };

const MODEL = "claude-sonnet-4-6";

// Meet het tokengebruik van één of meer Claude-antwoorden. Faalt stil: meten mag
// de chat nooit breken (logUsage vangt zelf ook fouten af).
async function logClaudeUsage(ctx: UsageCtx | undefined, usage: { input_tokens?: number; output_tokens?: number } | undefined) {
  if (!ctx) return;
  try {
    const { logUsage } = await import("./usage");
    await logUsage({ slug: ctx.slug, service: "anthropic", action: ctx.action, model: MODEL, tokensIn: usage?.input_tokens || 0, tokensOut: usage?.output_tokens || 0 });
  } catch { /* stil: meting mag de chat niet breken */ }
}

export function anthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function callClaude(system: string, messages: ChatMsg[], maxTokens = 1800, ctx?: UsageCtx): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY ontbreekt (voeg hem toe in Vercel om de chat te gebruiken).");
  // Harde time-out: hangt de Claude-API, dan gooit dit een fout i.p.v. eindeloos te
  // blijven wachten (voorkomt vastlopende achtergrond-runs).
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 300000);
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("Claude reageerde niet binnen de tijdslimiet (time-out).");
    throw e;
  } finally { clearTimeout(timer); }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Claude-fout ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  await logClaudeUsage(ctx, j.usage);
  return (j.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
}

// ── Agentische variant: Claude mag tools aanroepen (bv. Ahrefs) ──
export type ToolDef = { name: string; description: string; input_schema: Record<string, unknown> };
export type ToolRunner = (name: string, input: Record<string, unknown>) => Promise<string>;

type Block = { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> };

export async function callClaudeAgentic(system: string, messages: ChatMsg[], tools: ToolDef[], run: ToolRunner, maxRounds = 6, maxTokens = 2200, ctx?: UsageCtx): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY ontbreekt (voeg hem toe in Vercel).");
  const apiMessages: { role: string; content: unknown }[] = messages.map((m) => ({ role: m.role, content: m.content }));
  let uIn = 0, uOut = 0; // tokens optellen over alle rondes van dit gesprek

  async function call(withTools: boolean) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key as string, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: apiMessages, ...(withTools ? { tools } : {}) }),
    });
    if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`Claude-fout ${res.status}: ${t.slice(0, 300)}`); }
    return res.json();
  }

  for (let round = 0; round < maxRounds; round++) {
    const j = await call(true);
    uIn += j.usage?.input_tokens || 0; uOut += j.usage?.output_tokens || 0;
    const content: Block[] = j.content || [];
    const toolUses = content.filter((c) => c.type === "tool_use");
    if (j.stop_reason !== "tool_use" || toolUses.length === 0) {
      await logClaudeUsage(ctx, { input_tokens: uIn, output_tokens: uOut });
      return content.filter((c) => c.type === "text").map((c) => c.text || "").join("");
    }
    apiMessages.push({ role: "assistant", content });
    // Tools binnen deze ronde parallel uitvoeren (scheelt veel wachttijd).
    const results = await Promise.all(toolUses.map(async (tu) => {
      let out: string;
      try { out = await run(tu.name || "", tu.input || {}); } catch (e) { out = "Fout: " + (e as Error).message; }
      return { type: "tool_result", tool_use_id: tu.id, content: out.slice(0, 6000) };
    }));
    apiMessages.push({ role: "user", content: results });
  }
  // Rondes op: forceer een tekstantwoord zonder tools.
  const j = await call(false);
  uIn += j.usage?.input_tokens || 0; uOut += j.usage?.output_tokens || 0;
  await logClaudeUsage(ctx, { input_tokens: uIn, output_tokens: uOut });
  return ((j.content || []) as Block[]).filter((c) => c.type === "text").map((c) => c.text || "").join("") || "(geen antwoord)";
}
