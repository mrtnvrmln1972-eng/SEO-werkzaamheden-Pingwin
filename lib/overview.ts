// ═══════════════════════════════════════════════════════════
// OVERZICHT-LAAG: de site-brede "bird's eye" per klant
// ═══════════════════════════════════════════════════════════
// Bundelt bestaande signalen tot één compact beeld: waar staan we (hoeveel
// pagina's hebben een plan, hoeveel zijn nog leeg), en waar zit het laaghangend
// fruit (striking distance + CTR-onderkans + keyword-gaten). Geen nieuwe zware
// berekening: leunt op dezelfde 12u-cache als de Pagina's- en Meta-tab.
// Dit bestand is de ENE bron voor zowel het overzicht-endpoint als de
// bird's eye-chatcontext (DRY).

import { sql } from "./db";
import { getClientBySlug } from "./clients";
import { getStepsEverDoneAll, getStepLinksAll, getOutgoingClusterCountAll } from "./page-doc-run";
import { getStrategieLinksAll } from "./tasks";
import { getPageSchemaStatusAll } from "./page-schema";
import { getPhaseMarksAll } from "./phase-marks";
import { urlKey } from "./url-key";
import { getClientUrls } from "./site-urls";
import { getGscPageOpportunities } from "./google";
import { cacheGet, cacheSet } from "./ahrefs";
import { getMetaKansen } from "./meta-ctr";
import { getOpportunities } from "./keyword-opportunities";
import { getCopyLiveAll } from "./copy-live";

const norm = (u: string) => (u || "").trim().replace(/\/+$/, "");

// Zelfde kansscore als de Pagina's-tab (app/api/admin/page-opportunities/route.ts),
// hier hergebruikt zodat "laaghangend fruit" overal consistent is.
function opportunity(impressions: number, position: number | null): { score: number; label: string; level: "high" | "mid" | "low" | "none" } {
  if (!impressions || position == null) return { score: 0, label: "", level: "none" };
  if (position >= 11 && position <= 20) return { score: impressions * (21 - position), label: "Grote kans", level: "high" };
  if (position >= 4 && position <= 10) return { score: impressions * 4, label: "Quick win", level: "mid" };
  if (position > 20 && position <= 40) return { score: impressions * 0.15, label: "Op termijn", level: "low" };
  return { score: 0, label: "", level: "none" };
}

export type OverviewStatus = {
  totaal: number;        // aantal pagina's in de spiegel
  leeg: number;          // geen plan, geen cluster-advies (onbewerkt)
  halfPlan: number;      // kreeg cluster-advies mee (vertrekpunt)
  heeftPlan: number;     // vastgelegde strategie aanwezig
  docsAnalyse: number;   // pagina's met een analyse-document
  docsBlauwdruk: number; // pagina's met een blauwdruk-document
  docsCopy: number;      // pagina's met copy-document
  kapot: number;         // pagina's met een 4xx/5xx-status
  klikken: number;       // som GSC-klikken over alle pagina's
  vertoningen: number;   // som GSC-vertoningen over alle pagina's
};
export type OverviewFruit = { url: string; bestKeyword: string; position: number; impressions: number; clicks: number; volume: number | null; score: number; label: string; level: string };
export type OverviewCtr = { url: string; keyword: string; extraClicks: number; ctr: number; position: number };
export type OverviewGat = { keyword: string; volume: number | null; difficulty: number | null; reason: string };

export type Overview = {
  ok: true;
  hasDomain: boolean;
  status: OverviewStatus;
  fruit: OverviewFruit[];
  ctr: OverviewCtr[];
  gaten: OverviewGat[];
  /** Stonden de trage blokken (meta-kansen, keyword-gaten) al klaar? */
  extraKlaar?: boolean;
  updatedAt: string;
};

// Telt per keten-stap hoeveel pagina's al een document hebben (één query i.p.v.
// per pagina). Faalt stil naar nullen: het overzicht mag hier nooit op klappen.
async function docCounts(slug: string): Promise<{ analyse: number; blauwdruk: number; copy: number }> {
  try {
    const { rows } = await sql`SELECT kind, COUNT(DISTINCT url) AS n FROM page_doc_outputs WHERE client_slug = ${slug} GROUP BY kind`;
    const m: Record<string, number> = {};
    for (const r of rows) m[String(r.kind)] = Number(r.n) || 0;
    return { analyse: m.analyse || 0, blauwdruk: m.blauwdruk || 0, copy: m.copy || 0 };
  } catch { return { analyse: 0, blauwdruk: 0, copy: 0 }; }
}

// Haalt de (gecachte) GSC-pagina-kansen op; zelfde sleutel en fallback als de
// bestaande Pagina's-tab, zodat we nooit een extra Ahrefs-storm veroorzaken.
async function gscOpps(domain: string, fresh: boolean) {
  type Rows = Awaited<ReturnType<typeof getGscPageOpportunities>>;
  let rows: Rows | null = fresh ? null : await cacheGet<Rows>("gsc_opps", domain, "-", 0.5).catch(() => null);
  if (!rows) {
    rows = domain ? await getGscPageOpportunities(domain, 90).catch(() => []) : [];
    if (rows.length) await cacheSet("gsc_opps", domain, "-", rows).catch(() => {});
  }
  return rows;
}

// De twee trage blokken (meta-kansen en keyword-gaten) kostten samen zeven tot
// acht seconden per keer dat je de Bird's eye opende, voor 3 kB aan uitkomst die
// nauwelijks per uur verandert. Ze krijgen daarom dezelfde cache als de Search
// Console-data eronder: 12 uur, met de verversknop als ontsnapping.
async function metCache<T>(kind: string, slug: string, fresh: boolean, maak: () => Promise<T>): Promise<T | null> {
  if (!fresh) {
    const uit = await cacheGet<T>(kind, slug, "-", 0.5).catch(() => null);
    if (uit) return uit;
  }
  const vers = await maak().catch(() => null);
  if (vers && (!Array.isArray(vers) || vers.length)) await cacheSet(kind, slug, "-", vers).catch(() => {});
  return vers;
}

// snel: lever meteen wat er zonder rekenwerk is. De trage blokken komen alleen mee
// als ze al in de cache staan; anders haalt het scherm ze in een tweede ronde op.
// Zo staat het overzicht er direct in plaats van na zeven seconden.
export async function buildOverview(slug: string, opts: { fresh?: boolean; snel?: boolean } = {}): Promise<Overview> {
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";

  const traag = async <T>(kind: string, maak: () => Promise<T>): Promise<T | null> =>
    opts.snel
      ? await cacheGet<T>(kind, slug, "-", 0.5).catch(() => null)
      : await metCache<T>(kind, slug, !!opts.fresh, maak);

  const [urls, oppRows, ctrRows, gaten, docs] = await Promise.all([
    getClientUrls(slug).catch(() => []),
    gscOpps(domain, !!opts.fresh),
    traag("ov_meta_kansen", () => getMetaKansen(slug)),
    traag("ov_keyword_gaten", () => getOpportunities(slug)),
    docCounts(slug),
  ]);

  // ── Werkstatus-telling ──
  let leeg = 0, halfPlan = 0, heeftPlan = 0, kapot = 0, klikken = 0, vertoningen = 0;
  for (const u of urls) {
    if ((u.plan || "").trim()) heeftPlan++;
    else if (u.hasClusterAdvice) halfPlan++;
    else leeg++;
    if (u.status != null && u.status >= 400) kapot++;
    klikken += u.gscClicks || 0;
    vertoningen += u.gscImpressions || 0;
  }
  const status: OverviewStatus = {
    totaal: urls.length, leeg, halfPlan, heeftPlan,
    docsAnalyse: docs.analyse, docsBlauwdruk: docs.blauwdruk, docsCopy: docs.copy,
    kapot, klikken, vertoningen,
  };

  // ── Laaghangend fruit (striking distance / quick win) ──
  const fruit: OverviewFruit[] = oppRows
    .map((p) => {
      const o = opportunity(p.impressions, p.position);
      return { url: p.url, bestKeyword: p.bestKeyword, position: p.position, impressions: p.impressions, clicks: p.clicks, volume: p.bestVolume, score: Math.round(o.score), label: o.label, level: o.level };
    })
    .filter((f) => f.level !== "none")
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  // ── CTR-onderkans (veel vertoningen, te weinig klikken) ──
  const ctr: OverviewCtr[] = [...(ctrRows || [])]
    .sort((a, b) => b.extraClicks - a.extraClicks)
    .slice(0, 5)
    .map((r) => ({ url: r.url, keyword: r.keyword, extraClicks: r.extraClicks, ctr: r.ctr, position: r.position }));

  // ── Keyword-gaten (site rankt hier nog niet op) ──
  const gatenTop: OverviewGat[] = (gaten || []).slice(0, 5).map((g) => ({ keyword: g.keyword, volume: g.volume, difficulty: g.difficulty, reason: g.reason }));

  return {
    ok: true, hasDomain: !!domain, status, fruit, ctr, gaten: gatenTop,
    // false = meta-kansen en keyword-gaten stonden nog niet klaar; het scherm haalt
    // ze dan in een tweede ronde op zonder de rest te laten wachten.
    extraKlaar: ctrRows != null && gaten != null,
    updatedAt: new Date().toISOString(),
  };
}

// ── Werkstatus per pagina: wat is gedaan, wat loopt, wat is gepland ──
export type PageWork = {
  url: string; live: boolean; hasPlan: boolean; hasClusterAdvice: boolean;
  docs: string[]; summaryNu: string; summaryDoel: string; summaryZet: string;
  clicks: number; impressions: number;
  // Staat de geschreven copy aantoonbaar op de pagina? null = nog niet gemeten.
  doorgevoerd: boolean | null;
};

// Twee losse try/awaits na elkaar duurden twee rondjes naar de database in
// plaats van één; deze haalt de rijen op en valt bij een fout terug op leeg,
// zonder de rest van Promise.all hieronder op te houden.
async function rowsOf<T>(query: Promise<{ rows: T[] }>): Promise<T[]> {
  try { return (await query).rows; } catch { return []; }
}

// preCopyLive: als de aanroeper de copy-live-stand al heeft opgehaald (zoals
// getWeekplanPages hieronder), hergebruik die dan in plaats van dezelfde tabel
// een tweede keer te bevragen. Scheelt één rondje naar de database per aanroep.
export async function getPageWorkStatus(
  slug: string,
  preCopyLive?: Promise<Record<string, { doorgevoerd: boolean; meetbaar: boolean }>>,
): Promise<PageWork[]> {
  const [urls, copyLive, docsRows, sumRows] = await Promise.all([
    getClientUrls(slug).catch(() => []),
    preCopyLive ?? getCopyLiveAll(slug).catch(() => ({} as Record<string, { doorgevoerd: boolean; meetbaar: boolean }>)),
    rowsOf<{ url: string; kinds: string[] }>(sql`SELECT url, array_agg(DISTINCT kind) AS kinds FROM page_doc_outputs WHERE client_slug = ${slug} GROUP BY url`),
    rowsOf<{ url: string; nu: string; doel: string; zet: string }>(sql`SELECT url, nu, doel, zet FROM page_summaries WHERE client_slug = ${slug}`),
  ]);
  const docsByUrl: Record<string, string[]> = Object.fromEntries(
    docsRows.map((r) => [norm(String(r.url)), ((r.kinds as string[]) || []).filter(Boolean)]));
  const sumByUrl: Record<string, { nu: string; doel: string; zet: string }> = Object.fromEntries(
    sumRows.map((r) => [norm(String(r.url)), { nu: (r.nu as string) || "", doel: (r.doel as string) || "", zet: (r.zet as string) || "" }]));
  return urls.map((u) => {
    const k = norm(u.url);
    const sum = sumByUrl[k] || { nu: "", doel: "", zet: "" };
    return {
      url: u.url, live: u.status === 200, hasPlan: !!(u.plan || "").trim(), hasClusterAdvice: !!u.hasClusterAdvice,
      docs: docsByUrl[k] || [], summaryNu: sum.nu, summaryDoel: sum.doel, summaryZet: sum.zet,
      clicks: u.gscClicks || 0, impressions: u.gscImpressions || 0,
      // Alleen een oordeel als we de pagina echt konden lezen; anders null
      // ("nog niet gecontroleerd"), nooit een onterechte "staat niet live".
      doorgevoerd: copyLive[urlKey(u.url)]?.meetbaar ? copyLive[urlKey(u.url)].doorgevoerd : null,
    };
  });
}

// Tekstweergave van de werkstatus voor de chatcontext: drie groepen (bewerkt,
// onbewerkt-met-kans, gepland), begrensd zodat de context niet ontploft.
export function pageWorkStatusToText(pages: PageWork[]): string {
  const short = (u: string) => { try { const x = new URL(u); return x.pathname + x.search; } catch { return u; } };
  const bewerkt = pages.filter((p) => p.hasPlan || p.docs.length);
  const gepland = pages.filter((p) => !p.live && !p.hasPlan && !p.docs.length);
  const onbewerkt = pages
    .filter((p) => p.live && !p.hasPlan && !p.docs.length && p.impressions > 0)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15);
  const lines: string[] = [];
  if (bewerkt.length) {
    lines.push(`AL BEWERKTE PAGINA'S (${bewerkt.length}) — hier is al strategie/werk aan gedaan:`);
    for (const p of bewerkt.slice(0, 40)) {
      const docs = p.docs.length ? ` [documenten: ${p.docs.join(", ")}]` : "";
      const plan = p.hasPlan ? " [strategie vastgelegd]" : p.hasClusterAdvice ? " [half plan/vertrekpunt]" : "";
      const sum = p.summaryZet ? ` — volgende zet: ${p.summaryZet}` : p.summaryDoel ? ` — doel: ${p.summaryDoel}` : "";
      // Geschreven is niet doorgevoerd. Zonder dit onderscheid noemt de assistent
      // een pagina "klaar" terwijl de tekst nog bij de sitebouwer ligt.
      const live = p.docs.includes("copy")
        ? p.doorgevoerd === true ? " [copy staat LIVE op de pagina]"
          : p.doorgevoerd === false ? " [copy GESCHREVEN maar nog NIET doorgevoerd op de site]"
          : " [nog niet gecontroleerd of de copy live staat]"
        : "";
      lines.push(`- ${short(p.url)}${plan}${docs}${live}${sum}`);
    }
  }
  if (onbewerkt.length) {
    lines.push("\nNOG ONBEWERKTE PAGINA'S MET VERTONINGEN (kans, nog geen plan):");
    for (const p of onbewerkt) lines.push(`- ${short(p.url)} (${p.impressions} vertoningen, ${p.clicks} klikken)`);
  }
  if (gepland.length) {
    lines.push(`\nGEPLANDE / NOG NIET LIVE PAGINA'S (${gepland.length}):`);
    for (const p of gepland.slice(0, 25)) lines.push(`- ${short(p.url)}${p.hasPlan ? " [strategie ligt klaar]" : ""}`);
  }
  return lines.join("\n");
}

// ── De "één volgende zet" per pagina (tegen de 7-stappen-overweldiging) ──
// De kaart kiest zelf, op basis van waar de pagina in de motor staat, de ene
// logische vervolgstap. Zo hoeft Maarten nooit meer "waar begin ik" te denken.
export type NextStep = { label: string; actie: "pijplijn_starten" | "meta_verbeteren" | "alt_teksten" | "open" ; steps?: string[]; zin: string };

export function nextStep(p: PageWork, opp: { level: string; label: string; position: number | null }): NextStep {
  if (!p.live) return { label: "Ontwikkel", actie: "pijplijn_starten", steps: ["blauwdruk", "copy"], zin: "Deze pagina bestaat nog niet. Ontwikkel de blauwdruk en de copy." };
  if (p.hasPlan) {
    const order = ["analyse", "blauwdruk", "copy"] as const;
    const missing = order.find((k) => !p.docs.includes(k));
    if (missing) {
      const label = missing === "analyse" ? "Doe de analyse" : missing === "blauwdruk" ? "Maak de blauwdruk" : "Schrijf de copy";
      const naam = missing === "copy" ? "copy" : missing;
      return { label, actie: "pijplijn_starten", steps: [missing], zin: `Strategie ligt vast, de ${naam} ontbreekt nog.` };
    }
    return { label: "Open in Pagina's", actie: "open", zin: "Alles staat klaar. Bekijk de pagina of het effect." };
  }
  // Live, nog geen strategie.
  if (opp.level !== "none") {
    return { label: "Ontwikkel", actie: "pijplijn_starten", steps: ["analyse", "blauwdruk", "copy"], zin: `Kans (${opp.label}${opp.position != null ? `, positie ${opp.position}` : ""}). De analyse bepaalt wat deze pagina nodig heeft; ontwikkel hem.` };
  }
  return { label: "Ontwikkel", actie: "pijplijn_starten", steps: ["analyse", "blauwdruk", "copy"], zin: "Nog geen strategie voor deze pagina. Ontwikkel hem." };
}

// ── Pijplijn-stand per pagina voor het weekplanning-bord (projectkaarten) ──
// Eén call levert per URL de zeven fases (met handmatige vinkjes die winnen van
// de afgeleide stand), de documentlinks en de volgende stap. Bewust zonder
// GSC-call: de GET van het bord moet snel blijven. Met onlyKeys wordt de
// uitkomst begrensd tot de pagina's die echt in het bord staan (payload).
export type WeekplanPageInfo = {
  url: string; live: boolean;
  // Cijfers voor de kaart. Uit de meting, zodat een getal nog maar op één plek kan
  // staan en twee metingen elkaar niet meer kunnen tegenspreken.
  klikken: number; vertoningen: number; doorgevoerd: boolean | null;
  strategie: boolean; gelieerde: boolean; analyse: boolean; blauwdruk: boolean; copy: boolean;
  bouw: boolean; structured: boolean; structuredStatus: string;
  next: string;
  links: { analyse: string; blauwdruk: string; copy: string; strategie?: string };
};

export async function getWeekplanPages(slug: string, onlyKeys?: Set<string>): Promise<Record<string, WeekplanPageInfo>> {
  // copyLive wordt hier gebruikt (fase "bouw") én binnen getPageWorkStatus (het
  // "doorgevoerd"-oordeel per pagina). Eén gedeelde belofte in plaats van twee
  // aparte aanroepen: dezelfde tabel werd voorheen twee keer per klant bevraagd.
  const copyLivePromise = getCopyLiveAll(slug).catch(() => ({} as Record<string, { doorgevoerd: boolean; percentage: number; gemeten: string | null; meetbaar: boolean }>));
  const [pages, everDone, links, schemaStatus, marks, uitgaand, copyLive, strategieLinks] = await Promise.all([
    getPageWorkStatus(slug, copyLivePromise),
    getStepsEverDoneAll(slug).catch(() => ({} as Record<string, { analyse: boolean; blauwdruk: boolean; copy: boolean }>)),
    getStepLinksAll(slug).catch(() => ({} as Record<string, { analyse: string; blauwdruk: string; copy: string }>)),
    getPageSchemaStatusAll(slug).catch(() => ({} as Record<string, string>)),
    getPhaseMarksAll(slug).catch(() => ({} as Record<string, Partial<Record<string, boolean>>>)),
    getOutgoingClusterCountAll(slug).catch(() => ({} as Record<string, number>)),
    copyLivePromise,
    // Het document van de vastgelegde strategie. Komt langs een andere weg
    // binnen dan analyse/blauwdruk/copy (als stap-werkzaamheid, niet uit de
    // pijplijn), en stond daardoor als enige fase zonder "(link)" op de kaart,
    // terwijl het document er wél was.
    getStrategieLinksAll(slug).catch(() => ({} as Record<string, string>)),
  ]);
  const out: Record<string, WeekplanPageInfo> = {};
  for (const p of pages) {
    const k = urlKey(p.url);
    if (onlyKeys && !onlyKeys.has(k)) continue;
    const done = everDone[k] || { analyse: false, blauwdruk: false, copy: false };
    const m: Partial<Record<string, boolean>> = marks[k] || {};
    const sst = schemaStatus[k] || "idle";
    // Handmatig vinkje wint, beide kanten op; anders de afgeleide stand.
    const fase = (naam: string, afgeleid: boolean) => (typeof m[naam] === "boolean" ? !!m[naam] : afgeleid);
    out[k] = {
      url: p.url, live: p.live,
      klikken: p.clicks, vertoningen: p.impressions, doorgevoerd: p.doorgevoerd,
      strategie: fase("strategie", p.hasPlan),
      // Gelieerde pagina's = advies dat VANUIT deze pagina is verstuurd (uitgaand),
      // niet wat hij ontvangt; anders blijft de fase leeg na een geslaagde Start.
      gelieerde: fase("gelieerde", (uitgaand[k] || 0) > 0),
      analyse: fase("analyse", p.docs.includes("analyse") || done.analyse),
      blauwdruk: fase("blauwdruk", p.docs.includes("blauwdruk") || done.blauwdruk),
      copy: fase("copy", p.docs.includes("copy") || done.copy),
      // Bouw en publicatie werd hier hard op false gezet en wachtte dus altijd op
      // een handmatig vinkje. Nu meet copy-live.ts of de geschreven koppen echt
      // op de pagina staan; een handmatig vinkje wint daar nog steeds van.
      bouw: fase("bouw", copyLive[k]?.doorgevoerd === true),
      structured: fase("structured", sst === "done"),
      structuredStatus: sst,
      next: nextStep(p, { level: "none", label: "", position: null }).label,
      links: { ...(links[k] || { analyse: "", blauwdruk: "", copy: "" }), strategie: strategieLinks[k] || "" },
    };
  }
  return out;
}

// ── Visueel werkplan: pagina's gegroepeerd in bezig / gepland / gedaan ──
// "gedaan" betekent voortaan: de copy staat aantoonbaar op de site. Is de copy wel
// geschreven maar nog niet doorgevoerd, dan is dat een eigen groep ("geschreven").
// Eerder vielen die twee samen, waardoor het werkplan pagina's als klaar toonde die
// nog bij de sitebouwer lagen.
export type WerkplanStatus = "bezig" | "gepland" | "geschreven" | "gedaan";
export type WerkplanItem = {
  url: string; slug: string; live: boolean; status: WerkplanStatus;
  keyword: string; volume: number | null; position: number | null; impressions: number; clicks: number;
  kansLabel: string; kansLevel: string; docs: string[]; next: NextStep;
  doorgevoerd: boolean; copyLivePct: number | null; copyLiveGemeten: string | null; copyLiveMeetbaar: boolean;
  // De documenten zelf, zodat "docs: analyse, copy" geen kale tekst is maar
  // linkjes waar je meteen op kunt klikken (harde opmaakregel: elke verwijzing klikbaar).
  links: { analyse: string; blauwdruk: string; copy: string };
};
export type Werkplan = { bezig: WerkplanItem[]; gepland: WerkplanItem[]; geschreven: WerkplanItem[]; gedaan: WerkplanItem[] };

function shortPath(u: string): string { try { const x = new URL(u); return x.pathname + x.search; } catch { return u; } }

export async function buildWerkplan(slug: string, opts: { fresh?: boolean } = {}): Promise<Werkplan> {
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  const [work, oppRows, copyLive, docLinks] = await Promise.all([
    getPageWorkStatus(slug),
    gscOpps(domain, !!opts.fresh),
    getCopyLiveAll(slug).catch(() => ({} as Record<string, { doorgevoerd: boolean; percentage: number; gemeten: string | null; meetbaar: boolean }>)),
    getStepLinksAll(slug).catch(() => ({} as Record<string, { analyse: string; blauwdruk: string; copy: string }>)),
  ]);
  const oppBy: Record<string, (typeof oppRows)[number]> = Object.fromEntries(oppRows.map((p) => [norm(p.url), p]));
  const items: WerkplanItem[] = [];
  for (const p of work) {
    const o = oppBy[norm(p.url)];
    const opp = o ? opportunity(o.impressions, o.position) : { score: 0, label: "", level: "none" };
    const meting = copyLive[urlKey(p.url)];
    const doorgevoerd = meting?.doorgevoerd === true;
    // Copy klaar = wij hebben hem geschreven. Dat is nog geen "gedaan": pas als de
    // koppen aantoonbaar op de live pagina staan is het werk echt af.
    const copyKlaar = p.docs.includes("copy") || (p.hasPlan && p.docs.length > 0);
    const bezig = !copyKlaar && (p.hasPlan || p.docs.length > 0 || p.hasClusterAdvice);
    let status: WerkplanStatus | null = copyKlaar ? (doorgevoerd ? "gedaan" : "geschreven") : bezig ? "bezig" : null;
    if (!status) {
      if (!p.live) status = "gepland";            // nog te bouwen pagina
      else if (opp.level !== "none") status = "gepland"; // bestaande kans, nog niet gestart
      else continue;                               // live en niets te doen → niet in het werkplan
    }
    items.push({
      url: p.url, slug: shortPath(p.url), live: p.live, status,
      keyword: o?.bestKeyword || "", volume: o?.bestVolume ?? null, position: o?.position ?? null,
      impressions: o?.impressions ?? p.impressions, clicks: o?.clicks ?? p.clicks,
      kansLabel: opp.label, kansLevel: opp.level, docs: p.docs,
      next: nextStep(p, { level: opp.level, label: opp.label, position: o?.position ?? null }),
      doorgevoerd, copyLivePct: meting ? meting.percentage : null, copyLiveGemeten: meting?.gemeten ?? null,
      copyLiveMeetbaar: meting?.meetbaar === true,
      links: docLinks[urlKey(p.url)] || { analyse: "", blauwdruk: "", copy: "" },
    });
  }
  const byKans = (a: WerkplanItem, b: WerkplanItem) => (b.impressions || 0) - (a.impressions || 0);
  const opNaam = (a: WerkplanItem, b: WerkplanItem) => a.slug.localeCompare(b.slug);
  return {
    bezig: items.filter((i) => i.status === "bezig"),
    gepland: items.filter((i) => i.status === "gepland").sort(byKans),
    geschreven: items.filter((i) => i.status === "geschreven").sort(opNaam),
    gedaan: items.filter((i) => i.status === "gedaan").sort(opNaam),
  };
}

// Compacte tekstsamenvatting van het overzicht voor de bird's eye-chatcontext.
// (Gebruikt in Fase B; hier alvast zodat er één bron blijft.)
export function overviewToText(o: Overview): string {
  const s = o.status;
  const lines: string[] = [];
  lines.push(`Werkstatus: ${s.totaal} pagina's, waarvan ${s.heeftPlan} met vastgelegde strategie, ${s.halfPlan} met een vertrekpunt (half plan) en ${s.leeg} nog onbewerkt. Documenten gemaakt: ${s.docsAnalyse} analyses, ${s.docsBlauwdruk} blauwdrukken, ${s.docsCopy} copy.${s.kapot ? ` Let op: ${s.kapot} pagina's geven een foutstatus.` : ""}`);
  if (o.fruit.length) {
    lines.push("Laaghangend fruit (striking distance / quick win):");
    for (const f of o.fruit) lines.push(`- ${f.url} · "${f.bestKeyword}" positie ${f.position}, ${f.impressions} vertoningen (${f.label})`);
  }
  if (o.ctr.length) {
    lines.push("CTR-onderkans (veel vertoningen, weinig klikken):");
    for (const c of o.ctr) lines.push(`- ${c.url} · "${c.keyword}" positie ${c.position}, ~${c.extraClicks} gemiste klikken`);
  }
  if (o.gaten.length) {
    lines.push("Keyword-gaten (nog geen ranking):");
    for (const g of o.gaten) lines.push(`- "${g.keyword}"${g.volume != null ? ` (volume ${g.volume})` : ""}`);
  }
  return lines.join("\n");
}
