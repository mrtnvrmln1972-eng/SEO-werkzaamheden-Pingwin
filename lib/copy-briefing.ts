// copy-briefing.ts — de rekenregels achter de copy-briefing voor de klant.
//
// Waarom dit los staat: het zijn pure functies (tekst in, tekst uit) zonder
// database of AI, zodat `proeven/copy-briefing.proef.ts` ze kan natrekken vóór
// elke bouw. lib/copy-doc-klant.ts doet het werk eromheen (ophalen, AI, Drive).
//
// Wat hier geregeld wordt, komt uit twee klachten over de briefing van
// 11 augustus 2026 voor Kamsteeg (/hovenier/oosterhout/):
//
//   1. Alles stond er twee keer in. Het opgeslagen copy-document begint zelf met
//      een briefing ("1. Waar de nieuwe teksten over gaan", "2. Welke zoekwoorden
//      erin verwerkt zijn", "3. Wat dit voor jullie vindbaarheid betekent",
//      "4. De volledige webteksten") en het klantdocument bouwt diezelfde uitleg
//      opnieuw op uit verse cijfers. De klant las de uitleg dus dubbel, met de
//      verse en de oude versie door elkaar. Alleen de webteksten uit dat
//      opgeslagen document zijn nog nodig; de rest wordt verser opnieuw gemaakt.
//   2. De niveau-aanduidingen (H1, H2, H3) stonden ook boven de hoofdstukken van
//      de briefing zelf. Die aanduiding is een instructie aan de sitebouwer en
//      hoort dus alléén bij tekst die daadwerkelijk op de pagina komt. Doordat de
//      briefing-hoofdstukken nu wegvallen, blijven de labels waar ze thuishoren.

import type { DocBlock, DocSection } from "./pingwin-docx";
import { checkMetaDescription, checkMetaTitle, metaPixelInfo } from "./meta-rules";

/** "H2 — 4. De volledige webteksten" → "4. De volledige webteksten". */
function zonderNiveau(kop: string): string {
  return (kop || "").replace(/^\s*H[1-6]\s*[—–:-]\s*/i, "").trim();
}

/** De kop waaronder de daadwerkelijke paginateksten beginnen. */
const WEBTEKSTEN_KOP = /volledige\s+webteksten/i;

/**
 * Hoofdstukken van de briefing zelf. Het klantdocument maakt deze opnieuw uit
 * verse Search Console-cijfers, dus de oude versie uit het copy-document mag
 * weg. Alles wat hier NIET op staat, blijft staan: liever een hoofdstuk te veel
 * dan tekst die stilzwijgend verdwijnt.
 */
const BRIEFING_KOPPEN = [
  /^\d*\.?\s*waar de nieuwe teksten over gaan/i,
  /^\d*\.?\s*welke zoekwoorden erin verwerkt zijn/i,
  /^\d*\.?\s*wat dit voor (jullie|je|uw) vindbaarheid betekent/i,
  /^\d*\.?\s*lees na,? pas aan en stuur terug/i,
  /^\d*\.?\s*hoe deze nieuwe tekst tot stand kwam/i,
  /^\d*\.?\s*seo-metadata/i,
  /^\d*\.?\s*scorecard/i,
  /^\d*\.?\s*(wat we )?behoud/i,
];

/** Kopjes die de meta bevatten; die staan al in hun eigen hoofdstuk. */
const META_KOPJE = /^(paginatitel|paginatitel \(meta-title\)|meta[\s-]?title|meta[\s-]?description|meta[\s-]?beschrijving)\b/i;

const isBriefingKop = (kop?: string) => {
  const k = zonderNiveau(kop || "");
  return !!k && BRIEFING_KOPPEN.some((re) => re.test(k));
};

/**
 * Haalt de meta-kopjes en hun waarde uit een reeks blokken. Ze staan bovenaan de
 * webteksten in het opgeslagen document, en tegelijk in het eigen
 * metadata-hoofdstuk van de briefing; twee keer dezelfde titel in één document
 * maakt onduidelijk welke telt.
 */
function zonderMetaKopjes(blocks: DocBlock[]): DocBlock[] {
  const uit: DocBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === "subheading" && META_KOPJE.test(zonderNiveau(b.text))) {
      // Het kopje zelf plus de waarde eronder (één alinea) overslaan.
      if (blocks[i + 1]?.type === "paragraph") i++;
      continue;
    }
    uit.push(b);
  }
  return uit;
}

/**
 * Uit het opgeslagen copy-document alleen de daadwerkelijke webteksten houden.
 *
 * Eerste keus is de kop "De volledige webteksten": alles daarvóór is briefing
 * die het klantdocument zelf verser opbouwt. Staat die kop er niet (een ouder
 * of anders opgebouwd document), dan vallen alleen de herkende
 * briefing-hoofdstukken weg en blijft de rest gewoon staan.
 */
export function webtekstSecties(secties: DocSection[]): DocSection[] {
  const start = secties.findIndex((s) => WEBTEKSTEN_KOP.test(zonderNiveau(s.heading || "")));
  const gekozen = start >= 0
    // De kop zelf vervalt: het klantdocument zet er zijn eigen hoofdstuk boven.
    ? secties.slice(start).map((s, i) => (i === 0 ? { ...s, heading: undefined } : s))
    : secties.filter((s) => !isBriefingKop(s.heading));
  return gekozen
    .map((s) => ({ ...s, blocks: zonderMetaKopjes(s.blocks || []) }))
    .filter((s) => s.heading || s.blocks.length);
}

/**
 * De regels van de metadata-tabel in het klantdocument.
 *
 * Bewust zonder oordeelkolom. Die stond er wél, en dus las de klant in onze
 * eigen oplevering dat onze eigen titel "te kort, ruimte onbenut" was. De
 * kwaliteit wordt vóór het document afgedwongen (lib/meta-machine.ts); wat hier
 * staat is de opgeleverde tekst plus de meting als feit, nooit een cijfer met
 * een afkeuring erachter.
 */
export function metaRegels(titel: string, omschrijving: string): string[][] {
  const rij = (label: string, kind: "meta_title" | "meta_description", tekst: string) => {
    const info = metaPixelInfo(kind, tekst);
    return [label, tekst, `${info.chars} tekens, ${info.px} px`];
  };
  const rows: string[][] = [];
  if (titel) rows.push(rij("Paginatitel", "meta_title", titel));
  if (omschrijving) rows.push(rij("Omschrijving", "meta_description", omschrijving));
  return rows;
}

/** Woorden die een oordeel over eigen werk zijn; die horen niet in een oplevering. */
export const OORDEEL_WOORDEN = /te kort|ruimte onbenut|te lang|afgekapt|te breed|voldoet niet|fail/i;

/**
 * De verificatie: elk criterium waaraan de opgeleverde titel en omschrijving zijn
 * getoetst, met de gemeten uitkomst erachter.
 *
 * Dit is exact dezelfde criterialijst als het meta-paneel in het dashboard
 * gebruikt (checkMetaTitle en checkMetaDescription), inclusief de pixelbreedte.
 * Eén bron, dus het document kan niet iets anders beweren dan het scherm.
 *
 * Alleen tonen als álles klopt. Een lijst met een kruisje erin is een oordeel
 * over eigen werk, en dat hoort niet in een oplevering; dan is het aan ons om het
 * eerst te repareren. `allesGoed` vertelt de aanroeper welke van de twee het is.
 */
export function metaVerificatie(
  titel: string,
  omschrijving: string,
  ctx: { keyword?: string; h1?: string } = {},
): { regels: string[][]; allesGoed: boolean } {
  const checks = [
    ...(titel ? checkMetaTitle(titel, ctx.keyword, ctx.h1).map((c) => ({ ...c, deel: "Paginatitel" })) : []),
    ...(omschrijving ? checkMetaDescription(omschrijving, ctx.keyword, titel || undefined).map((c) => ({ ...c, deel: "Omschrijving" })) : []),
  ];
  return {
    regels: checks.map((c) => [c.deel, `✓  ${c.label}`, c.waarde]),
    allesGoed: checks.length > 0 && checks.every((c) => c.pass),
  };
}
