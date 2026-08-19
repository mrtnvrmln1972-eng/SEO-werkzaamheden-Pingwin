import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import { hubspotConfigured, hubspotHealthCheck } from "../../../../lib/hubspot";
import {
  getHubspotInstelling, saveHubspotInstelling, hubspotPijplijnKeuze, syncHubspot, listHubspotLeads,
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
      ok: true, gekoppeld: false, instelling, pijplijnen: [], leads: [],
      melding: "Nog niet gekoppeld: zet de sleutel van je HubSpot private app in Vercel als HUBSPOT_TOKEN.",
    });
  }
  const [gezond, pijplijnen, leads] = await Promise.all([
    hubspotHealthCheck(),
    hubspotPijplijnKeuze().catch(() => []),
    listHubspotLeads().catch(() => []),
  ]);
  return NextResponse.json({
    ok: true, gekoppeld: true, werkt: gezond.ok, melding: gezond.melding,
    instelling, pijplijnen, leads,
  });
}

export async function POST(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as {
    actie?: string; pijplijnen?: string[]; notitiesTerug?: boolean; autoLeads?: boolean; volledig?: boolean;
  };

  if (body.actie === "instellingen") {
    await saveHubspotInstelling({
      ...(body.pijplijnen !== undefined ? { pijplijnen: body.pijplijnen } : {}),
      ...(body.notitiesTerug !== undefined ? { notitiesTerug: body.notitiesTerug } : {}),
      ...(body.autoLeads !== undefined ? { autoLeads: body.autoLeads } : {}),
    });
    return NextResponse.json({ ok: true, instelling: await getHubspotInstelling() });
  }

  if (body.actie === "sync") {
    const res = await syncHubspot({ volledig: !!body.volledig });
    return NextResponse.json(res);
  }

  return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
}
