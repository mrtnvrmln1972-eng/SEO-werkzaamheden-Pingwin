import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import { sql, ensureSchema } from "../../../../lib/db";
import { hashPassword, verifyPassword, generatePassword } from "../../../../lib/password";
import { MAX_ACTIEF, getActiveKeys } from "../../../../lib/claude-view-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// TIJDELIJKE MEETROUTE: WAAROM WORDT EEN VERSE SLEUTEL GEWEIGERD?
// ═══════════════════════════════════════════════════════════
// Aangemaakt op 26-08-2026. Een net aangemaakte kijk-sleutel werd meteen
// afgewezen met "andere-sleutel", ook door de zelftest in de cockpit zelf.
// Er zijn maar twee manieren waarop dat kan:
//
//   1. De hash die opgeslagen wordt is niet de hash die er weer uitkomt
//      (afgekapt, verminkt, andere kolom). Dan faalt verifyPassword terecht.
//   2. De verse rij zit niet in de set die gecontroleerd wordt. Dan klopt de
//      hash prima en kijkt de controle er simpelweg langs.
//
// Deze route meet allebei, zonder een echte sleutel uit te delen: de proefhash
// gaat als INGETROKKEN rij de tabel in (dus hij kan nooit een deur openen) en
// wordt daarna weer weggegooid.
//
// HAAL DIT BESTAND WEG zodra de oorzaak vaststaat. Een meetroute die blijft
// staan is een tweede plek die kan gaan afwijken van het echte pad.
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const g = await guardOwner(req);
  if (!g.ok) return g.res;

  await ensureSchema();
  // Langs de gewone weg, zodat de tabel gegarandeerd bestaat en we meteen zien
  // hoeveel sleutels de controle zélf te zien krijgt.
  const gezienDoorDeControle = (await getActiveKeys()).length;

  // ── Meting 1: overleeft een hash de reis naar de database en terug? ──
  const proefsleutel = `pw-proef-${generatePassword(40)}`;
  const hashInGeheugen = hashPassword(proefsleutel);
  const verifyInGeheugen = verifyPassword(proefsleutel, hashInGeheugen);

  // Meteen als ingetrokken wegschrijven: deze rij mag nooit een sleutel zijn
  // die ergens de deur opent, hij is er alleen om de kolom te meten.
  const geschreven = await sql`
    INSERT INTO claude_view_key (key_hash, revoked_at) VALUES (${hashInGeheugen}, now())
    RETURNING id`;
  const proefId = Number(geschreven.rows[0]?.id);

  const gelezen = await sql`SELECT key_hash FROM claude_view_key WHERE id = ${proefId}`;
  const hashUitDatabase = (gelezen.rows[0]?.key_hash as string) ?? "";

  const meting1 = {
    verifyInGeheugen,
    verifyNaDatabase: hashUitDatabase ? verifyPassword(proefsleutel, hashUitDatabase) : false,
    hashLetterlijkGelijk: hashUitDatabase === hashInGeheugen,
    lengteInGeheugen: hashInGeheugen.length,
    lengteUitDatabase: hashUitDatabase.length,
    // Alleen de vorm, nooit de waarde: hoeveel tekens vóór de dubbele punt
    // (het zout) en hoeveel erna (de hash zelf).
    vormInGeheugen: vorm(hashInGeheugen),
    vormUitDatabase: vorm(hashUitDatabase),
    kolomtype: await kolomtype(),
  };

  // Opruimen: de proefrij hoeft nergens te blijven staan.
  await sql`DELETE FROM claude_view_key WHERE id = ${proefId}`;

  // ── Meting 2: zou een verse sleutel wel in de gecontroleerde set zitten? ──
  // createViewKey zette na het aanmaken alles buiten de twaalf meest gebruikte
  // sleutels op ingetrokken, en sorteerde daarbij op `last_used DESC NULLS
  // LAST`. Een verse sleutel heeft nog geen last_used, dus die staat in die
  // volgorde achteraan. Hebben twaalf geldige sleutels al een stempel, dan valt
  // de nieuwe er direct buiten en trekt hij zichzelf in.
  const stand = await sql`
    SELECT COUNT(*)::int                                   AS actief,
           COUNT(last_used)::int                           AS actief_met_stempel,
           MAX(id)::int                                    AS hoogste_actieve_id
    FROM claude_view_key WHERE revoked_at IS NULL`;
  const s = stand.rows[0];
  const actief = Number(s?.actief ?? 0);
  const metStempel = Number(s?.actief_met_stempel ?? 0);

  const meting2 = {
    geldigeSleutels: actief,
    gezienDoorDeControle,
    daarvanMetStempel: metStempel,
    hoogsteGeldigeId: s?.hoogste_actieve_id ?? null,
    maxActief: MAX_ACTIEF,
    // Dit is de vraag waar het om draait.
    verseSleutelValtBuitenDeTwaalf: metStempel >= MAX_ACTIEF,
  };

  return NextResponse.json({ ok: true, meting1, meting2 });
}

function vorm(h: string): string {
  const i = h.indexOf(":");
  return i < 0 ? `geen dubbele punt, ${h.length} tekens` : `${i} + 1 + ${h.length - i - 1}`;
}

async function kolomtype(): Promise<string> {
  const r = await sql`
    SELECT data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_name = 'claude_view_key' AND column_name = 'key_hash'`;
  const c = r.rows[0];
  if (!c) return "kolom niet gevonden";
  return c.character_maximum_length ? `${c.data_type}(${c.character_maximum_length})` : String(c.data_type);
}
