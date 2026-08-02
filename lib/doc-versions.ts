import { sql, ensureSchema } from "./db";
import { logActiviteit } from "./activiteit";
import { getClientBySlug } from "./clients";
import { getPageDocOutputs, savePageDocOutput, getPageDriveFolder } from "./site-urls";
import { callClaude, LIGHT_MODEL } from "./anthropic";
import { buildPingwinDoc, type DocSection, type DocBlock } from "./pingwin-docx";
import { uploadDocx } from "./drive";

// ═══════════════════════════════════════════════════════════
// DOCUMENTVERSIES (archief + geldende versie, zonder ooit iets te verliezen)
// ═══════════════════════════════════════════════════════════
// De "geldende versie" per (pagina, soort) blijft page_doc_outputs: dat is wat
// alle motoren (copy, structured data) al als ketenbron lezen. Deze laag legt
// daaromheen een append-only archief (page_doc_versions): elke drop van Maarten
// en elke generator-run wordt een versie-rij. Er wordt NOOIT iets weggegooid of
// overschreven: een klant-drop is eerst een VOORSTEL (met vergelijking en
// samenvatting); pas na Maartens klik op "Verwerk" wordt er een nieuwe geldende
// versie samengevoegd, als níeuw document, met de oude versies er nog onder.
// ═══════════════════════════════════════════════════════════

export const DOC_KINDS = ["analyse", "blauwdruk", "copy", "structured", "overig"] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const KIND_LABEL: Record<string, string> = { analyse: "Analyse", blauwdruk: "Blauwdruk", copy: "Copy", structured: "Structured data", overig: "Overig document" };

export type DocVersion = {
  id: number; kind: string; source: "pingwin" | "klant"; naam: string; driveLink: string;
  samenvatting: string; vergelijking: string; status: "voorstel" | "verwerkt" | "genegeerd";
  createdAt: string;
};

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS page_doc_versions (
      id           SERIAL PRIMARY KEY,
      client_slug  TEXT NOT NULL,
      url          TEXT NOT NULL,
      kind         TEXT NOT NULL DEFAULT 'overig',
      source       TEXT NOT NULL DEFAULT 'pingwin',
      naam         TEXT,
      drive_link   TEXT,
      tekst        TEXT,
      samenvatting TEXT,
      vergelijking TEXT,
      status       TEXT NOT NULL DEFAULT 'verwerkt',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pdv_page ON page_doc_versions (client_slug, url)`;
}

function rowToVersion(r: Record<string, unknown>): DocVersion {
  return {
    id: r.id as number, kind: (r.kind as string) || "overig", source: ((r.source as string) === "klant" ? "klant" : "pingwin"),
    naam: (r.naam as string) || "", driveLink: (r.drive_link as string) || "",
    samenvatting: (r.samenvatting as string) || "", vergelijking: (r.vergelijking as string) || "",
    status: ((r.status as string) as DocVersion["status"]) || "verwerkt",
    createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : "",
  };
}

export async function listVersions(slug: string, url: string): Promise<DocVersion[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT id, kind, source, naam, drive_link, samenvatting, vergelijking, status, created_at
    FROM page_doc_versions WHERE client_slug = ${slug} AND url = ${url} AND status <> 'genegeerd'
    ORDER BY id DESC LIMIT 40`;
  return rows.map(rowToVersion);
}

// Elke generator-run legt zijn resultaat ook als versie in het archief
// (best effort: het archief mag een run nooit laten mislukken).
export async function registerGeneratedVersion(slug: string, url: string, kind: string, naam: string, driveLink: string, tekst: string, samenvatting?: string): Promise<void> {
  try {
    await ensureSchema();
    await ensureTable();
    await sql`
      INSERT INTO page_doc_versions (client_slug, url, kind, source, naam, drive_link, tekst, samenvatting, vergelijking, status)
      VALUES (${slug}, ${url}, ${kind}, 'pingwin', ${naam || null}, ${driveLink || null}, ${(tekst || "").slice(0, 60000) || null}, ${samenvatting || "Gegenereerd door het dashboard."}, ${null}, 'verwerkt')
      RETURNING id`;
    // Een opgeleverd document is werk dat we voor de klant deden; alleen de drie
    // soorten die daar echt over gaan, niet elk intern bestand.
    if (kind === "analyse" || kind === "blauwdruk" || kind === "copy") {
      const { rows } = await sql`SELECT id FROM page_doc_versions WHERE client_slug = ${slug} AND url = ${url} AND kind = ${kind} ORDER BY id DESC LIMIT 1`;
      if (rows[0]) {
        await logActiviteit({
          slug, soort: kind, bron: "page_doc_versions", bronId: Number(rows[0].id),
          url, bewijs: driveLink || null,
        });
      }
    }
  } catch { /* archief is best effort */ }
}

// ─── Drop van een klantversie: eerst een VOORSTEL, nog niets veranderd ───

export type DropProposal = {
  id: number; kind: string; kindLabel: string; naam: string; vergelijking: string; samenvatting: string;
};

export async function proposeVersion(slug: string, url: string, naam: string, tekst: string, driveLink: string, kindHint?: string): Promise<DropProposal> {
  await ensureSchema();
  await ensureTable();
  const outputs = await getPageDocOutputs(slug, url).catch(() => ({} as Record<string, string>));
  // 1. Soort herkennen + vergelijken met de geldende versie, in één lichte call.
  const sys = `Je bent documentbeheerder bij SEO-bureau Pingwin. Je krijgt een aangeleverd document (vaak een klantversie) en de huidige "geldende versies" per soort. Bepaal:
1. "kind": welk soort document dit is: ${DOC_KINDS.join(" | ")}. (analyse = SEO-analyse van een pagina; blauwdruk = paginastructuur/outline; copy = uitgeschreven paginatekst; structured = structured data/schema-gegevens zoals bedrijfsinfo, artsen, JSON-LD; overig = al het andere.)
2. "vergelijking": is dit NIEUWER (bevat aanvullingen/wijzigingen t.o.v. de geldende versie), OUDER (lijkt een eerdere/kalere versie van wat er al staat), of NIEUW (er is nog geen geldende versie van dit soort). Kies exact een van: nieuwer | ouder | nieuw.
3. "samenvatting": 2-4 korte zinnen in gewone taal: wat dit document is en wat er nieuw of anders in staat vergeleken met de geldende versie. Geen jargon, geen opsomming van alles, alleen wat ertoe doet.
Antwoord met UITSLUITEND geldige JSON: {"kind":"...","vergelijking":"...","samenvatting":"..."}`;
  const huidige = Object.entries(outputs).map(([k, v]) => `--- Geldende versie ${KIND_LABEL[k] || k} (eerste deel) ---\n${(v || "").slice(0, 2500)}`).join("\n\n") || "(nog geen geldende versies)";
  const user = `Bestandsnaam: ${naam || "(onbekend)"}\n${kindHint ? `Hint van Maarten over het soort: ${kindHint}\n` : ""}\nAANGELEVERD DOCUMENT:\n${(tekst || "").slice(0, 9000)}\n\nHUIDIGE GELDENDE VERSIES:\n${huidige.slice(0, 9000)}`;
  let kind = kindHint && (DOC_KINDS as readonly string[]).includes(kindHint) ? kindHint : "overig";
  let vergelijking = "nieuw";
  let samenvatting = "Aangeleverd document.";
  try {
    const raw = await callClaude(sys, [{ role: "user", content: user }], 900, { slug, action: "doc-versie-herkennen" }, LIGHT_MODEL);
    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const p = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1)) as { kind?: string; vergelijking?: string; samenvatting?: string };
    if (p.kind && (DOC_KINDS as readonly string[]).includes(p.kind)) kind = p.kind;
    if (p.vergelijking && ["nieuwer", "ouder", "nieuw"].includes(p.vergelijking)) vergelijking = p.vergelijking;
    if (p.samenvatting) samenvatting = String(p.samenvatting).trim();
  } catch { /* voorstel zonder AI-oordeel is ook bruikbaar */ }
  const { rows } = await sql`
    INSERT INTO page_doc_versions (client_slug, url, kind, source, naam, drive_link, tekst, samenvatting, vergelijking, status)
    VALUES (${slug}, ${url}, ${kind}, 'klant', ${naam || null}, ${driveLink || null}, ${(tekst || "").slice(0, 60000) || null}, ${samenvatting}, ${vergelijking}, 'voorstel')
    RETURNING id`;
  return { id: rows[0].id as number, kind, kindLabel: KIND_LABEL[kind] || kind, naam, vergelijking, samenvatting };
}

export async function ignoreVersion(slug: string, id: number): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`UPDATE page_doc_versions SET status = 'genegeerd' WHERE client_slug = ${slug} AND id = ${id} AND status = 'voorstel'`;
}

// Markdown → nette document-secties voor buildPingwinDoc (koppen, bullets, alinea's).
function mdToSections(md: string): DocSection[] {
  const sections: DocSection[] = [];
  let cur: DocSection = { blocks: [] };
  let bullets: string[] = [];
  const flushBullets = () => { if (bullets.length) { cur.blocks.push({ type: "bullets", items: bullets } as DocBlock); bullets = []; } };
  const flushSection = () => { flushBullets(); if (cur.heading || cur.blocks.length) sections.push(cur); cur = { blocks: [] }; };
  for (const raw of (md || "").split("\n")) {
    const r = raw.trim();
    const h = /^#{1,3}\s+(.*)$/.exec(r);
    if (h) { flushSection(); cur = { heading: h[1].replace(/[#*]/g, "").trim(), blocks: [] }; continue; }
    if (/^[-*]\s+/.test(r)) { bullets.push(r.replace(/^[-*]\s+/, "")); continue; }
    flushBullets();
    if (r) cur.blocks.push({ type: "paragraph", text: r } as DocBlock);
  }
  flushSection();
  return sections.length ? sections : [{ blocks: [{ type: "paragraph", text: md || "(leeg)" }] }];
}

// ─── Verwerken: samenvoegen tot een nieuwe geldende versie ───

export async function confirmVersion(slug: string, id: number, kindOverride?: string): Promise<{ ok: boolean; error?: string; docLink?: string; samenvatting?: string }> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT id, url, kind, naam, tekst FROM page_doc_versions WHERE client_slug = ${slug} AND id = ${id} AND status = 'voorstel' LIMIT 1`;
  const v = rows[0];
  if (!v) return { ok: false, error: "Voorstel niet gevonden (misschien al verwerkt)." };
  const url = v.url as string;
  const kind = kindOverride && (DOC_KINDS as readonly string[]).includes(kindOverride) ? kindOverride : ((v.kind as string) || "overig");
  const klantTekst = (v.tekst as string) || "";
  if (!klantTekst.trim()) return { ok: false, error: "Het aangeleverde document bevat geen leesbare tekst." };
  const outputs = await getPageDocOutputs(slug, url).catch(() => ({} as Record<string, string>));
  const master = outputs[kind] || "";

  // Samenvoegen: klant-aanvullingen erin, niets van ons kwijt, twijfel expliciet.
  let nieuweMaster = klantTekst;
  let mergeVerslag = "Aangeleverde versie is de nieuwe geldende versie (er was nog geen eerdere versie van dit soort).";
  if (master.trim()) {
    const sys = `Je bent documentbeheerder bij SEO-bureau Pingwin. Voeg twee versies van hetzelfde ${KIND_LABEL[kind] || kind}-document samen tot ÉÉN nieuwe geldende versie, in nette markdown. Harde regels:
- Neem ALLE aanvullingen en wijzigingen uit de aangeleverde (klant)versie over.
- Behoud alles uit de huidige geldende versie dat de klant niet heeft geraakt.
- VERZIN NIETS. Spreken de versies elkaar tegen en is niet duidelijk wat waar is, zet dan op die plek een regel "KEUZE NODIG: ..." met beide varianten.
- Geen inleiding of naschrift, alleen het samengevoegde document.
Sluit af met een aparte laatste regel die begint met "VERSLAG:" gevolgd door 1-3 zinnen in gewone taal over wat er is overgenomen en of er keuzes openstaan.`;
    const user = `HUIDIGE GELDENDE VERSIE:\n${master.slice(0, 16000)}\n\nAANGELEVERDE VERSIE (klant):\n${klantTekst.slice(0, 16000)}`;
    try {
      const raw = await callClaude(sys, [{ role: "user", content: user }], 8000, { slug, action: "doc-versie-mergen" });
      const m = /\nVERSLAG:\s*([\s\S]*)$/.exec(raw);
      nieuweMaster = m ? raw.slice(0, m.index).trim() : raw.trim();
      mergeVerslag = m ? m[1].trim() : "Versies samengevoegd.";
      if (!nieuweMaster) throw new Error("lege samenvoeging");
    } catch (e) {
      return { ok: false, error: "Samenvoegen mislukt: " + (e as Error).message };
    }
  }

  // Nieuwe geldende versie als nieuw document in Drive (nooit iets overschrijven).
  const client = await getClientBySlug(slug);
  let docLink = "";
  try {
    const folder = await getPageDriveFolder(slug, url).catch(() => null);
    if (folder?.folderId) {
      const datum = new Date().toISOString().slice(0, 10);
      const buffer = await buildPingwinDoc({
        klant: client?.name || slug,
        rapporttype: "Geldende versie",
        titel: `${KIND_LABEL[kind] || kind}, geldende versie ${datum}`,
        ondertitel: mergeVerslag,
        sections: mdToSections(nieuweMaster),
      });
      ({ link: docLink } = await uploadDocx(folder.folderId, `${KIND_LABEL[kind] || kind}-geldende-versie-${datum}.docx`, buffer));
    }
  } catch { /* zonder Drive-doc toch verwerken; de tekst is leidend */ }

  // Pas NU wordt de geldende versie bijgewerkt, plus een archief-rij van het resultaat.
  await savePageDocOutput(slug, url, kind, nieuweMaster);
  await sql`UPDATE page_doc_versions SET status = 'verwerkt' WHERE client_slug = ${slug} AND id = ${id}`;
  await registerGeneratedVersion(slug, url, kind, `Geldende versie na verwerken van "${(v.naam as string) || "aangeleverd document"}"`, docLink, nieuweMaster, mergeVerslag);
  return { ok: true, docLink, samenvatting: mergeVerslag };
}
