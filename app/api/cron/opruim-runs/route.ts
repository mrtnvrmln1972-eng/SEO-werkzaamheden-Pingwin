import { NextRequest, NextResponse } from "next/server";
import { processCannibalQueue } from "../../../../lib/cannibal-redirect";
import { meetOpenstaande } from "../../../../lib/opruim-nameten";
import { listClients } from "../../../../lib/clients";

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
    // Meteen ook de nametingen die aan de beurt zijn. Ze kosten hooguit tien
    // Search Console-opvragen per klant per tik, en zonder vast moment gebeurt
    // terugkijken nooit: dat is precies waarom het er tot nu toe niet was.
    const nagemeten = await meetNametingen().catch(() => 0);
    return NextResponse.json({ ok: true, ...res, nagemeten });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

// Per klant de metingen die aan de beurt zijn. Idempotent: wat al gemeten is
// wordt nooit overschreven, dus vaker langskomen verandert geen enkel getal.
async function meetNametingen(): Promise<number> {
  const klanten = await listClients().catch(() => []);
  let n = 0;
  for (const k of klanten) {
    const domain = (k.domain || "").trim();
    if (!domain) continue;
    const r = await meetOpenstaande(k.slug, domain).catch(() => ({ gemeten: 0 }));
    n += r.gemeten;
  }
  return n;
}
