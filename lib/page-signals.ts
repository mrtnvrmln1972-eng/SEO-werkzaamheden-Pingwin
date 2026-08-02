import { sql, ensureSchema } from "./db";
import { getClientUrls } from "./site-urls";
import { getLatestSnapshots, getLastChangePerUrl } from "./content-tracking";
import { getKeywords, getPages } from "./snapshots";
import { metaPixelInfo } from "./meta-rules";
import { buildWerkplan } from "./overview";
import { getOpportunities } from "./keyword-opportunities";
import { getFocus } from "./focus";

// ═══════════════════════════════════════════════════════════
// PAGINA-SIGNALEN: harde live-feiten als grond voor de bird's eye
// ═══════════════════════════════════════════════════════════
// Bundelt wat er al gegrond klaarligt (de wekelijkse content-scan-snapshots,
// de aangeleverde copy, de gecachte Search Console-standen) tot compacte
// signaalregels per pagina. Zo baseert de bird's eye zijn analyse en taken op
// feiten in plaats van op geheugen. Puur DB/cache, dus snel. Toont alleen
// pagina's MET een signaal, gecapt, zodat het nooit een muur wordt.
// ═══════════════════════════════════════════════════════════

const normKey = (u: string) => (u || "").trim().replace(/\/+$/, "");
function pathOf(u: string): string { try { return new URL(u).pathname || u; } catch { return u; } }

// Welke pagina's hebben een copy-document aangeleverd gekregen (en wanneer)?
async function copyDeliveredMap(slug: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const { rows } = await sql`
      SELECT url, updated_at FROM page_doc_outputs
      WHERE client_slug = ${slug} AND kind = 'copy' AND content IS NOT NULL`;
    for (const r of rows) out[normKey(r.url as string)] = new Date(r.updated_at as string).toISOString();
  } catch { /* geen copy-docs */ }
  return out;
}

// Per pagina de beste positie + beweging (nu vs vorige) uit de gecachte keywords.
function keywordDevByUrl(keywords: Awaited<ReturnType<typeof getKeywords>>): Record<string, { best: number; kw: string; delta: number | null }> {
  const out: Record<string, { best: number; kw: string; delta: number | null }> = {};
  for (const k of keywords) {
    if (!k.url || k.position == null) continue;
    const key = normKey(k.url);
    const cur = out[key];
    if (!cur || k.position < cur.best) {
      const delta = k.prevPosition != null ? Math.round((k.prevPosition - k.position) * 10) / 10 : null;
      out[key] = { best: k.position, kw: k.keyword, delta };
    }
  }
  return out;
}

// Het PAGINA-SIGNALEN-blok: één regel per pagina met een signaal.
export async function buildPageSignalsText(slug: string): Promise<string> {
  const [urls, snaps, copyMap, lastChange, keywords, pages] = await Promise.all([
    getClientUrls(slug).catch(() => []),
    getLatestSnapshots(slug).catch(() => []),
    copyDeliveredMap(slug),
    getLastChangePerUrl(slug).catch(() => ({} as Record<string, string>)),
    getKeywords(slug).catch(() => []),
    getPages(slug).catch(() => []),
  ]);
  if (!snaps.length && !Object.keys(copyMap).length) return "";

  const snapByUrl = new Map(snaps.map((s) => [normKey(s.url), s]));
  const pageByUrl = new Map(pages.map((p) => [normKey(p.url), p]));
  const kwDev = keywordDevByUrl(keywords);

  const live = urls.filter((u) => u.status != null && u.status >= 200 && u.status < 300);
  const lines: { txt: string; weight: number }[] = [];

  for (const u of live) {
    const key = normKey(u.url);
    const snap = snapByUrl.get(key);
    const sig: string[] = [];
    let weight = 0;

    if (snap) {
      const t = metaPixelInfo("meta_title", snap.metaTitle);
      const d = metaPixelInfo("meta_description", snap.metaDescription);
      if (!snap.metaTitle.trim()) { sig.push("meta-titel ontbreekt"); weight += 3; }
      else if (t.status === "over") { sig.push(`meta-titel te lang (${t.px} px)`); weight += 2; }
      if (!snap.metaDescription.trim()) { sig.push("meta-description ontbreekt"); weight += 3; }
      else if (d.status === "over") { sig.push(`meta-description te lang (${d.px} px)`); weight += 2; }

      const zonderAlt = snap.altTags.filter((a) => !(a.alt || "").trim()).length;
      if (zonderAlt > 0) { sig.push(`${zonderAlt} afbeelding${zonderAlt === 1 ? "" : "en"} zonder alt-tekst`); weight += 1; }

      if (snap.internalLinks.length <= 2) { sig.push(`weinig interne links (${snap.internalLinks.length}, orphan-risico)`); weight += 2; }
    }

    // Copy aangeleverd vs live: is er een copy-doc en (nog) geen wijziging gedetecteerd
    // sinds die aanlevering, dan is het onzeker of het live staat.
    const copyAt = copyMap[key];
    if (copyAt) {
      const changedAt = lastChange[key];
      if (!changedAt || changedAt < copyAt) {
        const dt = new Date(copyAt).toLocaleDateString("nl-NL");
        sig.push(`copy aangeleverd (${dt}), nog geen wijziging gedetecteerd, controleer of het live staat`);
        weight += 4;
      }
    }

    if (!sig.length) continue;

    const p = pageByUrl.get(key);
    const kw = kwDev[key];
    const metaBits: string[] = [];
    // ALLEEN het verse Search Console-cijfer. De terugval op de scan-kolom is
    // eruit: die stond op 0 bij pagina's die er in werkelijkheid duizenden
    // vertoningen hebben (/testen-in-amsterdam-welke-opties-heb-je/ stond op 0
    // tegen 4911 echt). Op precies zo'n 0 wordt besloten een pagina op te ruimen.
    // Geen cijfer is beter dan een fout cijfer.
    const clicks = p?.clicks;
    const impr = p?.impressions;
    if (p && (clicks || impr)) metaBits.push(`klikken ${clicks || 0}, vertoningen ${impr || 0} (Search Console)`);
    else if (!p) metaBits.push("verkeerscijfer niet bekend, haal het op met gsc_pagina voordat je hier iets over zegt");
    if (kw) metaBits.push(`positie ${kw.best} op "${kw.kw}"${kw.delta != null && kw.delta !== 0 ? ` (${kw.delta > 0 ? "+" : ""}${kw.delta})` : ""}`);
    const meta = metaBits.length ? ` [${metaBits.join("; ")}]` : "";
    lines.push({ txt: `- ${pathOf(u.url)}: ${sig.join("; ")}${meta}`, weight });
  }

  if (!lines.length) return "";
  lines.sort((a, b) => b.weight - a.weight);
  return lines.slice(0, 15).map((l) => l.txt).join("\n");
}

// Zoekwoorden mét stand: de grootste stijgers en dalers uit de gecachte
// Search Console-keywords, zodat "hoe staan de afgesproken zoekwoorden ervoor
// en bewegen ze" onderdeel van elk antwoord is.
export async function buildKeywordStandText(slug: string): Promise<string> {
  const keywords = await getKeywords(slug).catch(() => []);
  if (!keywords.length) return "";
  const withPos = keywords.filter((k) => k.position != null);
  if (!withPos.length) return "";

  const movers = withPos
    .filter((k) => k.prevPosition != null && Math.abs((k.prevPosition as number) - (k.position as number)) >= 3)
    .map((k) => ({ ...k, delta: Math.round(((k.prevPosition as number) - (k.position as number)) * 10) / 10 }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 10);

  const strikers = withPos
    .filter((k) => (k.position as number) >= 4 && (k.position as number) <= 20)
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))
    .slice(0, 8);

  const parts: string[] = [];
  if (movers.length) {
    parts.push("Grootste bewegingen (positie nu, verschil t.o.v. vorige periode):");
    for (const k of movers) parts.push(`- "${k.keyword}": positie ${k.position} (${k.delta > 0 ? "+" : ""}${k.delta})${k.url ? ` — ${pathOf(k.url)}` : ""}`);
  }
  if (strikers.length) {
    parts.push("Binnen handbereik (positie 4-20, hoog volume = kans):");
    for (const k of strikers) parts.push(`- "${k.keyword}": positie ${k.position}${k.volume ? `, volume ${k.volume}` : ""}${k.url ? ` — ${pathOf(k.url)}` : ""}`);
  }
  return parts.join("\n");
}

// Te bouwen / uit te breiden pagina's (autoriteit): de afgesproken maar nog
// niet-live pagina's, live pagina's met kansen, en de zoekwoord-gaten waar de
// site nog niet op rankt (kandidaten voor nieuwe autoriteitspagina's). Zodat de
// stand van zaken niet alleen "wat staat live" toont, maar ook wat er nog moet.
export async function buildTeBouwenText(slug: string): Promise<string> {
  const [werk, opps, urls, focus] = await Promise.all([
    buildWerkplan(slug).catch(() => null),
    getOpportunities(slug).catch(() => []),
    getClientUrls(slug).catch(() => []),
    getFocus(slug).catch(() => ({ html: "" })),
  ]);
  const gepland = werk?.gepland || [];
  const teBouwen = gepland.filter((i) => !i.live);
  const uitbreiden = gepland.filter((i) => i.live);

  // Geplande pagina's uit de afgesproken navigatie (Zoekwoorden en links, focus-HTML):
  // haal de paden/slugs uit de links en toets af tegen wat live staat. Zo komt de
  // uitgewerkte navigatie (ook thematische autoriteitspagina's) gegrond mee.
  const liveePaths = new Set(
    urls.filter((u) => u.status === 200).map((u) => normKey(pathOf(u.url)))
  );
  const inWerkplan = new Set(gepland.map((i) => normKey(i.slug)));
  const navPaths = new Set<string>();
  const html = (focus as { html?: string }).html || "";
  for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    let p = m[1].trim();
    try { p = new URL(p).pathname; } catch { /* relatief pad */ }
    if (!p.startsWith("/") || p.length < 3) continue;      // alleen echte interne paden
    if (/\.(pdf|jpg|png|zip|xlsx?|docx?)$/i.test(p)) continue;
    if (/^\/(wp-|search|feed|tag\/)/i.test(p)) continue;
    const key = normKey(p);
    if (liveePaths.has(key) || inWerkplan.has(key)) continue;  // al live of al genoemd
    navPaths.add(key);
  }

  const parts: string[] = [];
  if (teBouwen.length) {
    parts.push("Afgesproken/gepland maar nog niet live (bouwen):");
    for (const i of teBouwen.slice(0, 12)) parts.push(`- ${i.slug}${i.keyword ? ` — "${i.keyword}"${i.volume ? `, volume ${i.volume}` : ""}` : ""}`);
  }
  if (navPaths.size) {
    parts.push("Uit de afgesproken navigatie (Zoekwoorden en links), nog niet live, kandidaat om te bouwen:");
    for (const p of Array.from(navPaths).slice(0, 15)) parts.push(`- ${p}`);
  }
  if (uitbreiden.length) {
    parts.push("Live maar met kans (uitbreiden/optimaliseren):");
    for (const i of uitbreiden.slice(0, 6)) parts.push(`- ${i.slug}${i.kansLabel ? ` — ${i.kansLabel}` : ""}${i.position != null ? `, positie ${i.position}` : ""}`);
  }
  if (opps.length) {
    parts.push("Zoekwoord-gaten (site rankt hier nog niet, kandidaat voor een nieuwe pagina):");
    for (const o of opps.slice(0, 10)) parts.push(`- "${o.keyword}"${o.volume ? `, volume ${o.volume}` : ""}${o.reason ? ` — ${o.reason}` : ""}`);
  }
  return parts.join("\n");
}
