import { sql, ensureSchema } from "./db";
import { BRONNEN, laatstGelukt, laatsteGebeurtenis, type BronId } from "./bron-gezondheid";
import { ahrefsConfigured, ahrefsHealthCheck } from "./ahrefs";
import { googleConfigured, getGoogleAccessToken, getDriveAccessToken, getProfielAccessToken } from "./google";
import { msConfigured, msHealthCheck } from "./ms-graph";
import { moneybirdConfigured, moneybirdHealthCheck } from "./moneybird";
import { listClients } from "./clients";
import { getWpCreds } from "./wp-creds";
import { testWordpressAuth } from "./wordpress";

// ═══════════════════════════════════════════════════════════
// DE AGGREGATIE: ALLE BRONNEN SAMEN BEKEKEN
// ═══════════════════════════════════════════════════════════
// Dit bestand hangt (in tegenstelling tot lib/bron-gezondheid.ts zelf) wél van
// elke koppeling af, want het roept per bron een verse, echte controle aan en
// legt die meteen vast. Zo is een losgetrokken koppeling binnen een minuut
// zichtbaar: het openen van het scherm IS de controle, niet een wachten op de
// eerstvolgende toevallige aanroep.
// ═══════════════════════════════════════════════════════════

export type BronStand = "werkt" | "storing" | "niet-gekoppeld" | "niet-ingesteld";

export type BronStatus = {
  id: BronId;
  naam: string;
  herstelPad?: string;
  stand: BronStand;
  melding: string;
  laatstGelukt: string | null;
};

function naamVoor(id: BronId): string {
  return BRONNEN.find((b) => b.id === id)?.naam || id;
}
function herstelPadVoor(id: BronId): string | undefined {
  return BRONNEN.find((b) => b.id === id)?.herstelPad;
}

async function statusAhrefs(): Promise<BronStatus> {
  const id: BronId = "ahrefs";
  if (!ahrefsConfigured()) {
    return { id, naam: naamVoor(id), stand: "niet-ingesteld", melding: "Geen API-sleutel ingesteld (AHREFS_API_TOKEN ontbreekt in deze omgeving).", laatstGelukt: null };
  }
  const r = await ahrefsHealthCheck();
  const laatste = await laatstGelukt(id);
  return { id, naam: naamVoor(id), stand: r.ok ? "werkt" : "storing", melding: r.melding, laatstGelukt: laatste };
}

async function statusGoogle(id: "google_data" | "google_drive" | "google_profiel", provider: string, ophalen: () => Promise<string | null>): Promise<BronStatus> {
  if (!googleConfigured()) {
    return { id, naam: naamVoor(id), herstelPad: herstelPadVoor(id), stand: "niet-ingesteld", melding: "De Google-koppeling is niet ingesteld in deze omgeving.", laatstGelukt: null };
  }
  await ensureSchema();
  const { rows } = await sql`SELECT refresh_token FROM oauth_tokens WHERE provider = ${provider} LIMIT 1`;
  if (!rows[0]?.refresh_token) {
    return { id, naam: naamVoor(id), herstelPad: herstelPadVoor(id), stand: "niet-gekoppeld", melding: "Nog niet gekoppeld.", laatstGelukt: null };
  }
  const token = await ophalen(); // logt zelf een gebeurtenis (zie lib/google.ts accessTokenFor)
  const laatste = await laatstGelukt(id);
  if (!token) {
    const gebeurtenis = await laatsteGebeurtenis(id);
    return { id, naam: naamVoor(id), herstelPad: herstelPadVoor(id), stand: "storing", melding: gebeurtenis?.reden || "Token vernieuwen mislukt.", laatstGelukt: laatste };
  }
  return { id, naam: naamVoor(id), herstelPad: herstelPadVoor(id), stand: "werkt", melding: "Werkt.", laatstGelukt: laatste };
}

async function statusMicrosoft(): Promise<BronStatus> {
  const id: BronId = "microsoft";
  if (!msConfigured()) {
    return { id, naam: naamVoor(id), herstelPad: herstelPadVoor(id), stand: "niet-ingesteld", melding: "Niet ingesteld in deze omgeving.", laatstGelukt: null };
  }
  await ensureSchema();
  const { rows } = await sql`SELECT refresh_token FROM oauth_tokens WHERE provider = 'microsoft' LIMIT 1`;
  if (!rows[0]?.refresh_token) {
    return { id, naam: naamVoor(id), herstelPad: herstelPadVoor(id), stand: "niet-gekoppeld", melding: "Nog niet gekoppeld.", laatstGelukt: null };
  }
  const r = await msHealthCheck();
  const laatste = await laatstGelukt(id);
  return { id, naam: naamVoor(id), herstelPad: herstelPadVoor(id), stand: r.ok ? "werkt" : "storing", melding: r.melding, laatstGelukt: laatste };
}

async function statusMoneybird(): Promise<BronStatus> {
  const id: BronId = "moneybird";
  if (!moneybirdConfigured()) {
    return { id, naam: naamVoor(id), stand: "niet-ingesteld", melding: "Niet ingesteld in deze omgeving (MONEYBIRD_API_TOKEN of MONEYBIRD_ADMINISTRATION_ID ontbreekt).", laatstGelukt: null };
  }
  const r = await moneybirdHealthCheck();
  const laatste = await laatstGelukt(id);
  return { id, naam: naamVoor(id), stand: r.ok ? "werkt" : "storing", melding: r.melding, laatstGelukt: laatste };
}

/** Alle koppelingen die niet per klant zijn: één verse controle per bron. */
export async function controleerAlleBronnen(): Promise<BronStatus[]> {
  const [ahrefs, googleData, googleDrive, googleProfiel, microsoft, moneybird] = await Promise.all([
    statusAhrefs(),
    statusGoogle("google_data", "google", getGoogleAccessToken),
    statusGoogle("google_drive", "google_drive", getDriveAccessToken),
    statusGoogle("google_profiel", "google_profiel", getProfielAccessToken),
    statusMicrosoft(),
    statusMoneybird(),
  ]);
  return [ahrefs, googleData, googleDrive, googleProfiel, microsoft, moneybird];
}

export type WpKlantStatus = { slug: string; naam: string; stand: BronStand; melding: string; laatstGelukt: string | null };

/**
 * WordPress is per klant gekoppeld, dus geen enkele "bron" maar een lijstje.
 * Alleen klanten met opgeslagen inloggegevens worden echt getest; de rest heeft
 * simpelweg geen WordPress-koppeling en hoort niet in de storingslijst.
 */
export async function controleerWordpressKlanten(): Promise<WpKlantStatus[]> {
  const clients = await listClients();
  const out: WpKlantStatus[] = [];
  for (const c of clients) {
    if (!c.domain) continue;
    const creds = await getWpCreds(c.slug);
    if (!creds) continue;
    const test = await testWordpressAuth(c.domain, creds, c.slug); // logt zelf
    const laatste = await laatstGelukt("wordpress", c.slug);
    out.push({
      slug: c.slug,
      naam: c.name,
      stand: test.ok ? "werkt" : "storing",
      melding: test.ok ? "Werkt." : (test.error || "Onbekende fout."),
      laatstGelukt: laatste,
    });
  }
  return out;
}
