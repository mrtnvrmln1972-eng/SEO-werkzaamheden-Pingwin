import { sql, ensureSchema } from "./db";
import { hashPassword, verifyPassword, generatePassword } from "./password";

// ═══════════════════════════════════════════════════════════
// KIJK-SLEUTEL VOOR CLAUDE
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat: Maarten wil dat Claude standaard kan meekijken in het
// dashboard, in elke sessie en elke wereld, zonder per keer een link te delen
// en zonder wachtwoorden heen en weer te sturen.
//
// Hoe het werkt: hij drukt één keer op de knop in de cockpit, krijgt een lange
// sleutel, en zet die als omgevingsvariabele in zijn Claude-omgeving. Claude
// wisselt die sleutel in voor een alleen-lezen sessie (/api/kijk).
//
// Drie bewuste keuzes:
//  - De sleutel staat als scrypt-hash in de database, niet plat en niet in een
//    env-var van Vercel. Zo kan hij met één knop ingetrokken worden zonder een
//    deploy, en staat de waarde nergens leesbaar.
//  - Alleen lezen. De rechten zitten in lib/admin-scope.ts; hier gaat het puur
//    om "is deze sleutel geldig".
//  - Eén sleutel tegelijk. Een nieuwe aanmaken trekt de oude in, zodat er nooit
//    een vergeten sleutel blijft rondslingeren.
// ═══════════════════════════════════════════════════════════

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS claude_view_key (
      id         SERIAL PRIMARY KEY,
      key_hash   TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      revoked_at TIMESTAMPTZ,
      last_used  TIMESTAMPTZ
    )`;
}

export type ViewKeyStatus = { actief: boolean; aangemaakt: string | null; laatstGebruikt: string | null };

/** Staat er een geldige kijk-sleutel klaar, en wanneer is hij voor het laatst gebruikt? */
export async function getViewKeyStatus(): Promise<ViewKeyStatus> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT created_at, last_used FROM claude_view_key
    WHERE revoked_at IS NULL ORDER BY id DESC LIMIT 1`;
  const r = rows[0];
  if (!r) return { actief: false, aangemaakt: null, laatstGebruikt: null };
  return {
    actief: true,
    aangemaakt: r.created_at ? new Date(r.created_at as string).toISOString() : null,
    laatstGebruikt: r.last_used ? new Date(r.last_used as string).toISOString() : null,
  };
}

/**
 * Maakt een nieuwe sleutel en trekt alle oude in. De platte waarde komt hier
 * één keer uit; daarna bestaat alleen de hash nog. Kwijt = nieuwe maken.
 */
export async function createViewKey(): Promise<string> {
  await ensureSchema();
  await ensureTable();
  // 40 tekens uit de alfabet-generator: ruim te lang om te raden, en zonder
  // tekens die in een URL of een .env-regel voor verwarring zorgen.
  const plat = `pw-kijk-${generatePassword(40)}`;
  await sql`UPDATE claude_view_key SET revoked_at = now() WHERE revoked_at IS NULL`;
  await sql`INSERT INTO claude_view_key (key_hash) VALUES (${hashPassword(plat)})`;
  return plat;
}

/** Trekt de huidige sleutel in. Daarna komt Claude er niet meer bij. */
export async function revokeViewKey(): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`UPDATE claude_view_key SET revoked_at = now() WHERE revoked_at IS NULL`;
}

/**
 * Klopt deze sleutel? Zo ja, stempelt hij meteen "laatst gebruikt", zodat in de
 * cockpit te zien is of Claude er nog gebruik van maakt.
 */
export async function checkViewKey(sleutel: string): Promise<boolean> {
  const s = (sleutel || "").trim();
  if (!s) return false;
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT id, key_hash FROM claude_view_key
    WHERE revoked_at IS NULL ORDER BY id DESC LIMIT 1`;
  const r = rows[0];
  if (!r) return false;
  if (!verifyPassword(s, r.key_hash as string)) return false;
  await sql`UPDATE claude_view_key SET last_used = now() WHERE id = ${r.id as number}`;
  return true;
}
