import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { bewaarGa4Property, ga4Stand } from "../../../../lib/ga4-pagina";
import { bewaarClarityToken, clarityStand, haalClarity, verwijderClarityToken } from "../../../../lib/clarity";
import type { Dagen, Dimensie } from "../../../../lib/clarity";

// ═══════════════════════════════════════════════════════════
// DE KOPPELINGEN VOOR GEDRAGSDATA: ANALYTICS EN CLARITY
// ═══════════════════════════════════════════════════════════
// Eén route voor allebei, want voor Maarten is het één ding: weet dit dashboard
// wat bezoekers op een pagina doen, ja of nee. Analytics vindt zichzelf meestal
// (zoeken op het domein binnen zijn Google-account); Clarity heeft een sleutel
// nodig die per project met de hand gemaakt wordt.
//
// De sleutel gaat NOOIT terug naar de browser, net als bij WordPress: het scherm
// krijgt alleen te horen óf hij er is. En schrijven kan alleen wie schrijfrecht
// heeft: guardSlug weigert elke POST van een meekijk-sessie.
// ═══════════════════════════════════════════════════════════

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const klant = await getClientBySlug(slug);
  const [ga4, clarity] = await Promise.all([
    ga4Stand(slug, klant?.domain || "").catch(() => ({ gekoppeld: false, property: null })),
    clarityStand(slug),
  ]);
  return NextResponse.json({ ok: true, ga4, clarity });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const actie = String(body.actie || "");

  if (actie === "ga4") {
    await bewaarGa4Property(slug, String(body.property || ""));
    const klant = await getClientBySlug(slug);
    const ga4 = await ga4Stand(slug, klant?.domain || "").catch(() => ({ gekoppeld: false, property: null }));
    return NextResponse.json({ ok: true, ga4 });
  }

  if (actie === "clarity-sleutel") {
    const sleutel = String(body.sleutel || "").trim();
    if (sleutel) await bewaarClarityToken(slug, sleutel);
    else await verwijderClarityToken(slug);
    return NextResponse.json({ ok: true, clarity: await clarityStand(slug) });
  }

  if (actie === "clarity-ophalen") {
    const dagen = ([1, 2, 3].includes(Number(body.dagen)) ? Number(body.dagen) : 3) as Dagen;
    const dimensie = (String(body.dimensie || "URL") || "URL") as Dimensie;
    const uit = await haalClarity(slug, dagen, dimensie);
    return NextResponse.json({ ...uit, clarity: await clarityStand(slug) }, { status: uit.ok ? 200 : 400 });
  }

  return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
}
