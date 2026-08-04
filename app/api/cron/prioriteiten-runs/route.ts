import { NextRequest, NextResponse } from "next/server";
import { processPrioQueue } from "../../../../lib/prioriteiten-scan";

export const runtime = "nodejs";
export const maxDuration = 800;
// Nooit bij de build draaien: dit start zware stappen. Alleen op aanvraag (cron).
export const dynamic = "force-dynamic";

// Cron-werker voor de prioriteitenscan. Twee taken:
// 1. Runs oppakken die zonder hartslag zijn achtergebleven (afgekapt venster,
//    deploy) en hervatten bij de stap waar ze waren. Zonder dit vangnet blijft
//    een afgekapte scan eeuwig op "bezig" staan, precies zoals bij het opruimen.
// 2. Eén keer per maand vanzelf een verse scan per klant, één klant per tik,
//    zodat het venster nooit vol raakt en de Ahrefs-credits gespreid worden.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  try {
    const res = await processPrioQueue();
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
