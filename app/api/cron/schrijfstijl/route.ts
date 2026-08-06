import { NextRequest, NextResponse } from "next/server";
import { leidSchrijfstijlAf, getSchrijfstijl } from "../../../../lib/schrijfstijl";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Eén keer per maand het schrijfprofiel bijwerken uit Maartens eigen verzonden
// mails aan klanten. Zo schuift het mee als zijn toon verandert, zonder dat hij
// eraan hoeft te denken.
//
// Heeft hij het profiel zelf aangepast, dan blijft het staan: `leidSchrijfstijlAf`
// weigert dan te overschrijven. Dat is bewust, want zijn eigen bijstelling weet
// dingen die uit de mails niet af te leiden zijn.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const voor = await getSchrijfstijl().catch(() => null);
  if (voor?.handmatig) return NextResponse.json({ ok: true, overgeslagen: "Met de hand onderhouden." });

  const r = await leidSchrijfstijlAf();
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 200 });
  return NextResponse.json({ ok: true, mails: r.stijl?.aantalMails || 0 });
}
