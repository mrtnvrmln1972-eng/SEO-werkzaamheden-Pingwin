import { NextRequest, NextResponse } from "next/server";
import { rondeStand } from "../../../../lib/tweak-ronde";
import { telOpen } from "../../../../lib/tweaks";
import { volgendeTaak } from "../../../../lib/punt-ronde";
import { baanNu } from "../../../../lib/punt-tempo";
import { startWerkstroom } from "../../../../lib/werkstroom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// HET UURWERK VAN BEIDE WACHTRIJEN, VANUIT HET DASHBOARD ZELF
// ═══════════════════════════════════════════════════════════
// Elk uur: is er werk, en is die baan nu aan de beurt? Zo ja, start de ronde.
// Overdag zijn de tweaks aan de beurt, 's nachts de grote punten; het slot in de
// database houdt ze sowieso uit elkaar, dit venster voorkomt dat ze op elkaar
// staan te wachten.
//
// WAAROM DIT HIER STAAT EN NIET IN GITHUB
// ───────────────────────────────────────────────────────────
// Een uurschema in GitHub kán, maar dan moet de werkstroom zelf bij het
// dashboard kunnen komen om te kijken of er werk is, en daar had hij een sleutel
// voor nodig die een mens moest kopiëren. Precies die sleutel verviel op
// 15-08-2026 (Maarten maakte een nieuwe meekijk-sleutel), en vanaf dat moment
// kwam geen enkele ronde er nog in: ze meldden "geslaagd" en deden niets.
//
// Andersom klopt het wél. Het dashboard wéét of er werk is, want het is zijn
// eigen wachtrij, en het mag GitHub al starten (GITHUB_TWEAK_TOKEN). Het geeft
// de ronde meteen een ondertekende toegangsbon mee. Er is dus geen enkel geheim
// meer dat iemand met de hand naar twee plekken kopieert, en dat is de reden dat
// dit hier staat.
//
// Een uurwerk dat niets te doen heeft, doet ook niets: het antwoord is dan
// gewoon "niets te doen" en er start geen dure werkstroom.
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }

  try {
    // Loopt er al iets, in welke baan dan ook? Dan niets doen. Het slot zou een
    // tweede ronde toch weigeren, maar een werkstroom opstarten die meteen weer
    // stopt kost wel geld.
    const stand = await rondeStand();
    if (stand.ronde) {
      return NextResponse.json({ ok: true, gedaan: "niets", reden: `er loopt al een ronde (${stand.baan})` });
    }

    const baan = baanNu(new Date());

    if (baan === "punt") {
      const taak = await volgendeTaak();
      if (!taak.werk) return NextResponse.json({ ok: true, gedaan: "niets", reden: "geen goedgekeurd punt en geen plan gevraagd" });
      const uit = await startWerkstroom("punt-nacht.yml", "punt", "nacht");
      return NextResponse.json(
        uit.ok
          ? { ok: true, gedaan: "punt-ronde gestart", werk: taak.werk, punt: taak.punt?.code, ronde: uit.ronde }
          : { ok: false, error: uit.error },
        { status: uit.ok ? 200 : uit.status },
      );
    }

    const tellers = await telOpen();
    if (tellers.wachtrij === 0) {
      return NextResponse.json({ ok: true, gedaan: "niets", reden: "de tweak-wachtrij is leeg" });
    }
    const uit = await startWerkstroom("tweak-ronde.yml", "tweak", "uur");
    return NextResponse.json(
      uit.ok
        ? { ok: true, gedaan: "tweak-ronde gestart", meldingen: tellers.wachtrij, ronde: uit.ronde }
        : { ok: false, error: uit.error },
      { status: uit.ok ? 200 : uit.status },
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
