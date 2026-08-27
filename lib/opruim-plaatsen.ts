import { getClientUrls } from "./site-urls";
import { getGscQueryPagePairs } from "./google";
import { getOrgData } from "./org-data";
import { getUrlStructuur, getAdsPaginas, isAdsPad, zonderTeBrede } from "./opruim-regels";
import { plaatsHerkenning } from "./opruim-structuur";
import { termUitPad } from "./opruim-waarde";
import { feitenPerTerm } from "./opruim-intentie";
import { weegHaalbaarheid, autoriteitVan, type Haalbaarheid } from "./opruim-haalbaarheid";
import { taalBomen, taalVan } from "./taalvarianten";

// ═══════════════════════════════════════════════════════════
// PLAATSPAGINA'S: VIJF VRAGEN, EN PAS DE LAATSTE GAAT OVER EEN VESTIGING
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat, met de cijfers erbij (7 augustus 2026, One Day Clinic).
//
// De site heeft ruim honderd plaatspagina's, verdeeld over vier URL-vormen voor
// precies hetzelfde: /soa-klinieken/soa-test-<plaats>/, /soa-test-locaties/
// soa-test-<plaats>/, /soa-poli-<plaats>/ en /soa-kliniek-<plaats>/. Daarvan
// halen er VIER noemenswaardig verkeer (Rotterdam, Utrecht, Amsterdam, Den Haag,
// samen 687 bezoekers per maand van de 10.234). De andere ruim negentig leveren
// samen vrijwel niets.
//
// Concurrent Stadskliniek heeft ACHT plaatspagina's en haalt daar de helft van
// zijn verkeer uit. Op "soa test amsterdam" (1900 per maand) staat die op plek 2.
// De Amsterdam-pagina van One Day Clinic rankt niet op die term, en de
// Utrecht-pagina rankt op "one day clinic utrecht", dus op de merknaam. Kortom:
// deze site wint op merk-plus-stad, de concurrent wint op dienst-plus-stad. Daar
// zit het geld, en daar zit het probleem.
//
// De verleiding is dan om te zeggen: geen vestiging, dus weg. Dat is te grof.
// Een goede pagina voor "soa test Haarlem" kan prima verkeer opleveren zonder
// vestiging in Haarlem, zolang er vraag is en het te winnen valt. Daarom vijf
// vragen, in deze volgorde, en de vestiging is de LAATSTE:
//
//   1. Levert hij nu iets op?     klikken, vertoningen, positie  -> ja: blijft
//   2. Is er vraag?               zoekvolume op de plaatsterm     -> nee: weg
//   3. Is het te winnen?          moeilijkheid tegen autoriteit
//   4. Klopt de URL-vorm?         één vorm, de rest voegt samen
//   5. Hebben we iets te melden?  vestiging, of bereik vanuit een vestiging
//
// De vestigingen komen uit de bedrijfsgegevens die voor de structured data al
// zijn ingevuld. Geen nieuw invulveld dus: die kennis stond er al.
//
// Eén rij per PLAATS, niet per pagina. De vier URL-vormen van Gouda zijn samen
// één besluit; ze los voorleggen levert vier halve beslissingen op die elkaar
// tegenspreken.
// ═══════════════════════════════════════════════════════════

export type PlaatsPagina = {
  pad: string;
  vorm: string;
  term: string;
  klikken: number;
  vertoningen: number;
  positie: number | null;
  /**
   * Is dit een Google Ads-landingspagina? Die deed eerst helemaal niet mee aan de
   * analyse, en dat was te grof: het is óók een SEO-pagina, en juist daar staan
   * vaak vier of vijf andere pagina's voor in de weg. Wat NIET mag is hem
   * opruimen of omleiden; wat wél moet is de rest van de plaats erbij pakken. Hij
   * is daarom altijd de pagina die blijft, en staat nooit bij wat weggaat.
   */
  advertentie: boolean;
};

export type Uitkomst = "uitbouwen" | "blijft" | "samenvoegen" | "weg";

export type PlaatsAdvies = {
  plaats: string;            // zoals in de URL, bijvoorbeeld "den-haag"
  naam: string;              // netjes, bijvoorbeeld "Den Haag"
  paginas: PlaatsPagina[];
  /** Het pad dat blijft. Leeg als er niets blijft. */
  blijft: string;
  /** De paden die daarin opgaan of verdwijnen. */
  gaatWeg: string[];
  uitkomst: Uitkomst;
  vestiging: boolean;
  term: string;              // de zoekterm van deze plaats
  volume: number | null;
  moeilijkheid: number | null;
  haalbaarheid: Haalbaarheid;
  klikken: number;
  vertoningen: number;
  bestePositie: number | null;
  /** De onderbouwing, zin voor zin, met de echte cijfers erin. */
  onderbouwing: string[];
};

export type PlaatsenRapport = {
  adviezen: PlaatsAdvies[];
  vestigingen: string[];     // de plaatsen waar de klant echt zit
  vormen: string[];          // welke URL-vormen er naast elkaar leven
  gekozenVorm: string;
  autoriteit: number | null;
  /** Hoeveel pagina's dit raakt, en wat het oplevert. */
  paginasNu: number;
  paginasStraks: number;
};

const padVan = (u: string) => { try { return new URL(u).pathname; } catch { return (u || "").trim(); } };
const norm = (u: string) => padVan(u).replace(/\/+$/, "").toLowerCase();

/** "Den Haag" en "den-haag" moeten hetzelfde zijn, ook met accenten erin. */
const sleutel = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const mooiePlaats = (s: string) =>
  s.split("-").map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(" ");

/** Vanaf hoeveel zoekopdrachten per maand is een plaats de moeite waard? Bewust
    laag: één klant per maand uit een klein dorp is nog steeds een klant. */
const DREMPEL_VOLUME = 30;
/** Vanaf hoeveel vertoningen doet een pagina zichtbaar mee, ook zonder klikken. */
const DOET_MEE_VERTONINGEN = 100;

export async function adviesPerPlaats(slug: string, domain: string): Promise<PlaatsenRapport> {
  const [urls, paren, org, gekozenVorm, adsRuw, autoriteit] = await Promise.all([
    getClientUrls(slug).catch(() => []),
    getGscQueryPagePairs(domain, 90).catch(() => []),
    getOrgData(slug).catch(() => null),
    getUrlStructuur(slug).catch(() => ""),
    getAdsPaginas(slug).catch(() => ({ paden: [], geen: false, ingevuld: false })),
    autoriteitVan(domain).catch(() => null),
  ]);

  // ── Twee lijsten, met opzet ──────────────────────────────────────────────
  // `live` is de KERN: alles behalve de advertentiepagina's. Daaruit leert de
  // motor hoe een plaatspagina er op deze site uitziet. Dat moet uit de kern
  // komen, want de ads-lijst bevat naast losse landingspagina's ook hele mappen
  // (bij One Day Clinic de complete `/en/`-sectie en `/`). Namen we die mee in
  // het leren, dan ontstond er een tweede set vormen (`/en/soa-poli-<plaats>/`
  // en familie) en zakte het advies van 62 plaatsen naar 18: precies de
  // opruimklussen die er wél moeten staan verdwenen.
  //
  // `liveMetAds` is alles. Een advertentiepagina mag namelijk wél meedoen zodra
  // hij in een vorm staat die de kern als plaatsvorm herkent. Dat is precies de
  // stadspagina van Utrecht, Rotterdam, Amsterdam, Den Haag en Eindhoven, en
  // zonder die pagina viel de hele stad uit het advies terwijl er vier of vijf
  // pagina's voor de landingspagina in de weg staan. Een vacaturepagina of een
  // Engelse variant komt er zo niet in, want die vormen kent de kern niet.
  //
  // Wat een advertentiepagina beschermt is dus niet dat hij onzichtbaar is, maar
  // dat hij nooit weggaat. Dat wordt verderop afgedwongen.
  const liveMetAds = urls.filter((u) => (u.status ?? 200) === 200).map((u) => padVan(u.url));
  // Een regel die een hele sectie dekt telt niet als advertentiepagina. Bij One
  // Day Clinic stond `/en/` op de lijst en dat zette 315 pagina's buiten beeld.
  const ads = zonderTeBrede(adsRuw, liveMetAds);
  // Taal is een eigen dimensie, geen dubbeling. Nu `/en/` niet meer als
  // advertentiesectie wegvalt, doen die pagina's gewoon mee, en dan moet één ding
  // vaststaan: een Engelse plaatspagina hoort bij de Engelse boom en gaat NOOIT op
  // in zijn Nederlandse tegenhanger. Die twee zijn via hreflang netjes aan elkaar
  // gekoppeld; samenvoegen zou een werkende taalstructuur slopen. Wat er met een
  // taalvariant moet gebeuren is een eigen vraag, en die wordt beantwoord in
  // `lib/taalvarianten.ts`: is er zoekvraag in díe taal?
  const bomen = taalBomen(liveMetAds);
  const live = liveMetAds.filter((p) => !isAdsPad(p, ads));
  if (live.length < 10) {
    return { adviezen: [], vestigingen: [], vormen: [], gekozenVorm, autoriteit, paginasNu: 0, paginasStraks: 0 };
  }

  // De WOORDENSCHAT wordt geleerd uit álles, ook de advertentiepagina's. Deze
  // herkenning leidt af welk stukje van een URL een plaatsnaam is door te kijken
  // welke woorden op dezelfde plek in een patroon voor elkaar inwisselbaar zijn.
  // Leer je dat alleen uit de kern, dan komen Utrecht, Amsterdam, Rotterdam, Den
  // Haag en Eindhoven daar nooit in voor (hun stadspagina staat op de ads-lijst)
  // en herkent de motor die woorden dus niet als plaats. Dan valt de stad alsnog
  // buiten het advies, ook al laten we de pagina hieronder wél toe.
  //
  // Let op het verschil met `telPerVorm` verderop: welke VORMEN meetellen wordt
  // wél uit de kern bepaald, want de ads-lijst bevat hele mappen en die zouden
  // anders een tweede set vormen opleveren.
  const { vormVan, plaatsIn } = plaatsHerkenning(liveMetAds);

  // Waar zit de klant echt? Uit de bedrijfsgegevens die voor de structured data
  // al zijn ingevuld: elke vestiging heeft een plaats. areaServed telt mee als
  // verzorgingsgebied, want dat is precies waarvoor dat veld bedoeld is.
  const vestigingen = new Set<string>();
  for (const v of org?.data.vestigingen || []) if (v.plaats) vestigingen.add(sleutel(v.plaats));
  if (org?.data.plaats) vestigingen.add(sleutel(org.data.plaats));
  const bereik = new Set([...(org?.data.areaServed || [])].map(sleutel).filter(Boolean));

  // Per pagina de cijfers uit Search Console.
  const perPagina = new Map<string, { klikken: number; vertoningen: number; beste: number | null }>();
  for (const p of paren) {
    const k = norm(p.page);
    const e = perPagina.get(k) || { klikken: 0, vertoningen: 0, beste: null };
    e.klikken += p.clicks; e.vertoningen += p.impressions;
    if (e.beste == null || p.position < e.beste) e.beste = p.position;
    perPagina.set(k, e);
  }

  // Welke URL-vormen zijn ECHT locatievormen? Dat is de kern van de herkenning en
  // hij moet streng, want de woordtelling ziet ook "chlamydia" en "afscheiding"
  // als plaats: die woorden vullen hetzelfde gat in de URL als een stadsnaam.
  // Zonder deze zeef kwamen /vaginale-afscheiding/ en /chlamydia-in-de-keel/ als
  // plaatspagina op de lijst, mét een advies om ze uit te bouwen. Twee eisen:
  //
  //  1. Een echte locatievorm heeft VEEL pagina's. Een kliniek heeft tientallen
  //     steden; een aandoening staat op één of twee pagina's in die vorm.
  //  2. Er moet iets anders in de vorm staan dan alleen plaatsnamen. /<plaats>/
  //     en /<plaats>-<plaats>/ zijn geen patroon maar losse woorden; zo belandden
  //     /algemene-voorwaarden/ en /afspraak-maken/ eerder in de telling.
  const MIN_PER_VORM = 5;
  const echteVorm = (v: string) => {
    const rest = v.replace(/<plaats>/g, "").replace(/[/\-]/g, "").trim();
    return rest.length >= 3;
  };
  const telPerVorm = new Map<string, number>();
  for (const pad of live) {
    const v = vormVan(pad);
    if (!v.includes("<plaats>") || !echteVorm(v)) continue;
    telPerVorm.set(v, (telPerVorm.get(v) || 0) + 1);
  }
  const locatieVormen = new Set([...telPerVorm.entries()].filter(([, n]) => n >= MIN_PER_VORM).map(([v]) => v));

  // Alle plaatspagina's, gegroepeerd per plaats.
  const perPlaats = new Map<string, PlaatsPagina[]>();
  const vormen = new Set<string>();
  const pushPagina = (pad: string, vorm: string, plaats: string) => {
    const g = perPagina.get(norm(pad));
    // De sleutel draagt de taal mee, zodat "Haarlem" en "Haarlem (EN)" twee losse
    // besluiten zijn in plaats van één hoop waarin ze elkaar opeten.
    const taal = taalVan(pad, bomen);
    const sleutelPlaats = taal ? `${taal}:${plaats}` : plaats;
    if (!perPlaats.has(sleutelPlaats)) perPlaats.set(sleutelPlaats, []);
    perPlaats.get(sleutelPlaats)!.push({
      pad, vorm, term: termUitPad(pad),
      klikken: g?.klikken || 0,
      vertoningen: g?.vertoningen || 0,
      positie: g?.beste != null ? Math.round(g.beste * 10) / 10 : null,
      advertentie: isAdsPad(pad, ads),
    });
  };
  // Over ALLE pagina's, dus inclusief de advertentiepagina's, maar alleen in een
  // vorm die de kern hierboven als plaatsvorm heeft herkend. Zo komt de
  // stadspagina van Utrecht en Amsterdam er wél in, en een vacature- of een
  // Engelse pagina niet: die vormen staan niet in `locatieVormen`.
  for (const pad of liveMetAds) {
    const vorm = vormVan(pad);
    if (!locatieVormen.has(vorm)) continue;
    const plaats = plaatsIn(pad);
    if (!plaats) continue;
    vormen.add(vorm);
    pushPagina(pad, vorm, plaats);
  }
  if (!perPlaats.size) {
    return { adviezen: [], vestigingen: [...vestigingen], vormen: [], gekozenVorm, autoriteit, paginasNu: 0, paginasStraks: 0 };
  }

  // Losse zwervers: een pagina die zelf niet genoeg lotgenoten heeft om als vorm
  // te tellen (bijvoorbeeld maar twee pagina's in die vorm), maar wél over een
  // plaats gaat die via een ANDERE vorm al erkend is. Zo'n pagina hoort bij het
  // besluit voor die plaats, anders blijft hij onopgemerkt naast de rest staan.
  // Ontdekt bij One Day Clinic: /soa-klinieken/soa-kliniek-cuijk/ en
  // -soa-kliniek-nuenen/ zijn de enige twee pagina's in die vorm en haalden de
  // drempel van vijf dus nooit, terwijl cuijk en nuenen via /soa-poli-<plaats>/
  // al lang bekende plaatsen waren.
  //
  // Maar een zwerver moet wél over hetzelfde ONDERWERP gaan. Zonder die eis
  // haakt elke pagina aan die toevallig een stadsnaam bevat, en dat werd meteen
  // zichtbaar toen de grote steden erbij kwamen: bij Amsterdam stelde de motor
  // voor om `/over-ons/vacatures/vacature-basisarts-verpleegkundige-amsterdam/`
  // en `/allergie-test-amsterdam/` op te laten gaan in de SOA-landingspagina. Een
  // vacature is geen SOA-test; die omleiding zou de vacature vernietigen.
  //
  // Het onderwerp is af te lezen uit de erkende locatievormen zelf: het woord dat
  // in élke locatievorm voorkomt (hier "soa"). Een zwerver moet dat woord ook
  // hebben. `/soa-klinieken/soa-kliniek-cuijk/` komt zo nog steeds binnen, precies
  // waarvoor deze ronde bedoeld was; de vacature en de allergietest niet.
  const woordenVanVorm = (v: string) =>
    new Set(v.replace(/<plaats>/g, "").split(/[^a-z0-9]+/i).filter((w) => w.length > 2).map((w) => w.toLowerCase()));
  const vormLijst = [...locatieVormen].map(woordenVanVorm);
  const kernwoorden = vormLijst.length
    ? [...vormLijst[0]].filter((w) => vormLijst.every((s) => s.has(w)))
    : [];

  for (const pad of live) {
    const vorm = vormVan(pad);
    if (locatieVormen.has(vorm)) continue; // al meegenomen in de eerste ronde
    if (!vorm.includes("<plaats>") || !echteVorm(vorm)) continue;
    const plaats = plaatsIn(pad);
    // Dezelfde sleutel als hierboven: een Nederlandse zwerver haakt alleen aan bij
    // de Nederlandse boom, een Engelse alleen bij de Engelse.
    const zwerverSleutel = taalVan(pad, bomen) ? `${taalVan(pad, bomen)}:${plaats}` : plaats;
    if (!plaats || !perPlaats.has(zwerverSleutel)) continue; // alleen aanhaken bij een al bekende plaats
    // Zelfde onderwerp als de locatiepagina's, anders blijft hij eraf.
    if (kernwoorden.length) {
      const woorden = woordenVanVorm(vorm);
      if (!kernwoorden.some((w) => woorden.has(w))) continue;
    }
    pushPagina(pad, vorm, plaats);
  }

  // De zoekterm per plaats: die van de pagina in de gekozen vorm, anders die van
  // de sterkste pagina. Volume en moeilijkheid in één opvraag voor alles.
  const termPerPlaats = new Map<string, string>();
  for (const [plaats, paginas] of perPlaats) {
    const voorkeur = gekozenVorm
      ? paginas.find((p) => p.vorm === gekozenVorm)
      : undefined;
    const gekozen = voorkeur || [...paginas].sort((a, b) => b.vertoningen - a.vertoningen)[0];
    if (gekozen?.term) termPerPlaats.set(plaats, gekozen.term);
  }
  const feiten = await feitenPerTerm([...termPerPlaats.values()]).catch(() => new Map());

  const adviezen: PlaatsAdvies[] = [];
  for (const [sleutelPlaats, paginas] of perPlaats) {
    // De sleutel draagt de taal mee ("en:haarlem"); voor de naam, de vestiging en
    // het bereik hebben we de kale plaatsnaam nodig.
    const dp = sleutelPlaats.indexOf(":");
    const taal = dp > 0 ? sleutelPlaats.slice(0, dp) : "";
    const plaats = dp > 0 ? sleutelPlaats.slice(dp + 1) : sleutelPlaats;
    const naam = taal ? `${mooiePlaats(plaats)} (${taal.toUpperCase()})` : mooiePlaats(plaats);
    const term = termPerPlaats.get(sleutelPlaats) || "";
    const f = feiten.get(term);
    const volume = f?.volume ?? null;
    const moeilijkheid = f?.moeilijkheid ?? null;
    const klikken = paginas.reduce((n, p) => n + p.klikken, 0);
    const vertoningen = paginas.reduce((n, p) => n + p.vertoningen, 0);
    const posities = paginas.map((p) => p.positie).filter((p): p is number => p != null);
    const bestePositie = posities.length ? Math.min(...posities) : null;
    const haalbaarheid = weegHaalbaarheid(moeilijkheid, autoriteit, bestePositie);
    const vestiging = vestigingen.has(plaats) || bereik.has(plaats);

    // Welke pagina houden we? De gekozen URL-vorm gaat vóór, want anders blijf je
    // eeuwig redirecten tussen vormen. Bestaat die vorm niet voor deze plaats, dan
    // de pagina die het beste presteert.
    // Een advertentiepagina gaat vóór alles: daar staat betaald verkeer op, dus
    // die pagina is per definitie de pagina die blijft. De rest van de plaats
    // wijst naar hem toe. Zonder deze voorrang zou de gekozen URL-vorm kunnen
    // winnen en zou de Ads-pagina bij "gaat weg" belanden, en dat is precies wat
    // nooit mag gebeuren.
    const advertentie = paginas.find((p) => p.advertentie);
    const inVorm = gekozenVorm ? paginas.find((p) => p.vorm === gekozenVorm) : undefined;
    const sterkste = [...paginas].sort((a, b) =>
      b.klikken - a.klikken || b.vertoningen - a.vertoningen ||
      (a.positie ?? 999) - (b.positie ?? 999))[0];
    const houder = advertentie || inVorm || sterkste;

    // ── De vijf vragen ───────────────────────────────────────────────────────
    const doetMee = klikken > 0 || (vertoningen >= DOET_MEE_VERTONINGEN && (bestePositie ?? 999) <= 20);
    const vraag = (volume ?? 0) >= DREMPEL_VOLUME;
    const kansloos = haalbaarheid.oordeel === "buiten bereik";
    const meerdereVormen = new Set(paginas.map((p) => p.vorm)).size > 1;

    let uitkomst: Uitkomst;
    if (doetMee) uitkomst = vestiging || vraag ? "uitbouwen" : "blijft";
    else if (!vraag) uitkomst = "weg";
    else if (vestiging) uitkomst = "uitbouwen";
    else if (kansloos) uitkomst = "weg";
    else uitkomst = "blijft";
    // Blijft er iets staan én bestaan er meerdere vormen, dan is samenvoegen de
    // eerste stap; dat is een ander soort werk dan opruimen.
    if (uitkomst !== "weg" && meerdereVormen) uitkomst = "samenvoegen";
    // Staat er een advertentiepagina bij, dan bestaat "weg" niet: op een plaats
    // met betaald verkeer gooi je niets weg. Zijn er meer pagina's, dan is het
    // werk juist het opruimen van wat vóór de landingspagina staat.
    if (advertentie && uitkomst === "weg") uitkomst = paginas.length > 1 ? "samenvoegen" : "blijft";

    const blijft = uitkomst === "weg" ? "" : houder?.pad || "";
    // Een advertentiepagina staat NOOIT bij wat weggaat, ook niet als een andere
    // pagina de houder werd. Dit is het slot onder de regel hierboven: één plek
    // die het afdwingt, zodat een latere wijziging aan de uitkomst-logica hem
    // niet alsnog per ongeluk kan omleiden.
    const gaatWeg = paginas
      .filter((p) => !p.advertentie && p.pad !== blijft)
      .map((p) => p.pad);

    adviezen.push({
      plaats: sleutelPlaats, naam, paginas, blijft, gaatWeg, uitkomst,
      vestiging, term, volume, moeilijkheid, haalbaarheid,
      klikken, vertoningen, bestePositie,
      onderbouwing: bouwOnderbouwing({
        naam, paginas, term, volume, moeilijkheid, autoriteit, haalbaarheid,
        klikken, vertoningen, bestePositie, vestiging, doetMee, vraag, meerdereVormen,
        uitkomst, blijft, gaatWeg, gekozenVorm,
      }),
    });
  }

  // Grootste kans eerst, en binnen dezelfde kans het meeste volume.
  const rang: Record<Uitkomst, number> = { uitbouwen: 0, samenvoegen: 1, blijft: 2, weg: 3 };
  adviezen.sort((a, b) => rang[a.uitkomst] - rang[b.uitkomst] || (b.volume || 0) - (a.volume || 0));

  const paginasNu = adviezen.reduce((n, a) => n + a.paginas.length, 0);
  const paginasStraks = adviezen.filter((a) => a.blijft).length;

  return {
    adviezen, vestigingen: [...vestigingen], vormen: [...vormen].sort(),
    gekozenVorm, autoriteit, paginasNu, paginasStraks,
  };
}

// ═══════════════════════════════════════════════════════════
// DE ONDERBOUWING
// ═══════════════════════════════════════════════════════════
// Geen scorewoorden en geen sjabloonzin, maar de redenering met de echte
// getallen erin: wat deze plaats nu oplevert, hoeveel vraag er is, of dat te
// winnen valt met de autoriteit die er is, hoeveel URL-vormen er naast elkaar
// leven, en of er iets te vertellen valt. Wie het er niet mee eens is, kan zien
// waaróp hij het oneens is; dat is het verschil tussen een advies en een oordeel.
// ═══════════════════════════════════════════════════════════
function bouwOnderbouwing(d: {
  naam: string; paginas: PlaatsPagina[]; term: string; volume: number | null;
  moeilijkheid: number | null; autoriteit: number | null; haalbaarheid: Haalbaarheid;
  klikken: number; vertoningen: number; bestePositie: number | null;
  vestiging: boolean; doetMee: boolean; vraag: boolean; meerdereVormen: boolean;
  uitkomst: Uitkomst; blijft: string; gaatWeg: string[]; gekozenVorm: string;
}): string[] {
  const uit: string[] = [];

  // 1. Wat levert deze plaats nu op?
  if (d.klikken > 0) {
    uit.push(`${d.naam} levert nu ${d.klikken} ${d.klikken === 1 ? "bezoeker" : "bezoekers"} per maand op uit Google, bij ${d.vertoningen} vertoningen${d.bestePositie != null ? ` en een beste plek van ${Math.round(d.bestePositie)}` : ""}. Dat is de belangrijkste reden om hier niets weg te gooien: wat werkt, werkt.`);
  } else if (d.vertoningen > 0) {
    uit.push(`${d.naam} krijgt ${d.vertoningen} vertoningen per maand maar geen enkele klik${d.bestePositie != null ? `, met als beste plek ${Math.round(d.bestePositie)}` : ""}. Google toont de pagina dus wel, maar niemand kiest hem. Dat is iets anders dan onzichtbaar zijn.`);
  } else {
    uit.push(`${d.naam} haalt op dit moment niets uit Google: geen klikken en geen vertoningen. Deze pagina bestaat wel, maar doet niet mee.`);
  }

  // 2. Is er vraag?
  if (d.volume == null) {
    uit.push(`Voor "${d.term}" is geen zoekvolume op te halen. Dat is geen bewijs dat er niets is, maar het betekent wel dat we hier op de eigen cijfers moeten varen.`);
  } else if (d.volume >= DREMPEL_VOLUME) {
    uit.push(`Er wordt ongeveer ${d.volume} keer per maand gezocht op "${d.term}". Die vraag bestaat dus, los van de vraag of wij hem nu pakken.`);
  } else {
    uit.push(`Op "${d.term}" wordt vrijwel niet gezocht (${d.volume} per maand). Er valt hier dus niets te winnen, ook niet met een betere pagina.`);
  }

  // 3. Is het te winnen?
  if (d.volume != null && d.volume >= DREMPEL_VOLUME && d.haalbaarheid.oordeel !== "onbekend") {
    uit.push(`Haalbaarheid: ${d.haalbaarheid.uitleg}`);
  }

  // 4. Hoeveel vormen leven er naast elkaar?
  if (d.meerdereVormen) {
    const vormen = [...new Set(d.paginas.map((p) => p.vorm))];
    uit.push(`Deze plaats staat ${d.paginas.length} keer op de site, in ${vormen.length} verschillende URL-vormen (${vormen.join(", ")}). Dat is het echte probleem: Google moet kiezen tussen pagina's van dezelfde site die hetzelfde zeggen, en kiest er dan geen van.${d.gekozenVorm ? ` De vastgelegde vorm is ${d.gekozenVorm}, dus die blijft.` : ""}`);
  }

  // 5. Valt er iets te vertellen?
  if (d.vestiging) {
    uit.push(`Er zit hier een vestiging. Deze pagina kan dus iets vertellen wat geen enkele concurrent kan kopiëren: het adres, de openingstijden, hoe je er komt en wie er werkt. Dat is precies wat een plaatspagina hoort te zijn.`);
  } else if (d.vraag) {
    uit.push(`Er zit hier geen vestiging. Dat is geen reden om de pagina weg te doen, want de vraag is er wel; het betekent dat de pagina eerlijk moet zijn over waar je dan wél terechtkomt, met de dichtstbijzijnde vestiging erop. Een pagina die doet alsof er een kliniek zit, is een pagina die Google en de bezoeker allebei doorhebben.`);
  } else {
    uit.push(`Er zit hier geen vestiging, en er is ook geen vraag. Dan is er niets te vertellen wat ergens toe leidt.`);
  }

  // Het besluit, in gewone taal.
  if (d.uitkomst === "uitbouwen") {
    uit.push(`**Wat we doen: uitbouwen.** Dit is een plaats waar iets te halen valt${d.vestiging ? " en waar we een echt verhaal hebben" : ""}. De pagina blijft en verdient een goede invulling: het lokale aanbod, de praktische informatie, en een tekst die op "${d.term}" gericht is in plaats van op de merknaam.`);
  } else if (d.uitkomst === "samenvoegen") {
    uit.push(`**Wat we doen: samenvoegen.** ${d.blijft} blijft, en ${d.gaatWeg.length === 1 ? "de andere pagina gaat" : `de andere ${d.gaatWeg.length} pagina's gaan`} daarheen. Zo houdt deze plaats één adres in plaats van ${d.paginas.length}, en hoeft Google niet meer te kiezen.`);
  } else if (d.uitkomst === "blijft") {
    uit.push(`**Wat we doen: laten staan.** Er is vraag en het is niet kansloos, maar er is nu geen aanleiding om hier tijd in te steken. Hij kost ook niets zolang hij er één keer staat en niet in vier vormen.`);
  } else {
    uit.push(`**Wat we doen: opruimen.** ${d.paginas.length === 1 ? "Deze pagina" : `Deze ${d.paginas.length} pagina's`} ${d.paginas.length === 1 ? "levert" : "leveren"} niets op, er is geen vraag om op te bouwen en er is niets te vertellen. Weg ermee: elke lege pagina minder maakt de pagina's die er wél toe doen sterker.`);
  }

  return uit;
}
