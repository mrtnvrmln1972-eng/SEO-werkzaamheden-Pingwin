import { sql, ensureSchema } from "./db";

// Kleine sleutel/waarde-instellingen (o.a. het administratie-e-mailadres voor
// de factuur-mail). Alleen door de eigenaar te lezen en te wijzigen.

export async function getSetting(key: string): Promise<string | null> {
  await ensureSchema();
  const { rows } = await sql`SELECT value FROM app_settings WHERE key = ${key} LIMIT 1`;
  return (rows[0]?.value as string) || null;
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  await ensureSchema();
  const v = (value || "").trim() || null;
  await sql`
    INSERT INTO app_settings (key, value) VALUES (${key}, ${v})
    ON CONFLICT (key) DO UPDATE SET value = ${v}`;
}

// Bekende sleutels.
export const SETTING_INVOICE_MAIL = "invoice_mail_to";
// Wanneer de opruim-cron voor het laatst langskwam. Zonder dit moesten we gissen of
// het vangnet draaide; op 03-08-2026 stond een analyse 73 minuten stil en was van
// buitenaf niet te zien of de cron wel afvuurde.
export const SETTING_OPRUIM_CRON_TIK = "opruim_cron_laatste_tik";
