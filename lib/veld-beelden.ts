import { sql } from "./db";
import { eenmalig } from "./schema-stand";

// ═══════════════════════════════════════════════════════════
// BEELDEN IN EEN TEKSTVELD
// ═══════════════════════════════════════════════════════════
// Een screendump die je in de aantekeningen bij een taak sleept, hoort daar te
// blijven staan én zichtbaar te zijn. Dat is de hele reden dat dit bestaat: je
// wilt in één oogopslag zien waar het over gaat, zonder eerst een link naar
// Drive te openen.
//
// ── Waarom in de database, en niet in Drive of als data-URL ──
//   * Drive kan het wél bewaren (zo werkt de bestandenkast van de klant), maar
//     een Drive-plaatje is niet als <img> te tonen: dat scherm vraagt om een
//     eigen inlog en geeft geen kale afbeelding terug. Dan zie je een grijs vak.
//   * Een data-URL in de tekst zelf lijkt makkelijk, maar dan staat een
//     screendump van twee megabyte als één regel tekst in de aantekening. Die
//     tekst wordt bij élke toetsaanslag opnieuw weggeschreven en meegestuurd.
//   * Dus: het beeld één keer opslaan, en in de tekst alleen een kort adres
//     (`/api/admin/beeld/12`). De tekst blijft daarmee tekst.
//
// De bytes staan als base64 in een TEXT-kolom. Postgres bewaart zoiets buiten
// de rij (TOAST) en comprimeert het, dus een tabel met plaatjes maakt de tabel
// zelf niet traag.
//
// Er wordt hier nooit iets verwijderd. Haal je een plaatje uit je aantekening,
// dan blijft de rij staan: dat kost bijna niets en het is het verschil tussen
// "per ongeluk weggehaald, maar terug te halen" en "weg".
// ═══════════════════════════════════════════════════════════

/** Wat een browser mag terugkrijgen. Alles daarbuiten wordt geweigerd, zodat er
    nooit iets uitvoerbaars (SVG met script, HTML) via deze route serveerbaar is. */
export const TOEGESTANE_SOORTEN = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/** Grens per beeld. Een schermfoto van een heel scherm blijft daar ruim onder;
    een foto uit een telefoon niet altijd, en die wordt in de browser al kleiner
    gemaakt voordat hij hierheen gaat. */
export const MAX_BYTES = 12 * 1024 * 1024;

export type BeeldRij = { mime: string; naam: string; bytes: Buffer };

const SCHEMA_VERSIE = "veld-beelden-be401a78";

async function ensureTable(): Promise<void> {
  return eenmalig("veld-beelden", SCHEMA_VERSIE, doEnsureTable);
}
async function doEnsureTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS veld_beelden (
      id            SERIAL PRIMARY KEY,
      client_slug   TEXT NOT NULL DEFAULT '',
      naam          TEXT NOT NULL DEFAULT '',
      mime          TEXT NOT NULL DEFAULT 'image/png',
      data          TEXT NOT NULL,
      grootte       INTEGER NOT NULL DEFAULT 0,
      toegevoegd_op TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}

/** Bewaar één beeld en geef het nummer terug waarmee het op te halen is. */
export async function bewaarBeeld(
  slug: string,
  naam: string,
  mime: string,
  bytes: Buffer,
): Promise<number> {
  await ensureTable();
  const r = await sql`
    INSERT INTO veld_beelden (client_slug, naam, mime, data, grootte)
    VALUES (${slug || ""}, ${(naam || "beeld").slice(0, 200)}, ${mime}, ${bytes.toString("base64")}, ${bytes.length})
    RETURNING id`;
  return Number(r.rows[0].id);
}

/** Eén beeld terughalen; null als het niet bestaat. */
export async function haalBeeld(id: number): Promise<BeeldRij | null> {
  if (!Number.isFinite(id) || id <= 0) return null;
  await ensureTable();
  const r = await sql`SELECT naam, mime, data FROM veld_beelden WHERE id = ${id}`;
  const rij = r.rows[0];
  if (!rij) return null;
  return {
    naam: String(rij.naam || "beeld"),
    mime: String(rij.mime || "image/png"),
    bytes: Buffer.from(String(rij.data || ""), "base64"),
  };
}

/** Bij welke klant hoort dit beeld? Leeg betekent: niet aan een klant gebonden. */
export async function beeldKlant(id: number): Promise<string | null> {
  if (!Number.isFinite(id) || id <= 0) return null;
  await ensureTable();
  const r = await sql`SELECT client_slug FROM veld_beelden WHERE id = ${id}`;
  return r.rows[0] ? String(r.rows[0].client_slug || "") : null;
}
