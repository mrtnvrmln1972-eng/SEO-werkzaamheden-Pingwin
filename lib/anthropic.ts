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
