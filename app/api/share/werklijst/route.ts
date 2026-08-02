import { NextRequest, NextResponse } from "next/server";
import { getSlugByWorklistToken, getWorklistData, setWorklistMark, verifyDevWorklist } from "../../../../lib/dev-worklist";
import { getClientBySlug } from "../../../../lib/clients";

export const runtime = "nodejs";
export const maxDuration = 300;

// Publieke afwerkpagina voor de sitebouwer: het deel-token is de toegang
// (zelfde patroon als het bedrijfsgegevens-formulier). Lezen, afvinken en de
// "Alles uniek, controleer maar"-hercontrole; verder niets.

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const slug = await getSlugByWorklistToken(token);
  if (!slug) return NextResponse.json({ ok: false, error: "Deze link is niet (meer) geldig." }, { status: 404 });
  const [data, client] = await Promise.all([getWorklistData(slug), getClientBySlug(slug)]);
  return NextResponse.json({
    ok: true,
    clientName: client?.name || "",
    pages: data.pages,
    dubbel: data.dubbel,
    marks: data.marks,
    updatedAt: data.state.updatedAt,
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const token = String(body.token || "").trim();
  const slug = await getSlugByWorklistToken(token);
  if (!slug) return NextResponse.json({ ok: false, error: "Deze link is niet (meer) geldig." }, { status: 404 });
  const action = String(body.action || "").trim();

  if (action === "vink") {
    const key = String(body.key || "").trim().slice(0, 300);
    if (!key) return NextResponse.json({ ok: false, error: "Geen punt opgegeven." }, { status: 400 });
    await setWorklistMark(slug, key, !!body.done, String(body.door || "").slice(0, 60));
    return NextResponse.json({ ok: true });
  }
  if (action === "controle") {
    // "Alles uniek, controleer maar": het dashboard meet de live pagina's en
    // zet de groene gecontroleerd-vinkjes; duurt even bij veel pagina's.
    const r = await verifyDevWorklist(slug);
    return r.ok ? NextResponse.json({ ok: true, samenvatting: r.samenvatting }) : NextResponse.json({ ok: false, error: r.error }, { status: 400 });
  }
  return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
}
