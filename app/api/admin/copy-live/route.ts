import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";
import { getCopyLiveAll, runCopyLiveCheck } from "../../../../lib/copy-live";

export const runtime = "nodejs";
// De check haalt alle pagina's met een copy-document op, zes tegelijk. Bij een
// klant met tientallen pagina's mag dat even duren.
export const maxDuration = 300;

// GET: de laatst gemeten stand (snel, uit de database).
// POST: opnieuw meten, dat is de knop "Controleer de site".
//
// Beide via guardSlug, dus een meekijk-sessie kan wel de stand lezen en niet meten.

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  try {
    const stand = await getCopyLiveAll(slug);
    const rijen = Object.values(stand);
    return NextResponse.json({
      ok: true,
      rijen,
      doorgevoerd: rijen.filter((r) => r.doorgevoerd).length,
      gemeten: rijen.length,
      laatst: rijen.map((r) => r.gemeten).filter(Boolean).sort().pop() || null,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "De stand kon niet opgehaald worden." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { slug?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  try {
    const uitkomst = await runCopyLiveCheck(slug);
    const nogNiet = uitkomst.meetbaar - uitkomst.doorgevoerd;
    const delen = [`${uitkomst.doorgevoerd} van de ${uitkomst.meetbaar} pagina's staat live`];
    if (nogNiet > 0) delen.push(`${nogNiet} nog niet doorgevoerd`);
    // Onleesbare pagina's apart benoemen: dat is iets anders dan niet doorgevoerd
    // en vraagt om een andere actie (site blokkeert ons, of de pagina bestaat niet).
    if (uitkomst.onleesbaar > 0) delen.push(`${uitkomst.onleesbaar} kon ik niet lezen`);
    return NextResponse.json({
      ok: true,
      ...uitkomst,
      samenvatting: uitkomst.gemeten === 0
        ? "Er is nog geen copy geschreven om te controleren."
        : delen.join("; ") + ".",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "De controle mislukte: " + (e as Error).message }, { status: 500 });
  }
}
