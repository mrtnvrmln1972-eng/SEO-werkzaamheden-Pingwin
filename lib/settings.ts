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
