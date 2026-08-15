import { NextRequest, NextResponse } from "next/server";
import { guardDev, isMeekijker } from "../../../../lib/admin-scope";
import { meldingToevoegen, meldingIntrekken } from "../../../../lib/meldingen";
import {
  haalPunten, haalPunt, haalPuntBeeld, nieuwPunt, zetStand, zetPlan, zetRegel, verwijderPunt, telPunten,
  magNaarWachtrij, OMVANGEN, STANDEN, type Omvang, type Stand,
} from "../../../../lib/grote-punten";
import { puntStand, wachtrijMetTijden } from "../../../../lib/punt-ronde";
import { zetStand as zetTweakStand, haalTweaks, haalBeeld as haalTweakBeeld } from "../../../../lib/tweaks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// DE WACHTRIJ VOOR GROTE PUNTEN
// ═══════════════════════════════════════════════════════════
// GET              alles: de punten, de tellers, wat er nu loopt, en per punt in
//                  de bouwwachtrij wanneer hij naar verwachting aan de beurt is
// POST             een nieuw punt (uit een idee, uit de routekaart, of los)
// PATCH            stand, plan, een regel in het draadje, of het akkoord
// DELETE ?id=      weghalen
//
// WIE WAT MAG, EN WAAROM DAT HIER ZO NAUW LUISTERT
// ───────────────────────────────────────────────────────────
// Claude werkt via een alleen-lezen sessie (/api/kijk). Net als bij de tweaks
// is daar één uitzondering op: hij mag de stand bijwerken en in het draadje
// schrijven, want anders kan een nachtelijke ronde niet melden wat hij gedaan
// heeft en moet Maarten dat 's ochtends zelf uitzoeken.
//
// Wat hij hier NOOIT mag, en dat is het hele kader van deze wachtrij:
//  - een plan goedkeuren (`keurGoed`). Alleen Maarten zet dat vinkje;
//  - een punt zelf in de bouwwachtrij zetten. Dat kan alleen als het akkoord er
//    al staat, en dat akkoord kan hij niet zelf geven;
//  - de volgorde veranderen (die zit in een aparte route, zonder uitzondering).
//
// Zonder die drie zou "jij keurt goed" een afspraak zijn in plaats van een slot.
// ═══════════════════════════════════════════════════════════

/** De meldingen in de kopbalk: het seintje dat er iets op jou wacht. */
const MELDING_BRON = "grote-punten";

/** Twee heel verschillende seintjes, dus twee losse meldingen. */
async function werkMeldingenBij(): Promise<Awaited<ReturnType<typeof telPunten>>> {
  const t = await telPunten();

  if (t.planKlaar > 0) {
    await meldingToevoegen({
      soort: "dev-af",
      titel: "Een plan wacht op je akkoord",
      regel: t.planKlaar === 1
        ? "Eén groot punt heeft een plan klaarliggen. Zeg ja, dan wordt het vannacht gebouwd."
        : `${t.planKlaar} grote punten hebben een plan klaarliggen. Wat je goedkeurt, wordt vannacht gebouwd.`,
      link: "/admin/grote-punten",
      bron: MELDING_BRON,
      bronId: "plan",
    });
  } else {
    await meldingIntrekken(MELDING_BRON, "plan", "dev-af");
  }

  if (t.controleer > 0) {
    await meldingToevoegen({
      soort: "dev-af",
      titel: "Vannacht gebouwd, klopt het?",
      regel: t.controleer === 1
        ? "Eén groot punt staat live. Kijk of het klopt."
        : `${t.controleer} grote punten staan live. Kijk of ze kloppen.`,
      link: "/admin/grote-punten",
      bron: MELDING_BRON,
      bronId: "controleer",
    });
  } else {
    await meldingIntrekken(MELDING_BRON, "controleer", "dev-af");
  }

  return t;
}

export async function GET(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;

  // Eén schermafbeelding los ophalen. Die gaat bewust niet mee in de lijst: dat
  // zijn megabytes per punt en het scherm heeft ze pas nodig als je erop klikt.
  const beeldId = req.nextUrl.searchParams.get("beeld");
  if (beeldId) {
    return NextResponse.json({ ok: true, beeld: await haalPuntBeeld(Number(beeldId)) });
  }
  const alles = req.nextUrl.searchParams.get("alles") === "1";
  const [punten, tellers, stand, wachtrij] = await Promise.all([
    haalPunten(alles), telPunten(), puntStand(), wachtrijMetTijden(),
  ]);
  return NextResponse.json({ ok: true, punten, tellers, stand, starts: wachtrij.starts });
}

export async function POST(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;
  const body = await req.json().catch(() => null);
  const titel = String(body?.titel ?? "").trim();
  if (!titel) {
    return NextResponse.json({ ok: false, error: "Geef het punt een titel, anders weet niemand waar het over gaat." }, { status: 400 });
  }
  const omvang = OMVANGEN.includes(body?.omvang) ? (body.omvang as Omvang) : "middel";
  const bronTweak = body?.bronTweak ? Number(body.bronTweak) : null;

  // ── WAT ER BIJ DE MELDING ZAT GAAT MEE, EN DAT IS EEN REPARATIE ──
  // Kwam dit punt van de tweak-stapel, dan wist die melding al waar Maarten
  // stond en had hij er vaak een schermafbeelding bij geplakt. Dat werd hier
  // weggegooid: het punt hield alleen de getypte tekst over. Gevolg (15-08-2026,
  // punt G1): de ronde die het plan moest schrijven wist niet over welk scherm
  // het ging, ging veertien minuten zoeken en liep vast. Maarten dacht
  // intussen dat hij het beeld allang had meegegeven, en dat klopte ook, alleen
  // kwam het niet verder dan de melding.
  let raakt = Array.isArray(body?.raakt) ? body.raakt.map((x: unknown) => String(x).slice(0, 60)).slice(0, 12) : [];
  let beeld: string | null = typeof body?.beeld === "string" && body.beeld ? body.beeld : null;
  if (bronTweak) {
    const bron = (await haalTweaks(true).catch(() => [])).find((t) => t.id === bronTweak);
    if (bron) {
      if (raakt.length === 0) raakt = [bron.pad || bron.scherm].filter(Boolean).map((x) => String(x).slice(0, 60));
      if (!beeld) beeld = await haalTweakBeeld(bronTweak).catch(() => null);
    }
  }

  const punt = await nieuwPunt({
    titel,
    tekst: String(body?.tekst ?? ""),
    omvang,
    raakt,
    beeld,
    routekaart: body?.routekaart ? String(body.routekaart).slice(0, 10) : null,
    bronTweak,
  });

  // Komt dit punt uit een melding op de tweak-stapel, dan gaat die melding daar
  // meteen van de stapel af, met het G-nummer erbij. Zonder die stap staat
  // hetzelfde onderwerp op twee lijsten en gaat er één van beide zwerven; dat
  // is precies wat deze wachtrij moest oplossen.
  if (bronTweak) {
    await zetTweakStand(bronTweak, "routekaart", {
      punt: punt.code,
      notitie: `Staat als ${punt.code} in de wachtrij voor grote punten.`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, punt, tellers: await telPunten() });
}

export async function PATCH(req: NextRequest) {
  const meekijker = isMeekijker(req);
  if (!meekijker) { const g = await guardDev(req); if (!g.ok) return g.res; }

  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!id) return NextResponse.json({ ok: false, error: "Onbekend punt." }, { status: 400 });

  const huidig = await haalPunt(id);
  if (!huidig) return NextResponse.json({ ok: false, error: "Dit punt bestaat niet (meer)." }, { status: 404 });

  const wie = meekijker ? "claude" : "maarten";
  const regelTekst = String(body?.regel ?? "").slice(0, 4000).trim();
  const regel = regelTekst ? { van: wie as "maarten" | "claude", tekst: regelTekst, wanneer: new Date().toISOString() } : undefined;

  // ── Alleen een regel in het draadje: sparren over het plan ──
  if (!body?.stand && body?.plan === undefined && regel) {
    const punt = await zetRegel(id, regel);
    return NextResponse.json({ ok: true, punt, tellers: await werkMeldingenBij() });
  }

  // ── Het plan bijwerken zonder de stand te veranderen ──
  if (!body?.stand && typeof body?.plan === "string") {
    const punt = await zetPlan(id, String(body.plan).slice(0, 40000), regel);
    return NextResponse.json({ ok: true, punt, tellers: await werkMeldingenBij() });
  }

  const stand = String(body?.stand ?? "") as Stand;
  if (!STANDEN.includes(stand)) {
    return NextResponse.json({ ok: false, error: "Onbekende stand." }, { status: 400 });
  }

  // ── HET KADER: goedkeuren is van Maarten, van niemand anders ──
  const keurGoed = Boolean(body?.keurGoed);
  if (keurGoed && meekijker) {
    return NextResponse.json({
      ok: false,
      error: "Alleen jij keurt een plan goed. Een ronde kan dat niet voor zichzelf doen.",
    }, { status: 403 });
  }
  if (stand === "wachtrij" && meekijker && !huidig.goedgekeurd) {
    return NextResponse.json({
      ok: false,
      error: "Dit punt heeft nog geen akkoord. Zet het op plan-klaar; Maarten beslist of het de bouwwachtrij in gaat.",
    }, { status: 403 });
  }

  const plan = typeof body?.plan === "string" ? String(body.plan).slice(0, 40000) : undefined;

  // Vóór het opslaan al netjes weigeren, zodat het scherm een leesbare reden
  // krijgt in plaats van een kale fout uit de database.
  if (stand === "wachtrij" || stand === "bouwt") {
    const mag = magNaarWachtrij({
      plan: plan ?? huidig.plan,
      goedgekeurd: keurGoed ? new Date().toISOString() : huidig.goedgekeurd,
    });
    if (!mag.ok) return NextResponse.json({ ok: false, error: mag.reden }, { status: 400 });
  }

  try {
    const punt = await zetStand(id, stand, {
      regel,
      plan,
      keurGoed,
      omvang: OMVANGEN.includes(body?.omvang) ? (body.omvang as Omvang) : undefined,
      routekaart: typeof body?.routekaart === "string" ? body.routekaart.slice(0, 10).trim() || null : undefined,
      // De rondeteller wordt hier NIET opgehoogd: dat gebeurt op het moment dat
      // een ronde het punt claimt (lib/punt-ronde.ts). Zou het hier ook gebeuren,
      // dan telde één bouw voor twee en zegt "3 bouwrondes" niets meer.
    });
    return NextResponse.json({ ok: true, punt, tellers: await werkMeldingenBij() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "Geen punt opgegeven." }, { status: 400 });
  await verwijderPunt(id);
  return NextResponse.json({ ok: true, tellers: await werkMeldingenBij() });
}
