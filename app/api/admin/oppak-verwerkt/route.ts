import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { markeerOppakVerwerkt } from "../../../../lib/focus";

export const runtime = "nodejs";

// Legt vast dat het oppak-lijstje bij is. Raakt de tekst zélf niet aan: dit is
// alleen de stempel waarop het seintje afgaat.
//
// Waarom dit een eigen klik moet zijn: het lijstje slaat tijdens het typen
// automatisch op, dus zou "aangeraakt" tellen als "bijgewerkt", dan wist één
// komma het seintje terwijl er nog exact hetzelfde verouderde plan staat. Dat
// is precies wat er bij Kamsteeg gebeurde op 17 augustus 2026.

export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  let body: { slug?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  try {
    return NextResponse.json({ ok: true, verwerktTot: await markeerOppakVerwerkt(slug) });
  } catch {
    return NextResponse.json({ ok: false, error: "Vastleggen is niet gelukt." }, { status: 500 });
  }
}
