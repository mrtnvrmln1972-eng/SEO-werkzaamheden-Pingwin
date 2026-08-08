import { sql, ensureSchema } from "./db";
import { urlKey } from "./url-key";
import { logActiviteit } from "./activiteit";
import { getClientBySlug } from "./clients";
import { getPageDocOutputs, savePageDocOutput, getPageDriveFolder } from "./site-urls";
import { ensureFolderFor } from "./drive-map";
import { callClaude, LIGHT_MODEL } from "./anthropic";
import { uploadBestand, uploadEnConverteer, readDriveDoc } from "./drive";
import { kanDirectGelezen, tekstUitLokaalBestand } from "./bestand-tekst";

const DOCX_MIME_IN = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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
  /** Door Maarten aangemerkt als de versie die geldt. */
  goedgekeurd: boolean;
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
  // Welke versie geldt. Maarten zet dit vinkje zelf; die versie gaat standaard mee
  // in een mail en naar de sitebouwer, en wordt de tekst waar de rest mee rekent.
  // Verving het automatisch samenvoegen, dat bij elke ronde een extra document en
  // een beslissing opleverde, ook als er niets veranderd was.
  await sql`ALTER TABLE page_doc_versions ADD COLUMN IF NOT EXISTS goedgekeurd BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE page_doc_versions ADD COLUMN IF NOT EXISTS goedgekeurd_op TIMESTAMPTZ`;
}

function rowToVersion(r: Record<string, unknown>): DocVersion {
  return {
    id: r.id as number, kind: (r.kind as string) || "overig", source: ((r.source as string) === "klant" ? "klant" : "pingwin"),
    naam: (r.naam as string) || "", driveLink: (r.drive_link as string) || "",
    samenvatting: (r.samenvatting as string) || "", vergelijking: (r.vergelijking as string) || "",
    status: ((r.status as string) as DocVersion["status"]) || "verwerkt",
    createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : "",
    goedgekeurd: !!r.goedgekeurd,
  };
}

// Dezelfde bijlage kon twee keer in het archief belanden: op /crp-waarde-testen/
// stonden twee rijen "Tekst CRP-waarde 21-07-2026.pdf", allebei ingelezen in
// dezelfde minuut. Dan lijkt het alsof er twee verschillende versies zijn terwijl
// het één document is. We houden de nieuwste van elk paar en laten de rest weg uit
// de lijst; weggooien doen we niet, de rij blijft gewoon in de tabel staan. Werkt
// hierdoor ook voor de dubbelingen die er nu al in zitten.
function ontdubbelVersies(lijst: DocVersion[]): DocVersion[] {
  const gezien = new Set<string>();
  const uniek: DocVersion[] = [];
  for (const v of lijst) {           // komt al op id DESC binnen, dus nieuwste eerst
    const naam = (v.naam || "").trim().toLowerCase();
    const minuut = String(v.createdAt || "").slice(0, 16);
    const sleutel = naam ? `${naam}|${v.kind}|${minuut}` : `#${v.id}`;
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    uniek.push(v);
  }
  return uniek;
}

export async function listVersions(slug: string, url: string): Promise<DocVersion[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT id, kind, source, naam, drive_link, samenvatting, vergelijking, status, created_at, goedgekeurd
    FROM page_doc_versions WHERE client_slug = ${slug} AND url = ${url} AND status <> 'genegeerd'
    ORDER BY id DESC LIMIT 40`;
  return ontdubbelVersies(rows.map(rowToVersion));
}

// Zelfde lijst, maar vergelijkend op de genormaliseerde sleutel. De tabel bewaart
// de rauwe URL, dus een versie die onder "https://www.x.nl/pad" is opgeslagen werd
// niet gevonden bij een kaart met "https://x.nl/pad/". Voor het paginadossier is
// dat het verschil tussen wel en geen documenten zien.
export async function listVersionsForKey(slug: string, url: string): Promise<DocVersion[]> {
  await ensureSchema();
  await ensureTable();
  const k = urlKey(url);
  const { rows } = await sql`
    SELECT id, url, kind, source, naam, drive_link, samenvatting, vergelijking, status, created_at, goedgekeurd
    FROM page_doc_versions WHERE client_slug = ${slug} AND status <> 'genegeerd'
    ORDER BY id DESC LIMIT 400`;
  return ontdubbelVersies(rows.filter((r) => urlKey(String(r.url || "")) === k).slice(0, 40).map(rowToVersion));
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

// ─── Een aangeleverd document wordt gewoon een versie in de lijst ───
//
// Dit was eerst een VOORSTEL waar je "Verwerk" op moest klikken, waarna de AI het
// samenvoegde met de geldende versie tot een nieuw document. Dat leverde per ronde
// twee versies en een extra Drive-bestand op, ook als er niets veranderd was, en
// een beslissing die je moest nemen zonder dat je iets gevraagd had. Nu landt een
// document gewoon in de lijst; jij bepaalt met het vinkje "goedgekeurd" welke
// versie geldt.

export type NieuweVersie = {
  id: number; kind: string; kindLabel: string; naam: string; vergelijking: string; samenvatting: string;
};

// ── Aangeleverd bestand omzetten naar tekst ──
// Eén plek voor alle manieren waarop een document binnenkomt: gesleept in het
// dashboard, of als bijlage bij een mail van de klant. Platte tekst gaat direct;
// .docx wordt bewaard zoals hij is en apart als leeskopie omgezet; een pdf kan
// alleen via de omzetting (Drive haalt de tekst eruit).
//
// Pdf staat hier bewust bij: klanten sturen hun geredigeerde teksten vaak als
// pdf terug, en zonder dit kon het dashboard juist dát bestand niet lezen.
export async function leesAangeleverdDocument(
  slug: string,
  url: string,
  naam: string,
  buf: Buffer,
): Promise<{ ok: boolean; tekst?: string; driveLink?: string; error?: string }> {
  const datum = new Date().toISOString().slice(0, 10);

  // ── 1. Kan het hier gelezen worden? Dan hoeft Drive er niet aan te pas ──
  // Word, Excel, csv en platte tekst zijn hier te lezen (lib/bestand-tekst.ts).
  // Deze functie had daar zijn eigen, kleinere lijstje naast staan en weigerde
  // daardoor .xlsx, terwijl die leeslaag Excel allang aankon. Twee leeswegen
  // naast elkaar betekent altijd dat de kopie achterloopt; daarom nu één weg.
  if (kanDirectGelezen(naam)) {
    let tekst = "";
    try { tekst = await tekstUitLokaalBestand(naam, buf); }
    catch (e) { return { ok: false, error: "Inlezen mislukte: " + (e as Error).message }; }
    if (!tekst.trim()) return { ok: false, error: "Kon geen leesbare tekst uit dit bestand halen (het lijkt leeg)." };

    // Het origineel bewaren in Drive is een extra, geen voorwaarde: staat Drive
    // niet goed, dan is het bestand toch ingelezen in plaats van geweigerd.
    let driveLink = "";
    if (/\.(docx|xlsx|xlsm|xls)$/i.test(naam)) {
      try {
        const folderId = await ensureFolderFor(slug, url);
        if (folderId) {
          const mime = /\.docx$/i.test(naam)
            ? DOCX_MIME_IN
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          driveLink = (await uploadBestand(folderId, `Aangeleverd-${datum}-${naam}`, buf, mime)).link;
        }
      } catch { /* zonder link verder; de tekst is er al */ }
    }
    return { ok: true, tekst, driveLink };
  }

  // ── 2. Pdf en scans: juist hier is de tekstherkenning van Drive het punt ──
  if (!/\.pdf$/i.test(naam)) {
    return { ok: false, error: "Dit bestandstype kan ik nog niet lezen. Gebruik pdf, Word, Excel, csv, txt of md." };
  }
  const folderId = await ensureFolderFor(slug, url);
  if (!folderId) {
    return { ok: false, error: "Een pdf lees ik via Google Drive, en die koppeling werkt nu niet. Koppel Drive opnieuw in het adminscherm, of lever het stuk als Word of tekst aan." };
  }
  try {
    const lees = await uploadEnConverteer(folderId, `Aangeleverd-${datum}-${naam}`, buf, "application/pdf");
    const read = await readDriveDoc(lees.id, 60000);
    return read.ok && (read.text || "").trim()
      ? { ok: true, tekst: read.text || "", driveLink: lees.link }
      : { ok: false, error: "Kon geen leesbare tekst uit de pdf halen (mogelijk een scan zonder tekstlaag)." };
  } catch (e) {
    return { ok: false, error: "Inlezen mislukte: " + (e as Error).message };
  }
}

export async function voegVersieToe(slug: string, url: string, naam: string, tekst: string, driveLink: string, kindHint?: string): Promise<NieuweVersie> {
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
    VALUES (${slug}, ${url}, ${kind}, 'klant', ${naam || null}, ${driveLink || null}, ${(tekst || "").slice(0, 60000) || null}, ${samenvatting}, ${vergelijking}, 'verwerkt')
    RETURNING id`;
  return { id: rows[0].id as number, kind, kindLabel: KIND_LABEL[kind] || kind, naam, vergelijking, samenvatting };
}

export async function ignoreVersion(slug: string, id: number): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`UPDATE page_doc_versions SET status = 'genegeerd' WHERE client_slug = ${slug} AND id = ${id}`;
}

// ─── Verwerken: samenvoegen tot een nieuwe geldende versie ───

/**
 * Vervallen: het automatische samenvoegen tot een nieuwe geldende versie.
 *
 * Dit voegde een teruggekregen klantversie met de AI samen met onze tekst en
 * maakte daar een nieuw Word-bestand van. Per ronde leverde dat twee versies en
 * een extra bestand in Drive op, ook als er niets veranderd was, plus een
 * beslissing ("Verwerk of Negeer") die je moest nemen zonder erom te vragen.
 *
 * Wat ervoor in de plaats komt: een aangeleverd document landt gewoon als versie
 * in de lijst, en jij zet met keurVersieGoed() welke versie geldt. Die functie
 * schrijft ook de geldende tekst, dus de rest van het dashboard blijft kloppen.
 * Toetsen of een klantversie nog aan de SEO-criteria voldoet doet lib/criteria-toets.ts.
 */
// ─── Zelf beheren: hernoemen en goedkeuren ───

/** De naam van een versie aanpassen. De naam is wat je in de lijst en in de mail ziet. */
export async function hernoemVersie(slug: string, id: number, naam: string): Promise<boolean> {
  await ensureSchema();
  await ensureTable();
  const schoon = (naam || "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (!schoon) return false;
  const { rowCount } = await sql`
    UPDATE page_doc_versions SET naam = ${schoon} WHERE client_slug = ${slug} AND id = ${id}`;
  return (rowCount || 0) > 0;
}

/**
 * Eén versie aanmerken als de versie die geldt.
 *
 * Dit doet twee dingen tegelijk, en dat is precies de bedoeling: het zet het
 * merkje in de lijst én het maakt de tekst van die versie de geldende tekst voor
 * deze pagina en dit soort. Dat laatste bepaalde vroeger het automatische
 * samenvoegen. Zonder deze stap zou de rest van het dashboard (structured data,
 * de opdracht aan de sitebouwer) stil met een oudere tekst blijven rekenen.
 *
 * Per (pagina, soort) geldt er één versie; goedkeuren haalt het merkje bij de
 * andere weg. Er wordt niets weggegooid: de oude versies blijven in de lijst.
 */
export async function keurVersieGoed(slug: string, id: number, aan = true): Promise<{ ok: boolean; error?: string; kind?: string }> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT url, kind, tekst FROM page_doc_versions WHERE client_slug = ${slug} AND id = ${id} LIMIT 1`;
  const v = rows[0];
  if (!v) return { ok: false, error: "Deze versie bestaat niet meer." };
  if (!aan) {
    await sql`UPDATE page_doc_versions SET goedgekeurd = false, goedgekeurd_op = NULL WHERE client_slug = ${slug} AND id = ${id}`;
    return { ok: true, kind: v.kind as string };
  }
  await sql`
    UPDATE page_doc_versions SET goedgekeurd = false, goedgekeurd_op = NULL
    WHERE client_slug = ${slug} AND url = ${v.url} AND kind = ${v.kind} AND id <> ${id}`;
  await sql`
    UPDATE page_doc_versions SET goedgekeurd = true, goedgekeurd_op = now()
    WHERE client_slug = ${slug} AND id = ${id}`;
  // De tekst van deze versie wordt de geldende tekst. Alleen als er tekst is: een
  // los bestand zonder leesbare inhoud mag de bestaande tekst niet wissen.
  const tekst = String(v.tekst || "").trim();
  if (tekst) await savePageDocOutput(slug, String(v.url), String(v.kind), tekst).catch(() => {});
  return { ok: true, kind: v.kind as string };
}

/** De goedgekeurde versies van een pagina of taak, jongste eerst. */
export async function goedgekeurdeVersies(slug: string, url: string): Promise<DocVersion[]> {
  return (await listVersions(slug, url)).filter((v) => v.goedgekeurd);
}
