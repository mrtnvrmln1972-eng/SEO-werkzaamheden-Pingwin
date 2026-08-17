import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";

// ═══════════════════════════════════════════════════════════
// MELDINGEN VOOR MAARTEN
// ═══════════════════════════════════════════════════════════
// Er gebeuren dingen in dit dashboard die iemand anders doet: de sitebouwer
// vinkt een taak af, en tot nu toe moest ze daar een mail bij sturen omdat het
// dashboard er niets mee deed. Een afgevinkte taak stond stil in de database en
// niemand zag het, tenzij Maarten toevallig op het developer-scherm keek.
//
// Dit is de plek waar zulke gebeurtenissen landen. Bewust breed opgezet (soort +
// link + herkomst) zodat er later meer bij kan, en niet als een tweede
// developer-tabel: het gaat om "er is iets gebeurd dat jij moet weten", niet om
// de taak zelf.
//
// Wat het NIET is: een tweede waarheid over de taakstatus. De status staat in
// developer_overview en client_tasks; dit is alleen het belletje.
// ═══════════════════════════════════════════════════════════

export type MeldingSoort = "dev-af" | "dev-terug" | "mail-opvolg";

export type Melding = {
  id: number;
  soort: MeldingSoort;
  titel: string;
  regel: string;
  link: string | null;
  wie: string;
  gemaaktOp: string;
  nieuw: boolean;
};

/** Vanaf wanneer Maarten alles gezien heeft. Losse sleutel, geen kolom per melding. */
export const SETTING_MELDINGEN_GEZIEN = "meldingen_gezien_tot";


async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS admin_meldingen (
      id SERIAL PRIMARY KEY,
      soort TEXT NOT NULL,
      titel TEXT NOT NULL,
      regel TEXT NOT NULL DEFAULT '',
      link TEXT,
      wie TEXT NOT NULL DEFAULT '',
      bron TEXT NOT NULL,
      bron_id TEXT NOT NULL,
      gemaakt_op TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  // Eén melding per gebeurtenis. Vinkt iemand twee keer af (of klikt ze per
  // ongeluk dubbel), dan schuift de bestaande melding op in plaats van dat er een
  // rij bij komt; anders staat er straks een teller van twaalf voor één taak.
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS admin_meldingen_bron_idx ON admin_meldingen (bron, bron_id, soort)`;
  await sql`CREATE INDEX IF NOT EXISTS admin_meldingen_tijd_idx ON admin_meldingen (gemaakt_op DESC)`;
}

// De tabellen worden één keer gebouwd per database, niet bij elke koude server
// opnieuw. Zie lib/schema-stand.ts. Verander je iets aan doEnsure(), hoog dan het
// cijfer in de versie hieronder op; anders komt het er nooit in.
const SCHEMA_VERSIE = "meldingen-9ed2eb54";

function ensureTable(): Promise<void> {
  return eenmalig("meldingen", SCHEMA_VERSIE, doEnsure);
}

/**
 * Een melding wegschrijven. Stil bij fouten: een melding die niet lukt mag nooit
 * het werk blokkeren dat hem veroorzaakte (dezelfde regel als het activiteitenlog).
 */
export async function meldingToevoegen(m: {
  soort: MeldingSoort;
  titel: string;
  regel?: string;
  link?: string | null;
  wie?: string;
  bron: string;
  bronId: string;
}): Promise<void> {
  try {
    await ensureSchema();
    await ensureTable();
    await sql`
      INSERT INTO admin_meldingen (soort, titel, regel, link, wie, bron, bron_id, gemaakt_op)
      VALUES (${m.soort}, ${m.titel}, ${m.regel || ""}, ${m.link || null}, ${m.wie || ""}, ${m.bron}, ${m.bronId}, now())
      ON CONFLICT (bron, bron_id, soort)
      DO UPDATE SET titel = ${m.titel}, regel = ${m.regel || ""}, link = ${m.link || null},
                    wie = ${m.wie || ""}, gemaakt_op = now()`;
  } catch {
    // stil
  }
}

/**
 * Een melding intrekken. Vinkt de sitebouwer iets weer úit, dan hoort de melding
 * "dit is af" te verdwijnen in plaats van te blijven staan als onwaarheid.
 */
export async function meldingIntrekken(bron: string, bronId: string, soort: MeldingSoort): Promise<void> {
  try {
    await ensureSchema();
    await ensureTable();
    await sql`DELETE FROM admin_meldingen WHERE bron = ${bron} AND bron_id = ${bronId} AND soort = ${soort}`;
  } catch {
    // stil
  }
}

/** De laatste meldingen, met per stuk of hij nieuw is sinds Maarten voor het laatst keek. */
export async function getMeldingen(gezienTot: string | null, limiet = 25): Promise<Melding[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT id, soort, titel, regel, link, wie, gemaakt_op
    FROM admin_meldingen ORDER BY gemaakt_op DESC LIMIT ${limiet}`;
  const grens = gezienTot ? new Date(gezienTot).getTime() : 0;
  return rows.map((r) => {
    const op = new Date(r.gemaakt_op as string).toISOString();
    return {
      id: Number(r.id),
      soort: r.soort as MeldingSoort,
      titel: (r.titel as string) || "",
      regel: (r.regel as string) || "",
      link: (r.link as string) || null,
      wie: (r.wie as string) || "",
      gemaaktOp: op,
      nieuw: new Date(op).getTime() > grens,
    };
  });
}
