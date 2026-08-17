/**
 * WAT HEBBEN WE DEZE KLANT AL GESTUURD, EN HOE BEGON DIE MAIL?
 * ═══════════════════════════════════════════════════════════
 * Uit de prioriteitenscan komen telkens dezelfde sóórten opdrachten. Bij Paul
 * Hoevenaars is 36 van de 50 kansen "nieuwe pagina". Tien nieuwe-pagina-mails met
 * dezelfde opbouw achter elkaar leest als een sjabloon, hoe goed elke losse mail
 * ook geschreven is. Dan valt het handwerk juist wéér weg.
 *
 * Twee dingen lossen dat op, en geen van beide is "synoniemen laten rouleren":
 *
 * 1. **Een andere invalshoek per mail.** Bij één kans zijn meerdere dingen wáár:
 *    hoeveel er gezocht wordt, wat er op hun eigen site wel en niet staat, wie die
 *    zoeker is, en dat een concurrent er wel staat. Elke mail opent vanuit een
 *    andere van die feiten. Dat is echte variatie, want het is elke keer een
 *    andere observatie en niet dezelfde observatie in andere woorden.
 * 2. **Weten hoe de vorige mails begonnen.** De openingszinnen van de laatste
 *    mails van ditzelfde soort gaan mee naar de assistent met de opdracht: begin
 *    niet zo. Zonder geheugen kan hij dat niet weten en herhaalt hij zichzelf.
 *
 * Vandaar dit logje. Het bewaart alleen wat nodig is om de vólgende mail anders te
 * laten klinken: welk soort kans, welke invalshoek, en de openingszin.
 */

import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";

export type KansmailRegel = { soort: string; invalshoek: string; werkwijze: string; opening: string; datum: string };

// De tabellen worden één keer gebouwd per database, niet bij elke koude
// server opnieuw. Zie lib/schema-stand.ts. Verander je iets aan doEnsure(),
// hoog dan het cijfer in de versie hieronder op; anders komt het er nooit in.
const SCHEMA_VERSIE = "kansmail-log-7b3c012a";

function ensureTable(): Promise<void> {
  return eenmalig("kansmail-log", SCHEMA_VERSIE, doEnsure);
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_kansmail_log (
      id          SERIAL PRIMARY KEY,
      client_slug TEXT NOT NULL,
      soort       TEXT NOT NULL,
      invalshoek  TEXT NOT NULL DEFAULT '',
      opening     TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS client_kansmail_log_slug_idx ON client_kansmail_log (client_slug, soort, created_at DESC)`;
  // Welk stuk werkwijze er genoemd is, zodat de volgende mail een ander stuk pakt.
  await sql`ALTER TABLE client_kansmail_log ADD COLUMN IF NOT EXISTS werkwijze TEXT NOT NULL DEFAULT ''`;
}

/** De laatste mails van dit soort aan deze klant, nieuwste eerst. */
export async function laatsteKansmails(slug: string, soort: string, hoeveel = 5): Promise<KansmailRegel[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT soort, invalshoek, werkwijze, opening, to_char(created_at, 'YYYY-MM-DD') AS datum
    FROM client_kansmail_log
    WHERE client_slug = ${slug} AND soort = ${soort}
    ORDER BY created_at DESC LIMIT ${Math.max(1, Math.min(20, hoeveel))}`;
  return rows.map((r) => ({
    soort: String(r.soort || ""), invalshoek: String(r.invalshoek || ""),
    werkwijze: String(r.werkwijze || ""),
    opening: String(r.opening || ""), datum: String(r.datum || ""),
  }));
}

export async function logKansmail(slug: string, soort: string, invalshoek: string, werkwijze: string, opening: string): Promise<void> {
  await ensureSchema();
  await ensureTable();
  // Alleen de eerste zin; meer is niet nodig om te weten hoe hij begon, en hoe
  // minder klanttekst we bewaren hoe beter.
  const kort = (opening || "").trim().split(/(?<=[.!?])\s/)[0]?.slice(0, 300) || "";
  await sql`
    INSERT INTO client_kansmail_log (client_slug, soort, invalshoek, werkwijze, opening)
    VALUES (${slug}, ${soort}, ${invalshoek}, ${werkwijze}, ${kort})`;
}
