import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getEmails, getMetrics, getKeywords, getStatus } from "./snapshots";
import { msStatus, msSearchClientEmails } from "./ms-graph";
import { googleStatus, getGscForClient, getGscKeywordTrend, getGscForPage } from "./google";
import { measurePage } from "./page-measure";
import { getUrlOrganicKeywords, getSerpOverview, getAhrefsTopPages, ahrefsConfigured } from "./ahrefs";
import { callClaudeAgentic, type ToolDef, type ToolRunner } from "./anthropic";
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

function stripHtml(html: string): string {
  return html
    .replace(/<\s*(script|style)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\/(p|div|br|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"');
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
  emails = emails.filter((e) => !/@ahrefs\.com$/i.test((e.fromAddress || "").trim()));
  if (emails.length > 0) {
    parts.push("\nRECENTE E-MAILS (nieuwste eerst, met afzender/ontvangers en inhoud):");
    for (const e of emails.slice(0, 10)) {
      const dir = e.direction === "out" ? "WIJ→klant" : "klant→WIJ";
      const date = e.receivedAt ? new Date(e.receivedAt).toLocaleString("nl-NL") : "";
      const to = (e.toAddresses || []).join(", ");
      const bodyText = (stripHtml(e.bodyHtml || "") || e.preview || "").replace(/\s+/g, " ").trim().slice(0, 700);
      parts.push(
        `--- [${dir}, ${date}] Onderwerp: ${e.subject || "(geen onderwerp)"}\n` +
        `Van: ${e.fromAddress || "?"}${to ? ` | Aan: ${to}` : ""}\n` +
        `Inhoud: ${bodyText}`,
      );
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
        parts.push("Top zoekwoorden (GSC, 28d): " + gsc.keywords.slice(0, 10).map((k) => `${k.keyword} (pos ${k.position}, ${k.clicks} klikken)`).join("; "));
      }
    }
    // Zoekwoord-ontwikkeling over de laatste 4 maanden (gemiddelde positie per maand).
    const trend = await getGscKeywordTrend(client.domain);
    if (trend && trend.rows.length > 0) {
      parts.push(`\nSEARCH CONSOLE ZOEKWOORD-TREND (gem. positie per maand: ${trend.months.join(" / ")}):`);
      for (const r of trend.rows) parts.push(`${r.keyword}: ${r.positions.map((p) => (p == null ? "-" : p)).join(" / ")}`);
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

  // Google Ads (via de GA4-koppeling): prestaties, campagnes en activiteit-signalen,
  // zodat je in de chat kunt sparren over de inrichting en of er echt aan gewerkt wordt.
  try {
    const { getAdsComparison } = await import("./google");
    const ads = await getAdsComparison(client.slug, client.domain || "", 28, "prev");
    if (ads?.linked) {
      const t = (m: string) => ads.totals.find((x) => x.metric === m);
      const cost = t("cost"), clicks = t("clicks"), conv = t("conversions");
      const e2 = (n: number | undefined) => (n ?? 0).toFixed(2);
      parts.push("\nGOOGLE ADS (laatste 28 dagen vs. de 28 dagen ervoor, via GA4-koppeling):");
      parts.push(`Kosten \u20ac${e2(cost?.cur)} (vorige periode \u20ac${e2(cost?.prev)}), klikken ${Math.round(clicks?.cur || 0)} (${Math.round(clicks?.prev || 0)}), conversies ${Math.round(conv?.cur || 0)} (${Math.round(conv?.prev || 0)}).`);
      parts.push("Campagnes (nu vs. vorige periode):");
      for (const c of ads.campaigns.slice(0, 15)) {
        const status = c.prevCost === 0 && c.cost > 0 ? "NIEUW" : c.cost === 0 && c.prevCost > 0 ? "GESTOPT/STIL" : "loopt";
        parts.push(`- ${c.name} [${status}]: kosten \u20ac${e2(c.cost)} (was \u20ac${e2(c.prevCost)}), klikken ${Math.round(c.clicks)} (${Math.round(c.prevClicks)}), conversies ${Math.round(c.conversions)} (${Math.round(c.prevConversions)})`);
      }
      parts.push("Activiteit-duiding: NIEUW = campagne draaide vorige periode nog niet; GESTOPT/STIL = had toen kosten en nu niet; grote kostenverschuivingen wijzen op actieve wijzigingen. Weinig campagnes en vlakke kosten maandenlang = mogelijk geparkeerd account. Budgetten, biedstrategie-instellingen en de exacte wijzigingshistorie zitten NIET in deze data (die vereisen de Google Ads-API); zeg dat eerlijk als ernaar gevraagd wordt.");
    }
  } catch { /* Ads-context is aanvulling */ }

  return parts.join("\n");
}

// image/images: optionele afbeeldingen (data-URL's, al verkleind in de browser) bij
// een user-bericht. "image" blijft bestaan voor oude opgeslagen gesprekken.
export type ChatMessage = { role: "user" | "assistant"; content: string; image?: string; images?: string[] };

const cleanThread = (t?: string) => (t || "algemeen").trim().slice(0, 80) || "algemeen";

export async function getChatHistory(slug: string, thread = "algemeen"): Promise<ChatMessage[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT messages FROM client_chat WHERE client_slug = ${slug} AND thread = ${cleanThread(thread)} LIMIT 1`;
  if (!rows[0]?.messages) return [];
  try {
    const parsed = JSON.parse(rows[0].messages as string);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Alle gesprekken (threads) van een klant, nieuwste eerst.
export async function listChatThreads(slug: string): Promise<{ thread: string; count: number; updatedAt: string }[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT thread, messages, updated_at FROM client_chat WHERE client_slug = ${slug} ORDER BY updated_at DESC`;
  return rows.map((r) => {
    let count = 0;
    try { const p = JSON.parse((r.messages as string) || "[]"); count = Array.isArray(p) ? p.length : 0; } catch { /* leeg */ }
    return { thread: (r.thread as string) || "algemeen", count, updatedAt: new Date(r.updated_at as string).toISOString() };
  });
}

async function saveChatHistory(slug: string, thread: string, messages: ChatMessage[]): Promise<void> {
  await ensureSchema();
  const keep = messages.slice(-40);
  const content = JSON.stringify(keep.map((m, i) => ((m.image || m.images?.length) && i < keep.length - 6 ? { role: m.role, content: m.content } : m)));
  await sql`
    INSERT INTO client_chat (client_slug, thread, messages, updated_at)
    VALUES (${slug}, ${cleanThread(thread)}, ${content}, now())
    ON CONFLICT (client_slug, thread) DO UPDATE SET messages = EXCLUDED.messages, updated_at = now()`;
}

// Wist één gesprek (thread) van een klant; de assistent begint daar weer schoon.
export async function clearChatHistory(slug: string, thread = "algemeen"): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM client_chat WHERE client_slug = ${slug} AND thread = ${cleanThread(thread)}`;
}

function chatTools(client: ClientConfig): { tools: ToolDef[]; run: ToolRunner } {
  const domain = (client.domain || "").trim();
  const toFull = (u: string) => {
    const t = (u || "").trim();
    if (/^https?:\/\//i.test(t)) return t;
    return `https://${(domain || "").replace(/^https?:\/\//i, "").replace(/\/$/, "")}${t.startsWith("/") ? t : `/${t}`}`;
  };
  const tools: ToolDef[] = [
    { name: "meet_pagina", description: "Leest en meet een pagina live uit: meta-title/description, H1/H2/H3, aantal woorden, interne/externe links, afbeeldingen, FAQ en schema. Gebruik dit ZELF om contentkwaliteit en on-page zaken te beoordelen in plaats van ernaar te vragen.", input_schema: { type: "object", properties: { url: { type: "string", description: "Volledige URL of pad (bijv. /zwemvijvers/)" } }, required: ["url"] } },
    { name: "gsc_pagina", description: "Search Console-zoekwoorden van één pagina (laatste 90 dagen): zoekwoord, klikken, vertoningen, positie.", input_schema: { type: "object", properties: { url: { type: "string", description: "Volledige URL of pad" } }, required: ["url"] } },
    { name: "ahrefs_pagina", description: "Ahrefs-gegevens van één pagina: organische zoekwoorden met positie/volume/verkeer, plus het aantal verwijzende domeinen (externe autoriteit) van die pagina.", input_schema: { type: "object", properties: { url: { type: "string", description: "Volledige URL of pad" } }, required: ["url"] } },
    { name: "serp_top10", description: "De actuele top 10 van Google voor een zoekwoord (NL): positie, URL, titel, domain rating en resultaattype. Gebruik dit ZELF om de concurrentie te beoordelen.", input_schema: { type: "object", properties: { zoekwoord: { type: "string" } }, required: ["zoekwoord"] } },
  ];
  const run: ToolRunner = async (name, input) => {
    try {
      if (name === "meet_pagina") {
        const m = await measurePage(toFull(String(input.url || "")), { staticOnly: true });
        if (!m.ok) return `Pagina niet leesbaar (status ${m.status ?? "?"}).`;
        return [
          `Status ${m.status}. Title (${m.titleLength} tekens): ${m.metaTitle}`,
          `Meta-description (${m.descriptionLength} tekens): ${m.metaDescription}`,
          `H1: ${m.h1.join(" | ") || "(geen)"}`,
          `H2 (${m.h2.length}): ${m.h2.join(" | ")}`,
          `H3 (${m.h3.length}): ${m.h3.slice(0, 15).join(" | ")}`,
          `Woorden: ${m.wordCount}. Interne links: ${m.internalLinkCount}, extern: ${m.externalLinkCount}.`,
          `Afbeeldingen: ${m.images.length} (zonder alt: ${m.imagesWithoutAlt}). FAQ: ${m.faqDetected ? `ja (${m.faqCount})` : "nee"}. Schema: ${m.schemaTypes.join(", ") || "geen"}.`,
        ].join("\n");
      }
      if (name === "gsc_pagina") {
        const rows = await getGscForPage(domain, toFull(String(input.url || "")), 90);
        if (!rows.length) return "Geen GSC-data voor deze pagina (of de Google-koppeling ontbreekt).";
        return rows.slice(0, 25).map((r) => `${r.keyword}: pos ${r.position}, ${r.clicks} klikken, ${r.impressions} vertoningen`).join("\n");
      }
      if (name === "ahrefs_pagina") {
        if (!ahrefsConfigured()) return "Ahrefs is niet gekoppeld.";
        const full = toFull(String(input.url || ""));
        const [kws, top] = await Promise.all([
          getUrlOrganicKeywords(full, "nl", 30).catch(() => []),
          getAhrefsTopPages(domain).catch(() => []),
        ]);
        const norm = (u: string) => u.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
        const rd = top.find((t) => norm(t.url) === norm(full))?.refDomains;
        const kwText = kws.length ? kws.map((k) => `${k.keyword}: pos ${k.position ?? "-"}, vol ${k.volume ?? "-"}, verkeer ${k.traffic ?? "-"}`).join("\n") : "Geen organische zoekwoorden gevonden.";
        return `Verwijzende domeinen naar deze pagina: ${rd ?? "onbekend"}.\n${kwText}`;
      }
      if (name === "serp_top10") {
        const rows = await getSerpOverview(String(input.zoekwoord || ""), "nl");
        if (!rows.length) return "Geen SERP-data gevonden.";
        return rows.slice(0, 10).map((r) => `#${r.position} ${r.url} (DR ${r.domainRating ?? "-"}, ${r.type})${r.title ? ` \u2014 ${r.title}` : ""}`).join("\n");
      }
      return "Onbekend gereedschap.";
    } catch (e) {
      return `Gereedschap-fout: ${(e as Error).message}`;
    }
  };
  return { tools, run };
}

// Vervangt de historie van een gesprek (voor het verwijderen van losse berichten).
export async function replaceChatHistory(slug: string, thread: string, messages: ChatMessage[]): Promise<void> {
  await saveChatHistory(slug, thread, messages);
}

export async function answerChat(slug: string, messages: ChatMessage[], thread = "algemeen"): Promise<{ ok: boolean; answer?: string; error?: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "Geen ANTHROPIC_API_KEY ingesteld." };
  const client = await getClientBySlug(slug);
  if (!client) return { ok: false, error: "Klant niet gevonden." };

  const context = await buildContext(client);
  const system =
    `Je bent de SEO-projectassistent van Pingwin voor de klant ${client.name}. ` +
    `Beantwoord in het Nederlands, uitsluitend op basis van de onderstaande projectcontext ` +
    `(e-mails inclusief afzender/ontvangers en inhoud, stand van zaken, taken, Search Console incl. 4-maanden zoekwoord-trend, Ahrefs, en Google Ads-prestaties per campagne via de GA4-koppeling).\n\n` +
    `OPMAAK: schrijf conversationeel en netjes, zoals in een chat, in Markdown. Geen emoji.\n` +
    `- Schrijf in korte alinea's. Gebruik een kopje (## Kop) alleen als je antwoord echt meerdere onderwerpen behandelt; bij een kort antwoord geen kop.\n` +
    `- Gebruik bullets (-) voor opsommingen en **vet** voor labels/kernpunten.\n` +
    `- Zet cijfermatige of vergelijkende data (zoals zoekwoord-posities per maand, klikken, CTR) in een nette Markdown-tabel met uitgelijnde kolommen, bijvoorbeeld:\n` +
    `  | Zoekwoord | apr | mei | jun |\n  | --- | --- | --- | --- |\n  | soa test amsterdam | 9 | 7 | 6 |\n` +
    `- Houd zinnen kort en groepeer logisch. Sluit af met een kort actiepunt als dat past.\n\n` +
    `Noem waar relevant het mail-onderwerp, de datum of de ontvanger (bv. of een mail naar de klant of naar jezelf ging). ` +
    `Staat het antwoord niet in de context, zeg dat eerlijk in plaats van te gokken.\n\n` +
    `WERKWIJZE (belangrijk): jij bent de specialist; Maarten wil ANTWOORDEN, geen vragenlijsten.\n` +
    `- Je hebt gereedschap om ZELF te kijken: meet_pagina (content/koppen/meta/links van een URL), gsc_pagina (zoekwoorden per pagina), ahrefs_pagina (posities, volume en verwijzende domeinen van een pagina) en serp_top10 (de concurrentie op een zoekwoord). GEBRUIK dat gereedschap eerst, en beantwoord de vraag daarna onderbouwd met wat je zag.\n` +
    `- Stel NOOIT een lijst controlevragen die je zelf kunt beantwoorden (zoals "staat het zoekwoord in de H1?" of "hoeveel backlinks heeft de pagina?"): meet het en vertel het resultaat.\n` +
    `- Trek zelf de conclusie en sluit af met concrete aanbevelingen in volgorde van impact. Hooguit \u00e9\u00e9n korte vraag, alleen als een echte keuze bij Maarten ligt.\n\n--- PROJECTCONTEXT ---\n${context}`;

  try {
    // Agentisch: de assistent kan zelf meten (pagina, GSC, Ahrefs, top-10) vóór hij
    // antwoordt. Vision-berichten (afbeelding) gaan als content-blokken mee.
    const apiMessages = messages.slice(-10).map((m) => {
      const imgs = [...(m.images || []), ...(m.image ? [m.image] : [])];
      const blocks = imgs
        .map((im) => im.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i))
        .filter((x): x is RegExpMatchArray => !!x)
        .map((x) => ({ type: "image", source: { type: "base64", media_type: x[1], data: x[2] } }));
      if (!blocks.length) return { role: m.role, content: m.content };
      return {
        role: m.role,
        content: [
          ...blocks,
          { type: "text", text: m.content || (blocks.length > 1 ? "Bekijk deze afbeeldingen en betrek ze bij het gesprek." : "Bekijk deze afbeelding en betrek hem bij het gesprek.") },
        ] as unknown as string,
      };
    });
    const { tools, run } = chatTools(client);
    const answer = await callClaudeAgentic(system, apiMessages as { role: "user" | "assistant"; content: string }[], tools, run, 6, 2000, { slug, action: "projectchat" });
    const finalAnswer = answer || "(geen antwoord)";
    await saveChatHistory(slug, thread, [...messages, { role: "assistant", content: finalAnswer }]);
    return { ok: true, answer: finalAnswer };
  } catch (err) {
    return { ok: false, error: "AI niet bereikbaar: " + (err as Error).message };
  }
}
