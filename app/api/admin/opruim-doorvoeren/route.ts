import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getWpConnForClient, createWpRedirect, verifyRedirect } from "../../../../lib/wp";
import { zetOpruimRegel } from "../../../../lib/opruim-regels";
import { legNulmetingVast } from "../../../../lib/opruim-nameten";
import { getClientBySlug } from "../../../../lib/clients";

export const runtime = "nodejs";
export const maxDuration = 300;

// De aangevinkte redirects in één keer doorvoeren op de site, via de
// Redirection-plugin die het dashboard al gebruikt. Elke regel wordt daarna LIVE
// nagemeten; alleen wat aantoonbaar werkt wordt afgevinkt. Bewijs boven beloftes,
// ook hier: "doorgevoerd" betekent dat de omleiding echt is gezien.
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const rijen = (Array.isArray(body.rijen) ? body.rijen : []) as { van: string; naar: string }[];
  if (!slug || !rijen.length) return NextResponse.json({ ok: false, error: "Niets aangevinkt." }, { status: 400 });

  const conn = await getWpConnForClient(slug).catch(() => null);
  if (!conn) {
    return NextResponse.json({
      ok: false,
      error: "Deze klant heeft nog geen WordPress-koppeling. Koppel de site op de Klant-tab (applicatiewachtwoord) en probeer het opnieuw.",
    }, { status: 400 });
  }

  // Het domein is nodig voor de nulmeting: op het moment dat een omleiding live
  // gaat, leggen we vast hoe de winnaar er dán voor staat. Achteraf reconstrueren
  // kan niet, want Search Console-data is dan al verschoven.
  const domain = (await getClientBySlug(slug).catch(() => null))?.domain || "";

  const gelukt: string[] = [];
  const mislukt: { van: string; reden: string }[] = [];
  for (const r of rijen.slice(0, 100)) {
    const van = String(r.van || "").trim();
    const naar = String(r.naar || "").trim();
    if (!van || !naar) { mislukt.push({ van, reden: "Van of naar ontbreekt." }); continue; }
    try {
      await createWpRedirect(conn, van, naar);
      // Meteen nameten: staat de omleiding er echt?
      const check = await verifyRedirect(conn.url, van, naar).catch(() => ({ ok: false, detail: "niet te controleren" }));
      if (check.ok) {
        gelukt.push(van);
        await zetOpruimRegel(slug, van, { besluit: "redirect", naar, doorgevoerd: true });
        // Nooit de doorvoering laten klappen op een meting; dit is bijvangst.
        if (domain) await legNulmetingVast(slug, domain, van, naar).catch(() => { /* stil */ });
      } else {
        mislukt.push({ van, reden: `Aangemaakt, maar de controle zag hem nog niet: ${check.detail}` });
      }
    } catch (e) {
      mislukt.push({ van, reden: e instanceof Error ? e.message : "onbekende fout" });
    }
  }
  return NextResponse.json({ ok: gelukt.length > 0, gelukt: gelukt.length, mislukt, totaal: rijen.length });
}
