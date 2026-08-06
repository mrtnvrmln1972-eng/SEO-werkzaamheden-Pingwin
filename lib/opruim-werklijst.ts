import type { CannibalResult } from "./cannibal-redirect";
import type { PlaatsAdvies } from "./opruim-plaatsen";

// ═══════════════════════════════════════════════════════════
// ÉÉN LIJST, MEERDERE VIEWS
// ═══════════════════════════════════════════════════════════
// Het opruimscherm groeide naar twaalf blokken: onderwerpen bundelen, plaatsen,
// oppakken, wat er ontbreekt, de werklijst, het eindbeeld, nameten, interne
// links, wat blijft staan, de structuur, de bronnen en de samenvatting. Wie dat
// leest raakt het spoor kwijt, en een klant al helemaal.
//
// Geteld op 7 augustus 2026 bij One Day Clinic: die lijsten bevatten samen 184
// regels, maar slechts 162 unieke pagina's. 22 pagina's stonden dus dubbel, en
// veertien daarvan stonden in zowel de werklijst als bij de plaatspagina's. Dat
// zijn geen twee analyses, dat is één besluit dat op twee plekken staat.
//
// De reden is dat al die lijsten dezelfde vraag beantwoorden: wat gebeurt er met
// deze pagina. Ze verschillen alleen in WAAROM een pagina erin terechtkwam. Dus:
// één regel per pagina, één uitkomst, en de herkomst wordt een label waarop je
// kunt filteren. Filteren op "plaats" geeft precies de oude plaatsenlijst terug;
// er gaat niets verloren, het staat alleen niet meer vier keer op het scherm.
// ═══════════════════════════════════════════════════════════

/** Wat er met deze pagina gebeurt. Vijf mogelijkheden, meer zijn er niet. */
export type Uitkomst = "uitbouwen" | "samenvoegen" | "blijft" | "opruimen" | "nieuw";

/** Waarom deze pagina in de lijst staat. Meerdere kunnen tegelijk gelden. */
export type Herkomst = "plaats" | "onderwerp" | "kans" | "gat" | "cannibalisatie";

export type WerkRegel = {
  pad: string;
  uitkomst: Uitkomst;
  /** Waar hij heen gaat, als hij ergens heen gaat. */
  naar: string;
  herkomst: Herkomst[];
  /** Eén zin: wat er gebeurt en waarom. De volle onderbouwing zit in het blok
      waar de regel vandaan komt en blijft daar bereikbaar. */
  reden: string;
  term: string;
  volume: number | null;
  klikken: number;
  vertoningen: number;
  positie: number | null;
  /** Waar deze regel bij hoort, voor het groeperen: een plaats of een onderwerp. */
  groep: string;
};

const norm = (u: string) => {
  let p = u || "";
  try { p = new URL(u).pathname; } catch { /* al een pad */ }
  return p.replace(/\/+$/, "").toLowerCase() || "/";
};

/**
 * Alles wat er over pagina's is uitgezocht, samengevoegd tot één lijst. Staat een
 * pagina in twee bronnen, dan wint de zwaarste uitkomst en worden de herkomsten
 * bij elkaar gezet: dan zie je in één regel dát hij op twee gronden opviel, in
 * plaats van hem twee keer tegen te komen.
 */
export function bouwWerklijst(result: CannibalResult | null, plaatsen: PlaatsAdvies[]): WerkRegel[] {
  const perPad = new Map<string, WerkRegel>();

  // Zwaarte: wat er met een pagina gebeurt weegt zwaarder naarmate er meer werk
  // in zit. Uitbouwen wint dus van samenvoegen, en samenvoegen van opruimen: een
  // pagina die ergens een kans is, gooien we niet weg omdat een andere bron hem
  // als dood gewicht zag.
  const zwaarte: Record<Uitkomst, number> = { uitbouwen: 5, nieuw: 4, samenvoegen: 3, blijft: 2, opruimen: 1 };

  const zet = (r: WerkRegel) => {
    const k = norm(r.pad);
    const bestaand = perPad.get(k);
    if (!bestaand) { perPad.set(k, { ...r, pad: r.pad }); return; }
    const herkomst = [...new Set([...bestaand.herkomst, ...r.herkomst])];
    if (zwaarte[r.uitkomst] > zwaarte[bestaand.uitkomst]) {
      perPad.set(k, { ...r, herkomst, reden: `${r.reden} (staat ook in: ${bestaand.herkomst.join(", ")})` });
    } else {
      bestaand.herkomst = herkomst;
      // Vul aan wat de andere bron beter wist; nooit overschrijven met leeg.
      if (!bestaand.volume && r.volume) bestaand.volume = r.volume;
      if (!bestaand.klikken && r.klikken) bestaand.klikken = r.klikken;
      if (!bestaand.vertoningen && r.vertoningen) bestaand.vertoningen = r.vertoningen;
    }
  };

  // 1. De plaatspagina's.
  for (const a of plaatsen) {
    const uit: Uitkomst = a.uitkomst === "weg" ? "opruimen"
      : a.uitkomst === "uitbouwen" ? "uitbouwen"
      : a.uitkomst === "samenvoegen" ? "samenvoegen" : "blijft";
    for (const p of a.paginas) {
      const isHouder = a.blijft === p.pad;
      zet({
        pad: p.pad,
        uitkomst: isHouder ? (uit === "opruimen" ? "opruimen" : uit === "samenvoegen" ? "uitbouwen" : uit) : (a.blijft ? "samenvoegen" : "opruimen"),
        naar: isHouder ? "" : a.blijft,
        herkomst: ["plaats"],
        reden: isHouder
          ? `Blijft de pagina voor ${a.naam}.`
          : a.blijft ? `Gaat op in de pagina voor ${a.naam}.` : `${a.naam} levert niets op en er is geen vraag.`,
        term: p.term, volume: a.volume, klikken: p.klikken, vertoningen: p.vertoningen, positie: p.positie,
        groep: a.naam,
      });
    }
  }

  // 2. De onderwerpen.
  for (const o of result?.onderwerpen || []) {
    const titel = o.termen[0]?.keyword || o.sleutel;
    for (const p of o.paginas) {
      const isThuis = norm(o.voorstel) === norm(p.pad);
      zet({
        pad: p.pad,
        uitkomst: isThuis ? "uitbouwen" : "samenvoegen",
        naar: isThuis ? "" : o.voorstel,
        herkomst: ["onderwerp"],
        reden: isThuis ? `Wordt de vaste pagina voor "${titel}".` : `Gaat op in de pagina voor "${titel}".`,
        term: p.term, volume: p.volume ?? null, klikken: p.klikken, vertoningen: p.vertoningen, positie: p.bestePositie,
        groep: titel,
      });
    }
  }

  // 3. De kansen (oppakken).
  for (const o of result?.oppakken || []) {
    const hoofdstuk = o.eigenPagina?.oordeel === "hoofdstuk";
    zet({
      pad: o.pad,
      uitkomst: hoofdstuk ? "samenvoegen" : "uitbouwen",
      naar: "",
      herkomst: ["kans"],
      reden: hoofdstuk
        ? `"${o.term}" verdient geen eigen pagina: de top 10 bestaat vooral uit bredere pagina's. Hoort als hoofdstuk bij ${o.eigenPagina?.hoofdonderwerp || "het bredere onderwerp"}.`
        : `Scoort nergens op, maar "${o.term}" is ${o.volume ?? "?"} zoekopdrachten per maand waard en niemand anders bezit hem.`,
      term: o.term, volume: o.volume, klikken: 0, vertoningen: o.vertoningen, positie: o.huidigePositie,
      groep: o.eigenPagina?.hoofdonderwerp || o.term,
    });
  }

  // 4. De werklijst uit de cannibalisatie-analyse.
  for (const m of result?.redirectMap || []) {
    zet({
      pad: String(m.van || ""),
      uitkomst: "samenvoegen",
      naar: String(m.naar || ""),
      herkomst: ["cannibalisatie"],
      reden: m.reden || "Zit een sterkere pagina in de weg op hetzelfde zoekwoord.",
      term: "", volume: null, klikken: 0, vertoningen: 0, positie: null,
      groep: String(m.naar || ""),
    });
  }

  // 5. Wat er nog niet is.
  for (const g of result?.gaten || []) {
    const pad = (g.voorstelPad || "").split("  (")[0];
    if (!pad) continue;
    zet({
      pad,
      uitkomst: g.soort === "uitbreiden" ? "uitbouwen" : "nieuw",
      naar: g.soort === "uitbreiden" ? (g.dichtbij[0] || "") : "",
      herkomst: ["gat"],
      reden: g.soort === "uitbreiden"
        ? `Er wordt ${g.volume} keer per maand gezocht op "${g.term}"; dat hoort bij een bestaande pagina in de buurt.`
        : `Er wordt ${g.volume} keer per maand gezocht op "${g.term}" en de site heeft er geen pagina voor.`,
      term: g.term, volume: g.volume, klikken: 0, vertoningen: 0, positie: null,
      groep: g.thema || g.term,
    });
  }

  const rang: Record<Uitkomst, number> = { uitbouwen: 0, nieuw: 1, samenvoegen: 2, opruimen: 3, blijft: 4 };
  return [...perPad.values()].sort((a, b) =>
    rang[a.uitkomst] - rang[b.uitkomst] ||
    (b.volume || 0) - (a.volume || 0) ||
    a.pad.localeCompare(b.pad));
}

/** De tellingen die boven de lijst staan. */
export function tellingen(regels: WerkRegel[]): Record<Uitkomst, number> & { totaal: number } {
  const t = { uitbouwen: 0, samenvoegen: 0, blijft: 0, opruimen: 0, nieuw: 0, totaal: regels.length };
  for (const r of regels) t[r.uitkomst]++;
  return t;
}
