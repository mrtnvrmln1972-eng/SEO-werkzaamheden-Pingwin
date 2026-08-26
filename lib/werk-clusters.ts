// ═══════════════════════════════════════════════════════════
// WERK-CLUSTERS: VAN EEN LANGE LIJST NAAR EEN OVERZICHT
// ═══════════════════════════════════════════════════════════
// De werkplanning liet drie lange lijsten zien: alles wat er gebeurd is, alles
// wat gesignaleerd is, en alles wat gepland staat. Elk los regeltje klopte, maar
// samen was het onleesbaar: 38 redirects onder elkaar, zes mails over dezelfde
// factuur, twaalf stadspagina's die stuk voor stuk hetzelfde verhaal vertelden.
// Maartens oordeel: "een tyfus lange lijst waar niet over nagedacht is."
//
// Dit bestand is dat nadenken, één keer, op één plek. Het maakt van losse regels
// clusters met een titel die beschrijft WAT er gebeurd is ("38 oude adressen
// doorgestuurd") en een ondertitel die zegt WAAR en WANNEER ("SOA-test-pagina's,
// 12 pagina's, 3 t/m 5 augustus). Alle drie de blokken op het scherm lezen uit
// deze motor, zodat ze niet uit elkaar kunnen lopen.
//
// Drie manieren van bij elkaar horen, in deze volgorde:
//   1. MAIL, op onderwerp. Een mailwisseling is één gesprek, ook als er zes keer
//      "Re:" voor staat. Administratie (facturatie, afspraken, toegang) valt
//      bovendien onder een vast thema, want dat is geen SEO-werk maar ruis in
//      een werkplanning.
//   2. PAGINA-FAMILIE, op de gedeelde start van de slug. /soa-test-amsterdam/ en
//      /soa-test-utrecht/ zijn dezelfde soort pagina; één actie die daar twaalf
//      keer overheen ging is één regel, geen twaalf.
//   3. LOSSE PAGINA, op de pagina zelf. Een pagina die geanalyseerd, herschreven
//      en live gezet is, is één verhaal over die pagina.
//
// Alles is een pure functie zonder React en zonder database, zodat
// `proeven/werk-clusters.proef.ts` het met echte voorbeelden kan narekenen.

import type { ActiviteitSoort } from "./activiteit";
import { urlKey } from "./url-key";

// ── Soort werk: één indeling, gedeeld door élk blok op het scherm ──
// Dit stond eerder in het scherm zelf. Daar hoort het niet: de filterbalk, de
// gebeurtenissen, de signalen en de planning moeten per definitie dezelfde
// indeling gebruiken, anders filtert de balk iets anders weg dan hij belooft.
export type Categorie = "can" | "link" | "meta" | "cont" | "tech" | "meet" | "mail" | "overig";

export const CATEGORIE_LABEL: Record<Categorie, string> = {
  can: "Cannibalisatie", link: "Interne links", meta: "Meta en CTR", cont: "Content",
  tech: "Techniek", meet: "Meten", mail: "Mail en overleg", overig: "Overig",
};

export const CATEGORIE_VOLGORDE: Categorie[] = ["can", "link", "meta", "cont", "tech", "meet", "mail", "overig"];

// Mail had eerst het label "Meten", en dat klopte niet: een mailwisseling is geen
// meting. Met een eigen soort werk wordt de filterbalk pas echt bruikbaar, want
// "laat mij alleen de correspondentie zien" is een van de vragen die je stelt.
export function categorieVanSoort(soort: ActiviteitSoort): Categorie {
  switch (soort) {
    case "analyse": return "meet";
    case "blauwdruk": case "copy": case "copy-concept": case "copy-live": return "cont";
    case "meta": return "meta";
    case "alt": case "structured": case "paginawijziging": return "tech";
    case "intern-link": return "link";
    case "redirect": return "can";
    case "mail": return "mail";
    default: return "overig";
  }
}

export function categorieVanTaaktype(taaktype?: string | null): Categorie {
  switch (taaktype) {
    case "cannibalisatie": return "can";
    case "meta": return "meta";
    case "intern": return "link";
    case "copy": case "pijplijn": return "cont";
    case "structured": case "alt": return "tech";
    case "strategie": return "meet";
    default: return "overig";
  }
}

export function categorieVanBron(bron: "opruim" | "meta"): Categorie {
  return bron === "opruim" ? "can" : "meta";
}

// ═══════════════════════════════════════════════════════════
// PADEN EN PAGINA-FAMILIES
// ═══════════════════════════════════════════════════════════

/** Alleen het pad van een adres, zodat een volledig adres en een pad hetzelfde zijn. */
export function padVan(u: string): string {
  if (!u) return "";
  try { return new URL(u).pathname; } catch { return u; }
}

/**
 * De woorden waaruit een pad bestaat, met de mapstructuur en de streepjes als
 * hetzelfde soort scheiding: /soa-test/amsterdam/ en /soa-test-amsterdam/ leveren
 * allebei ["soa","test","amsterdam"] op, want voor een lezer is dat dezelfde pagina-familie.
 */
export function slugWoorden(url: string): string[] {
  return padVan(url)
    .toLowerCase()
    .replace(/[?#].*$/, "")
    .replace(/\.(html?|php|aspx?)$/, "")
    .split(/[/\-_]+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

// Woorden die op zichzelf niets zeggen over waar een pagina over gaat.
const LOZE_WOORDEN = new Set(["de", "het", "een", "en", "van", "voor", "in", "op", "www", "nl", "be", "index", "home"]);

/**
 * Mag deze gedeelde start als familienaam dienen? Twee eisen, allebei om te
 * voorkomen dat er families ontstaan die niets betekenen:
 *   - samen minstens vijf letters, dus "soa-test" (7) telt en "over" (4) niet;
 *   - niet uitsluitend uit vulwoorden bestaan.
 */
function bruikbarePrefix(woorden: string[]): boolean {
  if (!woorden.length) return false;
  if (woorden.every((w) => LOZE_WOORDEN.has(w))) return false;
  return woorden.join("").length >= 5;
}

/**
 * Deelt elk adres in bij een pagina-familie: de KORTSTE bruikbare gedeelde start
 * die minstens twee verschillende pagina's hebben. Leeg betekent: deze pagina
 * staat op zichzelf.
 *
 * Bewust de kortste en niet de langste: bij /soa-test-amsterdam/,
 * /soa-test-amsterdam-centrum/ en /soa-test-utrecht/ zou de langste twee families
 * maken (waarvan één met één lid), terwijl het voor een lezer één cluster steden is.
 */
export function bepaalFamilies(urls: string[]): Map<string, string> {
  const uniek = [...new Set(urls.filter(Boolean).map(padVan))];
  const woorden = new Map(uniek.map((u) => [u, slugWoorden(u)]));

  const tel = new Map<string, Set<string>>();
  for (const u of uniek) {
    const w = woorden.get(u)!;
    for (let n = 1; n <= w.length; n++) {
      const stuk = w.slice(0, n);
      if (!bruikbarePrefix(stuk)) continue;
      const k = stuk.join("-");
      if (!tel.has(k)) tel.set(k, new Set());
      tel.get(k)!.add(u);
    }
  }

  const uit = new Map<string, string>();
  for (const u of uniek) {
    const w = woorden.get(u)!;
    let familie = "";
    for (let n = 1; n <= w.length; n++) {
      const stuk = w.slice(0, n);
      if (!bruikbarePrefix(stuk)) continue;
      const k = stuk.join("-");
      if ((tel.get(k)?.size || 0) >= 2) { familie = k; break; }
    }
    uit.set(u, familie);
  }
  return uit;
}

/**
 * Zet de woorden van een slug om naar leesbare tekst. Alleen een KORT EERSTE woord
 * geldt als afkorting ("soa-test" wordt "SOA-test", "crp-waarde" wordt "CRP-waarde");
 * verderop blijft een kort woord gewoon een woord, anders wordt "over-ons" op het
 * scherm tot "Over ONS" geschreeuwd.
 */
function leesbareWoorden(woorden: string[]): string[] {
  return woorden.map((w, i) => {
    if (i > 0) return w;
    return w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1);
  });
}

/** "soa-test" wordt "SOA-test". */
export function familieTitel(sleutel: string): string {
  return leesbareWoorden(sleutel.split("-").filter(Boolean)).join("-");
}

/** De naam van één pagina, afgeleid van het laatste stuk van zijn pad. */
export function titelVanSlug(u: string): string {
  const p = padVan(u).replace(/^\/+|\/+$/g, "");
  const laatste = (p.split("/").pop() || p).trim();
  if (!laatste) return padVan(u) || u;
  const woorden = laatste.split("-").filter(Boolean);
  if (!woorden.length) return padVan(u);
  return leesbareWoorden(woorden).join(" ");
}

// ═══════════════════════════════════════════════════════════
// MAIL: ÉÉN GESPREK IS ÉÉN REGEL
// ═══════════════════════════════════════════════════════════

export type MailKop = { onderwerp: string; richting: "uit" | "in" | "onbekend"; wie: string };

/**
 * Haalt onderwerp en richting uit de logregel. Het logboek schrijft mail weg als
 * "Mail verstuurd: ...", "Mail ontvangen van X: ..." of "Mail: ..."; een echt
 * onderwerp- of thread-veld is er niet, dus dit is de enige bron die er is.
 */
export function leesMailKop(intern: string): MailKop | null {
  const t = (intern || "").trim();
  let m = t.match(/^mail ontvangen(?:\s+van\s+([^:]{1,80}))?:\s*(.*)$/i);
  if (m) return { onderwerp: (m[2] || "").trim(), richting: "in", wie: (m[1] || "").trim() };
  m = t.match(/^mail verstuurd:\s*(.*)$/i);
  if (m) return { onderwerp: (m[1] || "").trim(), richting: "uit", wie: "" };
  m = t.match(/^mail:\s*(.*)$/i);
  if (m) return { onderwerp: (m[1] || "").trim(), richting: "onbekend", wie: "" };
  return null;
}

const ANTWOORD_PREFIX = /^\s*(?:re|aw|antw|fw|fwd|doorst)\s*(?:\[\d+\])?\s*:\s*/i;
const TAG_PREFIX = /^\s*\[[^\]]{1,24}\]\s*/;

/**
 * Hetzelfde onderwerp, los van hoe vaak er op geantwoord of doorgestuurd is.
 * "Re: Fwd: [EXTERN] Werkzaamheden" en "Werkzaamheden" zijn één gesprek.
 */
export function normaliseerOnderwerp(s: string): string {
  let t = (s || "").trim();
  for (let i = 0; i < 8; i++) {
    const voor = t;
    t = t.replace(ANTWOORD_PREFIX, "").replace(TAG_PREFIX, "").trim();
    if (t === voor) break;
  }
  return t.toLowerCase().replace(/\s+/g, " ").replace(/[\s.,;:!?–—-]+$/g, "").trim();
}

export type Thema = { sleutel: string; titel: string };

// Onderwerpen die per definitie geen SEO-werk zijn. Ze horen wél in het logboek
// (het is echte correspondentie), maar niet tussen het werk waar je je planning
// op baseert. Ze worden op onderwerp samengevoegd, ook als de onderwerpregels
// verschillen ("Factuur augustus" en "Betalingsherinnering" zijn hetzelfde gedoe),
// en ze zakken naar onderen als ruis.
const THEMAS: { sleutel: string; titel: string; woorden: RegExp }[] = [
  // Let op de \w* achter de stammen: "betalingsherinnering" en "facturatiegegevens"
  // zijn hetzelfde gedoe als "betaling" en "factuur", en een woordgrens-eis erachter
  // liet die er stilletjes doorheen glippen.
  { sleutel: "facturatie", titel: "Facturatie en betaling", woorden: /\b(factu\w*|betaal\w*|betaling\w*|betaald|incasso\w*|aanmaning\w*|creditnota\w*)\b/i },
  { sleutel: "afspraak", titel: "Afspraken en overleg", woorden: /\b(afspraak|afspraken|overleg|belafspraak|telefonisch|agenda|meeting|uitnodiging|verzetten)\b/i },
  { sleutel: "toegang", titel: "Toegang en inloggegevens", woorden: /\b(inlog\w*|wachtwoord\w*|toegang|ftp|dns|hosting)\b/i },
];

export function themaVanOnderwerp(onderwerp: string): Thema | null {
  for (const t of THEMAS) if (t.woorden.test(onderwerp || "")) return { sleutel: t.sleutel, titel: t.titel };
  return null;
}

// ═══════════════════════════════════════════════════════════
// WAT ER GEBEURD IS
// ═══════════════════════════════════════════════════════════

export type ActRegel = {
  id: number; gebeurdeOp: string; soort: ActiviteitSoort;
  url: string | null; intern: string; wie: string; bewijs?: string | null;
};

export type ActCluster = {
  sleutel: string;
  titel: string;      // wat er gebeurd is
  subtitel: string;   // waar, hoeveel pagina's, wanneer
  categorie: Categorie;
  soorten: ActiviteitSoort[];
  items: ActRegel[];
  paginas: string[];
  familie: string;    // leeg als het cluster niet over een pagina-familie gaat
  van: string; tot: string;
  ruis: boolean;
};

// Wat een soort werk in gewone taal ís, enkelvoud en meervoud. Zonder dit blijft
// een titel "12 × redirect" staan, en dat beschrijft niet wat er gebeurd is.
const DAAD: Record<ActiviteitSoort, [string, string]> = {
  analyse: ["pagina geanalyseerd", "pagina's geanalyseerd"],
  blauwdruk: ["opzet gemaakt", "opzetten gemaakt"],
  copy: ["nieuwe tekst geschreven", "nieuwe teksten geschreven"],
  "copy-concept": ["tekst als concept klaargezet", "teksten als concept klaargezet"],
  "copy-live": ["nieuwe tekst live gezet", "nieuwe teksten live gezet"],
  meta: ["zoekresultaat-tekst verbeterd", "zoekresultaat-teksten verbeterd"],
  alt: ["afbeelding beschreven", "afbeeldingen beschreven"],
  "intern-link": ["interne link gelegd", "interne links gelegd"],
  structured: ["stuk structured data toegevoegd", "stukken structured data toegevoegd"],
  redirect: ["oud adres doorgestuurd", "oude adressen doorgestuurd"],
  paginawijziging: ["paginawijziging gezien", "paginawijzigingen gezien"],
  "gmb-profiel": ["Google-profiel bijgewerkt", "keer Google-profiel bijgewerkt"],
  "gmb-review": ["nieuwe review binnen", "nieuwe reviews binnen"],
  taak: ["taak afgerond", "taken afgerond"],
  mail: ["mail", "mails"],
};

function daad(soort: ActiviteitSoort, n: number): string {
  const [enk, mv] = DAAD[soort] || ["handeling", "handelingen"];
  return `${n} ${n === 1 ? enk : mv}`;
}

function opsomming(delen: string[]): string {
  if (delen.length <= 1) return delen[0] || "";
  return `${delen.slice(0, -1).join(", ")} en ${delen[delen.length - 1]}`;
}

function kortDatum(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function periodeTekst(van: string, tot: string): string {
  const a = kortDatum(van); const b = kortDatum(tot);
  if (!a) return "";
  return a === b ? a : `${a} t/m ${b}`;
}

/** Een gedetecteerde paginawijziging komt vaak van de klant zelf; dat is geen werk van ons. */
function isRuisSoort(soort: ActiviteitSoort): boolean {
  return soort === "paginawijziging";
}

function bouwCluster(sleutel: string, items: ActRegel[], familie: string, titelOverschrijf?: string, ruisOverschrijf?: boolean): ActCluster {
  const gesorteerd = [...items].sort((a, b) => new Date(a.gebeurdeOp).getTime() - new Date(b.gebeurdeOp).getTime());
  const van = gesorteerd[0]?.gebeurdeOp || "";
  const tot = gesorteerd[gesorteerd.length - 1]?.gebeurdeOp || "";
  const soorten = [...new Set(gesorteerd.map((i) => i.soort))];
  const paginas = [...new Set(gesorteerd.map((i) => padVan(i.url || "")).filter(Boolean))];

  // De titel zegt wat er gebeurd is. Bij één soort werk is dat de daad met het
  // aantal ("38 oude adressen doorgestuurd"); bij meerdere soorten op één pagina
  // is het het verhaal van die pagina ("Over ons: analyse, copy en live gezet").
  let titel = titelOverschrijf || "";
  if (!titel) {
    if (soorten.length === 1) titel = daad(soorten[0], gesorteerd.length);
    else if (paginas.length === 1) titel = titelVanSlug(paginas[0]);
    else titel = `${gesorteerd.length} handelingen`;
  }

  const stukken: string[] = [];
  if (familie) stukken.push(`${familieTitel(familie)}-pagina's`);
  if (paginas.length > 1) stukken.push(`${paginas.length} pagina's`);
  else if (paginas.length === 1 && !familie && soorten.length === 1) stukken.push(padVan(paginas[0]));
  if (soorten.length > 1) stukken.push(opsomming(soorten.map((s) => (DAAD[s] || ["", ""])[0])));
  const periode = periodeTekst(van, tot);
  if (periode) stukken.push(periode);

  const telPerCategorie = new Map<Categorie, number>();
  for (const i of gesorteerd) {
    const c = categorieVanSoort(i.soort);
    telPerCategorie.set(c, (telPerCategorie.get(c) || 0) + 1);
  }
  const categorie = [...telPerCategorie.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "overig";

  return {
    sleutel, titel, subtitel: stukken.join(" · "), categorie, soorten,
    items: [...gesorteerd].reverse(), paginas, familie, van, tot,
    ruis: ruisOverschrijf ?? soorten.every(isRuisSoort),
  };
}

/**
 * Van losse logregels naar een leesbaar overzicht. Grootste clusters eerst, want
 * dit is een samenvatting en niet een logboek; ruis zakt naar onderen.
 */
export function clusterActiviteit(rijen: ActRegel[]): ActCluster[] {
  const clusters: ActCluster[] = [];

  // 1. Mail, op gesprek. Een thema wint van het onderwerp, zodat zes verschillend
  //    getitelde factuurmails toch één regel worden.
  const mailBakken = new Map<string, { titel: string; ruis: boolean; items: ActRegel[] }>();
  for (const r of rijen.filter((x) => x.soort === "mail")) {
    const kop = leesMailKop(r.intern);
    const onderwerp = (kop?.onderwerp || r.intern || "").trim();
    const thema = themaVanOnderwerp(onderwerp);
    const sleutel = thema ? `thema:${thema.sleutel}` : `onderwerp:${normaliseerOnderwerp(onderwerp) || r.id}`;
    const bak = mailBakken.get(sleutel);
    if (bak) {
      bak.items.push(r);
      // Zonder thema is de kortste onderwerpregel de schoonste: die zonder "Re:".
      if (!thema && onderwerp && onderwerp.length < bak.titel.length) bak.titel = onderwerp;
    } else {
      mailBakken.set(sleutel, { titel: thema ? thema.titel : onderwerp || "Mail", ruis: !!thema, items: [r] });
    }
  }
  for (const [sleutel, bak] of mailBakken) {
    const n = bak.items.length;
    const uit = bak.items.filter((i) => leesMailKop(i.intern)?.richting === "uit").length;
    const c = bouwCluster(sleutel, bak.items, "", n === 1 ? bak.titel : `Mailwisseling: ${bak.titel}`, bak.ruis);
    const richting = n === 1
      ? (uit ? "verstuurd" : "ontvangen")
      : `${n} mails, ${uit} verstuurd en ${n - uit} ontvangen`;
    c.subtitel = [richting, periodeTekst(c.van, c.tot)].filter(Boolean).join(" · ");
    clusters.push(c);
  }

  // 2. Paginawerk, op familie plus soort werk (één actie die zich herhaalt), op
  //    losse pagina (het verhaal van die ene pagina) of op soort werk zonder pagina.
  const paginawerk = rijen.filter((x) => x.soort !== "mail");
  const families = bepaalFamilies(paginawerk.map((r) => r.url || ""));
  const bakken = new Map<string, { familie: string; items: ActRegel[] }>();
  for (const r of paginawerk) {
    const p = padVan(r.url || "");
    const familie = p ? families.get(p) || "" : "";
    const sleutel = familie ? `fam:${familie}|${r.soort}` : p ? `pag:${urlKey(p)}` : `soort:${r.soort}`;
    const bak = bakken.get(sleutel);
    if (bak) bak.items.push(r);
    else bakken.set(sleutel, { familie, items: [r] });
  }
  for (const [sleutel, bak] of bakken) clusters.push(bouwCluster(sleutel, bak.items, bak.familie));

  // 3. Opruimronde: losse pagina's met één handeling van dezelfde soort zouden het
  //    overzicht alsnog vol regels zetten. Vanaf drie stuks worden dat er één.
  const enkelPerSoort = new Map<ActiviteitSoort, ActCluster[]>();
  for (const c of clusters) {
    if (c.items.length !== 1 || !c.sleutel.startsWith("pag:")) continue;
    const s = c.items[0].soort;
    if (!enkelPerSoort.has(s)) enkelPerSoort.set(s, []);
    enkelPerSoort.get(s)!.push(c);
  }
  const opgeslokt = new Set<string>();
  for (const [soort, losse] of enkelPerSoort) {
    if (losse.length < 3) continue;
    for (const c of losse) opgeslokt.add(c.sleutel);
    const samen = bouwCluster(`los:${soort}`, losse.flatMap((c) => c.items), "");
    samen.subtitel = [`${losse.length} losse pagina's`, periodeTekst(samen.van, samen.tot)].filter(Boolean).join(" · ");
    clusters.push(samen);
  }

  return clusters
    .filter((c) => !opgeslokt.has(c.sleutel))
    .sort((a, b) =>
      Number(a.ruis) - Number(b.ruis) ||
      b.items.length - a.items.length ||
      new Date(b.tot).getTime() - new Date(a.tot).getTime());
}

// ═══════════════════════════════════════════════════════════
// WAT ER GESIGNALEERD IS
// ═══════════════════════════════════════════════════════════

export type SigRegel = {
  pad: string; uitkomst: string; naar: string; reden: string;
  onderbouwing: string[]; volume: number | null; positie: number | null;
  groep: string; bron: "opruim" | "meta"; doorgevoerd?: boolean;
};

export type SigCluster = {
  sleutel: string;
  titel: string;      // wat je hier gaat doen
  subtitel: string;   // waar het over gaat en wat het waard is
  categorie: Categorie;
  items: SigRegel[];
  gedeeld: string[];  // de onderbouwing die alle pagina's in dit cluster delen
  volume: number;     // opgetelde zoekopdrachten per maand
  naar: string;       // gedeelde bestemming, als die er is
  familie: string;
};

// Wat een uitkomst betekent als handeling. Hiermee wordt de titel een opdracht
// ("12 pagina's samenvoegen") in plaats van een label ("samenvoegen").
const OPDRACHT: Record<string, [string, string]> = {
  samenvoegen: ["pagina samenvoegen", "pagina's samenvoegen"],
  uitbouwen: ["pagina uitbouwen", "pagina's uitbouwen"],
  opruimen: ["pagina opruimen", "pagina's opruimen"],
  nieuw: ["nieuwe pagina maken", "nieuwe pagina's maken"],
  blijft: ["pagina laten staan", "pagina's laten staan"],
  meta: ["zoekresultaat-tekst verbeteren", "zoekresultaat-teksten verbeteren"],
};

export function opdrachtTekst(uitkomst: string, n: number): string {
  const [enk, mv] = OPDRACHT[uitkomst] || ["pagina oppakken", "pagina's oppakken"];
  return `${n} ${n === 1 ? enk : mv}`;
}

/**
 * De langste gemeenschappelijke start van meerdere onderbouwingen: wat elke pagina
 * in een cluster deelt, zodat dat één keer bovenaan staat in plaats van per pagina
 * herhaald.
 */
export function gemeenschappelijkeRegels(lijsten: string[][]): string[] {
  if (lijsten.length < 2) return [];
  const kortste = Math.min(...lijsten.map((l) => l.length));
  const gedeeld: string[] = [];
  for (let i = 0; i < kortste; i++) {
    const regel = lijsten[0][i];
    if (lijsten.every((l) => l[i] === regel)) gedeeld.push(regel);
    else break;
  }
  return gedeeld;
}

/**
 * Van losse signalen naar clusters die je in één keer kunt oppakken: hetzelfde
 * onderwerp, dezelfde handeling. Zwaarste eerst, gemeten in zoekvolume, want dat
 * is wat het oplevert; bij gelijk volume het grootste cluster eerst.
 */
export function clusterSignalen(regels: SigRegel[]): SigCluster[] {
  const families = bepaalFamilies(regels.map((r) => r.pad));
  const bakken = new Map<string, SigRegel[]>();
  for (const r of regels) {
    const familie = families.get(padVan(r.pad)) || "";
    const sleutel = `${r.groep || "Overig"}|${r.uitkomst}|${familie}`;
    if (!bakken.has(sleutel)) bakken.set(sleutel, []);
    bakken.get(sleutel)!.push(r);
  }

  const uit: SigCluster[] = [];
  for (const [sleutel, items] of bakken) {
    const familie = families.get(padVan(items[0].pad)) || "";
    const volume = items.reduce((s, r) => s + (r.volume || 0), 0);
    const bestemmingen = [...new Set(items.map((r) => padVan(r.naar || "")).filter(Boolean))];
    const groep = (items[0].groep || "").trim();

    const stukken: string[] = [];
    if (groep && groep.toLowerCase() !== "overig") stukken.push(groep);
    if (familie) stukken.push(`${familieTitel(familie)}-pagina's`);
    if (bestemmingen.length === 1) stukken.push(`naar ${bestemmingen[0]}`);
    if (volume > 0) stukken.push(`${new Intl.NumberFormat("nl-NL").format(volume)} zoekopdrachten per maand`);

    uit.push({
      sleutel,
      titel: opdrachtTekst(items[0].uitkomst, items.length),
      subtitel: stukken.join(" · "),
      categorie: categorieVanBron(items[0].bron),
      items,
      gedeeld: gemeenschappelijkeRegels(items.map((r) => r.onderbouwing)),
      volume,
      naar: bestemmingen.length === 1 ? bestemmingen[0] : "",
      familie,
    });
  }

  return uit.sort((a, b) => b.volume - a.volume || b.items.length - a.items.length || a.titel.localeCompare(b.titel));
}

// ═══════════════════════════════════════════════════════════
// ZOEKEN
// ═══════════════════════════════════════════════════════════

/** Eén zoekregel voor de hele pagina: losse woorden, allemaal moeten ze voorkomen. */
export function zoekTreffer(zoek: string, ...velden: (string | null | undefined)[]): boolean {
  const termen = (zoek || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!termen.length) return true;
  const hooi = velden.filter(Boolean).join(" ").toLowerCase();
  return termen.every((t) => hooi.includes(t));
}
