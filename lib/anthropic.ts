// Dunne Claude-client via fetch (geen SDK). Vereist ANTHROPIC_API_KEY in Vercel.

export type ChatMsg = { role: "user" | "assistant"; content: string };

// Verbruik-context: welke klant + welke actie, zodat we het Claude-verbruik per
// klant kunnen optellen. Optioneel: zonder context wordt er niets gemeten.
export type UsageCtx = { slug?: string; action: string };

const MODEL = "claude-sonnet-4-6";
// Goedkoop model (± 3x goedkoper) voor aantoonbaar lichte taken: extractie,
// korte labels, één-regel-correcties. Kernwerk (analyse, copy, chat) blijft op MODEL.
export const LIGHT_MODEL = "claude-haiku-4-5";

// Prompt-caching: het (vaak enorme) system-prompt gaat als content-blok met een
// cache-markering mee. Bij een vervolg-aanroep binnen 5 minuten leest de API dat
// deel uit de cache tegen 10% van het normale tarief.
type Usage = { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };

function systemBlocks(system: string) {
  return [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
}

// Meet het tokengebruik van één of meer Claude-antwoorden. Faalt stil: meten mag
// de chat nooit breken (logUsage vangt zelf ook fouten af).
async function logClaudeUsage(ctx: UsageCtx | undefined, usage: Usage | undefined, model = MODEL) {
  if (!ctx) return;
  try {
    const { logUsage } = await import("./usage");
    await logUsage({
      slug: ctx.slug, service: "anthropic", action: ctx.action, model,
      tokensIn: usage?.input_tokens || 0, tokensOut: usage?.output_tokens || 0,
      cacheRead: usage?.cache_read_input_tokens || 0, cacheWrite: usage?.cache_creation_input_tokens || 0,
    });
  } catch { /* stil: meting mag de chat niet breken */ }
}

export function anthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Zelfde als callClaude, maar met Anthropic's ingebouwde websearch aan: het model
// zoekt zelf gericht op het web (max maxSearches zoekopdrachten, betaald per
// zoekopdracht) en verwerkt de resultaten in het antwoord. Voor taken waar de
// benodigde informatie buiten de eigen site ligt (bijv. bedrijfsgegevens vergaren).
export async function callClaudeWebSearch(system: string, messages: ChatMsg[], maxTokens = 2000, ctx?: UsageCtx, maxSearches = 8): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY ontbreekt (voeg hem toe in Vercel).");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 300000);
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL, max_tokens: maxTokens, system: systemBlocks(system), messages,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearches }],
      }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Claude-fout ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  await logClaudeUsage(ctx, j.usage);
  // Het antwoord kan uit meerdere blokken bestaan (zoekresultaten + tekst); wij
  // willen alleen de tekstblokken, samengevoegd.
  const text = Array.isArray(j.content) ? j.content.filter((c: { type?: string }) => c.type === "text").map((c: { text?: string }) => c.text || "").join("") : "";
  return text;
}

export async function callClaude(system: string, messages: ChatMsg[], maxTokens = 1800, ctx?: UsageCtx, model = MODEL): Promise<string> {
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
      body: JSON.stringify({ model, max_tokens: maxTokens, system: systemBlocks(system), messages }),
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
  await logClaudeUsage(ctx, j.usage, model);
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
  const u: Usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }; // optellen over alle rondes

  // Cache-markering op de laatste tool-definitie: tools + system vormen samen het
  // vaste begin van elke ronde en worden zo maar één keer vol betaald.
  const cachedTools = tools.map((t, i) => (i === tools.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t));

  // Verplaats de cache-markering naar het laatste blok van het laatste bericht,
  // zodat elke ronde de complete gespreksgeschiedenis van de vorige ronde hergebruikt.
  // Oude markeringen eerst weghalen (maximaal 4 per verzoek toegestaan).
  function markLastMessage() {
    for (const m of apiMessages) {
      if (Array.isArray(m.content)) for (const b of m.content as Record<string, unknown>[]) delete b.cache_control;
    }
    const last = apiMessages[apiMessages.length - 1];
    if (!last) return;
    if (typeof last.content === "string") last.content = [{ type: "text", text: last.content }];
    const blocks = last.content as Record<string, unknown>[];
    if (blocks.length) blocks[blocks.length - 1].cache_control = { type: "ephemeral" };
  }

  async function call(withTools: boolean) {
    markLastMessage();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key as string, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system: systemBlocks(system), messages: apiMessages, ...(withTools && tools.length ? { tools: cachedTools } : {}) }),
    });
    if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`Claude-fout ${res.status}: ${t.slice(0, 300)}`); }
    return res.json();
  }

  function addUsage(usage: Usage | undefined) {
    u.input_tokens! += usage?.input_tokens || 0;
    u.output_tokens! += usage?.output_tokens || 0;
    u.cache_read_input_tokens! += usage?.cache_read_input_tokens || 0;
    u.cache_creation_input_tokens! += usage?.cache_creation_input_tokens || 0;
  }

  for (let round = 0; round < maxRounds; round++) {
    const j = await call(true);
    addUsage(j.usage);
    const content: Block[] = j.content || [];
    const toolUses = content.filter((c) => c.type === "tool_use");
    if (j.stop_reason !== "tool_use" || toolUses.length === 0) {
      await logClaudeUsage(ctx, u);
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
  addUsage(j.usage);
  await logClaudeUsage(ctx, u);
  return ((j.content || []) as Block[]).filter((c) => c.type === "text").map((c) => c.text || "").join("") || "(geen antwoord)";
}
