import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getClientUrls, getPagePlan } from "./site-urls";
import { getGscForPage } from "./google";
import { getAhrefsTopPages, getUrlOrganicKeywords, ahrefsConfigured } from "./ahrefs";
import { measurePage } from "./page-measure";
import { getWpConnForClient, findWpEditUrl } from "./wp";
import { callClaude } from "./anthropic";

// ═══════════════════════════════════════════════════════════
// PER-PAGINA INTERNE LINKS (stap 6 in de pagina-workflow)
// ═══════════════════════════════════════════════════════════
// Voor ÉÉN belangrijke landingspagina: welke andere pagina's van de site zouden
// er NAARTOE moeten linken, gerangschikt op interessantheid. Interessantheid =
// combinatie van (1) behandelt de bronpagina het onderwerp al? (lichte drempel:
// enige thematische aanraking is genoeg), (2) autoriteit van de bronpagina via
// externe verwijzende domeinen (Ahrefs), (3) klikken/verkeer van de bronpagina
// (GSC). Elke kans krijgt een voorgestelde ankertekst + een directe bewerk-link
// naar de WordPress-backend, zodat de link daar meteen geplaatst kan worden.
// Klein bereik = complete data = geen shortcuts, net als de cannibalisatiestap.
// ═══════════════════════════════════════════════════════════

export type PageInternalLinksState = { status: "idle" | "running" | "done" | "error"; result: string; error: string; updatedAt: string | null };

const CRAWL_LIMIT = 50; // hoeveel kandidaat-bronpagina's we crawlen (top op autoriteit + verkeer + thematische titel)
const MAX_SUGGESTIONS = 20; // zoveel kansen tonen we maximaal (met bewerk-link)

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_page_internal_links (
      client_slug TEXT NOT NULL,
      url         TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'idle',
      result      TEXT,
      error       TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, url)
    )`;
}

function pagePath(u: string): string { return (u || "").replace(/^https?:\/\/[^/]+/i, "").split("#")[0].split("?")[0].replace(/\/+$/, "") || "/"; }

// Normaliseert een href naar een schoon intern pad, of null als extern/geen echte link.
function toPath(href: string, domain: string): string | null {
  if (!href) return null;
  let h = href.trim();
  if (!h || h.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(h)) return null;
  const bare = domain.replace(/^www\./i, "").toLowerCase();
  try {
    if (/^https?:\/\//i.test(h)) {
      const u = new URL(h);
      if (u.hostname.replace(/^www\./i, "").toLowerCase() !== bare) return null;
      h = u.pathname;
    } else if (h.startsWith("//")) { return null; }
    else { h = new URL(h, `https://${bare}/`).pathname; }
  } catch { return null; }
  h = h.split("#")[0].split("?")[0];
  if (!h.startsWith("/")) h = "/" + h;
  if (h.length > 1) h = h.replace(/\/+$/, "");
  return h || "/";
}

// Nederlandse stopwoorden + generieke SEO-woorden die geen onderscheidende
// onderwerp-term zijn (voor het bepalen van de thematische tokens van de doelpagina).
const STOP = new Set(["de", "het", "een", "en", "of", "in", "op", "voor", "van", "te", "met", "aan", "bij", "als", "dat", "die", "dit", "je", "u", "we", "wij", "is", "zijn", "was", "waar", "wat", "hoe", "kan", "kun", "wil", "naar", "over", "per", "ook", "meer", "hier", "onze", "ons", "uw", "home", "pagina", "welkom", "contact", "nl", "www", "http", "https", "html", "php"]);
function topicTokens(parts: string[]): Set<string> {
  const out = new Set<string>();
  for (const p of parts) {
    for (const w of (p || "").toLowerCase().replace(/[^\p{L}\p{N}\s-]+/gu, " ").split(/[\s-]+/)) {
      if (w.length > 3 && !STOP.has(w)) out.add(w);
    }
  }
  return out;
}
function tokenHits(text: string, tokens: Set<string>): string[] {
  const t = (text || "").toLowerCase();
  const hits: string[] = [];
  for (const tok of tokens) if (t.includes(tok)) hits.push(tok);
  return hits;
}

export async function getPageInternalLinks(slug: string, url: string): Promise<PageInternalLinksState> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT status, result, error, updated_at FROM client_page_internal_links WHERE client_slug = ${slug} AND url = ${url} LIMIT 1`;
  const r = rows[0];
  if (!r) return { status: "idle", result: "", error: "", updatedAt: null };
  return {
    status: (r.status as PageInternalLinksState["status"]) || "idle",
    result: (r.result as string) || "",
    error: (r.error as string) || "",
    updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
  };
}

async function setState(slug: string, url: string, status: string, result: string | null, error: string): Promise<void> {
  await sql`
    INSERT INTO client_page_internal_links (client_slug, url, status, result, error, updated_at)
    VALUES (${slug}, ${url}, ${status}, ${result || null}, ${error || null}, now())
    ON CONFLICT (client_slug, url) DO UPDATE SET status = ${status}, result = ${result || null}, error = ${error || null}, updated_at = now()`;
}

export async function markPageInternalLinksRunning(slug: string, url: string): Promise<void> {
  await ensureSchema();
  await ensureTable();
  const cur = await getPageInternalLinks(slug, url);
  await setState(slug, url, "running", cur.result || null, "");
}

const SYSTEM = `Je bent een senior SEO-specialist bij bureau Pingwin. Je stelt de INTERNE LINKS naar ÉÉN belangrijke landingspagina voor (stap 6 in de pagina-workflow). Doel: welke andere pagina's van de site zouden hier het beste naartoe linken, gerangschikt van meest naar minst interessant.

INTERESSANTHEID (bepaalt de volgorde), in deze weging:
1. Relevantie is een LICHTE voorwaarde: noemt of behandelt de bronpagina ook maar enigszins het onderwerp van de doelpagina, dan telt hij mee. Geen strenge thematische match nodig. Alleen pagina's zonder énig verband met het onderwerp laat je weg.
2. Autoriteit van de bronpagina via EXTERNE verwijzende domeinen (hoe meer, hoe waardevoller de doorgegeven linkkracht).
3. Verkeer van de bronpagina (GSC-klikken/vertoningen).
Hoe hoger op 2 en 3 binnen de relevante set, hoe hoger in de lijst. Relevantie bepaalt of iets meedoet; autoriteit + verkeer bepalen vooral de volgorde.

GEEF PER KANS een relevantiescore 0-100 zodat de gebruiker zelf kan afwegen "raakt dit nog het onderwerp of gaat dit te ver": 80-100 = duidelijk hetzelfde onderwerp, 50-79 = raakt het onderwerp/verwant, 20-49 = zijdelings verband, <20 = niet meenemen.

ANKERTEKST: stel per kans een natuurlijke, gevarieerde ankertekst voor die past in de context van de bronpagina. Varieer (exact zoekwoord, gedeeltelijk, beschrijvend); vermijd dat alle ankers exact hetzelfde zijn (over-optimalisatie). Bewaak het meegeleverde bestaande ankerprofiel van de doelpagina.

Neem GEEN bronpagina's op die al naar de doelpagina linken (die staan apart vermeld). Verzin geen pagina's; kies uitsluitend uit de kandidaten hieronder.

Antwoord met UITSLUITEND geldige JSON, geen tekst eromheen, geen markdown-codeblok:
{"samenvatting": "één tot twee zinnen: hoeveel goede kansen en het algemene beeld", "kansen": [{"bronPad": "/pad/", "relevantie": 0-100, "ankertekst": "…", "reden": "één korte zin waarom deze bron logisch naar de doelpagina linkt"}]}
De array "kansen" staat al gesorteerd van meest naar minst interessant.`;

export async function runPageInternalLinks(slug: string, url: string): Promise<void> {
  try {
    await ensureSchema();
    await ensureTable();
    const client = await getClientBySlug(slug);
    const domain = client?.domain || "";
    if (!domain) { await setState(slug, url, "error", null, "Deze klant heeft nog geen domein ingevuld."); return; }
    const bare = domain.replace(/^www\./i, "").toLowerCase();
    const targetPath = pagePath(url);

    // Basis-data parallel.
    const [urls, topPages, plan, gscTarget, subjectKw] = await Promise.all([
      getClientUrls(slug).catch(() => []),
      ahrefsConfigured() ? getAhrefsTopPages(domain, 300).catch(() => [] as Awaited<ReturnType<typeof getAhrefsTopPages>>) : Promise.resolve([] as Awaited<ReturnType<typeof getAhrefsTopPages>>),
      getPagePlan(slug, url).catch(() => ""),
      getGscForPage(domain, url, 90).catch(() => [] as { keyword: string; clicks: number; impressions: number; position: number }[]),
      ahrefsConfigured() ? getUrlOrganicKeywords(url, "nl", 25).catch(() => []) : Promise.resolve([]),
    ]);

    // Autoriteit (externe verwijzende domeinen) per pagina uit Ahrefs top-pages.
    const refDom = new Map<string, number>();
    for (const t of topPages) if (t.refDomains != null) refDom.set(pagePath(t.url), t.refDomains);

    // Titel van de doelpagina (uit client_urls) + het onderwerp: titel, plan, eigen
    // top-zoekwoorden en GSC-queries van de doelpagina.
    const targetTitle = urls.find((u) => pagePath(u.url) === targetPath)?.title || "";
    const topicSrc = [
      targetTitle, plan.slice(0, 400),
      ...subjectKw.slice(0, 8).map((k) => k.keyword),
      ...gscTarget.slice(0, 10).map((r) => r.keyword),
      targetPath.split("/").filter(Boolean).join(" "),
    ];
    const tokens = topicTokens(topicSrc);

    // Kandidaat-bronpagina's: live pagina's (status 200), niet de doelpagina zelf.
    // Voorrang bij het crawlen: pagina's met autoriteit of verkeer, plus pagina's
    // waarvan de titel/URL het onderwerp al raakt (zodat thematisch voor de hand
    // liggende pagina's zeker meegaan, ook zonder veel verkeer).
    const live = urls.filter((u) => (u.status ?? 200) === 200 && pagePath(u.url) !== targetPath);
    const scored = live.map((u) => {
      const p = pagePath(u.url);
      const authority = refDom.get(p) ?? 0;
      const traffic = u.gscClicks || 0;
      const titleHit = tokenHits(`${u.title} ${p}`, tokens).length;
      // Thematische titel weegt zwaar mee in wát we crawlen; daarna autoriteit + verkeer.
      const rank = titleHit * 1000 + authority * 20 + traffic;
      return { path: p, title: u.title || "", authority, traffic, rank };
    }).sort((a, b) => b.rank - a.rank).slice(0, CRAWL_LIMIT);

    // Crawl de kandidaten (staticOnly = snel): titel + koppen (relevantiesignaal) +
    // uitgaande interne links (om te zien wie al naar de doelpagina linkt + linkbudget).
    type Crawled = { path: string; title: string; authority: number; traffic: number; heads: string; linksToTarget: boolean; anchorToTarget: string; outCount: number };
    const crawled: Crawled[] = [];
    const batchSize = 8;
    for (let i = 0; i < scored.length; i += batchSize) {
      const batch = scored.slice(i, i + batchSize);
      const got = await Promise.all(batch.map(async (c) => {
        const m = await measurePage(`https://${bare}${c.path === "/" ? "" : c.path}`, { staticOnly: true }).catch(() => null);
        const heads = m ? [m.metaTitle, ...(m.h1 || []), ...(m.h2 || []).slice(0, 10), ...(m.h3 || []).slice(0, 8)].filter(Boolean).join(" | ").slice(0, 400) : "";
        let linksToTarget = false; let anchorToTarget = ""; let outCount = 0;
        for (const l of m?.internalLinks || []) {
          const to = toPath(l.href, domain);
          if (!to) continue;
          outCount++;
          if (to === targetPath) { linksToTarget = true; if (!anchorToTarget) anchorToTarget = (l.text || "").trim().slice(0, 80); }
        }
        return { path: c.path, title: (m?.h1?.[0] || m?.metaTitle || c.title || "").slice(0, 120), authority: c.authority, traffic: c.traffic, heads, linksToTarget, anchorToTarget, outCount } as Crawled;
      }));
      crawled.push(...got);
    }

    // Bestaande interne links naar de doelpagina (voor het ankerprofiel + uitsluiten).
    const already = crawled.filter((c) => c.linksToTarget);
    const candidates = crawled.filter((c) => !c.linksToTarget);
    // Lichte relevantie-voorfilter: houd kandidaten met énige thematische aanraking
    // (titel/koppen raken het onderwerp) OF met autoriteit/verkeer (Claude beslist
    // uiteindelijk over de relevantie en de volgorde).
    const relevant = candidates.filter((c) => tokenHits(`${c.title} ${c.heads}`, tokens).length > 0 || c.authority > 0 || c.traffic > 0);

    const candLines = relevant
      .sort((a, b) => (b.authority * 20 + b.traffic) - (a.authority * 20 + a.traffic))
      .map((c) => {
        const hits = tokenHits(`${c.title} ${c.heads}`, tokens).slice(0, 6);
        return `• BRON ${c.path}${c.title ? ` — "${c.title}"` : ""}\n    onderwerp-raakvlak: ${hits.length ? hits.join(", ") : "(niet in titel/koppen)"} | verw.domeinen ${c.authority || "?"} | GSC-klikken ${c.traffic} | uitgaande links ${c.outCount}\n    koppen: ${c.heads || "(geen)"}`;
      });

    const context = [
      `KLANT: ${client?.name || slug} (domein: ${domain})`,
      `DOELPAGINA (de pagina die we willen versterken): ${targetPath}${targetTitle ? ` — "${targetTitle}"` : ""}`,
      plan ? `ROL/PLAN VAN DE DOELPAGINA: ${plan.slice(0, 700)}` : "",
      `ONDERWERP-TERMEN van de doelpagina (voor de relevantie-afweging): ${[...tokens].slice(0, 20).join(", ") || "(geen)"}`,
      `TOP-ZOEKWOORDEN van de doelpagina: ${subjectKw.slice(0, 8).map((k) => `"${k.keyword}"`).join(", ") || "(geen)"}`,
      "",
      `BESTAANDE INTERNE LINKS naar de doelpagina (NIET opnieuw voorstellen; wel het ankerprofiel bewaken): ${already.length ? already.map((a) => `${a.path}${a.anchorToTarget ? ` ("${a.anchorToTarget}")` : ""}`).join(", ") : "(nog geen)"}`,
      "",
      "KANDIDAAT-BRONPAGINA'S (kies hieruit; gerangschikt op autoriteit + verkeer):",
      candLines.length ? candLines.join("\n") : "- (geen kandidaten gevonden)",
    ].filter(Boolean).join("\n");

    const raw = await callClaude(SYSTEM, [{ role: "user", content: context.slice(0, 32000) }], 6000, { slug, action: "page_internal_links" });
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const first = cleaned.indexOf("{"); const last = cleaned.lastIndexOf("}");
    const jsonText = first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;
    let parsed: { samenvatting?: unknown; kansen?: unknown };
    try { parsed = JSON.parse(jsonText); } catch { await setState(slug, url, "error", null, "De analyse kwam niet als geldige JSON terug. Probeer het opnieuw."); return; }

    const kansenRaw = Array.isArray(parsed.kansen) ? (parsed.kansen as Record<string, unknown>[]) : [];
    const authOf = new Map(crawled.map((c) => [c.path, c.authority]));
    const trafOf = new Map(crawled.map((c) => [c.path, c.traffic]));
    const kansen = kansenRaw
      .map((k) => ({
        bronPad: pagePath(String(k.bronPad || "")),
        relevantie: Math.max(0, Math.min(100, Math.round(Number(k.relevantie) || 0))),
        ankertekst: String(k.ankertekst || "").trim(),
        reden: String(k.reden || "").trim(),
      }))
      .filter((k) => k.bronPad && k.bronPad !== targetPath && k.relevantie >= 20)
      .slice(0, MAX_SUGGESTIONS);

    // Bewerk-links naar de WordPress-backend per bron (indien gekoppeld), zodat de
    // link daar meteen geplaatst kan worden. Guarded en in kleine batches.
    const conn = await getWpConnForClient(slug).catch(() => null);
    const editLinks = new Map<string, string>();
    if (conn) {
      for (let i = 0; i < kansen.length; i += 5) {
        const batch = kansen.slice(i, i + 5);
        await Promise.all(batch.map(async (k) => {
          const link = await findWpEditUrl(conn, k.bronPad).catch(() => null);
          if (link) editLinks.set(k.bronPad, link);
        }));
      }
    }

    // Assembleer het leesbare markdown-document (nette tabel, klikbare links).
    const md = assembleMarkdown({
      summary: typeof parsed.samenvatting === "string" ? parsed.samenvatting : "",
      targetPath, bare, kansen, authOf, trafOf, editLinks, wpConfigured: !!conn,
    });
    await setState(slug, url, "done", md, "");
  } catch (e) {
    try { await setState(slug, url, "error", null, `Analyse mislukt: ${e instanceof Error ? e.message : "onbekende fout"}`); } catch { /* stil */ }
  }
}

function assembleMarkdown(a: {
  summary: string; targetPath: string; bare: string;
  kansen: { bronPad: string; relevantie: number; ankertekst: string; reden: string }[];
  authOf: Map<string, number>; trafOf: Map<string, number>; editLinks: Map<string, string>; wpConfigured: boolean;
}): string {
  const relLabel = (n: number) => n >= 80 ? `${n} (sterk)` : n >= 50 ? `${n} (verwant)` : `${n} (zijdelings)`;
  const lines: string[] = [];
  if (a.summary) lines.push(a.summary.trim(), "");
  if (!a.kansen.length) {
    lines.push("Er zijn nu geen duidelijke interne-link-kansen naar deze pagina gevonden.");
    return lines.join("\n");
  }
  lines.push("| # | Bronpagina | Relevantie | Verw.dom | GSC-klik | Ankertekst | Reden | Plaatsen |");
  lines.push("|---|---|---|---|---|---|---|---|");
  a.kansen.forEach((k, i) => {
    const front = `[${k.bronPad}](https://${a.bare}${k.bronPad === "/" ? "" : k.bronPad})`;
    const auth = a.authOf.get(k.bronPad);
    const traf = a.trafOf.get(k.bronPad);
    const edit = a.editLinks.get(k.bronPad);
    const place = edit ? `[bewerk in WordPress](${edit})` : (a.wpConfigured ? "-" : "koppel WP");
    lines.push(`| ${i + 1} | ${front} | ${relLabel(k.relevantie)} | ${auth ?? "?"} | ${traf ?? 0} | ${k.ankertekst || "-"} | ${k.reden || "-"} | ${place} |`);
  });
  lines.push("");
  lines.push(`Elke link wijst naar de doelpagina ${a.targetPath}. Volgorde: meest interessant bovenaan (relevantie als voorwaarde, daarna autoriteit via verwijzende domeinen en GSC-verkeer).`);
  if (!a.wpConfigured) lines.push("", "_Koppel WordPress (onder de cannibalisatie-tabel) om per bron een directe bewerk-link te krijgen._");
  return lines.join("\n");
}
