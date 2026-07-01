import { getClientBySlug } from "./clients";
import { getClientUrls, getPagePlan } from "./site-urls";
import { getGscForPage, getGscQueryPageMatrix } from "./google";
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
  const [kw, matrix] = await Promise.all([
    getGscForPage(domain, url).catch(() => []),
    getGscQueryPageMatrix(domain).catch(() => []),
  ]);

  const self = urls.find((u) => normUrl(u.url) === normUrl(url));
  const pageTasks = tasks.filter((t) => normUrl(t.pageUrl || "") === normUrl(url) || (t.taak || "").includes(url));

  // Sitebrede zoekwoord→pagina-matrix (voor cannibalisatie + sitebrede vragen).
  const matrixTop = [...matrix].sort((a, b) => b.impressions - a.impressions).slice(0, 60);
  const matrixLines = matrixTop.map((m) => `- "${m.keyword}" → ${normUrl(m.page)} (pos ${m.position}, ${m.clicks} klikken, ${m.impressions} vertoningen)`);

  // Alle eigen pagina's met verkeer (sitebreed overzicht).
  const topPages = [...urls].sort((a, b) => b.gscClicks - a.gscClicks).slice(0, 30);

  const facts = [
    `KLANT: ${client?.name || slug} (domein: ${domain || "onbekend"})`,
    "",
    "KLANTPROFIEL (positionering, werkgebied, karakter):",
    (client?.seoProfile || "").trim() || "(NOG NIET INGEVULD, vraag hiernaar als het relevant is)",
    "",
    `GEOPENDE PAGINA: ${url}`,
    `LIVE STATUS: ${self ? (self.status ?? "onbekend") : "niet in de gescande lijst (mogelijk nog niet live)"}${self?.redirectTarget ? ` → ${self.redirectTarget}` : ""}`,
    `LIVE TITEL: ${self?.title || "onbekend"}`,
    `GSC-KLIKKEN (deze pagina): ${self ? self.gscClicks : "onbekend"}`,
    "",
    "ZOEKWOORDEN WAAROP DE GEOPENDE PAGINA RANKT (Search Console, 90 dagen):",
    kw.length ? kw.map((k) => `- "${k.keyword}": positie ${k.position}, ${k.clicks} klikken, ${k.impressions} vertoningen`).join("\n") : "- (geen GSC-data voor deze pagina)",
    "",
    "SITEBREED, ZOEKWOORD → PAGINA (top 60 op vertoningen, Search Console 90 dagen):",
    "Zo zie je welke pagina op welk zoekwoord rankt, en dus waar pagina's elkaar kannibaliseren.",
    matrixLines.length ? matrixLines.join("\n") : "- (geen sitebrede GSC-data)",
    "",
    "ALLE PAGINA'S MET VERKEER (spiegel van de live site):",
    topPages.length ? topPages.map((u) => `- ${normUrl(u.url)} (${u.gscClicks} klikken, status ${u.status ?? "?"}) — ${u.title || ""}`).join("\n") : "- (nog geen site ingelezen)",
    "",
    `HUIDIG PLAN VOOR DE GEOPENDE PAGINA: ${plan || "(nog geen plan)"}`,
    "",
    "BESTAANDE TAKEN VOOR DEZE PAGINA:",
    pageTasks.length ? pageTasks.map((t) => `- [${t.fase || "geen fase"}] ${t.taak} (${t.status})`).join("\n") : "- (geen)",
  ].join("\n");

  return `Je bent een nuchtere, ervaren SEO-strateeg die adviseert voor een klant van bureau Pingwin. Je werkt gegrond, zoals in een goede sparringsessie: je durft door te vragen.

HARDE REGELS:
- Verzin NIETS over het bestaan of de ranking van een pagina. Gebruik alleen de live feiten hieronder.
- Je hebt Search Console (rankings, klikken, vertoningen), maar GEEN absoluut zoekvolume (Ahrefs/Semrush zit niet in deze tool). Gebruik GSC-vertoningen als proxy voor vraag/volume, en zeg er eerlijk bij dat het een proxy is. Verzin geen exacte zoekvolumes.
- Je kunt sitebreed redeneren: gebruik de zoekwoord→pagina-matrix om cannibalisatie te zien (bijv. de homepage die rankt op "hovenier [plaats]" terwijl er een aparte plaatspagina bestaat) en om de beste zoekterm voor een pagina te kiezen.
- VRAAG DOOR wanneer dat het advies beter maakt. Als het klantprofiel leeg is of je mist context die je nodig hebt (positionering: prijs vs exclusief/design vs duurzaam; werkgebied: regionaal vs landelijk; welke steden; doelgroep; gewenste term-focus), stel dan EERST één tot drie korte, gerichte vragen aan de gebruiker en wacht op antwoord voordat je een definitief advies geeft. Beter één vraag te veel dan een advies op aannames.
- Als de gebruiker profiel-informatie geeft, verwerk die en stel voor om het als klantprofiel te bewaren (dat kan de gebruiker doen in het veld "Klantprofiel" bovenaan de Pagina's-tab).
- Redirect nooit naar een URL die niet bestaat. Toets een redirect-doel aan de live status. Toets het plan-label altijd aan de echte ranking en titel.
- Antwoord in NETTE markdown zodat het als rapport oogt: korte kopjes (## en ###), bullets, en waar het helpt een kleine tabel, bijvoorbeeld | Zoekwoord | Positie | Vertoningen | URL |. Houd het scanbaar, geen muur van tekst.
- Als je een concrete wijziging voorstelt (een nieuw plan voor de geopende pagina en/of taken), sluit je antwoord dan af met een machineleesbaar blok, exact in dit formaat:

<voorstel>
{"plan": "Rol: ... Primair: ... Actie: ... Doel-URL: ...", "tasks": [{"taak": "korte taakomschrijving", "fase": "Bouwen|Herbedraden|Opschonen", "wie": "SEO|Dev"}]}
</voorstel>

Laat "plan" weg als het plan niet verandert, en "tasks" weg als er geen nieuwe taken zijn. Geef GEEN voorstel als je eerst nog een verhelderende vraag stelt.

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
