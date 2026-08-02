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
  // Een pad ("/tuinontwerp/strandtuin/") is genoeg: we zoeken de volledige URL erbij.
  let volUrl = url;
  if (url.startsWith("/")) {
    const { getClientUrls } = await import("../../../../../lib/site-urls");
    const urls = await getClientUrls(slug);
    const netjes = (p: string) => p.replace(/\/+$/, "").toLowerCase();
    const match = urls.find((u) => { try { return netjes(new URL(u.url).pathname) === netjes(url); } catch { return false; } });
    if (!match) return NextResponse.json({ ok: false, error: `Geen pagina gevonden met pad ${url}.` }, { status: 404 });
    volUrl = match.url;
  }
  const r = await maakCopyKlantDoc(slug, volUrl);
  return r.ok ? NextResponse.json({ ok: true, link: r.link }) : NextResponse.json({ ok: false, error: r.error }, { status: 500 });
}
