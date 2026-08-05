import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { sql, ensureSchema } from "../../../../../lib/db";
import { anthropicConfigured } from "../../../../../lib/anthropic";
import { tidyCard, tidyCards } from "../../../../../lib/weekplan-tidy";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// "Ruim op": herschrijft de kaarttekst één keer naar het strakke formaat
// (Doel-kennis, Afspraken, Aanpak per fase). Alleen op Maartens klik; de prompt
// verbiedt verzinnen en weggooien, dus de inhoud blijft, alleen de ordening niet.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const id = Number(body.id);
  if (!slug || (!id && body.all !== true)) return NextResponse.json({ ok: false, error: "Klant en kaart-id zijn verplicht." }, { status: 400 });

  await ensureSchema();

  // "Alles opruimen": alle kaarten van deze klant in één keer. Handig voor kaarten
  // die al vol dubbelingen stonden voordat het samenvoegen zelf ging opruimen.
  if (body.all === true) {
    const { rows: alle } = await sql`SELECT id FROM client_weekplan WHERE client_slug = ${slug} AND status <> 'klaar' ORDER BY id`;
    const alleIds = alle.map((r) => Number(r.id));
    // Begrensd zodat de route niet halverwege wordt afgekapt. Wat niet meekomt
    // wordt gemeld in plaats van stil overgeslagen; nog een keer klikken pakt de rest.
    const MAX = 20;
    const ids = alleIds.slice(0, MAX);
    const rest = alleIds.length - ids.length;
    const n = await tidyCards(slug, ids);
    return NextResponse.json({
      ok: true,
      opgeruimd: n,
      bekeken: ids.length,
      rest,
      samenvatting: (n ? `${n} van de ${ids.length} kaarten opgeruimd.` : "Er viel niets op te ruimen.")
        + (rest > 0 ? ` Nog ${rest} te gaan, klik nog een keer.` : ""),
    });
  }

  const nieuw = await tidyCard(slug, id);
  if (!nieuw) return NextResponse.json({ ok: false, error: "Opruimen leverde geen bruikbare tekst op; er is niets gewijzigd." }, { status: 502 });
  return NextResponse.json({ ok: true, toelichting: nieuw });
}
