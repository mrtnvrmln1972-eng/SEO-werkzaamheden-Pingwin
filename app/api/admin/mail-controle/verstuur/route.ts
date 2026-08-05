import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getControle, markeerVerstuurd, bewaarConcept } from "../../../../../lib/mail-controle";
import { msReplyInThread, msSendMail } from "../../../../../lib/ms-graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Het concept-antwoord versturen. Bewust een aparte route van de rest: versturen
// is de enige onomkeerbare handeling in dit hele onderdeel, en die hoort niet
// verstopt te zitten in een PATCH die ook velden bijwerkt.
//
// Er gaat nooit iets automatisch weg; hier komt Maarten pas terecht nadat hij het
// concept heeft gelezen en op versturen heeft geklikt.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  const slug = String(body.slug || "");
  const g = await guardSlug(req, slug);
  if (!g.ok) return g.res;

  const id = Number(body.id || 0);
  const controle = id ? await getControle(slug, id) : null;
  if (!controle) return NextResponse.json({ ok: false, error: "Deze controle bestaat niet." }, { status: 404 });

  const html = String(body.html || controle.conceptHtml || "").trim();
  if (!html) return NextResponse.json({ ok: false, error: "Er is nog geen bericht om te versturen." }, { status: 400 });

  const onderwerp = String(body.onderwerp || controle.conceptOnderwerp || "").trim();
  const to = String(body.to || controle.devAdres || "")
    .split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  if (!to.length) return NextResponse.json({ ok: false, error: "Vul in naar wie het antwoord moet." }, { status: 400 });

  // Bewaren wat er echt verstuurd wordt, zodat het scherm en de mailbox hetzelfde
  // laten zien.
  await bewaarConcept(slug, id, onderwerp, html);

  // In de thread blijven als het kan; is er geen mail om op te antwoorden (de
  // controle kwam uit een vrije vraag), dan een nieuwe mail.
  const uit = controle.messageId
    ? await msReplyInThread(controle.messageId, html, to)
    : await msSendMail(to, onderwerp || "Controle van de website", html);

  if (!uit.ok) return NextResponse.json({ ok: false, error: uit.error || "Versturen mislukt." }, { status: 502 });

  await markeerVerstuurd(slug, id);
  return NextResponse.json({ ok: true, sentTo: uit.sentTo || to });
}
