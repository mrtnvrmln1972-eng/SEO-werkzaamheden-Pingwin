import { NextRequest, NextResponse } from "next/server";
import { guardDev } from "../../../../../lib/admin-scope";
import { puntStand, volgendeTaak } from "../../../../../lib/punt-ronde";
import { startWerkstroom, werkstroomKlaar } from "../../../../../lib/werkstroom";
import { modelVoor } from "../../../../../lib/punt-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// DE KNOP "NU DRAAIEN" VOOR EEN GROOT PUNT
// ═══════════════════════════════════════════════════════════
// Normaal draait deze baan 's nachts vanzelf (/api/cron/bouwrondes, elk uur, die
// binnen het nachtvenster dezelfde werkstroom start). Deze knop start hem nu
// meteen, voor als Maarten niet tot de nacht wil wachten, of voor als hij een
// plan wil zien zonder er een chat voor te openen.
//
// Twee sleutels, en meer niet:
//  1. GITHUB_TWEAK_TOKEN, in Vercel. Waarmee dit dashboard bij GitHub mag
//     aankloppen om een werkstroom te starten. Eén fijnmazig token op deze ene
//     repo met alleen "Actions: read and write"; hij dekt beide werkstromen.
//  2. ANTHROPIC_API_KEY, als repo-secret in GitHub. Waarmee de ronde mag denken.
//
// De toegang tót dit dashboard regelt de ronde niet meer met een sleutel die
// iemand moet kopiëren: hij krijgt hier een ondertekende toegangsbon mee (zie
// lib/ronde-bon.ts). Dat was nodig omdat een ronde er anders niet meer in kwam
// zodra Maarten een nieuwe meekijk-sleutel maakte, en dan draaide de nacht leeg.
// ═══════════════════════════════════════════════════════════

const WERKSTROOM = "punt-nacht.yml";

export async function GET(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, ...(await werkstroomKlaar(WERKSTROOM)) });
}

export async function POST(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;

  // Loopt er al iets, in welke baan dan ook? Dan is nog een keer starten precies
  // de botsing die het slot moet voorkomen.
  const stand = await puntStand();
  if (stand.slot.ronde) {
    return NextResponse.json({
      ok: false,
      error: stand.slot.baan === "punt"
        ? "Er wordt op dit moment al een groot punt gebouwd."
        : "Er loopt nu een tweak-ronde. Grote punten en tweaks bouwen nooit tegelijk; die is meestal binnen een paar minuten klaar.",
      stand,
    }, { status: 409 });
  }

  const taak = await volgendeTaak();
  if (!taak.werk || !taak.punt) {
    return NextResponse.json({
      ok: false,
      error: "Er staat niets klaar. Keur een plan goed, of vraag een plan aan bij een idee.",
    }, { status: 400 });
  }

  // `handmatig` zet het nachtvenster opzij: Maarten drukt zelf, dus hij zit
  // erbij. Het slot blijft gewoon gelden.
  //
  // Het model gaat hier mee in plaats van vast in de werkstroom te staan: een
  // plan voor een klein of middelgroot punt hoeft niet op het zwaarste model,
  // en dat scheelt zowel wachttijd als geld. Zie lib/punt-model.ts.
  const uit = await startWerkstroom(WERKSTROOM, "punt", "knop", {
    handmatig: "ja",
    model: modelVoor(taak.werk, taak.punt.omvang),
  });
  if (!uit.ok) {
    return NextResponse.json({ ok: false, error: uit.error, klaarzetten: uit.klaarzetten }, { status: uit.status });
  }

  return NextResponse.json({
    ok: true,
    melding: taak.werk === "bouwen"
      ? `${taak.punt.code} wordt nu gebouwd: ${taak.punt.titel}. Je ziet hierboven bij welke stap hij is.`
      : `Er wordt nu een plan geschreven voor ${taak.punt.code}: ${taak.punt.titel}. Zodra het klaar is verschijnt het hier voor je akkoord.`,
  });
}
