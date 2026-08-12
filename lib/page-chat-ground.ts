import { getClientBySlug } from "./clients";
import { getClientUrls, getPagePlan, getPageClusterAdvice } from "./site-urls";
import { getGscForPage, getGscQueryPageMatrix } from "./google";
import { getTasks } from "./tasks";
import { callClaude, LIGHT_MODEL } from "./anthropic";
import { notitiesTekst } from "./notities";
import { fetchPageContent } from "./page-content";

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
  const [urls, plan, tasks, clusterAdvice, notities, live] = await Promise.all([
    getClientUrls(slug),
    getPagePlan(slug, url),
    getTasks(slug),
    getPageClusterAdvice(slug, url),
    notitiesTekst(slug).catch(() => ""),
    // Verse live-scrape van de geopende pagina, elke beurt opnieuw. Reden
    // (les uit de NOC-bijziendheid-casus, 12-08-2026): de gescande lijst kan
    // dagen tot weken oud zijn; de sitebouwer kan de pagina intussen aangepast
    // hebben. Een advies dat "ontbrekende" koppen noemt die er al staan,
    // ondergraaft het hele advies. Daarom altijd de actuele pagina erbij.
    fetchPageContent(url).catch(() => null),
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

  // Plannen van ANDERE pagina's: wie claimt welke zoekintentie? Dit is leidend
  // voor het aanwijzen van de bedoelde eigenaar (plan boven huidige ranking).
  const plannedLines = urls
    .filter((u) => (u.plan || "").trim() && normUrl(u.url) !== normUrl(url))
    .slice(0, 40)
    .map((u) => `- ${normUrl(u.url)}: ${(u.plan || "").replace(/\s+/g, " ").trim().slice(0, 200)}`);

  // De volledige bronconclusie(s) waaruit het cluster-advies komt: als context mee
  // in de grounding, zodat de chat hier de hele strategie als vertrekpunt heeft.
  // Alle bronconclusies gingen hier ongekort mee (5000 tekens per stuk, elke
  // beurt opnieuw). Dat was een stapel eigen tekst waar het antwoord zich aan
  // spiegelde, en het maakte elk antwoord langer dan het vorige. Alleen de meest
  // recente bronconclusie, en korter: als vertrekpunt is dat genoeg.
  const clusterFullContext = (() => {
    const full = Array.from(new Set(clusterAdvice.map((a) => (a.sourceAnalysis || "").trim()).filter(Boolean)));
    const laatste = full[full.length - 1];
    return laatste ? `CLUSTERANALYSE ALS CONTEXT (de bronconclusie waaruit dit advies komt; gebruik als vertrekpunt en toets aan de live feiten, schrijf hem niet over):\n${laatste.slice(0, 1500)}` : "";
  })();

  const liveStamp = new Date().toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" });

  const facts = [
    `KLANT: ${client?.name || slug} (domein: ${domain || "onbekend"})`,
    "",
    "KLANTPROFIEL (positionering, werkgebied, karakter):",
    (client?.seoProfile || "").trim() || "(NOG NIET INGEVULD, vraag hiernaar als het relevant is)",
    ...(notities ? ["", "NOTITIES VAN MAARTEN OVER DEZE KLANT (eigen aantekeningen: telefoontjes, afspraken, waarnemingen; betrouwbare achtergrond, hierin staat vaak wat de klant wel of juist niet wil):", notities] : []),
    "",
    `GEOPENDE PAGINA: ${url}`,
    ...(live && live.status !== null
      ? [
          `LIVE GECHECKT OP ${liveStamp} (zojuist opgehaald; dit is de actuele waarheid, de gescande lijst hieronder kan ouder zijn):`,
          `- HTTP-status: ${live.status}`,
          `- Live titel: ${live.title || "(geen)"}`,
          `- Live H1: ${live.h1 || "(geen)"}`,
          `- Live koppen (H2/H3): ${live.headings.length ? live.headings.slice(0, 20).join(" | ") : "(geen gevonden)"}`,
        ]
      : [
          `LIVE CHECK MISLUKT op ${liveStamp} (pagina niet bereikbaar vanuit het dashboard). Je leunt hieronder op de laatst GESCANDE gegevens; die kunnen verouderd zijn, en dat zeg je expliciet in je advies.`,
        ]),
    `GESCANDE STATUS (laatste site-scan): ${self ? (self.status ?? "onbekend") : "niet in de gescande lijst (mogelijk nog niet live)"}${self?.redirectTarget ? ` → ${self.redirectTarget}` : ""}`,
    `GESCANDE TITEL: ${self?.title || "onbekend"}`,
    `GSC-KLIKKEN (deze pagina): ${self ? self.gscClicks : "onbekend"}`,
    "",
    "ZOEKWOORDEN WAAROP DE GEOPENDE PAGINA RANKT (Search Console, 90 dagen):",
    kw.length ? kw.map((k) => `- "${k.keyword}": positie ${k.position}, ${k.clicks} klikken, ${k.impressions} vertoningen`).join("\n") : "- (geen GSC-data voor deze pagina)",
    "",
    "SITEBREED, ZOEKWOORD → PAGINA (top 60 op vertoningen, Search Console 90 dagen):",
    "Zo zie je welke pagina op welk zoekwoord rankt, en dus waar pagina's elkaar kannibaliseren.",
    matrixLines.length ? matrixLines.join("\n") : "- (geen sitebrede GSC-data)",
    "",
    "PAGINA'S MET HET MEESTE VERKEER (top 30 met details):",
    topPages.length ? topPages.map((u) => `- ${normUrl(u.url)} (${u.gscClicks} klikken, status ${u.status ?? "?"}) — ${u.title || ""}`).join("\n") : "- (nog geen site ingelezen)",
    "",
    `VOLLEDIGE PAGINALIJST (alle ${urls.length} bekende pagina's van deze site; dit is de complete spiegel):`,
    "Een pagina bestaat alleen als hij hier staat. Zeg NOOIT dat een pagina of onderwerp 'geen eigen pagina heeft' zonder deze volledige lijst te checken.",
    urls.length ? urls.slice(0, 400).map((u) => `- ${normUrl(u.url)}`).join("\n") : "- (nog geen site ingelezen)",
    "",
    "PLANNEN VAN ANDERE PAGINA'S (wie claimt welke zoekintentie; leidend voor het aanwijzen van de eigenaar):",
    plannedLines.length ? plannedLines.join("\n") : "- (andere pagina's hebben nog geen plan; wijst niemand deze intentie in het plan aan, laat de eigenaar dan uit de strategie/afspraak volgen en vraag het na, kies hem niet puur op de huidige ranking)",
    "",
    `HUIDIG PLAN VOOR DE GEOPENDE PAGINA: ${plan || "(nog geen plan)"}`,
    "",
    "MEEGEGEVEN CLUSTER-ADVIES (vanuit de analyse van een andere pagina; gebruik dit als vertrekpunt voor het doel en de zoekwoorden van deze pagina en toets het aan de live feiten):",
    clusterAdvice.length ? clusterAdvice.map((a) => `- ${a.advice}${a.sourceUrl ? ` (uit de analyse van ${normUrl(a.sourceUrl)})` : ""}`).join("\n") : "- (geen meegegeven cluster-advies)",
    ...(clusterFullContext ? ["", clusterFullContext] : []),
    "",
    "BESTAANDE TAKEN VOOR DEZE PAGINA:",
    pageTasks.length ? pageTasks.map((t) => `- [${t.fase || "geen fase"}] ${t.taak} (${t.status})`).join("\n") : "- (geen)",
  ].join("\n");

  return `Je bent een nuchtere, ervaren SEO-strateeg die adviseert voor een klant van bureau Pingwin. Je werkt gegrond, zoals in een goede sparringsessie: je durft door te vragen.

HARDE REGELS:
- Verzin NIETS over het bestaan of de ranking van een pagina. Gebruik alleen de live feiten hieronder en wat je via gereedschap ophaalt.
- Je hebt Search Console (rankings, klikken, vertoningen). Daarnaast heb je gereedschap dat je ZELF inschakelt wanneer het je advies scherper maakt. Wees niet zuinig als het telt, maar batch en vermijd overbodige calls:
  • ahrefs_keyword_volume: echt maandelijks zoekvolume, difficulty én zoekintentie van zoekwoorden (batch ze). Voor termkeuze, vergelijking en intentie-matching.
  • ahrefs_keyword_ideas: zoekwoord-ideeën rond een zaad-term, met volume. Om termen te vinden waar de klant nog NIET op rankt en de beste primaire/secundaire set te kiezen.
  • ahrefs_serp_top10: de top-10 van een zoekwoord (wie ranken er, hoe sterk). Voor top-10-analyse en om SERP-overlap tussen twee termen te bepalen.
  • ahrefs_url_organic_keywords: waar een URL (eigen of concurrent uit de top-10) op rankt. Voor content-gap.
  • ahrefs_site_authority: Domain Rating, verwijzende domeinen en backlinks van een domein of URL (eigen site of concurrent). Voor de autoriteits-vergelijking.
  • fetch_page_content: de echte on-page inhoud van een URL (titel, H1, koppen, tekst). Om te toetsen of de inhoud bij de intentie past en een content-gap te doen tegen de top-10.
  Verzin nooit zoekvolumes, rankings, Domain Ratings of aantallen backlinks; noem je ze, dan komen ze uit deze bronnen. Weet je iets niet en is er geen tool voor, zeg dat dan expliciet.
- Je kunt sitebreed redeneren: gebruik de zoekwoord→pagina-matrix om cannibalisatie te zien (bijv. de homepage die rankt op "hovenier [plaats]" terwijl er een aparte plaatspagina bestaat) en om de beste zoekterm voor een pagina te kiezen.
- VRAAG DOOR wanneer dat het advies beter maakt. Als het klantprofiel leeg is of je mist context die je nodig hebt (positionering: prijs vs exclusief/design vs duurzaam; werkgebied: regionaal vs landelijk; welke steden; doelgroep; gewenste term-focus), stel dan EERST één tot drie korte, gerichte vragen aan de gebruiker en wacht op antwoord voordat je een definitief advies geeft. Beter één vraag te veel dan een advies op aannames.
- Als de gebruiker profiel-informatie geeft, verwerk die en stel voor om het als klantprofiel te bewaren (dat kan de gebruiker doen in het veld "Klantprofiel" bovenaan de Pagina's-tab).
- Redirect nooit naar een URL die niet bestaat. Toets een redirect-doel aan de live status. Toets het plan-label altijd aan de echte ranking en titel.
- EEN STRATEGIE IS INTERN totdat de analyse (stap 2 van de documentenketen) hem tegen de verse meting heeft bevestigd. Vraagt de gebruiker om een strategie of chat-conclusie klaar te maken om naar de klant of de sitebouwer te sturen terwijl er nog geen analyse-document is, wijs daar dan kort op en adviseer eerst de analyse te draaien. Eén ongeverifieerde claim richting een klant kost meer vertrouwen dan tien juiste claims opleveren.
- VERS BOVEN GESCAND: de geopende pagina is zojuist live opgehaald (zie "LIVE GECHECKT OP" hieronder). Beweer NOOIT dat een kop, sectie, link of CTA op deze pagina "ontbreekt" zonder dat aan die live koppen (of aan fetch_page_content) getoetst te hebben; de gescande lijst kan verouderd zijn en de sitebouwer kan de pagina gisteren nog aangepast hebben. Geef je een volledige analyse of een advies met content-gaps, vermeld dan één keer kort waarop je feiten rusten: "live gecheckt op [datum/tijd]". Is de live check mislukt, zeg dan expliciet dat je op de laatste scan leunt en dat de pagina intussen veranderd kan zijn.
- Antwoord in NETTE markdown zodat het als rapport oogt: korte kopjes (## en ###), bullets, en waar het helpt een kleine tabel, bijvoorbeeld | Zoekwoord | Positie | Vertoningen | URL |. Houd het scanbaar, geen muur van tekst. Gebruik nergens emoji.
- Enkelvoud/meervoud en andere woordvormen tellen als GEDEKT: een H1 met "veranda's" dekt het zoekwoord "veranda" af. Beoordeel koppen op kern-overlap en propositie, niet op exacte woordvorm.
- SCHAAL JE ANTWOORD MEE MET DE VRAAG, EN HERHAAL JEZELF NOOIT. De eerste, brede vraag in een gesprek verdient de volledige analyse (kopjes, tabel, taken, plan). Een vervolgvraag verdient een KORT, direct antwoord dat alleen beantwoordt wat er gevraagd is: geen herhaalde tabel, geen herhaalde sectie "Taken", geen herhaald plan, geen samenvatting van wat je al eerder schreef. Alles wat eerder in dit gesprek staat geldt als bekend; verwijs ernaar in één zin ("zoals hierboven bij de zoekwoordkeuze") in plaats van het over te schrijven. Herhaal alleen iets als de gebruiker er expliciet om vraagt of als je conclusie echt verandert, en zeg dan wát er verandert en waarom. Vraagt de gebruiker om een samenvatting of eindconclusie, dan mag je wél alles bundelen; dat is de enige uitzondering.
- Doe je concrete aanbevelingen, benoem de taken dan duidelijk in je antwoord: geef een sectie "Taken" met per taak wat er moet gebeuren, de fase (Bouwen/Herbedraden/Opschonen) en of het SEO- of Dev-werk is. Benoem ook kort het nieuwe plan voor de pagina (rol, primair + secundair zoekwoord, actie, doel-URL). Je hoeft GEEN machineleesbaar blok toe te voegen; het systeem haalt de taken en het plan er zelf uit voor de accepteer-lijst. Stel je alleen een verhelderende vraag, benoem dan geen taken.

WERKWIJZE, WEEG ALTIJD DEZE INVALSHOEKEN AF (haal er actief data bij via de tools):
1. Zoekintentie: past de pagina bij de intentie van het zoekwoord? Toets met ahrefs_keyword_volume (intents) en de top-10.
2. Cannibalisatie: gebruik de sitebrede zoekwoord→pagina-matrix; ranken meerdere eigen pagina's op dezelfde term? Bepaal bij twijfel de SERP-overlap (ahrefs_serp_top10 voor beide termen).
3. Vraag/volume: is er genoeg zoekvolume (ahrefs_keyword_volume, ahrefs_keyword_ideas)? Verzin geen volumes.
4. Concurrentie/autoriteit: hoe sterk is de top-10 (domain rating uit ahrefs_serp_top10) en hoe sterk is de klant zelf (ahrefs_site_authority op het eigen domein)? Kan de klant hier realistisch winnen?
5. Content-gap: wat doen de top-10-pagina's dat deze pagina mist? Gebruik fetch_page_content (eigen + concurrent) en ahrefs_url_organic_keywords.
6. Commerciële waarde: is de term commercieel/transactioneel (CPC, intents)?
7. Positionering: sluit het aan bij het klantprofiel (prijs vs exclusief vs regionaal vs landelijk)?

DREMPELS EN REGELS (Pingwin-methodologie):
- Eén zoekintentie hoort bij één pagina (voorkom cannibalisatie).
- Een eigen pagina alleen bij voldoende vraag (richtlijn: vanaf ~100 zoekvolume per maand); daaronder aanhaken bij een bestaande pagina of als sectie.
- Een zoekwoord als variant/secundair meenemen vanaf ~50 zoekvolume.
- Twee termen SAMENVOEGEN als hun top-10 voor >50% dezelfde URL's toont (zelfde intentie); anders splitsen.
- Een locatiepagina alleen bij genoeg lokaal volume; anders de plaats als sectie op een bredere pagina.
- INTENTIE-DOSERING: lees uit de top-10 (ahrefs_serp_top10) de mix informatief/commercieel af en doseer je advies daarnaar. Is de SERP overwegend informatief (kennisbanken, ziekenhuizen, Wikipedia), dan wint een overwegend informatieve pagina; de commerciële laag blijft dan klein en dienend: een kort blok of een interne link (bijvoorbeeld naar de kosten- of behandelpagina), GEEN volledige kosten- of verkoopsecties. Is de SERP overwegend commercieel, dan mag de commerciële laag dragend zijn. De dosering volgt altijd de SERP, nooit de wens om meer te verkopen.
- ZOEKERSVRAGEN IN PLAATS VAN EEN LOS FAQ-BLOK: adviseer geen apart FAQ-blok als vergaarbak. De echte zoekersvragen (People Also Ask, long-tail met vraagvorm) verdienen elk een gewone kop in de contentflow met een direct antwoord van 40-80 woorden; alleen restvragen mogen in een kort "Veelgestelde vragen"-blok onderaan. FAQ-rich-results toont Google sinds mei 2026 niet meer; beloof ze nooit. De waarde zit in de vraag-en-antwoordtekst zelf (long-tail-rankings en AI Overviews), niet in het blok of de FAQPage-markup.
- BEPAAL DE EIGENAAR VAN EEN ZOEKINTENTIE VOLGENS DE STRATEGIE, NIET VOLGENS DE HUIDIGE RANKING. De bedoelde eigenaar is de pagina waarvan het PLAN dit zoekwoord als primair claimt (de gewenste bestemming), ook als die pagina nu nog niet het beste rankt of zelfs nog niet bestaat/rankt. De huidige rankings vertellen je alleen WAAR de waarde nu zit, zodat je weet wat je naar de eigenaar toe moet consolideren; ze zijn nooit reden om de strategie om te draaien. Adviseer dus NOOIT "gebruik de sterkere generieke pagina (zoals de homepage) maar" als er een specifieke pagina voor die intentie bedoeld is; versterk juist de bedoelde pagina en haal de waarde van de anderen daarheen (redirect, interne links, de ander herrichten op een eigen term). Alleen als GEEN enkele pagina die intentie in haar plan claimt, mag je de sterkste presteerder als voorlopige eigenaar voorstellen, maar zeg dat expliciet en vraag de gebruiker de strategische bedoeling te bevestigen.

CANNIBALISATIE OPLOSSEN (volg dit wanneer de gebruiker erom vraagt, of wanneer je meerdere eigen pagina's op dezelfde zoekintentie ziet):
1. Breng in kaart: gebruik de sitebrede zoekwoord→pagina-matrix (en waar nodig ahrefs_serp_top10 voor SERP-overlap) en maak een nette tabel per gedeeld zoekwoord met ALLE eigen URL's die erop ranken of erop mikken, met hun positie en vertoningen. Zo zie je precies waar de intentie versnipperd is.
2. Wijs de bedoelde eigenaar aan volgens de regel hierboven (plan boven ranking). Rankt een andere pagina nu beter, benoem dat als "waarde die naar de eigenaar moet", niet als reden om te wisselen. Wijst het plan nog geen eigenaar aan, zeg dat expliciet en vraag het na.
3. Geef per concurrerende pagina één concrete actie richting de eigenaar: 301-redirect naar de eigenaar, of interne link + de pagina herrichten op een eigen andere intentie, of samenvoegen. Benoem per actie de fase (meestal Opschonen voor redirects, Herbedraden voor interne links/ankers) en of het SEO- of Dev-werk is.
4. Zet het overzicht en de acties netjes in het plan (onder Acties), zodat het meteen uitvoerbaar is en je het aan de developer kunt geven.

Geef aan het eind een scherp, onderbouwd advies vanuit deze invalshoeken. Als de data ontbreekt of je twijfelt, haal hem op via de tools of stel een gerichte vraag.

Begin je antwoord DIRECT met de inhoud. Geen inleidende zinnen zoals "Alle data is binnen", "Nu kan ik een volledig beeld geven" of "Ik heb alles bekeken"; die voegen niets toe.

LIVE FEITEN:
${facts}`;
}

// Aparte, betrouwbare extractie: leest de (mogelijk lange) analyse en haalt er
// het plan + de taken uit als JSON. Zo kan het rapport zo lang zijn als nodig,
// terwijl de accepteer-lijst altijd compleet is (nooit afgekapt).
export async function extractProposal(analysis: string): Promise<Proposal | null> {
  if (!analysis.trim()) return null;
  const system = `Je krijgt een SEO-analyse voor een pagina. Haal er het voorgestelde PLAN voor de pagina en ALLE concrete TAKEN uit.
Antwoord met UITSLUITEND geldige JSON, niets eromheen, exact dit formaat:
{"plan": "<netjes opgemaakte markdown, zie hieronder>", "tasks": [{"taak": "korte omschrijving in één regel", "fase": "Bouwen|Herbedraden|Opschonen", "wie": "SEO|Dev"}]}
Het "plan"-veld is markdown met deze structuur (gebruik ECHT deze opmaak, geen run-on zin, geen emoji):
**Rol:** <rol van de pagina in één zin>

**Zoekwoorden**
- Primair: <primair zoekwoord>
- Secundair: <secundair zoekwoord/varianten>

**Acties**
- <actie 1>
- <actie 2>

**Doel-URL:** <doel-URL>

Regels: neem elke concrete taak uit de analyse mee (kort geformuleerd, één regel per taak). Laat "plan" weg als er geen duidelijk nieuw pagina-plan is; laat "tasks" weg als er geen taken zijn. Bevat de analyse geen concreet voorstel (bijvoorbeeld alleen een verhelderende vraag), antwoord dan met {}. Gebruik nergens emoji.
FASE per taak: neem de fase over zoals de analyse die aangeeft (bijvoorbeeld een sectie "Fase: Bouwen"). Bepaal je hem zelf, gebruik dan: "Bouwen" voor inhoud/on-page werk (H1, title, meta, tekst schrijven, nieuwe pagina, schema); "Herbedraden" ALLEEN voor interne links/ankers ompunten of content verplaatsen tussen pagina's; "Opschonen" voor redirects, canonical, dubbele content of oude termen weghalen. De meeste on-page-optimalisatietaken zijn dus "Bouwen", niet "Herbedraden".`;
  try {
    const raw = await callClaude(system, [{ role: "user", content: analysis.slice(0, 12000) }], 2500, { action: "voorstel" }, LIGHT_MODEL);
    const jsonText = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonText);
    const proposal: Proposal = {};
    if (typeof parsed.plan === "string" && parsed.plan.trim()) proposal.plan = parsed.plan.trim();
    if (Array.isArray(parsed.tasks)) {
      proposal.tasks = parsed.tasks
        .filter((t: { taak?: string }) => t && typeof t.taak === "string" && t.taak.trim())
        .map((t: { taak: string; fase?: string; wie?: string }) => ({ taak: t.taak.trim(), fase: t.fase || "", wie: t.wie || "SEO" }));
    }
    return (proposal.plan || proposal.tasks?.length) ? proposal : null;
  } catch {
    return null;
  }
}

// Verbergt een eventueel per ongeluk toegevoegd <voorstel>-blok uit de tekst.
export function parseProposal(text: string): { reply: string; proposal: Proposal | null } {
  const idx = text.search(/<voorstel>/i);
  if (idx === -1) return { reply: text.trim(), proposal: null };
  const reply = text.slice(0, idx).trim();
  const jsonPart = text.slice(idx).replace(/^<voorstel>/i, "").replace(/<\/voorstel>[\s\S]*$/i, "").trim();
  try {
    const parsed = JSON.parse(jsonPart);
    const proposal: Proposal = {};
    if (typeof parsed.plan === "string" && parsed.plan.trim()) proposal.plan = parsed.plan.trim();
    if (Array.isArray(parsed.tasks)) proposal.tasks = parsed.tasks.filter((t: { taak?: string }) => t && typeof t.taak === "string" && t.taak.trim());
    return { reply, proposal: (proposal.plan || proposal.tasks?.length) ? proposal : null };
  } catch {
    return { reply, proposal: null };
  }
}

// Pad van een URL, genormaliseerd voor vergelijking: zonder domein, zonder
// slash aan het eind, kleine letters. Zo matcht "/crp-test/" met
// "https://site.nl/crp-test" in elke schrijfwijze.
function pathKey(u: string): string {
  return normUrl(u).replace(/\/+$/, "").toLowerCase();
}

// Leest een analyse die ook ANDERE pagina's in het cluster raakt, en haalt er per
// betrokken andere pagina (uit de bekende URL-lijst) een kort advies uit. Zo kun je
// dat advies alvast als vertrekpunt aan die pagina's meegeven ("half plan").
//
// Betrouwbaarheid boven slimmigheid: pagina's waarvan het pad LETTERLIJK in de
// analysetekst staat, worden eerst in code gevonden en gegarandeerd als kandidaat
// meegegeven (vóór de klik-top), en in de opdracht expliciet benoemd. Paden die
// genoemd worden maar niet in de paginalijst bestaan, komen terug in notFound
// zodat de gebruiker dat te zien krijgt in plaats van een stil "0 pagina's".
export async function extractClusterAdvice(
  analysis: string,
  selfUrl: string,
  knownUrls: string[],
): Promise<{ items: { url: string; advice: string }[]; notFound: string[] }> {
  if (!analysis.trim()) return { items: [], notFound: [] };
  const all = knownUrls.filter((u) => pathKey(u) !== pathKey(selfUrl));
  if (all.length === 0) return { items: [], notFound: [] };
  const textLower = analysis.toLowerCase();

  // 1) Letterlijk genoemde bekende pagina's (deterministisch, in code).
  const mentioned = all.filter((u) => {
    const p = pathKey(u);
    return p.length > 1 && (textLower.includes(p + "/") || textLower.includes(p + " ") || textLower.includes(p + ")") || textLower.includes(p + ",") || textLower.includes(p + ".") || textLower.includes(p + "\n") || textLower.endsWith(p));
  });

  // 2) Paden die in de tekst staan maar NIET in de paginalijst (melden, niet raden).
  const knownPaths = new Set(all.map(pathKey).concat([pathKey(selfUrl)]));
  const pathTokens = Array.from(new Set(
    (analysis.match(/(?:^|[\s("'`])(\/[a-z0-9][a-z0-9\-_./]*)/gi) || [])
      .map((m) => m.replace(/^[\s("'`]+/, "").replace(/[).,;:'"`]+$/, ""))
      .map((p) => p.replace(/\/+$/, "").toLowerCase())
      .filter((p) => p.length > 3 && /[a-z]/.test(p) && !p.includes("//")),
  ));
  const notFound = pathTokens.filter((p) => !knownPaths.has(p));

  // 3) Kandidatenlijst: genoemde pagina's gegarandeerd voorop, daarna de rest
  //    (de lijst komt al gesorteerd op klikken binnen) tot maximaal 120.
  const rest = all.filter((u) => !mentioned.includes(u));
  const others = [...mentioned, ...rest].slice(0, Math.max(120, mentioned.length));

  const system = `Je krijgt een SEO-analyse die voor één pagina is gemaakt, maar die ook ANDERE pagina's van dezelfde site raakt (cluster/cannibalisatie). Hieronder staat de lijst met bestaande pagina's van deze site.
Bepaal voor welke ANDERE pagina's uit die lijst (niet de geanalyseerde pagina zelf) de analyse een concreet strategisch advies of een bedoelde rol bevat, en vat dat per pagina KORT en SCANBAAR samen.
Antwoord met UITSLUITEND geldige JSON, exact dit formaat, niets eromheen:
{"items":[{"url":"<exacte url uit de lijst>","advice":"<markdown, kort en scanbaar: één korte zin over de bedoelde rol van deze pagina, dan een lege regel, dan 2 tot 4 bullets die met '- ' beginnen, elk met een vet label. Bijvoorbeeld:\nDeze locatiepagina wordt de eigenaar van de stadsterm.\n\n- **Primair zoekwoord:** soa test amsterdam\n- **Actie:** niet meer concurreren op de generieke term 'soa test'\n- **Interne link:** ankertekst 'soa test Amsterdam' vanuit de homepage\nHou het puntig; geen lange alinea's.>"}]}
Regels: gebruik ALLEEN url's die exact in de lijst staan. Neem alleen pagina's op waarover de analyse echt iets concreets zegt; verzin niets. Wordt geen enkele andere pagina geraakt, antwoord dan met {"items":[]}. Gebruik nergens emoji.
${mentioned.length ? `\nDeze pagina's worden LETTERLIJK in de analyse genoemd; behandel die zeker (elk met een eigen item), tenzij er echt niets concreets over gezegd wordt:\n${mentioned.map((u) => `- ${u}`).join("\n")}\n` : ""}
BESTAANDE PAGINA'S:
${others.map((u) => `- ${u}`).join("\n")}`;
  try {
    // Bewust het volwaardige model: deze extractie is precisiewerk (welk advies
    // hoort bij welke pagina); het lichte model liet genoemde pagina's vallen.
    const raw = await callClaude(system, [{ role: "user", content: analysis.slice(0, 24000) }], 2000, { action: "cluster_advies" });
    const jsonText = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonText);
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const out: { url: string; advice: string }[] = [];
    const seen = new Set<string>();
    for (const it of items) {
      if (!it || typeof it.url !== "string" || typeof it.advice !== "string" || !it.advice.trim()) continue;
      const match = others.find((u) => pathKey(u) === pathKey(it.url));
      if (!match || seen.has(pathKey(match))) continue;
      seen.add(pathKey(match));
      out.push({ url: match, advice: it.advice.trim() });
    }
    return { items: out, notFound };
  } catch {
    return { items: [], notFound };
  }
}
