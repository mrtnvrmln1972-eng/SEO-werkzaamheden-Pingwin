import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";
import { getPaginaMails, zoekMailsVoorPagina, pinMail, losMail, wegMail } from "../../../../lib/page-emails";

export const runtime = "nodejs";
export const maxDuration = 60;

// Mails die bij één pagina horen: ophalen, opnieuw zoeken, vastpinnen,
// losmaken of wegklikken. Weggeklikt blijft weg; die komt nooit terug als
// voorstel.

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en pagina zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  try {
    return NextResponse.json({ ok: true, mails: await getPaginaMails(slug, url) });
  } catch {
    return NextResponse.json({ ok: false, error: "De mails konden niet opgehaald worden." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "");
  const url = String(body.url || "");
  const actie = String(body.actie || "");
  const id = Number(body.id || 0);
  if (!slug) return NextResponse.json({ ok: false, error: "Klant is verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  try {
    if (actie === "zoek") {
      if (!url) return NextResponse.json({ ok: false, error: "Pagina is verplicht." }, { status: 400 });
      const r = await zoekMailsVoorPagina(slug, url);
      return NextResponse.json({ ok: true, ...r, mails: await getPaginaMails(slug, url) });
    }
    if (!id) return NextResponse.json({ ok: false, error: "Mail is verplicht." }, { status: 400 });
    if (actie === "pin") await pinMail(slug, id);
    else if (actie === "los") await losMail(slug, id);
    else if (actie === "weg") await wegMail(slug, id);
    else return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
    return NextResponse.json({ ok: true, mails: url ? await getPaginaMails(slug, url) : [] });
  } catch {
    return NextResponse.json({ ok: false, error: "De actie kon niet uitgevoerd worden." }, { status: 500 });
  }
}
