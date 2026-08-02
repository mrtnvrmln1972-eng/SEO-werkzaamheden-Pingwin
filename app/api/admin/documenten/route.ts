import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";
import { getDocumentenOverzicht } from "../../../../lib/documenten";
import { herstelDocumenten } from "../../../../lib/doc-herstel";

export const runtime = "nodejs";
// Herstellen bouwt documenten en uploadt ze naar Drive; dat mag even duren.
export const maxDuration = 300;

// Alle documenten van één klant op een rij: per pagina welke analyse, blauwdruk en
// copy er zijn, van wanneer, en of de copy inmiddels op de site staat.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  try {
    const paginas = await getDocumentenOverzicht(slug);
    return NextResponse.json({
      ok: true,
      paginas,
      totaal: paginas.reduce((n, p) => n + p.docs.length, 0),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Het documentenoverzicht kon niet opgehaald worden." }, { status: 500 });
  }
}

// POST { herstel: true }: documenten die wel tekst hebben maar geen bestand alsnog
// in de huisstijl aanmaken en in Drive zetten.
export async function POST(req: NextRequest) {
  let body: { slug?: string; herstel?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (body.herstel !== true) return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });

  try {
    const uit = await herstelDocumenten(slug);
    const delen: string[] = [];
    if (uit.hersteld) delen.push(`${uit.hersteld} ${uit.hersteld === 1 ? "document" : "documenten"} alsnog aangemaakt`);
    if (uit.overgeslagen.length) delen.push(`${uit.overgeslagen.length} overgeslagen`);
    return NextResponse.json({
      ok: true, ...uit,
      samenvatting: uit.bekeken === 0
        ? "Alle documenten hebben al een link; er viel niets te herstellen."
        : delen.join(", ") + ".",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Herstellen mislukte: " + (e as Error).message }, { status: 500 });
  }
}
