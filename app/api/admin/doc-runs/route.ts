import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import { sql, ensureSchema } from "../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Beheer van achtergrond-runs (documentgeneratie). Alleen voor de eigenaar.
// GET: alle lopende runs (om te zien of er iets vastzit).
// POST { action: "stop", id } of { action: "stop_all" }: lopende runs stoppen,
// zodat de cron ze niet meer oppakt en er geen AI-kosten meer bijkomen.

export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  await ensureSchema();
  const { rows } = await sql`
    SELECT id, client_slug, url, status, analyse_state, blauwdruk_state, copy_state, retries, error, created_at, updated_at
    FROM page_doc_runs
    WHERE status = 'running'
    ORDER BY id DESC LIMIT 100`;
  return NextResponse.json({ ok: true, running: rows });
}

export async function POST(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  await ensureSchema();
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const reason = "Handmatig gestopt via beheer.";
  if (body.action === "stop" && body.id) {
    const { rows } = await sql`UPDATE page_doc_runs SET status = 'error', error = ${reason}, updated_at = now() WHERE id = ${Number(body.id)} AND status = 'running' RETURNING id`;
    return NextResponse.json({ ok: true, stopped: rows.length });
  }
  if (body.action === "stop_all") {
    const { rows } = await sql`UPDATE page_doc_runs SET status = 'error', error = ${reason}, updated_at = now() WHERE status = 'running' RETURNING id`;
    return NextResponse.json({ ok: true, stopped: rows.length });
  }
  return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
}
