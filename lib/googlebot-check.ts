// ═══════════════════════════════════════════════════════════
// WAT ZIET GOOGLEBOT? URL-inspectie via de Search Console API
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat (12-08-2026). Bij One Day Clinic kreeg Ahrefs een 429 op
// het sitemap-bestand: de site blokkeert geautomatiseerde lezers. De vraag die
// er echt toe doet is of GOOGLE daar ook last van heeft, en dat hoeft niemand
// te raden: de URL-inspectie van Search Console vertelt per pagina wanneer
// Googlebot voor het laatst langskwam, of het ophalen toen lukte, en of de
// pagina in de index staat. Dit is exact wat de inspectie-balk bovenin Search
// Console laat zien, maar dan als knop in de sitemap-check, voor elke klant.
//
// Grens die Google stelt: zo'n 2.000 inspecties per property per dag. Wij
// inspecteren een handjevol pagina's per klik, dus daar blijven we ver onder.
// Let op: het totaaloverzicht van crawlfouten (de 429-teller voor de hele
// host) zit NIET in de API; dat staat alleen in Search Console zelf onder
// Instellingen → Crawlstatistieken → Hoststatus.

import { getGoogleAccessToken, gscPickSite } from "./google";
import { getClientBySlug } from "./clients";

export type GooglebotInspectie = {
  url: string;
  /** Kon de inspectie zelf draaien (los van wat Google over de pagina zegt). */
  gelukt: boolean;
  fout: string;
  /** Wanneer Googlebot voor het laatst langskwam (ISO), of null. */
  laatstGecrawld: string | null;
  /** Lukte het ophalen bij die laatste crawl, in gewone taal. */
  ophalen: string;
  /** Bewijst dit een blokkade voor Googlebot? */
  geblokkeerd: boolean;
  /** Staat de pagina in de index, in gewone taal. */
  index: string;
  inIndex: boolean;
  /** Via welke sitemap Google de pagina kent (leeg = niet via een sitemap). */
  viaSitemap: boolean;
};

// De vertaling van de API-toestanden naar gewone taal. Onbekende waarden tonen
// we letterlijk in plaats van te verstoppen; liever een rauwe term dan een gok.
const OPHALEN: Record<string, { tekst: string; blok: boolean }> = {
  SUCCESSFUL: { tekst: "gelukt", blok: false },
  SOFT_404: { tekst: "pagina leek leeg (soft 404)", blok: false },
  BLOCKED_ROBOTS_TXT: { tekst: "geblokkeerd door robots.txt", blok: true },
  NOT_FOUND: { tekst: "niet gevonden (404)", blok: false },
  ACCESS_DENIED: { tekst: "toegang geweigerd (inlog vereist)", blok: true },
  SERVER_ERROR: { tekst: "serverfout (5xx)", blok: true },
  REDIRECT_ERROR: { tekst: "doorverwijzing liep vast", blok: false },
  ACCESS_FORBIDDEN: { tekst: "geblokkeerd (403)", blok: true },
  BLOCKED_4XX: { tekst: "geblokkeerd (4xx, bijvoorbeeld 429)", blok: true },
  INTERNAL_CRAWL_ERROR: { tekst: "crawlfout bij Google zelf", blok: false },
  INVALID_URL: { tekst: "ongeldig adres", blok: false },
};

const INDEX: Record<string, { tekst: string; in: boolean }> = {
  "Submitted and indexed": { tekst: "in de index, via de sitemap", in: true },
  "Indexed, not submitted in sitemap": { tekst: "in de index, maar niet via de sitemap", in: true },
  "Crawled - currently not indexed": { tekst: "gecrawld, maar niet in de index", in: false },
  "Discovered - currently not indexed": { tekst: "ontdekt, nog nooit gecrawld", in: false },
  "URL is unknown to Google": { tekst: "onbekend bij Google", in: false },
  "Page with redirect": { tekst: "doorverwijzing (staat zelf niet in de index)", in: false },
  "Excluded by 'noindex' tag": { tekst: "uitgesloten met noindex", in: false },
  "Duplicate without user-selected canonical": { tekst: "gezien als duplicaat van een andere pagina", in: false },
  "Duplicate, Google chose different canonical than user": { tekst: "gezien als duplicaat; Google koos een andere hoofdpagina", in: false },
};

async function inspecteer(token: string, siteUrl: string, url: string): Promise<GooglebotInspectie> {
  const leeg: GooglebotInspectie = { url, gelukt: false, fout: "", laatstGecrawld: null, ophalen: "", geblokkeerd: false, index: "", inIndex: false, viaSitemap: false };
  try {
    const res = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inspectionUrl: url, siteUrl }),
      cache: "no-store",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      return { ...leeg, fout: j?.error?.message || `Search Console gaf antwoord ${res.status}.` };
    }
    const j = await res.json();
    const r = j?.inspectionResult?.indexStatusResult || {};
    const ophalen = OPHALEN[r.pageFetchState as string] || { tekst: r.pageFetchState || "onbekend", blok: false };
    const index = INDEX[r.coverageState as string] || { tekst: r.coverageState || "onbekend", in: false };
    return {
      url,
      gelukt: true,
      fout: "",
      laatstGecrawld: r.lastCrawlTime || null,
      ophalen: ophalen.tekst,
      geblokkeerd: ophalen.blok,
      index: index.tekst,
      inIndex: index.in,
      viaSitemap: Array.isArray(r.sitemap) && r.sitemap.length > 0,
    };
  } catch {
    return { ...leeg, fout: "De inspectie lukte niet; probeer het nog een keer." };
  }
}

/** Inspecteert een handjevol pagina's van deze klant bij Google zelf. */
export async function googlebotCheck(slug: string, urls: string[]): Promise<{ ok: true; site: string; resultaten: GooglebotInspectie[] } | { ok: false; error: string }> {
  const client = await getClientBySlug(slug);
  if (!client?.domain) return { ok: false, error: "Deze klant heeft nog geen domein ingesteld." };
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Search Console is niet gekoppeld; koppel Google op het beheerscherm." };
  const site = await gscPickSite(token, client.domain);
  if (!site) return { ok: false, error: `Het gekoppelde Google-account ziet geen Search Console-property voor ${client.domain}.` };

  const schoon = [...new Set(urls.map((u) => u.trim()).filter(Boolean))].slice(0, 8);
  // Drie tegelijk: snel genoeg voor een handjevol, netjes voor de API.
  const uit: GooglebotInspectie[] = new Array(schoon.length);
  let i = 0;
  async function werker() {
    while (i < schoon.length) { const n = i++; uit[n] = await inspecteer(token!, site!, schoon[n]); }
  }
  await Promise.all(Array.from({ length: Math.min(3, schoon.length) }, werker));
  return { ok: true, site, resultaten: uit };
}
