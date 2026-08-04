import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { urlKey } from "./url-key";
import { getOrgData, type OrgData } from "./org-data";
import { getPagePlan, getPageDriveFolder } from "./site-urls";
import { measurePage } from "./page-measure";
import { getGscForPage } from "./google";
import { callClaude } from "./anthropic";
import { schemaDocSpec } from "./page-doc";
import { buildPingwinDoc } from "./pingwin-docx";
import { uploadDocx, uploadPlainFile } from "./drive";
import { getTasks, deleteTasksByIds, appendTasks } from "./tasks";

// ═══════════════════════════════════════════════════════════
// STAP 7: STRUCTURED DATA PER PAGINA
// ═══════════════════════════════════════════════════════════
// Analyseert per pagina welke schema.org-markup er hoort te staan (afgestemd op
// het bedrijfstype uit de bedrijfsgegevens), levert een leesbaar advies + een
// kant-en-klare JSON-LD (@graph met @id-verwijzingen naar het site-brede blok),
// en zet dat bij "Overnemen" om in een kort document + losse .json-file + taak.
// Kennisbasis van de prompt: onderzoek 2026-07 (o.a. FAQ-rich-results gestopt
// per mei 2026; entity-graph-conventie; merchant-listing-vereisten; YMYL).
// ═══════════════════════════════════════════════════════════

export const SCHEMA_KNOWLEDGE_DATE = "2026-07-09"; // voor de maandelijkse check-up (batch G)

export type PageSchemaState = {
  status: "idle" | "running" | "done" | "error";
  result: string;    // markdown-advies voor de kaart
  jsonld: string;    // de kant-en-klare JSON-LD (string, pretty-printed)
  warnings: string[];
  error: string;
  updatedAt: string | null;
  inventory?: { plugin?: string; pluginLabel?: string; types?: string[] };
};

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_page_schema (
      client_slug TEXT NOT NULL,
      url         TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'idle',
      result      TEXT NOT NULL DEFAULT '',
      jsonld      TEXT NOT NULL DEFAULT '',
      warnings    JSONB NOT NULL DEFAULT '[]',
      error       TEXT NOT NULL DEFAULT '',
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, url)
    )`;
  // Momentopname van de plugin-schema op het moment van de analyse, zodat de
  // periodieke bewaking kan zien of de plugin sindsdien iets anders levert.
  await sql`ALTER TABLE client_page_schema ADD COLUMN IF NOT EXISTS plugin_types JSONB NOT NULL DEFAULT '[]'`;
  // Inventarisatie (in code vastgesteld): welke plugin levert al schema en welke
  // types/@id's staan er, zodat de kaart en de prompt op harde feiten draaien.
  await sql`ALTER TABLE client_page_schema ADD COLUMN IF NOT EXISTS inventory JSONB NOT NULL DEFAULT '{}'`;
}

export async function getPageSchema(slug: string, url: string): Promise<PageSchemaState> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT * FROM client_page_schema WHERE client_slug = ${slug} AND url = ${url} LIMIT 1`;
  const r = rows[0];
  if (!r) return { status: "idle", result: "", jsonld: "", warnings: [], error: "", updatedAt: null };
  let warnings: string[] = [];
  try { const w = typeof r.warnings === "string" ? JSON.parse(r.warnings) : r.warnings; if (Array.isArray(w)) warnings = w.map(String); } catch { /* leeg */ }
  return {
    status: (r.status as PageSchemaState["status"]) || "idle",
    result: (r.result as string) || "",
    jsonld: (r.jsonld as string) || "",
    warnings,
    error: (r.error as string) || "",
    updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
    inventory: (typeof r.inventory === "object" && r.inventory) ? (r.inventory as PageSchemaState["inventory"]) : undefined,
  };
}

// Schema-status voor alle pagina's van een klant in één query (projectkaarten).
export async function getPageSchemaStatusAll(slug: string): Promise<Record<string, string>> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT url, status FROM client_page_schema WHERE client_slug = ${slug}`;
  const out: Record<string, string> = {};
  for (const r of rows) out[urlKey(String(r.url))] = String(r.status || "idle");
  return out;
}

async function setState(slug: string, url: string, status: string, patch: { result?: string; jsonld?: string; warnings?: string[]; error?: string; pluginTypes?: string[]; inventory?: unknown } = {}): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`
    INSERT INTO client_page_schema (client_slug, url, status, result, jsonld, warnings, error, plugin_types, inventory, updated_at)
    VALUES (${slug}, ${url}, ${status}, ${patch.result || ""}, ${patch.jsonld || ""}, ${JSON.stringify(patch.warnings || [])}, ${patch.error || ""}, ${JSON.stringify(patch.pluginTypes || [])}, ${JSON.stringify(patch.inventory || {})}, now())
    ON CONFLICT (client_slug, url) DO UPDATE SET
      status = ${status},
      result = COALESCE(NULLIF(${patch.result || ""}, ''), client_page_schema.result),
      jsonld = COALESCE(NULLIF(${patch.jsonld || ""}, ''), client_page_schema.jsonld),
      warnings = ${JSON.stringify(patch.warnings || [])},
      error = ${patch.error || ""},
      plugin_types = CASE WHEN ${JSON.stringify(patch.pluginTypes || [])}::jsonb <> '[]'::jsonb THEN ${JSON.stringify(patch.pluginTypes || [])}::jsonb ELSE client_page_schema.plugin_types END,
      inventory = CASE WHEN ${JSON.stringify(patch.inventory || {})}::jsonb <> '{}'::jsonb THEN ${JSON.stringify(patch.inventory || {})}::jsonb ELSE client_page_schema.inventory END,
      updated_at = now()`;
}

export async function markPageSchemaRunning(slug: string, url: string): Promise<void> {
  await setState(slug, url, "running");
}

// Leesbare samenvatting van de bedrijfsgegevens voor de prompt.
function orgToText(org: OrgData, locked: boolean): string {
  const lines: string[] = [];
  const add = (label: string, v: string) => { if ((v || "").trim()) lines.push(`${label}: ${v.trim()}`); };
  add("Bedrijfsnaam", org.bedrijfsnaam);
  add("Bedrijfstype", org.bedrijfstype);
  add("Rechtsvorm", org.rechtsvorm); add("KVK", org.kvk); add("BTW-id", org.btw);
  add("Telefoon", org.telefoon); add("E-mail", org.email);
  if (org.geenBezoekadres) lines.push("Bezoekadres: GEEN (aan-huis/ambulant bedrijf)");
  else add("Adres", [org.straat, org.postcode, org.plaats].filter(Boolean).join(", "));
  add("Openingstijden", org.openingstijden);
  if (org.vestigingen?.length) {
    lines.push("Vestigingen (elk een eigen locatie-node, gekoppeld aan het bedrijf):");
    for (const v of org.vestigingen) {
      const adres = [v.straat, [v.postcode, v.plaats].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      lines.push(`- ${v.naam || v.plaats || "vestiging"}${adres ? `: ${adres}` : ""}${v.telefoon ? `, tel ${v.telefoon}` : ""}${v.openingstijden ? `, open: ${v.openingstijden}` : ""}`);
    }
  }
  add("Logo-URL", org.logoUrl); add("Prijsindicatie", org.priceRange); add("Oprichtingsjaar", org.oprichtingsjaar);
  if (org.sameAs.length) lines.push(`Profielen (sameAs): ${org.sameAs.join(", ")}`);
  if (org.areaServed.length) lines.push(`Werkgebied (areaServed): ${org.areaServed.join(", ")}`);
  add("Reviews-URL", org.reviewUrl);
  if (org.reviewGemiddelde && org.reviewAantal) lines.push(`Reviews (zichtbaar): gemiddeld ${org.reviewGemiddelde} uit ${org.reviewAantal} beoordelingen`);
  if (org.artsen.length) {
    lines.push("Artsen/behandelaren (voor Physician-nodes met credentials; koppel de arts(en) die bij deze pagina horen):");
    for (const a of org.artsen) lines.push(`- ${a.naam}${a.functie ? `, ${a.functie}` : ""}${a.specialisatie ? ` (${a.specialisatie})` : ""}${a.big ? `, BIG: ${a.big}` : ""}${a.profielUrl ? `, profiel: ${a.profielUrl}` : ""}${a.fotoUrl ? `, foto: ${a.fotoUrl}` : ""}`);
  }
  if (org.merken.length) lines.push(`Merken (webshop): ${org.merken.join(", ")}`);
  if (org.retourUrl || org.retourTermijn) lines.push(`Retourbeleid: ${[org.retourTermijn, org.retourUrl].filter(Boolean).join(", ")}`);
  add("Verzendinformatie", org.verzendInfo);
  if (org.diensten.length) {
    lines.push("Diensten (voor Service-nodes):");
    for (const d of org.diensten) lines.push(`- ${d.naam}${d.omschrijving ? `: ${d.omschrijving}` : ""}`);
  }
  lines.push(locked ? "STATUS GEGEVENS: door de klant/Pingwin bevestigd en vergrendeld (betrouwbare bron)." : "STATUS GEGEVENS: NOG NIET bevestigd; wees terughoudend met onzekere velden.");
  return lines.join("\n") || "(geen bedrijfsgegevens ingevuld)";
}

const SCHEMA_SYSTEM = `Je bent een senior technisch SEO-specialist bij bureau Pingwin, expert in schema.org structured data (kennis actueel t/m juli 2026). Je adviseert de structured data voor ÉÉN pagina en levert de kant-en-klare JSON-LD.

ACTUELE SPELREGELS (2026, wijkt af van oudere kennis):
- FAQ-rich-results zijn per mei 2026 volledig gestopt; HowTo al sinds 2023. FAQPage-markup mag als entity-signaal, maar beloof er NOOIT een rich result bij en geef het lage prioriteit. SearchAction/sitelinks-searchbox niet meer opnemen.
- Werk ALTIJD als één samenhangende entity graph: één "@graph" waarin de pagina-nodes via "@id" verwijzen naar het site-brede identiteitsblok. Conventies voor @id's: "{site}/#organization", "{site}/#website", "{paginaUrl}#webpage", "{paginaUrl}#breadcrumb" en per hoofdentiteit "{paginaUrl}#<type>".
- Het site-brede blok (Organization/LocalBusiness + WebSite) staat op de homepage; op deze pagina neem je een korte referentie-node op (alleen "@id" + "@type" + naam) in plaats van alle organisatiegegevens te herhalen.
- Per bedrijfstype: kliniek/zorg = MedicalClinic/Physician (met credentials) en MedicalProcedure/MedicalWebPage waar passend (YMYL: uitsluitend feitelijk, alles moet zichtbaar op de pagina staan); webshop-productpagina = Product met offers (price, priceCurrency, availability) volgens merchant-listing-vereisten, NOOIT Product op een niet-productpagina; dienstverlener/lead-gen = Service met provider (@id) en areaServed; lokaal bedrijf = LocalBusiness-details; blog/informatief = Article met author (Person) en datums.
- Elke pagina krijgt sowieso: WebPage (met isPartOf naar #website en about/mainEntity waar passend) + BreadcrumbList.
- HARDE REGEL (penalty-risico, aangescherpt maart 2026): neem UITSLUITEND informatie op die zichtbaar op de pagina staat of uit de bevestigde bedrijfsgegevens komt. NOOIT ratings, reviews, prijzen, openingstijden of adressen verzinnen. Twijfel = weglaten.
- Staat er al plugin-schema op de pagina (Yoast/RankMath/AIOSEO), dan is het advies AANVULLEN zonder te dupliceren: benoem welke types de plugin al levert en lever alleen de ontbrekende nodes, met @id's die niet botsen. Eén instantie per type per pagina.
- AI-zoek eerlijk framen: structured data is geen vereiste voor AI Overviews (zegt Google zelf), maar pagina's met een rijke, kloppende entity graph worden aantoonbaar vaker geciteerd door AI-assistenten; de zichtbare content blijft het belangrijkst.

GEEF UITSLUITEND GELDIGE JSON, exact dit formaat:
{"paginatype": "korte typering (bijv. dienstpagina, behandelpagina, blogartikel, productpagina)", "advies_md": "markdown-advies", "jsonld": { ...het volledige JSON-LD-object met @context en @graph... }, "waarschuwingen": ["..."]}

SCHRIJFSTIJL (cruciaal): de lezer is een SEO-specialist ZONDER schema-kennis. Elke technische term die je gebruikt leg je in dezelfde zin in gewone taal uit, of je laat hem weg. Zeg nooit kaal "SearchAction wordt niet herhaald conform de spelregels"; zeg "de plugin plaatst code voor een zoekbalkje onder het Google-resultaat (SearchAction); Google is daarmee gestopt, dus wij laten dat bewust weg". Namen als @id, node en entity graph mag je gebruiken, maar alleen met zo'n korte uitleg erbij.

Eisen aan advies_md (kort en leesbaar):
- "## Wat we op deze pagina toevoegen" met per onderdeel één bullet in gewone taal: wat het is, wat het Google/AI vertelt, en wat het de klant oplevert.
- "## Waarom dit belangrijk is" (2-4 zinnen, incl. de eerlijke AI-framing, zonder jargon).
- "## Let op" alleen bij echte aandachtspunten, elk geschreven als: wat we zagen, wat dat betekent, wat de vervolgactie is en wie hem doet.
Eisen aan jsonld: één object met "@context":"https://schema.org" en "@graph":[...]; geldige, complete JSON; alleen onderbouwde properties. Staat de volledige plugin-JSON-LD hierboven, gebruik dan de ECHTE @id's daaruit voor verwijzingen en herhaal niets wat de plugin al levert; gok nooit en vraag de lezer nooit om zelf @id's te controleren.
Eisen aan waarschuwingen: maximaal 5, elk één begrijpelijke zin volgens het vaste patroon "wat we zagen: wat dat betekent: wat je nu doet". Voorbeelden van de juiste toon: "De plugin (bijv. Yoast) levert al de basis-schema van deze pagina; onze code vult alleen de medische laag aan en botst daar niet mee." of "Van 5 behandelaren missen het BIG-nummer en de profielpagina; vul die aan op het Bedrijfsgegevens-formulier (Klant-tabblad), dan koppelen we ze bij de volgende analyse automatisch mee." Verwijs bij ontbrekende gegevens ALTIJD naar het Bedrijfsgegevens-formulier als de plek om ze aan te vullen. Geen em-dash of en-dash; gebruik komma of dubbele punt. Geen emoji.`;

export async function runPageSchema(slug: string, url: string): Promise<void> {
  try {
    const client = await getClientBySlug(slug);
    if (!client) throw new Error("Klant niet gevonden.");
    const [org, plan, measured, gsc, allTasks, rawLd, kennis] = await Promise.all([
      getOrgData(slug),
      getPagePlan(slug, url).catch(() => ""),
      measurePage(url, { staticOnly: true }).catch(() => null),
      getGscForPage(client.domain || "", url, 90).catch(() => []),
      getTasks(slug).catch(() => []),
      fetchRawJsonLd(url),
      import("./schema-knowledge").then((m) => m.knowledgeText(slug)).catch(() => ""),
    ]);
    // Gouden regel: markup moet matchen met de zichtbare content. Staat er nog een
    // niet-afgeronde copy-taak voor deze pagina, dan komen de nieuwe teksten (met
    // FAQ's) waarschijnlijk nog; stap 7 hoort daarna als sluitstuk.
    const openCopy = allTasks.some((t) => t.stepKind === "copy_doc" && (t.pageUrl || "") === url && (t.status || "").toLowerCase() !== "klaar");

    // Inventarisatie in code: welke plugin levert al schema, welke types en @id's.
    const { analyzeExistingSchema, validateJsonLd, normalizePaginatype, missingExpected } = await import("./schema-check");
    const inventory = analyzeExistingSchema(rawLd);
    // Drift-bewaking: levert de plugin nu iets anders dan bij de vorige analyse?
    const vorige = await getPageSchema(slug, url).catch(() => null);
    const vorigeTypes = new Set((vorige?.inventory?.types || []) as string[]);
    const drift = vorige?.updatedAt && vorigeTypes.size
      ? inventory.types.filter((t) => !vorigeTypes.has(t)).concat([...vorigeTypes].filter((t) => !inventory.types.includes(t)))
      : [];

    const site = (() => { try { return new URL(url).origin; } catch { return ""; } })();
    const pageText = measured
      ? [
          `Status ${measured.status}. Title: ${measured.metaTitle}`,
          `Meta-description: ${measured.metaDescription}`,
          `H1: ${measured.h1.join(" | ")}`,
          `H2: ${measured.h2.join(" | ")}`,
          `H3: ${measured.h3.slice(0, 20).join(" | ")}`,
          `Woorden: ${measured.wordCount}. FAQ op de pagina: ${measured.faqDetected ? `ja (${measured.faqCount} vragen)` : "nee"}.`,
          `BESTAANDE JSON-LD-TYPES OP DE PAGINA (bijv. van een plugin): ${measured.schemaTypes.join(", ") || "geen"}`,
        ].join("\n")
      : "(pagina kon niet gemeten worden)";

    const user = [
      `PAGINA: ${url}`,
      `SITE: ${site}`,
      `\nBEDRIJFSGEGEVENS:\n${orgToText(org.data, org.locked)}`,
      kennis ? `\nKENNISBANK (door Maarten bevestigde extra gegevens; net zo betrouwbaar als de bedrijfsgegevens, gebruik ze waar relevant):\n${kennis}` : "",
      plan ? `\nPLAN VOOR DEZE PAGINA:\n${String(plan).replace(/<[^>]*>/g, " ").slice(0, 2500)}` : "",
      `\nPAGINA-METING:\n${pageText}`,
      `\nPLUGIN-DETECTIE (in code vastgesteld, HARD FEIT): ${inventory.plugin === "geen" ? "er staat nog geen structured data op deze pagina." : `${inventory.pluginLabel} levert al schema met types: ${inventory.types.join(", ") || "onbekend"}. Deze types NIET opnieuw definiëren; alleen aanvullen en verwijzen met de bestaande @id's.`}`,
      rawLd.length ? `\nVOLLEDIGE BESTAANDE JSON-LD OP DE PAGINA (plugin-schema; sluit hier EXACT op aan, gebruik de echte @id's):\n${rawLd.join("\n---\n").slice(0, 24000)}` : "",
      gsc.length ? `\nTOP-ZOEKWOORDEN (Search Console, 90d):\n${gsc.slice(0, 12).map((k) => `${k.keyword} (pos ${k.position})`).join("; ")}` : "",
      client.seoProfile ? `\nKLANTPROFIEL (samenvatting):\n${client.seoProfile.slice(0, 1500)}` : "",
    ].filter(Boolean).join("\n");

    const raw = await callClaude(SCHEMA_SYSTEM, [{ role: "user", content: user }], 6000, { slug, action: "page_schema" });
    let parsed = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim()) as { paginatype?: string; advies_md?: string; jsonld?: unknown; waarschuwingen?: unknown };
    if (!parsed.jsonld || typeof parsed.advies_md !== "string") throw new Error("Het AI-antwoord kwam onvolledig terug; probeer het opnieuw.");

    // Validatie in code + maximaal één herstelronde: fouten gaan met naam en
    // toenaam terug de motor in; wat daarna nog fout is wordt een zichtbare waarschuwing.
    const bevestigd = `${orgToText(org.data, org.locked)}\n${kennis || ""}`;
    const valCtx = { bestaand: inventory, paginaTekst: pageText, bevestigd };
    let check = validateJsonLd(parsed.jsonld, valCtx);
    if (check.errors.length) {
      try {
        const herstel = await callClaude(SCHEMA_SYSTEM, [
          { role: "user", content: user },
          { role: "assistant", content: raw },
          { role: "user", content: `Onze automatische controle vond deze FOUTEN in je JSON-LD; herstel ze allemaal en geef het volledige antwoord opnieuw in exact hetzelfde JSON-formaat:\n${check.errors.map((e) => `- ${e}`).join("\n")}` },
        ], 6000, { slug, action: "page_schema_herstel" });
        const hersteld = JSON.parse(herstel.replace(/```json/gi, "").replace(/```/g, "").trim()) as typeof parsed;
        if (hersteld.jsonld && typeof hersteld.advies_md === "string") {
          parsed = hersteld;
          check = validateJsonLd(parsed.jsonld, valCtx);
        }
      } catch { /* herstelronde is een extra; de fouten blijven zichtbaar */ }
    }

    const jsonld = JSON.stringify(parsed.jsonld, null, 2);
    const warnings = Array.isArray(parsed.waarschuwingen) ? parsed.waarschuwingen.map(String).filter(Boolean) : [];
    warnings.push(...check.warnings);
    for (const e of check.errors) warnings.unshift(`CONTROLE: ${e}`);
    // Routing-controle: welke verwachte schema-types voor dit soort bedrijf en
    // deze soort pagina ontbreken er nog (bestaand + nieuw samen)?
    const paginatype = normalizePaginatype(parsed.paginatype || "");
    const mist = missingExpected(org.data.bedrijfstype || "", paginatype, inventory.types, parsed.jsonld);
    if (mist.length) warnings.push(`Voor een ${paginatype}-pagina van dit bedrijfstype hoort er ook ${mist.join(" en ")} te staan; dat zit nog niet in het bestaande of nieuwe schema.`);
    if (drift.length) warnings.unshift(`De plugin levert nu andere schema-types dan bij de vorige analyse (verschil: ${drift.join(", ")}); controleer of eerdere aanvullingen nog kloppen.`);
    if (openCopy) warnings.unshift("Er staat nog een niet-afgeronde copy-taak voor deze pagina: de nieuwe teksten (met FAQ's) staan waarschijnlijk nog niet live. Deze analyse is gebaseerd op de huidige pagina; draai stap 7 opnieuw zodra de nieuwe copy live staat.");
    const header = `**Paginatype:** ${parsed.paginatype || paginatype}\n**Bestaand schema:** ${inventory.plugin === "geen" ? "geen" : `${inventory.pluginLabel} (${inventory.types.join(", ") || "types onbekend"})`}\n\n`;
    await setState(slug, url, "done", { result: header + (parsed.advies_md || "").trim(), jsonld, warnings, pluginTypes: measured?.schemaTypes || [], inventory });
  } catch (e) {
    await setState(slug, url, "error", { error: (e as Error).message || "Analyse mislukt." }).catch(() => { /* status is hulpinfo */ });
  }
}

// Leest de volledige bestaande JSON-LD-blokken van de pagina (plugin-schema),
// zodat de analyse exact kan aansluiten op de echte @id's en nodes in plaats van
// aannames te doen ("plugin-@id onbekend").
export async function fetchRawJsonLd(url: string): Promise<string[]> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 15000);
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; PingwinDashboard)" }, signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return [];
    const html = await res.text();
    const out: string[] = [];
    const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) { const x = (m[1] || "").trim(); if (x) out.push(x.slice(0, 9000)); }
    return out.slice(0, 6);
  } catch { return []; }
}

function pagePath(u: string): string { try { return new URL(u).pathname || u; } catch { return u; } }
function safeName(s: string): string { return (s || "pagina").replace(/[^\p{L}\p{N} _-]+/gu, "").replace(/\s+/g, "-").slice(0, 60) || "pagina"; }

// "Overnemen": kort combi-document (klant + developer) + losse .json-file + één taak.
export async function applyPageSchema(slug: string, url: string): Promise<{ ok: boolean; error?: string; taskId?: number; docLink?: string; jsonLink?: string }> {
  const state = await getPageSchema(slug, url);
  if (state.status !== "done" || !state.jsonld) return { ok: false, error: "Draai eerst de structured data-analyse." };
  const folder = await getPageDriveFolder(slug, url).catch(() => null);
  if (!folder) return { ok: false, error: "Kies eerst een Drive-map voor deze pagina (bij stap 4, 'Map wijzigen')." };

  // 1. Kort leesbaar document (met de JSON als referentie-codeblok achterin).
  const { spec, title } = await schemaDocSpec(slug, url, state.result, state.warnings);
  spec.sections.push({
    heading: "De structured data (ter referentie)",
    blocks: [
      { type: "highlight", text: "Kopieer de code NIET uit dit document: gebruik het losse .json-bestand in dezelfde Drive-map (staat ook in de taak). Dat bestand is exact en zonder opmaak." },
      { type: "code", text: state.jsonld },
    ],
  });
  const buffer = await buildPingwinDoc(spec);
  const pageName = safeName(pagePath(url).replace(/\//g, " ").trim() || "homepage");
  const doc = await uploadDocx(folder.folderId, `Structured-data-${pageName}.docx`, buffer);

  // 2. Losse .json-file (de echte copy-paste-bron voor de developer).
  const json = await uploadPlainFile(folder.folderId, `schema-${pageName}.json`, state.jsonld, "application/json");

  // 3. Eén taak; bestaande structured-data-taak voor deze pagina vervangen (geen dubbels).
  const existing = await getTasks(slug).catch(() => []);
  const dupes = existing.filter((t) => t.stepKind === "structured_data" && (t.pageUrl || "") === url && typeof t.id === "number").map((t) => t.id as number);
  if (dupes.length) await deleteTasksByIds(slug, dupes).catch(() => { /* dedupe is hulp */ });
  const ids = await appendTasks(slug, [{
    categorie: "Structured data",
    taak: `Structured data doorvoeren op ${pagePath(url)}`,
    toelichting: `JSON-LD (copy-paste): ${json.link}\nUitleg-document: ${doc.link}${state.warnings.length ? `\nLet op: ${state.warnings.join(" | ")}` : ""}`,
    klantToelichting: "We voegen onzichtbare, gestructureerde bedrijfs- en paginainformatie toe waarmee Google en AI-zoekmachines de pagina beter begrijpen en tonen.",
    status: "Gepland",
    wie: "Dev",
    fase: "Bouwen",
    pageUrl: url,
    stepKind: "structured_data",
    docLink: doc.link,
    klantZichtbaar: true,
  }]);
  return { ok: true, taskId: ids[0], docLink: doc.link, jsonLink: json.link, ...(title ? {} : {}) };
}

// ── Site-wide identiteitsblok (deterministisch, geen AI) ──
// Bouwt Organization/LocalBusiness + WebSite rechtstreeks uit de bevestigde
// bedrijfsgegevens, met de vaste @id's waar de per-pagina-schema's naar verwijzen.
// Leesbare openingstijden ("ma t/m vr 8:30-17:00, za 10:00-14:00") omzetten naar
// de notatie die schema.org verwacht ("Mo-Fr 08:30-17:00"). Lukt een stuk niet,
// dan laten we dat stuk weg: liever niets dan een verkeerde tijd in de markup.
const DAGEN: Record<string, string> = {
  ma: "Mo", maandag: "Mo", di: "Tu", dinsdag: "Tu", wo: "We", woensdag: "We", do: "Th", donderdag: "Th",
  vr: "Fr", vrijdag: "Fr", za: "Sa", zaterdag: "Sa", zo: "Su", zondag: "Su",
};
export function openingstijdenNaarSchema(tekst: string): string[] {
  const uit: string[] = [];
  for (const deel of String(tekst || "").split(/[,;\n]+/)) {
    const s = deel.trim().toLowerCase();
    if (!s || /gesloten/.test(s)) continue;
    const tijd = s.match(/(\d{1,2})[:.](\d{2})\s*(?:-|tot|t\/m|–)\s*(\d{1,2})[:.](\d{2})/);
    if (!tijd) continue;
    const van = `${tijd[1].padStart(2, "0")}:${tijd[2]}`;
    const tot = `${tijd[3].padStart(2, "0")}:${tijd[4]}`;
    const reeks = s.match(/\b([a-z]{2,9})\s*(?:-|t\/m|tot en met|tm|–)\s*([a-z]{2,9})\b/);
    const los = s.match(/^\s*([a-z]{2,9})\b/);
    if (reeks && DAGEN[reeks[1]] && DAGEN[reeks[2]]) uit.push(`${DAGEN[reeks[1]]}-${DAGEN[reeks[2]]} ${van}-${tot}`);
    else if (los && DAGEN[los[1]]) uit.push(`${DAGEN[los[1]]} ${van}-${tot}`);
  }
  return uit;
}

export function buildSitewideJsonLd(org: OrgData, siteUrl: string): string {
  const site = (siteUrl || "").replace(/\/+$/, "");
  const orgType = org.bedrijfstype === "kliniek" ? "MedicalClinic" : org.bedrijfstype === "lokaal" ? "LocalBusiness" : "Organization";
  const node: Record<string, unknown> = {
    "@type": orgType,
    "@id": `${site}/#organization`,
    name: org.bedrijfsnaam || undefined,
    url: `${site}/`,
  };
  if (org.logoUrl) node.logo = { "@type": "ImageObject", "@id": `${site}/#logo`, url: org.logoUrl };
  if (org.telefoon) node.telephone = org.telefoon;
  if (org.email) node.email = org.email;
  if (!org.geenBezoekadres && (org.straat || org.plaats)) {
    node.address = { "@type": "PostalAddress", streetAddress: org.straat || undefined, postalCode: org.postcode || undefined, addressLocality: org.plaats || undefined, addressCountry: "NL" };
  }
  if (org.sameAs.length) node.sameAs = org.sameAs;
  if (org.areaServed.length) node.areaServed = org.areaServed.map((a) => ({ "@type": "Place", name: a }));
  if (org.priceRange && (orgType === "LocalBusiness" || orgType === "MedicalClinic")) node.priceRange = org.priceRange;
  if (org.oprichtingsjaar) node.foundingDate = org.oprichtingsjaar;
  if (org.kvk) node.identifier = [{ "@type": "PropertyValue", name: "KVK", value: org.kvk }];
  if (org.btw) node.vatID = org.btw;
  // Openingstijden alleen als ze eenduidig te lezen zijn; een tijd die we niet
  // zeker weten hoort niet in de markup (Google rekent dat aan als foute data).
  const uren = openingstijdenNaarSchema(org.openingstijden);
  if (uren.length) node.openingHours = uren;
  if (org.reviewGemiddelde && org.reviewAantal) {
    node.aggregateRating = { "@type": "AggregateRating", ratingValue: org.reviewGemiddelde.replace(",", "."), reviewCount: org.reviewAantal, url: org.reviewUrl || undefined };
  }
  const website = {
    "@type": "WebSite",
    "@id": `${site}/#website`,
    url: `${site}/`,
    name: org.bedrijfsnaam || undefined,
    publisher: { "@id": `${site}/#organization` },
    inLanguage: "nl-NL",
  };
  // Elke vestiging een eigen locatie-node, gekoppeld aan het bedrijf. Dit is wat
  // Google en AI-assistenten nodig hebben om per plaats een vermelding te maken.
  const vestigingType = org.bedrijfstype === "kliniek" ? "MedicalClinic" : "LocalBusiness";
  const vestigingen = (org.vestigingen || [])
    .filter((v) => v.straat || v.plaats)
    .map((v, i) => {
      const slug = (v.naam || v.plaats || `vestiging-${i + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const uur = openingstijdenNaarSchema(v.openingstijden);
      return {
        "@type": vestigingType,
        "@id": `${site}/#vestiging-${slug}`,
        name: [org.bedrijfsnaam, v.naam].filter(Boolean).join(" ") || undefined,
        parentOrganization: { "@id": `${site}/#organization` },
        address: { "@type": "PostalAddress", streetAddress: v.straat || undefined, postalCode: v.postcode || undefined, addressLocality: v.plaats || undefined, addressCountry: "NL" },
        telephone: v.telefoon || org.telefoon || undefined,
        email: v.email || undefined,
        url: v.mapsUrl || undefined,
        openingHours: uur.length ? uur : undefined,
        image: org.logoUrl || undefined,
        priceRange: org.priceRange || undefined,
      };
    });
  if (vestigingen.length) node.department = vestigingen.map((v) => ({ "@id": v["@id"] }));

  const clean = (o: unknown): unknown => {
    if (Array.isArray(o)) return o.map(clean);
    if (o && typeof o === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) if (v !== undefined && v !== "") out[k] = clean(v);
      return out;
    }
    return o;
  };
  return JSON.stringify(clean({ "@context": "https://schema.org", "@graph": [node, ...vestigingen, website] }), null, 2);
}
