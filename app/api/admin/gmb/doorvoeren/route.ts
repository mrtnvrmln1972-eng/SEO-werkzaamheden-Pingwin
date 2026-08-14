import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getOrgData, saveOrgData } from "../../../../../lib/org-data";
import { getGmbStand } from "../../../../../lib/gmb";
import { logActiviteit } from "../../../../../lib/activiteit";

export const runtime = "nodejs";
export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════
// EEN BEVINDING TER PLEKKE DOORVOEREN
// ═══════════════════════════════════════════════════════════
// Niet elke bevinding hoeft een taak te worden. Sommige zijn een handeling van
// twee seconden in ónze eigen administratie, en dan is een kaart op de planning
// alleen maar omweg.
//
// WAAR DE GRENS LIGT, en die is niet willekeurig:
//
// - WEL doorvoeren: wat in de bedrijfsgegevens van het dashboard staat. Dat is
//   onze eigen vastlegging, we weten wat er hoort te staan (we hebben het net
//   gemeten), en het is terug te draaien.
// - NIET doorvoeren: alles op het Google-profiel zelf. Dat is de etalage van de
//   klant en Google schorst profielen bij wijzigingen die het niet vertrouwt.
//   Staande regel: het dashboard schrijft voor, een mens keurt per stuk goed.
// - NIET doorvoeren: een verschil waarbij een mens moet kiezen welke waarde
//   klopt (naam, adres, telefoon). Wij weten wel dát ze verschillen, niet wélke
//   de juiste is. Automatisch de ene over de andere heen schrijven is precies
//   hoe je een goed telefoonnummer kwijtraakt.
//
// Vandaar dat maar twee bevindingen hier landen. Groeit die lijst, dan groeit
// hij met dezelfde toets: weten we zeker wat er moet staan, en is het van ons?

/** Welke bevindingen dit endpoint kan uitvoeren, en wat het dan doet. */
const KAN: Record<string, string> = {
  "geen-mapslink-vastgelegd": "De profiellink wordt bij deze vestiging en bij de vermeldingen in de bedrijfsgegevens gezet.",
  "reviewcijfer-wijkt-af": "Het reviewcijfer in de bedrijfsgegevens wordt bijgewerkt naar wat er nu live staat.",
};

export function GET() {
  return NextResponse.json({ ok: true, kan: Object.keys(KAN), uitleg: KAN });
}

export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  const slug = String(body.slug || "").trim();
  const sleutel = String(body.sleutel || "").trim();
  const key = String(body.key || "").trim();
  if (!slug || !key) return NextResponse.json({ ok: false, error: "Geen klant of punt opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (!KAN[key]) {
    return NextResponse.json({ ok: false, error: "Dit punt kan het dashboard niet zelf doorvoeren; zet het op de planning." }, { status: 400 });
  }

  const stand = await getGmbStand(slug);
  const loc = stand.result?.locaties.find((l) => l.sleutel === sleutel) || stand.result?.locaties[0] || null;
  if (!loc?.profiel) {
    return NextResponse.json({ ok: false, error: "Er is geen gemeten profiel voor deze vestiging. Meet eerst opnieuw." }, { status: 400 });
  }

  const org = await getOrgData(slug);
  if (org.locked) {
    return NextResponse.json({ ok: false, error: "De bedrijfsgegevens zijn vergrendeld. Haal het slot eraf bij Klantgegevens en probeer het opnieuw." }, { status: 400 });
  }

  const data = JSON.parse(JSON.stringify(org.data)) as typeof org.data;
  let melding = "";

  if (key === "geen-mapslink-vastgelegd") {
    const link = loc.profiel.mapsUrl;
    if (!link) return NextResponse.json({ ok: false, error: "Er is geen profiellink gemeten." }, { status: 400 });
    // Bij de vestiging, als we hem op adres of naam kunnen thuisbrengen.
    const kaal = (x: string) => (x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const rij = data.vestigingen.find((v) => kaal(`${v.naam}${v.straat}${v.plaats}`) === sleutel)
      || data.vestigingen.find((v) => v.plaats && kaal(loc.profiel!.adres).includes(kaal(v.plaats)));
    if (rij && !rij.mapsUrl) rij.mapsUrl = link;
    // En bij de vermeldingen, want daar knoopt Google profiel en site aan elkaar.
    if (!data.sameAs.some((u) => u.includes(loc.profiel!.placeId) || u === link)) data.sameAs.push(link);
    melding = rij
      ? `De profiellink staat nu bij vestiging ${rij.naam || rij.plaats || "deze locatie"} en bij de vermeldingen.`
      : "De profiellink staat nu bij de vermeldingen in de bedrijfsgegevens.";
  }

  if (key === "reviewcijfer-wijkt-af") {
    if (loc.profiel.gemiddelde == null) {
      return NextResponse.json({ ok: false, error: "Er is geen reviewcijfer gemeten op dit profiel." }, { status: 400 });
    }
    const oudCijfer = data.reviewGemiddelde || "leeg";
    const oudAantal = data.reviewAantal || "leeg";
    data.reviewGemiddelde = loc.profiel.gemiddelde.toFixed(1);
    data.reviewAantal = String(loc.profiel.aantalReviews);
    if (!data.reviewUrl && loc.profiel.mapsUrl) data.reviewUrl = loc.profiel.mapsUrl;
    melding = `Bijgewerkt van ${oudCijfer} uit ${oudAantal} naar ${data.reviewGemiddelde} uit ${data.reviewAantal}. Genereer de site-brede structured data opnieuw, want daar staat dit cijfer in.`;
  }

  const res = await saveOrgData(slug, data, "admin");
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error || "Opslaan is niet gelukt." }, { status: 400 });

  await logActiviteit({
    slug, soort: "gmb-profiel", bron: "gmb-doorvoeren", bronId: `${sleutel}:${key}:${Date.now()}`,
    intern: `Google-profiel: ${KAN[key]}`,
    klant: `Google-profiel: ${KAN[key]}`,
    zichtbaar: false,
  });

  return NextResponse.json({ ok: true, melding });
}
