// meta-machine.ts — de correctielus van de meta-motor, op één plek.
//
// lib/meta-rules.ts weet WAT er moet kloppen (pixels, tekens, zoekwoord, CTA).
// Dit bestand zorgt dat het ook ECHT klopt in wat we opleveren: het model kan
// geen pixels tellen, dus meten wij na en laten we gericht herschrijven tot de
// tekst door de opleverpoort komt.
//
// Waarom dit bestand er is: dezelfde lus stond drie keer los uitgeschreven (in
// page-doc voor de documenten, in meta-ctr voor de voorstellen, en de
// klantversie deed helemaal niets). Ze liepen uit elkaar, en juist daardoor kon
// een titel van 380 px het klantdocument in, waar de pixel-motor hem twee
// alinea's verderop afkeurde als "te kort, ruimte onbenut". Eén bron, dus
// iedereen die een meta uitlevert, levert dezelfde kwaliteit.
//
// ── Waarom er tóch te korte meta's bleven komen, en wat eraan gedaan is ──
//
// De lus bestond, maar hij was een poging, geen garantie. Vier dingen:
//
//   1. We vertelden het model een tekenaantal en rekenden het af op pixels, en
//      die twee liepen niet gelijk. Opgelost in meta-rules.ts: de pixel is de
//      norm, het tekenbereik wordt daaruit afgeleid en aan de tekst zelf
//      gemeten.
//   2. Het model hoorde alleen DAT het mis was, niet hoevéél het scheelde. Nu
//      krijgt het per poging de meting plus "schrijf er ongeveer zeven tekens
//      bij" (metaBijstuurRegel).
//   3. Elke poging leverde één kandidaat op, en bij een afgekeurde kandidaat
//      kreeg het model exact dezelfde vraag opnieuw, dus vaak ook hetzelfde
//      antwoord. Nu komen er drie kandidaten per poging, allemaal gemeten.
//   4. Lukte het niet, dan gaf de lus stilletjes op en ging de tekst zoals hij
//      was het document in. Nu volgt de vijl: een rekenkundige laatste slag die
//      alleen met meten werkt, geen model nodig heeft, en dus altijd hetzelfde
//      doet. Die sluit het gat dat er dan nog zit.

import { callClaude, LIGHT_MODEL } from "./anthropic";
import {
  META_RULES_PROMPT,
  metaBijstuurRegel,
  metaOpleverIssues,
  metaPixelInfo,
  pixelAfstand,
  type MetaContext,
  type MetaKind,
} from "./meta-rules";

const LABEL: Record<MetaKind, string> = {
  meta_title: "meta-title",
  meta_description: "meta-description",
};

export type PerfectMeta = {
  /** De beste tekst die de lus wist te bereiken. */
  tekst: string;
  /** Wat er dan nog aan mankeert; leeg = door de poort. */
  issues: string[];
  /** Is de tekst onderweg veranderd? */
  gewijzigd: boolean;
  ok: boolean;
};

export type PerfectOpties = MetaContext & {
  kind: MetaKind;
  tekst: string;
  /** Klant-slug, alleen voor de kostenteller van Claude. */
  slug: string;
  /** Waar de pagina over gaat (H1, H2's, eerste alinea): stof om mee aan te vullen. */
  context?: string;
  /**
   * Eigen woorden om mee aan te vullen als de tekst te kort blijft: de naam van
   * het bedrijf, de plaats, een bewezen USP. Alleen dingen die echt van deze
   * klant zijn; de vijl verzint niets.
   */
  bouwstenen?: string[];
  /** Standaard 3 rondes van elk drie kandidaten. */
  maxPogingen?: number;
};

/* ------------------------------------------------------------------
 * Wie wint? Minder gebreken telt het zwaarst; bij gelijk spel de tekst die het
 * venster van Google beter vult. Die tie-break telt beide kanten op: eerder won
 * "smaller", waardoor een te korte titel nóg korter mocht worden.
 * ------------------------------------------------------------------ */
function beter(kind: MetaKind, kandidaat: string, best: string, ctx: MetaContext): boolean {
  const kIssues = metaOpleverIssues(kind, kandidaat, ctx).length;
  const bIssues = metaOpleverIssues(kind, best, ctx).length;
  if (kIssues !== bIssues) return kIssues < bIssues;
  return pixelAfstand(kind, kandidaat) < pixelAfstand(kind, best);
}

/* ------------------------------------------------------------------
 * De vijl: de breedte kloppend maken met rekenwerk in plaats van met een model.
 *
 * Dit is het vangnet, geen eerste keus. Het model schrijft mooiere zinnen; de
 * vijl garandeert alleen dat er nooit meer een tekst uitgaat die naast het
 * venster van Google valt. Hij stelt kandidaten op, meet ze allemaal, en houdt
 * er alleen één over als die écht beter is.
 * ------------------------------------------------------------------ */

/** Netjes afsluiten na het wegknippen van woorden. */
function afronden(kind: MetaKind, tekst: string): string {
  const t = tekst.replace(/[\s,;:–—-]+$/g, "").trim();
  return kind === "meta_description" && !/[.!?]$/.test(t) ? `${t}.` : t;
}

/** Als hoofdzin: eerste letter groot, punt erachter. */
function alsZin(stuk: string): string {
  const t = stuk.trim().replace(/[.\s]+$/g, "");
  if (!t) return "";
  return `${t[0].toUpperCase()}${t.slice(1)}.`;
}

/**
 * Uitnodigingen zonder aanspreekvorm en zonder belofte, dus altijd waar. In
 * oplopende lengte, zodat ook een klein gaatje gedicht kan worden zonder meteen
 * over de bovengrens te schieten.
 */
const UITNODIGINGEN = [
  "Vraag advies aan.",
  "Vraag vandaag een offerte aan.",
  "Bekijk vandaag de mogelijkheden.",
  "Neem vandaag contact op voor advies op maat.",
];

/** Werkwoorden die al een uitnodiging vormen; er hoort er maar één in een tekst. */
const HEEFT_CTA = /\b(bekijk|ontdek|vraag|bereken|lees|vergelijk|start|kies|plan|ontvang|krijg|bestel|boek|probeer|download|neem)\b/i;

/**
 * Woorden waar een zin niet op mag eindigen. Zonder deze controle knipte de vijl
 * midden in een zinsdeel ("... tuinontwerp en compleet"), en dat leest als een
 * afgebroken titel in de zoekresultaten.
 */
const LOSSE_STAART = /\b(en|of|met|voor|van|in|op|bij|tot|door|naar|aan|uit|over|de|het|een|die|dat|deze|als|om|ook|zeer|meer|heel|compleet|onze)$/i;

const bevat = (tekst: string, stuk: string) =>
  tekst.toLowerCase().includes(stuk.toLowerCase().replace(/[.]+$/, ""));

/** Loopt deze tekst netjes af, of blijft er een woord in de lucht hangen? */
function looptNetjesAf(tekst: string): boolean {
  const kaal = tekst.trim().replace(/[.!?]+$/, "").trim();
  return !!kaal && !LOSSE_STAART.test(kaal);
}

/** Kandidaten om een te brede tekst mee in te korten, van net-te-veel naar fors. */
function inkortKandidaten(kind: MetaKind, tekst: string): string[] {
  const uit: string[] = [];
  if (kind === "meta_title") {
    // Eerst het merkstaartje, dat is het minst gemiste deel: Google toont de
    // sitenaam toch al zelf naast het resultaat.
    const streep = tekst.lastIndexOf(" - ");
    if (streep > 12) uit.push(tekst.slice(0, streep).trim());
    // Daarna op een komma afkappen; dat is een natuurlijke grens in een titel.
    for (let i = tekst.length; i > 15; i--) {
      if (tekst[i - 1] === ",") uit.push(afronden(kind, tekst.slice(0, i - 1)));
    }
  } else {
    // Bij een beschrijving: hele zinnen weglaten leest beter dan half afkappen.
    // De laatste zin is meestal de uitnodiging, en die is het meest waard; die
    // blijft dus staan terwijl de zinnen ervóór eruit gaan.
    const zinnen = tekst.match(/[^.!?]+[.!?]+/g) || [];
    const laatste = (zinnen[zinnen.length - 1] || "").trim();
    if (zinnen.length > 2 && HEEFT_CTA.test(laatste)) {
      for (let n = zinnen.length - 1; n >= 1; n--) uit.push(`${zinnen.slice(0, n).join("").trim()} ${laatste}`.trim());
    }
    for (let n = zinnen.length - 1; n >= 1; n--) uit.push(zinnen.slice(0, n).join("").trim());
  }
  const woorden = tekst.split(/\s+/);
  for (let n = woorden.length - 1; n >= 4; n--) uit.push(afronden(kind, woorden.slice(0, n).join(" ")));
  return uit.filter(looptNetjesAf);
}

/** Kandidaten om een te korte tekst mee aan te vullen, met eigen woorden. */
function aanvulKandidaten(kind: MetaKind, tekst: string, bouwstenen: string[]): string[] {
  const uit: string[] = [];
  const eigen = bouwstenen.map((b) => (b || "").trim()).filter((b) => b.length > 2 && !bevat(tekst, b));
  if (kind === "meta_title") {
    const streep = tekst.lastIndexOf(" - ");
    for (const b of eigen) {
      // Zonder merkstaartje: er eentje achter zetten. Mét merkstaartje (precies
      // het geval van Kamsteeg: "Hovenier in Oosterhout - Kamsteeg Tuinen", nog
      // steeds te kort) kan er niets meer achter, want twee streepjes leest als
      // een opsomming. Dan gaat de aanvulling vóór het streepje staan.
      if (streep > 12) {
        const kop = tekst.slice(0, streep).trim();
        uit.push(`${kop}, ${b}${tekst.slice(streep)}`);
        // En dezelfde aanvulling zónder het merkstaartje: dat past vaker binnen
        // het venster, en Google zet de sitenaam er zelf al naast.
        uit.push(`${kop}, ${b}`);
      } else uit.push(`${tekst.trim()} - ${b}`);
    }
  } else {
    const romp = afronden(kind, tekst);
    for (const b of eigen) uit.push(`${romp} ${alsZin(b)}`);
    // Een tweede uitnodiging naast een bestaande leest als drammen; alleen
    // aanvullen als er nog geen staat.
    if (!HEEFT_CTA.test(romp)) for (const u of UITNODIGINGEN) if (!bevat(romp, u)) uit.push(`${romp} ${u}`);
  }
  return uit.filter(looptNetjesAf);
}

/**
 * De laatste slag. Geeft de beste tekst terug die met kandidaten te bereiken is;
 * lukt niets beters, dan onveranderd wat er al lag.
 */
export function vijlMeta(kind: MetaKind, tekst: string, ctx: MetaContext = {}, bouwstenen: string[] = []): string {
  const info = metaPixelInfo(kind, tekst);
  if (info.ok) return tekst;

  // Eén richting, één slag. Eerst inkorten en daarna weer aanvullen (of andersom)
  // levert gehakt op: een aangevulde zin die net te breed werd, werd daarna woord
  // voor woord teruggeknipt tot "werkt met een eigen vast." Beter één keer goed
  // dan twee keer bijna.
  const kandidaten = info.px > info.max
    ? inkortKandidaten(kind, tekst)
    : aanvulKandidaten(kind, tekst, bouwstenen);

  // Alleen kandidaten die het venster ECHT halen. "Dichterbij" is hier niet goed
  // genoeg: dat is precies hoe een half afgemaakte zin alsnog doorglipt.
  let best = tekst;
  for (const k of kandidaten) {
    if (!k || !metaPixelInfo(kind, k).ok) continue;
    if (best === tekst || beter(kind, k, best, ctx)) best = k;
  }
  return best;
}

/**
 * Meet een meta-title of meta-description, en laat hem herschrijven zolang hij
 * niet door de opleverpoort komt. Geeft altijd de beste kandidaat terug, ook
 * als het niet lukte; nooit een lege of slechtere tekst dan waarmee begonnen is.
 */
export async function perfectioneerMeta(opts: PerfectOpties): Promise<PerfectMeta> {
  const { kind, slug, context } = opts;
  const ctx: MetaContext = { keyword: opts.keyword, h1: opts.h1, title: opts.title };
  const origineel = (opts.tekst || "").trim();
  const maxPogingen = opts.maxPogingen ?? 3;
  const bouwstenen = opts.bouwstenen || [];

  let best = origineel;
  let issues = metaOpleverIssues(kind, best, ctx);
  if (!origineel || !issues.length) {
    return { tekst: best, issues, gewijzigd: false, ok: !issues.length && !!origineel };
  }

  for (let poging = 0; issues.length && poging < maxPogingen; poging++) {
    const user = [
      `Herschrijf deze ${LABEL[kind]} zodat hij aan ALLE regels voldoet.`,
      `Wat er nu aan mankeert: ${issues.join("; ")}.`,
      metaBijstuurRegel(kind, best),
      opts.keyword ? `Primair zoekwoord (moet ${kind === "meta_title" ? "in de eerste drie tot vier woorden staan" : "1x letterlijk in de eerste 120 tekens staan"}): ${opts.keyword}` : "",
      opts.h1 && kind === "meta_title" ? `H1 van de pagina (titel moet hier qua kernwoorden op aansluiten): ${opts.h1}` : "",
      opts.title && kind === "meta_description" ? `De meta-title van deze pagina (niet letterlijk herhalen): ${opts.title}` : "",
      context ? `WAAR DE PAGINA OVER GAAT (hieruit put je om de ruimte te vullen; verzin niets wat hier niet in staat):\n${context.slice(0, 1200)}` : "",
      `Huidige tekst: ${best}`,
      // Drie kandidaten in plaats van één: bij één kandidaat kreeg het model bij
      // een afkeuring exact dezelfde vraag opnieuw, en dus vaak hetzelfde
      // antwoord. Wij meten ze alle drie na en houden de beste.
      `Geef DRIE verschillende varianten, elk op een eigen regel, oplopend in lengte (de langste mag het venster net vullen). Alleen de teksten zelf, geen nummering, geen uitleg, geen aanhalingstekens.`,
    ].filter(Boolean).join("\n");

    const raw = await callClaude(META_RULES_PROMPT, [{ role: "user", content: user }], 400, { slug, action: "meta_correctie" }, LIGHT_MODEL).catch(() => "");
    const kandidaten = (raw || "").split("\n")
      .map((r) => r.trim().replace(/^\s*[-*\d.)]+\s*/, "").replace(/^["'“”]+|["'“”]+$/g, "").trim())
      .filter((r) => r.length > 10);
    if (!kandidaten.length) break;

    for (const k of kandidaten) if (beter(kind, k, best, ctx)) best = k;
    issues = metaOpleverIssues(kind, best, ctx);
  }

  // De vijl: wat het model niet af kreeg, maakt rekenwerk alsnog passend.
  if (issues.length) {
    const gevijld = vijlMeta(kind, best, ctx, bouwstenen);
    if (gevijld !== best && beter(kind, gevijld, best, ctx)) {
      best = gevijld;
      issues = metaOpleverIssues(kind, best, ctx);
    }
  }

  return { tekst: best, issues, gewijzigd: best !== origineel, ok: !issues.length };
}
