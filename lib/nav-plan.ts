import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getClientUrls } from "./site-urls";
import { getFocus } from "./focus";
import { getWeekplanPages } from "./overview";
import { getGscPageOpportunities } from "./google";
import { callClaude } from "./anthropic";
import { urlKey } from "./url-key";
import { PHASE_KEYS, setPhaseMark } from "./phase-marks";
import { getLatestSnapshots } from "./content-tracking";
import { klantContext, scorePagina, type ScoreInvoer, type ScorePunt } from "./page-score";

// ═══════════════════════════════════════════════════════════
// NAVIGATIE-ROADMAP: de beoogde sitestructuur + voortgang per pagina
// ═══════════════════════════════════════════════════════════
// Eén boom (de beoogde eindstructuur) waar de huidige site een weergave van
// is: het verschil is de kleur. Per pagina: hoofdzoekterm, klikbare slug en
// een voortgangspercentage uit de zeven fases die het dashboard al bijhoudt.
// De beoogde structuur wordt door de AI voorgesteld (uit live pagina's, het
// Zoekwoorden & links-blok en de zoekwoorddata) en pas na Maartens bevestiging
// de geldende structuur; daarna handmatig bij te werken.
// ═══════════════════════════════════════════════════════════

export type NavNode = {
  url: string;            // pad, bijv. /hovenier/hovenier-breda/
  parent: string;         // pad van de ouder ("" = hoofdniveau)
  hoofdzoekterm: string;
  volume: number | null;
  volgorde: number;
  label?: string;         // de menutekst zoals hij op de site staat ("Tuinontwerp")
};
export type RoadmapNode = NavNode & {
  live: boolean;
  pct: number;            // 0-100 uit de zeven fases
  fasesKlaar: number;
  inPlan: boolean;        // staat in de beoogde structuur
  // De snelle paginascore uit de laatste content-scan. null = nog niet gemeten.
  woorden: number | null;
  woordenGeschat: boolean;
  score: number | null;
  scoreNiveau: "goed" | "matig" | "zwak" | null;
  scoreLabel: string;
  punten: ScorePunt[];
  gemetenOp: string | null;
};

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_nav_plan (
      client_slug   TEXT NOT NULL,
      url           TEXT NOT NULL,
      parent        TEXT NOT NULL DEFAULT '',
      hoofdzoekterm TEXT,
      volume        INTEGER,
      volgorde      INTEGER NOT NULL DEFAULT 0,
      staat         TEXT NOT NULL DEFAULT 'actueel',
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, url, staat)
    )`;
  // De menutekst zoals hij op de site staat, voor de weergave "Huidige site".
  await sql`ALTER TABLE client_nav_plan ADD COLUMN IF NOT EXISTS label TEXT`;
}

const netPad = (p: string) => {
  let x = (p || "").trim();
  try { if (/^https?:\/\//i.test(x)) x = new URL(x).pathname; } catch { /* pad houden */ }
  if (!x.startsWith("/")) x = "/" + x;
  // De homepage moet "/" blijven; een leeg pad zou zichzelf als ouder krijgen
  // (parent is óók "") en dan loopt de boom in de roadmap oneindig rond.
  const kaal = x.replace(/\/+$/, "");
  return kaal ? kaal + "/" : "/";
};

type Staat = "actueel" | "voorstel" | "menu";

async function leesPlan(slug: string, staat: Staat): Promise<NavNode[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT url, parent, hoofdzoekterm, volume, volgorde, label FROM client_nav_plan WHERE client_slug = ${slug} AND staat = ${staat} ORDER BY volgorde, url`;
  return rows.map((r) => ({ url: r.url as string, parent: (r.parent as string) || "", hoofdzoekterm: (r.hoofdzoekterm as string) || "", volume: (r.volume as number) ?? null, volgorde: (r.volgorde as number) || 0, label: (r.label as string) || "" }));
}

async function schrijfPlan(slug: string, staat: Staat, nodes: NavNode[]): Promise<void> {
  await sql`DELETE FROM client_nav_plan WHERE client_slug = ${slug} AND staat = ${staat}`;
  let i = 0;
  for (const n of nodes.slice(0, 300)) {
    await sql`
      INSERT INTO client_nav_plan (client_slug, url, parent, hoofdzoekterm, volume, volgorde, staat, label)
      VALUES (${slug}, ${netPad(n.url)}, ${n.parent ? netPad(n.parent) : ""}, ${n.hoofdzoekterm || null}, ${n.volume ?? null}, ${i++}, ${staat}, ${n.label || null})
      ON CONFLICT (client_slug, url, staat) DO NOTHING`;
  }
}

// ── Het échte menu van de site uitlezen ──────────────────────────────
// De URL-lijst uit de sitescan is de hele sitemap (dus ook projecten,
// categorieën, vacatures en juridische pagina's) en zegt niets over het menu.
// "Huidige site" hoort te tonen wat een bezoeker in de navigatie ziet, in
// dezelfde volgorde en met dezelfde teksten. Daarom lezen we de homepage uit
// en halen we het hoofdmenu er letterlijk uit.

/** Pakt het <ul>-blok dat op `start` begint, inclusief de geneste ul's. */
function heelUlBlok(html: string, start: number): string {
  const re = /<\/?ul\b/gi;
  re.lastIndex = start;
  let diepte = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[0][1] === "/") { diepte--; if (diepte === 0) return html.slice(start, m.index + 5); }
    else diepte++;
    if (diepte > 30) break;
  }
  return html.slice(start, start + 200000);
}

/** Zet één menu-<ul> om in een lijst items met ouder-kind-verband. */
function menuUitUl(blok: string, host: string): NavNode[] {
  const out: NavNode[] = [];
  const laatstOpNiveau: string[] = [];
  const gezien = new Set<string>();
  let diepte = 0;
  let liGevuld = true;
  let volgorde = 0;
  const re = /<ul\b[^>]*>|<\/ul>|<li\b[^>]*>|<a\b[^>]*href=["']([^"'#]*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blok))) {
    const tag = m[0].slice(0, 3).toLowerCase();
    if (tag === "<ul") { diepte++; continue; }
    if (tag === "</u") { laatstOpNiveau[diepte] = ""; diepte--; continue; }
    if (tag === "<li") { liGevuld = false; continue; }
    // Een link: alleen de eerste link binnen een <li> is het menu-item zelf.
    if (liGevuld || diepte < 1) continue;
    const href = (m[1] || "").trim();
    if (!href) continue;
    let pad = "";
    try {
      const u = new URL(href, `https://${host}/`);
      if (u.hostname.replace(/^www\./, "") !== host.replace(/^www\./, "")) continue;
      pad = netPad(u.pathname);
    } catch { continue; }
    const label = m[2].replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    liGevuld = true;
    laatstOpNiveau[diepte] = pad;
    if (gezien.has(pad)) continue;
    gezien.add(pad);
    out.push({ url: pad, parent: diepte > 1 ? laatstOpNiveau[diepte - 1] || "" : "", hoofdzoekterm: "", volume: null, volgorde: volgorde++, label });
  }
  return out;
}

/** Leest het hoofdmenu van de homepage, zonder iets op te slaan. */
export async function leesSiteMenu(slug: string): Promise<{ ok: boolean; items?: NavNode[]; error?: string }> {
  const client = await getClientBySlug(slug);
  const domain = (client?.domain || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!domain) return { ok: false, error: "Deze klant heeft nog geen domein ingevuld." };
  await ensureSchema(); await ensureTable();
  let html = "";
  for (const adres of [`https://${domain}/`, `https://www.${domain.replace(/^www\./, "")}/`]) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 20000);
      const res = await fetch(adres, { redirect: "follow", signal: ctl.signal, cache: "no-store", headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "Accept-Language": "nl-NL,nl;q=0.9" } }).finally(() => clearTimeout(t));
      if (res.ok) { html = await res.text(); break; }
    } catch { /* volgende adres proberen */ }
  }
  if (!html) return { ok: false, error: "De site liet zich niet uitlezen (geen antwoord op de homepage)." };

  const schoon = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  // Alle kandidaat-menu's: elk <ul> waarvan de tag naar een menu of navigatie
  // verwijst. Het blok met de meeste eigen links én submenu's wint.
  const kandidaten: NavNode[][] = [];
  const ulRe = /<ul\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = ulRe.exec(schoon))) {
    if (!/(menu|nav)/i.test(m[0])) continue;
    const blok = heelUlBlok(schoon, m.index);
    const items = menuUitUl(blok, domain);
    if (items.length >= 3) kandidaten.push(items);
    if (kandidaten.length > 40) break;
  }
  const beste = kandidaten.sort((a, b) => (b.length + b.filter((x) => x.parent).length) - (a.length + a.filter((x) => x.parent).length))[0];
  if (!beste || beste.length < 3) return { ok: false, error: "Geen hoofdmenu gevonden op de homepage." };

  // De homepage staat zelden in het menu (het logo linkt ernaar) maar hoort er
  // wel bij; hij komt vooraan te staan.
  const compleet = beste.some((n) => n.url === "/") ? beste : [{ url: "/", parent: "", hoofdzoekterm: "", volume: null, volgorde: -1, label: "Homepage" }, ...beste];
  return { ok: true, items: compleet };
}

/** Hetzelfde, maar dan bewaard als de weergave "Huidige site". */
export async function scanSiteMenu(slug: string): Promise<{ ok: boolean; aantal?: number; error?: string }> {
  const r = await leesSiteMenu(slug);
  if (!r.ok || !r.items) return { ok: false, error: r.error };
  await schrijfPlan(slug, "menu", r.items);
  return { ok: true, aantal: r.items.length };
}

// ── AI-voorstel voor de beoogde structuur (Maarten bevestigt) ──

export async function proposeNavPlan(slug: string): Promise<{ ok: boolean; aantal?: number; error?: string }> {
  const client = await getClientBySlug(slug);
  if (!client) return { ok: false, error: "Klant niet gevonden." };
  const [urls, focus, kansen] = await Promise.all([
    getClientUrls(slug),
    getFocus(slug).catch(() => ({ html: "" })),
    client.domain ? getGscPageOpportunities(client.domain, 90).catch(() => []) : Promise.resolve([]),
  ]);
  const live = urls.filter((u) => u.status === 200).map((u) => { try { const x = new URL(u.url); return `${x.pathname} | titel: ${u.title || "-"}`; } catch { return u.url; } });
  const kansTekst = kansen.slice(0, 60).map((k) => { try { return `${new URL(k.url).pathname} → "${k.bestKeyword || ""}" (${k.bestVolume ?? "?"} vol.)`; } catch { return ""; } }).filter(Boolean);
  const sys = `Je bent SEO-strateeg bij bureau Pingwin. Bouw de BEOOGDE navigatiestructuur (eindplaatje) van deze website als boom, op basis van de huidige pagina's, de afspraken en de zoekwoorddata.
Regels:
- Neem alle waardevolle bestaande pagina's op én de pagina's die er volgens de afspraken/zoekwoorddata nog bij moeten. Functionele pagina's (privacy, voorwaarden, bedankt, inlog) weglaten.
- "url" is het pad (bijv. /hovenier/hovenier-breda/), "parent" het pad van de ouder ("" voor hoofdniveau, maximaal 2 niveaus diep waar logisch).
- "hoofdzoekterm": de belangrijkste zoekterm van die pagina (uit de data; verzin geen volumes: "volume" alleen invullen als het in de data staat, anders null).
- Logische volgorde per tak (belangrijkste eerst).
Antwoord met UITSLUITEND geldige JSON: {"paginas":[{"url":"...","parent":"","hoofdzoekterm":"...","volume":150}]}`;
  const user = [
    `Site: ${client.domain || ""}`,
    `\nHUIDIGE LIVE PAGINA'S:\n${live.slice(0, 120).join("\n") || "(nog geen scan)"}`,
    focus.html ? `\nAFSPRAKEN (Zoekwoorden & links, door Maarten bijgehouden):\n${focus.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 4000)}` : "",
    kansTekst.length ? `\nZOEKWOORDDATA PER PAGINA (Search Console + Ahrefs):\n${kansTekst.join("\n")}` : "",
    client.seoProfile ? `\nKLANTPROFIEL:\n${client.seoProfile.slice(0, 1200)}` : "",
  ].filter(Boolean).join("\n");
  try {
    const raw = await callClaude(sys, [{ role: "user", content: user }], 6000, { slug, action: "nav-plan-voorstel" });
    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1)) as { paginas?: NavNode[] };
    const nodes = (parsed.paginas || []).filter((n) => n && n.url).slice(0, 200);
    if (!nodes.length) return { ok: false, error: "Het voorstel kwam leeg terug; probeer het nog een keer." };
    await schrijfPlan(slug, "voorstel", nodes.map((n, i) => ({ ...n, volgorde: i })));
    return { ok: true, aantal: nodes.length };
  } catch (e) { return { ok: false, error: "Voorstel maken mislukte: " + (e as Error).message }; }
}

export async function confirmNavPlan(slug: string): Promise<void> {
  await ensureSchema(); await ensureTable();
  const voorstel = await leesPlan(slug, "voorstel");
  if (!voorstel.length) return;
  await schrijfPlan(slug, "actueel", voorstel);
  await sql`DELETE FROM client_nav_plan WHERE client_slug = ${slug} AND staat = 'voorstel'`;
}
export async function discardNavPlanProposal(slug: string): Promise<void> {
  await ensureSchema(); await ensureTable();
  await sql`DELETE FROM client_nav_plan WHERE client_slug = ${slug} AND staat = 'voorstel'`;
}

// ── Handmatig bijwerken ──

export async function upsertNavPage(slug: string, url: string, patch: { parent?: string; hoofdzoekterm?: string; volume?: number | null }): Promise<void> {
  await ensureSchema(); await ensureTable();
  const pad = netPad(url);
  await sql`
    INSERT INTO client_nav_plan (client_slug, url, parent, hoofdzoekterm, volume, volgorde, staat)
    VALUES (${slug}, ${pad}, ${patch.parent ? netPad(patch.parent) : ""}, ${patch.hoofdzoekterm || null}, ${patch.volume ?? null}, 999, 'actueel')
    ON CONFLICT (client_slug, url, staat) DO UPDATE SET
      parent = COALESCE(${patch.parent !== undefined ? (patch.parent ? netPad(patch.parent) : "") : null}, client_nav_plan.parent),
      hoofdzoekterm = COALESCE(${patch.hoofdzoekterm !== undefined ? patch.hoofdzoekterm : null}, client_nav_plan.hoofdzoekterm),
      volume = COALESCE(${patch.volume !== undefined ? patch.volume : null}, client_nav_plan.volume),
      updated_at = now()`;
}
export async function deleteNavPage(slug: string, url: string): Promise<void> {
  await ensureSchema(); await ensureTable();
  await sql`DELETE FROM client_nav_plan WHERE client_slug = ${slug} AND url = ${netPad(url)} AND staat = 'actueel'`;
}

// "Markeer voltooid": vinkt dezelfde fases af als op de projectkaarten (één waarheid).
export async function completeNavPage(slug: string, url: string, domain: string): Promise<void> {
  const vol = /^https?:\/\//i.test(url) ? url : `https://${domain}${netPad(url)}`;
  for (const f of PHASE_KEYS) await setPhaseMark(slug, vol, f, true);
}

// ── De roadmap zelf: plan + live-status + voortgang gecombineerd ──

export async function getRoadmap(slug: string): Promise<{ nodes: RoadmapNode[]; menu: RoadmapNode[]; voorstel: NavNode[]; domain: string; ontbrekend: string[] }> {
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  const [plan, voorstel, menu, urls, pages, snaps] = await Promise.all([
    leesPlan(slug, "actueel"),
    leesPlan(slug, "voorstel"),
    leesPlan(slug, "menu"),
    getClientUrls(slug),
    getWeekplanPages(slug).catch(() => ({} as Record<string, { [k: string]: unknown }>)),
    getLatestSnapshots(slug).catch(() => []),
  ]);

  // De snelle paginascore uit de laatste content-scan. De vaste omlijsting
  // (menu, footer, logo) bepalen we één keer over alle gemeten pagina's van
  // deze klant, zodat die niet bij elke pagina meetelt.
  const invoerVan = (s: (typeof snaps)[number]): ScoreInvoer => ({
    metaTitle: s.metaTitle, metaDescription: s.metaDescription, h1: s.h1, h1Count: s.h1Count,
    h2s: s.h2s, altTags: s.altTags, internalLinks: s.internalLinks,
    wordCount: s.wordCount, mainWordCount: s.mainWordCount, schemaTypes: s.schemaTypes,
  });
  const ctx = klantContext(snaps.map(invoerVan));
  const snapByKey = new Map(snaps.map((s) => [urlKey(s.url), s]));
  const liveByPad = new Map<string, boolean>();
  for (const u of urls) { try { liveByPad.set(netPad(new URL(u.url).pathname), u.status === 200); } catch { /* pad onleesbaar */ } }

  const pctVan = (vol: string): { pct: number; klaar: number } => {
    const info = (pages as Record<string, Record<string, unknown>>)[urlKey(vol)];
    if (!info) return { pct: 0, klaar: 0 };
    const klaar = PHASE_KEYS.filter((f) => !!info[f]).length;
    return { pct: Math.round((klaar / PHASE_KEYS.length) * 100), klaar };
  };

  // Basis: het bevestigde plan; is dat er nog niet, dan de live site als boom.
  const basis: NavNode[] = plan.length ? plan : urls.filter((u) => u.status === 200).map((u, i) => {
    let pad = "/"; try { pad = netPad(new URL(u.url).pathname); } catch { /* leeg */ }
    const stukken = pad.split("/").filter(Boolean);
    const parent = stukken.length > 1 ? "/" + stukken.slice(0, -1).join("/") + "/" : "";
    return { url: pad, parent, hoofdzoekterm: "", volume: null, volgorde: i };
  });
  // Live pagina's die niet in het plan staan tellen wél mee (anders "verdwijnt" de site).
  const inPlanPaden = new Set(basis.map((n) => n.url));
  const extra: NavNode[] = plan.length ? urls.filter((u) => u.status === 200).map((u) => { try { return netPad(new URL(u.url).pathname); } catch { return ""; } }).filter((p) => p && !inPlanPaden.has(p)).map((pad, i) => {
    const stukken = pad.split("/").filter(Boolean);
    const parent = stukken.length > 1 ? "/" + stukken.slice(0, -1).join("/") + "/" : "";
    return { url: pad, parent, hoofdzoekterm: "", volume: null, volgorde: 900 + i };
  }) : [];

  const verrijk = (n: NavNode): RoadmapNode => {
    const vol = domain ? `https://${domain}${n.url}` : n.url;
    const live = liveByPad.get(n.url) || false;
    const { pct, klaar } = pctVan(vol);
    const snap = snapByKey.get(urlKey(vol));
    const sc = snap ? scorePagina(invoerVan(snap), ctx) : null;
    return {
      ...n, live, pct: live || pct > 0 ? pct : 0, fasesKlaar: klaar, inPlan: inPlanPaden.has(n.url) && plan.length > 0,
      woorden: sc ? sc.woorden : null, woordenGeschat: sc ? sc.woordenGeschat : false,
      score: sc ? sc.score : null, scoreNiveau: sc ? sc.niveau : null, scoreLabel: sc ? sc.label : "",
      punten: sc ? sc.punten : [], gemetenOp: snap ? snap.capturedAt : null,
    };
  };
  const nodes: RoadmapNode[] = [...basis, ...extra].map(verrijk);
  // Het uitgelezen menu: pagina's die in het menu staan maar niet in de
  // sitemap-scan zaten, zijn nog steeds live (ze staan immers in het menu).
  const menuNodes: RoadmapNode[] = menu.map((n) => { const r = verrijk(n); return { ...r, live: r.live || liveByPad.size === 0 }; });
  // Pagina's die nog geen meting hebben; de knop in het scherm scant die alsnog.
  const ontbrekend = [...nodes, ...menuNodes]
    .filter((n) => n.live && n.score === null && domain)
    .map((n) => `https://${domain}${n.url}`)
    .filter((u, i, a) => a.indexOf(u) === i);
  return { nodes, menu: menuNodes, voorstel, domain, ontbrekend };
}
