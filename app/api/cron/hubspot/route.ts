import { NextRequest, NextResponse } from "next/server";
import { syncHubspot, getHubspotInstelling } from "../../../../lib/hubspot-leads";
import { hubspotConfigured } from "../../../../lib/hubspot";
import { sql } from "../../../../lib/db";

export const runtime = "nodejs";
export const maxDuration = 300;
// Nooit bij de build draaien: alleen op aanvraag (cron of de knop op /admin/beheer).
export const dynamic = "force-dynamic";

// Elk kwartier kijken of er iets veranderd is in HubSpot. Er wordt alleen
// opgehaald wat sinds de vorige ronde gewijzigd is, dus dit zijn in de praktijk
// een paar verzoeken. Is HubSpot niet gekoppeld, dan doet deze ronde niets en
// meldt dat ook zo; stil niets doen is precies hoe je maanden later ontdekt dat
// er nooit iets binnenkwam.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  if (!hubspotConfigured()) {
    return NextResponse.json({ ok: true, overgeslagen: true, melding: "HubSpot is niet gekoppeld (HUBSPOT_TOKEN ontbreekt)." });
  }
  try {
    const res = await syncHubspot();
    // De instelling gaat mee terug: zo is van buiten te zien waarop deze ronde
    // gezocht heeft, in plaats van alleen dat hij niets vond.
    // Tijdelijke meetpunt (20-08-2026): wat staat er écht in de instellingen-tabel
    // op het moment dat deze ronde draait? Het scherm liet een gevuld filter zien
    // terwijl deze ronde een leeg filter las, en gissen kost meer tijd dan meten.
    const rauw = await sql`SELECT key, value FROM app_settings WHERE key LIKE 'hubspot%' ORDER BY key`;
    return NextResponse.json({ ...res, instelling: await getHubspotInstelling(), rauw: rauw.rows });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
