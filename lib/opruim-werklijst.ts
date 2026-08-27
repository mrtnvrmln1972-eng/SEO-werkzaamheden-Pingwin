import type { CannibalResult } from "./cannibal-redirect";
import type { PlaatsAdvies } from "./opruim-plaatsen";
import type { ChatBesluit } from "./opruim-chat-besluiten";
import type { VariantOordeel } from "./taalvarianten";
import { bepaalFamilies, familieTitel } from "./werk-clusters";

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

/** Waarom deze pagina in de lijst staat. Meerdere kunnen tegelijk gelden.
    "chat" betekent: besloten in een chat-analyse en hier geland via
    lib/opruim-chat-besluiten/; zo'n besluit overruled de motor-uitkomst. */
export type Herkomst = "plaats" | "onderwerp" | "kans" | "gat" | "cannibalisatie" | "chat" | "taal";

export type WerkRegel = {
  pad: string;
  uitkomst: Uitkomst;
  /** Waar hij heen gaat, als hij ergens heen gaat. */
  naar: string;
  herkomst: Herkomst[];
  /** Eén zin voor in de tabel: wat er gebeurt en waarom. */
  reden: string;
  /** De volledige onderbouwing, zin voor zin, met de echte cijfers erin. Stond
      eerst alleen in het bronblok, waardoor je vanuit de hoofdlijst niet kon zien
      waaróp een besluit rustte; dan is het een oordeel en geen advies. */
  onderbouwing: string[];
  term: string;
  volume: number | null;
  klikken: number;
  vertoningen: number;
  positie: number | null;
  /** Waar deze regel bij hoort, voor het groeperen: een plaats of een onderwerp. */
  groep: string;
  /** Staat de omleiding (of de 410) al op de site? Komt uit de vaste regels; daar
      zet elke doorvoerknop zijn vinkje zodra hij live is nagemeten. Zonder dit
      veld telt de lijst alleen werk en nooit voortgang. */
  doorgevoerd?: boolean;
  /** Bij een samenvoeging: is de content al overgezet naar het doel? Ook uit de
      vaste regels; de redirect-knop gaat pas open als dit waar is. */
  contentOver?: boolean;
  /** Gevuld als het doel van deze omleiding niet deugt: het bestaat niet, het is
      zelf een omleiding, of het komt terug op de bronpagina. Zolang dit gevuld is
      mag er niets doorgevoerd worden. */
  doelRisico?: string;
  /** Is dit een Google Ads-landingspagina? Die doet gewoon mee in het plan (er
      staan vaak vier of vijf pagina's voor in de weg), maar gaat zelf nooit weg.
      Het scherm zet er een label bij, zodat zichtbaar is waaróm hij blijft. */
  advertentie?: boolean;
};

const getal = (n: number | null | undefined) => (n == null ? "onbekend" : String(n));

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
export function bouwWerklijst(result: CannibalResult | null, plaatsen: PlaatsAdvies[], chatBesluiten: ChatBesluit[] = [], taalOordelen: VariantOordeel[] = []): WerkRegel[] {
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
      perPad.set(k, {
        ...r, herkomst,
        reden: `${r.reden} (staat ook in: ${bestaand.herkomst.join(", ")})`,
        // Allebei de onderbouwingen bewaren: een pagina die op twee gronden
        // opviel heeft twee verhalen, en het tweede weggooien is precies wat het
        // samenvoegen niet mag doen.
        onderbouwing: [...r.onderbouwing, ...bestaand.onderbouwing],
      });
    } else {
      bestaand.herkomst = herkomst;
      bestaand.onderbouwing = [...bestaand.onderbouwing, ...r.onderbouwing];
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
      // Een advertentiepagina wordt nooit opgeruimd of samengevoegd, wat de
      // uitkomst voor de plaats verder ook is. Hij blijft, en de rest van de
      // plaats wijst naar hem toe.
      const uitkomstVoorPagina: Uitkomst = p.advertentie
        ? (isHouder && uit === "uitbouwen" ? "uitbouwen" : "blijft")
        : isHouder
          ? (uit === "opruimen" ? "opruimen" : uit === "samenvoegen" ? "uitbouwen" : uit)
          : (a.blijft ? "samenvoegen" : "opruimen");
      zet({
        pad: p.pad,
        uitkomst: uitkomstVoorPagina,
        naar: p.advertentie || isHouder ? "" : a.blijft,
        herkomst: ["plaats"],
        advertentie: p.advertentie,
        reden: p.advertentie
          ? `Advertentiepagina voor ${a.naam}: blijft staan, hier gaat niets heen of weg. De andere pagina's van ${a.naam} wijzen hiernaartoe.`
          : isHouder
            ? `Blijft de pagina voor ${a.naam}.`
            : a.blijft ? `Gaat op in de pagina voor ${a.naam}.` : `${a.naam} levert niets op en er is geen vraag.`,
        onderbouwing: a.onderbouwing,
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
        onderbouwing: [
          `Dit onderwerp ligt over ${o.paginas.length} pagina's verspreid: ${o.paginas.map((x) => x.pad).join(", ")}. Bij elkaar wordt er ongeveer ${o.volumeTotaal} keer per maand op gezocht.`,
          o.bestePositie != null
            ? `De beste plek die de site erop haalt is ${Math.round(o.bestePositie)}. Dat is buiten de eerste pagina van Google, en niet omdat het onderwerp te moeilijk is: de aandacht is verdeeld over ${o.paginas.length} pagina's die elk een half antwoord geven.`
            : `Geen van deze pagina's komt op dit moment in de resultaten voor.`,
          ...(o.haalbaarheid && o.haalbaarheid.oordeel !== "onbekend" ? [`Is dit te winnen? ${o.haalbaarheid.uitleg}`] : []),
          ...(o.apartGehouden?.length
            ? [`Wat er bewust buiten blijft: ${o.apartGehouden.map((x) => x.pad).join(", ")}. Die gaan over dezelfde woorden, maar de bezoeker wil er iets anders; samenvoegen zou daar bezoekers kosten.`]
            : []),
          isThuis
            ? `**Wat we doen:** deze pagina wordt de vaste plek voor "${titel}"; de andere gaan hierin op, zodat alle opgebouwde waarde op één adres terechtkomt.`
            : `**Wat we doen:** deze pagina gaat op in ${o.voorstel}. Google hoeft dan niet meer te kiezen tussen pagina's van dezelfde site die hetzelfde vertellen.`,
        ],
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
      onderbouwing: [
        `Deze pagina levert op dit moment niets op uit Google op zijn eigen onderwerp${o.vertoningen ? ` (wel ${o.vertoningen} keer getoond, maar zonder resultaat)` : ""}${o.botstMet.length ? `, en hij overlapt met ${o.botstMet.join(", ")}` : ""}. Op grond daarvan kwam hij als opruimkandidaat uit de analyse.`,
        `**Toch gaat hij niet weg.** De zoekterm die bij deze pagina hoort is "${o.term}", en daar wordt ongeveer ${getal(o.volume)} keer per maand op gezocht${o.moeilijkheid != null ? `, bij een moeilijkheid van ${o.moeilijkheid} op 100` : ""}. Geen andere pagina van deze site bezit die term.${o.huidigePositie != null ? ` Hij doet er zelf al aan mee op plek ${o.huidigePositie}, dus de basis ligt er.` : ""}`,
        ...(o.eigenPagina && o.eigenPagina.oordeel !== "onbekend" ? [`**Verdient dit een eigen pagina?** ${o.eigenPagina.uitleg}`] : []),
        ...(o.haalbaarheid && o.haalbaarheid.oordeel !== "onbekend" ? [`**Is het te winnen?** ${o.haalbaarheid.uitleg}`] : []),
        ...(o.euro ? [`**Wat het waard is:** ${o.euro.uitleg}`] : []),
        hoofdstuk
          ? `**Wat we doen:** niet als losse pagina opbouwen, maar samenvoegen met de pagina over ${o.eigenPagina?.hoofdonderwerp || "het bredere onderwerp"}. Een eigen pagina zou hier geen extra plek opleveren, wel een concurrent van je eigen pagina.`
          : `**Wat we doen:** niet omleiden, maar opnieuw opbouwen. Eerst de huidige pagina analyseren, dan een blauwdruk op basis van de top 10 voor "${o.term}", en daarna de copy.`,
      ],
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
      onderbouwing: [
        `Deze pagina en ${m.naar || "een andere pagina van de site"} verschijnen allebei op hetzelfde zoekwoord. Google moet dan kiezen, en die keuze valt wisselend uit; het gevolg is dat geen van beide echt sterk wordt.`,
        m.reden ? `Uit de analyse: ${m.reden}` : "",
        m.verhuizen
          ? `**Wat we doen:** dit is geen gewone omleiding maar een verhuizing. Deze pagina is zelf de sterkste voor zijn onderwerp maar staat op de verkeerde URL-vorm; de inhoud gaat mee naar ${m.naar} en dit adres wijst daarheen.`
          : `**Wat we doen:** een omleiding naar ${m.naar}, zodat alle opgebouwde waarde op één adres samenkomt.`,
      ].filter(Boolean),
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
      onderbouwing: [
        `Deze zoekterm kwam boven vanuit "${g.thema}", een onderwerp waarop deze website al meedoet in Google. Daaromheen wordt ongeveer ${g.volume} keer per maand gezocht op "${g.term}", en daar heeft de site niets voor.`,
        g.dichtbij.length
          ? `Het dichtst in de buurt ${g.dichtbij.length === 1 ? "komt" : "komen"} ${g.dichtbij.join(", ")}.${g.soort === "uitbreiden" ? " Dat ligt zo dicht bij dit onderwerp dat een aparte pagina ze allebei zou verzwakken." : " Die gaan er nét niet over, dus een eigen pagina is hier op zijn plaats."}`
          : "",
        ...(g.haalbaarheid && g.haalbaarheid.oordeel !== "onbekend" ? [`**Is het te winnen?** ${g.haalbaarheid.uitleg}`] : []),
        ...(g.euro ? [`**Wat het waard is:** ${g.euro.uitleg}`] : []),
        g.soort === "uitbreiden"
          ? `**Wat we doen:** dit onderwerp toevoegen aan ${g.dichtbij[0]} in plaats van er een pagina naast te zetten.`
          : `**Wat we doen:** een nieuwe pagina, met een blauwdruk op basis van de top 10 en daarna de copy.`,
      ].filter(Boolean),
      term: g.term, volume: g.volume, klikken: 0, vertoningen: 0, positie: null,
      groep: g.thema || g.term,
    });
  }

  // 6. De taalvarianten. Een tweede taal is een eigen boom, geen dubbeling: een
  // Engelse pagina gaat NOOIT op in zijn Nederlandse tegenhanger als er Engelse
  // zoekvraag is, want die twee zijn via hreflang aan elkaar gekoppeld. Is die
  // vraag er niet, dan is het een vertaling die niemand zoekt en die ondertussen
  // de hoofdtaal in de weg zit; dan is samenvoegen juist wél het werk.
  // Één blok per taal was onwerkbaar: bij One Day Clinic stonden er 365 pagina's
  // in "Taalversie EN", en een blok hoort één zitting werk te zijn. Daarom
  // opgesplitst op wat je ermee doet (vertalen of samenvoegen) én op
  // pagina-familie, precies zoals de losse titel-kansen dat al deden.
  const taalFamilies = bepaalFamilies(taalOordelen.map((t) => t.pad));
  for (const t of taalOordelen) {
    if (t.uitkomst === "onbekend") continue;
    const taalNaam = t.taal.toUpperCase();
    const fam = taalFamilies.get(t.pad) || "";
    const famNaam = fam ? familieTitel(fam) : "overig";
    const watWeDoen = t.uitkomst === "blijft-vertalen" ? "vertalen" : "samenvoegen";
    zet({
      pad: t.pad,
      uitkomst: t.uitkomst === "blijft-vertalen" ? "uitbouwen" : "samenvoegen",
      naar: t.uitkomst === "samenvoegen" ? t.tegenhanger : "",
      herkomst: ["taal"],
      reden: t.reden,
      onderbouwing: t.onderbouwing,
      term: t.bewijs, volume: null, klikken: 0, vertoningen: t.eigenTaal + t.hoofdtaal, positie: null,
      groep: `${taalNaam} ${watWeDoen}: ${famNaam}`,
    });
  }


  // 7. Besluiten uit een chat. Die komen ná de motor-bronnen en spelen niet mee
  // in het zwaarte-spel: een chat-besluit is een besluit van Maarten en wint dus
  // altijd van de motor, precies zoals de vaste regels de volgende analyse
  // overrulen. De motor-onderbouwing blijft wel bewaard onder die van de chat.
  for (const c of chatBesluiten) {
    const k = norm(c.pad);
    const bestaand = perPad.get(k);
    const regel: WerkRegel = {
      pad: c.pad, uitkomst: c.uitkomst, naar: c.naar, herkomst: ["chat"],
      reden: c.reden, onderbouwing: [...c.onderbouwing],
      term: c.term, volume: c.volume, klikken: c.klikken, vertoningen: c.vertoningen,
      positie: c.positie, groep: c.groep,
    };
    if (bestaand) {
      regel.herkomst = [...new Set<Herkomst>(["chat", ...bestaand.herkomst])];
      regel.onderbouwing = [...regel.onderbouwing, ...bestaand.onderbouwing];
      if (!regel.volume && bestaand.volume) regel.volume = bestaand.volume;
      if (!regel.klikken && bestaand.klikken) regel.klikken = bestaand.klikken;
      if (!regel.vertoningen && bestaand.vertoningen) regel.vertoningen = bestaand.vertoningen;
      if (regel.positie == null && bestaand.positie != null) regel.positie = bestaand.positie;
    }
    perPad.set(k, regel);
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

/**
 * Zet het vinkje "staat al op de site" op de regels waarvan de omleiding is
 * doorgevoerd. De paden komen uit `client_opruim_regels` (lib/opruim-regels.ts),
 * waar zowel de werklijst als de oude tabel hun doorvoer in wegschrijven, dus
 * beide routes lezen dezelfde bron in plaats van elk hun eigen telling te doen.
 */
export function markeerDoorgevoerd(regels: WerkRegel[], doorgevoerdePaden: string[]): WerkRegel[] {
  const gedaan = new Set(doorgevoerdePaden.map(norm));
  return regels.map((r) => (gedaan.has(norm(r.pad)) ? { ...r, doorgevoerd: true } : r));
}

/** Zet het vinkje "content is overgezet" op de samenvoeg-regels waar dat in de
    vaste regels is vastgelegd. Zelfde bron als het doorvoer-vinkje. */
export function markeerContentOver(regels: WerkRegel[], overgezettePaden: string[]): WerkRegel[] {
  const over = new Set(overgezettePaden.map(norm));
  return regels.map((r) => (over.has(norm(r.pad)) ? { ...r, contentOver: true } : r));
}

/**
 * ═══════════════════════════════════════════════════════════
 * IS HET DOEL VAN EEN OMLEIDING WEL EEN ECHTE PAGINA?
 * ═══════════════════════════════════════════════════════════
 * Aanleiding (27-08-2026), gevonden door Maarten op het scherm. Het plan stelde
 * voor om `/soa-poli-zoetermeer/` (positie 2, echte klikken) om te leiden naar
 * `/soa-klinieken/soa-test-zoetermeer/`. Die tweede URL bestaat helemaal niet als
 * pagina: hij is opgebouwd uit de gekozen URL-vorm, en op de site is het een 301
 * die via `/soa-test-locaties/soa-test-zoetermeer/` terugkomt op de bronpagina.
 * Doorvoeren zou een oneindige lus maken en een rankende pagina offline halen.
 * Bij Purmerend is het een directe ping-pong tussen twee URL's.
 *
 * De oorzaak is dat een doel uit een patroon wordt gebouwd en nooit tegen de
 * werkelijkheid wordt gehouden. Deze functie doet dat wel: elk doel moet een
 * pagina zijn die live 200 geeft. Is dat niet zo, dan blijft de regel staan (de
 * bevinding klopt, er ís cannibalisatie) maar krijgt hij een blokkade met de
 * reden erbij, zodat er niets doorgevoerd kan worden op een verzonnen adres.
 */
export function markeerDoelRisico(regels: WerkRegel[], livePaden: string[], redirects: Record<string, string> = {}): WerkRegel[] {
  const live = new Set(livePaden.map(norm));
  const red = new Map(Object.entries(redirects).map(([van, naar]) => [norm(van), norm(naar)]));

  /** Waar komt dit adres uiteindelijk uit? Stopt bij een lus of na tien stappen. */
  const eindpunt = (start: string): { eind: string; lus: boolean; stappen: string[] } => {
    const gezien = [start];
    let p = start;
    for (let i = 0; i < 10 && red.has(p); i++) {
      p = red.get(p)!;
      if (gezien.includes(p)) return { eind: p, lus: true, stappen: gezien };
      gezien.push(p);
    }
    return { eind: p, lus: false, stappen: gezien };
  };

  return regels.map((r) => {
    if (!r.naar) return r;
    const bron = norm(r.pad);
    const doel = norm(r.naar);
    const { eind, lus, stappen } = eindpunt(doel);

    if (eind === bron) {
      return {
        ...r,
        doelRisico: stappen.length > 1
          ? `Dit doel leidt via ${stappen.slice(1).join(" en ")} terug naar deze pagina zelf. Doorvoeren maakt een oneindige omleiding en haalt de pagina offline. Kies een ander doel, of haal eerst de bestaande omleiding weg.`
          : "Dit doel is deze pagina zelf. Een pagina kan niet naar zichzelf omgeleid worden.",
      };
    }
    if (lus) {
      return { ...r, doelRisico: `Het doel zit in een omleidingslus (${stappen.join(" → ")}). Die moet eerst opgelost worden.` };
    }
    if (!live.has(eind)) {
      return {
        ...r,
        doelRisico: eind === doel
          ? `Het doel ${r.naar} is geen bestaande pagina (geen 200 op de site). Dit adres komt uit de gekozen URL-vorm, niet uit de site zelf; er is dus niets om naartoe te leiden.`
          : `Het doel leidt door naar ${eind}, en dat is geen bestaande pagina. Leid liever meteen naar een adres dat wél bestaat.`,
      };
    }
    if (eind !== doel) {
      return { ...r, doelRisico: `Het doel is zelf een omleiding naar ${eind}. Leid meteen daarheen, anders bouw je een keten.` };
    }
    return r;
  });
}
