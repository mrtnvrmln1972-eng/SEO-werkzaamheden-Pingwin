import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";

// ═══════════════════════════════════════════════════════════
// BRONNEN-GEZONDHEID: WELKE KOPPELING IS VANDAAG STIL? (R7)
// ═══════════════════════════════════════════════════════════
// Er hangen tien koppelingen aan dit dashboard (Ahrefs, Google Search Console
// en Analytics, Google Drive, Google Bedrijfsprofiel, Microsoft 365, Moneybird,
// WordPress per klant, ...) en elke koppeling kan een dag stil zijn: een
// verlopen toegang, een limiet, een storing. Per onderdeel werd dat al lokaal
// opgevangen, maar er was geen plek waar stond: dit werkt vandaag, dit niet, en
// dit cijfer is dus ouder dan het lijkt.
//
// Bewust een LEAF-module: dit bestand importeert alleen db.ts. De losse
// koppelingen (lib/ahrefs.ts, lib/google.ts, lib/ms-graph.ts, lib/moneybird.ts,
// lib/wordpress.ts) importeren `logBronGebeurtenis` hiervandaan om bij elk
// gebruik weg te schrijven of het lukte. Zou dit bestand op zijn beurt van die
// koppelingen afhangen, dan ontstaat een kringverwijzing. De aggregatie die alle
// bronnen samen bekijkt (en dus wél van elke koppeling afhangt) staat daarom
// apart in lib/bron-gezondheid-controle.ts.
// ═══════════════════════════════════════════════════════════

export type BronId = "ahrefs" | "google_data" | "google_drive" | "google_profiel" | "microsoft" | "moneybird" | "wordpress";

export type BronDef = { id: BronId; naam: string; herstelPad?: string; perKlant?: boolean };

/** De bekende koppelingen, in gewone taal. Eén bron voor naam en herstelpad. */
export const BRONNEN: BronDef[] = [
  { id: "ahrefs", naam: "Ahrefs (zoekwoorden, concurrenten, SERP)" },
  { id: "google_data", naam: "Google (Search Console en Analytics)", herstelPad: "/admin/beheer" },
  { id: "google_drive", naam: "Google Drive (documenten)", herstelPad: "/admin/beheer" },
  { id: "google_profiel", naam: "Google Bedrijfsprofiel (bezoekcijfers, reviews)", herstelPad: "/admin/beheer" },
  { id: "microsoft", naam: "Microsoft 365 (mail en agenda)", herstelPad: "/admin/beheer" },
  { id: "moneybird", naam: "Moneybird (facturen en budget)" },
  { id: "wordpress", naam: "WordPress-koppeling per klant", perKlant: true },
];

// De tabellen worden één keer gebouwd per database, niet bij elke koude
// server opnieuw. Zie lib/schema-stand.ts. Verander je iets aan doEnsure(),
// hoog dan het cijfer in de versie hieronder op; anders komt het er nooit in.
const SCHEMA_VERSIE = "bron-gezondheid-8dbb1c49";

function ensureTable(): Promise<void> {
  return eenmalig("bron-gezondheid", SCHEMA_VERSIE, doEnsure);
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS bron_events (
      id          SERIAL PRIMARY KEY,
      bron        TEXT NOT NULL,
      client_slug TEXT,
      ok          BOOLEAN NOT NULL,
      reden       TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS bron_events_bron_idx ON bron_events (bron, client_slug, created_at DESC)`;
}

/**
 * Schrijft één uitkomst weg: gelukt of niet, en bij een fout de reden in gewone
 * taal. Wordt aangeroepen vanuit de koppelingen zelf, bij elk echt gebruik.
 * Mag de aanroepende actie nooit breken, dus faalt zelf altijd stil.
 */
export async function logBronGebeurtenis(bron: BronId, ok: boolean, reden = "", clientSlug: string | null = null): Promise<void> {
  try {
    await ensureSchema();
    await ensureTable();
    await sql`
      INSERT INTO bron_events (bron, client_slug, ok, reden)
      VALUES (${bron}, ${clientSlug}, ${ok}, ${reden.slice(0, 500)})`;
    // Lichte opruiming: deze tabel groeit met elk gebruik van elke koppeling.
    // Eén op de vijftig schrijfacties ruimt rijen ouder dan 90 dagen op, zodat
    // dit nooit een los onderhoudsklusje hoeft te worden.
    if (Math.random() < 0.02) {
      await sql`DELETE FROM bron_events WHERE created_at < now() - interval '90 days'`;
    }
  } catch {
    // Loggen mag nooit de echte actie breken.
  }
}

/** Wanneer deze bron voor het laatst een geslaagde actie logde. */
export async function laatstGelukt(bron: BronId, clientSlug: string | null = null): Promise<string | null> {
  await ensureSchema();
  await ensureTable();
  const { rows } = clientSlug
    ? await sql`SELECT created_at FROM bron_events WHERE bron = ${bron} AND client_slug = ${clientSlug} AND ok = true ORDER BY created_at DESC LIMIT 1`
    : await sql`SELECT created_at FROM bron_events WHERE bron = ${bron} AND client_slug IS NULL AND ok = true ORDER BY created_at DESC LIMIT 1`;
  const w = rows[0]?.created_at;
  return w ? new Date(w as string).toISOString() : null;
}

/** De allerlaatste gebeurtenis van deze bron, gelukt of niet. */
export async function laatsteGebeurtenis(bron: BronId, clientSlug: string | null = null): Promise<{ ok: boolean; reden: string; wanneer: string } | null> {
  await ensureSchema();
  await ensureTable();
  const { rows } = clientSlug
    ? await sql`SELECT ok, reden, created_at FROM bron_events WHERE bron = ${bron} AND client_slug = ${clientSlug} ORDER BY created_at DESC LIMIT 1`
    : await sql`SELECT ok, reden, created_at FROM bron_events WHERE bron = ${bron} AND client_slug IS NULL ORDER BY created_at DESC LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  return { ok: !!r.ok, reden: String(r.reden || ""), wanneer: new Date(r.created_at as string).toISOString() };
}

/** Voor het routekaart-bewijs: staat er al minstens één keer een uitkomst in? */
export async function aantalGebeurtenissen(): Promise<number> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT COUNT(*)::int AS n FROM bron_events`;
  return Number(rows[0]?.n || 0);
}
