import { getClientBySlug } from "./clients";
import { getClientUrls, getPagePlan } from "./site-urls";
import { getGscForPage } from "./google";
import { getTasks } from "./tasks";

// ═══════════════════════════════════════════════════════════
// GROUNDING VOOR DE PAGINA-CHAT
// ═══════════════════════════════════════════════════════════
// Elke AI-uitspraak over een pagina moet gegrond zijn in live feiten: de echte
// HTTP-status, de live titel, de GSC-rankings van DEZE pagina, andere pagina's
// in het cluster die op dezelfde zoekwoorden ranken, de plan-alinea en de
// bestaande taken. Verzin niets over bestaan of ranking.
// ═══════════════════════════════════════════════════════════

function normUrl(u: string): string { return (u || "").replace(/^https?:\/\/[^/]+/i, "").trim() || (u || ""); }

export type Proposal = { plan?: string; tasks?: { taak: string; fase?: string; wie?: string }[] };

export async function buildSystemPrompt(slug: string, url: string): Promise<string> {
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  const [urls, plan, tasks] = await Promise.all([
    getClientUrls(slug),
    getPagePlan(slug, url),
    getTasks(slug),
  ]);
  const kw = await getGscForPage(domain, url).catch(() => []);

  const self = urls.find((u) => normUrl(u.url) === normUrl(url));
  const pageTasks = tasks.filter((t) => normUrl(t.pageUrl || "") === normUrl(url) || (t.taak || "").includes(url));

  // Cluster-context: andere eigen pagina's die op dezelfde zaad-woorden ranken.
  const seedWords = new Set(kw.slice(0, 8).flatMap((k) => k.keyword.toLowerCase().split(/\s+/).filter((w) => w.length > 3)));
  const clusterPeers = urls
    .filter((u) => normUrl(u.url) !== normUrl(url) && (u.title || "").length > 0)
    .filter((u) => [...seedWords].some((w) => (u.title || "").toLowerCase().includes(w) || u.url.toLowerCase().includes(w)))
    .slice(0, 12);

  const facts = [
    `KLANT: ${client?.name || slug} (domein: ${domain || "onbekend"})`,
    `PAGINA: ${url}`,
    `LIVE STATUS: ${self ? (self.status ?? "onbekend") : "niet in de gescande lijst (mogelijk nog niet live)"}${self?.redirectTarget ? ` → ${self.redirectTarget}` : ""}`,
    `LIVE TITEL: ${self?.title || "onbekend"}`,
    `GSC-KLIKKEN (deze pagina): ${self ? self.gscClicks : "onbekend"}`,
    "",
    "ZOEKWOORDEN WAAROP DEZE PAGINA RANKT (Search Console, laatste 90 dagen):",
    kw.length ? kw.map((k) => `- "${k.keyword}": positie ${k.position}, ${k.clicks} klikken, ${k.impressions} vertoningen`).join("\n") : "- (geen GSC-data gevonden voor deze pagina)",
    "",
    "ANDERE EIGEN PAGINA'S IN HETZELFDE CLUSTER (mogelijke concurrentie):",
    clusterPeers.length ? clusterPeers.map((u) => `- ${normUrl(u.url)} (${u.gscClicks} klikken) — ${u.title}`).join("\n") : "- (geen duidelijke cluster-genoten gevonden)",
    "",
    `HUIDIG PLAN VOOR DEZE PAGINA: ${plan || "(nog geen plan)"}`,
    "",
    "BESTAANDE TAKEN VOOR DEZE PAGINA:",
    pageTasks.length ? pageTasks.map((t) => `- [${t.fase || "geen fase"}] ${t.taak} (${t.status})`).join("\n") : "- (geen)",
  ].join("\n");

  return `Je bent een nuchtere, ervaren SEO-strateeg die per pagina adviseert voor een klant van bureau Pingwin.

HARDE REGELS:
- Verzin NIETS over het bestaan of de ranking van een pagina. Gebruik alleen de live feiten hieronder.
- Redirect nooit naar een URL die niet bestaat. Toets een redirect-doel aan de live status.
- Toets het plan-label altijd aan de echte ranking en titel; het label kan fout zijn.
- Wees concreet en kort. Geef één onderbouwd advies, geen scenario A/B als je de live status al kent.
- Als je een concrete wijziging voorstelt (een nieuw plan voor de pagina en/of taken), sluit je antwoord dan af met een machineleesbaar blok, exact in dit formaat:

<voorstel>
{"plan": "Rol: ... Primair: ... Actie: ... Doel-URL: ...", "tasks": [{"taak": "korte taakomschrijving", "fase": "Bouwen|Herbedraden|Opschonen", "wie": "SEO|Dev"}]}
</voorstel>

Laat "plan" weg als het plan niet verandert, en "tasks" weg als er geen nieuwe taken zijn. Verzin geen taken zonder grond.

LIVE FEITEN:
${facts}`;
}

// Haalt het <voorstel>-blok uit het antwoord en geeft de schone tekst + het voorstel terug.
export function parseProposal(text: string): { reply: string; proposal: Proposal | null } {
  const m = text.match(/<voorstel>\s*([\s\S]*?)\s*<\/voorstel>/i);
  if (!m) return { reply: text.trim(), proposal: null };
  const reply = text.replace(m[0], "").trim();
  try {
    const parsed = JSON.parse(m[1]);
    const proposal: Proposal = {};
    if (typeof parsed.plan === "string" && parsed.plan.trim()) proposal.plan = parsed.plan.trim();
    if (Array.isArray(parsed.tasks)) proposal.tasks = parsed.tasks.filter((t: { taak?: string }) => t && typeof t.taak === "string" && t.taak.trim());
    return { reply, proposal: (proposal.plan || proposal.tasks?.length) ? proposal : null };
  } catch {
    return { reply, proposal: null };
  }
}
