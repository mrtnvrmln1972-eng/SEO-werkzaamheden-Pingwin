// ═══════════════════════════════════════════════════════════
// SITEMAP-CHECK: is de sitemap van de klant bereikbaar en compleet?
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat (12-08-2026). Bij One Day Clinic bleek de sitemap niet
// bij te houden wat er echt live staat: pagina's die ranken stonden er niet
// in, robots.txt verwees er niet naar, en de sitemap zelf blokkeerde
// geautomatiseerde lezers (Ahrefs kreeg een 429 op het bestand). Zolang dat
// alleen als vermoeden bestaat, blijft het gesprek gissen. Dit bestand haalt
// de sitemap vers op, legt hem naast de spiegel (client_urls) en maakt er één
// eerlijk antwoord van:
//   1. is de sitemap bereikbaar, en verwijst robots.txt ernaar;
//   2. welke live pagina's ontbreken erin;
//   3. welke regels erin wijzen naar een omgeleide of verdwenen pagina.
// De vergelijking gebruikt dezelfde pad-sleutel als de verenigde scan
// (lib/site-urls.ts), zodat dit scherm en de paginalijst nooit tegen elkaar
// in praten.

import { getClientBySlug } from "./clients";
import { getClientUrls, padSleutel, isExcludedUrl, isGeenPagina } from "./site-urls";
import { baseFromDomain } from "./wordpress";

export type SitemapBestand = { url: string; status: number | null; aantal: number };
export type SitemapPoging = { url: string; status: number | null };
export type MissendePagina = { url: string; title: string; gscImpressions: number; gscClicks: number };
export type FouteRegel = { url: string; status: number | null; redirectTarget: string };

export type SitemapCheckUitkomst = {
  ok: true;
  domain: string;
  /** De sitemap zelf: gevonden of niet, waar, en hoe groot. */
  gevonden: boolean;
  sitemapUrl: string;
  aantalInSitemap: number;
  bestanden: SitemapBestand[];   // index + sub-sitemaps, elk met status en aantal
  pogingen: SitemapPoging[];     // wat er geprobeerd is toen er niets gevonden werd
  /** robots.txt: bereikbaar, en verwijst hij naar de sitemap? */
  robotsStatus: number | null;
  robotsVerwijst: boolean;
  /** De vergelijking met de spiegel. */
  missend: MissendePagina[];     // live (200) in de spiegel, niet in de sitemap
  fouteRegels: FouteRegel[];     // in de sitemap, maar volgens de spiegel omgeleid of weg
  onbekendAantal: number;        // in de sitemap, nog nooit gescand (spiegel kent ze niet)
  onbekend: string[];            // een greep daaruit
  spiegelDatum: string | null;   // wanneer de spiegel voor het laatst is ingelezen
  spiegelAantal: number;
};

const UA = { "User-Agent": "Mozilla/5.0 PingwinBot", Accept: "text/xml,application/xml,text/plain,*/*" };

// Pagina's die bewust NIET in een sitemap horen: paginering, auteur-archieven,
// account-, winkelmand- en inlogpagina's. Die als "missend" melden zou ruis
// zijn, en ruis is precies waarom mensen zo'n lijst niet meer geloven.
const HOEFT_NIET_IN_SITEMAP = /\/(page\/\d+|author\/|mijn-account|my-account|cart|winkelmand|checkout|afrekenen|wp-login|uitloggen|logout|lost-password|wachtwoord-vergeten)/i;

async function haalTekst(url: string, timeoutMs = 12000): Promise<{ status: number | null; tekst: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: UA, redirect: "follow", cache: "no-store", signal: ctrl.signal });
    const tekst = res.ok ? await res.text() : "";
    return { status: res.status, tekst };
  } catch {
    return { status: null, tekst: "" };
  } finally {
    clearTimeout(t);
  }
}

const locs = (xml: string) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);

/**
 * Haalt de sitemap vers op (robots.txt-verwijzing eerst, dan de gangbare
 * plekken) en legt hem naast de spiegel van deze klant.
 */
export async function sitemapCheck(slug: string): Promise<SitemapCheckUitkomst | { ok: false; error: string }> {
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  if (!client) return { ok: false, error: "Klant niet gevonden." };
  if (!domain) return { ok: false, error: "Deze klant heeft nog geen domein ingesteld; vul dat in op het Pagina's-tabje en klik daar 'Website inlezen'." };
  const base = baseFromDomain(domain);

  // ── robots.txt: bereikbaar, en staat de sitemap erin genoemd? ──
  const robots = await haalTekst(`${base}/robots.txt`);
  const robotsSitemaps = [...robots.tekst.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);

  // ── De sitemap vinden: eerst wat robots.txt zegt, dan de gangbare plekken ──
  const kandidaten = [...new Set([...robotsSitemaps, `${base}/sitemap_index.xml`, `${base}/sitemap.xml`, `${base}/wp-sitemap.xml`])];
  const pogingen: SitemapPoging[] = [];
  const bestanden: SitemapBestand[] = [];
  const inSitemap = new Set<string>();      // pad-sleutels
  const sitemapUrls: string[] = [];         // volledige adressen, voor de foute-regels-lijst
  let sitemapUrl = "";
  const MAX = 3000;

  async function leesSitemap(sm: string, diepte: number): Promise<boolean> {
    if (diepte > 3 || inSitemap.size >= MAX || bestanden.some((b) => b.url === sm)) return false;
    const res = await haalTekst(sm);
    const gevondenLocs = res.status === 200 ? locs(res.tekst) : [];
    const isIndex = /<sitemapindex/i.test(res.tekst);
    const isSitemap = /<urlset/i.test(res.tekst);
    if (res.status !== 200 || (!isIndex && !isSitemap)) {
      if (diepte === 0) pogingen.push({ url: sm, status: res.status });
      else bestanden.push({ url: sm, status: res.status, aantal: 0 });
      return false;
    }
    if (isIndex) {
      bestanden.push({ url: sm, status: res.status, aantal: gevondenLocs.length });
      for (const kind of gevondenLocs) { if (inSitemap.size < MAX) await leesSitemap(kind, diepte + 1); }
    } else {
      let aantal = 0;
      for (const u of gevondenLocs) {
        if (inSitemap.size >= MAX) break;
        // Dezelfde zeef als de paginalijst: een bestand of een machinekoppeling
        // in de sitemap is geen pagina, en zou anders aan één kant wél meetellen
        // en aan de andere kant niet. Dan praten de twee lijsten tegen elkaar in.
        if (isExcludedUrl(u) || isGeenPagina(u)) continue;
        inSitemap.add(padSleutel(u));
        sitemapUrls.push(u);
        aantal++;
      }
      bestanden.push({ url: sm, status: res.status, aantal });
    }
    return true;
  }

  for (const kandidaat of kandidaten) {
    if (await leesSitemap(kandidaat, 0)) { sitemapUrl = kandidaat; break; }
  }
  const gevonden = !!sitemapUrl;

  // ── Naast de spiegel leggen ──
  const spiegel = await getClientUrls(slug);
  const spiegelDatum = spiegel.map((u) => u.lastScanned || "").filter(Boolean).sort().pop() || null;

  // Live pagina's (200, geen redirect) die de sitemap niet noemt. Alleen zinvol
  // als de sitemap ook echt gelezen is; anders zou álles "missend" heten.
  const missend: MissendePagina[] = !gevonden ? [] : spiegel
    .filter((u) => u.status !== null && u.status >= 200 && u.status < 300 && !u.redirectTarget)
    .filter((u) => !HOEFT_NIET_IN_SITEMAP.test(u.url))
    .filter((u) => !inSitemap.has(padSleutel(u.url)))
    .map((u) => ({ url: u.url, title: u.title, gscImpressions: u.gscImpressions, gscClicks: u.gscClicks }))
    .sort((a, b) => b.gscImpressions - a.gscImpressions);

  // Regels in de sitemap die volgens de spiegel omgeleid of weg zijn. De
  // sitemap hoort alleen levende pagina's te noemen.
  const spiegelPerPad = new Map(spiegel.map((u) => [padSleutel(u.url), u]));
  const fouteRegels: FouteRegel[] = [];
  const onbekend: string[] = [];
  for (const u of sitemapUrls) {
    const bekend = spiegelPerPad.get(padSleutel(u));
    if (!bekend) { onbekend.push(u); continue; }
    if (bekend.status !== null && bekend.status >= 300) {
      fouteRegels.push({ url: u, status: bekend.status, redirectTarget: bekend.redirectTarget });
    }
  }

  return {
    ok: true,
    domain,
    gevonden,
    sitemapUrl,
    aantalInSitemap: inSitemap.size,
    bestanden,
    pogingen,
    robotsStatus: robots.status,
    robotsVerwijst: robotsSitemaps.length > 0,
    missend,
    fouteRegels,
    onbekendAantal: onbekend.length,
    onbekend: onbekend.slice(0, 30),
    spiegelDatum,
    spiegelAantal: spiegel.length,
  };
}
