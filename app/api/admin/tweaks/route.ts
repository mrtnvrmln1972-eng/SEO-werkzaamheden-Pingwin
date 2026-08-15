import { NextRequest, NextResponse } from "next/server";
import { guardDev } from "../../../../lib/admin-scope";
import {
  haalTweaks, haalBeeld, nieuweTweak, zetStand, verwijderTweak, telOpen,
  MAX_BEELD, type Stand,
} from "../../../../lib/tweaks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// DE TWEAK-STAPEL
// ═══════════════════════════════════════════════════════════
// GET                lijst (alleen open, of alles met ?alles=1)
// GET ?beeld=<id>    de schermafbeelding van één melding, los
// GET ?tel=1         alleen het aantal open meldingen (voor het knopje)
// POST               nieuwe melding
// PATCH              stand bijwerken (gedaan / apart / terug op open)
// DELETE ?id=        weghalen
//
// Achter guardDev: dit is werkvloer, net als de routekaart. Een meekijk-sessie
// mag lezen maar niets toevoegen; dat regelt guardDev zelf op de methode.
// ═══════════════════════════════════════════════════════════

const STANDEN: Stand[] = ["open", "gedaan", "apart"];

export async function GET(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;
  const p = req.nextUrl.searchParams;

  if (p.get("tel")) return NextResponse.json({ ok: true, open: await telOpen() });

  const beeldId = p.get("beeld");
  if (beeldId) {
    const beeld = await haalBeeld(Number(beeldId));
    return NextResponse.json({ ok: true, beeld });
  }

  const tweaks = await haalTweaks(p.get("alles") === "1");
  return NextResponse.json({ ok: true, tweaks, open: tweaks.filter((t) => t.stand === "open").length });
}

export async function POST(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;
  const body = await req.json().catch(() => null);
  const tekst = String(body?.tekst ?? "").trim();
  if (!tekst) return NextResponse.json({ ok: false, error: "Zonder tekst weet ik niet wat er moet gebeuren." }, { status: 400 });

  // Een beeld dat de grens overschrijdt laat de melding niet mislukken; de
  // tekst is het belangrijkste deel. Wel eerlijk terugmelden dat hij eraf is,
  // anders denkt Maarten dat de schermafbeelding meegestuurd is.
  const ruwBeeld = typeof body?.beeld === "string" ? body.beeld : "";
  const beeldTeGroot = ruwBeeld.length > MAX_BEELD;
  const beeld = !ruwBeeld || beeldTeGroot ? null : ruwBeeld;

  const tweak = await nieuweTweak({
    tekst,
    pad: String(body?.pad ?? "").slice(0, 300),
    scherm: String(body?.scherm ?? "").slice(0, 200),
    klant: body?.klant ? String(body.klant).slice(0, 100) : null,
    beeld,
  });
  return NextResponse.json({ ok: true, tweak, open: await telOpen(), beeldTeGroot });
}

export async function PATCH(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;
  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  const stand = String(body?.stand ?? "") as Stand;
  if (!id || !STANDEN.includes(stand)) {
    return NextResponse.json({ ok: false, error: "Onbekende melding of stand." }, { status: 400 });
  }
  await zetStand(id, stand, String(body?.notitie ?? "").slice(0, 500));
  return NextResponse.json({ ok: true, open: await telOpen() });
}

export async function DELETE(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, error: "Geen melding opgegeven." }, { status: 400 });
  await verwijderTweak(id);
  return NextResponse.json({ ok: true, open: await telOpen() });
}
