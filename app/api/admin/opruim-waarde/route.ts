import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { waitUntil } from "@vercel/functions";
import { draaiKlus, getKlus } from "../../../../lib/klussen";
import { getClientBySlug } from "../../../../lib/clients";
import { weegOpruimlijstOpnieuw } from "../../../../lib/cannibal-redirect";

export const runtime = "nodejs";
// Ahrefs bevragen voor tot een paar honderd zoekwoorden; ruim binnen dit venster,
// en de tweede keer komt alles uit de cache van 30 dagen.
export const maxDuration = 300;

// Haalt de waarde-rem over de werklijst die er AL ligt: elke pagina waarvan de
// eigen zoekterm volume heeft en die niemand anders bezit, gaat van de omleidlijst
// af naar de lijst "oppakken". Zo hoeft er geen nieuwe analyse te draaien om een
// pagina als /soa-test-kopen/ te redden.
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const client = await getClientBySlug(slug);
  const domain = (client?.domain || "").trim();
  if (!domain) return NextResponse.json({ ok: false, error: "Deze klant heeft nog geen domein ingevuld." }, { status: 400 });

  const lopend = await getKlus(slug, "opruim-herwegen").catch(() => null);
  if (lopend?.status === "bezig") return NextResponse.json({ ok: true, alBezig: true });

  waitUntil(draaiKlus(slug, "opruim-herwegen", "De opruimlijst opnieuw wegen", 0, async (stap) => {
    await stap(0, "Volume, haalbaarheid en bedragen opnieuw uitrekenen");
    await weegOpruimlijstOpnieuw(slug, domain);
    return "De lijst is opnieuw gewogen.";
  }));
  return NextResponse.json({ ok: true, gestart: true });
}
