// ═══════════════════════════════════════════════════════════
// DE KETEN-POORT: GEEN DOCUMENT ALS DE STAPPEN ELKAAR TEGENSPREKEN
// ═══════════════════════════════════════════════════════════
// De documentketen (strategie → analyse → blauwdruk → copy) bouwt elke stap op
// de vorige. Als de verse meting van de pagina de vastgelegde strategie of een
// eerdere stap hard tegenspreekt (het plan zegt dat een sectie ontbreekt die
// live al bestaat, kiest een redirect-doel dat 404 geeft, noemt posities die
// niet kloppen), dan moet de keten BLOKKEREN in plaats van beide versies op te
// leveren. Eén ongeverifieerde claim richting een klant kost meer vertrouwen
// dan tien juiste claims opleveren (les uit de NOC-bijziendheid-casus,
// augustus 2026: de strategie noemde content-gaps die de sitebouwer net had
// gedicht, en de klant prikte daar direct doorheen).
//
// ───────────────────────────────────────────────────────────
// WAAROM DIT BESTAND ER ZO UITZIET (12 t/m 17 augustus 2026)
// ───────────────────────────────────────────────────────────
// Deze poort heeft VIER keer een pagina onterecht geblokkeerd, en de eerste
// drie keer is dat "opgelost" door er instructietekst bij te schrijven:
//   1. 12-08  poort gebouwd.
//   2. 14-08  blokkeerde op "H2-dekking moet 60-80%" tegenover een meting van
//             17%. Dat is geen tegenspraak, dat is het gat dat het document
//             hoort te dichten. Fix: extra alinea in de prompt.
//   3. 14-08  dertien minuten later dezelfde soort fout op de H1-lengte.
//             Fix: nog een alinea, nu vooraan in de prompt.
//   4. 17-08  /hovenier/oosterhout/ bestaat nog niet (HTTP 404). Het plan zegt
//             "deze pagina moet nieuw gebouwd worden", de meting zegt "404".
//             Die twee zijn het volledig met elkaar EENS. De controle schreef
//             zelfs letterlijk "dat klopt" en "Dit is geen conflict" IN het
//             conflict, en de poort blokkeerde er alsnog op.
// Dat vierde geval is het bewijs dat prompt-tekst het niet gaat oplossen: het
// model wist het goede antwoord en gaf het ook, maar had geen veld om het in
// te zetten, want het JSON-formaat kende alleen "conflicten". Alles wat het
// opschreef werd dus een blokkade. Daarom staan de sloten nu in de CODE:
//
//   A. Bestaat de pagina niet live, dan slaat de poort helemaal over. Er is
//      dan geen "verse meting van de bestaande pagina" om iets mee tegen te
//      spreken; elk plan is per definitie een bouwopdracht. Dit is een harde
//      if, geen instructie die een model kan negeren.
//   B. Elk conflict moet zelf "hard": true meesturen, mét een los "waarom"-veld
//      waarin het model zijn afweging kwijt kan. Twijfel schrijft het daar op
//      in plaats van in het conflict, en alleen hard === true blokkeert.
//   C. Een conflict dat zichzelf tegenspreekt ("dat klopt", "geen conflict",
//      "komt overeen") wordt door de code weggegooid, wat het model er ook bij
//      zet. Precies het geval van 17 augustus.
//   D. Een conflict dat een verhaal is in plaats van een feit (te lang) wordt
//      weggegooid: een harde tegenspraak past in één zin.
//   E. En het laatste vangnet zit buiten dit bestand: een geblokkeerd document
//      houdt een knop "Toch genereren". De poort kan dus nooit meer betekenen
//      dat er een halve dag stilstaat.
//
// Bewuste keuzes die blijven gelden:
// - Alleen HARDE, meetbare tegenspraken blokkeren. Een nuanceverschil of een
//   andere formulering is geen conflict; bij twijfel gaat de poort open.
// - Faalt de controle zelf (AI niet bereikbaar, JSON stuk), dan gaat de poort
//   open: de controle is een vangnet en mag nooit zelf de reden zijn dat er
//   niets meer gegenereerd kan worden.
// - De melding zegt precies wélke claim botst met wélk gemeten feit, en wat de
//   gebruiker moet doen (het plan bijwerken of toch doorgaan).
// ═══════════════════════════════════════════════════════════

import { callClaude, LIGHT_MODEL } from "./anthropic";
import { POORT_MARKERING } from "./keten-poort-melding";

export type KetenConflict = { claim: string; feit: string };

const POORT_SYSTEM = `Je controleert een SEO-documentketen op HARDE tegenspraken voordat de volgende stap gegenereerd wordt.
Je krijgt: (1) de verse, zojuist gemeten feiten van een BESTAANDE, live pagina (live koppen, titel, Search Console, top-10), en (2) het vastgelegde plan en eventuele eerdere ketenstappen.
BELANGRIJK OM TE BEGRIJPEN: deze hele documentketen bestaat OM verbeteringen voor te stellen tegen SEO-criteria (lengtes, dekkingspercentages, structuur). Elke analyse/blauwdruk/copy noemt daarom voortdurend dat een gemeten waarde een norm niet haalt en stelt een verbetering voor. DAT IS NOOIT EEN CONFLICT, ook al is het verschil groot; dat is het hele doel van het document. Vind UITSLUITEND harde, meetbare tegenspraken over de HUIDIGE WERKELIJKHEID, niet over of een norm gehaald wordt. Voorbeelden van een hard conflict:
- het plan of een eerdere stap zegt dat een sectie/kop/CTA/link NU AL ONTBREEKT of NU AL BESTAAT, terwijl de live koppen of de meting het tegendeel laten zien;
- er wordt een redirect of interne link voorgesteld naar een URL die volgens de meting niet bestaat (404);
- het plan of een eerdere stap noemt een HUIDIGE Search Console-positie of een HUIDIG zoekvolume dat meer dan een factor 2 afwijkt van de verse GSC/Ahrefs-data (geen criterium-norm, een letterlijk cijfer over de huidige situatie);
- het plan kiest een primair zoekwoord dat lijnrecht ingaat tegen wat een eerdere ketenstap vastlegde.
GEEN conflict (poort open laten), dit is GEEN uitputtende lijst maar de meest voorkomende valkuilen:
- ELK criterium/norm/doel uit de scorecard (lengte-normen zoals H1/meta, dekkingspercentages zoals H2-dekking, FAQ-aantallen, keyword density) vergeleken met de huidige gemeten waarde, en het voorstel om dat te verbeteren. Dat is per definitie de inhoud van deze documenten, nooit een conflict, ook niet als de huidige waarde ver onder de norm zit of de norm zelf ergens anders vandaan lijkt te komen. Alleen als het plan LETTERLIJK beweert dat de norm AL BEHAALD is ("H1 is al 45 tekens, voldoet") terwijl de meting iets heel anders laat zien, is dat wel een conflict.
- het plan stelt voor iets TOE TE VOEGEN, UIT TE BREIDEN of OP TE BOUWEN wat er volgens de meting nog niet is. Dat is geen tegenspraak maar overeenstemming: het plan bevestigt de meting en zegt wat er moet gebeuren. Ook een plan dat een pagina wil bouwen, herbouwen of samenvoegen valt hieronder.
- een andere formulering, een mening, een dosering, iets dat de meting niet kan zien (bijvoorbeeld tekst onderaan de pagina die niet in de eerste koppen zit), of ontbrekende data.
Bij twijfel: geen conflict. Twijfel je tussen "dit is een norm-vs-meting-verbetervoorstel" en "dit is een conflict", kies dan ALTIJD geen conflict.
Antwoord met UITSLUITEND geldige JSON, exact dit formaat, niets eromheen:
{"conflicten":[{"claim":"wat het plan of de eerdere stap beweert, kort","feit":"wat de verse meting laat zien, kort","hard":true,"waarom":"waarom dit wel of niet een echte tegenspraak is"}]}
REGELS VOOR DE VELDEN, hier gaat het meestal mis:
- "claim" en "feit" zijn elk MAXIMAAL ÉÉN KORTE ZIN met alleen het feit zelf. Geen uitleg, geen afweging, geen "maar", geen "echter", geen tweede zin. Je hele redenering hoort in "waarom", nooit in "claim" of "feit".
- "hard" is true ALLEEN als het plan en de meting elkaar echt uitsluiten en niet allebei waar kunnen zijn. Kom je tot de conclusie dat het klopt, dat het overeenkomt, of dat het geen conflict is, zet dan hard op false.
- Zet twijfelgevallen gewoon in de lijst met hard: false; ze worden dan niet geblokkeerd. Laat nooit een geval met hard: true staan waarvan je in "waarom" schrijft dat het klopt of geen conflict is.
Geen tegenspraken: {"conflicten":[]}. Maximaal 5 conflicten, de hardste eerst. Geen emoji.`;

// SLOT C: een "conflict" dat in zijn eigen tekst zegt dat het klopt, is geen
// conflict. Dit is geen slimmigheid maar het letterlijke geval van 17-08-2026:
// de controle schreef "de pagina retourneert HTTP 404 en heeft noindex, dat
// klopt (...) Dit is geen conflict met de huidige situatie" en de poort ging
// er alsnog op dicht.
const ZELFWEERLEGGEND = [
  "geen conflict", "geen tegenspraak", "geen echte tegenspraak", "geen echt conflict",
  "dat klopt", "dit klopt", "klopt met", "komt overeen", "kloppen met elkaar",
  "niet in strijd", "bevestigt de meting", "bevestigt dit", "sluit hierop aan",
  "is consistent", "consistent met", "in lijn met", "geen probleem",
];

// SLOT D: een harde tegenspraak past in één zin. Alles daarboven is een
// beschouwing, en een beschouwing hoort de keten niet dicht te gooien.
const MAX_VELDLENGTE = 300;

function isEchtConflict(claim: string, feit: string): boolean {
  if (!claim || !feit) return false;
  if (claim.length > MAX_VELDLENGTE || feit.length > MAX_VELDLENGTE) return false;
  const samen = `${claim} ${feit}`.toLowerCase();
  return !ZELFWEERLEGGEND.some((z) => samen.includes(z));
}

// Vindt harde tegenspraken tussen de verse meting en het plan/de eerdere
// ketenstappen. Geeft [] terug bij twijfel, bij een niet-bestaande pagina én
// bij een falende controle.
//
// paginaLeeft: staat de pagina live (HTTP < 400 en uitleesbaar)? Zo niet, dan
// slaat de poort over (SLOT A). Standaard true, zodat een aanroeper die het
// niet weet de oude, strengere route houdt.
export async function vindKetenConflicten(
  slug: string,
  contextText: string,
  chain: string,
  opts?: { paginaLeeft?: boolean },
): Promise<KetenConflict[]> {
  // SLOT A: bestaat de pagina nog niet, dan is er niets live om tegen te
  // spreken. Elk plan voor zo'n pagina is een bouwopdracht, en een bouwopdracht
  // kan per definitie niet botsen met een meting die zegt dat de pagina er nog
  // niet is. Harde uitgang vóór er ook maar een model aan te pas komt.
  if (opts && opts.paginaLeeft === false) return [];

  // Zonder plan en zonder eerdere stappen valt er niets tegen te spreken.
  const heeftPlan = /OVERGENOMEN PLAN VOOR DEZE PAGINA \(de strategische conclusie, leidend\): (?!\(nog geen plan)/.test(contextText);
  if (!heeftPlan && !chain.trim()) return [];
  try {
    const user = `VERSE METING EN VASTGELEGD PLAN:\n${contextText.slice(0, 16000)}\n${chain ? `\nEERDERE KETENSTAPPEN:\n${chain.slice(0, 8000)}` : ""}`;
    const raw = await callClaude(POORT_SYSTEM, [{ role: "user", content: user }], 1200, { slug, action: "keten_poort" }, LIGHT_MODEL);
    const parsed = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());
    const lijst = Array.isArray(parsed.conflicten) ? parsed.conflicten : [];
    return lijst
      .filter((c: { claim?: string; feit?: string; hard?: unknown }) => {
        if (!c || typeof c.claim !== "string" || typeof c.feit !== "string") return false;
        // SLOT B: alleen een expliciet hard oordeel blokkeert. Ontbreekt het
        // veld of staat het op false, dan is dit een observatie, geen poort.
        if (c.hard !== true) return false;
        return isEchtConflict(c.claim.trim(), c.feit.trim());
      })
      .slice(0, 5)
      .map((c: { claim: string; feit: string }) => ({ claim: c.claim.trim(), feit: c.feit.trim() }));
  } catch {
    return [];
  }
}

// De nette blokkade-melding voor in het scherm: welke claim botst met welk
// feit, en wat de gebruiker moet doen om verder te kunnen. De laatste regel is
// belangrijk: er is altijd een uitweg, dus dit is nooit een halve dag zoeken.
export function ketenBlokkade(conflicten: KetenConflict[]): string {
  const regels = conflicten.map((c) => `• Het plan zegt: ${c.claim} — maar de verse meting laat zien: ${c.feit}`).join("\n");
  return `${POORT_MARKERING} de verse meting van de pagina spreekt de vastgelegde strategie of een eerdere stap tegen.\n${regels}\nWerk eerst het plan bij (of leg de strategie opnieuw vast via de chat, die meet de pagina dan vers). Vind je dit onterecht, klik dan op "Toch genereren"; dan slaat deze controle één keer over.`;
}

// De markering en de herkenner staan in lib/keten-poort-melding.ts (zonder
// AI-afhankelijkheden, want de schermen gebruiken ze ook).
export { POORT_MARKERING, isPoortBlokkade } from "./keten-poort-melding";
