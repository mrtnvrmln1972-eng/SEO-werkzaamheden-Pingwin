import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../../lib/clients";
import { autofillOrgData } from "../../../../../lib/org-data";
import { voorstelConcurrenten } from "../../../../../lib/onboarding-run";
import { getCompetitors, setCompetitors } from "../../../../../lib/competitors";
import { wisSignaalCache, STAP, type StapKey } from "../../../../../lib/onboarding";

export const runtime = "nodejs";
export const maxDuration = 300;

// ═══════════════════════════════════════════════════════════
// EEN ONTBREKENDE VOORWAARDE HIER TER PLEKKE REGELEN
// ═══════════════════════════════════════════════════════════
// De poort blokkeerde de profielscan met de zin "je regelt het op de
// Onboarding-pagina". Dat is een verwijzing, geen oplossing: Maarten stond op
// het goede scherm, wist wat er moest gebeuren, en moest toch ergens anders
// heen. Dezelfde regel als overal: de knop hoort te staan waar hij al is.
//
// Dit endpoint doet één ontbrekende stap, en alleen de stappen die het
// dashboard écht zelf kan. Wat alleen een mens kan (een koppeling leggen, een
// bedrag invullen) wordt hier eerlijk geweigerd met de reden erbij, zodat het
// scherm daar een link van maakt in plaats van een knop die niets doet.

export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  const slug = String(body.slug || "").trim();
  const stap = String(body.stap || "").trim() as StapKey;
  if (!slug || !stap) return NextResponse.json({ ok: false, error: "Geen klant of stap opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const def = STAP.get(stap);
  if (!def) return NextResponse.json({ ok: false, error: "Onbekende stap." }, { status: 400 });
  if (def.door === "jij") {
    return NextResponse.json({
      ok: false,
      handmatig: true,
      tab: def.tab || "",
      error: `${def.label} kan het dashboard niet zelf: ${def.waarom}`,
    }, { status: 400 });
  }

  const client = await getClientBySlug(slug);
  if (!client) return NextResponse.json({ ok: false, error: "Deze klant bestaat niet (meer)." }, { status: 400 });

  try {
    if (stap === "bedrijfsgegevens") {
      const res = await autofillOrgData(slug);
      if (!res.ok) return NextResponse.json({ ok: false, error: res.error || "Het aanvullen is niet gelukt." }, { status: 400 });
      wisSignaalCache();
      const n = res.gevuld || 0;
      return NextResponse.json({
        ok: true,
        melding: n
          ? `${n} ${n === 1 ? "gegeven" : "gegevens"} aangevuld vanaf de website${res.nieuweVestigingen ? `, waaronder ${res.nieuweVestigingen} vestiging(en)` : ""}. Loop ze na bij Klantgegevens; wat we niet konden vinden staat er nog leeg.`
          : "Er viel niets aan te vullen vanaf de website. Vul de ontbrekende gegevens met de hand in bij Klantgegevens.",
      });
    }

    if (stap === "concurrenten") {
      const bestaand = await getCompetitors(slug);
      if (bestaand.length >= 2) return NextResponse.json({ ok: true, melding: "De concurrenten stonden er al." });
      const voorstel = await voorstelConcurrenten(slug, client.domain || "");
      if (!voorstel.length) {
        return NextResponse.json({ ok: false, error: "Er konden geen concurrenten gevonden worden. Vul ze met de hand in bij KPI's, knop Concurrenten." }, { status: 400 });
      }
      const gezet = await setCompetitors(slug, [...bestaand, ...voorstel]);
      wisSignaalCache();
      return NextResponse.json({ ok: true, melding: `Concurrenten ingevuld: ${gezet.join(", ")}. Kloppen ze niet, pas ze aan bij KPI's.` });
    }

    // Een automatische stap die hier nog geen uitvoering heeft. Eerlijk zeggen
    // in plaats van stilletjes niets doen.
    return NextResponse.json({
      ok: false, handmatig: true, tab: def.tab || "",
      error: `${def.label} kan vanaf dit scherm nog niet geregeld worden.`,
    }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Het regelen is misgegaan: ${(e as Error).message}` }, { status: 500 });
  }
}
