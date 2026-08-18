import crypto from "crypto";
import { sql } from "./db";
import { eenmalig } from "./schema-stand";

// ═══════════════════════════════════════════════════════════
// DE SLEUTEL VAN DE VERHUISDEUR
// ═══════════════════════════════════════════════════════════
// De verhuizing gaat van server naar server: de oude omgeving stuurt zijn
// gegevens rechtstreeks naar de nieuwe. Die deur moet dus open kunnen zonder
// dat er iemand ingelogd is, en dat is precies het soort deur dat je niet zomaar
// open laat staan.
//
// Daarom een code die de ONTVANGENDE kant zelf maakt, met een eigen scherm en
// een knop. Hij is een uur geldig, hoort bij één klant, en kan met één klik
// worden ingetrokken. Zonder geldige code bestaat de deur niet; er is geen
// stand waarin hij "standaard open" staat, want dat is precies de fout die deze
// repo in augustus 2026 al een keer gemaakt heeft met de snelle beheerder-ingang.
//
// De code zelf staat versleuteld opgeslagen, net als een wachtwoord: wie in de
// database kijkt, kan er niet mee naar binnen.
// ═══════════════════════════════════════════════════════════

const SCHEMA_VERSIE = "verhuis-code-1a4f90c2";
const GELDIG_MINUTEN = 60;

async function ensureTable(): Promise<void> {
  return eenmalig("verhuis-code", SCHEMA_VERSIE, async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS verhuis_codes (
        afdruk     TEXT PRIMARY KEY,
        slug       TEXT NOT NULL,
        gemaakt    TIMESTAMPTZ NOT NULL DEFAULT now(),
        vervalt    TIMESTAMPTZ NOT NULL,
        ingetrokken BOOLEAN NOT NULL DEFAULT false
      )`;
  });
}

function afdruk(code: string): string {
  return crypto.createHash("sha256").update(code.trim()).digest("hex");
}

export type CodeStand = { actief: boolean; slug: string; vervalt: string | null };

// Maakt één nieuwe code voor één klant en trekt de vorige codes voor die klant
// in. De code komt maar één keer in beeld, hier.
export async function maakCode(slug: string): Promise<string> {
  await ensureTable();
  const code = crypto.randomBytes(24).toString("base64url");
  await sql`UPDATE verhuis_codes SET ingetrokken = true WHERE slug = ${slug} AND ingetrokken = false`;
  await sql`
    INSERT INTO verhuis_codes (afdruk, slug, vervalt)
    VALUES (${afdruk(code)}, ${slug}, now() + (${GELDIG_MINUTEN}::int * INTERVAL '1 minute'))`;
  return code;
}

export async function trekIn(slug: string): Promise<void> {
  await ensureTable();
  await sql`UPDATE verhuis_codes SET ingetrokken = true WHERE slug = ${slug} AND ingetrokken = false`;
}

// Staat er voor deze klant een code open, en tot hoe laat? Zonder de code zelf,
// die is hier niet meer terug te lezen.
export async function stand(slug: string): Promise<CodeStand> {
  await ensureTable();
  const { rows } = await sql`
    SELECT vervalt FROM verhuis_codes
    WHERE slug = ${slug} AND ingetrokken = false AND vervalt > now()
    ORDER BY gemaakt DESC LIMIT 1`;
  const r = rows[0];
  return { actief: Boolean(r), slug, vervalt: r ? new Date(r.vervalt as string).toISOString() : null };
}

// Hoort deze code bij deze klant en is hij nog geldig? Alles wat niet klopt
// geeft hetzelfde antwoord: nee.
export async function codeGeldig(code: string, slug: string): Promise<boolean> {
  if (!code || !slug) return false;
  await ensureTable();
  const { rows } = await sql`
    SELECT 1 FROM verhuis_codes
    WHERE afdruk = ${afdruk(code)} AND slug = ${slug}
      AND ingetrokken = false AND vervalt > now()
    LIMIT 1`;
  return rows.length > 0;
}
