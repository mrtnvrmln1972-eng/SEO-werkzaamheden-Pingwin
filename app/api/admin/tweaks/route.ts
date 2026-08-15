import { NextRequest, NextResponse } from "next/server";
import { guardDev, isMeekijker } from "../../../../lib/admin-scope";
import { meldingToevoegen, meldingIntrekken } from "../../../../lib/meldingen";
import {
  haalTweaks, haalBeeld, nieuweTweak, zetStand, zetPrioriteit, verwijderTweak, telOpen,
  MAX_BEELD, type Stand, type Soort, type Prioriteit,
} from "../../../../lib/tweaks";
import { rondeStand } from "../../../../lib/tweak-ronde";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// DE TWEAK-STAPEL
// ═══════════════════════════════════════════════════════════
// GET                lijst (alleen wat loopt, of alles met ?alles=1)
// GET ?beeld=<id>    de schermafbeelding van één melding, los
// GET ?tel=1         de tellers voor het knopje
// POST               nieuwe melding
// PATCH              stand bijwerken, met een regel voor het draadje
// DELETE ?id=        weghalen
//
// EEN UITZONDERING OP "MEEKIJKEN IS ALLEEN KIJKEN", EN WAAROM
// ───────────────────────────────────────────────────────────
// Claude werkt via een alleen-lezen sessie (/api/kijk); die mag nergens iets
// wijzigen, en dat blijft zo. Behalve hier, en alleen voor de stand van een
// melding. Zonder dat recht kan hij niet melden dat hij aan iets begonnen is of
// dat het klaarstaat om te controleren, en dan moet Maarten dat zelf bijhouden;
// precies het handwerk dat deze stapel moest weghalen.
//
// De uitzondering is bewust zo smal mogelijk: alleen PATCH, alleen de stand en
// het draadje, nooit de tekst van een melding, nooit verwijderen, en nergens
// anders in het dashboard. Klantgegevens komen er niet aan te pas.
// ═══════════════════════════════════════════════════════════

const STANDEN: Stand[] = ["wachtrij", "bezig", "controleer", "klaar", "apart", "routekaart"];
const SOORTEN: Soort[] = ["tweak", "idee"];
const PRIORITEITEN: Prioriteit[] = ["nu", "gewoon", "geparkeerd"];

/** De melding in de kopbalk: het seintje dat er iets klaarstaat om te bekijken. */
const MELDING_BRON = "tweaks";

export async function GET(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;
  const p = req.nextUrl.searchParams;

  if (p.get("tel")) return NextResponse.json({ ok: true, tellers: await telOpen() });

  const beeldId = p.get("beeld");
  if (beeldId) {
    return NextResponse.json({ ok: true, beeld: await haalBeeld(Number(beeldId)) });
  }

  const tweaks = await haalTweaks(p.get("alles") === "1");
  // De stand van de ronde hoort bij de lijst: staat er iets op "bezig" terwijl er
  // geen ronde loopt, dan klopt het beeld niet. rondeStand() ruimt een
  // vastgelopen ronde meteen op, dus die vraag repareert zichzelf.
  return NextResponse.json({ ok: true, tweaks, tellers: await telOpen(), ronde: await rondeStand() });
}

export async function POST(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;
  const body = await req.json().catch(() => null);
  const tekst = String(body?.tekst ?? "").trim();
  if (!tekst) return NextResponse.json({ ok: false, error: "Zonder tekst weet ik niet wat er moet gebeuren." }, { status: 400 });

  // Een te groot beeld laat de melding niet mislukken; de tekst is het
  // belangrijkste deel. Wel eerlijk terugmelden dat het eraf is, anders denkt
  // Maarten dat de schermafbeelding meegestuurd is.
  const ruwBeeld = typeof body?.beeld === "string" ? body.beeld : "";
  const beeldTeGroot = ruwBeeld.length > MAX_BEELD;
  const soort = SOORTEN.includes(body?.soort) ? (body.soort as Soort) : "tweak";

  const tweak = await nieuweTweak({
    tekst,
    pad: String(body?.pad ?? "").slice(0, 300),
    scherm: String(body?.scherm ?? "").slice(0, 200),
    klant: body?.klant ? String(body.klant).slice(0, 100) : null,
    beeld: !ruwBeeld || beeldTeGroot ? null : ruwBeeld,
    soort,
  });
  return NextResponse.json({ ok: true, tweak, tellers: await telOpen(), beeldTeGroot });
}

export async function PATCH(req: NextRequest) {
  // Claude mag hier als enige plek in het dashboard wél schrijven; zie de
  // toelichting bovenaan dit bestand.
  const meekijker = isMeekijker(req);
  if (!meekijker) {
    const g = await guardDev(req); if (!g.ok) return g.res;
  }

  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!id) return NextResponse.json({ ok: false, error: "Onbekende melding." }, { status: 400 });

  // Direct doorvoeren of parkeren is een keuze van Maarten, geen stand die een
  // ronde zet. De meekijk-sessie komt hier dus niet aan: die mag alleen melden
  // hoe ver hij is, niet bepalen wat er voorrang krijgt.
  const prioriteit = String(body?.prioriteit ?? "") as Prioriteit;
  if (prioriteit) {
    if (meekijker) {
      return NextResponse.json({ ok: false, error: "Alleen jij bepaalt de voorrang." }, { status: 403 });
    }
    if (!PRIORITEITEN.includes(prioriteit)) {
      return NextResponse.json({ ok: false, error: "Onbekende voorrang." }, { status: 400 });
    }
    await zetPrioriteit(id, prioriteit);
    if (!body?.stand) return NextResponse.json({ ok: true, tellers: await telOpen() });
  }

  const stand = String(body?.stand ?? "") as Stand;
  if (!STANDEN.includes(stand)) {
    return NextResponse.json({ ok: false, error: "Onbekende stand." }, { status: 400 });
  }

  const reactieTekst = String(body?.reactie ?? "").slice(0, 2000).trim();
  const vanClaude = Boolean(meekijker);

  await zetStand(id, stand, {
    notitie: typeof body?.notitie === "string" ? body.notitie.slice(0, 500) : undefined,
    punt: typeof body?.punt === "string" ? body.punt.slice(0, 10).trim() || null : undefined,
    reactie: reactieTekst
      ? { van: vanClaude ? "claude" : "maarten", tekst: reactieTekst, wanneer: new Date().toISOString() }
      : undefined,
    // Terug van "controleer" naar de wachtrij is een correctie: het klopte niet
    // in één keer. Dat telt als een extra ronde, zodat later zichtbaar is welke
    // dingen blijven terugkomen.
    telRonde: stand === "wachtrij" && String(body?.vorige ?? "") === "controleer",
  });

  // Het seintje. Eén melding voor de hele stapel in plaats van één per tweak,
  // anders staat de kopbalk vol na een ronde van tien.
  const tellers = await telOpen();
  if (tellers.controleer > 0) {
    await meldingToevoegen({
      soort: "dev-af",
      titel: "Tweaks klaar om te bekijken",
      regel: tellers.controleer === 1
        ? "Eén aanpassing staat live. Klopt het?"
        : `${tellers.controleer} aanpassingen staan live. Kloppen ze?`,
      link: "/admin/tweaks",
      bron: MELDING_BRON,
      bronId: "stapel",
    });
  } else {
    await meldingIntrekken(MELDING_BRON, "stapel", "dev-af");
  }

  return NextResponse.json({ ok: true, tellers });
}

export async function DELETE(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "Geen melding opgegeven." }, { status: 400 });
  await verwijderTweak(id);
  return NextResponse.json({ ok: true, tellers: await telOpen() });
}
