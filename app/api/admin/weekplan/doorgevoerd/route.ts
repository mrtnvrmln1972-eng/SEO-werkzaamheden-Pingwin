import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getWeekplan, getWeekplanDev, updateWeekplanToelichting } from "../../../../../lib/weekplan";
import { meetDoorgevoerd, controleRegel, vervangControleRegel, voorstelPunten, type PuntId } from "../../../../../lib/dev-punten";
import { setPhaseMark } from "../../../../../lib/phase-marks";
import { logActiviteit } from "../../../../../lib/activiteit";
import { persistCopyLive } from "../../../../../lib/copy-live";

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
  const afgesproken = (dev?.punten?.length ? dev.punten : ["live"]) as PuntId[];
  // Is er inmiddels een copydocument, dan hoort "staan de koppen erop" er altijd
  // bij, ook als dat niet expliciet is afgesproken toen de kaart naar de
  // developer ging (dat kan vóór de copy geschreven was zijn geweest). Zonder dit
  // controleert deze knop alleen of de pagina laadt, en blijft de vraag "staat de
  // copy er ook echt op" onbeantwoord terwijl er wel een document ligt.
  const voorstel = await voorstelPunten(slug, kaart.url).catch(() => ["live"] as PuntId[]);
  const punten = Array.from(new Set([...afgesproken, ...voorstel])) as PuntId[];
  const meting = await meetDoorgevoerd(slug, kaart.url, punten);

  // Niets kunnen meten is geen oordeel: dan blijft de kaart zoals hij is.
  if (!meting.meetbaar) {
    return NextResponse.json({ ok: true, meting, gewijzigd: false });
  }

  // De koppen-meting (indien gedaan) door naar de gedeelde stand (page_copy_live):
  // anders weet de rest van het dashboard (fase "Bouw en publicatie", het
  // bordoverzicht, de paginasignalen) niets van wat deze knop net vaststelde, en
  // blijft de copy daar "nog niet doorgevoerd" heten terwijl dit scherm al "goed"
  // toont.
  if (meting.copyLive) {
    await persistCopyLive(slug, meting.copyLive).catch(() => {});
  }

  const regel = controleRegel(meting);
  await updateWeekplanToelichting(slug, id, vervangControleRegel(kaart.toelichting || "", regel));

  // De losse bewijsregels erbij, niet alleen de samenvatting: anders heeft de
  // AI die hier later een verhaaltje van maakt niets concreets om te noemen en
  // valt hij terug op vage taal als "een controlepunt afgevinkt".
  const puntDetails = meting.punten.map((p) => `${p.label.toLowerCase()}: ${p.bewijs}`).join("; ");
  await logActiviteit({
    slug, soort: "copy-live", bron: "weekplan-doorgevoerd", bronId: `${id}`,
    url: kaart.url, bewijs: kaart.url,
    intern: `Controle: ${meting.samenvatting}. ${puntDetails}. (${kaart.url})`,
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
