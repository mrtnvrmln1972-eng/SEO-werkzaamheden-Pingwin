import { NextRequest, NextResponse } from "next/server";
import { processCannibalQueue } from "../../../../lib/cannibal-redirect";

export const runtime = "nodejs";
// Eén opruim-analyse duurt 10 tot 20 minuten en past niet in één venster; 800s =
// Vercel Pro/Fluid, net als de documenten-werker.
export const maxDuration = 800;
// Nooit bij de build draaien: dit start zware AI-stappen. Alleen op aanvraag (cron).
export const dynamic = "force-dynamic";

// Cron-werker: pakt opruim-analyses op die zonder hartslag zijn achtergebleven
// (venster afgekapt, deploy) en hervat ze bij de stap waar ze waren. Zonder dit
// vangnet bleef een afgekapte analyse eeuwig op 'bezig' staan zonder ooit iets
// op te leveren; zo verdween de run van 03-08-2026 05:52 stilletjes.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  try {
    const res = await processCannibalQueue();
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
