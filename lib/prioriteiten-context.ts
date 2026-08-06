/**
 * DE WEGING VAN DE PRIORITEITENSCAN, OP ÉÉN PLEK
 * ══════════════════════════════════════════════
 * Twee vragen per zoekwoord: hoe koopgericht is dit (intentie), en past het bij
 * deze klant (merk-fit). Ze stonden eerder verspreid door `prioriteiten-scan.ts`
 * met twaalf losse aanroepen; dat is precies de fout die het brein beschrijft
 * (dezelfde vraag op meerdere plekken loopt stil uiteen). Vandaar `weeg()`: één
 * ingang, één antwoord.
 *
 * Wat hier op 6 augustus 2026 is gerepareerd, na een nameting op Paul Hoevenaars:
 *
 * 1. **"Onbekend" kreeg de op één na hoogste waardering.** Alles wat op geen enkel
 *    woord matchte viel terug op "lokaal-commercial" (weging 0,9). Daardoor telde
 *    `zwembad tuin ideeen` bijna even zwaar als `tuinaanleg uden`. Wat we niet
 *    weten heet nu ook "onbekend" (0,5).
 * 2. **Het werkgebied was een vaste lijst van veertien grote steden.** Paul werkt
 *    rond Uden, Oss, Veghel en Den Bosch; geen van die plaatsen stond erin, dus
 *    geen van zijn lokale zoekwoorden werd als lokaal herkend. Het werkgebied
 *    wordt nu per klant afgeleid uit gemeten data, zie `bouwKlantContext`.
 * 3. **Koopsignalen waren acht Engelse-boekhandel-woorden** (kopen, bestellen,
 *    boeken…). Nederlanders tikken "tuin laten aanleggen" en "kosten hovenier".
 *    Die vorm wordt nu herkend.
 *
 * De getallen achter de weging staan NIET hier maar in
 * `skills/vindbaarheid-prioriteiten-scan/scoring-config.json`, samen met de rest
 * van de rekenkern.
 */

/** Wat de scan over deze klant weet. Eén keer per run gebouwd, daarna alleen gelezen. */
export type KlantContext = {
  /** De propositie-zin: wat deze klant wél en niet wil zijn. */
  propositie: string;
  /** Waar deze klant over gaat: uit het klantprofiel én uit de eigen pagina's. */
  kern: string[];
  /** De diensten die deze klant aantoonbaar verkoopt (uit eigen URL's en zoekwoorden). */
  dienstwoorden: string[];
  /** Het werkgebied: plaatsen waar deze klant aantoonbaar op mikt. */
  plaatsen: string[];
};

export const LEGE_CONTEXT: KlantContext = { propositie: "", kern: [], dienstwoorden: [], plaatsen: [] };

// ── Woordherkenning ───────────────────────────────────────────────────────
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Op hele woorden, nooit op losse letters: anders maakt "tuin" van "voortuin" een
 *  kernwoord en "vs" van "advies" een vergelijking. */
function bevatWoord(tekst: string, woord: string): boolean {
  const w = (woord || "").trim().toLowerCase();
  if (!w) return false;
  return new RegExp(`(^|[^a-zà-ü0-9])${esc(w)}([^a-zà-ü0-9]|$)`).test(tekst);
}

// Koopsignalen zoals mensen ze in het Nederlands intikken. "laten <werkwoord>"
// staat er als patroon bij: laten aanleggen, laten maken, laten plaatsen, laten
// onderhouden. Dat is één regel in plaats van een lijst die nooit af is.
const KOOP_WOORDEN = ["kopen", "bestellen", "offerte", "offertes", "prijs", "prijzen", "kosten",
  "tarief", "tarieven", "aanvragen", "boeken", "inhuren", "afsluiten", "abonnement", "korting"];
const KOOP_PATROON = /(^|[^a-zà-ü])laten\s+[a-zà-ü]+en([^a-zà-ü]|$)/;
const NABIJ_WOORDEN = ["in de buurt", "bij mij", "in de omgeving", "regio", "omgeving"];
const NAVIGATIE_WOORDEN = ["login", "inloggen", "contact", "klantenservice", "openingstijden", "vacature", "vacatures"];
// Oriënterend: iemand kijkt rond, koopt (nog) niet. Dit moet vóór de dienstwoord-
// toets, anders wordt "zwembad tuin ideeen" alsnog commercieel omdat er "tuin" in staat.
const ORIENT_WOORDEN = ["wat is", "hoe werkt", "hoe", "waarom", "uitleg", "betekenis", "verschil",
  "soorten", "voorbeelden", "ideeen", "ideeën", "inspiratie", "tips", "zelf", "diy", "afbeeldingen", "foto's"];
const VERGELIJK_WOORDEN = ["beste", "vergelijken", "vergelijking", "review", "reviews", "alternatief",
  "top 10", "welke", "advies", "specialist", "bedrijf", "bedrijven"];
// De oude vaste stedenlijst blijft staan als vangnet voor klanten waar we (nog)
// geen werkgebied uit de data kunnen halen. Hij vervangt niets meer, hij vult aan.
const GROTE_STEDEN = ["amsterdam", "rotterdam", "utrecht", "den haag", "eindhoven", "groningen",
  "tilburg", "almere", "breda", "nijmegen", "haarlem", "arnhem", "den bosch", "s-hertogenbosch"];

/**
 * Hoe koopgericht is dit zoekwoord? Volgorde is hard, want een zoekwoord kan op
 * meerdere emmers passen: koopsignaal wint van plaats, plaats wint van oriënteren,
 * oriënteren wint van "er staat een dienst in". Wat nergens op past is "onbekend",
 * en dat is met opzet geen hoge score.
 */
export function bepaalIntentie(keyword: string, ctx: KlantContext = LEGE_CONTEXT): string {
  const k = (keyword || "").toLowerCase().trim();
  if (!k) return "_onbekend";
  if (KOOP_WOORDEN.some((w) => bevatWoord(k, w)) || KOOP_PATROON.test(k)) return "transactional";
  if (NAVIGATIE_WOORDEN.some((w) => bevatWoord(k, w))) return "navigational";
  const plaatsen = ctx.plaatsen.length ? [...ctx.plaatsen, ...GROTE_STEDEN] : GROTE_STEDEN;
  if (plaatsen.some((p) => bevatWoord(k, p)) || NABIJ_WOORDEN.some((w) => bevatWoord(k, w))) return "lokaal-commercial";
  if (ORIENT_WOORDEN.some((w) => bevatWoord(k, w))) return "informational";
  if (VERGELIJK_WOORDEN.some((w) => bevatWoord(k, w))) return "commercial";
  if (ctx.dienstwoorden.some((d) => bevatWoord(k, d))) return "commercial";
  return "_onbekend";
}

// ── Merk-fit ──────────────────────────────────────────────────────────────
const BUDGET_WOORDEN = ["goedkop", "goedkoop", "voordelig", "budget", "lage prijs", "laagste prijs", "discount", "aanbieding", "afgeprijsd", "korting"];
const TEGEN_BUDGET = ["geen prijsvechter", "niet goedkoop", "niet de goedkoopste", "niet budget", "geen budget", "geen discount"];
const PREMIUM_PROP = ["premium", "luxe", "exclusief", "topkwaliteit", "hoogwaardig", "specialist"];
const PREMIUM_WOORDEN = ["premium", "luxe", "exclusief", "high-end", "topkwaliteit", "op maat"];

/**
 * Past dit zoekwoord bij wat de klant wil zijn? Onder de 0,4 vliegt het uit de
 * lijst, hoe hoog het volume ook is. Dat is de hele reden dat de scan om een
 * propositie-zin vraagt.
 */
export function bepaalFit(keyword: string, ctx: KlantContext = LEGE_CONTEXT): number {
  const k = (keyword || "").toLowerCase();
  const p = (ctx.propositie || "").toLowerCase();
  let overlap = 0;
  for (const kw of [...new Set([...ctx.kern, ...ctx.dienstwoorden])]) if (bevatWoord(k, kw)) overlap++;
  let base = Math.min(0.5 + 0.15 * overlap, 0.9);
  if (TEGEN_BUDGET.some((m) => p.includes(m)) && BUDGET_WOORDEN.some((b) => k.includes(b))) {
    return Math.round(Math.min(base, 0.25) * 100) / 100;
  }
  if (PREMIUM_PROP.some((m) => p.includes(m)) && PREMIUM_WOORDEN.some((b) => k.includes(b))) base = Math.min(base + 0.1, 1);
  if (overlap === 0 && !PREMIUM_PROP.some((m) => p.includes(m))) base = Math.min(base, 0.5);
  return Math.round(base * 100) / 100;
}

/** De enige ingang die de scan gebruikt: één zoekwoord in, de hele weging uit. */
export function weeg(keyword: string, ctx: KlantContext): { intentie: string; relevanceFit: number } {
  return { intentie: bepaalIntentie(keyword, ctx), relevanceFit: bepaalFit(keyword, ctx) };
}

// ── De context bouwen ─────────────────────────────────────────────────────
const STOP = new Set(["de", "het", "een", "en", "van", "voor", "met", "in", "op", "die", "dat", "wij",
  "we", "onze", "is", "zijn", "bij", "aan", "als", "ook", "naar", "door", "uit", "over", "meer",
  "worden", "wordt", "www", "nl", "com", "html", "php", "index", "home", "page"]);

/** Kernwoorden uit het klantprofiel: waar gaat deze klant volgens zijn eigen dossier over? */
export function kernwoordenUit(profiel: string, naam: string): string[] {
  const woorden = (profiel || "").toLowerCase().replace(/[^a-zà-ü0-9\s-]/g, " ").split(/\s+/)
    .filter((w) => w.length > 4 && !STOP.has(w));
  const telling = new Map<string, number>();
  for (const w of woorden) telling.set(w, (telling.get(w) || 0) + 1);
  const top = [...telling.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w]) => w);
  const merk = (naam || "").toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  return [...new Set([...top, ...merk])];
}

const woordenVan = (s: string) => (s || "").toLowerCase().replace(/[^a-zà-ü0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);

/**
 * Het werkgebied en het dienstenaanbod uit gemeten data, niet uit een vaste lijst.
 *
 * Hoe: een dienstwoord is een woord waarmee deze klant meerdere zoekwoorden of
 * pagina's begint (Paul begint er vijf met "hovenier" en drie met "tuinaanleg").
 * Wat er ACHTER een dienstwoord staat is een kandidaat-plaats. Om te voorkomen
 * dat "hovenier prijzen" van "prijzen" een dorp maakt, moet zo'n kandidaat zich
 * bewijzen: hij staat in een eigen pagina-URL (een echte locatiepagina), óf hij
 * staat achter twee verschillende diensten. Zo levert Paul precies zijn eigen
 * werkgebied op: den bosch, eindhoven, oss, uden, veghel.
 *
 * Deze aanpak onderhoudt zichzelf en werkt voor elke klant, ook voor klanten in
 * dorpen die in geen enkele stedenlijst voorkomen.
 */
export function leidWerkgebiedAf(zoekwoorden: string[], urls: string[]): { dienstwoorden: string[]; plaatsen: string[] } {
  // Pagina-paden als woordrijtjes: "/hovenier-den-bosch" wordt [hovenier, den, bosch].
  const padRijtjes = urls
    .map((u) => (u || "").replace(/^https?:\/\/[^/]+/i, "").replace(/[?#].*$/, ""))
    .flatMap((p) => p.split("/").filter(Boolean))
    .map(woordenVan)
    .filter((r) => r.length >= 1);
  const kwRijtjes = zoekwoorden.map(woordenVan).filter((r) => r.length >= 1);

  // Een dienstwoord opent minstens twee verschillende zoekwoorden of paden.
  const opening = new Map<string, Set<string>>();
  for (const r of [...kwRijtjes, ...padRijtjes]) {
    const kop = r[0];
    if (!kop || kop.length < 4 || STOP.has(kop)) continue;
    if (!opening.has(kop)) opening.set(kop, new Set());
    opening.get(kop)!.add(r.join(" "));
  }
  const dienstwoorden = [...opening.entries()].filter(([, s]) => s.size >= 2).map(([w]) => w);
  const isDienst = new Set(dienstwoorden);

  // Wat achter een dienstwoord staat is een kandidaat-plaats, met wie hem noemde erbij.
  const kandidaat = new Map<string, Set<string>>();
  const noteer = (rij: string[], bron: Set<string>) => {
    if (rij.length < 2 || !isDienst.has(rij[0])) return;
    const rest = rij.slice(1).join(" ");
    if (!rest || rest.length < 3) return;
    if (STOP.has(rest) || KOOP_WOORDEN.includes(rest) || ORIENT_WOORDEN.includes(rest)
      || VERGELIJK_WOORDEN.includes(rest) || NABIJ_WOORDEN.includes(rest)) return;
    if (!kandidaat.has(rest)) kandidaat.set(rest, new Set());
    for (const b of bron) kandidaat.get(rest)!.add(b);
  };
  const uitUrl = new Set<string>();
  for (const r of padRijtjes) { noteer(r, new Set(["url"])); if (r.length >= 2 && isDienst.has(r[0])) uitUrl.add(r.slice(1).join(" ")); }
  for (const r of kwRijtjes) noteer(r, new Set([r[0]]));

  // Bewijzen: in een eigen pagina-URL, of achter twee verschillende diensten.
  const plaatsen = [...kandidaat.entries()]
    .filter(([naam, bronnen]) => uitUrl.has(naam) || [...bronnen].filter((b) => b !== "url").length >= 2)
    .map(([naam]) => naam);
  return { dienstwoorden: [...new Set(dienstwoorden)], plaatsen: [...new Set(plaatsen)] };
}

/**
 * De volledige klantcontext. `zoekwoorden` en `urls` komen uit Search Console
 * (gemeten, laatste 90 dagen); `extraPlaatsen` uit de bedrijfsgegevens, want een
 * vestigingsplaats hoeft niet in de zoekwoorden voor te komen. Vorstenbosch, waar
 * Paul zit, is precies zo'n geval.
 */
export function bouwKlantContext(opties: {
  profiel: string; naam: string; propositie: string;
  zoekwoorden?: string[]; urls?: string[]; extraPlaatsen?: string[];
}): KlantContext {
  const { dienstwoorden, plaatsen } = leidWerkgebiedAf(opties.zoekwoorden || [], opties.urls || []);
  const extra = (opties.extraPlaatsen || []).map((p) => (p || "").toLowerCase().trim()).filter((p) => p.length > 2);
  return {
    propositie: opties.propositie || "",
    kern: kernwoordenUit(opties.profiel || "", opties.naam || ""),
    dienstwoorden,
    plaatsen: [...new Set([...plaatsen, ...extra])],
  };
}
