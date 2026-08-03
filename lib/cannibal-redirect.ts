import fs from "fs";
import path from "path";
import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getClientUrls } from "./site-urls";
import { getGscForPage, getGscKeywordUrlFlips } from "./google";
import { getAhrefsTopPages, getUrlOrganicKeywords, ahrefsConfigured } from "./ahrefs";
import { fetchPageContent } from "./page-content";
import { callClaude, callClaudeAgentic, type ToolDef, type ToolRunner } from "./anthropic";
import { regelsAlsInstructie } from "./opruim-regels";

// ═══════════════════════════════════════════════════════════
// KEYWORD-CANNIBALISATIE-ANALYSE (dashboard-integratie van de skill)
// ═══════════════════════════════════════════════════════════
// Dit draait EXACT de methodiek uit de agentic skill
// `skills/keyword-cannibalisatie-analyse` (SKILL.md + output-schema.md). Die
// bestanden zijn de enige bron van waarheid: pas je de skill aan, dan verandert
// zowel de Cowork-versie als deze dashboard-versie mee. Het dashboard levert de
// data via de eigen connectoren: per pagina de Ahrefs-zoekwoorden met positie
// (de motor die onthult welke pagina op welk merk+geo-zoekwoord rankt), de GSC-
// matrix + flip-tijdreeks, en Ahrefs-volumes. De gedeelde zoekwoorden (meerdere
// pagina's op één term) worden in code voorgekauwd: dat zijn de cannibalisatie-
// kandidaten, zoals in de handmatige Excel-analyse.
// ═══════════════════════════════════════════════════════════

// --- Output-schema-types (spiegel van references/output-schema.md) ---------
export type ClusterUrl = {
  url: string; rol?: string; positie?: number; klikken?: number; impressies?: number;
  verwijzendeDomeinen?: number; intentie?: string;
};
export type ClusterSignalen = { urlFlip?: boolean; flipsIn90d?: number; positiePlafond?: boolean; klikVerdeling?: boolean };
export type RedirectCluster = {
  keyword: string; volume?: number; score?: string; signalen?: ClusterSignalen; intentie?: string;
  urls: ClusterUrl[]; winnaar: string; actie: string; onderbouwing?: string; verwachteImpact?: string;
};
export type RedirectMapItem = { van: string; naar: string; type?: string; mergeContent?: boolean; reden?: string };
export type InterneLink = { vanaf: string; naar: string; ankertekst?: string; reden?: string };
export type Datakwaliteit = { gsc?: boolean; gscTijdreeks?: boolean; ahrefsZoekwoorden?: boolean; ahrefsBacklinks?: boolean; crawl?: boolean; opmerking?: string };
export type CannibalResult = {
  samenvatting: string; datakwaliteit?: Datakwaliteit; clusters: RedirectCluster[];
  redirectMap?: RedirectMapItem[]; interneLinks?: InterneLink[]; generatedAt: string | null;
};
export type CannibalState = { status: "idle" | "running" | "done" | "error"; result: CannibalResult | null; error: string; updatedAt: string | null };

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_cannibal_analysis (
      client_slug TEXT PRIMARY KEY,
      status      TEXT NOT NULL DEFAULT 'idle',
      result      TEXT,
      error       TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}

function pagePath(u: string): string { return (u || "").replace(/^https?:\/\/[^/]+/i, "").trim() || (u || ""); }

// Haalt het eerste complete, gebalanceerde JSON-object uit een tekst (strings/escapes
// meegerekend), zodat losse accolades in proza de parse niet breken. Sluit het object
// niet (afgekapt antwoord), dan geeft hij de rest terug zodat we het kunnen herkennen.
function extractJsonObject(s: string): string {
  const start = s.indexOf("{");
  if (start < 0) return s;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  return s.slice(start);
}

// Laadt de skill (methodiek + output-schema) van schijf. Dit is de single source
// of truth die zowel Cowork als het dashboard draaien.
let skillCache: string | null = null;
function loadSkillMethodology(): string {
  if (skillCache != null) return skillCache;
  try {
    const base = path.join(process.cwd(), "skills", "keyword-cannibalisatie-analyse");
    const skill = fs.readFileSync(path.join(base, "SKILL.md"), "utf8").replace(/^---[\s\S]*?---\n/, "");
    const schema = fs.readFileSync(path.join(base, "references", "output-schema.md"), "utf8");
    skillCache = `${skill}\n\n---\n\n${schema}`;
  } catch {
    skillCache = "";
  }
  return skillCache;
}

export async function getCannibalAnalysis(slug: string): Promise<CannibalState> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT status, result, error, updated_at FROM client_cannibal_analysis WHERE client_slug = ${slug} LIMIT 1`;
  const r = rows[0];
  if (!r) return { status: "idle", result: null, error: "", updatedAt: null };
  let result: CannibalResult | null = null;
  try { result = r.result ? JSON.parse(r.result as string) : null; } catch { result = null; }
  return {
    status: (r.status as CannibalState["status"]) || "idle",
    result,
    error: (r.error as string) || "",
    updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
  };
}

async function setState(slug: string, status: string, result: CannibalResult | null, error: string): Promise<void> {
  await sql`
    INSERT INTO client_cannibal_analysis (client_slug, status, result, error, updated_at)
    VALUES (${slug}, ${status}, ${result ? JSON.stringify(result) : null}, ${error || null}, now())
    ON CONFLICT (client_slug) DO UPDATE SET status = ${status}, result = ${result ? JSON.stringify(result) : null}, error = ${error || null}, updated_at = now()`;
}

// Zet de run op 'running' (aangeroepen door de start-endpoint; het echte werk draait
// daarna via waitUntil in runCannibalRedirect).
export async function markCannibalRunning(slug: string): Promise<void> {
  await ensureSchema();
  await ensureTable();
  const cur = await getCannibalAnalysis(slug);
  await setState(slug, "running", cur.result, ""); // behoud het vorige resultaat tijdens het draaien
}

// De opdracht bovenop de skill-methodiek: draai op deze concrete data en lever
// uitsluitend de JSON uit het output-schema terug.
function buildSystemPrompt(): string {
  const methodology = loadSkillMethodology();
  const head = methodology
    ? `Je voert de volgende agentic skill uit. Dit is je volledige methodiek en je output-schema; volg het strikt.\n\n${methodology}`
    : `Je bent een senior SEO-specialist. Voer een keyword-cannibalisatie-analyse uit volgens de standaardmethodiek (URL-flip-detectie, positie-plafond, klik-verdeling, intentie-check, winnaar-weging, beslisboom).`;
  return `${head}

---

UITVOERING IN HET PINGWIN-DASHBOARD:
De data hieronder is al voor je verzameld. Redeneer per plaats/thema; verzin niets bij.
- Je PRIMAIRE bron is de AHREFS PER PAGINA-tabel: per pagina het top-zoekwoord met positie, verkeer en verwijzende domeinen. Cluster pagina's waarvan het top-zoekwoord dezelfde plaats/merk+geo-term betreft.
- Let op het patroon van de handmatige analyse: een omliggende-plaats- of variant-pagina waarvan het top-zoekwoord de merk+geo-term van een GROTE stad is (bijv. top-zoekwoord "merk grote-stad" of "soa test grote-stad" terwijl de URL een andere/omliggende plaats of een variant is). De hoofd-stadspagina (hoogste positie, meeste verwijzende domeinen) is de winnaar; de kaper krijgt "de-optimaliseren" of een 301 bij een duplicaat. Gebruik de lijst PAGINA'S ZONDER Ahrefs-VERKEER om lege duplicaat-varianten per plaats (kliniek-/poli-/test-) te vinden; die krijgen meestal een 301 naar de plaatswinnaar.
- Neem ALLEEN echte cannibalisatie op (hard signaal + overlappende intentie). Een informatieve blog naast een transactionele pagina = geen cannibalisatie; laat die eruit.
- Winnaar-weging: verwijzende domeinen (zwaarst) > organische tractie > businesswaarde. De pagina met de meeste verwijzende domeinen is niet altijd de bestemming; redirect desnoods de link-rijke pagina naar de businesswaardige pagina. Gesloten/verplaatste locaties: 301 naar de dichtstbijzijnde open pagina, niet 410 (behoud de verwijzende domeinen).
- Vul per cluster "signalen" (urlFlip/flipsIn90d uit de flip-tijdreeks, positiePlafond 5-20, klikVerdeling) en per URL "verwijzendeDomeinen" in. Vul "datakwaliteit" in: gsc=true, gscTijdreeks (kwamen er flips mee?), ahrefsZoekwoorden=true, ahrefsBacklinks=true, crawl=false.
- Antwoord met UITSLUITEND geldige JSON volgens het output-schema hierboven. Geen tekst eromheen, geen emoji, geen markdown-codeblok.`;
}

// FASE 1 (agentic): het model haalt zelf de diepte-data op via deze tools.
const CANNIBAL_TOOLS: ToolDef[] = [
  { name: "ahrefs_url_keywords", description: "Alle zoekwoorden waarop één specifieke URL organisch rankt (positie, volume, verkeer), uit Ahrefs. Gebruik dit om in te zoomen op een verdachte pagina en te zien op welke merk+geo-termen hij MEDE rankt, ook waar hij niet de winnaar is (bijv. een buitenwijkpagina die op 'one day clinic <grote stad>' pos 11 staat). Geef het pad, bijv. /soa-poli-gouda/.", input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
  { name: "fetch_page_content", description: "De on-page inhoud van een pagina (titel, meta, H1, koppen, kern van de tekst) om de zoekintentie te bepalen. Cruciaal om echte cannibalisatie (zelfde intentie) te scheiden van false positives (andere intentie). Geef het pad of de volledige URL.", input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
  { name: "gsc_page_queries", description: "De echte Search Console-zoekwoorden voor één pagina (klikken, vertoningen, gemiddelde positie, 90 dagen), om echte Google-tractie te bevestigen. Geef het pad.", input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
];

function makeCannibalRunner(domain: string): ToolRunner {
  const bare = domain.replace(/^www\./i, "").toLowerCase();
  const toFull = (u: string) => (u || "").startsWith("http") ? u : `https://${bare}${(u || "").startsWith("/") ? "" : "/"}${u || ""}`;
  return async (name, input) => {
    if (name === "ahrefs_url_keywords") {
      const kws = await getUrlOrganicKeywords(toFull(String(input.url || "")), "nl", 40).catch(() => []);
      return kws.length ? kws.map((k) => `"${k.keyword}" pos ${k.position ?? "?"} vol ${k.volume ?? "?"} verkeer ${k.traffic ?? "?"}`).join("\n") : "(geen Ahrefs-zoekwoorden voor deze URL)";
    }
    if (name === "fetch_page_content") {
      const c = await fetchPageContent(toFull(String(input.url || ""))).catch(() => null);
      if (!c) return "(kon pagina niet ophalen)";
      return `titel: ${c.title}\nH1: ${c.h1}\nkoppen: ${c.headings.slice(0, 10).join(" | ")}\ntekst: ${c.text.slice(0, 1000)}`;
    }
    if (name === "gsc_page_queries") {
      const rows = await getGscForPage(domain, toFull(String(input.url || "")), 90).catch(() => []);
      return rows.length ? rows.map((r) => `"${r.keyword}" pos ${r.position} ${r.clicks} clicks ${r.impressions} impr`).join("\n") : "(geen GSC-data voor deze URL)";
    }
    return "(onbekende tool)";
  };
}

// Onderzoeks-prompt: verken agentisch, rond snel af met een leesbare bevindingen-tekst
// (GEEN JSON). Tekst kan niet afgekapt/leeg de parse breken; fase 2 maakt er JSON van.
function buildGatherSystem(): string {
  const methodology = loadSkillMethodology();
  const head = methodology ? `Je bent een SEO-specialist die keyword-cannibalisatie onderzoekt. Methodiek:\n\n${methodology}` : `Je bent een senior SEO-specialist die keyword-cannibalisatie onderzoekt.`;
  return `${head}

---

ONDERZOEKSFASE (agentisch):
De KERN-DATA (Ahrefs per pagina + pagina's zonder verkeer + flips) staat in het bericht. Je taak: zoom met de tools in op de VERDACHTE pagina's en schrijf daarna je bevindingen.
- Kies de kandidaat-clusters uit de kern-data: pagina's waarvan het top-zoekwoord dezelfde plaats/merk+geo-term betreft, en variant-/duplicaat-URL's per plaats (kliniek-/poli-/test-).
- Gebruik ahrefs_url_keywords op verdachte pagina's om secundaire merk+geo-rankings te zien (een buitenwijkpagina die mede op 'merk grote-stad' rankt). Gebruik fetch_page_content om de intentie te checken (echte cannibalisatie vs. andere intentie). Gebruik gsc_page_queries voor echte tractie.
- Wees EFFICIËNT: enkele gerichte tool-aanroepen op de meest verdachte pagina's, dan afronden. Niet elke pagina uitputtend nalopen.
- Rond af met een LEESBARE bevindingen-tekst (geen JSON, geen tools meer): per plaats/thema-cluster de concurrerende pagina's met top-zoekwoord/positie/verwijzende domeinen, de winnaar met onderbouwing, de voorgestelde actie (301 / de-optimaliseren / interne links / behouden), en of de intentie echt overlapt. Noem ook lege duplicaat-varianten die naar de plaatswinnaar moeten redirecten.`;
}

// Draait de analyse in twee fasen: agentic onderzoek (tools) -> vaste JSON-synthese.
// Faalt nooit op een lege loop: fase 2 werkt ook uit de ruwe data. Idempotent qua opslag.
const padOf = (u: string) => { try { return new URL(u).pathname; } catch { return (u || "").trim(); } };

export async function runCannibalRedirect(slug: string): Promise<void> {
  try {
    await ensureSchema();
    await ensureTable();
    const client = await getClientBySlug(slug);
    const domain = client?.domain || "";
    if (!domain) { await setState(slug, "error", null, "Deze klant heeft nog geen domein ingevuld."); return; }
    if (!ahrefsConfigured()) { await setState(slug, "error", null, "Hiervoor is een AHREFS_API_TOKEN nodig in Vercel."); return; }

    const [topPages, urls, flips] = await Promise.all([
      getAhrefsTopPages(domain, 300).catch(() => [] as Awaited<ReturnType<typeof getAhrefsTopPages>>),
      getClientUrls(slug).catch(() => []),
      getGscKeywordUrlFlips(domain, 3).catch(() => [] as { keyword: string; topUrls: string[]; flips: number }[]),
    ]);
    if (!topPages.length) { await setState(slug, "error", null, "Geen Ahrefs-data terug voor dit domein. Controleer de Ahrefs-koppeling (AHREFS_API_TOKEN) en of het domein klopt."); return; }

    const ahrefsSeen = new Set(topPages.map((t) => pagePath(t.url)));
    const ahrefsTable = [...topPages].sort((a, b) => (b.traffic || 0) - (a.traffic || 0)).slice(0, 240)
      .map((t) => `- ${pagePath(t.url)} | top:"${t.topKeyword}" pos ${t.position ?? "?"} | ${t.traffic ?? 0} verkeer | ${t.refDomains ?? "?"} verw.domeinen | ${t.keywords ?? "?"}kw`).join("\n");
    const zeroTraffic = urls.filter((u) => (u.status ?? 200) === 200 && !ahrefsSeen.has(pagePath(u.url))).slice(0, 150)
      .map((u) => `- ${pagePath(u.url)} | status ${u.status ?? "?"} | ${u.gscClicks} clicks`).join("\n");
    const flipLines = flips.slice(0, 60).map((f) => `- "${f.keyword}": ${f.topUrls.join(" -> ")} (${f.flips}x)`).join("\n");
    const hasFlips = flips.length > 0;

    const seedData = [
      `KLANT: ${client?.name || slug} (domein: ${domain})`,
      "",
      `DATAKWALITEIT (neem over in datakwaliteit): gsc=true, gscTijdreeks=${hasFlips}, ahrefsZoekwoorden=true, ahrefsBacklinks=true (verwijzende domeinen per pagina), crawl=false.`,
      "",
      "AHREFS PER PAGINA (pagina | top-zoekwoord + positie | organisch verkeer | verwijzende domeinen | aantal zoekwoorden):",
      ahrefsTable || "- (geen)",
      "",
      "PAGINA'S ZONDER Ahrefs-VERKEER (status 200; vaak lege duplicaat-varianten die je per plaats naar de winnaar redirect):",
      zeroTraffic || "- (geen)",
      "",
      "URL-FLIP-TIJDREEKS (top-rankende URL per zoekwoord over 3 vensters van ~30 dagen):",
      flipLines || "- (geen flips gedetecteerd)",
    ].join("\n");

    // FASE 1 — agentic onderzoek: het model zoomt in op verdachte pagina's en schrijft
    // leesbare bevindingen. Faalt dit (leeg/te kort), dan gaat fase 2 door op de ruwe data.
    let findings = "";
    try {
      findings = await callClaudeAgentic(
        buildGatherSystem(),
        [{ role: "user", content: `${seedData}\n\nOnderzoek de meest verdachte pagina's met de tools en schrijf daarna je bevindingen (leesbare tekst, geen JSON).`.slice(0, 40000) }],
        CANNIBAL_TOOLS, makeCannibalRunner(domain), 8, 6000, { slug, action: "cannibal_gather" },
      );
    } catch { findings = ""; }
    const clean = findings.replace(/\(geen antwoord\)/gi, "").trim();

    // FASE 2 — vaste synthese naar JSON: altijd een antwoord, werkt ook zonder bevindingen.
    const phase2 = clean.length > 40
      ? `${seedData}\n\nBEVINDINGEN UIT HET AGENTISCH ONDERZOEK (gebruik deze; ze bevatten diepte-data zoals secundaire merk+geo-rankings en intentie-checks):\n${clean}\n\nLever nu de volledige analyse als JSON volgens het output-schema.`
      : `${seedData}\n\nLever nu de volledige analyse als JSON volgens het output-schema.`;
    // Eerdere besluiten van Maarten gaan mee als harde regels. Zo hoeft hij een
    // correctie ("Monster hoort bij Den Haag", "deze houden we") maar één keer te
    // maken en maakt de analyse dezelfde fout nooit meer.
    const eerdere = await regelsAlsInstructie(slug).catch(() => "");
    const systeem = eerdere ? `${buildSystemPrompt()}\n\n${eerdere}` : buildSystemPrompt();
    const raw = await callClaude(systeem, [{ role: "user", content: phase2.slice(0, 48000) }], 16000, { slug, action: "cannibal_redirect" });

    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const jsonText = extractJsonObject(cleaned);
    let parsed: { samenvatting?: unknown; datakwaliteit?: unknown; clusters?: unknown; redirectMap?: unknown; interneLinks?: unknown };
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      const looksTruncated = jsonText.trim().startsWith("{") && !jsonText.trim().endsWith("}");
      await setState(slug, "error", null, looksTruncated
        ? "De analyse werd afgekapt voordat de JSON af was (te lang). Probeer het opnieuw; ik heb de limiet verhoogd."
        : `De analyse kwam niet als geldige JSON terug. Probeer het opnieuw.${cleaned ? ` (begon met: ${cleaned.slice(0, 120).replace(/\s+/g, " ")})` : ""}`);
      return;
    }

    const result: CannibalResult = {
      samenvatting: typeof parsed.samenvatting === "string" ? parsed.samenvatting : "",
      datakwaliteit: parsed.datakwaliteit && typeof parsed.datakwaliteit === "object" ? (parsed.datakwaliteit as Datakwaliteit) : undefined,
      clusters: Array.isArray(parsed.clusters) ? (parsed.clusters as RedirectCluster[]) : [],
      redirectMap: Array.isArray(parsed.redirectMap) ? (parsed.redirectMap as RedirectMapItem[]) : [],
      interneLinks: Array.isArray(parsed.interneLinks) ? (parsed.interneLinks as InterneLink[]) : [],
      generatedAt: new Date().toISOString(),
    };
    // ── Doorgaan tot er niets nieuws meer komt ──────────────────────────────
    // Dit is het verschil met Cowork. Daar loopt een agent net zolang door tot
    // hij klaar is; hier deed de motor één ronde en stopte, ongeacht of hij de
    // hele site had gehad. Gevolg: 18 regels waar er 69 te vinden waren.
    // Nu vragen we per ronde expliciet naar wat er NOG NIET in staat, en stoppen
    // pas als een ronde niets nieuws oplevert (of na drie rondes).
    const gezien = new Set((result.redirectMap || []).map((m) => padOf(String(m.van || ""))));
    for (let ronde = 0; ronde < 3; ronde++) {
      const alGenoemd = [...gezien].slice(0, 400).join(", ");
      let extraRuw = "";
      try {
        extraRuw = await callClaude(
          systeem,
          [{ role: "user", content: `${seedData}\n\nJe hebt deze pagina's AL beoordeeld en die hoef je niet opnieuw te noemen:\n${alGenoemd}\n\nKijk nu naar de pagina's die je NOG NIET hebt beoordeeld. Zoek daar de resterende dunne, dubbele en overbodige pagina's. Let met name op locatiepagina's die nauwelijks vertoningen hebben en geen eigen zoekterm bezitten; die vallen buiten de clusters omdat ze met niemand concurreren, maar ze versnipperen wel de autoriteit. Lever UITSLUITEND JSON: {"redirectMap":[{"van":"/pad/","naar":"/doel/","type":"301","mergeContent":false,"reden":"..."}]}. Vind je niets nieuws, geef dan {"redirectMap":[]}.`.slice(0, 48000) }],
          8000, { slug, action: `cannibal_redirect_ronde${ronde + 2}` },
        );
      } catch { break; }
      let nieuweRijen: RedirectMapItem[] = [];
      try {
        const j = JSON.parse(extractJsonObject(extraRuw.replace(/```json/gi, "").replace(/```/g, "").trim())) as { redirectMap?: unknown };
        nieuweRijen = Array.isArray(j.redirectMap) ? (j.redirectMap as RedirectMapItem[]) : [];
      } catch { break; }
      const echtNieuw = nieuweRijen.filter((m) => {
        const v = padOf(String(m.van || ""));
        if (!v || gezien.has(v)) return false;
        gezien.add(v);
        return true;
      });
      if (!echtNieuw.length) break;                    // niets nieuws: klaar
      result.redirectMap = [...(result.redirectMap || []), ...echtNieuw];
      await setState(slug, "running", result, "");     // tussenstand alvast tonen
    }

    await setState(slug, "done", result, "");
  } catch (e) {
    try { await setState(slug, "error", null, `Analyse mislukt: ${e instanceof Error ? e.message : "onbekende fout"}`); } catch { /* stil */ }
  }
}
