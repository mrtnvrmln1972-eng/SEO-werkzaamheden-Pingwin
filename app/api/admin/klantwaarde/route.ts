import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug, getScopeFromCookie, canAccessSlug } from "../../../../lib/admin-scope";
import { ADMIN_VIEWAS_COOKIE } from "../../../../lib/constants";
import { listClients } from "../../../../lib/clients";
import { getEuroInstelling, zetEuroInstelling } from "../../../../lib/opruim-euro";
import { wisSignaalCache } from "../../../../lib/onboarding";
import { isKlant } from "../../../../lib/klant-groepen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Klantwaarde en conversie in één keer voor alle klanten. Dit is het enige stuk
// van de onboarding dat Maarten écht zelf moet aanleveren, en het ontbrak bij
// alle negentien klanten: negentien keer doorklikken naar een tabje kost een
// middag, negentien regeltjes op één scherm kost een kwartier. Zonder deze twee
// getallen kan geen enkele opruim- of prioriteitenlijst een bedrag noemen.

const admin = (req: NextRequest) => verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);

export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const scope = await getScopeFromCookie(req.cookies.get(ADMIN_COOKIE)?.value, req.cookies.get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  try {
    const klanten = (await listClients()).filter((c) => isKlant(c) && canAccessSlug(scope, c.slug));
    const rijen = await Promise.all(klanten.map(async (c) => {
      const e = await getEuroInstelling(c.slug).catch(() => ({ klantwaarde: 0, conversie: 0, ingevuld: false }));
      return { slug: c.slug, naam: c.name, ...e };
    }));
    return NextResponse.json({ ok: true, rijen });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

// POST { rijen: [{ slug, klantwaarde, conversie }] }
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: { rijen?: { slug?: string; klantwaarde?: number; conversie?: number }[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  const rijen = (body.rijen || []).filter((r) => String(r?.slug || "").trim());
  if (!rijen.length) return NextResponse.json({ ok: false, error: "Er is niets ingevuld." }, { status: 400 });

  try {
    const uit: { slug: string; klantwaarde: number; conversie: number; ingevuld: boolean }[] = [];
    for (const r of rijen) {
      const slug = String(r.slug).trim();
      // Per klant de gewone poort; de grenzen op de getallen zitten in
      // zetEuroInstelling, dus een typefout van 300% conversie komt er niet door.
      const g = await guardSlug(req, slug); if (!g.ok) return g.res;
      const e = await zetEuroInstelling(slug, Number(r.klantwaarde) || 0, Number(r.conversie) || 0);
      uit.push({ slug, ...e });
    }
    wisSignaalCache();
    return NextResponse.json({ ok: true, rijen: uit });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
