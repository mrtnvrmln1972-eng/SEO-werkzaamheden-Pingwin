import { getClientBySlug } from "./clients";
import { getPagePlan, getPageDocOutputs, savePageDocOutput } from "./site-urls";
import { getTasks } from "./tasks";
import { getGscForPage } from "./google";
import { fetchPageContent } from "./page-content";
import { measurePage, measureToText, measureCompetitors, competitorsToText } from "./page-measure";
import { callClaude, callClaudeAgentic, type ToolDef, type ToolRunner } from "./anthropic";
import type { DocSpec } from "./pingwin-docx";
import { SEO_CRITERIA_MD } from "./seo-criteria";
import { getPageSpeed, pageSpeedToText } from "./pagespeed";
import { ahrefsConfigured, getUrlOrganicKeywords, getSerpOverview, getKeywordsOverview, getKeywordIdeas } from "./ahrefs";

export type DocKind = "analyse" | "blauwdruk" | "copy";

// Genereert de INHOUD voor een Pingwin-document (blauwdruk of copy), gegrond in
// de live paginadata + het plan + GSC. De huisstijl-opmaak gebeurt daarna in
// lib/pingwin-docx.ts. De methodiek komt uit de Pingwin SEO-skills.

// Bepaalt het primaire zoekwoord uit de GSC-data (meeste klikken, anders meeste
// vertoningen). Dit is het zaadje voor de Ahrefs SERP- en variantenanalyse.
function derivePrimaryKeyword(kw: { keyword: string; clicks: number; impressions: number }[]): string {
  if (!kw.length) return "";
  const sorted = [...kw].sort((a, b) => (b.clicks - a.clicks) || (b.impressions - a.impressions));
  return sorted[0]?.keyword || "";
}

// Haalt het GEKOZEN primaire zoekwoord uit het plan (regel "Primair: ..."). Dat
// is leidend boven de GSC-ranking, want we optimaliseren juist naar nieuw gekozen
// zoekwoorden die van de huidige ranking kunnen afwijken.
function planPrimaryKeyword(plan: string): string {
  const m = (plan || "").match(/primair\s*[:：]\s*([^\n]+)/i);
  if (!m) return "";
  return m[1].replace(/\*+/g, "").trim();
}

async function buildContext(slug: string, url: string, extra?: string): Promise<{ text: string; primary: string }> {
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  // Ronde 1: goedkope/snelle bronnen parallel. measurePage meet de pagina exact
  // uit (gerenderd via headless browser indien beschikbaar, anders statisch),
  // zodat de criteria tegen harde waarden gescoord worden i.p.v. geschat.
  const [plan, content, measure, kw, psi, allTasks] = await Promise.all([
    getPagePlan(slug, url),
    fetchPageContent(url).catch(() => null),
    measurePage(url).catch(() => null),
    getGscForPage(domain, url).catch(() => []),
    getPageSpeed(url).catch(() => null),
    getTasks(slug).catch(() => []),
  ]);

  const normUrl = (u?: string) => (u || "").trim().replace(/\/+$/, "");
  const pageTasks = allTasks.filter((t) => normUrl(t.pageUrl) === normUrl(url));

  // Gekozen zoekwoord uit het plan is leidend; anders de GSC-topper.
  const primary = planPrimaryKeyword(plan) || derivePrimaryKeyword(kw);

  // Ronde 2: Ahrefs-diepte (alleen als geconfigureerd). Top-10 SERP + varianten op
  // het primaire zoekwoord, plus de zoekwoorden waarop de URL zelf organisch scoort.
  let ahrefsText = "";
  let competitorText = "";
  if (ahrefsConfigured()) {
    const [urlKw, serp, overview, ideas] = await Promise.all([
      getUrlOrganicKeywords(url, "nl", 40).catch(() => []),
      primary ? getSerpOverview(primary, "nl").catch(() => []) : Promise.resolve([]),
      primary ? getKeywordsOverview([primary], "nl").catch(() => []) : Promise.resolve([]),
      primary ? getKeywordIdeas(primary, "nl", 25).catch(() => []) : Promise.resolve([]),
    ]);
    const ov = overview[0];

    // Meet de top-3 concurrenten uit de SERP uit (statisch, snel, geen extra
    // Ahrefs-credits) zodat de analyse concreet vergelijkt met de winnaars.
    const ownHost = (() => { try { return new URL(url).host.replace(/^www\./, ""); } catch { return domain.replace(/^www\./, ""); } })();
    const compUrls = serp.map((s) => s.url).filter((u) => { try { return new URL(u).host.replace(/^www\./, "") !== ownHost; } catch { return false; } });
    const comps = compUrls.length ? await measureCompetitors(compUrls).catch(() => []) : [];
    competitorText = competitorsToText(comps);
    ahrefsText = [
      "AHREFS-DATA:",
      primary ? `Primair zoekwoord (afgeleid uit GSC): "${primary}"${ov ? ` — volume ${ov.volume ?? "n/b"}/mnd, KD ${ov.difficulty ?? "n/b"}, CPC ${ov.cpc ?? "n/b"}` : ""}` : "Primair zoekwoord: (niet af te leiden uit GSC)",
      "",
      "Top-10 SERP voor het primaire zoekwoord (voor intentie- en cannibalisatie-check):",
      serp.length ? serp.slice(0, 10).map((s) => `- #${s.position} ${s.url} (DR ${s.domainRating ?? "n/b"}${s.type ? `, ${s.type}` : ""})`).join("\n") : "- (geen SERP-data)",
      "",
      "Zoekwoorden waarop DEZE URL nu organisch scoort (Ahrefs):",
      urlKw.length ? urlKw.slice(0, 25).map((k) => `- "${k.keyword}": positie ${k.position ?? "n/b"}, volume ${k.volume ?? "n/b"}, verkeer ${k.traffic ?? "n/b"}`).join("\n") : "- (geen)",
      "",
      "Semantische varianten / keyword-ideeën (voor de variantenlijst KW-04, §17):",
      ideas.length ? ideas.slice(0, 20).map((k) => `- "${k.keyword}" (volume ${k.volume ?? "n/b"}, KD ${k.difficulty ?? "n/b"})`).join("\n") : "- (geen)",
    ].join("\n");
  } else {
    ahrefsText = "AHREFS-DATA: niet beschikbaar (geen Ahrefs-koppeling ingesteld).";
  }

  const text = [
    `KLANT: ${client?.name || slug}`,
    client?.seoProfile ? `KLANTPROFIEL: ${client.seoProfile}` : "",
    `PAGINA: ${url}`,
    primary ? `GEKOZEN PRIMAIR ZOEKWOORD (leidend, uit het plan/GSC): "${primary}"` : "",
    `OVERGENOMEN PLAN VOOR DEZE PAGINA (de strategische conclusie, leidend): ${plan || "(nog geen plan, leid af uit de data)"}`,
    "",
    "OVERGENOMEN TAKEN VOOR DEZE PAGINA (uit de analyse-chat):",
    pageTasks.length ? pageTasks.map((t) => `- [${t.fase || "?"}${t.wie ? "/" + t.wie : ""}] ${t.taak}${t.status ? ` (${t.status})` : ""}`).join("\n") : "- (nog geen taken overgenomen)",
    extra ? `\nEXTRA STURING VAN DE GEBRUIKER (weeg zwaar mee): ${extra}` : "",
    "",
    measure ? measureToText(measure, primary) : "GEMETEN PAGINA-PROFIEL: (kon de pagina niet uitlezen)",
    "",
    "BESTAANDE PAGINA-TEKST (fragment, voor behoud van goede bestaande zinnen):",
    content ? content.text.slice(0, 1800) : "(niet ingelezen)",
    "",
    "GSC-ZOEKWOORDEN VAN DEZE PAGINA:",
    kw.length ? kw.map((k) => `- "${k.keyword}": positie ${k.position}, ${k.clicks} klikken, ${k.impressions} vertoningen`).join("\n") : "- (geen)",
    "",
    psi ? pageSpeedToText(psi) : "Core Web Vitals: niet gemeten.",
    "",
    ahrefsText,
    competitorText ? "\n" + competitorText : "",
  ].filter(Boolean).join("\n");
  return { text, primary };
}

const DOCSPEC_FORMAT = `Geef UITSLUITEND geldige JSON, niets eromheen, exact dit formaat:
{"titel": "...", "ondertitel": "...", "sections": [ {"heading": "1. Sectienaam", "blocks": [ ... ]} ]}
Toegestane bloktypes in "blocks":
- {"type":"paragraph","text":"..."}
- {"type":"subheading","text":"..."}
- {"type":"bullets","items":["...","..."]}
- {"type":"table","headers":["Kol1","Kol2"],"rows":[["a","b"],["c","d"]]}
- {"type":"highlight","text":"belangrijke callout"}
- {"type":"step","nr":1,"title":"...","text":"..."}
Houd het compleet maar compact. Voor NADRUK mag je woorden vet maken door ze tussen **dubbele sterretjes** te zetten (bijvoorbeeld een zoekwoord); gebruik verder geen markdown-tekens. Gebruik NERGENS emoji of symbolen als iconen (ook niet in classificaties: schrijf CRITICAL/MAJOR/MINOR en PASS/FAIL als gewone tekst, geen gekleurde bolletjes of vinkjes).`;

const ANALYSE_SYSTEM = `Je bent een senior SEO-specialist bij bureau Pingwin en voert een criteria-gestuurde SEO-ANALYSE uit van een BESTAANDE landingspagina.
Je scoort objectief tegen het criteria-document hieronder (de single source of truth). Geen subjectieve oordelen: alleen een gemeten waarde getoetst aan de norm uit een criterium-ID.

Lever, elk als eigen sectie:
0. Gate-verdict (bovenaan, als highlight): PASS of FAIL, de score /100, het aantal CRITICAL- en MAJOR-failures met hun ID's. Gate = PASS bij 0 CRITICAL, hooguit 2 MAJOR en score >= 85.
1. Samenvatting & KPI's: de GSC-cijfers van deze pagina (posities, klikken, vertoningen) in een tabel.
2. Huidige rankings: tabel van de zoekwoorden waarop de pagina nu scoort, met positie; markeer quick wins (positie 4-20).
3. Paginastructuur & meta: de huidige H1/koppen + title/meta, elk getoetst aan het bijbehorende criterium-ID met status.
4. Content, keyword & semantiek: woordenaantal vs. norm voor het pagina-type, keyword-dekking, variantenlijst (10-15), direct-antwoord-check.
5. Zoekintentie & SERP-alignment.
6. FAQ & AEO-readiness.
7. E-E-A-T, conversie & trust.
8. SCORECARD (de kern): een grote tabel met per criterium-ID uit het criteria-document: ID, criterium, classificatie (CRITICAL/MAJOR/MINOR), gemeten waarde, norm, status (PASS/FAIL/PARTIAL/N/A), opmerking. Loop ALLE relevante criteria langs. Gebruik de Core Web Vitals uit de PageSpeed-data hieronder om CWV-01 t/m CWV-08 echt te scoren; gebruik de Ahrefs top-10 SERP om INT-01 (pagina-type vs. dominant SERP-type) te toetsen en de Ahrefs-varianten voor KW-04. Alleen wat écht niet in de data zit markeer je als "niet gemeten".
9. Prioriteiten & aanbevelingen: minimaal 5, gesorteerd op impact x inspanning, elk met een criterium-ID.

BEOORDEEL DE HUIDIGE PAGINA IN HET LICHT VAN HET GEKOZEN PRIMAIRE ZOEKWOORD (niet alleen de huidige ranking): in welke mate is de bestaande content al geoptimaliseerd voor dat zoekwoord en de zoekintentie? Benoem expliciet welke bestaande elementen (koppen, alinea's, FAQ, tabellen, beeld) BEHOUDEN kunnen blijven omdat ze voldoen, en welke moeten worden aangepast of toegevoegd. Behoud is het uitgangspunt; verander alleen wat de criteria of de top-10-analyse vereisen.

Wees eerlijk: dit is een audit, geen verkooppraatje. Verzin geen rankings of Core Web Vitals; wat je niet gemeten hebt, benoem je als niet gemeten.

CRITERIA-DOCUMENT (leidend voor de scorecard):
${SEO_CRITERIA_MD}

${DOCSPEC_FORMAT}`;

const BLUEPRINT_SYSTEM = `Je bent een senior SEO-strateeg bij bureau Pingwin en maakt een BLAUWDRUK voor een landingspagina.
De blauwdruk bevat, elk als eigen sectie:
1. Zoekwoord-strategie: primair zoekwoord + secundaire/variant-zoekwoorden (tabel met zoekwoord + rol/volume waar bekend).
2. Headings-structuur: de voorgestelde H1, en de H2's/H3's in volgorde (elke H2 dekt idealiter een zoekwoord/subthema).
3. Meta: 2 varianten meta-title (max ~60 tekens) en 2 varianten meta-description (max ~155 tekens).
4. FAQ: 4 tot 6 vragen die de zoekintentie dekken.
5. Interne links: welke andere pagina's naar deze pagina linken en met welke ankertekst.
6. Beeld-briefs: kort wat voor beeld/alt-tekst per sectie.
UITGANGSPUNT BEHOUD: vertrek van de bestaande pagina-inhoud + het overgenomen plan en de taken. Geef de PERFECTE invulling voor deze landingspagina: behoud wat er al staat en voldoet aan de criteria + de top-10-eisen, en voeg alleen toe of herschrijf wat daaruit ontbreekt. Maak per sectie duidelijk of het BEHOUDEN, AANPASSEN of NIEUW is. Baseer de structuur op de top-10-analyse van het gekozen zoekwoord.
Werk conform de Pingwin-criteria: H2-dekking 60-80% (target 70%, criterium H2-01), primair zoekwoord front-loaded in de meta-title (META-03), title 50-60 tekens (META-02), meta-description 140-160 tekens (META-07), FAQ 4-8 vragen die een zoekwoord/long-tail bevatten (FAQ-02/03), en een variantenlijst van 10-15 semantische varianten (KW-04, §17).
Gegrond in de data hieronder; verzin geen rankings.

RELEVANTE CRITERIA:
${SEO_CRITERIA_MD}

${DOCSPEC_FORMAT}`;

const COPY_SYSTEM = `Je bent een senior SEO-copywriter bij bureau Pingwin en schrijft publicatieklare landingspagina-copy.
Werk tegen deze harde criteria: primair zoekwoord in de eerste 100 woorden; H2-koppen dekken 60-80% van de zoekwoorden; natuurlijke keyword-density 0,5-2%; semantische varianten ≥60% gedekt; open met een direct antwoord op de zoekintentie; FAQ-antwoorden 40-80 woorden.
Toon: warm, deskundig, passend bij het klantprofiel; geen holle marketingtaal, concreet en to-the-point.
Lever de VOLLEDIGE copy uit als document: de H1, per H2 de kop + de alineatekst (als paragraph-blokken), eventuele bullets, en een FAQ-sectie met vraag (subheading) + antwoord (paragraph). Ook een meta-title en meta-description bovenaan als eigen sectie.
UITGANGSPUNT BEHOUD: hergebruik bestaande zinnen/alinea's van de huidige pagina waar die goed zijn en voldoen aan de criteria; herschrijf alleen waar nodig en vul aan met wat de blauwdruk/top-10-analyse vereist. In de copy zit alles uit het plan, de taken en de analyse verwerkt.
Toets je eigen copy aan de Pingwin-criteria hieronder (met name §1 headings, §2 keyword/semantiek, §3 meta, §4 content, §6 FAQ, §12 AEO). Gegrond in de data hieronder.

RELEVANTE CRITERIA:
${SEO_CRITERIA_MD}

${DOCSPEC_FORMAT}`;

// Plat de gestructureerde DocSpec naar leesbare tekst, zodat een volgende stap
// (blauwdruk leest de analyse, copy leest de blauwdruk) erop kan voortbouwen.
function specToText(spec: DocSpec): string {
  const out: string[] = [`# ${spec.titel}`];
  for (const sec of spec.sections || []) {
    if (sec.heading) out.push(`\n## ${sec.heading}`);
    for (const b of sec.blocks || []) {
      if (b.type === "paragraph") out.push(b.text);
      else if (b.type === "subheading") out.push(`### ${b.text}`);
      else if (b.type === "bullets") out.push(b.items.map((i) => `- ${i}`).join("\n"));
      else if (b.type === "highlight") out.push(`> ${b.text}`);
      else if (b.type === "step") out.push(`${b.nr}. ${b.title}: ${b.text}`);
      else if (b.type === "table") out.push([b.headers.join(" | "), ...b.rows.map((r) => r.join(" | "))].join("\n"));
    }
  }
  return out.join("\n").slice(0, 12000);
}

// Robuuste JSON-extractie uit een AI-antwoord: strip code-fences, en val terug
// op de substring van de eerste "{" tot de laatste "}" als er tekst omheen staat.
// Geeft null als er echt geen geldige JSON in zit (bijv. afgekapt antwoord).
function extractJsonObject(raw: string): { titel?: unknown; ondertitel?: unknown; sections?: unknown } | null {
  const cleaned = (raw || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const tryParse = (s: string): { titel?: unknown; ondertitel?: unknown; sections?: unknown } | null => {
    try { const p = JSON.parse(s); return p && typeof p === "object" ? p : null; } catch { return null; }
  };
  const direct = tryParse(cleaned);
  if (direct) return direct;
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) return tryParse(cleaned.slice(first, last + 1));
  return null;
}

// Wat een stap van de vorige stappen mag meelezen (de keten).
const CHAIN_SOURCES: Record<DocKind, DocKind[]> = { analyse: [], blauwdruk: ["analyse"], copy: ["blauwdruk", "analyse"] };
const KIND_LABEL: Record<DocKind, string> = { analyse: "SEO-ANALYSE", blauwdruk: "BLAUWDRUK", copy: "COPY" };

const SYSTEMS: Record<DocKind, string> = { analyse: ANALYSE_SYSTEM, blauwdruk: BLUEPRINT_SYSTEM, copy: COPY_SYSTEM };
const RAPPORTTYPE: Record<DocKind, string> = { analyse: "SEO-analyse", blauwdruk: "SEO-blauwdruk", copy: "SEO-copy" };
const FALLBACK_TITLE: Record<DocKind, string> = { analyse: "SEO-analyse", blauwdruk: "Blauwdruk", copy: "Copy" };

// Vat de chat-analyse samen tot één STRATEGISCH analyse-document. Behoud de
// REDENERING/afweging (huidige situatie, zoekwoordonderzoek met volumes,
// concurrentie, zoekintentie, onderbouwde aanbeveling, wat mist), NIET de losse
// uitvoeringstaken (die worden in de latere stappen uitgewerkt).
const CHAT_SAMENVATTING_SYSTEM = `Je bent een senior SEO-strateeg bij bureau Pingwin. Vat het onderstaande chat-gesprek/analyse over één pagina samen in gewone, begrijpelijke taal. Behandel elk onderdeel KORT (1 tot 3 zinnen of een paar bullets per sectie) maar wel begrijpelijk. Geen jargon (of leg het in één zin uit); geen zware technische tabellen met KD/CPC. Verzin niets; baseer je op de analyse.
AANSPREEKVORM: dit stuk is gericht AAN de eigenaar van de pagina zelf (die leest het). Spreek de lezer dus DIRECT aan met "jullie/je" ("jullie pagina", "je site wordt nu vooral gevonden op..."). Praat NIET in de derde persoon over het bedrijf of de persoon (dus niet "Paul Hoevenaars is alleen vindbaar op...", maar "jullie site is nu vooral vindbaar op...").
ZOEKWOORDEN VET: elke keer dat je een concreet zoekwoord noemt, zet je het vet met dubbele sterretjes, bijvoorbeeld **exclusieve tuinen**.
Lever precies deze secties (elk kort):
1. Huidige situatie: hoe staat de pagina er nu voor en waarom presteert hij zo (nauwelijks gevonden, mist een duidelijke kop/tekst, e.d.).
2. Zoekwoorden: welke zoekwoorden we hebben onderzocht en welke kansrijk zijn (je mag het maandelijkse zoekvolume in gewone taal noemen; laat KD/CPC weg).
3. Concurrentie: kunnen we hier winnen, en wat doet de best gevonden concurrent wél.
4. Zoekintentie: waar deze pagina voor bedoeld is en waarom deze zoekwoorden er passen.
5. Wat de pagina nu mist: vergelijk CONCREET met de best scorende pagina's uit de top 10 van Google. Benoem wat die pagina's wél doen en jullie pagina nu niet (bijvoorbeeld een duidelijke kop met het zoekwoord, meer en beter vindbare tekst, projecten/portfolio, een duidelijke oproep tot actie).
6. Conclusie & advies: op welk(e) zoekwoord(en) we de pagina gaan richten en, in grote lijnen, wat we voorstellen om te doen zodat hij beter gevonden wordt.
BELANGRIJK: neem GEEN technische takenlijst op (geen "H1 toevoegen", "title herschrijven", "JS-rendering fixen"). De concrete uitwerking gebeurt in de latere stappen. Dit is een korte, leesbare duiding met een helder advies.
Geen emoji. ${DOCSPEC_FORMAT}`;

export async function summariseChatToSpec(slug: string, url: string, analysis: string, extra?: string): Promise<{ spec: DocSpec; title: string }> {
  const client = await getClientBySlug(slug);

  // STAP 1 (DENKEN): agentisch redeneren + toetsen aan de live-feiten/concurrenten,
  // met de chat-analyse als vertrekpunt. Levert een gegronde, gecorrigeerde conclusie.
  let grounded = "";
  try {
    const context = await buildContext(slug, url, extra);
    grounded = await reasonAboutStrategy(context.text, analysis, context.primary);
  } catch { /* lukt de grounding niet, dan formatteren we de chat-analyse zelf */ }

  // STAP 2 (FORMATTEREN): zet de (gegronde) analyse om in de leesbare klanttoon.
  const basis = grounded
    ? `GEGRONDE STRATEGISCHE CONCLUSIE (LEIDEND, getoetst aan de live-data):\n${grounded}\n\nOORSPRONKELIJKE CHAT-ANALYSE (aanvullende context):\n${analysis}`
    : analysis;
  const user = `Vat deze analyse voor pagina ${url} samen:\n\n${basis}${extra ? `\n\nEXTRA STURING: ${extra}` : ""}`;
  const raw = await callClaude(CHAT_SAMENVATTING_SYSTEM, [{ role: "user", content: user }], 8192);
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  let parsed: { titel?: unknown; ondertitel?: unknown; sections?: unknown };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Claude gaf geen (volledig) JSON terug, meestal doordat het antwoord tegen
    // het token-plafond aan liep en middenin afgekapt is. Nette melding i.p.v.
    // een kale "Unexpected end of JSON input".
    throw new Error("De analyse kon niet worden opgemaakt (het AI-antwoord kwam onvolledig terug). Probeer het opnieuw, of vat de chat-analyse iets korter samen.");
  }
  const title = typeof parsed.titel === "string" && parsed.titel.trim() ? parsed.titel.trim() : `Strategie ${url}`;
  const spec: DocSpec = {
    klant: client?.name || slug,
    rapporttype: "Strategie",
    titel: title,
    ondertitel: typeof parsed.ondertitel === "string" ? parsed.ondertitel : url,
    meta: { Klant: client?.name || slug, Pagina: url },
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
  };
  return { spec, title };
}

// Klantversie van een technisch document (analyse/blauwdruk/copy): korte,
// begrijpelijke duiding voor de klant, aangepast aan het type. Het technische
// bronstuk blijft de bron voor de volgende stap.
const CLIENT_STRUCTURE: Record<DocKind, string> = {
  analyse: `Lever deze secties (elk kort): 1. Huidige situatie; 2. Zoekwoorden (welke kansrijk zijn, zoekvolume in gewone taal); 3. Concurrentie (kunnen we winnen, wat doet de best gevonden concurrent wel); 4. Zoekintentie; 5. Wat de pagina nu mist t.o.v. de best scorende top-10-pagina's (concreet vergelijken); 6. Conclusie & advies (op welke zoekwoorden we richten en wat we voorstellen).`,
  blauwdruk: `Lever deze secties (elk kort): 1. Wat we op jullie pagina gaan zetten (de belangrijkste onderdelen/onderwerpen en de opbouw, in gewone taal); 2. Op welke zoekwoorden we richten; 3. Wat we behouden van de huidige pagina en wat nieuw wordt; 4. Waarom dit werkt (kort). Geen technische koppen/meta-details.`,
  copy: `Lever deze secties (elk kort): 1. Waar de nieuwe teksten over gaan (de kernboodschap en toon); 2. Welke zoekwoorden erin verwerkt zijn; 3. Wat dit voor jullie vindbaarheid betekent. Herhaal NIET de volledige copy; geef een begrijpelijke samenvatting.`,
};

// Vaste openingsalinea voor de copy-klantversie (letterlijk, niet door AI gegenereerd).
const COPY_CLIENT_INTRO = "Op basis van de SEO-analyse, de blauwdruk en de top 10-analyse hebben we deze copy ontwikkeld die voldoet aan de perfecte invulling voor deze pagina. Uiteraard heb jij veel meer verstand van jouw vak en je bedrijf dan wij, dus vragen we je wel om deze teksten goed door te nemen en aan te passen waar nodig. Als je deze teksten (al dan niet aangepast) terugstuurt, dan zullen wij ze op de juiste, SEO-geoptimaliseerde manier in de website verwerken.";

export async function clientVersionSpec(slug: string, url: string, kind: DocKind, source: string, extra?: string): Promise<{ spec: DocSpec; title: string }> {
  const client = await getClientBySlug(slug);
  const label = { analyse: "SEO-analyse", blauwdruk: "blauwdruk", copy: "copy" }[kind];
  const system = `Je bent een senior SEO-strateeg bij bureau Pingwin. Zet de onderstaande ${label} om in een KORTE, begrijpelijke versie voor de KLANT (die het zelf leest). Verzin niets; baseer je op de brontekst.
AANSPREEKVORM: gericht AAN de eigenaar zelf; spreek direct aan met "jullie/je" ("jullie pagina"), niet in de derde persoon over het bedrijf of de persoon.
TAAL: gewone taal, geen jargon (of leg het in één zin uit), geen scorecard en geen technische tabellen met KD/CPC. Elk onderdeel kort (1 tot 3 zinnen of een paar bullets).
ZOEKWOORDEN VET: zet elk concreet zoekwoord vet met dubbele sterretjes, bijvoorbeeld **exclusieve tuinen**.
${CLIENT_STRUCTURE[kind]}
Geen emoji. ${DOCSPEC_FORMAT}`;
  const user = `Zet deze ${label} voor pagina ${url} om in een klantversie:\n\n${source}${extra ? `\n\nEXTRA STURING: ${extra}` : ""}`;
  const raw = await callClaude(system, [{ role: "user", content: user }], 3500);
  const parsed = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());
  const title = typeof parsed.titel === "string" && parsed.titel.trim() ? parsed.titel.trim() : `Klantversie ${label} ${url}`;
  const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
  // De copy-klantversie opent altijd met een vaste, letterlijke introductie waarin
  // we de klant vragen de teksten na te lezen en (aangepast) terug te sturen.
  if (kind === "copy") {
    sections.unshift({
      heading: "",
      blocks: [{ type: "paragraph", text: COPY_CLIENT_INTRO }],
    });
  }
  const spec: DocSpec = {
    klant: client?.name || slug,
    rapporttype: `Klantversie ${label}`,
    titel: title,
    ondertitel: typeof parsed.ondertitel === "string" ? parsed.ondertitel : url,
    meta: { Klant: client?.name || slug, Pagina: url },
    sections,
  };
  return { spec, title };
}

// ── Agentische redeneer-stap (NOC-splitspatroon: DENKEN los van FORMATTEREN) ──
// De AI redeneert eerst agentisch met read-only meet-tools (dieper graven waar hij
// twijfelt, een winnende concurrent volledig uitmeten om te modelleren) en dwingt
// een VOLLEDIGE slotconclusie af. Die rijke tekst voedt daarna de formatteer-stap.
// Zo krijgen we Cowork-diepgang zonder het "agentisch + direct JSON = fragiel"-risico.
const REASON_FOCUS: Record<DocKind, string> = {
  analyse: "Doel: een complete SEO-AUDIT van de bestaande pagina. Loop in je conclusie ALLE relevante criteria langs met gemeten waarde + status (PASS/FAIL/PARTIAL/N/A), bepaal het gate-verdict (score/100, CRITICAL- en MAJOR-failures met ID), en geef minstens 5 geprioriteerde aanbevelingen. Toets tegen de gemeten waarden en de consensus van de winnaars. Benoem expliciet wat BEHOUDEN kan blijven.",
  blauwdruk: "Doel: de IDEALE paginastructuur. Bepaal in je conclusie de H1, de volledige H2/H3-structuur (gebaseerd op de must-have-secties die bij meerdere winnaars terugkomen), 2 meta-titles + 2 meta-descriptions, 4-8 FAQ-vragen, interne-link-suggesties en beeld-briefs. Zet de omvang-/dekkingslat op de consensus van de winnaars. Markeer per onderdeel BEHOUDEN/AANPASSEN/NIEUW.",
  copy: "Doel: publicatieklare copy. Bepaal in je conclusie de volledige tekst: H1, per H2 de kop + alinea's, bullets, en een FAQ met vraag+antwoord (40-80 woorden), plus meta-title en meta-description. Hergebruik goede bestaande zinnen (BEHOUDEN) en vul aan wat de blauwdruk/winnaars vereisen. Houd density 0,5-2% en zoekwoord in de eerste 100 woorden.",
};

// Read-only meet-tools voor de doc-agent: één URL volledig uitmeten (om een winnaar
// te modelleren) of meerdere concurrenten tegelijk (consensus). Gratis/statisch, geen
// Ahrefs-credits. Gedeeld door de doc- en de strategie-agent.
function buildDocAgentTools(primary: string): { tools: ToolDef[]; run: ToolRunner } {
  const tools: ToolDef[] = [
    { name: "meet_pagina", description: "Meet één URL volledig uit (koppen, alt-teksten, links, schema, woordenaantal, meta, FAQ). Gebruik dit om een winnende concurrent-pagina of een gerelateerde pagina in detail te modelleren.", input_schema: { type: "object", properties: { url: { type: "string", description: "De volledige URL om uit te meten" } }, required: ["url"] } },
    { name: "meet_concurrenten", description: "Meet meerdere concurrent-URL's tegelijk en geef de consensus (terugkerende H2-onderwerpen, mediane omvang, FAQ/schema-dekking).", input_schema: { type: "object", properties: { urls: { type: "array", items: { type: "string" }, description: "Lijst met concurrent-URL's" } }, required: ["urls"] } },
  ];
  const run: ToolRunner = async (name, input) => {
    if (name === "meet_pagina") {
      const u = String(input.url || "").trim();
      if (!u) return "Geen URL opgegeven.";
      const m = await measurePage(u, { staticOnly: true }).catch(() => null);
      return m && m.ok ? measureToText(m, primary) : "Kon deze pagina niet uitmeten.";
    }
    if (name === "meet_concurrenten") {
      const urls = Array.isArray(input.urls) ? (input.urls as unknown[]).map((x) => String(x)).filter(Boolean) : [];
      if (!urls.length) return "Geen URL's opgegeven.";
      const rows = await measureCompetitors(urls).catch(() => []);
      return competitorsToText(rows);
    }
    return "Onbekende tool.";
  };
  return { tools, run };
}

async function reasonAboutDoc(kind: DocKind, contextText: string, chain: string, primary: string): Promise<string> {
  const system = `Je bent een senior SEO-specialist bij bureau Pingwin. Werk AGENTISCH: redeneer stap voor stap en gebruik de tools om te verifiëren en dieper te graven waar je twijfelt. Bijvoorbeeld: meet een winnende concurrent-pagina volledig uit om zijn opbouw te modelleren, of meet een gerelateerde pagina. Bouw je analyse op over meerdere stappen; ga niet gokken maar meet.
Grond ALLES in gemeten data; verzin geen rankings, Core Web Vitals of paginabestaan.
SLUIT VERPLICHT AF met een VOLLEDIGE, definitieve conclusie (begin die met "CONCLUSIE:") die alles bevat wat nodig is, want jouw conclusie wordt daarna letterlijk omgezet in het uiteindelijke document. Laat niets als "nog te bepalen" staan.
${REASON_FOCUS[kind]}
CRITERIA (leidend):
${SEO_CRITERIA_MD}`;
  const user = `Analyseer deze pagina en vorm je volledige conclusie voor de ${KIND_LABEL[kind]}.\n\nGEGEVENS:\n${contextText}${chain}`;
  const { tools, run } = buildDocAgentTools(primary);
  // Max 4 denk-rondes met tools (de agent stopt eerder als hij klaar is), daarna een
  // gedwongen slotronde voor de conclusie. Ruim tokenbudget zodat de volledige
  // conclusie (bij copy de hele tekst) past, binnen de 300s-limiet van de route.
  return callClaudeAgentic(system, [{ role: "user", content: user }], tools, run, 4, 6000);
}

// Agentische strategie-redenering: vertrekt van de chat-analyse van de strateeg,
// maar TOETST die aan de live-feiten en gemeten concurrenten, graaft zelf dieper waar
// nodig, en vormt de definitieve strategische conclusie (huidige situatie, kansrijke
// zoekwoorden met volumes, concurrentie, zoekintentie, wat mist t.o.v. de top-10,
// helder advies). De klanttoon komt pas in de formatteer-stap.
async function reasonAboutStrategy(contextText: string, analysis: string, primary: string): Promise<string> {
  const system = `Je bent een senior SEO-strateeg bij bureau Pingwin. Werk AGENTISCH: redeneer stap voor stap en gebruik de tools om te verifiëren en dieper te graven (meet een winnende concurrent volledig uit, of een gerelateerde pagina). Ga niet gokken maar meet.
Je VERTREKT van de chat-analyse van de strateeg hieronder, maar TOETST die aan de gemeten live-feiten en de concurrenten. Wijkt de chat-analyse af van de echte data (ranking, live status, wat winnaars doen), volg dan de DATA en corrigeer.
Grond ALLES in gemeten data; verzin geen rankings, volumes, Core Web Vitals of paginabestaan.
SLUIT VERPLICHT AF met een VOLLEDIGE, definitieve strategische conclusie (begin met "CONCLUSIE:") die deze punten dekt: (1) huidige situatie/prestatie, (2) kansrijke zoekwoorden met zoekvolume, (3) concurrentiepositie (kunnen we winnen, wat doet de best gevonden concurrent wel), (4) zoekintentie, (5) wat de pagina mist t.o.v. de best scorende top-10-pagina's (concreet), (6) helder advies: op welke zoekwoorden richten en wat te doen. Laat niets open.
CRITERIA (naslag):
${SEO_CRITERIA_MD}`;
  const user = `Vorm de definitieve strategie voor deze pagina.\n\nCHAT-ANALYSE VAN DE STRATEEG (vertrekpunt, toets aan de data):\n${analysis}\n\nGEMETEN LIVE-GEGEVENS:\n${contextText}`;
  const { tools, run } = buildDocAgentTools(primary);
  return callClaudeAgentic(system, [{ role: "user", content: user }], tools, run, 4, 5000);
}

export async function generateDocSpec(slug: string, url: string, kind: DocKind, extra?: string): Promise<{ spec: DocSpec; title: string }> {
  const context = await buildContext(slug, url, extra);
  const client = await getClientBySlug(slug);

  // De keten: laat deze stap voortbouwen op de eerder gegenereerde stappen.
  let chain = "";
  const sources = CHAIN_SOURCES[kind];
  if (sources.length) {
    const prior = await getPageDocOutputs(slug, url).catch((): Record<string, string> => ({}));
    const parts = sources.filter((s) => prior[s]).map((s) => `EERDER GEGENEREERDE ${KIND_LABEL[s]} (LEIDEND, bouw hierop voort):\n${prior[s]}`);
    if (parts.length) chain = "\n\n" + parts.join("\n\n");
  }

  // STAP 1 (DENKEN): agentische redenering met tools + gedwongen slotconclusie.
  const reasoning = await reasonAboutDoc(kind, context.text, chain, context.primary).catch(() => "");
  const reasoningBlock = reasoning ? `\n\nAGENTISCHE ANALYSE (LEIDEND, verwerk dit volledig en getrouw in het document):\n${reasoning}` : "";

  // STAP 2 (FORMATTEREN): zet de conclusie om in het nette DocSpec-JSON.
  // Ruim tokenbudget: de copy (volledige pagina-tekst) is het langst en kapte bij
  // 8192 de JSON af ("Unterminated string" -> 500). Sonnet 4.6 kan veel meer output.
  const maxTokens = kind === "copy" ? 14000 : kind === "analyse" ? 12000 : 10000;
  const baseUser = `Maak de ${kind} op basis van deze gegevens:\n\n${context.text}${chain}${reasoningBlock}`;
  let parsed = extractJsonObject(await callClaude(SYSTEMS[kind], [{ role: "user", content: baseUser }], maxTokens));
  if (!parsed) {
    // Eenmalige herkansing met nadruk op volledige, geldige JSON (vaak afgekapt).
    const retryUser = `${baseUser}\n\nBELANGRIJK: geef UITSLUITEND geldige, VOLLEDIGE JSON terug volgens het formaat. Geen tekst eromheen en niet afkappen; houd het compact genoeg om helemaal af te maken.`;
    parsed = extractJsonObject(await callClaude(SYSTEMS[kind], [{ role: "user", content: retryUser }], maxTokens));
  }
  if (!parsed) {
    throw new Error(`De ${kind} kwam niet als geldige JSON terug (waarschijnlijk te lang of afgekapt). Probeer het opnieuw; blijft het misgaan, laat het weten dan splitsen we het document.`);
  }
  const title = typeof parsed.titel === "string" && parsed.titel.trim() ? parsed.titel.trim() : `${FALLBACK_TITLE[kind]} ${url}`;
  const spec: DocSpec = {
    klant: client?.name || slug,
    rapporttype: RAPPORTTYPE[kind],
    titel: title,
    ondertitel: typeof parsed.ondertitel === "string" ? parsed.ondertitel : url,
    meta: { Klant: client?.name || slug, Pagina: url },
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
  };
  // Bewaar de tekst-uitkomst zodat de volgende stap in de keten erop voortbouwt.
  await savePageDocOutput(slug, url, kind, specToText(spec)).catch(() => { /* keten is aanvulling, niet kritisch */ });
  return { spec, title };
}
