import { sql, ensureSchema } from "./db";
import type { WpAuth } from "./wordpress";

// ═══════════════════════════════════════════════════════════
// WORDPRESS-INLOGGEGEVENS per klant (voor de revisions-historie)
// ═══════════════════════════════════════════════════════════
// Een WordPress application password (Gebruikers → profiel → Wachtwoorden voor
// applicaties) plus de gebruikersnaam, per klant. Alleen server-side gebruikt om
// de bewerkingshistorie op te halen. Gevoelig: nooit terug naar de browser
// sturen; de UI toont alleen of het is ingesteld.
// ═══════════════════════════════════════════════════════════

let tableReady: Promise<void> | null = null;
async function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_wp_creds (
      client_slug     TEXT PRIMARY KEY,
      wp_user         TEXT NOT NULL,
      wp_app_password TEXT NOT NULL,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}

export async function getWpCreds(slug: string): Promise<WpAuth> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT wp_user, wp_app_password FROM client_wp_creds WHERE client_slug = ${slug} LIMIT 1`;
  if (!rows[0]) return null;
  return { user: rows[0].wp_user as string, appPassword: rows[0].wp_app_password as string };
}

export async function hasWpCreds(slug: string): Promise<boolean> {
  return (await getWpCreds(slug)) !== null;
}

export async function saveWpCreds(slug: string, user: string, appPassword: string): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`
    INSERT INTO client_wp_creds (client_slug, wp_user, wp_app_password, updated_at)
    VALUES (${slug}, ${user}, ${appPassword}, now())
    ON CONFLICT (client_slug) DO UPDATE SET wp_user = ${user}, wp_app_password = ${appPassword}, updated_at = now()`;
}

export async function deleteWpCreds(slug: string): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`DELETE FROM client_wp_creds WHERE client_slug = ${slug}`;
}
