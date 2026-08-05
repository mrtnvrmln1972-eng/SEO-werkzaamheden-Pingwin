import { getKeywordsOverview } from "./ahrefs";
import { getGscQueryPagePairs } from "./google";
import type { ZwakkePagina } from "./concurrenten";

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
};

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

  const overzicht = await getKeywordsOverview([...new Set(termen.values())]).catch(() => []);
  const volumes = new Map(overzicht.map((o) => [o.keyword.toLowerCase(), o]));

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
    const kw = volumes.get(term);
    const volume = kw?.volume ?? null;
    if (volume == null || volume < DREMPEL_VOLUME) continue;

    // Bezit een ANDERE pagina deze term al? Dan is omleiden terecht.
    const rijen = perTerm.get(term) || [];
    const eigen = rijen.find((r) => norm(r.page) === norm(pad));
    const ander = rijen.filter((r) => norm(r.page) !== norm(pad))
      .sort((a, b) => b.impressions - a.impressions)[0];
    if (ander && ander.impressions >= Math.max(20, (eigen?.impressions || 0) * 2)) continue;

    oppakken.push({
      pad, term, volume,
      moeilijkheid: kw?.difficulty ?? null,
      huidigePositie: eigen ? Math.round(eigen.position * 10) / 10 : null,
      vertoningen: k.vertoningen || 0,
      botstMet: (k.dubbelMet || []).map(padVan).filter(Boolean).slice(0, 4),
    });
  }

  oppakken.sort((a, b) => (b.volume || 0) - (a.volume || 0));
  return oppakken;
}
