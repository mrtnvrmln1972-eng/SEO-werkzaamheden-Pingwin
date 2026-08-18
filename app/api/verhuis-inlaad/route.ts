import { NextRequest, NextResponse } from "next/server";
import { codeGeldig } from "../../../lib/verhuis-code";
import { inlaad, zorgVoorKlant, type KlantKaart } from "../../../lib/verhuizing";
import { vensterPoort } from "../../../lib/klantvenster";

export const runtime = "nodejs";
export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════
// DE VERHUISDEUR: hier komt een klant binnen uit een andere omgeving
// ═══════════════════════════════════════════════════════════
// Server-naar-server, dus zonder ingelogde gebruiker. Het slot is de code die
// deze kant zelf heeft gemaakt op /admin/verhuizen: een uur geldig, gebonden aan
// één klant, met één klik in te trekken. Zonder geldige code bestaat deze deur
// niet, en er is geen stand waarin hij standaard openstaat.
//
// De verzendende kant stuurt in happen: eerst de klantkaart, daarna per soort
// gegevens een reeks pakketjes. De eerste hap van een soort vervangt wat er van
// deze klant al stond, zodat twee keer verhuizen niet twee keer dezelfde taak
// oplevert.

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  const slug = String(body.slug || "").trim().toLowerCase();
  const code = String(body.code || "").trim();
  if (!slug || !code) return NextResponse.json({ ok: false, error: "Geen klant of geen code." }, { status: 400 });
  if (!(await codeGeldig(code, slug))) {
    return NextResponse.json({ ok: false, error: "Deze verhuiscode is niet (meer) geldig." }, { status: 403 });
  }
  const weg = vensterPoort(slug); if (weg) return weg;

  try {
    if (body.deel === "klant") {
      const kaart = body.kaart as KlantKaart | undefined;
      if (!kaart || typeof kaart !== "object") return NextResponse.json({ ok: false, error: "Geen klantgegevens." }, { status: 400 });
      const stand = await zorgVoorKlant({ ...kaart, slug });
      return NextResponse.json({ ok: true, klant: stand });
    }

    if (body.deel === "tabel") {
      const tabel = String(body.tabel || "").trim();
      const kolommen = Array.isArray(body.kolommen) ? (body.kolommen as string[]).map(String) : [];
      const rijen = Array.isArray(body.rijen) ? (body.rijen as unknown[][]) : [];
      if (!tabel) return NextResponse.json({ ok: false, error: "Geen soort gegevens opgegeven." }, { status: 400 });
      const aantal = await inlaad(slug, tabel, kolommen, rijen, body.vervang === true);
      return NextResponse.json({ ok: true, rijen: aantal });
    }

    return NextResponse.json({ ok: false, error: "Onbekend soort verzoek." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Inlezen mislukte: " + ((e as Error).message || "") }, { status: 500 });
  }
}
