import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import { sql, ensureSchema } from "../../../../lib/db";
import { hashPassword, verifyPassword, generatePassword } from "../../../../lib/password";
import { MAX_ACTIEF, getActiveKeys, createViewKey, testViewKey } from "../../../../lib/claude-view-key";

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

  // ── Meting 3: het echte pad, op de server, van knop tot deur ──
  // De eerste meting bewees dat een hash de database ongeschonden overleeft, en
  // de tweede dat de bovengrens niets intrekt. Blijft over: doet het echte pad
  // het wél als het hier, in één verzoek, achter elkaar gebeurt? Dit is exact
  // wat de knop in de cockpit doet (aanmaken, dan langs /api/kijk?test=1), maar
  // dan zonder browser, zonder omgevingsvariabele en zonder tweede verzoek.
  //
  // Komt hier "ok" uit, dan werkt het aanmaken en controleren op de server en
  // zit het verschil in wat de browser of de Claude-omgeving daarna verstuurt.
  // Komt hier een afwijzing uit, dan is de fout eindelijk in één plaatje te
  // vangen: dan zie je meteen of de verse rij wel terugkomt in de controle.
  const voor = await sql`SELECT COALESCE(MAX(id), 0)::int AS grens FROM claude_view_key`;
  const grens = Number(voor.rows[0]?.grens ?? 0);
  const versePlat = await createViewKey();
  const rijen = await getActiveKeys();
  const uitkomst = await testViewKey(versePlat);
  const passend = rijen.filter((r) => r.key_hash && verifyPassword(versePlat, r.key_hash));

  const meting3 = {
    testViewKey: uitkomst,
    rijenInDeControle: rijen.length,
    rijenDiePassen: passend.length,
    idVanDePassendeRij: passend[0]?.id ?? null,
    hoogsteIdInDeControle: rijen.length ? Math.max(...rijen.map((r) => r.id)) : null,
    // Per geldige rij alleen de vorm, nooit de inhoud: een rij met een andere
    // lengte is een sleutel uit een oudere opzet en kan nooit passen.
    vormenInDeControle: rijen.map((r) => `${r.id}: ${r.key_hash ? vorm(r.key_hash) : "geen hash"}`),
  };

  // De proefsleutel is een echte, werkende sleutel; die laten we niet staan.
  // Op id, niet op "welke rij paste": juist als er niets past moet hij weg.
  await sql`UPDATE claude_view_key SET revoked_at = now() WHERE id > ${grens}`;

  return NextResponse.json({ ok: true, meting1, meting2, meting3 });
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
