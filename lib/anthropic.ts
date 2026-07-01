// Dunne Claude-client via fetch (geen SDK). Vereist ANTHROPIC_API_KEY in Vercel.

export type ChatMsg = { role: "user" | "assistant"; content: string };

export function anthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function callClaude(system: string, messages: ChatMsg[], maxTokens = 1800): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY ontbreekt (voeg hem toe in Vercel om de chat te gebruiken).");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Claude-fout ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  return (j.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
}

// ── Agentische variant: Claude mag tools aanroepen (bv. Ahrefs) ──
export type ToolDef = { name: string; description: string; input_schema: Record<string, unknown> };
export type ToolRunner = (name: string, input: Record<string, unknown>) => Promise<string>;

type Block = { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> };

export async function callClaudeAgentic(system: string, messages: ChatMsg[], tools: ToolDef[], run: ToolRunner, maxRounds = 6, maxTokens = 2200): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY ontbreekt (voeg hem toe in Vercel).");
  const apiMessages: { role: string; content: unknown }[] = messages.map((m) => ({ role: m.role, content: m.content }));

  async function call(withTools: boolean) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key as string, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages: apiMessages, ...(withTools ? { tools } : {}) }),
    });
    if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`Claude-fout ${res.status}: ${t.slice(0, 300)}`); }
    return res.json();
  }

  for (let round = 0; round < maxRounds; round++) {
    const j = await call(true);
    const content: Block[] = j.content || [];
    const toolUses = content.filter((c) => c.type === "tool_use");
    if (j.stop_reason !== "tool_use" || toolUses.length === 0) {
      return content.filter((c) => c.type === "text").map((c) => c.text || "").join("");
    }
    apiMessages.push({ role: "assistant", content });
    const results = [];
    for (const tu of toolUses) {
      let out: string;
      try { out = await run(tu.name || "", tu.input || {}); } catch (e) { out = "Fout: " + (e as Error).message; }
      results.push({ type: "tool_result", tool_use_id: tu.id, content: out.slice(0, 6000) });
    }
    apiMessages.push({ role: "user", content: results });
  }
  // Rondes op: forceer een tekstantwoord zonder tools.
  const j = await call(false);
  return ((j.content || []) as Block[]).filter((c) => c.type === "text").map((c) => c.text || "").join("") || "(geen antwoord)";
}
