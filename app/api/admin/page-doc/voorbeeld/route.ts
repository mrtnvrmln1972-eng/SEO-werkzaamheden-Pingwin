import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { maakCopyKlantDoc } from "../../../../../lib/copy-doc-klant";

export const runtime = "nodejs";
export const maxDuration = 120;

// Bouwt het copy-klantdocument in het nieuwe formaat uit de al opgeslagen
// gegevens (geen herberekening) en zet het in de Drive-map van de pagina.
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const url = String(body.url || "").trim();
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en pagina zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const r = await maakCopyKlantDoc(slug, url);
  return r.ok ? NextResponse.json({ ok: true, link: r.link }) : NextResponse.json({ ok: false, error: r.error }, { status: 500 });
}
