import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getClientUrls } from "./site-urls";
import { getFocus } from "./focus";
import { getWeekplanPages } from "./overview";
import { getGscPageOpportunities } from "./google";
import { callClaude } from "./anthropic";
import { urlKey } from "./url-key";
import { PHASE_KEYS, setPhaseMark } from "./phase-marks";

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
};
export type RoadmapNode = NavNode & {
  live: boolean;
  pct: number;            // 0-100 uit de zeven fases
  fasesKlaar: number;
  inPlan: boolean;        // staat in de beoogde structuur
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
}

const netPad = (p: string) => {
  let x = (p || "").trim();
  try { if (/^https?:\/\//i.test(x)) x = new URL(x).pathname; } catch { /* pad houden */ }
  if (!x.startsWith("/")) x = "/" + x;
  return x.replace(/\/+$/, "") + (x === "/" ? "" : "/");
};

async function leesPlan(slug: string, staat: "actueel" | "voorstel"): Promise<NavNode[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT url, parent, hoofdzoekterm, volume, volgorde FROM client_nav_plan WHERE client_slug = ${slug} AND staat = ${staat} ORDER BY volgorde, url`;
  return rows.map((r) => ({ url: r.url as string, parent: (r.parent as string) || "", hoofdzoekterm: (r.hoofdzoekterm as string) || "", volume: (r.volume as number) ?? null, volgorde: (r.volgorde as number) || 0 }));
}

async function schrijfPlan(slug: string, staat: "actueel" | "voorstel", nodes: NavNode[]): Promise<void> {
  await sql`DELETE FROM client_nav_plan WHERE client_slug = ${slug} AND staat = ${staat}`;
  let i = 0;
  for (const n of nodes.slice(0, 300)) {
    await sql`
      INSERT INTO client_nav_plan (client_slug, url, parent, hoofdzoekterm, volume, volgorde, staat)
      VALUES (${slug}, ${netPad(n.url)}, ${n.parent ? netPad(n.parent) : ""}, ${n.hoofdzoekterm || null}, ${n.volume ?? null}, ${i++}, ${staat})
      ON CONFLICT (client_slug, url, staat) DO NOTHING`;
  }
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

export async function getRoadmap(slug: string): Promise<{ nodes: RoadmapNode[]; voorstel: NavNode[]; domain: string }> {
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  const [plan, voorstel, urls, pages] = await Promise.all([
    leesPlan(slug, "actueel"),
    leesPlan(slug, "voorstel"),
    getClientUrls(slug),
    getWeekplanPages(slug).catch(() => ({} as Record<string, { [k: string]: unknown }>)),
  ]);
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

  const nodes: RoadmapNode[] = [...basis, ...extra].map((n) => {
    const vol = domain ? `https://${domain}${n.url}` : n.url;
    const live = liveByPad.get(n.url) || false;
    const { pct, klaar } = pctVan(vol);
    return { ...n, live, pct: live || pct > 0 ? pct : 0, fasesKlaar: klaar, inPlan: inPlanPaden.has(n.url) && plan.length > 0 };
  });
  return { nodes, voorstel, domain };
}
