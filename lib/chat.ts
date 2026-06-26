import { getClientBySlug } from "./clients";
import { getEmails, getMetrics, getKeywords, getStatus } from "./snapshots";
import { msStatus, msSearchClientEmails } from "./ms-graph";
import { googleStatus, getGscForClient } from "./google";
import { sheetCsvUrl, parseCSV, structureData, MAAND_VOLGORDE } from "./sheet";
import type { ClientConfig } from "./clients";

// ═══════════════════════════════════════════════════════════
// PROJECT-CHAT: context verzamelen + AI laten antwoorden
// ═══════════════════════════════════════════════════════════
// Verzamelt per klant alles wat het dashboard al kent (mail, stand van
// zaken, taken uit de Sheet, Search Console, Ahrefs) en stuurt dat als
// context naar Claude, zodat je vragen kunt stellen als "wat is de laatste
// stand van zaken" of "waar wachten we op bij de klant".
// Vereist env ANTHROPIC_API_KEY.
// ═══════════════════════════════════════════════════════════

export function chatConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

async function sheetTaskLines(client: ClientConfig): Promise<string[]> {
  if (!client.sheetId) return [];
  try {
    const res = await fetch(sheetCsvUrl(client.sheetId, client.gid), { cache: "no-store" });
    if (!res.ok) return [];
    const data = structureData(parseCSV(await res.text()), client.budget);
    if (!data) return [];
    const month = MAAND_VOLGORDE[new Date().getMonth()];
    return data.tasks
      .filter((t) => t.maand === month)
      .map((t) => `- ${t.taak}${t.status ? ` (status: ${t.status})` : ""}`);
  } catch {
    return [];
  }
}

async function buildContext(client: ClientConfig): Promise<string> {
  const parts: string[] = [];
  parts.push(`KLANT: ${client.name} (${client.domain || "geen domein"})`);

  // E-mails (live indien gekoppeld, anders opgeslagen).
  let emails = await getEmails(client.slug);
  const ms = await msStatus();
  if (ms.connected) {
    const q = (client.email || client.domain || "").trim();
    if (q) {
      const live = await msSearchClientEmails(q, ms.account || "", 15);
      if (live) emails = live;
    }
  }
  if (emails.length > 0) {
    parts.push("\nRECENTE E-MAILS (nieuwste eerst):");
    for (const e of emails.slice(0, 15)) {
      const dir = e.direction === "out" ? "WIJ→klant" : "klant→WIJ";
      const date = e.receivedAt ? new Date(e.receivedAt).toLocaleDateString("nl-NL") : "";
      const prev = (e.preview || "").replace(/\s+/g, " ").slice(0, 220);
      parts.push(`[${dir}, ${date}] ${e.subject || "(geen onderwerp)"} — ${prev}`);
    }
  }

  // Stand van zaken.
  const { status } = await getStatus(client.slug);
  if (status.exchanges.length > 0) {
    parts.push("\nSTAND VAN ZAKEN (gesprek klant/wij):");
    for (const ex of status.exchanges) {
      parts.push(`[${ex.side === "client" ? "KLANT" : "WIJ"}, ${ex.status === "done" ? "afgehandeld" : "OPEN"}] ${ex.text}`);
    }
  }
  if (status.mailActions.length > 0) {
    parts.push("\nMOGELIJKE ACTIES UIT MAIL:");
    for (const a of status.mailActions) parts.push(`- ${a.text}`);
  }

  // Lopende werkzaamheden uit de Sheet (huidige maand).
  const tasks = await sheetTaskLines(client);
  if (tasks.length > 0) {
    parts.push("\nLOPENDE WERKZAAMHEDEN (huidige maand, uit Google Sheet):");
    parts.push(...tasks);
  }

  // Search Console.
  const google = await googleStatus();
  if (google.connected && client.domain) {
    const gsc = await getGscForClient(client.domain);
    if (gsc && gsc.metrics.length > 0) {
      parts.push("\nSEARCH CONSOLE (laatste 28 dagen):");
      parts.push(gsc.metrics.map((m) => `${m.metric}=${m.value}`).join(", "));
      if (gsc.keywords.length > 0) {
        parts.push("Top zoekwoorden (GSC): " + gsc.keywords.slice(0, 10).map((k) => `${k.keyword} (pos ${k.position}, ${k.clicks} klikken)`).join("; "));
      }
    }
  }

  // Ahrefs (opgeslagen).
  const metrics = await getMetrics(client.slug);
  if (metrics.length > 0) {
    parts.push("\nAHREFS: " + metrics.map((m) => `${m.metric}=${m.value}`).join(", "));
  }
  const keywords = await getKeywords(client.slug, 15);
  if (keywords.length > 0) {
    parts.push("Ahrefs-zoekwoorden: " + keywords.map((k) => `${k.keyword} (pos ${k.position ?? "-"}, vol ${k.volume ?? "-"})`).join("; "));
  }

  return parts.join("\n");
}

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function answerChat(slug: string, messages: ChatMessage[]): Promise<{ ok: boolean; answer?: string; error?: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "Geen ANTHROPIC_API_KEY ingesteld." };
  const client = await getClientBySlug(slug);
  if (!client) return { ok: false, error: "Klant niet gevonden." };

  const context = await buildContext(client);
  const system =
    `Je bent de SEO-projectassistent van Pingwin voor de klant ${client.name}. ` +
    `Beantwoord vragen kort, concreet en in het Nederlands, uitsluitend op basis van de onderstaande projectcontext ` +
    `(e-mails, stand van zaken, taken, Search Console, Ahrefs). Noem waar relevant data of een mail-onderwerp. ` +
    `Staat het antwoord niet in de context, zeg dat eerlijk in plaats van te gokken.\n\n--- PROJECTCONTEXT ---\n${context}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system,
        messages: messages.slice(-10),
      }),
    });
    if (!res.ok) {
      let msg = `AI-fout (${res.status}).`;
      try { const j = await res.json(); msg = j.error?.message || msg; } catch { /* ignore */ }
      return { ok: false, error: msg };
    }
    const j = await res.json();
    const answer = Array.isArray(j.content) ? j.content.map((c: { text?: string }) => c.text || "").join("") : "";
    return { ok: true, answer: answer || "(geen antwoord)" };
  } catch (err) {
    return { ok: false, error: "AI niet bereikbaar: " + (err as Error).message };
  }
}
