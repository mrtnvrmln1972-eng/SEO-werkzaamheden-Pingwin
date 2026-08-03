import { sql, ensureSchema } from "./db";
import { urlKey } from "./url-key";
import { ensureFolderFor } from "./drive-map";
import { uploadBestand } from "./drive";
import { leesAangeleverdDocument } from "./doc-versions";
import { callClaude, callClaudeImages, anthropicConfigured } from "./anthropic";

// ═══════════════════════════════════════════════════════════
// DE BESTANDENKAST VAN DE KLANT
// ═══════════════════════════════════════════════════════════
// Alles wat je in een gesprek naar binnen sleept, hoort op twee plekken tegelijk
// te landen: in het dossier van de klant (zodat het er over een maand nog is) en
// in het gesprek zelf (zodat de assistent het meteen meeleest). Tot nu toe kon
// het alleen bij een pagina, via de versiebeheer-dropzone; wat je in de bird's
// eye liet vallen, viel op de grond.
//
// Eén rij per bestand. Het origineel gaat naar de klantmap in Drive, en de
// leesbare inhoud (uitgelezen tekst of, bij een afbeelding, een beschrijving)
// staat erbij, zodat de chat er iets mee kan zonder het bestand opnieuw te
// openen.
// ═══════════════════════════════════════════════════════════

export type ClientFile = {
  id: number;
  naam: string;
  soort: "document" | "afbeelding" | "overig";
  mime: string;
  link: string;
  thread: string;
  url: string;          // optionele pagina waar het bij hoort
  kern: string;         // uitgelezen tekst of beschrijving, ingekort
  tekstLengte: number;
  toegevoegdOp: string;
};

let tableReady: Promise<void> | null = null;
async function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsureTable().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsureTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_files (
      id            SERIAL PRIMARY KEY,
      client_slug   TEXT NOT NULL,
      thread        TEXT NOT NULL DEFAULT '',
      url           TEXT NOT NULL DEFAULT '',
      url_key       TEXT NOT NULL DEFAULT '',
      naam          TEXT NOT NULL,
      soort         TEXT NOT NULL DEFAULT 'document',
      mime          TEXT NOT NULL DEFAULT '',
      drive_id      TEXT NOT NULL DEFAULT '',
      link          TEXT NOT NULL DEFAULT '',
      tekst         TEXT NOT NULL DEFAULT '',
      kern          TEXT NOT NULL DEFAULT '',
      toegevoegd_op TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS client_files_slug_idx ON client_files (client_slug)`;
}

const MAX_TEKST = 40000;   // wat we bewaren
const MAX_KERN = 1200;     // wat standaard in beeld en in de chat-context komt

function soortVan(naam: string, mime: string): ClientFile["soort"] {
  if (/^image\//i.test(mime) || /\.(jpe?g|png|gif|webp|svg)$/i.test(naam)) return "afbeelding";
  if (/\.(docx?|pdf|txt|md|json|csv|rtf|odt)$/i.test(naam)) return "document";
  return "overig";
}

function rij(r: Record<string, unknown>): ClientFile {
  return {
    id: Number(r.id),
    naam: String(r.naam || ""),
    soort: (String(r.soort || "document") as ClientFile["soort"]),
    mime: String(r.mime || ""),
    link: String(r.link || ""),
    thread: String(r.thread || ""),
    url: String(r.url || ""),
    kern: String(r.kern || ""),
    tekstLengte: String(r.tekst || "").length,
    toegevoegdOp: new Date(String(r.toegevoegd_op)).toISOString(),
  };
}

// Een korte, feitelijke samenvatting van wat er in het bestand staat. Geen advies,
// geen oordeel: alleen waar het over gaat, zodat je in de chat ziet wat je hebt
// binnengehaald zonder het te openen.
async function vatSamen(naam: string, tekst: string): Promise<string> {
  if (!anthropicConfigured() || tekst.trim().length < 200) return tekst.trim().slice(0, MAX_KERN);
  try {
    const s = await callClaude(
      "Vat in hoogstens 3 korte zinnen samen wat er in dit aangeleverde bestand staat: waar gaat het over en wat is de kern. Feitelijk, gewone taal, geen advies, geen emoji, geen opmaaktekens. Geef ALLEEN die zinnen terug.",
      [{ role: "user", content: `Bestand: ${naam}\n\n${tekst.slice(0, 12000)}` }], 300,
    );
    return s.trim().slice(0, MAX_KERN) || tekst.trim().slice(0, MAX_KERN);
  } catch { return tekst.trim().slice(0, MAX_KERN); }
}

// Bij een afbeelding is er geen tekst om te lezen, dus beschrijven we hem. Een
// screenshot van een zoekresultaat of van een stuk pagina zegt vaak precies waar
// het gesprek over gaat; zonder beschrijving is het een dood bestandje.
async function beschrijfBeeld(naam: string, buf: Buffer, mime: string): Promise<string> {
  if (!anthropicConfigured()) return "";
  const type = /jpe?g/i.test(mime) ? "image/jpeg" : /png/i.test(mime) ? "image/png" : /gif/i.test(mime) ? "image/gif" : /webp/i.test(mime) ? "image/webp" : "";
  if (!type) return "";
  try {
    const s = await callClaudeImages(
      "Je beschrijft een screenshot of afbeelding die iemand in een SEO-werkomgeving heeft neergelegd. Feitelijk, gewone taal, geen emoji, geen opmaaktekens.",
      "Beschrijf in hoogstens 3 korte zinnen wat hierop te zien is en welke concrete gegevens erin staan (teksten, getallen, pagina's, zoekwoorden). Geef ALLEEN die zinnen terug.",
      [{ url: "", label: naam, base64: buf.toString("base64"), mediaType: type }], 400,
    );
    return s.trim().slice(0, MAX_KERN);
  } catch { return ""; }
}

/**
 * Legt een aangeleverd bestand in de kast: origineel naar Drive, inhoud
 * uitgelezen of beschreven, rij in de database. `thread` koppelt het aan het
 * gesprek waarin je het liet vallen; `url` optioneel aan een pagina.
 */
export async function bewaarBestand(
  slug: string,
  naam: string,
  buf: Buffer,
  mime: string,
  opts: { thread?: string; url?: string } = {},
): Promise<{ ok: boolean; file?: ClientFile; error?: string }> {
  await ensureSchema(); await ensureTable();
  const soort = soortVan(naam, mime);
  const datum = new Date().toISOString().slice(0, 10);

  let tekst = "", link = "", driveId = "";

  if (soort === "document") {
    // Dezelfde inleesweg als de versiebeheer-dropzone: txt/md/json/csv direct,
    // docx en pdf via Drive. Zonder pagina landt het in de klantmap.
    const lees = await leesAangeleverdDocument(slug, opts.url || "", naam, buf);
    if (lees.ok && lees.tekst) { tekst = lees.tekst.slice(0, MAX_TEKST); link = lees.driveLink || ""; }
    else if (!lees.ok && !/txt|md|json|csv/i.test(naam)) {
      // Onleesbaar is geen reden om het weg te gooien; het origineel blijft staan.
      tekst = "";
    }
  }

  // Alles wat nog geen link heeft (afbeeldingen, onleesbare bestanden, en de
  // tekstbestanden die niet via Drive gingen) gaat hier alsnog het origineel in.
  if (!link) {
    const folderId = await ensureFolderFor(slug, opts.url || undefined);
    if (!folderId) {
      return { ok: false, error: "Geen toegang tot Google Drive; koppel Drive opnieuw in het adminscherm." };
    }
    try {
      const up = await uploadBestand(folderId, `Aangeleverd-${datum}-${naam}`, buf, mime);
      link = up.link; driveId = up.id;
    } catch (e) {
      return { ok: false, error: "Opslaan in Drive mislukte: " + (e as Error).message };
    }
  }

  const kern = soort === "afbeelding"
    ? await beschrijfBeeld(naam, buf, mime)
    : tekst.trim() ? await vatSamen(naam, tekst) : "";

  const { rows } = await sql`
    INSERT INTO client_files (client_slug, thread, url, url_key, naam, soort, mime, drive_id, link, tekst, kern)
    VALUES (${slug}, ${opts.thread || ""}, ${opts.url || ""}, ${opts.url ? urlKey(opts.url) : ""}, ${naam}, ${soort}, ${mime || ""}, ${driveId}, ${link}, ${tekst}, ${kern})
    RETURNING *`;
  return { ok: true, file: rij(rows[0]) };
}

/** De kast van een klant, nieuwste eerst. Met `thread` alleen wat in dat gesprek hangt. */
export async function getClientFiles(slug: string, opts: { thread?: string; url?: string; limit?: number } = {}): Promise<ClientFile[]> {
  await ensureSchema(); await ensureTable();
  const limit = Math.min(200, Math.max(1, opts.limit || 100));
  const { rows } = await sql`
    SELECT * FROM client_files WHERE client_slug = ${slug} ORDER BY toegevoegd_op DESC LIMIT ${limit}`;
  let uit = rows.map(rij);
  if (opts.thread) uit = uit.filter((f) => f.thread === opts.thread);
  if (opts.url) { const k = urlKey(opts.url); uit = uit.filter((f) => f.url && urlKey(f.url) === k); }
  return uit;
}

/** De volledige uitgelezen tekst van één bestand (voor als de chat dieper moet kijken). */
export async function getBestandTekst(slug: string, id: number): Promise<string> {
  await ensureSchema(); await ensureTable();
  const { rows } = await sql`SELECT tekst FROM client_files WHERE client_slug = ${slug} AND id = ${id} LIMIT 1`;
  return String(rows[0]?.tekst || "");
}

export async function verwijderBestand(slug: string, id: number): Promise<void> {
  await ensureSchema(); await ensureTable();
  // Alleen de rij; het bestand blijft in Drive staan. Weggooien uit de kast mag
  // nooit betekenen dat het origineel van de klant verdwijnt.
  await sql`DELETE FROM client_files WHERE client_slug = ${slug} AND id = ${id}`;
}

/**
 * Wat de assistent van deze bestanden meeleest: naam, soort, link en de kern.
 * Kort gehouden; de volledige tekst haalt hij zo nodig apart op.
 */
export function bestandenContext(files: ClientFile[]): string {
  if (!files.length) return "";
  const regels = files.slice(0, 12).map((f) => {
    const wat = f.soort === "afbeelding" ? "afbeelding" : "document";
    return `- ${f.naam} (${wat}${f.link ? `, ${f.link}` : ""}): ${f.kern || "geen leesbare inhoud"}`;
  });
  return `AANGELEVERDE BESTANDEN IN DIT GESPREK (door Maarten neergelegd; behandel ze als feiten van de klant):\n${regels.join("\n")}`;
}
