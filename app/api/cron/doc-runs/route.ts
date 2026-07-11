import { NextRequest, NextResponse } from "next/server";
import { processQueuedRuns } from "../../../../lib/page-doc-run";

export const runtime = "nodejs";
// De volledige generatie van de drie stappen kan minuten duren; 800s = Vercel Pro/Fluid.
export const maxDuration = 800;
// Nooit bij de build draaien: dit start de zware generatie. Alleen op aanvraag (cron).
export const dynamic = "force-dynamic";

// Cron-worker (elke minuut): pakt één wachtende achtergrond-run op en draait de
// resterende stappen (analyse -> blauwdruk -> copy) server-side af. Zo lopen runs
// door zonder dat de browser open hoeft te blijven.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  try {
    const res = await processQueuedRuns();
    // Diagnose: hoeveel lopende runs ziet DEZE functie zelf in de database?
    // (Vergelijken met het beheer-luik; hoort identiek te zijn.)
    const { sql } = await import("../../../../lib/db");
    const { rows: routeDb } = await sql`SELECT current_database() AS db, current_schema() AS schema`;
    const { rows } = await sql`SELECT id, status, analyse_state, blauwdruk_state, copy_state FROM page_doc_runs WHERE status = 'running' ORDER BY id DESC LIMIT 5`;
    const { rows: zelfTest2 } = await sql`
      SELECT id FROM page_doc_runs
      WHERE status = 'running'
        AND analyse_state <> 'running' AND blauwdruk_state <> 'running' AND copy_state <> 'running'
        AND (analyse_state = 'pending' OR blauwdruk_state = 'pending' OR copy_state = 'pending')
      ORDER BY id ASC LIMIT 5`;
    return NextResponse.json({ ok: true, ...res, routeDb: routeDb[0], zelfTest: rows, zelfTest2: zelfTest2.map((r) => Number(r.id)) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
