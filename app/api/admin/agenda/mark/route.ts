import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { ensureSchema } from "../../../../../lib/db";
import { guardOwner } from "../../../../../lib/admin-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { blockId, date, status: 'done' | 'skipped' | null } → afvinken, overslaan of ongedaan maken
export async function POST(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  await ensureSchema();
  const { blockId, date, status } = await req.json();
  if (!blockId || !date) return NextResponse.json({ ok: false, error: "onvolledig" }, { status: 400 });
  if (status) {
    await sql`
      INSERT INTO agenda_marks (block_id, date, status)
      VALUES (${blockId}, ${date}, ${status})
      ON CONFLICT (block_id, date) DO UPDATE SET status = ${status}`;
  } else {
    await sql`DELETE FROM agenda_marks WHERE block_id = ${blockId} AND date = ${date}`;
  }
  return NextResponse.json({ ok: true });
}
