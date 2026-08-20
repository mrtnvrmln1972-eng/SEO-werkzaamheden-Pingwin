import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import { hubspotConfigured, hubspotHealthCheck } from "../../../../lib/hubspot";
import {
  getHubspotInstelling, saveHubspotInstelling, hubspotPijplijnKeuze, hubspotVeldKeuze,
  syncHubspot, listHubspotLeads, lijstOnterechteLeads, verwijderOnterechteLeads,
  type Veldkoppeling,
} from "../../../../lib/hubspot-leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// De koppeling zelf: staat de sleutel er, welke pijplijnen tellen als lead, en
// de knop om nu op te halen. Bureau-breed, dus alleen de eigenaar.
export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;

  const gekoppeld = hubspotConfigured();
  const instelling = await getHubspotInstelling();
  if (!gekoppeld) {
    return NextResponse.json({
      ok: true, gekoppeld: false, instelling, pijplijnen: [], velden: [], leads: [],
      melding: "Nog niet gekoppeld: zet de sleutel van je HubSpot private app in Vercel als HUBSPOT_TOKEN.",
    });
  }
  // De pijplijnen zijn alleen nodig als je met deals werkt; mislukt dat (geen
  // dealrecht op de sleutel), dan is dat geen storing maar een lege lijst.
  const [gezond, velden, pijplijnen, leads, opruimen] = await Promise.all([
    hubspotHealthCheck(),
    hubspotVeldKeuze().catch(() => []),
    hubspotPijplijnKeuze().catch(() => []),
    listHubspotLeads().catch(() => []),
    lijstOnterechteLeads().catch(() => []),
  ]);
  return NextResponse.json({
    ok: true, gekoppeld: true, werkt: gezond.ok, melding: gezond.melding,
    instelling, pijplijnen, velden, leads,
    // Leads die een ronde heeft aangemaakt en waar niemand iets aan gedaan heeft.
    opruimen: opruimen.map((l) => l.naam),
  });
}

export async function POST(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as {
    actie?: string; pijplijnen?: string[]; notitiesTerug?: boolean; autoLeads?: boolean; volledig?: boolean;
    bron?: "contacten" | "deals"; filterVeld?: string; filterWaarde?: string;
    velden?: Partial<Veldkoppeling>; kans?: number;
  };

  if (body.actie === "instellingen") {
    const huidig = await getHubspotInstelling();
    await saveHubspotInstelling({
      ...(body.bron !== undefined ? { bron: body.bron } : {}),
      ...(body.filterVeld !== undefined ? { filterVeld: body.filterVeld } : {}),
      ...(body.filterWaarde !== undefined ? { filterWaarde: body.filterWaarde } : {}),
      ...(body.velden !== undefined ? { velden: { ...huidig.velden, ...body.velden } } : {}),
      ...(body.kans !== undefined ? { kans: Number(body.kans) } : {}),
      ...(body.pijplijnen !== undefined ? { pijplijnen: body.pijplijnen } : {}),
      ...(body.notitiesTerug !== undefined ? { notitiesTerug: body.notitiesTerug } : {}),
      ...(body.autoLeads !== undefined ? { autoLeads: body.autoLeads } : {}),
    });
    return NextResponse.json({ ok: true, instelling: await getHubspotInstelling() });
  }

  if (body.actie === "opruimen") {
    const res = await verwijderOnterechteLeads();
    return NextResponse.json({ ok: true, ...res, melding: `${res.verwijderd} lead(s) opgeruimd.` });
  }

  if (body.actie === "sync") {
    const res = await syncHubspot({ volledig: !!body.volledig });
    return NextResponse.json(res);
  }

  return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
}
