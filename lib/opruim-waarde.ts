import { getGscQueryPagePairs } from "./google";
import type { ZwakkePagina } from "./concurrenten";
import { feitenPerTerm, type Intentie } from "./opruim-intentie";
import { weegHaalbaarheid, autoriteitVan, OORDEEL_RANG, type Haalbaarheid } from "./opruim-haalbaarheid";

// ═══════════════════════════════════════════════════════════
// IS DEZE PAGINA WEL DOOD? DE REM OP DE OPRUIMLIJST
// ═══════════════════════════════════════════════════════════
// Tot 05-08-2026 keek de opruim-analyse alleen naar wat een pagina NU binnenhaalt
// uit Search Console. Haalt hij niets op zijn eigen onderwerp, dan gold hij als
// dood gewicht en ging hij op de omleidlijst.
//
// Dat gaat mis bij een pagina die op een goede zoekterm zit maar slecht is
// ingericht. Het echte voorbeeld: /soa-test-kopen/ stond op plek 8 voor
// "soa test kopen" (500 zoekopdrachten per maand, verkeerspotentie 4700), raakte
// die plek kwijt, en belandde daardoor in de werklijst met /anonieme-soa-test/
// als bestemming (250 per maand, potentie 50). Dat is de pagina met de grootste
// kans opheffen ten gunste van de kleinste.
//
// Wat er ontbrak was één gegeven: het zoekvolume van de term die bij de pagina
// hoort. De tweede vraag ("bezit een andere pagina die term al?") kon het
// dashboard allang beantwoorden uit Search Console.
//
// Vandaar deze weging. Twee gegevens, drie uitkomsten, geen scores:
//   volume + niemand anders bezit hem  -> OPPAKKEN (herontwikkelen, niet weghalen)
//   volume + een ander bezit hem wel   -> omleiden, zoals altijd
//   geen volume                        -> opruimen, zoals altijd
//
// AANVULLING 06-08-2026: volume alleen was te weinig. Er kwamen pagina's op de
// lijst "oppakken" waarvan de zoekterm weliswaar volume had, maar een moeilijkheid
// ver boven wat dit domein aankan. Zo'n pagina op de weekplanning zetten is werk
// dat nooit iets oplevert. Elke regel krijgt daarom een haalbaarheidsoordeel
// (opruim-haalbaarheid.ts) en de zoekintentie van zijn term (opruim-intentie.ts).
// Er verdwijnt niets uit de lijst; hij sorteert zichzelf op wat kán.
// ═══════════════════════════════════════════════════════════

/** Vanaf hoeveel zoekopdrachten per maand is een term het waard om een eigen
    pagina voor te houden. Bewust laag: bij twijfel houden we een pagina liever
    dan dat we hem weggooien, want weggooien is het enige wat niet terug kan. */
export const DREMPEL_VOLUME = 50;

export type Oppakker = {
  pad: string;
  term: string;                 // de zoekterm die bij deze pagina hoort
  volume: number | null;        // zoekopdrachten per maand
  moeilijkheid: number | null;  // Ahrefs KD
  huidigePositie: number | null;// waar hij nu staat op die term, als hij meedoet
  vertoningen: number;          // hoe vaak hij al getoond werd in Google
  botstMet: string[];           // pagina's waarmee hij op andere termen overlapt
  /** Wat wil iemand die deze term intypt: doen, of eerst weten? Bepaalt wat voor
      soort pagina hier hoort, en of hij ooit met een andere samen mag. */
  intentie?: Intentie;
  /** Is deze term voor dit domein te winnen, of is het een illusie? */
  haalbaarheid?: Haalbaarheid;
  /** Wat het waard is per maand. Wordt bij het uitlezen berekend, niet opgeslagen,
      zodat een nieuwe klantwaarde meteen doorwerkt zonder nieuwe analyse. */
  euro?: import("./opruim-euro").Euro | null;
  /** Verdient deze zoekterm een eigen pagina, of hoort hij als hoofdstuk op een
      bredere pagina? Dat volgt uit de top 10, niet uit het zoekvolume. */
  eigenPagina?: import("./opruim-serp").EigenPaginaToets | null;
};

/**
 * Pagina's die er zijn omdat een website ze moet hebben, niet om gevonden te
 * worden. Hun zoekterm heeft vaak fors volume ("algemene voorwaarden" is 2100
 * per maand, "afspraak maken" 1100), maar dat is taalvolume en geen vraag naar
 * dít bedrijf: niemand zoekt op "algemene voorwaarden" en hoopt bij een
 * soa-kliniek uit te komen. Ze kwamen daardoor op 7 augustus 2026 als gemiste
 * kans in de lijst, met een advies om ze uit te bouwen. Dat is precies het soort
 * regel dat een rapport ongeloofwaardig maakt zodra een klant meekijkt.
 */
const FUNCTIONEEL = [
  "algemene-voorwaarden", "voorwaarden", "privacy", "privacybeleid", "cookies", "cookiebeleid",
  "disclaimer", "sitemap", "contact", "over-ons", "vacatures", "vacature", "klachten",
  "afspraak-maken", "afspraak", "inloggen", "login", "account", "winkelwagen", "checkout",
  "bedankt", "bevestiging", "aanvragen", "betalen", "betaling", "retour", "verzending",
  "veelgestelde-vragen", "faq", "nieuwsbrief", "zoeken", "404",
];

export function isFunctioneel(pad: string): boolean {
  const p = padVan(pad).replace(/^\/|\/$/g, "").toLowerCase();
  if (!p) return true;                                  // de homepage zelf
  const delen = p.split("/");
  return delen.some((d) => FUNCTIONEEL.includes(d));
}

const padVan = (u: string) => { try { return new URL(u).pathname; } catch { return (u || "").trim(); } };
const norm = (u: string) => padVan(u).replace(/\/+$/, "").toLowerCase();

// Woorden die in een URL staan maar niets zeggen over waar de pagina over gaat.
const RUIS = new Set(["nl", "en", "de", "www", "index", "home", "page", "pagina", "html", "php"]);

/**
 * De zoekterm die bij een URL hoort, gewoon uit het pad: /soa-klinieken/soa-test-kopen/
 * wordt "soa test kopen". Dat is precies de term waarop zo'n pagina bedoeld is te
 * scoren, en dus de term waarvan we het volume willen weten.
 */
export function termUitPad(pad: string): string {
  const laatste = padVan(pad).split("/").filter(Boolean).pop() || "";
  return laatste.split(/[^a-z0-9]+/i).map((w) => w.toLowerCase()).filter((w) => w.length > 1 && !RUIS.has(w)).join(" ").trim();
}

/**
 * Splitst de opruimkandidaten in "toch houden" en "gewoon verder behandelen".
 *
 * De Ahrefs-opvraag zit achter de bestaande cache van 30 dagen, dus een tweede
 * analyse in dezelfde maand kost niets extra.
 */
export async function weegKandidaten(
  domain: string,
  kandidaten: ZwakkePagina[],
): Promise<{ oppakken: Oppakker[]; rest: ZwakkePagina[] }> {
  const oppakken = await weegPaden(domain, kandidaten);
  const houdVast = new Set(oppakken.map((o) => o.pad));
  return { oppakken, rest: kandidaten.filter((k) => !houdVast.has(padVan(k.pad))) };
}

/**
 * Dezelfde weging, maar op kale paden. Zo kan de rem ook over een werklijst die
 * er al ligt, zonder de hele analyse opnieuw te draaien.
 */
export async function weegPaden(
  domain: string,
  kandidaten: { pad: string; vertoningen?: number; dubbelMet?: string[] }[],
): Promise<Oppakker[]> {
  if (!kandidaten.length) return [];

  // Per kandidaat de term uit het pad. Zonder bruikbare term valt er niets te
  // wegen en gaat de pagina gewoon de normale route in.
  const termen = new Map<string, string>();
  for (const k of kandidaten) {
    const t = termUitPad(k.pad);
    if (t && t.split(" ").length >= 2) termen.set(padVan(k.pad), t);
  }
  if (!termen.size) return [];

  // Volume, moeilijkheid én intentie in één opvraag, plus de autoriteit van het
  // domein. Die laatste is één opvraag per week; de rest zit in de cache van 30
  // dagen die er toch al was.
  const [feiten, autoriteit] = await Promise.all([
    feitenPerTerm([...new Set(termen.values())]),
    autoriteitVan(domain).catch(() => null),
  ]);

  // Wie bezit welke term? Uit Search Console, dus uit eigen data en gratis. Een
  // andere pagina "bezit" de term als hij er zichtbaar op meedoet; dan is dit
  // wél een echt dubbele pagina en blijft omleiden de juiste zet.
  const paren = await getGscQueryPagePairs(domain, 90).catch(() => []);
  const perTerm = new Map<string, { page: string; impressions: number; position: number }[]>();
  for (const p of paren) {
    const k = p.keyword.trim().toLowerCase();
    if (!perTerm.has(k)) perTerm.set(k, []);
    perTerm.get(k)!.push({ page: p.page, impressions: p.impressions, position: p.position });
  }

  const oppakken: Oppakker[] = [];

  for (const k of kandidaten) {
    const pad = padVan(k.pad);
    const term = termen.get(pad);
    if (!term) continue;
    // Een functionele pagina is nooit een gemiste kans, hoe groot het zoekvolume
    // van zijn woorden ook is.
    if (isFunctioneel(pad)) continue;
    const kw = feiten.get(term);
    const volume = kw?.volume ?? null;
    if (volume == null || volume < DREMPEL_VOLUME) continue;

    // Bezit een ANDERE pagina deze term al? Dan is omleiden terecht.
    const rijen = perTerm.get(term) || [];
    const eigen = rijen.find((r) => norm(r.page) === norm(pad));
    const ander = rijen.filter((r) => norm(r.page) !== norm(pad))
      .sort((a, b) => b.impressions - a.impressions)[0];
    if (ander && ander.impressions >= Math.max(20, (eigen?.impressions || 0) * 2)) continue;

    const moeilijkheid = kw?.moeilijkheid ?? null;
    const huidigePositie = eigen ? Math.round(eigen.position * 10) / 10 : null;

    oppakken.push({
      pad, term, volume, moeilijkheid, huidigePositie,
      vertoningen: k.vertoningen || 0,
      botstMet: (k.dubbelMet || []).map(padVan).filter(Boolean).slice(0, 4),
      intentie: kw?.intentie ?? "",
      haalbaarheid: weegHaalbaarheid(moeilijkheid, autoriteit, huidigePositie),
    });
  }

  // Eerst wat kán, dan pas wat groot is. Een term van 2000 per maand die buiten
  // bereik ligt hoort niet boven een term van 200 die te winnen is; dat is precies
  // de verkeerde volgorde om een weekplanning mee te vullen.
  oppakken.sort((a, b) =>
    OORDEEL_RANG[a.haalbaarheid?.oordeel || "onbekend"] - OORDEEL_RANG[b.haalbaarheid?.oordeel || "onbekend"] ||
    (b.volume || 0) - (a.volume || 0));
  return oppakken;
}
