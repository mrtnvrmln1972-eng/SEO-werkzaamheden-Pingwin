import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { GOLVEN, raming, zetInDeRij, stopDeRij, getBulkStand, verwerkRij, type Golf } from "../../../../lib/onboarding-bulk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Eén klant onboarden duurt minuten; de werker doet er meerdere achter elkaar.
export const maxDuration = 800;

const isGolf = (v: unknown): v is Golf => (GOLVEN as readonly string[]).includes(String(v));
const admin = (req: NextRequest) => verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);

// GET ?golf=basis  → de raming vóór de start: wie heeft het nodig en wat kost het.
// GET              → de stand van de lopende rij.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  try {
    const golf = req.nextUrl.searchParams.get("golf");
    if (golf) {
      if (!isGolf(golf)) return NextResponse.json({ ok: false, error: "Onbekende golf." }, { status: 400 });
      return NextResponse.json({ ok: true, raming: await raming(golf) });
    }
    return NextResponse.json({ ok: true, stand: await getBulkStand() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

// POST { golf, slugs } → de rij vullen en meteen beginnen.
// POST { stop: true }  → de rij stilzetten.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: { golf?: string; slugs?: string[]; stop?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  try {
    if (body.stop) {
      // Stoppen mag alleen wie ook mag starten; de poort van de eerste klant in
      // de rij is daarvoor de juiste toets.
      const eerste = (await getBulkStand()).rijen[0]?.slug || "";
      if (eerste) { const g = await guardSlug(req, eerste); if (!g.ok) return g.res; }
      return NextResponse.json({ ok: true, gestopt: await stopDeRij() });
    }

    if (!isGolf(body.golf)) return NextResponse.json({ ok: false, error: "Kies eerst een golf." }, { status: 400 });
    const slugs = [...new Set((body.slugs || []).map((s) => String(s || "").trim()).filter(Boolean))];
    if (!slugs.length) return NextResponse.json({ ok: false, error: "Er is geen enkele klant aangevinkt." }, { status: 400 });
    // Per klant de gewone poort: een gast zonder schrijfrecht op een klant kan
    // die klant ook niet via de bulkrij aan het werk zetten.
    for (const slug of slugs) { const g = await guardSlug(req, slug); if (!g.ok) return g.res; }

    // De rem zit ook in de werker, maar vóóraf weigeren is eerlijker dan een rij
    // vullen die zichzelf meteen stilzet.
    const r = await raming(body.golf, slugs);
    if (!r.past) {
      return NextResponse.json({
        ok: false,
        error: `Dit past niet binnen je Ahrefs-tegoed: ${r.aantal} klanten kosten ongeveer ${r.units.toLocaleString("nl-NL")} units en er is nog ${(r.over ?? 0).toLocaleString("nl-NL")} over (ondergrens ${r.bodem.toLocaleString("nl-NL")}). Vink minder klanten aan, of wacht tot de teller reset.`,
        raming: r,
      }, { status: 400 });
    }

    const n = await zetInDeRij(body.golf, slugs);
    // Meteen beginnen, maar het antwoord niet laten wachten; de cron pakt de rest.
    waitUntil(verwerkRij(3).catch(() => { /* het cron-vangnet pakt hem op */ }));
    return NextResponse.json({ ok: true, inDeRij: n, stand: await getBulkStand() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
