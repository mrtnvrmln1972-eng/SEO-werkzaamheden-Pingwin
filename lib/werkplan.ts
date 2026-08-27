// ═══════════════════════════════════════════════════════════
// HET WERKPLAN: VAN LOSSE SIGNALEN NAAR EEN PLAN VAN DRIE MAANDEN
// ═══════════════════════════════════════════════════════════
// Op een site met duizenden pagina's levert de analyse honderden losse signalen
// op. Als je die als lijst toont, hoe netjes ook gesorteerd, kun je er geen plan
// uit trekken. Dat was de fout van de vorige versie: 372 signalen werden 173
// groepen, en dat is dezelfde lijst met tussenkopjes.
//
// DE EENHEID VAN WERK IS EEN CLUSTER, NIET EEN SIGNAAL
// ════════════════════════════════════════════════════
// Op een site hoort werk bij elkaar per ONDERWERP, niet per handeling. Ga je
// "Amsterdam" opruimen, dan raak je in één zitting zes pagina's aan en doe je
// zes verschillende dingen: één blijft en wordt uitgebouwd, drie gaan erin op,
// één wordt weggegooid, één krijgt een nieuwe titel. Dat is één blok werk van
// een paar uur, geen zes losse taken op zes plekken in een lijst.
//
// Dat cluster hoeven we niet te verzinnen: het staat al in de data. De
// opruim-werklijst geeft per regel een `groep` mee, en dat is precies een plaats
// of een onderwerp. Dit bestand doet drie dingen bovenop die groep:
//
//   1. HET HANGT ALLES AAN ELKAAR. Een meta/CTR-kans op /soa-test-amsterdam/
//      hoort bij het cluster Amsterdam, niet in een eigen lijst van 236 losse
//      meta-regels. Kansen op pagina's die nergens in een cluster zitten worden
//      alsnog gebundeld op pagina-familie.
//   2. HET HAALT WERK WEG DAT GEEN WERK IS. Een titel verbeteren op een pagina
//      die volgende week wordt samengevoegd of weggegooid is weggegooid werk.
//      Zulke kansen vervallen zichtbaar, met de reden erbij, in plaats van dat
//      ze als taak in je planning belanden.
//   3. HET ZET ER EEN VOLGORDE IN. Eerst de structuur (wie wint), dan de inhoud
//      (die winnaar sterker maken), dan het laaghangend fruit (titels en
//      descriptions). Die volgorde is geen smaak: andersom optimaliseer je
//      pagina's die je daarna doorstuurt.
//
// Alles hier is een pure functie zonder React en zonder database, zodat
// `proeven/werkplan.proef.ts` het met echte voorbeelden kan narekenen.

import { bepaalFamilies, familieTitel, padVan, titelVanSlug, type Categorie } from "./werk-clusters";

// ═══════════════════════════════════════════════════════════
// WAT ER MET EEN PAGINA GEBEURT
// ═══════════════════════════════════════════════════════════

export type Handeling = "blijft" | "uitbouwen" | "nieuw" | "samenvoegen" | "opruimen" | "meta";

export const HANDELING_LABEL: Record<Handeling, string> = {
  blijft: "blijft", uitbouwen: "uitbouwen", nieuw: "nieuw",
  samenvoegen: "samenvoegen", opruimen: "opruimen", meta: "titel en description",
};

// Wat een handeling gemiddeld kost. Eén vaste 30 minuten voor alles was een
// aanname die nergens op sloeg: een redirect zetten is geen half uur en een
// nieuwe pagina schrijven is veel meer. Deze schattingen staan hier bij elkaar
// zodat ze op één plek bij te stellen zijn.
export const MINUTEN: Record<Handeling, number> = {
  blijft: 10,        // even nakijken dat hij klopt
  uitbouwen: 120,    // tekst uitbreiden op basis van de blauwdruk
  nieuw: 180,        // een pagina van niets
  samenvoegen: 45,   // content overzetten plus de omleiding zetten
  opruimen: 15,      // weghalen plus de omleiding zetten
  meta: 15,          // titel en description herschrijven
};

// De volgorde waarin handelingen binnen een cluster gedaan worden. De pagina die
// blijft staat bovenaan, want al het andere wijst naar hem.
const HANDELING_VOLGORDE: Handeling[] = ["blijft", "uitbouwen", "nieuw", "samenvoegen", "opruimen", "meta"];

function categorieVanHandeling(h: Handeling): Categorie {
  switch (h) {
    case "samenvoegen": case "opruimen": return "can";
    case "uitbouwen": case "nieuw": return "cont";
    case "meta": return "meta";
    default: return "overig";
  }
}

// ═══════════════════════════════════════════════════════════
// WAT ER BINNENKOMT
// ═══════════════════════════════════════════════════════════

/** Eén regel uit de opruim-werklijst, zoals /api/admin/opruim-werklijst hem teruggeeft. */
export type OpruimRegel = {
  pad: string; uitkomst: string; naar: string; reden: string; onderbouwing: string[];
  term?: string; volume: number | null; klikken?: number; positie: number | null;
  groep: string; doorgevoerd?: boolean; contentOver?: boolean;
};

/** Eén kans uit de meta/CTR-lijst, zoals /api/admin/meta-ctr hem teruggeeft. */
export type MetaKans = {
  url: string; keyword?: string; volume: number | null; position: number | null;
  extraClicks?: number; curTitle?: string; curDesc?: string; reden?: string;
  issues?: { title?: string[]; desc?: string[] };
  proposal?: { status?: string };
};

/** Een taak die al in de planning staat, zodat een cluster weet dat hij al loopt. */
export type BestaandeTaak = { id: number; thread: string; url: string; status: string; genegeerd: boolean };

/** Een regel uit het logboek, zodat een cluster weet dat er al aan gewerkt is. */
export type GedaanRegel = { url: string | null; gebeurdeOp: string };

// ═══════════════════════════════════════════════════════════
// WAT ERUIT KOMT
// ═══════════════════════════════════════════════════════════

export type Kengetal = { label: string; waarde: string };

export type ClusterPagina = {
  pad: string;
  handeling: Handeling;
  naar: string;
  reden: string;
  onderbouwing: string[];
  term: string;
  volume: number | null;
  positie: number | null;
  klikken: number;
  minuten: number;
  doorgevoerd: boolean;
  /** De titel/description-kans op deze pagina, als die er is en nog zin heeft. */
  meta: MetaKans | null;
  /** Gevuld als er wél een kans lag maar die niets meer oplevert, met de reden. */
  vervallen: string;
};

export type Fase = 1 | 2 | 3;

export const FASE_TITEL: Record<Fase, string> = {
  1: "Structuur: bepalen welke pagina wint",
  2: "Inhoud: de winnaars sterk maken",
  3: "Laaghangend fruit: titels, descriptions en techniek",
};

export const FASE_WAAROM: Record<Fase, string> = {
  1: "Eerst uitzoeken welke pagina van een onderwerp de hoofdpagina wordt en de rest daarheen omleiden. Dit staat vooraan omdat alle andere stappen erop bouwen: een tekst uitbreiden of een titel verbeteren op een pagina die daarna wordt doorgestuurd is weggegooid werk.",
  2: "De pagina's die overblijven inhoudelijk sterk genoeg maken voor de zoekopdrachten die er nu op afkomen, plus de gaten vullen waar nog geen pagina voor is.",
  3: "Wat los van de structuur meteen klikken oplevert: titels en descriptions die de klik nu laten liggen, en losse technische punten. Kort werk, direct meetbaar, daarom achteraan.",
};

export type Werkcluster = {
  sleutel: string;
  nummer: number;
  naam: string;
  fase: Fase;
  week: number;
  minuten: number;
  /** Waar alles in dit cluster naartoe wijst, als er één winnaar is. */
  doel: string;
  paginas: ClusterPagina[];
  /** Eén zin: hoeveel pagina's, wat er met ze gebeurt, wat er op het spel staat. */
  samenvatting: string;
  /** De onderbouwing die alle pagina's in dit cluster delen, één keer. */
  gedeeld: string[];
  nu: Kengetal[];
  straks: Kengetal[];
  telling: { handeling: Handeling; n: number }[];
  categorieen: Categorie[];
  hoofdcategorie: Categorie;
  volume: number;
  /** Hoeveel kansen hier vervielen omdat de pagina toch verdwijnt. */
  vervallen: number;
  /** Staat dit cluster al (deels) in de planning, en is er al aan gewerkt. */
  inPlanning: number;
  alGedaan: number;
};

export type Werkplan = {
  clusters: Werkcluster[];
  perFase: { fase: Fase; clusters: Werkcluster[]; minuten: number; paginas: number }[];
  weken: number;
  minuten: number;
  paginas: number;
  volume: number;
  vervallen: number;
  /** Clusters die buiten de drie maanden vallen bij dit budget. */
  buitenBereik: number;
  /** De tijd die in die overloop zit, zodat je kunt zeggen hoeveel er blijft liggen. */
  buitenBereikMinuten: number;
  /**
   * Blokken waar niets meer te doen is omdat alles al doorgevoerd is. Die vielen
   * hiervoor stil uit het plan (de zeef `minuten > 0`), en dat was niet te zien:
   * zocht je op "Zeist", dan kreeg je nul blokken, precies hetzelfde beeld als
   * wanneer de plaats nooit was bekeken. Nu staan ze apart, met hun pagina's, dus
   * "dit is af" is te onderscheiden van "hier is nooit naar gekeken".
   */
  afgerond: Werkcluster[];
  /**
   * Hoeveel uur per week er nodig is om het hele plan wél binnen een kwartaal te
   * doen. Zonder dit getal zegt het scherm alleen "92 weken" en dat is een
   * doodlopende mededeling; hiermee is het een gesprek over budget.
   */
  urenVoorKwartaal: number;
};

// ═══════════════════════════════════════════════════════════
// HULP
// ═══════════════════════════════════════════════════════════

const nl = new Intl.NumberFormat("nl-NL");
const getal = (n: number | null | undefined) => (n == null ? "onbekend" : nl.format(n));

export function urenTekst(minuten: number): string {
  if (minuten < 60) return `${minuten} min`;
  const u = Math.floor(minuten / 60);
  const m = minuten % 60;
  // "2 u 15" laat in het midden of dat kwartieren of minuten zijn; er hoort
  // "min" achter, anders sta je te rekenen bij een tijd die je moet inschatten.
  return m ? `${u} u ${m} min` : `${u} uur`;
}

/** De horizon van een plan: een kwartaal. Wat daarbuiten valt is geen planning meer. */
export const WEKEN_IN_KWARTAAL = 13;

function opsomming(delen: string[]): string {
  if (delen.length <= 1) return delen[0] || "";
  return `${delen.slice(0, -1).join(", ")} en ${delen[delen.length - 1]}`;
}

/** De langste gemeenschappelijke start van meerdere onderbouwingen. */
function gedeeldeRegels(lijsten: string[][]): string[] {
  const echt = lijsten.filter((l) => l.length);
  if (echt.length < 2) return [];
  const kortste = Math.min(...echt.map((l) => l.length));
  const uit: string[] = [];
  for (let i = 0; i < kortste; i++) {
    const regel = echt[0][i];
    if (echt.every((l) => l[i] === regel)) uit.push(regel);
    else break;
  }
  return uit;
}

function normHandeling(uitkomst: string): Handeling {
  switch (uitkomst) {
    case "uitbouwen": case "nieuw": case "samenvoegen": case "opruimen": case "blijft":
      return uitkomst;
    case "meta": return "meta";
    default: return "blijft";
  }
}

/** Een pagina die verdwijnt of opgaat in een andere: daar is verder werk zinloos op. */
function verdwijnt(h: Handeling): boolean {
  return h === "samenvoegen" || h === "opruimen";
}

// ═══════════════════════════════════════════════════════════
// HET PLAN BOUWEN
// ═══════════════════════════════════════════════════════════

export function bouwWerkplan(
  opruim: OpruimRegel[],
  metas: MetaKans[],
  taken: BestaandeTaak[] = [],
  gedaan: GedaanRegel[] = [],
  urenPerWeek = 3,
): Werkplan {
  // ── 1. Clusters uit de opruimlijst; `groep` is al een plaats of een onderwerp ──
  const bakken = new Map<string, ClusterPagina[]>();
  const namen = new Map<string, string>();
  for (const r of opruim) {
    if (!r.pad) continue;
    const naam = (r.groep || "").trim() || "Losse pagina's";
    const sleutel = naam.toLowerCase();
    const handeling = normHandeling(r.uitkomst);
    if (!bakken.has(sleutel)) { bakken.set(sleutel, []); namen.set(sleutel, naam); }
    bakken.get(sleutel)!.push({
      pad: r.pad, handeling, naar: r.naar || "", reden: r.reden || "",
      onderbouwing: r.onderbouwing || [], term: r.term || "",
      volume: r.volume, positie: r.positie, klikken: r.klikken || 0,
      minuten: MINUTEN[handeling], doorgevoerd: !!r.doorgevoerd,
      meta: null, vervallen: "",
    });
  }

  // ── 2. De meta/CTR-kansen aan hun cluster hangen ──
  // Dit is het punt waar "alles hangt samen" zit: een titel-kans op een pagina die
  // in een cluster zit, is werk BINNEN dat cluster. Zonder deze stap staan er twee
  // aparte werelden op het scherm die over dezelfde pagina's gaan.
  const paginaIndex = new Map<string, { sleutel: string; pagina: ClusterPagina }>();
  for (const [sleutel, lijst] of bakken) {
    for (const p of lijst) paginaIndex.set(padVan(p.pad), { sleutel, pagina: p });
  }

  const losseMetas: MetaKans[] = [];
  for (const m of metas) {
    if (!m.url) continue;
    if (m.proposal?.status === "doorgevoerd") continue;
    const gevonden = paginaIndex.get(padVan(m.url));
    if (!gevonden) { losseMetas.push(m); continue; }
    const p = gevonden.pagina;
    if (verdwijnt(p.handeling)) {
      // Een titel verbeteren op een pagina die volgende week verdwijnt is
      // weggegooid werk. Zichtbaar laten vervallen, niet stil weglaten.
      p.vervallen = p.handeling === "samenvoegen"
        ? `De titel-kans hier vervalt: deze pagina gaat op in ${padVan(p.naar) || "de hoofdpagina"}.`
        : "De titel-kans hier vervalt: deze pagina wordt opgeruimd.";
      continue;
    }
    p.meta = m;
    p.minuten += MINUTEN.meta;
  }

  // ── 3. Losse kansen die nergens bij horen: bundelen op pagina-familie ──
  // Zonder dit worden het weer honderden regels van één pagina.
  const families = bepaalFamilies(losseMetas.map((m) => m.url));
  for (const m of losseMetas) {
    const familie = families.get(padVan(m.url)) || "";
    const naam = familie ? `${familieTitel(familie)}-pagina's` : "Losse titels en descriptions";
    const sleutel = `meta:${familie || "los"}`;
    if (!bakken.has(sleutel)) { bakken.set(sleutel, []); namen.set(sleutel, naam); }
    const missend = [...(m.issues?.title || []), ...(m.issues?.desc || [])];
    bakken.get(sleutel)!.push({
      pad: m.url, handeling: "meta", naar: "",
      reden: m.reden === "kapot" ? "Titel of description ontbreekt of is kapot" : "Titel en description laten klikken liggen",
      onderbouwing: missend.length ? [`Wat er nu niet klopt: ${missend.join(", ")}.`] : [],
      term: m.keyword || "", volume: m.volume, positie: m.position, klikken: 0,
      minuten: MINUTEN.meta, doorgevoerd: false, meta: m, vervallen: "",
    });
  }

  // ── 4. Van bak naar cluster: de vier blokken die je op het scherm wilt zien ──
  const takenPerThread = new Map<string, number>();
  for (const t of taken) {
    if (t.genegeerd || t.status === "klaar") continue;
    const k = (t.thread || "").trim().toLowerCase();
    takenPerThread.set(k, (takenPerThread.get(k) || 0) + 1);
  }
  const gedaanPerPad = new Map<string, number>();
  for (const g of gedaan) {
    if (!g.url) continue;
    const k = padVan(g.url);
    gedaanPerPad.set(k, (gedaanPerPad.get(k) || 0) + 1);
  }

  let clusters: Werkcluster[] = [];
  for (const [sleutel, paginas] of bakken) {
    if (!paginas.length) continue;
    paginas.sort((a, b) =>
      HANDELING_VOLGORDE.indexOf(a.handeling) - HANDELING_VOLGORDE.indexOf(b.handeling) ||
      (b.volume || 0) - (a.volume || 0) ||
      a.pad.localeCompare(b.pad));

    const naam = namen.get(sleutel) || "Overig";
    const open = paginas.filter((p) => !p.doorgevoerd);
    const minuten = open.reduce((s, p) => s + p.minuten, 0);
    const volume = paginas.reduce((s, p) => s + (p.volume || 0), 0);
    const klikken = paginas.reduce((s, p) => s + (p.klikken || 0), 0);
    const posities = paginas.map((p) => p.positie).filter((x): x is number => x != null);
    const extra = paginas.reduce((s, p) => s + (p.meta?.extraClicks || 0), 0);

    const telling: { handeling: Handeling; n: number }[] = [];
    for (const h of HANDELING_VOLGORDE) {
      const n = open.filter((p) => p.handeling === h).length;
      if (n) telling.push({ handeling: h, n });
    }
    const metaErbij = open.filter((p) => p.handeling !== "meta" && p.meta).length;
    if (metaErbij) telling.push({ handeling: "meta", n: metaErbij });

    const blijvers = paginas.filter((p) => !verdwijnt(p.handeling));
    const doel = paginas.find((p) => p.handeling === "blijft" || p.handeling === "uitbouwen")?.pad
      || [...new Set(paginas.map((p) => p.naar).filter(Boolean))][0] || "";

    const categorieen = [...new Set(open.map((p) => categorieVanHandeling(p.handeling)))];
    const telPerCat = new Map<Categorie, number>();
    for (const p of open) {
      const c = categorieVanHandeling(p.handeling);
      telPerCat.set(c, (telPerCat.get(c) || 0) + 1);
    }
    const hoofdcategorie = [...telPerCat.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "overig";

    // De fase volgt uit wat er in het cluster te doen is, niet uit een los oordeel.
    const fase: Fase = open.some((p) => verdwijnt(p.handeling)) ? 1
      : open.some((p) => p.handeling === "uitbouwen" || p.handeling === "nieuw") ? 2
      : 3;

    const stukken = telling.map(({ handeling, n }) =>
      handeling === "meta" ? `${n} keer titel en description` : `${n} ${HANDELING_LABEL[handeling]}`);
    const samenvatting = [
      `${open.length} ${open.length === 1 ? "pagina" : "pagina's"}: ${opsomming(stukken)}`,
      volume > 0 ? `${getal(volume)} zoekopdrachten per maand` : "",
    ].filter(Boolean).join(" · ");

    const nu: Kengetal[] = [{ label: "pagina's nu", waarde: String(paginas.length) }];
    if (posities.length) nu.push({ label: "gemiddelde positie", waarde: (Math.round((posities.reduce((s, x) => s + x, 0) / posities.length) * 10) / 10).toString().replace(".", ",") });
    if (volume > 0) nu.push({ label: "zoekopdrachten per maand", waarde: getal(volume) });
    if (klikken > 0) nu.push({ label: "klikken nu", waarde: getal(klikken) });

    const straks: Kengetal[] = [];
    if (blijvers.length !== paginas.length) {
      straks.push({ label: "pagina's straks", waarde: String(blijvers.length) });
      if (volume > 0 && doel) straks.push({ label: "gebundeld op", waarde: padVan(doel) });
    }
    if (extra > 0) straks.push({ label: "geschat extra klikken per 90 dagen", waarde: `+${getal(extra)}` });
    if (!straks.length && volume > 0) straks.push({ label: "te winnen zoekvolume", waarde: getal(volume) });

    clusters.push({
      sleutel, nummer: 0, naam, fase, week: 0, minuten, doel, paginas,
      samenvatting, gedeeld: gedeeldeRegels(paginas.map((p) => p.onderbouwing)),
      nu, straks, telling, categorieen, hoofdcategorie, volume,
      vervallen: paginas.filter((p) => p.vervallen).length,
      inPlanning: takenPerThread.get(naam.toLowerCase()) || 0,
      alGedaan: paginas.reduce((s, p) => s + (gedaanPerPad.get(padVan(p.pad)) || 0), 0),
    });
  }

  // ── 5. De volgorde: fase eerst, daarbinnen de grootste waarde eerst ──
  // Een blok zonder open werk hoort niet in een plan, maar wél op het scherm: het
  // apart zetten in plaats van weggooien is het verschil tussen "dit is af" en
  // een gat waarvan niemand kan zien of er ooit naar gekeken is.
  const afgerond = clusters
    .filter((c) => c.minuten <= 0)
    .sort((a, b) => b.paginas.length - a.paginas.length || a.naam.localeCompare(b.naam));
  clusters = clusters
    .filter((c) => c.minuten > 0)
    .sort((a, b) => a.fase - b.fase || b.volume - a.volume || b.paginas.length - a.paginas.length || a.naam.localeCompare(b.naam));

  // ── 6. Nummeren en over de weken verdelen op het urenbudget ──
  const budget = Math.max(30, Math.round(urenPerWeek * 60));
  let week = 1;
  let over = budget;
  clusters.forEach((c, i) => {
    c.nummer = i + 1;
    // Een cluster dat niet meer in deze week past schuift door, tenzij de week nog
    // helemaal leeg is: dan is het cluster gewoon groter dan een week en loopt hij
    // over, want opknippen midden in een cluster is precies wat we niet willen.
    if (c.minuten > over && over < budget) { week++; over = budget; }
    c.week = week;
    over -= c.minuten;
    if (over <= 0) { week++; over = budget; }
  });

  const perFase = ([1, 2, 3] as Fase[]).map((fase) => {
    const lijst = clusters.filter((c) => c.fase === fase);
    return {
      fase, clusters: lijst,
      minuten: lijst.reduce((s, c) => s + c.minuten, 0),
      paginas: lijst.reduce((s, c) => s + c.paginas.length, 0),
    };
  }).filter((f) => f.clusters.length > 0);

  const totaalMinuten = clusters.reduce((s, c) => s + c.minuten, 0);
  const buiten = clusters.filter((c) => c.week > WEKEN_IN_KWARTAAL);
  return {
    clusters, perFase,
    weken: clusters.length ? Math.max(...clusters.map((c) => c.week)) : 0,
    minuten: totaalMinuten,
    paginas: clusters.reduce((s, c) => s + c.paginas.length, 0),
    volume: clusters.reduce((s, c) => s + c.volume, 0),
    vervallen: clusters.reduce((s, c) => s + c.vervallen, 0),
    buitenBereik: buiten.length,
    buitenBereikMinuten: buiten.reduce((s, c) => s + c.minuten, 0),
    afgerond,
    // Naar boven op halve uren, want een kwartier meer per week bestaat niet
    // als afspraak met een klant.
    urenVoorKwartaal: Math.ceil((totaalMinuten / WEKEN_IN_KWARTAAL / 60) * 2) / 2,
  };
}

/** Wat er met één pagina gebeurt, in één zin, voor de regel in de werkzaamhedenlijst. */
export function paginaRegel(p: ClusterPagina): string {
  if (p.handeling === "samenvoegen" && p.naar) return `gaat op in ${padVan(p.naar)}`;
  if (p.handeling === "opruimen") return p.naar ? `weg, omleiden naar ${padVan(p.naar)}` : "weg";
  if (p.handeling === "blijft") return "wordt de hoofdpagina";
  if (p.handeling === "uitbouwen") return "wordt uitgebouwd tot de hoofdpagina";
  if (p.handeling === "nieuw") return "moet nog gemaakt worden";
  if (p.handeling === "meta") return "nieuwe titel en description";
  return p.reden;
}

/** De naam van een pagina in gewone taal, voor naast het pad. */
export function paginaNaam(pad: string): string {
  return titelVanSlug(pad);
}
