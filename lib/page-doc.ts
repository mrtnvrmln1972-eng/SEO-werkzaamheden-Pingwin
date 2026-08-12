import { getClientBySlug } from "./clients";
import { getPagePlan, getPageDocOutputs, savePageDocOutput } from "./site-urls";
import { getTasks } from "./tasks";
import { getGscForPage } from "./google";
import { fetchPageContent } from "./page-content";
import { measurePage, measureToText, measureCompetitors, competitorsToText } from "./page-measure";
import { callClaude, callClaudeAgentic, LIGHT_MODEL, type ToolDef, type ToolRunner } from "./anthropic";
import type { DocSpec } from "./pingwin-docx";
import { SEO_CRITERIA_MD } from "./seo-criteria";
import { META_RULES_PROMPT, metaVerdictText, type MetaKind } from "./meta-rules";
import { perfectioneerMeta } from "./meta-machine";
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
  // Plan kan markdown of (na handmatig bewerken) HTML zijn; strip tags voor het matchen.
  const plain = (plan || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
  const m = plain.match(/primair\s*[:：]\s*([^\n<]+)/i);
  if (!m) return "";
  return m[1].replace(/\*+/g, "").trim();
}

// Begrenst een trage belofte: geeft de fallback terug als hij te lang duurt, zodat
// één traag onderdeel (bv. PageSpeed) de hele generatie niet over de tijdslimiet trekt.
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fallback), ms))]);
}

async function buildContext(slug: string, url: string, extra?: string): Promise<{ text: string; primary: string }> {
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  // Ronde 1: goedkope/snelle bronnen parallel. measurePage meet de pagina exact
  // uit (gerenderd via headless browser indien beschikbaar, anders statisch),
  // zodat de criteria tegen harde waarden gescoord worden i.p.v. geschat.
  // VANGNET (geen versimpeling): begrens alleen tegen een vastlopende externe stap,
  // zodat één hangende call (headless render/PageSpeed) niet de hele generatie
  // over de tijdslimiet trekt. Ruim gezet zodat een normaal-trage call gewoon af mag.
  const [plan, content, measure, kw, psi, allTasks] = await Promise.all([
    getPagePlan(slug, url),
    fetchPageContent(url).catch(() => null),
    withTimeout(measurePage(url).catch(() => null), 60000, null),
    withTimeout(getGscForPage(domain, url).catch(() => []), 30000, []),
    withTimeout(getPageSpeed(url).catch(() => null), 45000, null),
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
      withTimeout(getUrlOrganicKeywords(url, "nl", 40).catch(() => []), 40000, []),
      primary ? withTimeout(getSerpOverview(primary, "nl").catch(() => []), 40000, []) : Promise.resolve([]),
      primary ? withTimeout(getKeywordsOverview([primary], "nl").catch(() => []), 30000, []) : Promise.resolve([]),
      primary ? withTimeout(getKeywordIdeas(primary, "nl", 25).catch(() => []), 30000, []) : Promise.resolve([]),
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

  const liveStamp = new Date().toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" });
  const text = [
    `KLANT: ${client?.name || slug}`,
    client?.seoProfile ? `KLANTPROFIEL: ${client.seoProfile}` : "",
    `PAGINA: ${url}`,
    content || measure
      ? `FEITEN LIVE GECHECKT OP: ${liveStamp} (de pagina is op dit moment vers uitgelezen; vermeld deze datum in het document)`
      : `LET OP: de pagina kon op ${liveStamp} NIET live uitgelezen worden; benoem in het document dat de meting ontbreekt en baseer geen content-gaps op aannames`,
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
- {"type":"code","text":"letterlijke code (bijv. JSON), regeleinden met \\n"} — alleen voor code/markup, nooit voor gewone tekst
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

VERSHEID: de pagina-feiten hieronder zijn op het meetmoment live uitgelezen (zie "FEITEN LIVE GECHECKT OP"). Vermeld die datum in de samenvatting, zodat de lezer weet op welke paginaversie dit oordeel rust. Baseer een "ontbreekt"-bevinding uitsluitend op de gemeten koppen/inhoud, nooit op een oudere scan of aanname.

INTENTIE-DOSERING BIJ DE AANBEVELINGEN: lees uit de top-10 de mix informatief/commercieel af. Is de SERP overwegend informatief, adviseer dan GEEN zware commerciële secties (zoals een volledige kosten-uitweiding) maar een kort blok met een interne link naar de kosten-/behandelpagina; is de SERP overwegend commercieel, dan mag de commerciële laag dragend zijn.

Wees eerlijk: dit is een audit, geen verkooppraatje. Verzin geen rankings of Core Web Vitals; wat je niet gemeten hebt, benoem je als niet gemeten.

CRITERIA-DOCUMENT (leidend voor de scorecard):
${SEO_CRITERIA_MD}

${DOCSPEC_FORMAT}`;

const BLUEPRINT_SYSTEM = `Je bent een senior SEO-strateeg bij bureau Pingwin en maakt een BLAUWDRUK voor een landingspagina.
De blauwdruk bevat, elk als eigen sectie:
1. Zoekwoord-strategie: primair zoekwoord + secundaire/variant-zoekwoorden (tabel met zoekwoord + rol/volume waar bekend).
2. Headings-structuur: de voorgestelde H1, en de H2's/H3's in volgorde. VARIATIE, GEEN STUFFING: maximaal circa 70% van de koppen bevat het primaire zoekwoord of een semantische variant (boven 80% oogt onnatuurlijk, criterium H2-01); de overige koppen dekken het onderwerp met natuurlijke titels ZONDER het zoekwoord. Bij een LOKAAL zoekwoord (met plaatsnaam): zet de plaatsnaam in HOOGUIT 2 à 3 koppen, niet in elke kop; varieer de rest met de dienst/het subthema. Koppen lezen als sectietitels, niet als zoekopdrachten. Zet vóór ELKE koptitel de niveau-aanduiding (H1, H2 of H3) als klein label, zodat de sitebouwer weet welk opmaakniveau hij moet gebruiken. De belangrijkste zoekersvragen (zie punt 4) staan als eigen H2/H3-kop IN deze structuur; alleen een eventueel kort restvragen-blok "Veelgestelde vragen" komt onderaan, met de vraagtitels als H3.
3. Meta: 2 varianten meta-title en 2 varianten meta-description, elk strikt volgens de META-REGELS hieronder (titel 40-60 tekens, description 120-155 tekens); vermeld per variant het tekenaantal tussen haakjes.
4. Zoekersvragen: 4 tot 6 echte vragen die de zoekintentie dekken (People Also Ask uit de top-10, long-tail in vraagvorm). GEEN los FAQ-blok als vergaarbak: de belangrijkste 1 à 3 vragen krijgen een eigen kop in de contentflow van sectie 2 (zoals "Kan [afwijking] verbeteren?" als volwaardige H2), de restvragen komen in een kort "Veelgestelde vragen"-blok onderaan. FAQ-rich-results toont Google sinds mei 2026 niet meer; beloof ze nergens. De waarde zit in de vraag-en-antwoordtekst zelf (long-tail-rankings en AI Overviews).
5. Interne links: welke andere pagina's naar deze pagina linken en met welke ankertekst.
6. Beeld-briefs: kort wat voor beeld/alt-tekst per sectie.
UITGANGSPUNT BEHOUD: vertrek van de bestaande pagina-inhoud + het overgenomen plan en de taken. Geef de PERFECTE invulling voor deze landingspagina: behoud wat er al staat en voldoet aan de criteria + de top-10-eisen, en voeg alleen toe of herschrijf wat daaruit ontbreekt. Maak per sectie duidelijk of het BEHOUDEN, AANPASSEN of NIEUW is. Baseer de structuur op de top-10-analyse van het gekozen zoekwoord.
INTENTIE-DOSERING: lees uit de top-10 de mix informatief/commercieel af en doseer de commerciële laag daarnaar. Bij een overwegend informatieve SERP blijft commercieel beperkt tot een kort blok met een interne link (bijvoorbeeld naar de kosten- of behandelpagina), geen volledige kosten- of verkoopsecties; bij een overwegend commerciële SERP mag de commerciële laag dragend zijn.
Werk conform de Pingwin-criteria: H2-dekking 60-80% (target 70%, criterium H2-01), primair zoekwoord front-loaded in de meta-title (META-03), title 40-60 tekens (META-02), meta-description 120-155 tekens (META-07), FAQ 4-8 vragen die een zoekwoord/long-tail bevatten (FAQ-02/03), en een variantenlijst van 10-15 semantische varianten (KW-04, §17).
Gegrond in de data hieronder; verzin geen rankings.

${META_RULES_PROMPT}

RELEVANTE CRITERIA:
${SEO_CRITERIA_MD}

${DOCSPEC_FORMAT}`;

const COPY_SYSTEM = `Je bent een senior SEO-copywriter bij bureau Pingwin en schrijft publicatieklare landingspagina-copy. Dit is het INTERNE, technische copy-document (voor het team, niet voor de klant): het bevat de scorecard, de metadata met tekencounts, het behoud-overzicht én de volledige copy.
Werk tegen deze harde criteria: primair zoekwoord in de eerste 100 woorden; H2-koppen dekken 60-80% van de zoekwoorden; natuurlijke keyword-density 0,5-2%; semantische varianten ≥60% gedekt; open met een direct antwoord op de zoekintentie; antwoorden op zoekersvragen/FAQ 40-80 woorden. Volg de blauwdruk in de plaatsing van zoekersvragen: de belangrijkste als eigen kop in de contentflow, alleen restvragen in een kort "Veelgestelde vragen"-blok.
Toon van de copy zelf: warm, deskundig, passend bij het klantprofiel; geen holle marketingtaal, concreet en to-the-point.
UITGANGSPUNT BEHOUD: hergebruik bestaande zinnen/alinea's van de huidige pagina waar die goed zijn en voldoen aan de criteria; herschrijf alleen waar nodig en vul aan met wat de blauwdruk/top-10-analyse vereist. In de copy zit alles uit het plan, de taken en de analyse verwerkt.

Lever het document met EXACT deze secties, in deze volgorde:
1. Sectie "Scorecard & gate-verdict": één table-blok met kolommen Criterium | Status | Waarde, met per relevant criterium-ID (H1-01/02, H2-01, KW-01 t/m KW-04, META-02, META-07, CON-02, FAQ-02, FAQ-05, AEO-02/03, CON-07, CVR-01/02) de status (PASS/FAIL/PARTIAL) en de gemeten waarde (bijv. H2-dekking 67%, density 1,22%, variantdekking 87%, FAQ 6 vragen, title 59 tekens). Begin de sectie met een paragraph "GATE: PASS/FAIL" met het aantal CRITICAL/MAJOR-failures en een korte conclusie of de copy publicatieklaar is.
2. Sectie "SEO-metadata": één table-blok met kolommen Element | Waarde | Tekens, met de URL-slug, de meta-title (met tekenaantal) en de meta-description (met tekenaantal).
3. Sectie "Behoud-overzicht": één paragraph met het behoud-principe, daarna één table-blok met kolommen Sectie | Actie | Toelichting (actie = BEHOUDEN/AANGEPAST/VERVANGEN/NIEUW).
4. Sectie "Volledige copy": de H1 (subheading), per H2 de kop (subheading) + de alineatekst (paragraph-blokken), eventuele bullets. De belangrijkste zoekersvragen staan als eigen kop-sectie in de contentflow (zoals de blauwdruk ze plaatst); alleen restvragen komen in een kort blok "Veelgestelde vragen over [onderwerp]" (het blok als subheading, elke vraag daaronder óók als subheading, met het antwoord als paragraph). Zet vóór ELKE koptitel de niveau-aanduiding (H1, H2 of H3) als klein label; restvraag-titels in dat blok krijgen altijd H3, zodat de sitebouwer het juiste opmaakniveau ziet.
Gegrond in de data hieronder; verzin geen gemeten waarden die niet uit de data volgen.

${META_RULES_PROMPT}

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
  // Ruim genoeg zodat de volledige copy (onderaan het interne copy-document) niet
  // wordt afgekapt; de klantversie neemt die tekst hieruit over.
  return out.join("\n").slice(0, 20000);
}

// Robuuste JSON-extractie uit een AI-antwoord: strip code-fences, en val terug
// op de substring van de eerste "{" tot de laatste "}" als er tekst omheen staat.
// Geeft null als er echt geen geldige JSON in zit (bijv. afgekapt antwoord).
function extractJsonObject(raw: string): { titel?: unknown; ondertitel?: unknown; sections?: unknown } | null {
  const cleaned = (raw || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const noTrailingCommas = (s: string) => s.replace(/,\s*([}\]])/g, "$1");
  const tryParse = (s: string): { titel?: unknown; ondertitel?: unknown; sections?: unknown } | null => {
    try { const p = JSON.parse(s); return p && typeof p === "object" ? p : null; } catch { return null; }
  };
  // Kandidaten: hele tekst, en de substring van eerste { tot laatste } (voor als er
  // tekst omheen staat). Elk ook met trailing komma's opgeruimd (veelvoorkomende AI-fout).
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  const substr = first >= 0 && last > first ? cleaned.slice(first, last + 1) : "";
  for (const cand of [cleaned, noTrailingCommas(cleaned), substr, noTrailingCommas(substr)]) {
    if (!cand) continue;
    const p = tryParse(cand);
    if (p) return p;
  }
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
  const raw = await callClaude(CHAT_SAMENVATTING_SYSTEM, [{ role: "user", content: user }], 8192, { slug, action: "strategie" });
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

// ═══════════════════════════════════════════════════════════
// VAN EEN GESPREK EEN DOCUMENT
// ═══════════════════════════════════════════════════════════
// Alles hierboven hangt aan één pagina. Een bird's eye-analyse doet dat niet: die
// gaat over de hele site (cannibalisatie, link equity, locatiepagina's) en stond
// daardoor alleen in de chat. Deze variant werkt op het gesprek zelf, zodat je er
// met één knop een deelbaar document van maakt.
const GESPREK_DOC_SYSTEM = `Je bent een senior SEO-strateeg bij bureau Pingwin. Je zet een intern gesprek/analyse over de site van een klant om in één leesbaar adviesdocument DAT DE KLANT ZELF LEEST.
AANSPREEKVORM: gericht aan de eigenaar van de site. Spreek direct aan met "jullie/je" ("jullie site", "we stellen voor"). Nooit in de derde persoon over de klant praten.
GEWONE TAAL: geen vakjargon zonder uitleg. Gebruik je een vakterm (cannibalisatie, link equity, canonical), leg hem in dezelfde zin in gewone woorden uit, of vermijd hem. Zoekwoorden zet je vet met **dubbele sterretjes**. Geen emoji.
VERZIN NIETS: alles komt uit het gesprek hieronder. Staat er een cijfer, pagina of zoekwoord in, neem dat letterlijk over; staat het er niet in, laat het weg.
GEEN CHAT-SPOREN: geen "zoals ik hierboven zei", geen verwijzingen naar de chat, geen vragen aan de lezer, geen interne opmerkingen over het dashboard of de weekplanning.
Bouw het document als volgt op (sla een sectie zonder inhoud stilzwijgend over):
1. Waar het over gaat: drie tot vier zinnen. Wat hebben we bekeken en waarom is dat belangrijk voor jullie vindbaarheid.
2. Wat we zien: de bevindingen, elk kort en concreet, met de pagina's erbij waar het over gaat.
3. Wat we voorstellen: de aanpak, per punt één begrijpelijke regel met wat we doen en waarom.
4. Wat jullie hiervan gaan merken: twee tot drie zinnen over het verwachte effect en de termijn. Beloof niets hards.
5. Wat we van jullie nodig hebben: alleen als het gesprek daar iets over zegt (teksten, akkoord, toegang). Anders weglaten.
${DOCSPEC_FORMAT}`;

/**
 * Maakt van een bird's eye-antwoord (of een heel gesprek) één klantklaar document.
 * Niet aan een pagina gebonden: `titelHint` is bijvoorbeeld de titel van de chat.
 */
export async function gesprekDocSpec(slug: string, gesprek: string, titelHint?: string, extra?: string): Promise<{ spec: DocSpec; title: string }> {
  const client = await getClientBySlug(slug);
  const user = `KLANT: ${client?.name || slug}${client?.domain ? ` (${client.domain})` : ""}${titelHint ? `\nONDERWERP VAN HET GESPREK: ${titelHint}` : ""}

GESPREK/ANALYSE:
${gesprek.slice(0, 60000)}${extra ? `\n\nEXTRA STURING: ${extra}` : ""}`;
  const raw = await callClaude(GESPREK_DOC_SYSTEM, [{ role: "user", content: user }], 8192, { slug, action: "gesprek-document" });
  const parsed = extractJsonObject(raw);
  if (!parsed || !Array.isArray(parsed.sections) || !parsed.sections.length) {
    throw new Error("De analyse kon niet worden opgemaakt (het AI-antwoord kwam onvolledig terug). Probeer het opnieuw, of maak het gesprek iets korter.");
  }
  const title = typeof parsed.titel === "string" && parsed.titel.trim() ? parsed.titel.trim() : (titelHint || "Advies");
  const spec: DocSpec = {
    klant: client?.name || slug,
    rapporttype: "Advies",
    titel: title,
    ondertitel: typeof parsed.ondertitel === "string" ? parsed.ondertitel : "Opgesteld door Pingwin",
    meta: {
      Klant: client?.name || slug,
      Datum: new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }),
    },
    sections: parsed.sections as DocSpec["sections"],
  };
  return { spec, title };
}

// Document voor de cannibalisatie-stap: vertelt het verhaal van de cannibalisatie-
// analyse zelf. GEEN nieuwe data-ronde, GEEN herbeoordeling van de pagina; alleen
// wat er in de analyse staat, leesbaar voor de klant en exact voor de developer.
const CANNIBAL_DOC_SYSTEM = `Je bent een senior SEO-strateeg bij bureau Pingwin. Je maakt het OPLEVER-rapport van een CANNIBALISATIE- EN CONTENT-MAPPING-analyse voor één landingspagina, NADAT de mens de voorstellen heeft beoordeeld. Je baseert je UITSLUITEND op de aangeleverde analyse en de beslissingen; je verzint niets, je doet GEEN nieuwe beoordeling van de pagina zelf (geen opmerkingen over koppen, teksten, meta of zoekwoordgebruik van de winnende pagina).
DE BESLISSINGEN PER RIJ ZIJN LEIDEND (indien meegeleverd): AFGEWEZEN voorstellen presenteer je NIET als actie maar alleen in de afgewezen-sectie mét de opgegeven reden; OPGESCHOVEN punten alleen in de opgeschoven-sectie; NOG NIET BEOORDEELD laat je volledig weg. In de developer-lijsten staan ALLEEN geaccepteerde acties.
AANSPREEKVORM: gericht aan de eigenaar van de site; spreek de lezer direct aan met "jullie/je". Zoekwoorden zet je vet met **dubbele sterretjes**. Geen jargon zonder uitleg in één zin. Geen emoji.
Lever precies deze secties (sla een sectie zonder inhoud stilzwijgend over):
1. Wat is cannibalisatie en waarom keken we hiernaar: drie tot vier zinnen in gewone taal (meerdere pagina's op jullie site strijden om hetzelfde zoekwoord, Google twijfelt dan welke hij moet tonen, dat kost posities; we hebben per voorstel bewust besloten wat we doen).
2. Wat eruit kwam: welke pagina de duidelijke winnaar is en waarom (in gewone taal, bijvoorbeeld sterkste pagina met de meeste klikken en links), en kort welke pagina's meededen en welke rol ze hebben.
3. Wat we hebben doorgevoerd: per geaccepteerde pagina één begrijpelijke regel (wat en waarom). Staat in de beslissingen dat een 301 live gecontroleerd is, vermeld dat expliciet ("doorgevoerd en live gecontroleerd").
4. Bewust opgeschoven: punten die we oppakken wanneer we die pagina's zelf onder handen nemen (het advies staat daar al klaar).
5. Ingepland als aparte taak: de grotere punten die als eigen taak op de kortetermijnplanning staan (met eigen werkdocument), elk in één regel met wat er gaat gebeuren.
6. Bewust niet doorgevoerd: de afgewezen voorstellen, elk met de reden, zodat de klant ziet dat er een bewuste afweging is gemaakt.
7. Voor de developer: de exacte lijst geaccepteerde 301-redirects (tabel met kolommen "Van", "Naar" en "Status", waarbij Status "doorgevoerd, live gecontroleerd" of "doorgevoerd" is volgens de beslissingen) en de exacte lijst interne links (tabel met kolommen "Vanaf", "Naar" en "Ankertekst"), LETTERLIJK uit het developer-overzicht. Blijft er niets over, zeg dat dan kort.
8. Wat jullie hiervan gaan merken: twee tot drie zinnen (één sterke pagina in plaats van versnippering; oude links blijven werken door de doorverwijzingen; effect is na enkele weken zichtbaar).
${DOCSPEC_FORMAT}`;

export async function cannibalDocSpec(slug: string, url: string, analysis: string, devContent: string, decisions = ""): Promise<{ spec: DocSpec; title: string }> {
  const client = await getClientBySlug(slug);
  const user = `Pagina (de winnaar): ${url}\n\nCANNIBALISATIE- EN CONTENT-MAPPING-ANALYSE:\n${analysis.slice(0, 16000)}\n\n${decisions ? `${decisions}\n\n` : ""}DEVELOPER-OVERZICHT (alleen geaccepteerde acties; letterlijk overnemen in de developer-sectie):\n${devContent.slice(0, 6000)}`;
  const raw = await callClaude(CANNIBAL_DOC_SYSTEM, [{ role: "user", content: user }], 8192, { slug, action: "page_cannibal_doc" });
  const parsed = extractJsonObject(raw);
  if (!parsed) throw new Error("Het cannibalisatie-document kon niet worden opgemaakt (het AI-antwoord kwam onvolledig terug). Probeer het opnieuw.");
  const title = typeof parsed.titel === "string" && parsed.titel.trim() ? parsed.titel.trim() : "Cannibalisatie & content mapping";
  const spec: DocSpec = {
    klant: client?.name || slug,
    rapporttype: "Cannibalisatie & content mapping",
    titel: title,
    ondertitel: typeof parsed.ondertitel === "string" ? parsed.ondertitel : url,
    meta: { Klant: client?.name || slug, Pagina: url },
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
  };
  return { spec, title };
}

// Achtergrond-document bij een cannibalisatie-TAAK (knop "Taak maken" bij een
// tabel-rij): het voorstel, de diepere duiding op basis van echte GSC-data, en
// concrete stappen, zodat je bij het oppakken precies weet wat en waarom.
const CANNI_TASK_DOC_SYSTEM = `Je bent een senior SEO-strateeg bij bureau Pingwin. Je maakt het WERKDOCUMENT bij één ingeplande taak die uit een cannibalisatie-analyse komt. Je baseert je UITSLUITEND op de meegegeven analyse-regel en de duiding (die op echte GSC-data is gebaseerd); je verzint niets.
AANSPREEKVORM: gericht aan het team dat de taak oppakt; helder en direct. Zoekwoorden vet met **dubbele sterretjes**. Geen jargon zonder uitleg in één zin. Geen emoji.
Lever precies deze secties:
1. Waar deze taak vandaan komt: twee tot drie zinnen (uit de cannibalisatie-analyse van de landingspagina; wat het voorstel was en waarom er een aparte taak van is gemaakt in plaats van direct uitvoeren).
2. De situatie in cijfers: de kern uit de duiding, met de belangrijkste zoektermen, posities en klikken van beide pagina's (mag als kleine tabel).
3. Wat er moet gebeuren: concrete, genummerde stappen (gebruik het advies uit de duiding; bij taalvarianten bijvoorbeeld hreflang-koppeling + volledige vertaling).
4. Wanneer is het klaar: twee tot vier meetbare checks (bijvoorbeeld: hele pagina in de juiste taal, hreflang in beide richtingen aanwezig, beide pagina's zelf-canonical, posities stabiel na enkele weken).
${DOCSPEC_FORMAT}`;

export async function canniTaskDocSpec(slug: string, winnerUrl: string, rowPath: string, rowLine: string, duiding: string): Promise<{ spec: DocSpec; title: string }> {
  const client = await getClientBySlug(slug);
  const user = `Landingspagina (winnaar) waar de analyse over ging: ${winnerUrl}\nPagina waar deze taak over gaat: ${rowPath}\n\nVOORSTEL UIT DE ANALYSE-TABEL:\n${rowLine || "(regel niet gevonden)"}\n\nDIEPERE DUIDING (op echte GSC-data):\n${duiding.slice(0, 8000)}`;
  const raw = await callClaude(CANNI_TASK_DOC_SYSTEM, [{ role: "user", content: user }], 6000, { slug, action: "canni_taak_doc" });
  const parsed = extractJsonObject(raw);
  if (!parsed) throw new Error("Het taak-document kon niet worden opgemaakt (het AI-antwoord kwam onvolledig terug). Probeer het opnieuw.");
  const title = typeof parsed.titel === "string" && parsed.titel.trim() ? parsed.titel.trim() : `Taak ${rowPath}`;
  const spec: DocSpec = {
    klant: client?.name || slug,
    rapporttype: "Cannibalisatie-taak",
    titel: title,
    ondertitel: typeof parsed.ondertitel === "string" ? parsed.ondertitel : rowPath,
    meta: { Klant: client?.name || slug, Pagina: rowPath },
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
  };
  return { spec, title };
}

// Document voor de interne-links-stap (stap 6): vertelt het verhaal van het
// interne-links-voorstel. GEEN nieuwe data-ronde; alleen wat er in het voorstel
// staat, leesbaar voor de klant en exact voor de developer.
const INTERNAL_LINKS_DOC_SYSTEM = `Je bent een senior SEO-strateeg bij bureau Pingwin. Je maakt het rapport van een INTERNE-LINKS-analyse voor één landingspagina: welke andere pagina's van de site gaan naar deze pagina linken. Je baseert je UITSLUITEND op het aangeleverde voorstel; je verzint niets en voegt geen eigen beoordeling toe.
AANSPREEKVORM: gericht aan de eigenaar van de site; spreek de lezer direct aan met "jullie/je". Zoekwoorden en ankerteksten zet je vet met **dubbele sterretjes**. Geen jargon zonder uitleg in één zin. Geen emoji.
Lever precies deze secties:
1. Waarom interne links: drie tot vier zinnen in gewone taal (links vanaf jullie eigen pagina's vertellen Google welke pagina belangrijk is en geven de kracht van sterke pagina's door; bezoekers vinden de pagina er ook makkelijker door).
2. Wat we hebben gedaan: twee tot drie zinnen (we hebben de site doorzocht naar pagina's die het onderwerp al raken, gewogen op hun autoriteit via externe links en hun bezoekersaantallen, en daar de beste kansen uit gekozen).
3. De voorgestelde links: een tabel met kolommen "Vanaf", "Ankertekst" en "Waarom", LETTERLIJK overgenomen uit het voorstel (elke rij één link naar de doelpagina). Neem de relevantie-getallen NIET mee in dit document; de kolom "Waarom" volstaat.
4. Wat jullie hiervan gaan merken: twee tot drie zinnen (de pagina wordt beter vindbaar doordat de eigen site er vaker en logischer naartoe verwijst; effect is na enkele weken zichtbaar).
${DOCSPEC_FORMAT}`;

const SCHEMA_DOC_SYSTEM = `Je bent een senior SEO-strateeg bij bureau Pingwin. Je maakt het KORTE oplever-document van de structured data voor één pagina, leesbaar voor de klant én de developer (samen één document, maximaal ~2 pagina's).
Baseer je UITSLUITEND op het aangeleverde advies; verzin niets.
Lever deze secties, elk kort en in gewone taal:
1. Wat we doen: welke structured data (schema.org) we op deze pagina toevoegen, per onderdeel één regel in begrijpelijke taal.
2. Waarom dit belangrijk is: betere weergave in Google en betere herkenbaarheid voor AI-zoekmachines (eerlijk: geen garantie, wel een bewezen sterke basis).
3. Voor de developer: dat de exacte code in het losse .json-bestand in dezelfde Drive-map staat, dat die letterlijk geplakt kan worden (in de head of via de gebruikte SEO-plugin), en dat na plaatsing gecontroleerd wordt met de Rich Results Test (search.google.com/test/rich-results) en validator.schema.org.
4. Aandachtspunten: alleen als die er zijn (aangeleverd), bijv. bestaande plugin-schema of gegevens die de klant nog moet bevestigen.
Geen em-dash of en-dash. Geen emoji. ${DOCSPEC_FORMAT}`;

// Kort combi-document (klant + developer) voor de structured data van één pagina.
export async function schemaDocSpec(slug: string, url: string, advies: string, warnings: string[]): Promise<{ spec: DocSpec; title: string }> {
  const client = await getClientBySlug(slug);
  const user = `Pagina: ${url}\n\nADVIES (bron):\n${advies.slice(0, 12000)}${warnings.length ? `\n\nAANDACHTSPUNTEN:\n- ${warnings.join("\n- ")}` : ""}`;
  const raw = await callClaude(SCHEMA_DOC_SYSTEM, [{ role: "user", content: user }], 4000, { slug, action: "page_schema_doc" });
  const parsed = extractJsonObject(raw);
  if (!parsed) throw new Error("Het structured-data-document kon niet worden opgemaakt (het AI-antwoord kwam onvolledig terug). Probeer het opnieuw.");
  const title = typeof parsed.titel === "string" && parsed.titel.trim() ? parsed.titel.trim() : "Structured data";
  const spec: DocSpec = {
    klant: client?.name || slug,
    rapporttype: "Structured data",
    titel: title,
    ondertitel: typeof parsed.ondertitel === "string" ? parsed.ondertitel : url,
    meta: { Klant: client?.name || slug, Pagina: url },
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
  };
  return { spec, title };
}

export async function internalLinksDocSpec(slug: string, url: string, proposal: string): Promise<{ spec: DocSpec; title: string }> {
  const client = await getClientBySlug(slug);
  const user = `Doelpagina (waar de links naartoe gaan): ${url}\n\nINTERNE-LINKS-VOORSTEL:\n${proposal.slice(0, 16000)}`;
  const raw = await callClaude(INTERNAL_LINKS_DOC_SYSTEM, [{ role: "user", content: user }], 8192, { slug, action: "page_internal_links_doc" });
  const parsed = extractJsonObject(raw);
  if (!parsed) throw new Error("Het interne-links-document kon niet worden opgemaakt (het AI-antwoord kwam onvolledig terug). Probeer het opnieuw.");
  const title = typeof parsed.titel === "string" && parsed.titel.trim() ? parsed.titel.trim() : "Interne links";
  const spec: DocSpec = {
    klant: client?.name || slug,
    rapporttype: "Interne links",
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
  copy: `Lever eerst deze korte secties: 1. Waar de nieuwe teksten over gaan (kernboodschap en toon, kort); 2. Welke zoekwoorden erin verwerkt zijn (bullets, elk zoekwoord vet); 3. Wat dit voor jullie vindbaarheid betekent (kort). Lever DAARNA een sectie met kop "De volledige webteksten (lees na en corrigeer)" waarin je de VOLLEDIGE paginacopy uit het bronstuk overneemt: de H1 (subheading), elke H2 met de kop (subheading) + de alineatekst (paragraphs), eventuele bullets, en de zoekersvragen precies zoals ze in het bronstuk staan: vragen met een eigen kop in de contentflow op die plek laten, en het eventuele restvragen-blok "Veelgestelde vragen over [onderwerp]" als subheading met elke vraag daaronder óók als subheading, met het antwoord als paragraph. Zet vóór ELKE koptitel de niveau-aanduiding (H1, H2 of H3) als klein label; restvraag-titels krijgen altijd H3, zodat de sitebouwer het juiste opmaakniveau ziet. Neem die teksten letterlijk over uit het bronstuk. Laat de scorecard, criteria-ID's, tekencounts en het behoud-overzicht WEG (dat is intern). Zo krijgt de klant de uitleg én de complete tekst om te corrigeren in één document.`,
};

// Vaste openingsalinea voor de copy-klantversie (letterlijk, niet door AI gegenereerd).
const COPY_CLIENT_INTRO = "Op basis van de SEO-analyse, de blauwdruk en de top 10-analyse hebben we deze copy ontwikkeld die voldoet aan de perfecte invulling voor deze pagina. Uiteraard heb jij veel meer verstand van jouw vak en je bedrijf dan wij, dus vragen we je wel om deze teksten goed door te nemen en aan te passen waar nodig. Als je deze teksten (al dan niet aangepast) terugstuurt, dan zullen wij ze op de juiste, SEO-geoptimaliseerde manier in de website verwerken.";

// KERNPRODUCT: de copy-stap schrijft de VOLLEDIGE landingspagina-copy in één klant-document
// (geen korte samenvatting). Losstaand van de korte klant-samenvatting die analyse/blauwdruk
// gebruiken: alleen de 3 uitleg-secties zijn kort, sectie 4 is de complete, uitgeschreven pagina.
const COPY_CLIENT_SYSTEM = `Je bent een senior SEO-copywriter bij bureau Pingwin en schrijft de VOLLEDIGE, publicatieklare landingspagina-copy voor deze pagina, in één document dat de klant naleest en corrigeert. Dit is het KERNPRODUCT: lever de best denkbare, complete invulling. Absoluut GEEN samenvatting en GEEN opsomming van wat er zou moeten komen: schrijf de daadwerkelijke paginatekst volledig uit.
BRON: baseer je op de gemeten data, de blauwdruk en de analyse hieronder (primair + secundaire zoekwoorden, zoekintentie, welke invalshoeken de best scorende top-10-concurrenten behandelen, en wat de huidige pagina mist). Verzin geen feiten, cijfers, locaties of diensten die niet uit de data of het bedrijf volgen; ken je een concreet detail niet, schrijf dan een natuurlijke, corrigeerbare zin (de klant vult aan).
SCHRIJF ECHT UIT, GEEN SHORTCUTS:
- Dek ALLE relevante invalshoeken die de top-10-winnaars dekken, PLUS wat de pagina nu mist. Reken op 6 tot 9 H2-secties.
- Elke H2 krijgt een VOLLE alinea van circa 80 tot 150 woorden (meer mag), nooit één losse zin. Gebruik binnen een sectie bullets waar dat de leesbaarheid helpt.
- Open met een direct antwoord op de zoekintentie; zet het primaire zoekwoord in de eerste 100 woorden en verwerk de secundaire/variant-zoekwoorden natuurlijk door de hele tekst (keyword-density 0,5-2%, geen stuffing).
- Voeg waar passend een sectie met concrete praktijkvoorbeelden toe (elk voorbeeld een eigen H3-kop met een korte beschrijving).
- Verwerk 6 tot 8 echte zoekersvragen (long-tail, People Also Ask), elk met een echt antwoord van 40 tot 80 woorden. De belangrijkste 1 à 3 vragen krijgen een eigen H2-sectie in de contentflow; de restvragen komen als H3-koppen in een kort blok "Veelgestelde vragen" onderaan. Geen FAQ-vergaarbak die de hele pagina herhaalt.
- Sluit af met een korte, wervende call-to-action (H3).

KOPPEN — VARIATIE, GEEN STUFFING (cruciaal, dit ging eerder mis):
- MAXIMAAL circa 70% van alle koppen (H1/H2/H3 samen) mag het primaire zoekwoord of een variant bevatten; boven 80% oogt onnatuurlijk en telt als keyword stuffing (criterium H2-01). De overige koppen zijn natuurlijke sectietitels die het onderwerp dekken ZONDER het zoekwoord.
- Herhaal NOOIT vrijwel hetzelfde woord in elke kop. Varieer met synoniemen, deelonderwerpen en werkwoorden (bijv. "Onze werkwijze", "Onderhoud op abonnement", "Veelgestelde vragen") in plaats van steeds dezelfde term.
- LOKAAL ZOEKWOORD (met een plaatsnaam, zoals "hovenier Etten-Leur"): zet de PLAATSNAAM in HOOGUIT 2 à 3 koppen (de H1 en één of twee andere), NIET in elke kop. De overige koppen dekken de dienst/het subthema zonder de plaatsnaam. De plaats verwerk je natuurlijk in de lopende tekst, niet in elke titel.
- NOOIT meer dan 1 à 2 koppen ACHTER ELKAAR met dezelfde plaatsnaam/hetzelfde zoekwoord. Wissel af.
- FAQ: de meeste vragen gaan over de DIENST (kosten, planten, onderhoud, werkwijze, doorlooptijd, garantie), NIET over de plaats. HOOGUIT 1 à 2 FAQ-vragen mogen de plaatsnaam bevatten; de rest zonder.
- Geen bullet-lijst waarin (bijna) elke bullet de plaatsnaam herhaalt (bijv. géén "wat wij doen in [plaats]"-lijst met de plaats in elke regel). Noem in zo'n lijst de DIENSTEN zelf; de plaats hooguit één keer in de inleidende zin.
- Koppen lezen als een echte sectietitel, niet als een Google-zoekopdracht.
- CONTROLEER JEZELF vóór je oplevert: tel hoeveel koppen de plaatsnaam/het zoekwoord bevatten en of er reeksen achter elkaar zijn; herschrijf tot het klopt (dit wordt ook automatisch gecontroleerd).
TOON: warm, deskundig, passend bij het bedrijf; concreet en to-the-point, geen holle marketingtaal. Behoud goede bestaande zinnen van de huidige pagina waar die voldoen; herschrijf/vul aan waar de blauwdruk en top-10 dat vragen.

LEVER HET DOCUMENT MET EXACT DEZE SECTIES, in deze volgorde:
1. Sectie "Waar de nieuwe teksten over gaan" — KORT (kernboodschap en toon, een paar zinnen).
2. Sectie "Welke zoekwoorden erin verwerkt zijn" — KORT (bullets, elk concreet zoekwoord vet met **dubbele sterretjes**).
3. Sectie "Wat dit voor jullie vindbaarheid betekent" — KORT (een paar zinnen).
4. Sectie "De volledige webteksten (lees na en corrigeer)" — VOLLEDIG. Begin met de paginatitel (meta-title) en de meta-description (elk als subheading met de waarde als paragraph eronder). Daarna de complete copy: de H1 (subheading) + de intro-alinea, per H2 de kop (subheading) + de volledige alineatekst (paragraph-blokken) + eventuele bullets, de praktijkvoorbeelden (elk een subheading), de zoekersvragen op hun plek in de contentflow plus het eventuele korte restvragen-blok "Veelgestelde vragen" (het blok als subheading, elke vraag daaronder als subheading met het antwoord als paragraph), en tot slot de call-to-action.
Zet vóór ELKE koptitel in sectie 4 de niveau-aanduiding (H1, H2 of H3) als klein label vóór de tekst; restvraag-titels en praktijkvoorbeelden zijn altijd H3, zodat de sitebouwer het juiste opmaakniveau ziet. Alleen de secties 1 t/m 3 zijn kort; sectie 4 is de volledige, uitgeschreven pagina.
Laat de scorecard, criteria-ID's, tekencounts en het behoud-overzicht WEG (dat is intern). Geen emoji.

${META_RULES_PROMPT}

RELEVANTE CRITERIA (naslag voor jezelf, niet als tekst in het document):
${SEO_CRITERIA_MD}

${DOCSPEC_FORMAT}`;

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
  // Copy-klantversie bevat óók de volledige tekst, dus ruimer tokenbudget.
  const raw = await callClaude(system, [{ role: "user", content: user }], kind === "copy" ? 9000 : 3500, { slug, action: "klantversie" });
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
  // Ook in de klantversie van de copy horen de H1/H2/H3-labels op de paginakoppen.
  if (kind === "copy") await ensureHeadingLabels(spec, slug).catch(() => { /* vangnet is aanvulling */ });
  return { spec, title };
}

// ── Agentische redeneer-stap (NOC-splitspatroon: DENKEN los van FORMATTEREN) ──
// De AI redeneert eerst agentisch met read-only meet-tools (dieper graven waar hij
// twijfelt, een winnende concurrent volledig uitmeten om te modelleren) en dwingt
// een VOLLEDIGE slotconclusie af. Die rijke tekst voedt daarna de formatteer-stap.
// Zo krijgen we Cowork-diepgang zonder het "agentisch + direct JSON = fragiel"-risico.
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
  return callClaudeAgentic(system, [{ role: "user", content: user }], tools, run, 4, 5000, { action: "strategie_grounding" });
}

type ParsedDoc = { titel?: unknown; ondertitel?: unknown; sections?: unknown };

// ── Reparatie van afgekapte JSON (antwoord raakte het tokenbudget) ──
// Sluit een open string en openstaande accolades/haken; lukt parsen dan nog niet,
// knip dan terug tot het laatste complete element en probeer opnieuw. Zo redden we
// het document (hooguit het allerlaatste blok ontbreekt) i.p.v. de hele stap te laten falen.
function closersFor(s: string): string | null {
  const stack: string[] = [];
  let inStr = false, esc = false;
  for (const ch of s) {
    if (esc) { esc = false; continue; }
    if (inStr) { if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") { if (stack.pop() !== ch) return null; }
  }
  return (inStr ? '"' : "") + stack.reverse().join("");
}
function repairTruncatedJson(raw: string): ParsedDoc | null {
  let s = (raw || "").replace(/```json/gi, "").replace(/```/g, "");
  const start = s.indexOf("{");
  if (start < 0) return null;
  s = s.slice(start).trimEnd();
  for (let attempt = 0; attempt < 60 && s.length > 2; attempt++) {
    const closers = closersFor(s);
    if (closers != null) {
      try {
        const p = JSON.parse(s + closers);
        if (p && typeof p === "object" && Array.isArray((p as ParsedDoc).sections)) return p as ParsedDoc;
      } catch { /* terugknippen en opnieuw */ }
    }
    const cut = Math.max(s.lastIndexOf("},"), s.lastIndexOf('",'), s.lastIndexOf("],"));
    if (cut <= 0) return null;
    s = s.slice(0, cut + 1).trimEnd();
  }
  return null;
}

// Genereert één document uit een system-prompt, met één JSON-herkansing. Gooit als de
// JSON onparsebaar blijft (te lang/afgekapt).
async function runDocGen(system: string, baseUser: string, maxTokens: number, slug: string, kind: DocKind, action: string): Promise<ParsedDoc> {
  const raw1 = await callClaude(system, [{ role: "user", content: baseUser }], maxTokens, { slug, action });
  let parsed = extractJsonObject(raw1);
  let raw2 = "";
  if (!parsed) {
    const retryUser = `${baseUser}\n\nBELANGRIJK: geef UITSLUITEND geldige, VOLLEDIGE JSON terug volgens het formaat. Geen tekst eromheen en niet afkappen; houd het compact genoeg om de JSON helemaal af te maken.`;
    raw2 = await callClaude(system, [{ role: "user", content: retryUser }], maxTokens, { slug, action });
    parsed = extractJsonObject(raw2);
  }
  // Laatste redmiddel: afgekapte JSON dichtmaken (verliest hooguit het laatste blok).
  if (!parsed) {
    parsed = repairTruncatedJson(raw2) || repairTruncatedJson(raw1);
    if (parsed) console.warn(`[page-doc] ${kind}: afgekapte JSON gerepareerd (len1=${raw1.length} len2=${raw2.length}).`);
  }
  if (!parsed) {
    console.error(`[page-doc] ${kind}: JSON onparsebaar. len1=${raw1.length} len2=${raw2.length} tail=${JSON.stringify((raw2 || raw1).slice(-300))}`);
    throw new Error(`De ${kind} kwam niet als geldige JSON terug (waarschijnlijk te lang of afgekapt). Probeer het opnieuw; blijft het misgaan, laat het weten dan splitsen we het document.`);
  }
  return parsed;
}

// Bouwt de DocSpec uit de geparste JSON.
function buildDocSpec(parsed: ParsedDoc, audience: "intern" | "klant", kind: DocKind, clientName: string, url: string): { spec: DocSpec; title: string } {
  const title = typeof parsed.titel === "string" && parsed.titel.trim() ? parsed.titel.trim() : `${FALLBACK_TITLE[kind]} ${url}`;
  const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
  if (audience === "klant" && kind === "copy") sections.unshift({ heading: "", blocks: [{ type: "paragraph", text: COPY_CLIENT_INTRO }] });
  const spec: DocSpec = {
    klant: clientName,
    rapporttype: audience === "klant" ? `Klantversie ${RAPPORTTYPE[kind]}` : RAPPORTTYPE[kind],
    titel: title,
    ondertitel: typeof parsed.ondertitel === "string" ? parsed.ondertitel : url,
    meta: { Klant: clientName, Pagina: url },
    sections,
  };
  return { spec, title };
}

// ── Zelfcontrole op kop-herhaling in copy (tegen lokaal/eigennaam keyword stuffing) ──
const HEADING_STOP = new Set("de het een en of van voor met naar bij uit op in aan te je jij jullie uw we wij ons onze wat wie hoe waar waarom welke wanneer kan kunt ook nog al alle als dat dit die deze er is zijn was wordt worden meer per over tot dan om zo goede nieuwe hun ze zij ook ons".split(/\s+/));
function headingCore(text: string): string {
  return text.replace(/^\s*H[1-3]\s*[—:–\-]*\s*/i, "").trim();
}
// Meest herhaalde EIGENNAAM (plaats/merk) over de koppen: een woord dat MIDDEN in een kop
// met een hoofdletter voorkomt (dus geen gewoon onderwerp-woord als "strandtuin", dat alleen
// aan het kopbegin een hoofdletter krijgt). Plus hoe geclusterd het staat (reeks achter elkaar).
function dominantProperToken(headings: string[]): { token: string; count: number; pct: number; run: number } | null {
  if (headings.length < 4) return null;
  const cores = headings.map(headingCore);
  const inHeading = new Map<string, number>();
  const proper = new Set<string>();
  for (const core of cores) {
    const seen = new Set<string>();
    for (const m of core.matchAll(/[A-Za-zÀ-ÿ][A-Za-z0-9À-ÿ-]{2,}/g)) {
      const w = m[0]; const lw = w.toLowerCase();
      if (HEADING_STOP.has(lw)) continue;
      if (!seen.has(lw)) { seen.add(lw); inHeading.set(lw, (inHeading.get(lw) || 0) + 1); }
      if (m.index !== 0 && /^[A-ZÀ-Ý]/.test(w)) proper.add(lw); // hoofdletter, niet aan het kopbegin
    }
  }
  let token = "", count = 0;
  for (const [w, c] of inHeading) if (proper.has(w) && c > count) { token = w; count = c; }
  if (!token) return null;
  let run = 0, mx = 0;
  const re = new RegExp(`(^|[^a-z0-9\\u00e0-\\u00ff-])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9\\u00e0-\\u00ff-]|$)`, "i");
  for (const core of cores) { if (re.test(core)) { run++; if (run > mx) mx = run; } else run = 0; }
  return { token, count, pct: count / headings.length, run: mx };
}
async function reviseCopyHeadings(headings: string[], token: string, slug: string): Promise<string[] | null> {
  const system = `Je bent een senior SEO-copywriter. Hieronder de koppen van een landingspagina (met een H1/H2/H3-label vooraan). De naam/plaats "${token}" wordt te vaak in de koppen gebruikt (keyword stuffing), met reeksen achter elkaar en te veel in de FAQ. Herschrijf de koppen zo dat:
- hooguit ~40% van de koppen "${token}" bevat;
- NOOIT meer dan 1 à 2 koppen ACHTER ELKAAR "${token}" bevatten;
- FAQ-vragen vooral over de DIENST gaan (kosten, planten, onderhoud, werkwijze, doorlooptijd, garantie), niet over de plaats; hooguit 1 à 2 FAQ-vragen met "${token}";
- de koppen natuurlijk en gevarieerd blijven, als echte sectietitels.
Behoud de betekenis, de VOLGORDE en het H1/H2/H3-label vooraan elke kop. Verander een kop ALLEEN als dat nodig is om "${token}" te verminderen; laat goede koppen ongemoeid.
Geef UITSLUITEND een JSON-array met exact ${headings.length} strings in dezelfde volgorde terug. Geen tekst eromheen.`;
  const user = headings.map((h, i) => `${i + 1}. ${h}`).join("\n");
  const raw = await callClaude(system, [{ role: "user", content: user }], 1800, { slug, action: "copy_koppen_revisie" });
  try {
    const arr = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());
    if (Array.isArray(arr) && arr.length === headings.length && arr.every((x) => typeof x === "string" && x.trim())) return arr as string[];
  } catch { /* ongeldige JSON: origineel laten staan */ }
  return null;
}
// ── Vangnet: H1/H2/H3-labels op de copy-koppen afdwingen ──
// De prompt vraagt vóór elke koptitel een niveau-label (H1/H2/H3) voor de sitebouwer,
// maar het model laat dat soms weg. Ontbreekt het bij de meeste paginakoppen, dan
// kennen we de labels alsnog toe via één kleine herstel-aanroep.
async function ensureHeadingLabels(spec: DocSpec, slug: string): Promise<void> {
  const blocks: { type: "subheading"; text: string }[] = [];
  for (const sec of spec.sections) for (const b of sec.blocks || []) {
    if (b.type === "subheading" && typeof b.text === "string" && b.text.trim()) blocks.push(b);
  }
  if (blocks.length < 3) return;
  const unlabeled = blocks.filter((b) => !/^\s*H[1-3]\b/i.test(b.text));
  if (unlabeled.length <= 1) return; // (vrijwel) alles heeft al een label
  const system = `Je bent een senior SEO-copywriter. Hieronder alle tussenkoppen van een copy-document voor een landingspagina, in volgorde. Zet vóór elke kop die een PAGINAKOP is de juiste niveau-aanduiding: "H1 — " (precies één keer, de hoofdkop van de pagina), "H2 — " (sectiekoppen) of "H3 — " (subsecties, praktijkvoorbeelden, FAQ-vragen, call-to-action). Regels die GEEN paginakop zijn (zoals "Paginatitel (meta-title)", "Meta-description" of document-tussenkopjes) laat je EXACT ongewijzigd. Koppen die al een H-label hebben laat je ook ongewijzigd. Verander verder NIETS aan de tekst.
Geef UITSLUITEND een JSON-array met exact ${blocks.length} strings in dezelfde volgorde terug. Geen tekst eromheen.`;
  const user = blocks.map((b, i) => `${i + 1}. ${b.text}`).join("\n");
  const raw = await callClaude(system, [{ role: "user", content: user }], 2500, { slug, action: "copy_koplabels" }, LIGHT_MODEL);
  try {
    const arr = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());
    if (Array.isArray(arr) && arr.length === blocks.length && arr.every((x) => typeof x === "string" && x.trim())) {
      blocks.forEach((b, i) => { b.text = arr[i]; });
    }
  } catch { /* ongeldige JSON: origineel laten staan */ }
}

// Deterministische controle op de copy-koppen; corrigeert ALLEEN bij over-optimalisatie van
// een eigennaam/plaats (te veel koppen of reeksen achter elkaar). Gewone onderwerp-zoekwoorden
// (bv. "strandtuin" op 70%) blijven ongemoeid.
async function selfCheckCopyHeadings(spec: DocSpec, slug: string): Promise<void> {
  const blocks: { type: "subheading"; text: string }[] = [];
  for (const sec of spec.sections) for (const b of sec.blocks || []) {
    if (b.type === "subheading" && typeof b.text === "string" && /^\s*H[1-3]\b/i.test(b.text)) blocks.push(b);
  }
  const headings = blocks.map((b) => b.text);
  const rep = dominantProperToken(headings);
  if (!rep || (rep.pct < 0.5 && rep.run < 3)) return; // binnen de norm
  const revised = await reviseCopyHeadings(headings, rep.token, slug).catch(() => null);
  if (revised) blocks.forEach((b, i) => { b.text = revised[i]; });
}

// ── Pixel-correctielus voor meta title/description in gegenereerde documenten ──
// Het model kan geen pixels tellen; daarom meten we NA generatie de meta-waarden in
// het document (subheading "Paginatitel (meta-title)"/"Meta-description" met de waarde
// als paragraph eronder, of de SEO-metadata-tabel) en laten we een te brede of
// regel-brekende waarde gericht herschrijven. Alleen die ene regel wordt opnieuw
// gegenereerd, nooit het hele document.
type MetaSpot = { kind: MetaKind; get: () => string; set: (v: string) => void };

function findMetaSpots(spec: DocSpec): MetaSpot[] {
  const spots: MetaSpot[] = [];
  const kindOf = (label: string): MetaKind | null => {
    if (/meta[\s-]?description|meta[\s-]?beschrijving/i.test(label)) return "meta_description";
    if (/meta[\s-]?title|paginatitel/i.test(label)) return "meta_title";
    return null;
  };
  for (const sec of spec.sections || []) {
    const blocks = sec.blocks || [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      // Patroon 1: subheading met de meta-waarde als eerstvolgende paragraph.
      if (b.type === "subheading") {
        const kind = kindOf(b.text || "");
        const next = blocks[i + 1];
        if (kind && next && next.type === "paragraph" && (next.text || "").trim()) {
          spots.push({ kind, get: () => next.text, set: (v) => { next.text = v; } });
        }
      }
      // Patroon 2: SEO-metadata-tabel met rijen [Element, Waarde, Tekens].
      if (b.type === "table" && Array.isArray(b.rows)) {
        for (const row of b.rows) {
          const kind = kindOf(String(row[0] || ""));
          if (kind && typeof row[1] === "string" && row[1].trim()) {
            spots.push({
              kind,
              get: () => row[1] as string,
              set: (v) => { row[1] = v; if (row.length > 2) row[2] = `${[...v].length}`; },
            });
          }
        }
      }
    }
  }
  return spots;
}

/** De H1 en een korte samenvatting van de pagina, als stof voor de correctielus. */
function specSamenvatting(spec: DocSpec): { h1: string; context: string } {
  let h1 = "";
  const regels: string[] = [];
  for (const sec of spec.sections || []) {
    for (const b of sec.blocks || []) {
      if (b.type === "subheading" && b.text) {
        const kop = b.text.replace(/^\s*H[123]\s*[—–-]\s*/i, "").trim();
        if (!h1 && /^\s*H1\b/i.test(b.text)) h1 = kop;
        if (regels.length < 10) regels.push(kop);
      } else if (b.type === "paragraph" && b.text && regels.length < 10) {
        regels.push(b.text.slice(0, 220));
      }
    }
  }
  return { h1, context: regels.join("\n") };
}

async function enforceMetaInSpec(spec: DocSpec, slug: string, primary: string, merk = ""): Promise<void> {
  const spots = findMetaSpots(spec);
  if (!spots.length) return;
  const { h1, context } = specSamenvatting(spec);
  const titleSpot = spots.find((s) => s.kind === "meta_title");
  for (const spot of spots) {
    const huidig = spot.get().trim();
    const r = await perfectioneerMeta({
      kind: spot.kind,
      tekst: huidig,
      slug,
      keyword: primary,
      h1: h1 || undefined,
      // De description wordt tegen de (dan al gecorrigeerde) titel getoetst.
      title: spot.kind === "meta_description" ? titleSpot?.get().trim() : undefined,
      context,
      // Eigen woorden voor de laatste slag: de naam van het bedrijf is altijd
      // waar, dus daar mag mee aangevuld worden als de tekst te kort blijft.
      bouwstenen: [merk].filter(Boolean),
    });
    if (r.gewijzigd) {
      console.warn(`[page-doc] meta gecorrigeerd (${spot.kind}): ${metaVerdictText(spot.kind, r.tekst)}`);
      spot.set(r.tekst);
    }
    if (!r.ok) console.warn(`[page-doc] meta voldoet nog niet (${spot.kind}): ${r.issues.join("; ")}`);
  }
}

// audience "klant" (standaard): korte, klantvriendelijke versie.
// - analyse/blauwdruk: eerst de DIEPE technische fundering (geketend), daaruit het korte klantdoc.
// - copy: de VOLLEDIGE uitgeschreven pagina (kernproduct), geen samenvatting.
// audience "intern": de uitgebreide technische versie als afgeleverd document.
export async function generateDocSpec(slug: string, url: string, kind: DocKind, extra?: string, audience: "intern" | "klant" = "klant"): Promise<{ spec: DocSpec; title: string }> {
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

  // DE KETEN-POORT: spreekt de verse meting het vastgelegde plan of een eerdere
  // ketenstap hard tegen, dan blokkeert de generatie met een melding die zegt
  // wélke claim botst met wélk feit. Liever geen document dan twee documenten
  // die elkaar tegenspreken; één ongeverifieerde claim richting een klant kost
  // meer vertrouwen dan tien juiste claims opleveren.
  {
    const { vindKetenConflicten, ketenBlokkade } = await import("./keten-poort");
    const conflicten = await vindKetenConflicten(slug, context.text, chain);
    if (conflicten.length) throw new Error(ketenBlokkade(conflicten));
  }

  // Eén gegronde generatie op de gemeten data (pagina exact uitgemeten, GSC, Ahrefs
  // top-10, concurrenten, Core Web Vitals) + de keten. GEEN aparte agentische
  // denk-ronde meer: die schreef de analyse feitelijk twee keer (en mat concurrenten
  // opnieuw), waardoor een gewone pagina-analyse onnodig >10 min duurde. De diepte
  // (alle grounding) zit al in de context hieronder.
  // Klant-systeem: dezelfde grounding, maar meteen als korte klantversie geschreven
  // (geen aparte technische tussenstap meer). Scheelt fors in tokens en is leesbaarder.
  const klantLabel = { analyse: "SEO-analyse", blauwdruk: "blauwdruk", copy: "copy" }[kind];
  const klantSystem = `Je bent een senior SEO-strateeg bij bureau Pingwin. Maak op basis van de onderstaande gegevens een KORTE, begrijpelijke ${klantLabel} voor de KLANT (die het zelf leest). Verzin niets; baseer je uitsluitend op de gegevens.
AANSPREEKVORM: gericht AAN de eigenaar; spreek direct aan met "jullie/je" ("jullie pagina"), niet in de derde persoon over het bedrijf.
TAAL: gewone taal, geen jargon (of leg het in één zin uit), geen scorecard en geen technische tabellen met KD/CPC. Elk onderdeel kort (1 tot 3 zinnen of een paar bullets).
ZOEKWOORDEN VET: zet elk concreet zoekwoord vet met dubbele sterretjes, bijvoorbeeld **exclusieve tuinen**.
${CLIENT_STRUCTURE[kind]}
Geen emoji. ${DOCSPEC_FORMAT}`;
  // Copy is het kernproduct: schrijf de VOLLEDIGE pagina (eigen copywriter-prompt), niet de
  // korte klant-samenvatting die analyse/blauwdruk gebruiken. Ruim tokenbudget zodat 5.000+
  // woorden niet worden afgekapt.
  const clientName = client?.name || slug;
  const baseUser = `Maak de ${kind} op basis van deze gegevens:\n\n${context.text}${chain}`;

  // Twee-lagen voor analyse/blauwdruk (standaard klant): eerst de DIEPE, technische fundering
  // (volledige criteria-scoring + concurrentie-afweging). Die bewaren we als keten-bron zodat de
  // blauwdruk en copy op de volledige diepgang voortbouwen. Daaruit leiden we een KORT, begrijpelijk
  // klantdocument af dat wordt afgeleverd (aparte, goedkope verkleining).
  if (audience === "klant" && (kind === "analyse" || kind === "blauwdruk")) {
    const deepMax = kind === "blauwdruk" ? 10000 : 16000;
    const deepParsed = await runDocGen(SYSTEMS[kind], baseUser, deepMax, slug, kind, `doc_${kind}_diep`);
    const { spec: deepSpec } = buildDocSpec(deepParsed, "intern", kind, clientName, url);
    await savePageDocOutput(slug, url, kind, specToText(deepSpec)).catch(() => { /* keten is aanvulling */ });
    const { registerGeneratedVersion } = await import("./doc-versions");
    await registerGeneratedVersion(slug, url, kind, `${kind} (gegenereerd)`, "", specToText(deepSpec));
    return clientVersionSpec(slug, url, kind, specToText(deepSpec), extra);
  }

  // Overige gevallen: één generatie. copy (klant) = volledig uitgeschreven pagina;
  // audience "intern" = de diepe technische versie als afgeleverd document.
  const system = audience === "klant" ? (kind === "copy" ? COPY_CLIENT_SYSTEM : klantSystem) : SYSTEMS[kind];
  const maxTokens = audience === "klant" ? (kind === "copy" ? 16000 : 3500) : (kind === "blauwdruk" ? 10000 : 16000);
  const parsed = await runDocGen(system, baseUser, maxTokens, slug, kind, `doc_${kind}`);
  const { spec, title } = buildDocSpec(parsed, audience, kind, clientName, url);
  // Zelfcontrole (alleen copy): eerst H1/H2/H3-labels afdwingen (voor de sitebouwer),
  // daarna de kop-herhaling meten en gericht corrigeren.
  if (kind === "copy") {
    await ensureHeadingLabels(spec, slug).catch(() => { /* vangnet is aanvulling */ });
    await selfCheckCopyHeadings(spec, slug).catch(() => { /* controle is aanvulling */ });
    // Pixel-correctielus: te brede of regel-brekende meta-title/description gericht herschrijven.
    await enforceMetaInSpec(spec, slug, context.primary, clientName).catch(() => { /* correctie is aanvulling */ });
  }
  // Bewaar de tekst-uitkomst zodat de volgende stap in de keten erop voortbouwt.
  await savePageDocOutput(slug, url, kind, specToText(spec)).catch(() => { /* keten is aanvulling, niet kritisch */ });
  const { registerGeneratedVersion } = await import("./doc-versions");
  await registerGeneratedVersion(slug, url, kind, `${kind} (gegenereerd)`, "", specToText(spec));
  // De copy die naar de klant gaat, krijgt het vaste briefing-formaat: uitleg
  // over de aanpak, de zoekwoorden met hun reden, wat het voor de vindbaarheid
  // betekent, de meta's met pixel-oordeel en dan pas de volledige webteksten.
  if (kind === "copy" && audience === "klant") {
    try {
      const { buildCopyKlantSpec } = await import("./copy-doc-klant");
      const r = await buildCopyKlantSpec(slug, url);
      if (r.ok && r.spec) return { spec: r.spec, title: r.spec.titel };
    } catch { /* bij twijfel het gewone document, nooit een lege oplevering */ }
  }
  return { spec, title };
}
