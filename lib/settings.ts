import { sql, ensureSchema } from "./db";

// Kleine sleutel/waarde-instellingen (o.a. het administratie-e-mailadres voor
// de factuur-mail). Alleen door de eigenaar te lezen en te wijzigen.

export async function getSetting(key: string): Promise<string | null> {
  await ensureSchema();
  const { rows } = await sql`SELECT value FROM app_settings WHERE key = ${key} LIMIT 1`;
  return (rows[0]?.value as string) || null;
}

/**
 * Meerdere instellingen in ÉÉN vraag aan de database, in plaats van één vraag
 * per sleutel naast elkaar. Dat is niet alleen sneller (tien rondjes worden er
 * één); het is ook betrouwbaarder. Op 20-08-2026 gaf `getSetting` tien keer
 * tegelijk aangeroepen in een verse serverfunctie leeg terug, terwijl exact
 * dezelfde vraag een regel later wél de waarde gaf. Gevolg: de HubSpot-ronde
 * las een leeg filter, meldde "nog niet ingesteld" en haalde nooit iemand op,
 * terwijl het beheerscherm het filter keurig gevuld liet zien. Wie instellingen
 * bij elkaar nodig heeft, hoort ze dus zo te lezen.
 */
export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  await ensureSchema();
  // Eén tekstparameter met komma's ertussen, en Postgres maakt er de lijst van.
  // Bewust geen array-parameter: sleutelnamen bevatten nooit een komma, en deze
  // vorm werkt met elke driver hetzelfde.
  const { rows } = await sql<{ key: string; value: string | null }>`
    SELECT key, value FROM app_settings
    WHERE key = ANY(string_to_array(${keys.join(",")}, ','))`;
  const uit: Record<string, string> = {};
  for (const r of rows) if (r.value) uit[r.key] = r.value;
  return uit;
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
// Diep denken in de bird's eye: draait de strategie-chat op het zware model?
// Staat standaard AAN, want dat is het gesprek waar het oordeel vandaan moet
// komen. Uitzetten kan in de kop van Overview; het scheelt geld en kost diepgang.
export const SETTING_OVERVIEW_ZWAAR = "overview_diep_denken";

/** Staat diep denken aan voor de bird's eye? Leeg = aan (bewuste standaard). */
export async function diepDenkenAan(): Promise<boolean> {
  try { return (await getSetting(SETTING_OVERVIEW_ZWAAR)) !== "uit"; } catch { return true; }
}
// Wanneer de opruim-cron voor het laatst langskwam. Zonder dit moesten we gissen of
// het vangnet draaide; op 03-08-2026 stond een analyse 73 minuten stil en was van
// buitenaf niet te zien of de cron wel afvuurde.
export const SETTING_OPRUIM_CRON_TIK = "opruim_cron_laatste_tik";

// ── Google-bedrijfsprofiel ──
// Het Google-account waarmee Maarten in Chrome zit en waarmee hij toegang heeft
// tot Search Console, Analytics en de bedrijfsprofielen van klanten. Bewust NIET
// het Pingwin-mailadres: een uitnodiging naar het verkeerde adres komt bij
// niemand aan, en dat merk je pas weken later.
export const SETTING_GOOGLE_ACCOUNT = "google_account_adres";
// Het sjabloon voor de uitnodiging aan de klant. Leeg = de standaardtekst uit
// lib/gmb-kennis.ts. Instelbaar zodat de praktijk hem kan bijschaven zonder
// dat er code aan te pas komt.
export const SETTING_GMB_UITNODIGING = "gmb_uitnodiging_sjabloon";
