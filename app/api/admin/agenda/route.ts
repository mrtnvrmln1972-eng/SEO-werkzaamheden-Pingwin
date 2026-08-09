import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { ensureSchema } from "../../../../lib/db";
import { guardOwner } from "../../../../lib/admin-scope";

// Maartens persoonlijke agenda: alleen de eigenaar komt erbij, geen klantdata.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET ?start=YYYY-MM-DD → blokken + afvinkstatussen voor de week die op deze datum begint
export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  await ensureSchema();
  const start = req.nextUrl.searchParams.get("start");
  if (!start) return NextResponse.json({ ok: false, error: "start ontbreekt" }, { status: 400 });

  const blocksRes = await sql`
    SELECT id, title, color, start_min, end_min,
           to_char(date, 'YYYY-MM-DD') AS date, weekdays,
           to_char(eind_datum, 'YYYY-MM-DD') AS eind_datum,
           notities, checklist, subtaken, prioriteit, lijst, tags, herinneringen_min,
           herhaal_interval, to_char(herhaal_anker_datum, 'YYYY-MM-DD') AS herhaal_anker_datum
    FROM agenda_blocks
    WHERE weekdays IS NOT NULL
       OR (date >= ${start}::date AND date < ${start}::date + 7)
    ORDER BY start_min`;
  const marksRes = await sql`
    SELECT block_id, to_char(date, 'YYYY-MM-DD') AS date, status
    FROM agenda_marks
    WHERE date >= ${start}::date AND date < ${start}::date + 7`;
  const lijstenRes = await sql`SELECT DISTINCT lijst FROM agenda_blocks WHERE lijst != '' ORDER BY lijst`;

  return NextResponse.json({
    ok: true,
    blocks: blocksRes.rows,
    marks: marksRes.rows,
    lijsten: lijstenRes.rows.map((r) => r.lijst as string),
  });
}

// POST → nieuw blok
export async function POST(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  await ensureSchema();
  const b = await req.json();
  const weekdays: number[] | null = Array.isArray(b.weekdays) && b.weekdays.length > 0 ? b.weekdays : null;
  const date: string | null = weekdays ? null : b.date || null;
  if (!b.title || b.start_min == null || b.end_min == null || (!weekdays && !date)) {
    return NextResponse.json({ ok: false, error: "onvolledig" }, { status: 400 });
  }
  const { rows } = await sql`
    INSERT INTO agenda_blocks (title, color, start_min, end_min, date, weekdays, eind_datum,
      notities, checklist, subtaken, prioriteit, lijst, tags, herinneringen_min,
      herhaal_interval, herhaal_anker_datum)
    VALUES (${b.title}, ${b.color || "#1d78af"}, ${b.start_min}, ${b.end_min},
            ${date}, ${weekdays as unknown as string}, ${b.eind_datum || null},
            ${b.notities || ""}, ${JSON.stringify(b.checklist || [])}::jsonb,
            ${JSON.stringify(b.subtaken || [])}::jsonb, ${b.prioriteit || 0}, ${b.lijst || ""},
            ${JSON.stringify(b.tags || [])}::jsonb,
            ${(Array.isArray(b.herinneringen_min) ? b.herinneringen_min : [10, 0]) as unknown as string},
            ${b.herhaal_interval || 1}, ${b.herhaal_anker_datum || null})
    RETURNING id`;
  return NextResponse.json({ ok: true, id: rows[0].id });
}

// PATCH → blok bijwerken
export async function PATCH(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  await ensureSchema();
  const b = await req.json();
  if (!b.id) return NextResponse.json({ ok: false, error: "id ontbreekt" }, { status: 400 });
  const weekdays: number[] | null = Array.isArray(b.weekdays) && b.weekdays.length > 0 ? b.weekdays : null;
  const date: string | null = weekdays ? null : b.date || null;
  await sql`
    UPDATE agenda_blocks
    SET title = ${b.title}, color = ${b.color}, start_min = ${b.start_min},
        end_min = ${b.end_min}, date = ${date}, weekdays = ${weekdays as unknown as string},
        notities = COALESCE(${b.notities ?? null}, notities),
        eind_datum = ${b.eind_datum || null},
        checklist = COALESCE(${b.checklist ? JSON.stringify(b.checklist) : null}::jsonb, checklist),
        subtaken = COALESCE(${b.subtaken ? JSON.stringify(b.subtaken) : null}::jsonb, subtaken),
        prioriteit = COALESCE(${b.prioriteit ?? null}, prioriteit),
        lijst = COALESCE(${b.lijst ?? null}, lijst),
        tags = COALESCE(${b.tags ? JSON.stringify(b.tags) : null}::jsonb, tags),
        herinneringen_min = COALESCE(${(Array.isArray(b.herinneringen_min) ? b.herinneringen_min : null) as unknown as string}, herinneringen_min),
        herhaal_interval = ${b.herhaal_interval || 1},
        herhaal_anker_datum = ${b.herhaal_anker_datum || null}
    WHERE id = ${b.id}`;
  return NextResponse.json({ ok: true });
}

// DELETE ?id=...
export async function DELETE(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  await ensureSchema();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id ontbreekt" }, { status: 400 });
  await sql`DELETE FROM agenda_blocks WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
