// De CTR-machine: vindt per klant de pagina's waar de meta title/description
// de meeste klikwinst kan opleveren (veel vertoningen, te lage CTR voor de
// positie), genereert een perfect voorstel volgens lib/meta-rules.ts, bewaakt
// de status (open -> goedgekeurd -> doorgevoerd) en meet daarna het effect
// (CTR voor/na) uit Search Console.
import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getGscPageOpportunities, getGscDailyForPage } from "./google";
import { cacheGet, cacheSet, getKeywordsOverview } from "./ahrefs";
import { measurePage } from "./page-measure";
import { callClaude, LIGHT_MODEL } from "./anthropic";
import { META_RULES_PROMPT, metaHardIssues, metaPixelInfo, type MetaKind } from "./meta-rules";

let tablesReady = false;
async function ensureTables(): Promise<void> {
  if (tablesReady) return;
  await ensureSchema();
  await sql`
    CREATE TABLE IF NOT EXISTS meta_proposals (
      id SERIAL PRIMARY KEY,
      client_slug TEXT NOT NULL,
      page_url TEXT NOT NULL,
      keyword TEXT,
      cur_title TEXT, cur_desc TEXT,
      prop_title TEXT, prop_desc TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      ctr_before DOUBLE PRECISION, position_before DOUBLE PRECISION, impressions_before INTEGER,
      approved_at TIMESTAMPTZ, live_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (client_slug, page_url)
    )`;
  // Per-veld status: titel en beschrijving kunnen los goedgekeurd/afgewezen worden.
  await sql`ALTER TABLE meta_proposals ADD COLUMN IF NOT EXISTS title_status TEXT NOT NULL DEFAULT 'open'`;
  await sql`ALTER TABLE meta_proposals ADD COLUMN IF NOT EXISTS desc_status TEXT NOT NULL DEFAULT 'open'`;
  // Bestaande rijen die als geheel al goedgekeurd/afgewezen waren: veld-statussen
  // gelijktrekken (eenmalige inhaalslag, raakt alleen oude rijen).
  await sql`UPDATE meta_proposals SET title_status = 'goedgekeurd', desc_status = 'goedgekeurd' WHERE status IN ('goedgekeurd', 'doorgevoerd') AND title_status = 'open' AND desc_status = 'open'`;
  await sql`UPDATE meta_proposals SET title_status = 'afgewezen', desc_status = 'afgewezen' WHERE status = 'afgewezen' AND title_status = 'open' AND desc_status = 'open'`;
  tablesReady = true;
}

// Verwachte CTR per Google-positie (organisch, gemiddelde uit CTR-studies;
// bewust conservatief zodat we geen kansen verzinnen). De kans = het gat
// tussen wat een pagina op die positie hoort te halen en wat hij echt haalt.
export function expectedCtr(position: number): number {
  if (!position || position <= 0) return 0;
  if (position <= 1) return 0.25;
  if (position <= 2) return 0.14;
  if (position <= 3) return 0.09;
  if (position <= 4) return 0.06;
  if (position <= 5) return 0.05;
  if (position <= 6) return 0.04;
  if (position <= 7) return 0.033;
  if (position <= 8) return 0.028;
  if (position <= 9) return 0.024;
  if (position <= 10) return 0.02;
  if (position <= 20) return 0.012;
  return 0.006;
}

export type MetaProposalStatus = "open" | "goedgekeurd" | "doorgevoerd" | "afgewezen";
export type MetaFieldStatus = "open" | "goedgekeurd" | "afgewezen";

export type MetaKansRow = {
  url: string;
  keyword: string;
  volume: number | null;   // maandelijks zoekvolume van het zoekwoord (Ahrefs, gecached)
  clicks: number;
  impressions: number;
  ctr: number;            // huidige CTR in % (bv. 1.8)
  expectedCtr: number;    // verwachte CTR in % voor deze positie
  position: number;
  extraClicks: number;    // geschatte extra klikken per 90 dagen bij verwachte CTR
  // Voorstel-gegevens (null zolang er nog geen voorstel is gegenereerd)
  proposal: {
    curTitle: string; curDesc: string;
    propTitle: string; propDesc: string;
    status: MetaProposalStatus;
    titleStatus: MetaFieldStatus;
    descStatus: MetaFieldStatus;
    liveAt: string | null;
    effect: { ctrBefore: number; ctrAfter: number; clicksBefore: number; clicksAfter: number; daysAfter: number } | null;
  } | null;
};

const norm = (u: string) => (u || "").trim().replace(/\/+$/, "");
const normText = (s: string) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

type DbRow = {
  page_url: string; keyword: string | null;
  cur_title: string | null; cur_desc: string | null;
  prop_title: string | null; prop_desc: string | null;
  status: string; title_status: string; desc_status: string; live_at: string | null;
  ctr_before: number | null; position_before: number | null; impressions_before: number | null;
};

async function proposalsFor(slug: string): Promise<Map<string, DbRow>> {
  await ensureTables();
  const { rows } = await sql`SELECT page_url, keyword, cur_title, cur_desc, prop_title, prop_desc, status, title_status, desc_status, live_at, ctr_before, position_before, impressions_before FROM meta_proposals WHERE client_slug = ${slug}`;
  const map = new Map<string, DbRow>();
  for (const r of rows) map.set(norm(String(r.page_url)), r as unknown as DbRow);
  return map;
}

// ── De kansenlijst ──
// Zelfde GSC-data (en cache) als de Pagina's-tab, maar hier gesorteerd op het
// CTR-gat: vertoningen x (verwachte CTR - echte CTR) = gemiste klikken.
export async function getMetaKansen(slug: string): Promise<MetaKansRow[]> {
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  if (!domain) return [];
  type Opps = Awaited<ReturnType<typeof getGscPageOpportunities>>;
  let rows: Opps | null = await cacheGet<Opps>("gsc_opps", domain, "-", 0.5).catch(() => null);
  if (!rows) {
    rows = await getGscPageOpportunities(domain, 90).catch(() => []);
    if (rows.length) await cacheSet("gsc_opps", domain, "-", rows).catch(() => {});
  }
  const saved = await proposalsFor(slug);

  const out: MetaKansRow[] = [];
  for (const p of rows) {
    if (!p.url) continue;
    const exp = expectedCtr(p.position);
    const gap = Math.max(0, exp - (p.ctr || 0) / 100);
    const extraClicks = Math.round(p.impressions * gap);
    const row = saved.get(norm(p.url));
    // Voldoende vertoningen en een echt gat, of er is al een voorstel voor de pagina.
    if (!row && (p.impressions < 100 || extraClicks < 5)) continue;
    out.push({
      url: p.url,
      keyword: row?.keyword || p.bestKeyword || "",
      volume: null,
      clicks: p.clicks, impressions: p.impressions,
      ctr: p.ctr, expectedCtr: Math.round(exp * 1000) / 10,
      position: p.position,
      extraClicks,
      proposal: row ? {
        curTitle: row.cur_title || "", curDesc: row.cur_desc || "",
        propTitle: row.prop_title || "", propDesc: row.prop_desc || "",
        status: (row.status as MetaProposalStatus) || "open",
        titleStatus: (row.title_status as MetaFieldStatus) || "open",
        descStatus: (row.desc_status as MetaFieldStatus) || "open",
        liveAt: row.live_at ? new Date(row.live_at).toISOString() : null,
        effect: null,
      } : null,
    });
  }
  out.sort((a, b) => b.extraClicks - a.extraClicks);
  const top = out.slice(0, 30);
  // Pagina's met een voorstel horen altijd in de lijst, ook buiten de top-30.
  for (const r of out.slice(30)) if (r.proposal) top.push(r);
  // Maandelijks zoekvolume erbij (Ahrefs, 30 dagen gecached); mag nooit de lijst breken.
  try {
    const vols = await getKeywordsOverview(top.map((r) => r.keyword).filter(Boolean));
    const volMap = new Map(vols.map((v) => [v.keyword, v.volume]));
    for (const r of top) if (r.keyword) r.volume = volMap.get(r.keyword.trim().toLowerCase()) ?? null;
  } catch { /* volume is aanvulling */ }
  return top;
}

// ── Voorstel genereren ──
// Schrijft één title + description volgens de META-regels en het copy-DNA van
// de klant, en corrigeert daarna hard op pixels (het model kan niet meten).
export async function generateMetaProposal(
  slug: string,
  url: string,
  keyword: string,
  base?: { ctr?: number; position?: number; impressions?: number },
): Promise<{ curTitle: string; curDesc: string; propTitle: string; propDesc: string }> {
  await ensureTables();
  const client = await getClientBySlug(slug);
  const m = await measurePage(url, { staticOnly: true }).catch(() => null);
  const curTitle = m?.metaTitle || "";
  const curDesc = m?.metaDescription || "";
  const h1 = m?.h1?.[0] || "";
  const profiel = (client?.seoProfile || "").slice(0, 3500);

  const system = [
    `Je bent de senior SEO-copywriter van bureau Pingwin voor de klant ${client?.name || slug}. Schrijf in het Nederlands, passend bij het bedrijf.`,
    profiel ? `PROFIEL VAN DEZE KLANT (toon en inhoud hierop afstemmen):\n${profiel}` : "",
    META_RULES_PROMPT,
  ].filter(Boolean).join("\n\n");

  const user = [
    `Schrijf de perfecte meta-title en meta-description voor deze pagina, gericht op maximale klikkans in Google (de pagina krijgt nu te weinig klikken voor zijn positie).`,
    `Pagina: ${url}`,
    keyword ? `Primair zoekwoord (title: vooraan; description: 1x letterlijk in de eerste 120 tekens): ${keyword}` : "",
    h1 ? `H1 van de pagina (titel moet hier qua kernwoorden op aansluiten): ${h1}` : "",
    curTitle ? `Huidige meta-title (verbeter deze): ${curTitle}` : "",
    curDesc ? `Huidige meta-description (verbeter deze): ${curDesc}` : "",
    m?.h2?.length ? `Onderwerpen op de pagina (H2's): ${m.h2.slice(0, 8).join(" | ")}` : "",
    `Geef UITSLUITEND deze JSON terug, zonder tekst eromheen:\n{"title": "...", "description": "..."}`,
  ].filter(Boolean).join("\n");

  const raw = await callClaude(system, [{ role: "user", content: user }], 500, { slug, action: "meta_ctr_voorstel" });
  let title = "", desc = "";
  try {
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const first = cleaned.indexOf("{"), last = cleaned.lastIndexOf("}");
    const parsed = JSON.parse(first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned) as { title?: string; description?: string };
    title = (parsed.title || "").trim();
    desc = (parsed.description || "").trim();
  } catch {
    throw new Error("Het voorstel kwam niet goed terug. Probeer het opnieuw.");
  }
  if (!title || !desc) throw new Error("Het voorstel kwam leeg terug. Probeer het opnieuw.");

  title = await fixHardIssues("meta_title", title, keyword, slug);
  desc = await fixHardIssues("meta_description", desc, keyword, slug);

  await sql`
    INSERT INTO meta_proposals (client_slug, page_url, keyword, cur_title, cur_desc, prop_title, prop_desc, status, ctr_before, position_before, impressions_before)
    VALUES (${slug}, ${url}, ${keyword || null}, ${curTitle}, ${curDesc}, ${title}, ${desc}, 'open', ${base?.ctr ?? null}, ${base?.position ?? null}, ${base?.impressions ?? null})
    ON CONFLICT (client_slug, page_url)
    DO UPDATE SET keyword = ${keyword || null}, cur_title = ${curTitle}, cur_desc = ${curDesc},
      prop_title = ${title}, prop_desc = ${desc}, status = 'open', title_status = 'open', desc_status = 'open',
      ctr_before = COALESCE(${base?.ctr ?? null}, meta_proposals.ctr_before),
      position_before = COALESCE(${base?.position ?? null}, meta_proposals.position_before),
      impressions_before = COALESCE(${base?.impressions ?? null}, meta_proposals.impressions_before),
      approved_at = NULL, live_at = NULL, updated_at = now()`;
  return { curTitle, curDesc, propTitle: title, propDesc: desc };
}

// Pixel-correctielus (zelfde principe als in page-doc): alleen bij harde gebreken
// gericht laten herschrijven, maximaal 2 pogingen, de beste kandidaat wint.
async function fixHardIssues(kind: MetaKind, text: string, keyword: string, slug: string): Promise<string> {
  let best = text;
  let issues = metaHardIssues(kind, best);
  const label = kind === "meta_title" ? "meta-title" : "meta-description";
  for (let attempt = 0; issues.length && attempt < 2; attempt++) {
    const user = [
      `Herschrijf deze ${label} zodat hij aan de regels voldoet. Gebreken nu: ${issues.join("; ")}.`,
      keyword ? `Primair zoekwoord (moet ${kind === "meta_title" ? "vooraan blijven" : "erin blijven"}): ${keyword}` : "",
      `Huidige tekst: ${best}`,
      `Geef ALLEEN de nieuwe tekst terug, één regel, geen uitleg of aanhalingstekens.`,
    ].filter(Boolean).join("\n");
    const raw = await callClaude(META_RULES_PROMPT, [{ role: "user", content: user }], 300, { slug, action: "meta_correctie" }, LIGHT_MODEL).catch(() => "");
    const cand = (raw || "").trim().split("\n")[0].replace(/^["']|["']$/g, "").trim();
    if (!cand) break;
    const candIssues = metaHardIssues(kind, cand);
    const smaller = metaPixelInfo(kind, cand).px < metaPixelInfo(kind, best).px;
    if (candIssues.length < issues.length || (candIssues.length === issues.length && smaller)) {
      best = cand;
      issues = candIssues;
    }
  }
  return best;
}

// ── Bewerken en status ──
export async function updateMetaProposal(slug: string, url: string, fields: { propTitle?: string; propDesc?: string; status?: MetaProposalStatus; titleStatus?: MetaFieldStatus; descStatus?: MetaFieldStatus }): Promise<void> {
  await ensureTables();
  if (fields.propTitle !== undefined) await sql`UPDATE meta_proposals SET prop_title = ${fields.propTitle}, title_status = 'open', updated_at = now() WHERE client_slug = ${slug} AND page_url = ${url}`;
  if (fields.propDesc !== undefined) await sql`UPDATE meta_proposals SET prop_desc = ${fields.propDesc}, desc_status = 'open', updated_at = now() WHERE client_slug = ${slug} AND page_url = ${url}`;
  if (fields.titleStatus) await sql`UPDATE meta_proposals SET title_status = ${fields.titleStatus}, updated_at = now() WHERE client_slug = ${slug} AND page_url = ${url}`;
  if (fields.descStatus) await sql`UPDATE meta_proposals SET desc_status = ${fields.descStatus}, updated_at = now() WHERE client_slug = ${slug} AND page_url = ${url}`;
  if (fields.titleStatus || fields.descStatus || fields.propTitle !== undefined || fields.propDesc !== undefined) await recomputeStatus(slug, url);
  if (fields.status) {
    await sql`UPDATE meta_proposals SET status = ${fields.status},
      title_status = CASE WHEN ${fields.status} IN ('goedgekeurd', 'afgewezen') THEN ${fields.status} ELSE title_status END,
      desc_status = CASE WHEN ${fields.status} IN ('goedgekeurd', 'afgewezen') THEN ${fields.status} ELSE desc_status END,
      approved_at = CASE WHEN ${fields.status} = 'goedgekeurd' THEN now() ELSE approved_at END,
      live_at = CASE WHEN ${fields.status} = 'doorgevoerd' AND live_at IS NULL THEN now() ELSE live_at END,
      updated_at = now()
      WHERE client_slug = ${slug} AND page_url = ${url}`;
  }
}

// De totaalstatus volgt uit de twee veld-statussen: goedgekeurd zodra minstens
// één veld goedgekeurd is en niets meer open staat; afgewezen als beide velden
// afgewezen zijn; anders open. 'doorgevoerd' (live) blijft altijd staan.
async function recomputeStatus(slug: string, url: string): Promise<void> {
  await sql`
    UPDATE meta_proposals SET
      status = CASE
        WHEN status = 'doorgevoerd' THEN 'doorgevoerd'
        WHEN title_status = 'afgewezen' AND desc_status = 'afgewezen' THEN 'afgewezen'
        WHEN (title_status = 'goedgekeurd' OR desc_status = 'goedgekeurd') AND title_status <> 'open' AND desc_status <> 'open' THEN 'goedgekeurd'
        ELSE 'open'
      END,
      approved_at = CASE
        WHEN status <> 'doorgevoerd' AND (title_status = 'goedgekeurd' OR desc_status = 'goedgekeurd') AND title_status <> 'open' AND desc_status <> 'open' AND approved_at IS NULL THEN now()
        ELSE approved_at
      END,
      updated_at = now()
    WHERE client_slug = ${slug} AND page_url = ${url}`;
}

// ── Eén veld opnieuw laten schrijven (titel óf beschrijving) ──
// Houdt rekening met het andere veld (geen letterlijke herhaling) en zet alleen
// het herschreven veld terug op 'open'.
export async function regenerateMetaField(slug: string, url: string, field: "title" | "desc"): Promise<{ propTitle: string; propDesc: string }> {
  await ensureTables();
  const { rows } = await sql`SELECT keyword, prop_title, prop_desc, cur_title, cur_desc FROM meta_proposals WHERE client_slug = ${slug} AND page_url = ${url} LIMIT 1`;
  const row = rows[0];
  if (!row) throw new Error("Er is nog geen voorstel voor deze pagina; genereer eerst een volledig voorstel.");
  const keyword = (row.keyword as string) || "";
  const client = await getClientBySlug(slug);
  const m = await measurePage(url, { staticOnly: true }).catch(() => null);
  const h1 = m?.h1?.[0] || "";
  const profiel = (client?.seoProfile || "").slice(0, 3500);
  const kind: MetaKind = field === "title" ? "meta_title" : "meta_description";
  const label = field === "title" ? "meta-title" : "meta-description";
  const other = field === "title" ? (row.prop_desc as string) : (row.prop_title as string);
  const current = field === "title" ? (row.prop_title as string) : (row.prop_desc as string);

  const system = [
    `Je bent de senior SEO-copywriter van bureau Pingwin voor de klant ${client?.name || slug}. Schrijf in het Nederlands, passend bij het bedrijf.`,
    profiel ? `PROFIEL VAN DEZE KLANT (toon en inhoud hierop afstemmen):\n${profiel}` : "",
    META_RULES_PROMPT,
  ].filter(Boolean).join("\n\n");
  const user = [
    `Schrijf een NIEUWE, betere ${label} voor deze pagina (een duidelijk ander, sterker alternatief dan de vorige versie).`,
    `Pagina: ${url}`,
    keyword ? `Primair zoekwoord (${field === "title" ? "vooraan in de titel" : "1x letterlijk in de eerste 120 tekens"}): ${keyword}` : "",
    h1 ? `H1 van de pagina: ${h1}` : "",
    current ? `Vorige versie (kom met iets beters, niet hetzelfde): ${current}` : "",
    other ? `De ${field === "title" ? "meta-description" : "meta-title"} die erbij hoort (niet letterlijk herhalen): ${other}` : "",
    `Geef ALLEEN de nieuwe tekst terug, één regel, geen uitleg of aanhalingstekens.`,
  ].filter(Boolean).join("\n");

  const raw = await callClaude(system, [{ role: "user", content: user }], 300, { slug, action: "meta_ctr_voorstel" });
  let text = (raw || "").trim().split("\n")[0].replace(/^["']|["']$/g, "").trim();
  if (!text) throw new Error("Het voorstel kwam leeg terug. Probeer het opnieuw.");
  text = await fixHardIssues(kind, text, keyword, slug);

  if (field === "title") await sql`UPDATE meta_proposals SET prop_title = ${text}, title_status = 'open', updated_at = now() WHERE client_slug = ${slug} AND page_url = ${url}`;
  else await sql`UPDATE meta_proposals SET prop_desc = ${text}, desc_status = 'open', updated_at = now() WHERE client_slug = ${slug} AND page_url = ${url}`;
  await recomputeStatus(slug, url);
  return { propTitle: field === "title" ? text : (row.prop_title as string) || "", propDesc: field === "desc" ? text : (row.prop_desc as string) || "" };
}

// ── Live-detectie ──
// Controleert voor goedgekeurde voorstellen of de nieuwe meta inmiddels op de
// site staat (title óf description komt overeen). Zo ja: status 'doorgevoerd'
// met het live-moment; vanaf dan telt de effectmeting.
export async function checkLiveProposals(slug: string, rows: MetaKansRow[]): Promise<void> {
  const pending = rows.filter((r) => r.proposal?.status === "goedgekeurd").slice(0, 8);
  if (!pending.length) return;
  await Promise.all(pending.map(async (r) => {
    const m = await measurePage(r.url, { staticOnly: true }).catch(() => null);
    if (!m?.ok || !r.proposal) return;
    // Alleen goedgekeurde velden tellen mee voor de live-detectie (een afgewezen
    // titel die toevallig overeenkomt mag de meting niet starten).
    const titleLive = r.proposal.titleStatus === "goedgekeurd" && normText(m.metaTitle) === normText(r.proposal.propTitle);
    const descLive = r.proposal.descStatus === "goedgekeurd" && normText(m.metaDescription) === normText(r.proposal.propDesc);
    if (titleLive || descLive) {
      await updateMetaProposal(slug, r.url, { status: "doorgevoerd" });
      r.proposal.status = "doorgevoerd";
      r.proposal.liveAt = new Date().toISOString();
    }
  }));
}

// ── Effectmeting ──
// CTR voor/na het live-moment uit Search Console (dagdata, 3 dagen rond het
// moment weggelaten). Gecached per halve dag zodat de lijst snel blijft.
export async function addCtrEffects(slug: string, rows: MetaKansRow[]): Promise<void> {
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  if (!domain) return;
  const live = rows.filter((r) => r.proposal?.status === "doorgevoerd" && r.proposal.liveAt).slice(0, 12);
  await Promise.all(live.map(async (r) => {
    if (!r.proposal?.liveAt) return;
    type Fx = NonNullable<NonNullable<MetaKansRow["proposal"]>["effect"]>;
    const cacheKey = `${norm(r.url)}|${r.proposal.liveAt.slice(0, 10)}`;
    const cached = await cacheGet<Fx>("meta_ctr_fx", domain, cacheKey, 0.5).catch(() => null);
    if (cached) { r.proposal.effect = cached; return; }
    const liveMs = new Date(r.proposal.liveAt).getTime();
    const DAY = 86400000, TRIM = 3 * DAY;
    const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    const beforeDays = await getGscDailyForPage(domain, r.url, day(liveMs - TRIM - 28 * DAY), day(liveMs - TRIM)).catch(() => []);
    const afterDays = await getGscDailyForPage(domain, r.url, day(liveMs + TRIM), day(Date.now())).catch(() => []);
    const sum = (arr: { clicks: number; impressions: number }[]) => arr.reduce((a, d) => ({ clicks: a.clicks + d.clicks, impressions: a.impressions + d.impressions }), { clicks: 0, impressions: 0 });
    const b = sum(beforeDays), a = sum(afterDays);
    if (!b.impressions || !a.impressions) return; // nog te vroeg om effect te tonen
    const fx: Fx = {
      ctrBefore: Math.round((b.clicks / b.impressions) * 1000) / 10,
      ctrAfter: Math.round((a.clicks / a.impressions) * 1000) / 10,
      clicksBefore: b.clicks, clicksAfter: a.clicks,
      daysAfter: afterDays.length,
    };
    r.proposal.effect = fx;
    await cacheSet("meta_ctr_fx", domain, cacheKey, fx).catch(() => {});
  }));
}
