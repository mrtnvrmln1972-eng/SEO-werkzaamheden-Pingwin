import fs from "fs";
import path from "path";
import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getClientUrls } from "./site-urls";
import { getGscQueryPageMatrix } from "./google";
import { getAhrefsKeywords } from "./ahrefs-keywords";
import { getUrlRatings, autoriteitVan, type UrlAutoriteit } from "./ahrefs";
import { ctrVoorPositie } from "./prioriteiten-score";
import { measurePage } from "./page-measure";
import { callClaude } from "./anthropic";

// ═══════════════════════════════════════════════════════════
// INTERNE-LINKS-OPTIMALISATIE (dashboard-integratie van de skill)
// ═══════════════════════════════════════════════════════════
// Draait EXACT de methodiek uit de agentic skill
// `skills/interne-links-optimalisatie` (SKILL.md + output-schema.md). Die
// bestanden zijn de enige bron van waarheid. Het dashboard levert de data via de
// eigen connectoren: het bouwt de interne linkgraaf uit een crawl van de top-
// pagina's (measurePage → interne links + ankers), GSC (positie/klikken per
// pagina), Ahrefs-volumes en sinds 6 augustus 2026 de autoriteit per pagina
// (URL Rating) uit Ahrefs. Dat laatste was het enige gat in deze motor: de
// weging leunde op een benadering uit de eigen linkgraaf.
// ═══════════════════════════════════════════════════════════

const CRAWL_LIMIT = 80; // hoeveel pagina's we crawlen voor de linkgraaf (top op verkeer)

// --- Output-schema-types (spiegel van references/output-schema.md) ---------
export type SuggestedLink = {
  bronUrl: string; relevantie?: number; autoriteit?: string; verkeer?: number; linkbudget?: string;
  score?: string; passage?: string; nieuweZin?: boolean; ankertekst?: string; ankertype?: string;
  positie?: string; verwachteImpact?: string;
  // Door de code ingevuld ná de analyse, nooit door het model: de gemeten
  // autoriteit van de bronpagina met de datum erbij. Eén bron voor dit cijfer.
  urlRating?: number | null; urGemeten?: boolean; urDatum?: string;
};
export type AnchorProfileItem = { anker: string; type?: string; aantal?: number; status?: string };
export type TargetPage = {
  url: string; laag?: string; cluster?: string; primairZoekwoord?: string; huidigePositie?: number;
  doel?: string; baselineInterneLinks?: number; score?: string; voorgesteldeLinks: SuggestedLink[];
  ankerprofiel?: AnchorProfileItem[]; gaten?: string[]; waarschuwingen?: string[];
};
export type StructureInfo = { wezen?: string[]; pillarGaten?: string[]; clusterNotities?: string };
export type IlDatakwaliteit = { crawl?: boolean; gsc?: boolean; ahrefsUrlRating?: boolean; contentMapping?: boolean; opmerking?: string; urDatum?: string; urGemeten?: number };
export type InternalLinksResult = {
  samenvatting: string; datakwaliteit?: IlDatakwaliteit; doelpaginas: TargetPage[];
  structuur?: StructureInfo; generatedAt: string | null;
};
export type SuggestedTarget = {
  url: string; positie: number; primairZoekwoord: string; impressies: number;
  /** Wat het ongeveer oplevert als deze pagina naar de doelpositie klimt. */
  extraBezoekers: number;
  doelPositie: number;
  /** Waarom deze pagina in het lijstje staat, in gewone taal. */
  reden: string;
};
export type InternalLinksState = {
  status: "idle" | "running" | "done" | "error"; result: InternalLinksResult | null;
  targets: string[]; error: string; updatedAt: string | null;
  /** Wat er nu gebeurt, in gewone taal (voor het voortgangsrondje). */
  fase: string;
};

// Geen hartslag meer voor een kwartier betekent afgebroken. Zelfde grens als bij
// de opruim- en prioriteitenmotor, zodat "vastgelopen" overal hetzelfde betekent.
const STIL_MS = 15 * 60 * 1000;

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_internal_links (
      client_slug TEXT PRIMARY KEY,
      status      TEXT NOT NULL DEFAULT 'idle',
      targets     TEXT,
      result      TEXT,
      error       TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  // Waar de analyse is, in gewone taal. Zonder dit stond er alleen "draait" en
  // was een lopende analyse niet te onderscheiden van een afgebroken analyse.
  await sql`ALTER TABLE client_internal_links ADD COLUMN IF NOT EXISTS fase TEXT`;
}

// Normaliseert een href of URL naar een schoon pad (zonder domein/query/hash),
// of null als het extern/geen echte link is.
function toPath(href: string, domain: string): string | null {
  if (!href) return null;
  let h = href.trim();
  if (!h || h.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(h)) return null;
  const bare = domain.replace(/^www\./i, "").toLowerCase();
  try {
    if (/^https?:\/\//i.test(h)) {
      const u = new URL(h);
      if (u.hostname.replace(/^www\./i, "").toLowerCase() !== bare) return null; // extern
      h = u.pathname;
    } else if (h.startsWith("//")) {
      return null;
    } else {
      const u = new URL(h, `https://${bare}/`);
      h = u.pathname;
    }
  } catch { return null; }
  h = h.split("#")[0].split("?")[0];
  if (!h.startsWith("/")) h = "/" + h;
  if (h.length > 1) h = h.replace(/\/+$/, "");
  return h || "/";
}

// Laadt de skill (methodiek + output-schema) van schijf: de single source of truth.
let skillCache: string | null = null;
function loadSkillMethodology(): string {
  if (skillCache != null) return skillCache;
  try {
    const base = path.join(process.cwd(), "skills", "interne-links-optimalisatie");
    const skill = fs.readFileSync(path.join(base, "SKILL.md"), "utf8").replace(/^---[\s\S]*?---\n/, "");
    const schema = fs.readFileSync(path.join(base, "references", "output-schema.md"), "utf8");
    skillCache = `${skill}\n\n---\n\n${schema}`;
  } catch { skillCache = ""; }
  return skillCache;
}

export async function getInternalLinksState(slug: string): Promise<InternalLinksState> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT status, targets, result, error, updated_at, fase FROM client_internal_links WHERE client_slug = ${slug} LIMIT 1`;
  const r = rows[0];
  if (!r) return { status: "idle", result: null, targets: [], error: "", updatedAt: null, fase: "" };
  let result: InternalLinksResult | null = null;
  let targets: string[] = [];
  try { result = r.result ? JSON.parse(r.result as string) : null; } catch { result = null; }
  try { targets = r.targets ? JSON.parse(r.targets as string) : []; } catch { targets = []; }
  const updatedAt = r.updated_at ? new Date(r.updated_at as string).toISOString() : null;
  const status = (r.status as InternalLinksState["status"]) || "idle";

  // Draait hij nog echt? Deze analyse heeft geen cron-vangnet, dus een run zonder
  // hartslag is afgebroken. Dat eerlijk melden in plaats van eeuwig "draait":
  // anders blijft de startknop geblokkeerd en kun je niets meer.
  const stil = status === "running" && updatedAt && Date.now() - new Date(updatedAt).getTime() > STIL_MS;
  if (stil) {
    return {
      status: "error", result, targets, updatedAt, fase: (r.fase as string) || "",
      error: "De analyse is halverwege afgebroken (het tijdvenster van de server liep af). Klik opnieuw op starten; hij begint dan netjes overnieuw.",
    };
  }

  return {
    status, result, targets,
    error: (r.error as string) || "",
    updatedAt,
    fase: (r.fase as string) || "",
  };
}

/**
 * De hartslag: legt vast waar de analyse is én dat hij nog leeft. Zonder dit kon
 * een run die halverwege door het serverless-venster werd afgekapt eeuwig op
 * "draait" blijven staan, en dan blokkeerde de startknop voorgoed (live
 * aangetroffen bij One Day Clinic, 6 augustus 2026: 53 minuten "draait" terwijl
 * het venster van die functie vijf minuten is).
 */
async function raak(slug: string, fase: string): Promise<void> {
  await sql`UPDATE client_internal_links SET fase = ${fase}, updated_at = now() WHERE client_slug = ${slug}`.catch(() => { /* nooit de analyse laten klappen op de hartslag */ });
}

async function setState(slug: string, status: string, targets: string[], result: InternalLinksResult | null, error: string): Promise<void> {
  await sql`
    INSERT INTO client_internal_links (client_slug, status, targets, result, error, updated_at)
    VALUES (${slug}, ${status}, ${JSON.stringify(targets)}, ${result ? JSON.stringify(result) : null}, ${error || null}, now())
    ON CONFLICT (client_slug) DO UPDATE SET status = ${status}, targets = ${JSON.stringify(targets)}, result = ${result ? JSON.stringify(result) : null}, error = ${error || null}, updated_at = now()`;
}

export async function markInternalLinksRunning(slug: string, targets: string[]): Promise<void> {
  await ensureSchema();
  await ensureTable();
  const cur = await getInternalLinksState(slug);
  await setState(slug, "running", targets, cur.result, "");
}

// Aggregeert de GSC-matrix naar één regel per pagina: primair zoekwoord (meeste
// impressies), positie daarvan, en totale klikken/impressies.
type PerPage = { primaryKw: string; position: number; clicks: number; impressions: number };
function aggregatePerPage(matrix: { keyword: string; page: string; clicks: number; impressions: number; position: number }[], domain: string): Map<string, PerPage> {
  const map = new Map<string, PerPage>();
  const best = new Map<string, { kw: string; impr: number; pos: number }>();
  for (const row of matrix) {
    const p = toPath(row.page, domain); if (!p) continue;
    const cur = map.get(p) || { primaryKw: "", position: 0, clicks: 0, impressions: 0 };
    cur.clicks += row.clicks || 0; cur.impressions += row.impressions || 0;
    map.set(p, cur);
    const b = best.get(p);
    if (!b || (row.impressions || 0) > b.impr) best.set(p, { kw: row.keyword, impr: row.impressions || 0, pos: row.position || 0 });
  }
  for (const [p, b] of best) { const cur = map.get(p)!; cur.primaryKw = b.kw; cur.position = b.pos; }
  return map;
}

// Welke pagina's zijn het waard om te versterken, en wat levert het op?
//
// Dit lijstje was eerst gesorteerd op vertoningen, en dat is de verkeerde vraag.
// Vertoningen zeggen hoe vaak een pagina te zien is; ze zeggen niet wat je eraan
// overhoudt als hij stijgt. Nu staat er per pagina hoeveel extra bezoekers per
// maand hij kan opleveren, en dat is de volgorde.
//
// De som gebruikt dezelfde klikkans-curve als de rest van het dashboard
// (`ctrVoorPositie`), dus dit is geen tweede berekening naast de prioriteitenscan:
//   vertoningen × (klikkans op de doelpositie − klikkans op de huidige positie)
//
// De doelpositie is bewust bescheiden: van positie 8 naar 4, niet naar 1. Interne
// links maken een paar plekken verschil, geen sprong naar de eerste plaats, en een
// belofte die niet uitkomt is erger dan een kleiner getal.
export async function suggestTargets(slug: string): Promise<SuggestedTarget[]> {
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  if (!domain) return [];
  const matrix = await getGscQueryPageMatrix(domain, 90, 400).catch(() => [] as { keyword: string; page: string; clicks: number; impressions: number; position: number }[]);
  const per = aggregatePerPage(matrix, domain);
  const out: SuggestedTarget[] = [];
  for (const [p, v] of per) {
    // Positie 3 tot 20: dichtbij genoeg om te winnen, ver genoeg om te winnen.
    // Boven de 3 valt er weinig te halen, onder de 20 helpt een interne link niet.
    if (!(v.position >= 3 && v.position <= 20)) continue;
    if (v.impressions < 20) continue;

    const doel = Math.max(1, Math.round(v.position <= 6 ? v.position - 2 : v.position / 2));
    const winst = ctrVoorPositie(doel) - ctrVoorPositie(v.position);
    const extra = Math.round((v.impressions / 3) * Math.max(0, winst)); // per maand, uit 90 dagen
    if (extra < 1) continue;

    const reden = v.position <= 6
      ? `Staat net onder de top 3 op "${v.primaryKw}". Een paar plekken erbij is hier het meeste waard.`
      : v.position <= 12
        ? `Staat onderaan pagina 1 op "${v.primaryKw}". Precies het bereik waar interne links het verschil maken.`
        : `Staat op pagina 2 op "${v.primaryKw}", met genoeg vertoningen om de klim te rechtvaardigen.`;

    out.push({
      url: p,
      positie: Math.round(v.position * 10) / 10,
      primairZoekwoord: v.primaryKw,
      impressies: v.impressions,
      extraBezoekers: extra,
      doelPositie: doel,
      reden,
    });
  }
  return out.sort((a, b) => b.extraBezoekers - a.extraBezoekers).slice(0, 20);
}

// Crawlt een set paden (staticOnly = snel, geen headless) in kleine batches en
// bouwt de interne linkgraaf: per pagina de uitgaande interne links met ankertekst.
type CrawledPage = { path: string; title: string; out: { to: string; anchor: string }[]; outCount: number };
async function crawlGraph(paths: string[], domain: string): Promise<Map<string, CrawledPage>> {
  const bare = domain.replace(/^www\./i, "").toLowerCase();
  const result = new Map<string, CrawledPage>();
  const batchSize = 8;
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    const measured = await Promise.all(batch.map(async (p) => {
      try { return { p, m: await measurePage(`https://${bare}${p === "/" ? "" : p}`, { staticOnly: true }) }; }
      catch { return { p, m: null }; }
    }));
    for (const { p, m } of measured) {
      if (!m) { result.set(p, { path: p, title: "", out: [], outCount: 0 }); continue; }
      const seen = new Set<string>();
      const out: { to: string; anchor: string }[] = [];
      for (const l of m.internalLinks || []) {
        const to = toPath(l.href, domain);
        if (!to || to === p || seen.has(to)) continue;
        seen.add(to);
        out.push({ to, anchor: (l.text || "").trim().slice(0, 80) });
      }
      result.set(p, { path: p, title: (m.h1?.[0] || m.metaTitle || "").slice(0, 120), out, outCount: out.length });
    }
  }
  return result;
}

// Click depth vanaf de homepage via BFS over de uitgaande links (alleen gecrawlde pagina's).
function clickDepths(graph: Map<string, CrawledPage>): Map<string, number> {
  const depth = new Map<string, number>();
  const start = graph.has("/") ? "/" : null;
  if (!start) return depth;
  depth.set(start, 0);
  let frontier = [start];
  while (frontier.length) {
    const next: string[] = [];
    for (const p of frontier) {
      const node = graph.get(p); if (!node) continue;
      for (const e of node.out) {
        if (!graph.has(e.to) || depth.has(e.to)) continue;
        depth.set(e.to, (depth.get(p) || 0) + 1);
        next.push(e.to);
      }
    }
    frontier = next;
  }
  return depth;
}

// ── Autoriteit per pagina ───────────────────────────────────────────────────
// URL Rating is de gemeten kracht van het linkprofiel van één pagina (0-100,
// logaritmisch). Voor pagina's die Ahrefs niet kent blijft de oude benadering
// staan: de mediaan van wat we wél weten, en het aantal interne inkomende links
// en het verkeer breken de gelijkstand. Zo verdwijnt er niets uit de lijst en is
// altijd zichtbaar wat gemeten is en wat geschat.
type Autoriteit = { ur: number | null; gemeten: boolean; waarde: number };

function bouwAutoriteit(paden: string[], domain: string, ratings: Map<string, UrlAutoriteit>): Map<string, Autoriteit> {
  const bare = domain.replace(/^www\./i, "").toLowerCase();
  const gemeten: number[] = [];
  const ruw = new Map<string, number | null>();
  for (const p of paden) {
    const a = autoriteitVan(ratings, `${bare}${p === "/" ? "/" : p}`);
    const ur = a?.urlRating ?? null;
    ruw.set(p, ur);
    if (ur !== null) gemeten.push(ur);
  }
  const gesorteerd = [...gemeten].sort((a, b) => a - b);
  const mediaan = gesorteerd.length ? gesorteerd[Math.floor(gesorteerd.length / 2)] : 0;
  const out = new Map<string, Autoriteit>();
  for (const p of paden) {
    const ur = ruw.get(p) ?? null;
    out.set(p, { ur, gemeten: ur !== null, waarde: ur !== null ? ur : mediaan });
  }
  return out;
}

/** 0 tot 1, zodat autoriteit, verkeer en interne links vergelijkbaar wegen. */
function normaliseer(waarde: number, max: number): number {
  return max > 0 ? Math.min(1, Math.max(0, waarde / max)) : 0;
}

function urTekst(a: Autoriteit | undefined): string {
  if (!a) return "autoriteit ?";
  const getal = a.ur === null ? a.waarde : a.ur;
  const cijfer = Math.round(getal * 10) / 10;
  return `autoriteit(UR) ${String(cijfer).replace(".", ",")}${a.gemeten ? " gemeten" : " benaderd"}`;
}

function buildSystemPrompt(): string {
  const methodology = loadSkillMethodology();
  const head = methodology
    ? `Je voert de volgende agentic skill uit. Dit is je volledige methodiek en je output-schema; volg het strikt.\n\n${methodology}`
    : `Je bent een senior SEO-specialist. Voer een interne-link-analyse uit: vind per doelpagina de best mogelijke interne links, gewogen op relevantie, autoriteit, verkeer en linkbudget, met een gevarieerd ankerprofiel en aandacht voor de pillar-dochter-structuur.`;
  return `${head}

---

UITVOERING IN HET PINGWIN-DASHBOARD:
Je draait binnen het dashboard. De data hieronder is al voor je verzameld via de dashboard-connectoren: de interne linkgraaf (uit een crawl van de top-pagina's, met ankerteksten), GSC (positie/klikken per pagina) en de content mapping (uit titels en URL-structuur). Redeneer per doelpagina; verzin niets bij.
- Beoordeel de semantische relevantie tussen bron en doel uit de titels/onderwerpen die je krijgt (niet uit keyword-overlap alleen).
- Stel per doelpagina de best passende bronpagina's voor die er nog NIET naar linken, met een gevarieerde ankertekst (bewaak het meegeleverde bestaande ankerprofiel tegen over-optimalisatie).
- Respecteer de pillar-dochter-regels en benoem structurele gaten (dochter zonder terug-link naar de pillar, pillar die niet naar alle dochters linkt, wees-pagina's).
- Autoriteit per pagina krijg je als URL Rating (UR) uit Ahrefs: de gemeten kracht van het linkprofiel van díe pagina, 0 tot 100 en logaritmisch, dus 8 is fors sterker dan 5. Staat er "gemeten", gebruik het cijfer als hard gegeven; staat er "benaderd", dan kent Ahrefs die pagina niet en is het de mediaan van de site: weeg dan mee op interne inkomende links en verkeer, en zeg dat in je onderbouwing. Vul het veld "autoriteit" per voorgestelde bronpagina met dat cijfer.
- Zet in "datakwaliteit" de velden die je krijgt in de regel DATAKWALITEIT hieronder over; verzin er zelf niets bij.
- Antwoord met UITSLUITEND geldige JSON volgens het output-schema hierboven. Geen tekst eromheen, geen emoji, geen markdown-codeblok.`;
}

export async function runInternalLinks(slug: string, targetsIn: string[]): Promise<void> {
  try {
    await ensureSchema();
    await ensureTable();
    const client = await getClientBySlug(slug);
    const domain = client?.domain || "";
    if (!domain) { await setState(slug, "error", targetsIn, null, "Deze klant heeft nog geen domein ingevuld."); return; }

    const [urls, matrix, ahref] = await Promise.all([
      getClientUrls(slug),
      getGscQueryPageMatrix(domain, 90, 400).catch(() => [] as { keyword: string; page: string; clicks: number; impressions: number; position: number }[]),
      getAhrefsKeywords(slug).catch(() => []),
    ]);
    const per = aggregatePerPage(matrix, domain);
    const volMap = new Map(ahref.map((k) => [k.keyword.toLowerCase(), k.volume]));

    // Doelpagina's: meegegeven, anders auto (striking distance).
    let targets = (targetsIn || []).map((t) => toPath(t, domain)).filter((x): x is string => !!x);
    if (!targets.length) {
      const sug = await suggestTargets(slug);
      targets = sug.map((s) => s.url);
    }
    targets = [...new Set(targets)];

    // Crawlset: homepage + doelpagina's + top-pagina's op verkeer (voor de graaf).
    const live = urls.filter((u) => (u.status ?? 200) === 200);
    const ranked = [...live].sort((a, b) => (b.gscClicks * 10 + b.gscImpressions) - (a.gscClicks * 10 + a.gscImpressions));
    const crawlSet = new Set<string>(["/"]);
    for (const t of targets) crawlSet.add(t);
    for (const u of ranked) { if (crawlSet.size >= CRAWL_LIMIT) break; const p = toPath(u.url, domain); if (p) crawlSet.add(p); }

    await raak(slug, `De ${crawlSet.size} belangrijkste pagina's worden doorgelopen`);
    const graph = await crawlGraph([...crawlSet], domain);
    const depth = clickDepths(graph);

    // Autoriteit per pagina: één gebundelde Ahrefs-aanvraag per honderd pagina's,
    // 30 dagen gecachet. Valt hij weg, dan draait alles door op de benadering.
    const bare = domain.replace(/^www\./i, "").toLowerCase();
    const alleP = [...new Set([...graph.keys(), ...targets])];
    await raak(slug, "De autoriteit per pagina wordt opgehaald");
    const ratings = await getUrlRatings(alleP.map((p) => `https://${bare}${p === "/" ? "/" : p}`)).catch(() => new Map<string, UrlAutoriteit>());
    const autoriteit = bouwAutoriteit(alleP, domain, ratings);
    const urGemeten = [...autoriteit.values()].filter((a) => a.gemeten).length;
    const urDatum = [...ratings.values()].map((r) => r.opgehaald).sort().pop() || new Date().toISOString();

    // Inkomende links + ankers per pagina (invert de graaf).
    const inbound = new Map<string, { from: string; anchor: string }[]>();
    for (const node of graph.values()) {
      for (const e of node.out) {
        const arr = inbound.get(e.to) || []; arr.push({ from: node.path, anchor: e.anchor }); inbound.set(e.to, arr);
      }
    }

    // Titel per pagina (crawl → client_urls fallback).
    const titleMap = new Map<string, string>();
    for (const node of graph.values()) if (node.title) titleMap.set(node.path, node.title);
    for (const u of urls) { const p = toPath(u.url, domain); if (p && !titleMap.get(p) && u.title) titleMap.set(p, u.title.slice(0, 120)); }

    // URL-hiërarchie: kinderen per pad (voor de pillar-hint).
    const childCount = new Map<string, number>();
    const allPaths = new Set<string>([...graph.keys(), ...targets]);
    for (const p of allPaths) {
      for (const q of allPaths) { if (q !== p && q.startsWith(p === "/" ? "/" : p + "/")) childCount.set(p, (childCount.get(p) || 0) + 1); }
    }

    // --- Context bouwen ---
    const targetLines = targets.map((t) => {
      const v = per.get(t);
      const inb = inbound.get(t) || [];
      const anchors = inb.map((x) => x.anchor).filter(Boolean).slice(0, 8);
      const kids = childCount.get(t) || 0;
      const d = depth.has(t) ? depth.get(t) : undefined;
      const vol = v?.primaryKw ? volMap.get(v.primaryKw.toLowerCase()) : undefined;
      return [
        `• DOEL ${t}${titleMap.get(t) ? ` — "${titleMap.get(t)}"` : ""}`,
        `    primair zoekwoord: ${v?.primaryKw || "?"}${vol != null ? ` (vol ${vol})` : ""} | positie ${v ? Math.round(v.position * 10) / 10 : "?"} | ${v?.clicks ?? 0} clicks`,
        `    ${urTekst(autoriteit.get(t))} | interne inkomende links nu: ${inb.length}${anchors.length ? ` | bestaande ankers: ${anchors.map((a) => `"${a}"`).join(", ")}` : ""}`,
        `    hiërarchie-hint: ${kids >= 2 ? `PILLAR (${kids} onderliggende pagina's)` : "dochter/standalone"}${d != null ? ` | click depth ${d}` : ""}`,
        `    linkt al vanaf: ${inb.length ? inb.map((x) => x.from).slice(0, 20).join(", ") : "(niets)"}`,
      ].join("\n");
    });

    // Rangorde van de kandidaat-bronpagina's. Tot 6 augustus 2026 was dit
    // inkomende links maal vijf plus klikken; nu weegt de gemeten autoriteit het
    // zwaarst. De drie signalen worden eerst op 0-1 gezet, anders zou het grootste
    // getal (klikken) altijd winnen van een schaal die bij 100 ophoudt.
    const kandidaten = [...graph.values()]
      .filter((n) => !targets.includes(n.path))
      .map((n) => ({ n, inc: (inbound.get(n.path) || []).length, v: per.get(n.path), a: autoriteit.get(n.path) }));
    const maxUr = Math.max(1, ...kandidaten.map((k) => k.a?.waarde || 0));
    const maxInc = Math.max(1, ...kandidaten.map((k) => k.inc));
    const maxClicks = Math.max(1, ...kandidaten.map((k) => k.v?.clicks || 0));
    const candLines = kandidaten
      .map((k) => ({
        ...k,
        score: 0.5 * normaliseer(k.a?.waarde || 0, maxUr) + 0.3 * normaliseer(k.inc, maxInc) + 0.2 * normaliseer(k.v?.clicks || 0, maxClicks),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 90)
      .map(({ n, inc, v, a }) =>
        `• BRON ${n.path}${n.title ? ` — "${n.title}"` : ""} | ${v?.clicks ?? 0} clicks | ${urTekst(a)} | interne inkomende links ${inc} | linkbudget(uitgaand) ${n.outCount}`);

    const orphans = [...graph.values()].filter((n) => n.path !== "/" && (inbound.get(n.path) || []).length === 0).map((n) => n.path).slice(0, 30);

    const context = [
      `KLANT: ${client?.name || slug} (domein: ${domain})`,
      `Gecrawlde pagina's voor de linkgraaf: ${graph.size}. DATAKWALITEIT: crawl=true, gsc=${matrix.length > 0}, ahrefsUrlRating=${urGemeten > 0} (${urGemeten} van ${alleP.length} pagina's gemeten op ${urDatum.slice(0, 10)}), contentMapping=benaderd (uit titels/URL-structuur).`,
      "",
      "DOELPAGINA'S (de te versterken pagina's):",
      targetLines.length ? targetLines.join("\n") : "- (geen doelpagina's)",
      "",
      "KANDIDAAT-BRONPAGINA'S (gerangschikt op autoriteit + verkeer; kies hieruit pagina's die nog niet naar het doel linken):",
      candLines.length ? candLines.join("\n") : "- (geen bronpagina's gecrawld)",
      "",
      `WEES-PAGINA'S (geen interne inkomende links gevonden): ${orphans.length ? orphans.join(", ") : "(geen)"}`,
    ].join("\n");

    await raak(slug, "De beste bronpagina's en ankerteksten worden bepaald");
    const raw = await callClaude(buildSystemPrompt(), [{ role: "user", content: context.slice(0, 28000) }], 16000, { slug, action: "internal_links" });
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const first = cleaned.indexOf("{"); const last = cleaned.lastIndexOf("}");
    const jsonText = first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;
    let parsed: { samenvatting?: unknown; datakwaliteit?: unknown; doelpaginas?: unknown; structuur?: unknown };
    try { parsed = JSON.parse(jsonText); } catch { await setState(slug, "error", targets, null, "De analyse kwam niet als geldige JSON terug. Probeer het opnieuw."); return; }

    // De autoriteit per bronpagina komt uit onze eigen meting, niet uit wat het
    // model ervan overtypte. Zelfde reden als bij de fase-namen: één bron, anders
    // lopen scherm en meting stil uit elkaar.
    const doelpaginas = (Array.isArray(parsed.doelpaginas) ? (parsed.doelpaginas as TargetPage[]) : []).map((tp) => ({
      ...tp,
      voorgesteldeLinks: (tp.voorgesteldeLinks || []).map((l) => {
        const p = toPath(l.bronUrl || "", domain);
        const a = p ? autoriteit.get(p) : undefined;
        if (!a) return l;
        return { ...l, urlRating: Math.round(a.waarde * 10) / 10, urGemeten: a.gemeten, urDatum };
      }),
    }));

    const dkModel = parsed.datakwaliteit && typeof parsed.datakwaliteit === "object" ? (parsed.datakwaliteit as IlDatakwaliteit) : {};
    const result: InternalLinksResult = {
      samenvatting: typeof parsed.samenvatting === "string" ? parsed.samenvatting : "",
      datakwaliteit: {
        ...dkModel,
        crawl: graph.size > 0,
        gsc: matrix.length > 0,
        ahrefsUrlRating: urGemeten > 0,
        urGemeten,
        urDatum,
      },
      doelpaginas,
      structuur: parsed.structuur && typeof parsed.structuur === "object" ? (parsed.structuur as StructureInfo) : undefined,
      generatedAt: new Date().toISOString(),
    };
    await setState(slug, "done", targets, result, "");
  } catch (e) {
    try { await setState(slug, "error", targetsIn || [], null, `Analyse mislukt: ${e instanceof Error ? e.message : "onbekende fout"}`); } catch { /* stil */ }
  }
}
