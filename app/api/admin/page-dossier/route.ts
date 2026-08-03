import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";
import { getPageDossier } from "../../../../lib/page-dossier";
import { getDossierTekst } from "../../../../lib/page-dossier-tekst";
import { dossierBlokHtml } from "../../../../lib/dossier-blok";
import { getClientUrls } from "../../../../lib/site-urls";
import { urlKey } from "../../../../lib/url-key";

export const runtime = "nodejs";
export const maxDuration = 60;

// Het paginadossier: alles wat over één pagina speelt, plus de geschreven
// samenvatting en het kant-en-klare blok.
//
// Eén endpoint voor alle vier de plekken (bird's eye-chat, voorgestelde taak,
// weekplankaart, Pagina's). Dat is precies waarom ze niet uit de pas kunnen
// lopen: ze lezen dezelfde opgeslagen alinea.

// Een chat-antwoord noemt een PAD (/crp-waarde-testen/), geen volledig adres.
// Dat pad wordt hier omgezet naar de echte URL van deze klant. Bestaat de pagina
// niet, dan komt er bewust niets terug: liever geen blok dan een blok over een
// pagina die niet bestaat.
async function volledigeUrl(slug: string, invoer: string): Promise<string> {
  if (/^https?:\/\//i.test(invoer)) return invoer;
  const urls = await getClientUrls(slug).catch(() => []);
  const gezocht = invoer.replace(/^\/+|\/+$/g, "").toLowerCase();
  if (!gezocht) return "";
  const treffer = urls.find((u) => {
    try { return new URL(u.url).pathname.replace(/^\/+|\/+$/g, "").toLowerCase() === gezocht; }
    catch { return urlKey(u.url).endsWith(gezocht); }
  });
  return treffer?.url || "";
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const gevraagd = req.nextUrl.searchParams.get("url") || "";
  const compact = req.nextUrl.searchParams.get("compact") === "1";
  if (!slug || !gevraagd) return NextResponse.json({ ok: false, error: "Klant en pagina zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  try {
    const url = await volledigeUrl(slug, gevraagd);
    if (!url) return NextResponse.json({ ok: true, tekst: "", html: "", onbekend: true });
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
  const gevraagd = String(body.url || "");
  if (!slug || !gevraagd) return NextResponse.json({ ok: false, error: "Klant en pagina zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  try {
    const url = await volledigeUrl(slug, gevraagd);
    if (!url) return NextResponse.json({ ok: false, error: "Deze pagina staat niet in de lijst van deze klant." }, { status: 404 });
    // Bewust forceren: wie op Ververs drukt wil een nieuwe zoekronde, niet
    // het antwoord van vorige week.
    const vers = await getPageDossier(slug, url, { forceerMail: true });
    const { tekst, controle } = await getDossierTekst(slug, url, { ververs: true, dossier: vers });
    return NextResponse.json({ ok: true, tekst, controle, html: dossierBlokHtml(vers, tekst), mails: vers.mails });
  } catch {
    return NextResponse.json({ ok: false, error: "Verversen mislukte." }, { status: 500 });
  }
}
