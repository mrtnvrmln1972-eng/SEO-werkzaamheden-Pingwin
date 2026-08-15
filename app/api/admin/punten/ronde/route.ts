import { NextRequest, NextResponse } from "next/server";
import { guardDev, isMeekijker } from "../../../../../lib/admin-scope";
import { claimPunt, geefPuntRondeTerug, puntStand, rondeNaam, volgendeTaak } from "../../../../../lib/punt-ronde";
import { zetStap, STAPPEN } from "../../../../../lib/grote-punten";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// HET SLOT EN DE VOORTGANG VAN DE NACHTELIJKE RONDE
// ═══════════════════════════════════════════════════════════
// GET                       wat loopt er, welke stap, hoe lang nog
// POST { actie: "claim" }    begin een ronde en krijg het punt dat erbij hoort
// POST { actie: "stap" }     meld waar je nu mee bezig bent (1 tot 5)
// POST { actie: "terug" }    geef de ronde terug (klaar, of gestopt)
//
// De meekijk-sessie mag hier schrijven, om dezelfde reden als bij de tweaks: de
// ronde wordt door Claude gedraaid, dus zonder dat recht kan hij het slot niet
// pakken en niet melden hoe ver hij is. De uitzondering blijft smal: claimen,
// een stap melden, teruggeven. Goedkeuren en de volgorde bepalen kan hij niet;
// die zitten elders en weigeren hem daar expliciet.
//
// WAAROM DE VOORTGANG GEMELD WORDT EN NIET GERADEN
// ───────────────────────────────────────────────────────────
// Een balk die op de klok loopt, staat stil zodra iets langer duurt dan
// verwacht, precies op het moment dat je wilt zien dat er nog iets gebeurt.
// Daarom meldt de ronde zélf elke stap, en rekent het scherm de tijd erbij uit
// (lib/punt-tempo.ts). Wat er in beeld staat, is dan wat er echt gebeurt.
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;
  const taak = await volgendeTaak();
  return NextResponse.json({
    ok: true,
    stand: await puntStand(),
    volgende: taak.werk ? { werk: taak.werk, code: taak.punt?.code, titel: taak.punt?.titel } : null,
    stappen: STAPPEN,
  });
}

export async function POST(req: NextRequest) {
  const meekijker = isMeekijker(req);
  if (!meekijker) { const g = await guardDev(req); if (!g.ok) return g.res; }

  const body = await req.json().catch(() => null);
  const actie = String(body?.actie ?? "claim");

  if (actie === "terug") {
    const ronde = String(body?.ronde ?? "").trim();
    if (!ronde) return NextResponse.json({ ok: false, error: "Welke ronde?" }, { status: 400 });
    await geefPuntRondeTerug(ronde);
    return NextResponse.json({ ok: true, stand: await puntStand() });
  }

  if (actie === "stap") {
    const id = Number(body?.id);
    const nr = Number(body?.nr);
    if (!id || !Number.isFinite(nr) || nr < 1 || nr > STAPPEN.length) {
      return NextResponse.json({
        ok: false,
        error: `Een stap is een getal van 1 tot ${STAPPEN.length}, met het punt erbij.`,
        stappen: STAPPEN,
      }, { status: 400 });
    }
    await zetStap(id, nr, String(body?.stap ?? "") || STAPPEN[nr - 1]);
    return NextResponse.json({ ok: true, stand: await puntStand() });
  }

  if (actie !== "claim") {
    return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
  }

  const uitslag = await claimPunt(
    String(body?.ronde ?? "").trim() || rondeNaam(meekijker ? "claude" : "handmatig"),
    // Alleen Maarten zelf mag buiten het nachtvenster starten; een ronde die
    // zichzelf "handmatig" noemt zou het venster kunnen omzeilen.
    { handmatig: !meekijker && Boolean(body?.handmatig) },
  );

  if (!uitslag.ok) {
    return NextResponse.json(
      { ok: false, reden: uitslag.reden, error: uitslag.uitleg, stand: uitslag.stand },
      { status: uitslag.reden === "bezet" ? 409 : 200 },
    );
  }

  return NextResponse.json({
    ok: true,
    ronde: uitslag.ronde,
    werk: uitslag.werk,
    punt: uitslag.punt,
    stappen: STAPPEN,
  });
}
