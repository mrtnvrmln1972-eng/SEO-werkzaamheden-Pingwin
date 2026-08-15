import { NextRequest, NextResponse } from "next/server";
import { rondeStand } from "../../../../lib/tweak-ronde";
import { volgendeTaak } from "../../../../lib/punt-ronde";
import { isNacht } from "../../../../lib/punt-tempo";
import { startWerkstroom } from "../../../../lib/werkstroom";
import { modelVoor } from "../../../../lib/punt-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// ÉÉN TIK PER NACHT, EN VERDER NIETS AUTOMATISCH
// ═══════════════════════════════════════════════════════════
// Dit is de enige plek in het dashboard die uit zichzelf een ronde start, en hij
// gaat één keer per etmaal af, aan het begin van de nacht.
//
// WAAROM ER GEEN UURWERK MEER IS. Er stond even een cron die elk uur keek of er
// werk was, in beide banen. Dat is precies wat Maarten níet wil: elk uur wakker
// worden kost geld, ook als er niets gebeurt, en het haalt de controle weg bij
// de enige die hem hoort te hebben. Tweaks start hij zelf met de knop "Nu
// draaien"; een plan schrijven begint zodra hij op "Maak er een plan van" drukt.
// Alleen het bouwen van goedgekeurde grote punten gebeurt 's nachts vanzelf, en
// dat is ook precies wat hij gevraagd heeft.
//
// EN ER WORDT NIET GEPOLLED, ER WORDT DOORGEGEVEN. Deze tik start het eerste
// punt. Is dat klaar en is het nog nacht en staat er nog een goedgekeurd punt,
// dan start die ronde zelf de volgende (zie /api/admin/punten/ronde, actie
// "terug"). Zo kost de nacht precies zoveel als er werk is, en geen tik meer.
//
// Staat de bouwwachtrij leeg, dan gebeurt er niets: geen werkstroom, geen kosten.
// Een plan schrijven gebeurt hier bewust NIET: dat is denkwerk op het zwaarste
// model en dat hoort niet vanzelf te beginnen.
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }

  try {
    if (!isNacht(new Date())) {
      return NextResponse.json({ ok: true, gedaan: "niets", reden: "het is geen nacht" });
    }

    // Loopt er al iets, in welke baan dan ook? Dan niets doen. Het slot zou een
    // tweede ronde toch weigeren, maar een werkstroom opstarten die meteen weer
    // stopt kost wel geld.
    const stand = await rondeStand();
    if (stand.ronde) {
      return NextResponse.json({ ok: true, gedaan: "niets", reden: `er loopt al een ronde (${stand.baan})` });
    }

    // Alleen bouwen. Een punt dat nog een plan nodig heeft blijft wachten tot
    // Maarten er zelf om vraagt.
    const taak = await volgendeTaak();
    if (taak.werk !== "bouwen" || !taak.punt) {
      return NextResponse.json({ ok: true, gedaan: "niets", reden: "geen goedgekeurd punt in de bouwwachtrij" });
    }

    const uit = await startWerkstroom("punt-nacht.yml", "punt", "nacht", {
      model: modelVoor(taak.werk, taak.punt.omvang),
    });
    return NextResponse.json(
      uit.ok
        ? { ok: true, gedaan: "bouwronde gestart", punt: taak.punt.code, ronde: uit.ronde }
        : { ok: false, error: uit.error },
      { status: uit.ok ? 200 : uit.status },
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
