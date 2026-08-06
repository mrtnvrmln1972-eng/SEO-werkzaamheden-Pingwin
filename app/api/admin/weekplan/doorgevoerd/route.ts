import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getWeekplan, getWeekplanDev, updateWeekplanToelichting } from "../../../../../lib/weekplan";
import { meetDoorgevoerd, controleRegel, vervangControleRegel, type PuntId } from "../../../../../lib/dev-punten";
import { setPhaseMark } from "../../../../../lib/phase-marks";
import { logActiviteit } from "../../../../../lib/activiteit";

export const runtime = "nodejs";
// Drie metingen op een externe site; met de standaardtijd kapt Vercel dat af.
export const maxDuration = 120;

// ═══════════════════════════════════════════════════════════
// IS DIT DOORGEVOERD?
// ═══════════════════════════════════════════════════════════
// Meet de live pagina op precies de punten die bij het doorzetten zijn
// afgesproken, en laat het antwoord op drie plekken landen:
//
//  1. terug naar het scherm, voor de regel bovenin de kaart;
//  2. één regel in de kaarttekst, die de vorige controle VERVANGT (anders
//     stapelt dit zich op tot precies de muur waar we net vanaf zijn);
//  3. de tijdlijn, met de pagina als bewijs, zodat het ook in de rapportage staat.
//
// Klopt alles, dan gaat het vinkje bij Implementatie om. Klopt het niet, dan
// verandert er geen vinkje: het scherm biedt dan een mail aan de sitebouwer aan.
// Kon er niets gemeten worden, dan verandert er helemaal niets.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const id = Number(body.id || 0);
  if (!slug || !id) return NextResponse.json({ ok: false, error: "Klant en kaart zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const kaart = (await getWeekplan(slug)).find((k) => k.id === id);
  if (!kaart) return NextResponse.json({ ok: false, error: "Kaart niet gevonden." }, { status: 404 });
  if (!kaart.url) return NextResponse.json({ ok: false, error: "Deze kaart hangt niet aan een pagina, dus er valt niets te meten." }, { status: 400 });

  const dev = await getWeekplanDev(slug, id);
  const punten = (dev?.punten?.length ? dev.punten : ["live"]) as PuntId[];
  const meting = await meetDoorgevoerd(slug, kaart.url, punten);

  // Niets kunnen meten is geen oordeel: dan blijft de kaart zoals hij is.
  if (!meting.meetbaar) {
    return NextResponse.json({ ok: true, meting, gewijzigd: false });
  }

  const regel = controleRegel(meting);
  await updateWeekplanToelichting(slug, id, vervangControleRegel(kaart.toelichting || "", regel));

  await logActiviteit({
    slug, soort: "copy-live", bron: "weekplan-doorgevoerd", bronId: `${id}`,
    url: kaart.url, bewijs: kaart.url,
    intern: `Controle: ${meting.samenvatting} (${kaart.url})`,
  }).catch(() => {});

  // Alles in orde: Implementatie afvinken, langs dezelfde weg als het vinkje in
  // de kaart, zodat het bord en de kaart nooit iets anders zeggen. Staat de
  // structured data er ook op, dan gaat die fase mee.
  if (meting.alles) {
    await setPhaseMark(slug, kaart.url, "bouw", true).catch(() => {});
    if (meting.punten.some((p) => p.id === "schema" && p.uitslag === "goed")) {
      await setPhaseMark(slug, kaart.url, "structured", true).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, meting, gewijzigd: true });
}
