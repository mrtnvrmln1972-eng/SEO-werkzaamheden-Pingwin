import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";
import { getActiviteit, zetZichtbaar } from "../../../../lib/activiteit";
import { vulActiviteitUitBestaandeData } from "../../../../lib/activiteit-vullen";

export const runtime = "nodejs";
// Het terugwerkend vullen leest zeven tabellen door; met veel geschiedenis mag dat even duren.
export const maxDuration = 120;

// GET: het logboek van deze klant.
// POST { vullen: true }: eenmalig vullen uit wat er al in de bestaande tabellen staat.
// POST { id, zichtbaar }: één regel wel of niet met de klant delen.
//
// Alles via guardSlug, dus een meekijk-sessie leest wel en schrijft niet.

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  try {
    const rijen = await getActiviteit(slug);
    return NextResponse.json({ ok: true, rijen, totaal: rijen.length });
  } catch {
    return NextResponse.json({ ok: false, error: "Het logboek kon niet opgehaald worden." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { slug?: string; vullen?: boolean; id?: number; zichtbaar?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  if (body.vullen === true) {
    try {
      const voor = (await getActiviteit(slug)).length;
      const uit = await vulActiviteitUitBestaandeData(slug);
      const na = (await getActiviteit(slug)).length;
      const nieuw = na - voor;
      return NextResponse.json({
        ok: true, ...uit, nieuw, totaal: na,
        samenvatting: nieuw === 0
          ? `Niets nieuws gevonden; het logboek stond al bij (${na} regels).`
          : `${nieuw} ${nieuw === 1 ? "regel" : "regels"} toegevoegd uit wat er al vastlag. Totaal ${na}.`,
      });
    } catch (e) {
      return NextResponse.json({ ok: false, error: "Vullen mislukte: " + (e as Error).message }, { status: 500 });
    }
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "Geen geldige regel." }, { status: 400 });
  try {
    await zetZichtbaar(slug, id, body.zichtbaar === true);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Bijwerken mislukte." }, { status: 500 });
  }
}
