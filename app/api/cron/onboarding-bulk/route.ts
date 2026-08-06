import { NextRequest, NextResponse } from "next/server";
import { verwerkRij } from "../../../../lib/onboarding-bulk";

export const runtime = "nodejs";
// Eén klant onboarden duurt minuten; drie achter elkaar past hier ruim in.
export const maxDuration = 800;
export const dynamic = "force-dynamic";

// Cron-werker voor de bulk-onboarding. De knop start de rij en doet de eerste
// paar klanten zelf, maar een serverless-venster is eindig: zonder dit vangnet
// zou de rij halverwege stil vallen en er van buiten uitzien alsof hij nog loopt.
// Elke vijf minuten één tik is genoeg; de werker doet niets als de rij leeg is.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  try {
    const res = await verwerkRij(3);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
