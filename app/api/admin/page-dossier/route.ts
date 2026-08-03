import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";
import { getPageDossier } from "../../../../lib/page-dossier";
import { getDossierTekst } from "../../../../lib/page-dossier-tekst";
import { dossierBlokHtml } from "../../../../lib/dossier-blok";

export const runtime = "nodejs";
export const maxDuration = 60;

// Het paginadossier: alles wat over één pagina speelt, plus de geschreven
// samenvatting en het kant-en-klare blok.
//
// Eén endpoint voor alle vier de plekken (bird's eye-chat, voorgestelde taak,
// weekplankaart, Pagina's). Dat is precies waarom ze niet uit de pas kunnen
// lopen: ze lezen dezelfde opgeslagen alinea.

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const url = req.nextUrl.searchParams.get("url") || "";
  const compact = req.nextUrl.searchParams.get("compact") === "1";
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en pagina zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  try {
    const { tekst, controle, dossier } = await getDossierTekst(slug, url);
    return NextResponse.json({
      ok: true,
      tekst,
      controle,
      html: dossierBlokHtml(dossier, tekst, { compact }),
      mails: dossier.mails,
      documenten: dossier.documenten,
      klantvoorstellen: dossier.klantvoorstellen,
      stand: dossier.stand,
      pad: dossier.pad,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Het dossier kon niet opgehaald worden." }, { status: 500 });
  }
}

// Opnieuw laten schrijven. Alleen bewust, met een knop; normaal ververst de
// alinea zichzelf zodra de feiten veranderen.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "");
  const url = String(body.url || "");
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en pagina zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  try {
    const vers = await getPageDossier(slug, url, { verseMail: true });
    const { tekst, controle } = await getDossierTekst(slug, url, { ververs: true, dossier: vers });
    return NextResponse.json({ ok: true, tekst, controle, html: dossierBlokHtml(vers, tekst), mails: vers.mails });
  } catch {
    return NextResponse.json({ ok: false, error: "Verversen mislukte." }, { status: 500 });
  }
}
