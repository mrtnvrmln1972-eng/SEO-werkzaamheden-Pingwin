import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { ensureSchema } from "../../../../../lib/db";
import { guardOwner } from "../../../../../lib/admin-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET ?start=YYYY-MM-DD&eind=YYYY-MM-DD → hele-dag-taken in die periode
export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  await ensureSchema();
  const start = req.nextUrl.searchParams.get("start");
  const eind = req.nextUrl.searchParams.get("eind");
  if (!start || !eind) return NextResponse.json({ ok: false, error: "start/eind ontbreekt" }, { status: 400 });
  const takenRes = await sql`
    SELECT id, titel, kleur, to_char(datum, 'YYYY-MM-DD') AS datum, done, notities, volgorde,
           checklist, subtaken, prioriteit, lijst, tags, herinneringen_dagen,
           to_char(eind_datum, 'YYYY-MM-DD') AS eind_datum
    FROM agenda_taken
    WHERE datum <= ${eind}::date AND COALESCE(eind_datum, datum) >= ${start}::date
    ORDER BY datum, volgorde, created_at`;
  const lijstenRes = await sql`SELECT DISTINCT lijst FROM agenda_taken WHERE lijst != '' ORDER BY lijst`;
  return NextResponse.json({
    ok: true,
    taken: takenRes.rows,
    lijsten: lijstenRes.rows.map((r) => r.lijst as string),
  });
}

// POST {titel, datum, kleur?, eind_datum?} → nieuwe taak
export async function POST(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  await ensureSchema();
  const b = await req.json();
  if (!b.titel?.trim() || !b.datum) {
    return NextResponse.json({ ok: false, error: "titel en datum zijn verplicht" }, { status: 400 });
  }
  const { rows } = await sql`
    INSERT INTO agenda_taken (titel, kleur, datum, checklist, subtaken, prioriteit, lijst, tags, eind_datum, herinneringen_dagen)
    VALUES (${b.titel.trim()}, ${b.kleur || "#1d78af"}, ${b.datum},
            ${JSON.stringify(b.checklist || [])}::jsonb, ${JSON.stringify(b.subtaken || [])}::jsonb,
            ${b.prioriteit || 0}, ${b.lijst || ""}, ${JSON.stringify(b.tags || [])}::jsonb,
            ${b.eind_datum || null},
            ${(Array.isArray(b.herinneringen_dagen) ? b.herinneringen_dagen : []) as unknown as string})
    RETURNING id`;
  return NextResponse.json({ ok: true, id: rows[0].id });
}

// PATCH: zonder "titel" is het een snelle deelupdate (afvinken, of datum/eind_datum na
// slepen) die de rest van de taak ongemoeid laat. Mét "titel" is het de volledige opslag
// vanuit de pop-up: alles overschrijven, inclusief eind_datum leegmaken als de taak weer
// eendaags wordt.
export async function PATCH(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  await ensureSchema();
  const b = await req.json();
  if (!b.id) return NextResponse.json({ ok: false, error: "id ontbreekt" }, { status: 400 });
  if (b.titel === undefined) {
    await sql`
      UPDATE agenda_taken SET
        done = COALESCE(${b.done ?? null}, done),
        datum = COALESCE(${b.datum ?? null}, datum),
        eind_datum = COALESCE(${b.eind_datum ?? null}, eind_datum),
        notities = COALESCE(${b.notities ?? null}, notities),
        volgorde = COALESCE(${b.volgorde ?? null}, volgorde)
      WHERE id = ${b.id}`;
    return NextResponse.json({ ok: true });
  }
  await sql`
    UPDATE agenda_taken SET
      titel = ${b.titel}, kleur = ${b.kleur}, datum = ${b.datum},
      done = COALESCE(${b.done ?? null}, done),
      notities = COALESCE(${b.notities ?? null}, notities),
      volgorde = COALESCE(${b.volgorde ?? null}, volgorde),
      checklist = ${JSON.stringify(b.checklist || [])}::jsonb,
      subtaken = ${JSON.stringify(b.subtaken || [])}::jsonb,
      prioriteit = ${b.prioriteit || 0},
      lijst = ${b.lijst || ""},
      tags = ${JSON.stringify(b.tags || [])}::jsonb,
      eind_datum = ${b.eind_datum || null},
      herinneringen_dagen = ${(Array.isArray(b.herinneringen_dagen) ? b.herinneringen_dagen : []) as unknown as string}
    WHERE id = ${b.id}`;
  return NextResponse.json({ ok: true });
}

// DELETE ?id= → taak verwijderen
export async function DELETE(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  await ensureSchema();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id ontbreekt" }, { status: 400 });
  await sql`DELETE FROM agenda_taken WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
