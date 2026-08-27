// ═══════════════════════════════════════════════════════════
// WAT ER NIET IN HET PLAN STAAT, EN WAAROM
// ═══════════════════════════════════════════════════════════
// Het werkplan liet stil weg. Zoek je op "Utrecht", dan kreeg je vier blokken
// titelwerk en verder niets, terwijl er zes Utrecht-pagina's bestaan die bewust
// buiten de analyse zijn gehouden. Het scherm zei daar niets over, dus de enige
// conclusie die je kon trekken was "de cannibalisatie-blokken zijn er niet" of
// "de motor heeft ze gemist". Allebei fout: ze zijn er nooit geweest, met reden.
//
// Een weglating zonder reden is een gat. Een weglating mét reden is een besluit,
// en een besluit kun je nakijken en terugdraaien. Dat is het hele verschil, en
// het is dezelfde regel als bij de vervallen titel-kansen in `werkplan.ts`: die
// vervallen ook zichtbaar, met de reden erbij, in plaats van stil te verdwijnen.
//
// Alles hier is een pure functie zonder React en zonder database, zodat
// `proeven/weggelaten.proef.ts` het met echte voorbeelden kan narekenen.

import { isAdsPad, type AdsPaginas } from "./opruim-regels";
import { padVan } from "./werk-clusters";

/** Waarom een pagina buiten het plan valt. */
export type WeglaatReden = "advertentie" | "plaats-verweesd" | "geen-aanleiding";

export const WEGLAAT_LABEL: Record<WeglaatReden, string> = {
  advertentie: "Advertentiepagina",
  "plaats-verweesd": "Plaats valt buiten de analyse",
  "geen-aanleiding": "Geen aanleiding gevonden",
};

/**
 * De uitleg per reden, in gewone taal. Deze tekst komt letterlijk op het scherm,
 * dus hij moet uit te leggen zijn aan iemand die de motor niet kent.
 */
export const WEGLAAT_UITLEG: Record<WeglaatReden, string> = {
  advertentie:
    "Belangrijke pagina: hier staan advertenties op. Er gaat nooit iets van zo'n pagina weg, want dat kost direct geld. Let op: dit zijn alléén de advertentiepagina's waar de analyse verder niets bij gevonden heeft. De meeste staan gewoon ín het plan, als de pagina die blijft en sterker wordt, met de pagina's die hem in de weg zitten eromheen. Ze ontbreken hier dus niet, ze staan hierboven.",
  "plaats-verweesd":
    "Deze pagina hoort bij een plaats waarvan de motor het patroon niet meer kan aflezen, meestal omdat de andere pagina's van die plaats al zijn omgeleid. Hij kan wél degelijk de landingspagina van die plaats in de weg zitten, dus hier kan werk blijven liggen. Staat een plaats hier terwijl de klant er een vestiging heeft, dan is dat een fout: vestigingen tellen altijd als plaats.",
  "geen-aanleiding":
    "Geen van de analyses is op deze pagina uitgekomen: geen cannibalisatie, geen plaats-advies en geen titel- of description-kans. Dat betekent niet dat de pagina perfect is, alleen dat er nu geen aanleiding ligt.",
};

export type WeggelatenPagina = {
  pad: string;
  reden: WeglaatReden;
  /** De plaats waar deze pagina bij hoort, als die te bepalen was. */
  plaats: string;
  /**
   * De soort pagina, afgeleid uit het pad. Driehonderd losse URL's onder elkaar
   * zeggen niets; "zes keer een afspraak-maken-pagina" is meteen een bevinding.
   * Maartens woorden: "als er zes afspraken-maken-pagina's zijn, dan moeten we
   * daar misschien ook gewoon naar kijken."
   */
  soort: string;
};

export type Weggelaten = {
  paginas: WeggelatenPagina[];
  /** Hoeveel er per reden zijn, zodat het scherm een samenvatting kan tonen. */
  telling: { reden: WeglaatReden; n: number }[];
  /** Hoeveel live pagina's er in totaal zijn, voor "X van de Y". */
  live: number;
  /** Hoeveel live pagina's er wél in de werklijst staan. */
  beoordeeld: number;
};

const norm = (p: string) => padVan(p).replace(/\/$/, "").toLowerCase();

/**
 * De soort pagina, uit het pad. Een map wint van een los woord: alles onder
 * `/over-ons/vacatures/` hoort bij elkaar, en anders is het eerste betekenisvolle
 * woord de soort (`afspraak-maken`, `bloedonderzoek`). Zo wordt een lijst van
 * driehonderd URL's een handvol groepen waar je een besluit over kunt nemen.
 */
export function soortVan(pad: string): string {
  const seg = norm(pad).split("/").filter(Boolean);
  if (!seg.length) return "Homepage";
  if (seg.length > 1) return seg.slice(0, seg.length - 1).join("/");
  // Eén segment: neem het deel vóór de laatste streepjes, zodat
  // /afspraak-maken-soa-test/ en /afspraak-maken-hiv/ bij elkaar komen.
  const d = seg[0].split("-").filter(Boolean);
  return d.length > 2 ? d.slice(0, 2).join("-") : seg[0];
}

/**
 * Welke plaats zit er in dit pad, volgens de URL-vormen die de motor zélf heeft
 * herkend? Bewust langs die vormen en niet langs een eigen lijst plaatsnamen: de
 * verweesde plaatsen zijn juist de plaatsen waarover de motor géén advies gaf, dus
 * ze aftoetsen tegen de advieslijst zou ze per definitie nooit vinden. Dat was de
 * eerste versie van deze functie, en die vond dus niets.
 */
function plaatsUitVorm(pad: string, vormen: string[]): string {
  const p = norm(pad);
  for (const vorm of vormen) {
    if (!vorm.includes("<plaats>")) continue;
    const patroon = vorm.replace(/\/$/, "").toLowerCase()
      .split("<plaats>").map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("([a-z0-9-]+)");
    const m = new RegExp(`^${patroon}$`).exec(p);
    if (m?.[1]) return m[1];
  }
  return "";
}

/** Bevat dit pad deze plaats als heel woord? ("utrecht" wel, "utrechtseweg" niet.) */
function noemtPlaats(pad: string, plaats: string): boolean {
  const woorden = norm(pad).split(/[/-]/).filter(Boolean);
  const delen = plaats.split("-").filter(Boolean);
  if (!delen.length) return false;
  for (let i = 0; i + delen.length <= woorden.length; i++) {
    if (delen.every((d, j) => woorden[i + j] === d)) return true;
  }
  return false;
}

/**
 * Bepaal per live pagina of hij in het plan zit, en zo niet: waarom niet.
 *
 * `adviesPlaatsen` zijn de plaatsen waarvoor de motor wél een advies gaf.
 * Een plaats die daar NIET in zit terwijl er wel een advertentiepagina voor
 * bestaat, is verweesd: dan is de ankerpagina weggefilterd en valt de rest mee.
 */
export function bepaalWeggelaten(
  livePaden: string[],
  werklijstPaden: string[],
  ads: AdsPaginas,
  adviesPlaatsen: string[] = [],
  vormen: string[] = [],
): Weggelaten {
  const live = [...new Set(livePaden.map(padVan).filter(Boolean))];
  const inLijst = new Set(werklijstPaden.map(norm).filter(Boolean));

  // Welke plaatsen zijn verweesd? Een plaats waarvan de pagina in een erkende
  // locatievorm een advertentiepagina is, terwijl de motor voor die plaats geen
  // advies gaf. Dan is de ankerpagina weggefilterd en valt de hele plaats mee,
  // inclusief pagina's die zelf niets met adverteren te maken hebben.
  const bekend = new Set(adviesPlaatsen.map((p) => p.toLowerCase()));
  const verweesd = new Set<string>();
  for (const pad of live) {
    if (!isAdsPad(pad, ads)) continue;
    const p = plaatsUitVorm(pad, vormen);
    if (p && !bekend.has(p)) verweesd.add(p);
  }

  const paginas: WeggelatenPagina[] = [];
  let beoordeeld = 0;
  for (const pad of live) {
    if (inLijst.has(norm(pad))) { beoordeeld++; continue; }
    const wees = [...verweesd].find((p) => noemtPlaats(pad, p)) || "";
    const reden: WeglaatReden = isAdsPad(pad, ads)
      ? "advertentie"
      : wees
        ? "plaats-verweesd"
        : "geen-aanleiding";
    paginas.push({ pad, reden, plaats: wees || plaatsUitVorm(pad, vormen), soort: soortVan(pad) });
  }

  paginas.sort((a, b) => a.reden.localeCompare(b.reden) || a.pad.localeCompare(b.pad));

  const telPer = new Map<WeglaatReden, number>();
  for (const p of paginas) telPer.set(p.reden, (telPer.get(p.reden) || 0) + 1);
  const volgorde: WeglaatReden[] = ["advertentie", "plaats-verweesd", "geen-aanleiding"];
  const telling = volgorde.filter((r) => telPer.get(r)).map((r) => ({ reden: r, n: telPer.get(r)! }));

  return { paginas, telling, live: live.length, beoordeeld };
}
