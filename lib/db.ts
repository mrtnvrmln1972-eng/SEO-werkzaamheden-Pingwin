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
