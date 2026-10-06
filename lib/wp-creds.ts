import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";
import { decryptSecret, encryptSecret } from "./wp-geheim";
import { testWordpressAuth } from "./wordpress";
import type { WpAuth } from "./wordpress";

// ═══════════════════════════════════════════════════════════
// DE WORDPRESS-KOPPELING VAN EEN KLANT: ÉÉN OPSLAG, ÉÉN INGANG
// ═══════════════════════════════════════════════════════════
// Een WordPress-applicatiewachtwoord (in WordPress: Gebruikers → profiel →
// Wachtwoorden voor applicaties) plus de gebruikersnaam, per klant. Alleen
// server-side gebruikt; het wachtwoord gaat nooit terug naar de browser.
//
// ── WAAROM DIT OP 21-08-2026 IS SAMENGEVOEGD ──
// Er waren TWEE opslagen voor precies hetzelfde wachtwoord, en die liepen uit
// elkaar zonder dat iemand het merkte:
//   1. de tabel `client_wp_creds`, gevuld vanaf het tabblad Wijzigingen, mét een
//      test vooraf: pas als WordPress "ja" zei werd hij bewaard;
//   2. de kolommen `clients.wp_user` en `clients.wp_app_pass_enc`, gevuld vanaf
//      het tabblad Meta & CTR, ZONDER test.
// Gevolg bij GardenSwimm: op Wijzigingen stond "WordPress is gekoppeld" en werd
// de hele bewerkingshistorie opgehaald, terwijl Meta & CTR in dezelfde minuut
// meldde "De site weigert de koppeling". Allebei waar, want het waren twee
// verschillende wachtwoorden. Maartens woorden: "ik snap niet waarom die het
// hier niet doet, want de site is gekoppeld".
//
// Dit bestand is nu de enige ingang. De versleutelde kolommen zijn de opslag
// (beter dan platte tekst), en de oude tabel wordt bij het eerste lezen
// overgezet: die waarde was namelijk de geteste, dus die wint. Daarna bestaat
// die tabel alleen nog als leeg overblijfsel.
//
// En bewaren gaat altijd via `bewaarKoppeling` hieronder, die éérst test. Een
// ongetest wachtwoord kan er dus niet meer in, ongeacht welk scherm het stuurt.
// ═══════════════════════════════════════════════════════════

// De tabellen worden één keer gebouwd per database, niet bij elke koude
// server opnieuw. Zie lib/schema-stand.ts. Verander je iets aan doEnsure(),
// hoog dan het cijfer in de versie hieronder op; anders komt het er nooit in.
const SCHEMA_VERSIE = "wp-creds-e5010cbd";

async function ensureTable(): Promise<void> {
  return eenmalig("wp-creds", SCHEMA_VERSIE, doEnsure);
}
async function doEnsure(): Promise<void> {
  // Blijft bestaan omdat er nog rijen in kunnen staan die hieronder overgezet
  // worden. Er wordt niet meer in geschreven.
  await sql`
    CREATE TABLE IF NOT EXISTS client_wp_creds (
      client_slug     TEXT PRIMARY KEY,
      wp_user         TEXT NOT NULL,
      wp_app_password TEXT NOT NULL,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}

/**
 * De oude, platte opslag overzetten naar de versleutelde. Draait alleen als daar
 * nog een rij staat, en gooit hem daarna weg.
 *
 * Waarom de oude wint van wat er al in `clients` staat: die rij is er alleen
 * gekomen nadat WordPress de inloggegevens goedkeurde, en de andere kon er
 * ongetest in. Bij GardenSwimm was dat precies het verschil tussen een werkende
 * en een geweigerde koppeling.
 */
// Welke klanten deze server al langs de oude tabel heeft gehad. Zonder dit zou
// élke leesactie er een extra vraag aan de database bij krijgen, voor een tabel
// die na de overzetting leeg blijft.
const alGekeken = new Set<string>();

async function zetOudeOpslagOver(slug: string): Promise<WpAuth> {
  if (alGekeken.has(slug)) return null;
  alGekeken.add(slug);
  const { rows } = await sql`SELECT wp_user, wp_app_password FROM client_wp_creds WHERE client_slug = ${slug} LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  const auth = { user: String(r.wp_user), appPassword: String(r.wp_app_password) };
  try {
    await sql`
      UPDATE clients SET wp_user = ${auth.user}, wp_app_pass_enc = ${encryptSecret(auth.appPassword)} WHERE slug = ${slug}`;
    await sql`DELETE FROM client_wp_creds WHERE client_slug = ${slug}`;
  } catch { /* lukt het overzetten niet, dan blijft de rij staan en proberen we het later opnieuw */ }
  return auth;
}

export async function getWpCreds(slug: string): Promise<WpAuth> {
  await ensureSchema();
  await ensureTable();
  const overgezet = await zetOudeOpslagOver(slug);
  if (overgezet) return overgezet;
  const { rows } = await sql`SELECT wp_user, wp_app_pass_enc FROM clients WHERE slug = ${slug} LIMIT 1`;
  const r = rows[0];
  if (!r?.wp_user || !r?.wp_app_pass_enc) return null;
  try {
    return { user: String(r.wp_user), appPassword: decryptSecret(String(r.wp_app_pass_enc)) };
  } catch {
    // Niet te ontsleutelen (SESSION_SECRET is veranderd): dan is er geen
    // bruikbare koppeling, en dat is eerlijker dan een fout wachtwoord meesturen.
    return null;
  }
}

export async function hasWpCreds(slug: string): Promise<boolean> {
  return (await getWpCreds(slug)) !== null;
}

/** Wat een scherm mag weten: is er een koppeling, en op welke naam. */
export async function wpKoppelingStand(slug: string): Promise<{ connected: boolean; username: string | null }> {
  const creds = await getWpCreds(slug);
  return { connected: !!creds, username: creds?.user || null };
}

/**
 * Bewaren gaat altijd langs de test.
 *
 * Dat was op één van de twee schermen niet zo, en dat is precies hoe er een
 * wachtwoord in kwam dat WordPress weigerde terwijl het dashboard "gekoppeld"
 * bleef melden. Nu kan dat niet meer, welk scherm het ook stuurt.
 */
export async function bewaarKoppeling(
  slug: string,
  domain: string,
  user: string,
  appPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  const naam = (user || "").trim();
  const wachtwoord = (appPassword || "").trim();
  if (!naam || !wachtwoord) return { ok: false, error: "Vul de gebruikersnaam en het applicatiewachtwoord in." };
  if (!domain) return { ok: false, error: "Deze klant heeft nog geen domein ingevuld." };
  const test = await testWordpressAuth(domain, { user: naam, appPassword: wachtwoord }, slug);
  if (!test.ok) return { ok: false, error: test.error || "Inloggegevens werken niet." };
  await saveWpCreds(slug, naam, wachtwoord);
  return { ok: true };
}

/** Rechtstreeks wegschrijven, zonder test. Gebruik `bewaarKoppeling`. */
export async function saveWpCreds(slug: string, user: string, appPassword: string): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`
    UPDATE clients SET wp_user = ${user}, wp_app_pass_enc = ${encryptSecret(appPassword)} WHERE slug = ${slug}`;
  await sql`DELETE FROM client_wp_creds WHERE client_slug = ${slug}`;
}

export async function deleteWpCreds(slug: string): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`UPDATE clients SET wp_user = NULL, wp_app_pass_enc = NULL WHERE slug = ${slug}`;
  await sql`DELETE FROM client_wp_creds WHERE client_slug = ${slug}`;
}
