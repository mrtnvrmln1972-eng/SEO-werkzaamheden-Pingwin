import { fetchPageContent, type PageContent } from "./page-content";
import { getGscForPage } from "./google";
import { getLatestSnapshots } from "./content-tracking";
import { getSetting, setSetting } from "./settings";
import { baseFromDomain } from "./wordpress";

// ═══════════════════════════════════════════════════════════
// SAMENVOEGEN IS CONTENT OVERZETTEN, DAARNA PAS DE 301
// ═══════════════════════════════════════════════════════════
// Een pagina staat op "samenvoegen" omdat hij iets wáárd is: eigen zoektermen,
// vertoningen, stukken tekst die de thuisbasis niet heeft. Zet je de redirect
// vóórdat dat is overgezet, dan is de thuisbasis geen redelijke vervanging,
// behandelt Google de 301 als een soft 404 en verdampt precies de waarde
// waarvoor je het deed (de hoofdregel uit brein/wat-werkt/redirects.md).
//
// Dit bestand maakt daarom per samenvoeging een BRIEFJE: wat heeft de pagina
// die weggaat dat de thuisbasis mist, en wat moet een sitebouwer dus doen
// voordat de redirect erop mag. Heeft de pagina níets unieks, dan zegt het
// briefje dat ook, en mag de redirect meteen. De vergelijking zelf is een
// pure functie zonder netwerk, zodat een proef hem kan narekenen.
// ═══════════════════════════════════════════════════════════

export type SamenvoegTerm = { keyword: string; klikken: number; vertoningen: number; positie: number | null };

export type SamenvoegBriefje = {
  van: string;
  naar: string;
  /** "overzetten": er staat iets op de bron dat het doel mist; eerst verhuizen.
      "meteen": niets belangrijks over te zetten, de redirect kan direct. */
  oordeel: "overzetten" | "meteen";
  /** Waarom dit oordeel, in zinnen die op het scherm kunnen. */
  redenen: string[];
  /** Koppen (secties) die wel op de bron staan maar niet op het doel. */
  koppen: string[];
  /** Zoektermen waar de bron op meedoet en die het doel niet dekt. */
  termen: SamenvoegTerm[];
  /** Paden van pagina's die nu intern naar de bron linken (uit de laatste scan). */
  interneLinks: string[];
  /** De kant-en-klare instructie voor de sitebouwer, platte tekst. */
  instructie: string;
  /** Kon de bron of het doel niet gelezen worden? Dan is dit een voorbehoud. */
  voorbehoud: string;
  gemaaktOp: string;
};

// ── Tekst-normalisatie ──
// Klein, zonder leestekens, met een korte stopwoordenlijst: "de soa test" en
// "soa-test" moeten dezelfde inhoudswoorden opleveren.
const STOP = new Set(["de", "het", "een", "en", "of", "in", "op", "bij", "voor", "van", "naar", "met", "je", "jouw", "uw", "wat", "hoe", "waar", "is", "zijn", "wordt", "worden", "te", "aan", "als", "dat", "dit", "deze", "die", "ik", "wij", "we", "u", "over", "ook", "per", "the", "a", "an", "and", "or", "to", "for"]);

function woorden(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}
const normKop = (s: string) => woorden(s).join(" ");

/** Dekt het doel deze kop? Gelijk, de één bevat de ander, of alle
    inhoudswoorden van de kop komen in de tekst van het doel voor. */
function kopGedekt(kop: string, doelKoppen: string[], doelWoorden: Set<string>): boolean {
  const n = normKop(kop);
  if (!n) return true;
  for (const d of doelKoppen) {
    const m = normKop(d);
    if (m && (m === n || m.includes(n) || n.includes(m))) return true;
  }
  return woorden(kop).every((w) => doelWoorden.has(w));
}

/** Dekt het doel deze zoekterm? Alle inhoudswoorden moeten ergens op het doel
    voorkomen (kop, titel of tekst). */
function termGedekt(term: string, doelWoorden: Set<string>): boolean {
  const ws = woorden(term);
  if (!ws.length) return true;
  return ws.every((w) => doelWoorden.has(w));
}

/** Wanneer telt een zoekterm als "belangrijk genoeg om voor te blijven"?
    Eén klik is bewezen bezoek; tien vertoningen per kwartaal is een begin van
    zichtbaarheid. Daaronder is het ruis en houdt het geen redirect tegen. */
const TELT = (t: SamenvoegTerm) => t.klikken >= 1 || t.vertoningen >= 10;

export type PaginaFeiten = {
  /** Kon de pagina gelezen worden? */
  gelezen: boolean;
  titel: string;
  koppen: string[];      // h1 + h2/h3
  tekst: string;         // platte tekst van de pagina
  termen: SamenvoegTerm[];
};

/**
 * De kern, zonder netwerk: wat heeft de bron dat het doel mist?
 * Bewust een pure functie; proeven/samenvoeg-briefje.proef.ts rekent hem na.
 */
export function beoordeelSamenvoeging(bron: PaginaFeiten, doel: PaginaFeiten): {
  oordeel: "overzetten" | "meteen";
  redenen: string[];
  koppen: string[];
  termen: SamenvoegTerm[];
  voorbehoud: string;
} {
  const doelWoorden = new Set<string>([
    ...woorden(doel.titel),
    ...doel.koppen.flatMap(woorden),
    ...woorden(doel.tekst),
    ...doel.termen.flatMap((t) => woorden(t.keyword)),
  ]);

  // Koppen van de bron die het doel niet heeft. De H1 van de bron telt mee:
  // dat is vaak precies het onderwerp dat moet meeverhuizen.
  const kopMist = bron.gelezen && doel.gelezen
    ? bron.koppen.filter((k) => !kopGedekt(k, doel.koppen, doelWoorden))
    : [];

  // Zoektermen van de bron die het doel niet dekt, zwaarste eerst.
  const termMist = bron.termen
    .filter((t) => TELT(t) && !termGedekt(t.keyword, doelWoorden))
    .sort((a, b) => b.klikken - a.klikken || b.vertoningen - a.vertoningen);

  const redenen: string[] = [];
  let voorbehoud = "";

  if (!bron.gelezen || !doel.gelezen) {
    // Niet kunnen lezen is geen vrijbrief: het veilige oordeel is "overzetten",
    // met de reden erbij, zodat een mens kijkt in plaats van dat de poort
    // openvalt op een meetfout.
    voorbehoud = !bron.gelezen
      ? "De pagina die weggaat kon niet gelezen worden; beoordeel met eigen ogen wat erop staat voordat de redirect erop gaat."
      : "De doelpagina kon niet gelezen worden; controleer met eigen ogen of alles daar al staat.";
    redenen.push(voorbehoud);
    return { oordeel: "overzetten", redenen, koppen: kopMist, termen: termMist, voorbehoud };
  }

  if (kopMist.length) {
    redenen.push(`${kopMist.length === 1 ? "Eén sectie" : `${kopMist.length} secties`} van deze pagina ${kopMist.length === 1 ? "ontbreekt" : "ontbreken"} op de doelpagina.`);
  }
  if (termMist.length) {
    const klikken = termMist.reduce((s, t) => s + t.klikken, 0);
    const vert = termMist.reduce((s, t) => s + t.vertoningen, 0);
    redenen.push(`De pagina doet mee op ${termMist.length === 1 ? "één zoekterm" : `${termMist.length} zoektermen`} die de doelpagina niet dekt (samen ${klikken} ${klikken === 1 ? "bezoeker" : "bezoekers"} en ${vert} vertoningen).`);
  }

  if (!kopMist.length && !termMist.length) {
    redenen.push("Alles wat deze pagina te bieden heeft staat al op de doelpagina: geen eigen secties, geen zoektermen die het doel niet dekt. De redirect kan meteen.");
    return { oordeel: "meteen", redenen, koppen: [], termen: [], voorbehoud: "" };
  }

  return { oordeel: "overzetten", redenen, koppen: kopMist, termen: termMist, voorbehoud };
}

/**
 * De instructie voor de sitebouwer, als platte tekst die zo in een taak of een
 * mail kan. Gewone taal, genummerde stappen, niets te raden. Ook een pure
 * functie, dus de proef bewaakt dat de vaste stappen er echt in staan.
 */
export function bouwInstructie(b: Omit<SamenvoegBriefje, "instructie" | "gemaaktOp">, siteUrl: string): string {
  const url = (p: string) => `${siteUrl}${p.startsWith("/") ? p : `/${p}`}`;
  const r: string[] = [];
  r.push(`Samenvoegen: ${url(b.van)} gaat op in ${url(b.naar)}`);
  r.push("");
  r.push(`Doel: alle waarde van de oude pagina verhuist naar de doelpagina. Pas als dat gebeurd is, komt er een permanente doorverwijzing (301) op de oude URL. De volgorde is belangrijk: een redirect naar een pagina waar de inhoud niet op staat, draagt voor Google niets over.`);
  r.push("");
  let stap = 1;
  if (b.koppen.length) {
    r.push(`Stap ${stap}. Zet deze secties over naar ${b.naar}. Ze staan nu wel op de oude pagina maar niet op de doelpagina:`);
    for (const k of b.koppen) r.push(`   - ${k}`);
    r.push(`   Verweef de tekst met wat er al staat (herschrijven mag); plak geen dubbele blokken onder elkaar en haal op de doelpagina niets weg dat er al goed staat.`);
    stap++;
  }
  if (b.termen.length) {
    r.push(`Stap ${stap}. Zorg dat de doelpagina na de samenvoeging antwoord geeft op deze zoekopdrachten (de oude pagina wordt hierop gevonden, de doelpagina nu nog niet):`);
    for (const t of b.termen.slice(0, 12)) {
      r.push(`   - "${t.keyword}" (${t.klikken} ${t.klikken === 1 ? "bezoeker" : "bezoekers"}, ${t.vertoningen} vertoningen${t.positie != null ? `, positie ${Math.round(t.positie)}` : ""})`);
    }
    if (b.termen.length > 12) r.push(`   - en nog ${b.termen.length - 12} kleinere termen`);
    r.push(`   Controleer dat deze woorden (of een natuurlijke variant) in een kop of in de tekst van de doelpagina terugkomen.`);
    stap++;
  }
  if (b.interneLinks.length) {
    r.push(`Stap ${stap}. Pas de interne links aan: deze pagina's linken nu naar de oude URL en moeten rechtstreeks naar ${b.naar} gaan linken (een redirect is een vangnet, geen sitestructuur):`);
    for (const p of b.interneLinks) r.push(`   - ${p}`);
    stap++;
  } else {
    r.push(`Stap ${stap}. Controleer of er interne links (menu, footer, tekstlinks) naar de oude URL wijzen en laat die rechtstreeks naar ${b.naar} wijzen.`);
    stap++;
  }
  r.push(`Stap ${stap}. Klaar? Meld het af. De 301 van ${b.van} naar ${b.naar} wordt daarna vanuit het dashboard geplaatst en direct nagemeten; die hoef je niet zelf te zetten.`);
  if (b.voorbehoud) {
    r.push("");
    r.push(`Let op: ${b.voorbehoud}`);
  }
  return r.join("\n");
}

// ── Ophalen en bewaren ──

const pad = (u: string) => { try { return new URL(u).pathname; } catch { return (u || "").trim(); } };
const cacheKey = (slug: string, van: string) => `samenvoeg_briefje:${slug}:${pad(van)}`;

export async function getBewaardBriefje(slug: string, van: string): Promise<SamenvoegBriefje | null> {
  const ruw = await getSetting(cacheKey(slug, van)).catch(() => null);
  if (!ruw) return null;
  try { return JSON.parse(ruw) as SamenvoegBriefje; } catch { return null; }
}

async function feitenVoor(base: string, domein: string, p: string): Promise<PaginaFeiten> {
  const vol = `${base}${p.startsWith("/") ? p : `/${p}`}`;
  const [inhoud, t1, t2] = await Promise.all([
    fetchPageContent(vol, 12000).catch(() => null),
    // GSC filtert op de exacte URL zoals Google hem kent; met en zonder
    // slotstreep zijn daar twee adressen, dus we vragen allebei op.
    getGscForPage(domein, vol.replace(/\/$/, ""), 90).catch(() => []),
    getGscForPage(domein, `${vol.replace(/\/$/, "")}/`, 90).catch(() => []),
  ]);
  const perTerm = new Map<string, SamenvoegTerm>();
  for (const rij of [...t1, ...t2]) {
    const oud = perTerm.get(rij.keyword);
    if (!oud) perTerm.set(rij.keyword, { keyword: rij.keyword, klikken: rij.clicks, vertoningen: rij.impressions, positie: rij.position });
    else { oud.klikken += rij.clicks; oud.vertoningen += rij.impressions; }
  }
  const c: PageContent | null = inhoud && (inhoud.status == null || inhoud.status < 400) && (inhoud.title || inhoud.h1 || inhoud.text) ? inhoud : null;
  return {
    gelezen: !!c,
    titel: c?.title || "",
    koppen: c ? [c.h1, ...c.headings].filter(Boolean) : [],
    tekst: c?.text || "",
    termen: [...perTerm.values()],
  };
}

/** Welke pagina's linken nu naar dit pad? Uit de laatste content-scan; geen
    verse crawl, dus gratis. Een lege lijst kan ook betekenen dat de scan er
    (nog) niet is; de instructie zegt dan "controleer zelf". */
async function linksNaar(slug: string, van: string): Promise<string[]> {
  const doel = pad(van).replace(/\/+$/, "").toLowerCase();
  if (!doel) return [];
  const snaps = await getLatestSnapshots(slug).catch(() => []);
  const uit: string[] = [];
  for (const s of snaps) {
    const eigen = pad(s.url).replace(/\/+$/, "").toLowerCase();
    if (eigen === doel) continue;
    const linkt = s.internalLinks.some((l) => {
      const h = pad(l.href).replace(/\/+$/, "").toLowerCase();
      return h === doel;
    });
    if (linkt) uit.push(pad(s.url) || "/");
  }
  return [...new Set(uit)].sort().slice(0, 15);
}

/**
 * Maak (of ververs) het briefje voor één samenvoeging en bewaar het. De
 * doorvoer-poort in de API leest hetzelfde bewaarde briefje: één bron.
 */
export async function maakSamenvoegBriefje(slug: string, domein: string, van: string, naar: string): Promise<SamenvoegBriefje> {
  const base = baseFromDomain(domein);
  const [bron, doel, links] = await Promise.all([
    feitenVoor(base, domein, pad(van)),
    feitenVoor(base, domein, pad(naar)),
    linksNaar(slug, van),
  ]);
  const kern = beoordeelSamenvoeging(bron, doel);
  if (!bron.termen.length && !doel.termen.length && bron.gelezen) {
    kern.redenen.push("Zoektermen konden niet meegewogen worden (geen Search Console-data voor deze pagina's); het oordeel rust op de inhoud.");
  }
  const zonder = { van: pad(van), naar: pad(naar), ...kern, interneLinks: links };
  const briefje: SamenvoegBriefje = { ...zonder, instructie: bouwInstructie(zonder, base), gemaaktOp: new Date().toISOString() };
  await setSetting(cacheKey(slug, van), JSON.stringify(briefje)).catch(() => { /* bewaren is bijvangst */ });
  return briefje;
}
