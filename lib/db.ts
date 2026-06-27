import { sql } from "@vercel/postgres";
import { hashPassword } from "./password";

// ═══════════════════════════════════════════════════════════
// DATABASE-INITIALISATIE (zelfhelend)
// ═══════════════════════════════════════════════════════════
// De Neon-verbindingsgegevens zijn afgeschermde integratie-variabelen
// die alleen tijdens runtime op Vercel beschikbaar zijn (niet lokaal op
// te halen). Daarom maakt de app de tabel zelf aan bij de eerste query.
// Idempotent (CREATE TABLE IF NOT EXISTS / ON CONFLICT DO NOTHING) en het
// draait maximaal één keer per serverinstantie.
// ═══════════════════════════════════════════════════════════

let ready: Promise<void> | null = null;

async function init(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id               SERIAL PRIMARY KEY,
      slug             TEXT UNIQUE NOT NULL,
      login_id         TEXT UNIQUE NOT NULL,
      name             TEXT NOT NULL,
      email            TEXT,
      sheet_id         TEXT NOT NULL,
      gid              TEXT NOT NULL DEFAULT '0',
      maandbudget      NUMERIC NOT NULL DEFAULT 0,
      linkbuilding     NUMERIC NOT NULL DEFAULT 0,
      urenbudget       NUMERIC NOT NULL DEFAULT 0,
      uurtarief        NUMERIC NOT NULL DEFAULT 100,
      beschikbare_uren NUMERIC NOT NULL DEFAULT 0,
      password_hash    TEXT NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  // Cockpit-velden (Maartens beheerkant). Optioneel, los van de klant-login.
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS email_domain TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS work_doc_url TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS results_url TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS status TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_contact TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT`;

  // Koppelvelden voor de data-brug: de website van de klant en het Ahrefs-project.
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS domain TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS ahrefs_project_id TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS ga4_property_id TEXT`;

  // ── Data-brug: ingeladen snapshots per klant (uit Outlook / GSC / GA4 / Ahrefs) ──
  // Gevuld via POST /api/admin/ingest. Het dashboard leest hieruit, ook als er
  // geen Claude-sessie draait. Idempotent: opnieuw inladen overschrijft per sleutel.
  await sql`
    CREATE TABLE IF NOT EXISTS client_emails (
      id           TEXT PRIMARY KEY,
      client_slug  TEXT NOT NULL,
      subject      TEXT,
      from_name    TEXT,
      from_address TEXT,
      received_at  TIMESTAMPTZ,
      preview      TEXT,
      web_link     TEXT,
      direction    TEXT,
      ingested_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_emails_slug_date ON client_emails (client_slug, received_at DESC)`;
  await sql`ALTER TABLE client_emails ADD COLUMN IF NOT EXISTS superhuman_link TEXT`;
  await sql`ALTER TABLE client_emails ADD COLUMN IF NOT EXISTS body_html TEXT`;

  // Actuele stand van zaken per klant: een set kaartjes (titel/kleur/bullets),
  // opgeslagen als JSON-tekst. Wordt via de brug bijgewerkt op basis van de mails.
  await sql`
    CREATE TABLE IF NOT EXISTS client_status (
      client_slug TEXT PRIMARY KEY,
      content     TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  // Bewaarde projectchat per klant (JSON-array van berichten).
  await sql`
    CREATE TABLE IF NOT EXISTS client_chat (
      client_slug TEXT PRIMARY KEY,
      messages    TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  // Werkzaamheden per klant, ín het dashboard (alternatief voor de Google Sheet).
  // SEO- en Dev-taken samen; per maand, met uren, status, link en zichtbaarheid
  // voor het klant-dashboard. Volgorde via sort_order (slepen).
  await sql`
    CREATE TABLE IF NOT EXISTS client_tasks (
      id              SERIAL PRIMARY KEY,
      client_slug     TEXT NOT NULL,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      categorie       TEXT,
      taak            TEXT,
      toelichting     TEXT,
      uren            NUMERIC,
      status          TEXT,
      maand           TEXT,
      link            TEXT,
      wie             TEXT,
      klant_zichtbaar BOOLEAN NOT NULL DEFAULT false,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_client_tasks_slug ON client_tasks (client_slug, sort_order)`;

  // OAuth-tokens voor externe koppelingen (Microsoft Graph, Google).
  // Eén rij per provider; bewaart de refresh-token waarmee de app zelf
  // access-tokens vernieuwt. Alleen via het admin-beveiligde koppel-pad gevuld.
  await sql`
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      provider      TEXT PRIMARY KEY,
      refresh_token TEXT,
      account       TEXT,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS client_metrics (
      client_slug TEXT NOT NULL,
      source      TEXT NOT NULL,
      metric      TEXT NOT NULL,
      period      TEXT NOT NULL,
      value       NUMERIC,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, source, metric, period)
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS client_keywords (
      client_slug   TEXT NOT NULL,
      keyword       TEXT NOT NULL,
      position      NUMERIC,
      prev_position NUMERIC,
      volume        NUMERIC,
      url           TEXT,
      captured_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, keyword)
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS client_pages (
      client_slug TEXT NOT NULL,
      url         TEXT NOT NULL,
      clicks      NUMERIC,
      impressions NUMERIC,
      traffic     NUMERIC,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, url)
    )`;

  // Eerste klant (One Day Clinic) zodat zijn login meteen werkt.
  const hash = hashPassword("OneDayClinic2026");
  await sql`
    INSERT INTO clients
      (slug, login_id, name, email, sheet_id, gid,
       maandbudget, linkbuilding, urenbudget, uurtarief, beschikbare_uren, password_hash)
    VALUES
      ('one-day-clinic', 'onedayclinic', 'One Day Clinic', NULL,
       '1O1HeqzxCBH-WeyIhb4QhTniBj_Z7RxGpXl5L5FfJW5I', '1531693305',
       1800, 600, 1200, 100, 12, ${hash})
    ON CONFLICT (slug) DO NOTHING`;

  // Overige klanten, alleen op naam aangemaakt. Sheet-link, e-mail en budget
  // vul je later per klant aan via de Bewerken-knop in de cockpit. Een
  // tijdelijk wachtwoord staat klaar; reset het in de cockpit als de klant
  // straks zelf moet kunnen inloggen.
  const initialClients = [
    { slug: "bogard", name: "Bogard" },
    { slug: "strandtuin", name: "Strandtuin" },
    { slug: "kamsteeg", name: "Kamsteeg" },
    { slug: "pronk", name: "Pronk" },
    { slug: "gardenswimm", name: "GardenSwimm" },
    { slug: "wim-prins", name: "Wim Prins" },
    { slug: "paul-hoevenaars", name: "Paul Hoevenaars" },
    { slug: "odc-test", name: "ODC TEST" },
  ];
  for (const c of initialClients) {
    const ph = hashPassword(`${c.slug}-tijdelijk-2026`);
    await sql`
      INSERT INTO clients (slug, login_id, name, sheet_id, password_hash)
      VALUES (${c.slug}, ${c.slug}, ${c.name}, '', ${ph})
      ON CONFLICT (slug) DO NOTHING`;
  }
}

export function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = init().catch((err) => {
      ready = null; // bij fout opnieuw proberen bij volgende request
      throw err;
    });
  }
  return ready;
}

export { sql };
