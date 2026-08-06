// ═══════════════════════════════════════════════════════════
// DE MEETLAAG: STAAT HET ER ECHT OP?
// ═══════════════════════════════════════════════════════════
// Hier wordt gemeten, niet geoordeeld door een model. Elke uitkomst in dit
// bestand komt uit de HTML van de live pagina, en elke uitkomst draagt zijn eigen
// bewijs mee (de gevonden ankertekst, het gevonden pad, op hoeveel pagina's).
//
// Waarom dat streng gescheiden is: de chat mocht eerder zelf concluderen of iets
// gedaan was, en een model dat een plausibel verhaal kan vertellen doet dat ook
// als de meting ontbreekt. Wat hier staat kan niet liegen; wat een model ervan
// vindt komt pas daarna, en alleen bovenop deze cijfers.
//
// Het belangrijkste onderscheid van dit hele bestand: een link in het site-brede
// menu of de footer is iets ANDERS dan een link in de lopende tekst. Voor SEO
// telt alleen de tweede. Dat onderscheid maken we niet op HTML-structuur alleen
// (een thema dat zijn footer in een gewone div zet ontsnapt daaraan), maar op
// frequentie: staat hetzelfde paar van doel-pad en ankertekst op vrijwel elke
// gecrawlde pagina, dan is het navigatie. Bij Kamsteeg bleek "Hovenier
// Etten-Leur" op 58 van de circa 58 pagina's te staan; precies zo ziet navigatie
// eruit en precies daarom werkt tellen beter dan raden.
//
// En het tweede principe: ONMEETBAAR IS GEEN OORDEEL. Een site die ons weigert
// (403) of een pagina die niet laadt levert "kon ik niet meten" op, nooit "niet
// gedaan". Anders krijgt een developer de schuld van onze mislukte meting.
// ═══════════════════════════════════════════════════════════

import { renderHtml, BEZOEKER_UA } from "./render-page";
import { browserProbleem } from "./browser";
import { contentScope, stripHtmlTags, toPath, pagePath, topicTokens, tokenHits } from "./page-internal-links";

// ── Hoe een pagina gelezen wordt ──

export type Gelezen = {
  url: string;
  html: string;
  status: number | null;
  /** Via de echte browser binnengehaald (dus inclusief JavaScript-content)? */
  gerenderd: boolean;
  /** Konden we deze pagina überhaupt lezen? Zo nee, dan volgt er GEEN oordeel. */
  meetbaar: boolean;
  /** In gewone taal waarom het niet lukte; leeg als het wel lukte. */
  reden: string;
};

const LEES_TIMEOUT = 15000;

/**
 * Eén pagina binnenhalen, met terugval. De volgorde is bewust:
 *
 * 1. De echte browser met een gewone bezoeker-user-agent. Dit is de primaire weg,
 *    niet de noodgreep: kamsteegtuinen.nl weigert een kale fetch met 403, en een
 *    browser die zich als PingwinBot bekendmaakt krijgt diezelfde 403. Wie wil
 *    meten wat een bezoeker ziet, moet lezen zoals een bezoeker leest.
 * 2. Een gewone fetch met dezelfde user-agent, voor als de browser niet start.
 * 3. Opgeven, met de reden erbij.
 */
export async function leesPagina(url: string): Promise<Gelezen> {
  const leeg: Gelezen = { url, html: "", status: null, gerenderd: false, meetbaar: false, reden: "" };

  const r = await renderHtml(url, { userAgent: BEZOEKER_UA }).catch(() => null);
  if (r && r.html) {
    // Een 4xx/5xx met een foutpagina erin is geen meetbare pagina.
    if (r.status !== null && r.status >= 400) {
      return { ...leeg, status: r.status, gerenderd: true, reden: `de pagina antwoordde met ${r.status}` };
    }
    return { url, html: r.html, status: r.status, gerenderd: true, meetbaar: true, reden: "" };
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), LEES_TIMEOUT);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: ctrl.signal,
      headers: {
        "User-Agent": BEZOEKER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
      },
    });
    if (!res.ok) {
      const browserReden = browserProbleem();
      return {
        ...leeg,
        status: res.status,
        reden: res.status === 403
          ? `de site weigerde ons te lezen (403)${browserReden ? ` en de browser kon niet starten (${browserReden})` : ""}`
          : `de pagina antwoordde met ${res.status}`,
      };
    }
    const html = await res.text();
    if (!html.trim()) return { ...leeg, status: res.status, reden: "de pagina kwam leeg terug" };
    return { url, html, status: res.status, gerenderd: false, meetbaar: true, reden: "" };
  } catch (e) {
    const melding = e instanceof Error && e.name === "AbortError" ? "de pagina reageerde niet op tijd" : "de pagina was niet bereikbaar";
    return { ...leeg, reden: melding };
  } finally {
    clearTimeout(t);
  }
}

// ── Links uit een pagina halen ──

export type Link = {
  /** Genormaliseerd intern pad, bijvoorbeeld /hovenier/hovenier-etten-leur */
  naar: string;
  anker: string;
  /** Stond deze link in de lopende tekst (dus buiten nav/header/footer/aside)? */
  inTekst: boolean;
  /** Alleen een afbeelding in de link, geen tekst: telt niet als tekstlink. */
  beeldlink: boolean;
  nofollow: boolean;
};

const A_TAG = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

function hrefUit(attrs: string): string {
  const m = attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  return m ? (m[2] ?? m[3] ?? m[4] ?? "") : "";
}

function haalLinks(html: string, domein: string, inTekst: boolean): Link[] {
  const uit: Link[] = [];
  A_TAG.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = A_TAG.exec(html)) && uit.length < 600) {
    const attrs = m[1] || "";
    const naar = toPath(hrefUit(attrs), domein);
    if (!naar) continue;
    const binnenkant = m[2] || "";
    const anker = stripHtmlTags(binnenkant).slice(0, 120);
    uit.push({
      naar,
      anker,
      inTekst,
      beeldlink: !anker && /<img\b|<svg\b/i.test(binnenkant),
      nofollow: /rel\s*=\s*["'][^"']*nofollow/i.test(attrs),
    });
  }
  return uit;
}

function haalKoppen(html: string): string[] {
  const uit: string[] = [];
  for (const m of html.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi)) {
    const t = stripHtmlTags(m[2]).slice(0, 160);
    if (t) uit.push(t);
    if (uit.length >= 60) break;
  }
  return uit;
}

function platteTekst(html: string): string {
  return stripHtmlTags(html.replace(/<\s*(script|style)[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")).slice(0, 20000);
}

// ── Het beeld van de site: meerdere pagina's naast elkaar ──

export type GelezenPagina = {
  pad: string;
  url: string;
  meetbaar: boolean;
  reden: string;
  status: number | null;
  gerenderd: boolean;
  /** Alle links op de pagina, dus inclusief menu en footer. */
  alle: Link[];
  /** Alleen de links binnen de lopende tekst. */
  inTekst: Link[];
  titel: string;
  /** H1 tot en met H3 binnen de lopende tekst; koppen uit menu en footer tellen niet mee. */
  koppen: string[];
  /** De lopende tekst zelf, ingekort; voor de steekproef op zinnen uit een document. */
  tekst: string;
};

export type Sitebeeld = {
  domein: string;
  paginas: GelezenPagina[];
  /** Vanaf op hoeveel pagina's een link als site-breed (menu/footer) telt. */
  chromeDrempel: number;
  /** Konden we genoeg pagina's lezen om over navigatie te mogen oordelen? */
  navigatieBetrouwbaar: boolean;
};

const BATCH = 6; // zelfde ritme als runCopyLiveCheck en verifyDevWorklist

function volledigeUrl(domein: string, pad: string): string {
  const bare = domein.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
  return `https://${bare}${pad === "/" ? "/" : pad}`;
}

/**
 * Leest een set pagina's en bouwt daar één beeld van, inclusief de vraag welke
 * links site-breed zijn. Meerdere pagina's zijn geen luxe: met één pagina kun je
 * niet zien of een link in het menu staat of in de tekst.
 */
export async function bouwSitebeeld(domein: string, paden: string[]): Promise<Sitebeeld> {
  const uniek = [...new Set(paden.map((p) => pagePath(p)))].filter(Boolean);
  const paginas: GelezenPagina[] = [];

  for (let i = 0; i < uniek.length; i += BATCH) {
    const deel = await Promise.all(
      uniek.slice(i, i + BATCH).map(async (pad): Promise<GelezenPagina> => {
        const url = volledigeUrl(domein, pad);
        const g = await leesPagina(url);
        const leeg = { alle: [], inTekst: [], titel: "", koppen: [], tekst: "" };
        if (!g.meetbaar) {
          return { pad, url, meetbaar: false, reden: g.reden, status: g.status, gerenderd: g.gerenderd, ...leeg };
        }
        const scope = contentScope(g.html);
        const titel = stripHtmlTags((g.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || ["", ""])[1]).slice(0, 160);
        const inTekst = haalLinks(scope, domein, true);
        // De pagina kan laden maar niets opleveren (bijvoorbeeld een blokkeerpagina
        // of een site die pas na JavaScript zijn inhoud toont en waar de browser
        // niet aan te pas kwam). Geen links én geen titel: dan meten we niets.
        const alle = haalLinks(g.html, domein, false);
        if (!alle.length && !titel) {
          return { pad, url, meetbaar: false, reden: "de pagina gaf geen leesbare inhoud terug", status: g.status, gerenderd: g.gerenderd, ...leeg };
        }
        // Koppen uit de LOPENDE TEKST, niet uit menu of footer: een menu-item dat
        // toevallig zo heet als een kop uit het document zou anders meetellen als
        // "de content staat erop".
        return { pad, url, meetbaar: true, reden: "", status: g.status, gerenderd: g.gerenderd, alle, inTekst, titel, koppen: haalKoppen(scope), tekst: platteTekst(scope) };
      }),
    );
    paginas.push(...deel);
  }

  const gelukt = paginas.filter((p) => p.meetbaar);
  return {
    domein,
    paginas,
    chromeDrempel: Math.max(3, Math.ceil(gelukt.length * 0.6)),
    // Onder de drie gelezen pagina's kun je niet vaststellen wat site-breed is.
    // Dan zwijgen we daarover in plaats van te gokken.
    navigatieBetrouwbaar: gelukt.length >= 3,
  };
}

/** Op hoeveel gelezen pagina's komt dit doel-pad voor, buiten de lopende tekst om? */
function navigatieTellers(beeld: Sitebeeld, doelPad: string): { inNavigatie: number; inTekst: number; gelezen: number; ankers: string[] } {
  const gelukt = beeld.paginas.filter((p) => p.meetbaar);
  let inNavigatie = 0;
  let inTekstAantal = 0;
  const ankers = new Set<string>();
  for (const p of gelukt) {
    const tekstHit = p.inTekst.some((l) => l.naar === doelPad);
    const ergensHit = p.alle.some((l) => l.naar === doelPad);
    if (tekstHit) inTekstAantal++;
    if (ergensHit && !tekstHit) inNavigatie++;
    for (const l of p.alle) if (l.naar === doelPad && l.anker) ankers.add(l.anker);
  }
  return { inNavigatie, inTekst: inTekstAantal, gelezen: gelukt.length, ankers: [...ankers].slice(0, 6) };
}

// ── Ankertekst: deugt hij? ──

const LOZE_ANKERS = new Set([
  "klik hier", "hier", "lees meer", "meer", "meer informatie", "meer info", "deze pagina",
  "link", "zie hier", "hier klikken", "verder lezen", "bekijk", "klik", "lees verder", "info",
]);

export type AnkerOordeel = { zinnig: boolean; reden: string };

/**
 * Deugt deze ankertekst? Bewust hard in code, want "klik hier" is geen
 * smaakkwestie. Alleen de randgevallen laten we later door een model nuanceren.
 */
export function beoordeelAnker(anker: string, doelTitel: string, doelPad: string): AnkerOordeel {
  const a = (anker || "").trim();
  if (!a) return { zinnig: false, reden: "de link heeft geen zichtbare tekst" };
  if (a.length < 3) return { zinnig: false, reden: `de ankertekst is met "${a}" te kort` };
  if (a.length > 80) return { zinnig: false, reden: "de ankertekst is een hele zin in plaats van een term" };
  if (LOZE_ANKERS.has(a.toLowerCase())) return { zinnig: false, reden: `"${a}" zegt niets over de doelpagina` };
  if (/^https?:\/\//i.test(a) || /^\/\S*$/.test(a)) return { zinnig: false, reden: "de ankertekst is een kale URL of een pad" };

  // Raakt de ankertekst het onderwerp van de doelpagina? De slug telt mee, want
  // die is bij deze sites beschrijvend (/hovenier/hovenier-etten-leur).
  const tokens = topicTokens([doelTitel, doelPad.replace(/[/-]/g, " ")]);
  if (tokens.size && !tokenHits(a, tokens).length) {
    return { zinnig: false, reden: `"${a}" bevat geen woord uit het onderwerp van de doelpagina` };
  }
  return { zinnig: true, reden: "" };
}

// ── De oordelen ──

export type Uitslag = "goed" | "deels" | "niet" | "onmeetbaar" | "vervallen";

export type Meting = {
  uitslag: Uitslag;
  /** Eén zin met de harde waarde erin; dit is wat in de mail terechtkomt. */
  bewijs: string;
  /** De ruwe getallen, voor het scherm en voor de nacontrole op het model. */
  details: Record<string, unknown>;
};

/**
 * Punt 2 uit de mail: staat er een interne link van bron naar doel, in de
 * lopende tekst, met een zinnige ankertekst, naar een pagina die werkt?
 *
 * Vier losse vragen, alle vier hard. Het antwoord is bewust genuanceerd: een link
 * die alleen in het menu staat is niet hetzelfde als een ontbrekende link, en een
 * link met een waardeloze ankertekst is niet hetzelfde als geen link.
 */
export function beoordeelInterneLink(
  beeld: Sitebeeld,
  bronPad: string,
  doelPad: string,
  doelTitel: string,
  doelBestaat: { bestaat: boolean; status: number | null; omleiding: string },
): Meting {
  const bron = beeld.paginas.find((p) => p.pad === pagePath(bronPad));
  if (!bron) {
    return { uitslag: "onmeetbaar", bewijs: `de bronpagina ${bronPad} is niet meegenomen in de meting`, details: { bronPad, doelPad } };
  }
  if (!bron.meetbaar) {
    return {
      uitslag: "onmeetbaar",
      bewijs: `${bronPad} kon ik niet lezen: ${bron.reden}`,
      details: { bronPad, doelPad, status: bron.status, reden: bron.reden },
    };
  }

  const doel = pagePath(doelPad);
  const inTekst = bron.inTekst.filter((l) => l.naar === doel);
  const ergens = bron.alle.filter((l) => l.naar === doel);
  const tellers = navigatieTellers(beeld, doel);
  const details: Record<string, unknown> = {
    bronPad: bron.pad, bronUrl: bron.url, doelPad: doel,
    gevondenInTekst: inTekst.length, gevondenTotaal: ergens.length,
    ankers: ergens.map((l) => l.anker).filter(Boolean).slice(0, 5),
    doelStatus: doelBestaat.status, gelezenPaginas: tellers.gelezen,
  };

  if (!ergens.length) {
    return { uitslag: "niet", bewijs: `op ${bron.url} staat geen enkele link naar ${doel}`, details };
  }

  // Wel gevonden, maar niet in de lopende tekst. Dat is het verschil waar het bij
  // interne links om draait, dus dat mag nooit als "goed" wegvallen.
  if (!inTekst.length) {
    const siteBreed = beeld.navigatieBetrouwbaar && tellers.inNavigatie + tellers.inTekst >= beeld.chromeDrempel;
    // Staat hij ALLEEN in het site-brede menu, dan is de gevraagde link er niet.
    // Die stond er namelijk toch al op elke pagina; hem als "half gedaan" tellen
    // geeft krediet voor iets wat niemand heeft aangeraakt. Het bewijs vertelt wel
    // precies hoe het zit, zodat het geen kaal verwijt wordt.
    if (siteBreed) {
      return {
        uitslag: "niet",
        bewijs: `op ${bron.url} staat geen link naar ${doel} in de lopende tekst; hij staat alleen in het site-brede menu of de footer (op ${tellers.inNavigatie + tellers.inTekst} van de ${tellers.gelezen} gelezen pagina's) en dat telt niet als interne link`,
        details: { ...details, siteBreed, inNavigatieOpPaginas: tellers.inNavigatie },
      };
    }
    // Niet site-breed, dus een link die juist op deze pagina buiten de tekst staat
    // (zijbalk, uitgelicht blok). Daar is wél iets gedaan, alleen op de verkeerde
    // plek: half.
    return {
      uitslag: "deels",
      bewijs: `op ${bron.url} staat de link naar ${doel} buiten de lopende tekst (zijbalk of uitgelicht blok), niet in een alinea`,
      details: { ...details, siteBreed, inNavigatieOpPaginas: tellers.inNavigatie },
    };
  }

  // Vanaf hier staat hij in de tekst. Nu de kwaliteit.
  const gebreken: string[] = [];
  const link = inTekst[0];
  if (link.beeldlink) gebreken.push("het is een afbeelding zonder linktekst");
  const anker = beoordeelAnker(link.anker, doelTitel, doel);
  if (!anker.zinnig) gebreken.push(anker.reden);
  if (link.nofollow) gebreken.push("de link staat op nofollow, dus geeft geen linkwaarde door");

  if (!doelBestaat.bestaat) {
    gebreken.push(
      doelBestaat.status === null
        ? "de doelpagina kon ik niet bereiken"
        : `de doelpagina antwoordt met ${doelBestaat.status}`,
    );
  } else if (doelBestaat.omleiding) {
    gebreken.push(`de link gaat via een omleiding naar ${doelBestaat.omleiding}`);
  }

  const ankerTekst = link.anker ? `"${link.anker}"` : "(geen tekst)";
  if (!gebreken.length) {
    return {
      uitslag: "goed",
      bewijs: `op ${bron.url} staat in de lopende tekst een link ${ankerTekst} naar ${doel}`,
      details: { ...details, anker: link.anker },
    };
  }
  return {
    uitslag: "deels",
    bewijs: `op ${bron.url} staat de link ${ankerTekst} naar ${doel} wel in de tekst, maar ${gebreken.join("; ")}`,
    details: { ...details, anker: link.anker, gebreken },
  };
}

/**
 * Punt 1 uit de mail: is deze pagina juist UIT het menu en de footer gehaald?
 *
 * Dit is de enige controle waar "ik vind hem niet" het goede antwoord is. Een
 * link in de lopende tekst is hier geen probleem maar juist de bedoeling, dus die
 * telt bewust niet mee als overtreding.
 */
export function beoordeelUitNavigatie(beeld: Sitebeeld, doelPad: string): Meting {
  const doel = pagePath(doelPad);
  const tellers = navigatieTellers(beeld, doel);
  const details: Record<string, unknown> = {
    doelPad: doel, inNavigatieOpPaginas: tellers.inNavigatie, inTekstOpPaginas: tellers.inTekst,
    gelezenPaginas: tellers.gelezen, drempel: beeld.chromeDrempel, ankers: tellers.ankers,
  };

  if (!tellers.gelezen) {
    return { uitslag: "onmeetbaar", bewijs: "geen enkele pagina was leesbaar, dus over het menu valt niets te zeggen", details };
  }

  // Bestaat de pagina zelf nog wel? Zo niet, dan is "hij staat niet in het menu"
  // een nietszeggende waarheid: een pagina die er niet is, staat nergens. Dit als
  // "goed" melden suggereert dat de bouwer hem netjes uit de navigatie heeft
  // gehaald, terwijl de pagina gewoon weg is. Een proef met een verzonnen pad
  // kreeg zo een groen vinkje, en dat is precies het soort valse geruststelling
  // waar een controle onbruikbaar van wordt.
  const doelPagina = beeld.paginas.find((p) => p.pad === doel);
  if (doelPagina && !doelPagina.meetbaar) {
    const weg = doelPagina.status !== null && doelPagina.status >= 400;
    return {
      uitslag: weg ? "vervallen" : "onmeetbaar",
      bewijs: weg
        ? `${doel} bestaat niet (meer): die pagina antwoordt met ${doelPagina.status}. Of hij uit het menu gehaald is valt daardoor niet vast te stellen.`
        : `${doel} kon ik niet lezen: ${doelPagina.reden}. Over het menu valt dan niets te zeggen.`,
      details: { ...details, doelStatus: doelPagina.status, doelReden: doelPagina.reden },
    };
  }
  if (!beeld.navigatieBetrouwbaar) {
    return {
      uitslag: "onmeetbaar",
      bewijs: `maar ${tellers.gelezen} pagina's leesbaar; met minder dan drie kan ik menu en footer niet van gewone links onderscheiden`,
      details,
    };
  }

  if (tellers.inNavigatie === 0) {
    const extra = tellers.inTekst ? ` Hij staat nog wel ${tellers.inTekst}x als link in de lopende tekst, en dat is precies de bedoeling.` : "";
    return {
      uitslag: "goed",
      bewijs: `${doel} staat op geen van de ${tellers.gelezen} gelezen pagina's meer in het menu of de footer.${extra}`,
      details,
    };
  }

  // Op een enkele pagina gevonden: eruit gehaald, maar ergens blijven hangen.
  if (tellers.inNavigatie < beeld.chromeDrempel) {
    return {
      uitslag: "deels",
      bewijs: `${doel} staat nog op ${tellers.inNavigatie} van de ${tellers.gelezen} gelezen pagina's buiten de lopende tekst; site-breed is hij eruit, maar niet overal`,
      details,
    };
  }

  return {
    uitslag: "niet",
    bewijs: `${doel} staat nog steeds site-breed in het menu of de footer: op ${tellers.inNavigatie} van de ${tellers.gelezen} gelezen pagina's${tellers.ankers.length ? `, als "${tellers.ankers[0]}"` : ""}`,
    details,
  };
}

// ── Staat de aangeleverde content op de pagina? ──

/**
 * Vergelijkt de koppen uit een aangeleverd document met de koppen op de live
 * pagina, en neemt drie steekproefzinnen mee als extra bewijs.
 *
 * Bewust op koppen en niet op de lopende tekst: een sitebouwer mag alinea's
 * herschikken of een zin aanpassen, dat maakt de content niet "niet doorgevoerd".
 * Koppen zijn de ruggengraat en veranderen zelden ongemerkt. Dat voorbehoud staat
 * daarom ook in elke bewijsregel; zonder die zin leest "over het algemeen
 * doorgevoerd" als meer dan het is.
 *
 * De vergelijking zelf komt uit copy-live.ts, zodat het werkplan-scherm en deze
 * controle nooit iets anders beweren over dezelfde pagina.
 */
export function beoordeelCopy(
  beeld: Sitebeeld,
  doelPad: string,
  bron: { koppen: string[]; tekst: string; naam: string; datum: string; herkomst: string },
  vergelijk: (bedoeld: string[], live: string[]) => { totaal: number; gevonden: number; percentage: number; ontbreekt: string[] },
): Meting {
  const doel = pagePath(doelPad);
  const pagina = beeld.paginas.find((p) => p.pad === doel);
  const noemer = bron.naam ? `"${bron.naam}"${bron.datum ? ` (bijlage bij de mail van ${bron.datum})` : ""}` : "het aangeleverde document";
  const voorbehoud = "Ik heb alleen de koppen vergeleken, niet de lopende tekst.";
  const details: Record<string, unknown> = { doelPad: doel, herkomst: bron.herkomst, document: bron.naam, koppenInDocument: bron.koppen.length };

  // Te weinig koppen om iets zinnigs over te zeggen. Twee koppen is een muntworp.
  if (bron.koppen.length < 3) {
    return { uitslag: "onmeetbaar", bewijs: `${noemer} heeft te weinig koppen om mee te vergelijken`, details };
  }
  if (!pagina) {
    return { uitslag: "onmeetbaar", bewijs: `${doel} is niet meegenomen in de meting`, details };
  }
  if (!pagina.meetbaar) {
    return { uitslag: "onmeetbaar", bewijs: `${doel} kon ik niet lezen: ${pagina.reden}`, details: { ...details, reden: pagina.reden } };
  }
  if (!pagina.koppen.length) {
    return { uitslag: "onmeetbaar", bewijs: `op ${pagina.url} vond ik geen enkele kop in de lopende tekst, dus valt er niets te vergelijken`, details };
  }

  const v = vergelijk(bron.koppen, pagina.koppen);
  // Steekproef op hele zinnen: puur bewijsmateriaal, nooit sturend voor de
  // uitslag. Een bijlage kan een briefing zijn in plaats van de definitieve tekst.
  const zinnen = bron.tekst
    .split(/(?<=[.!?])\s+/)
    .map((z) => z.trim())
    .filter((z) => z.length >= 60 && z.length <= 300 && !bron.koppen.includes(z))
    .slice(0, 30);
  const gekozen = [zinnen[0], zinnen[Math.floor(zinnen.length / 2)], zinnen[zinnen.length - 1]].filter(Boolean) as string[];
  const platLive = pagina.tekst.toLowerCase().replace(/\s+/g, " ");
  const raak = gekozen.filter((z) => platLive.includes(z.toLowerCase().replace(/\s+/g, " ").slice(0, 80))).length;
  const steekproef = gekozen.length ? ` ${raak} van de ${gekozen.length} steekproefzinnen uit het document staan ook op de pagina.` : "";

  const aandeel = v.totaal ? v.gevonden / v.totaal : 0;
  const uitslag: Uitslag = aandeel >= 0.8 ? "goed" : aandeel >= 0.4 ? "deels" : "niet";
  const missend = v.ontbreekt.slice(0, 5);
  const missendTekst = uitslag === "goed" || !missend.length
    ? ""
    : ` Deze ${missend.length === 1 ? "kop staat" : "koppen staan"} er niet: ${missend.map((k) => `"${k}"`).join(", ")}${v.ontbreekt.length > missend.length ? " en meer" : ""}.`;

  return {
    uitslag,
    bewijs: `van de ${v.totaal} koppen uit ${noemer} ${v.gevonden === 1 ? "staat er 1" : `staan er ${v.gevonden}`} op ${pagina.url}.${missendTekst}${steekproef} ${voorbehoud}`,
    details: { ...details, totaal: v.totaal, gevonden: v.gevonden, percentage: v.percentage, ontbreekt: v.ontbreekt.slice(0, 10), steekproefRaak: raak, steekproefTotaal: gekozen.length },
  };
}

// ── Bestaat een pagina? ──

export type Bestaat = { bestaat: boolean; status: number | null; omleiding: string };

/**
 * Kan een verzoek dat vanaf deze bronpagina moet komen überhaupt nog uitgevoerd
 * worden? Geeft null als er niets aan de hand is; dan gaat de gewone meting door.
 *
 * Twee gevallen waarin het antwoord "vervallen" is en niet "niet gedaan":
 * de pagina is weg (404), of de pagina is een omleiding geworden en bestaat dus
 * niet meer als eigen pagina. Dat laatste is precies /hovenier/hovenier-breda/,
 * waar de websitebouwer zelf naar vroeg: die rol werd door de homepage overgenomen.
 * Zonder dit onderscheid krijgt hij een verwijt voor iets dat onmogelijk was.
 */
export function beoordeelBron(bronPad: string, bron: Bestaat | undefined): Meting | null {
  if (!bronPad || !bron) return null;
  if (!bron.bestaat && bron.status !== null) {
    return {
      uitslag: "vervallen",
      bewijs: `de bronpagina ${bronPad} bestaat niet (meer): die antwoordt met ${bron.status}. Dit verzoek kan dus niet uitgevoerd worden.`,
      details: { bronPad, status: bron.status },
    };
  }
  if (bron.bestaat && bron.omleiding) {
    return {
      uitslag: "vervallen",
      bewijs: `de bronpagina ${bronPad} bestaat niet meer als eigen pagina; die stuurt door naar ${bron.omleiding}. Een link vanaf die pagina kan dus niet gelegd worden.`,
      details: { bronPad, omleiding: bron.omleiding, status: bron.status },
    };
  }
  return null;
}

/**
 * Bestaat deze pagina, en zo ja: komen we er rechtstreeks of via een omleiding?
 * Dit is wat "vervallen" van "niet gedaan" onderscheidt. Sander meldde dat
 * /hovenier/hovenier-breda/ niet meer bestaat; zonder deze controle zou het
 * systeem hem verwijten dat hij daar geen link heeft gelegd.
 */
export async function bestaatPagina(url: string): Promise<Bestaat> {
  const probeer = async (methode: "HEAD" | "GET"): Promise<Bestaat | null> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(url, {
        method: methode,
        redirect: "follow",
        cache: "no-store",
        signal: ctrl.signal,
        headers: { "User-Agent": BEZOEKER_UA, Accept: "text/html,*/*;q=0.8" },
      });
      const eind = res.url || url;
      const omleiding = res.redirected && pagePath(eind) !== pagePath(url) ? pagePath(eind) : "";
      return { bestaat: res.status < 400, status: res.status, omleiding };
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  };
  // Sommige servers weigeren HEAD maar beantwoorden GET gewoon; dan is HEAD geen
  // bewijs dat de pagina weg is.
  const head = await probeer("HEAD");
  if (head && head.status !== 403 && head.status !== 405) return head;
  const get = await probeer("GET");
  return get || head || { bestaat: false, status: null, omleiding: "" };
}

// ── Kan ik deze site überhaupt lezen? ──

export type Leescontrole = {
  ok: boolean;
  url: string;
  status: number | null;
  gerenderd: boolean;
  browserProbleem: string;
  uitleg: string;
};

/**
 * De eerste vraag die beantwoord moet zijn voordat de rest zin heeft: komen we
 * bij deze site binnen? Dit is expres een eigen knop, zodat een mislukte controle
 * nooit als "er staat niets" wordt gelezen terwijl de deur simpelweg dichtzit.
 */
export async function controleerLeesbaarheid(domein: string): Promise<Leescontrole> {
  const url = volledigeUrl(domein, "/");
  const g = await leesPagina(url);
  const probleem = browserProbleem() || "";
  if (g.meetbaar) {
    return {
      ok: true, url, status: g.status, gerenderd: g.gerenderd, browserProbleem: probleem,
      uitleg: g.gerenderd
        ? "De site is leesbaar via de echte browser. De controle kan alles meten."
        : `De site is leesbaar met een gewone leespoging${probleem ? `; de browser zelf start niet (${probleem}), wat alleen uitmaakt voor sites die hun inhoud pas met JavaScript tonen` : ""}.`,
    };
  }
  return {
    ok: false, url, status: g.status, gerenderd: g.gerenderd, browserProbleem: probleem,
    uitleg: `De site laat zich niet lezen: ${g.reden}. Zolang dit zo is kan de controle niets meten en meldt hij dat eerlijk in plaats van te beweren dat er niets op de site staat.`,
  };
}
