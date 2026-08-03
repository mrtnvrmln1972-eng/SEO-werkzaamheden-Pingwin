import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { anthropicConfigured, callClaude } from "../../../../lib/anthropic";
import { gesprekDocSpec } from "../../../../lib/page-doc";
import { buildPingwinDoc, laatsteOmslagGelukt } from "../../../../lib/pingwin-docx";
import { upsertStepTask } from "../../../../lib/tasks";
import { ensureClientFolder } from "../../../../lib/drive-map";
import { uploadDocx } from "../../../../lib/drive";
import { getClientBySlug } from "../../../../lib/clients";
import { CLIENT_FOLDER_KEY } from "../../../../lib/constants";

export const runtime = "nodejs";
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}
function safeName(s: string): string {
  return (s || "document").replace(/[^\p{L}\p{N} _-]+/gu, "").replace(/\s+/g, "-").slice(0, 60) || "document";
}

// Van een bird's eye-antwoord één deelbaar document maken.
//
// De documentmotor, de huisstijl en het uploaden naar Drive draaien al voor
// analyses en blauwdrukken, maar altijd op ÉÉN pagina. Een analyse over de hele
// site (cannibalisatie, link equity, locatiepagina's) paste daar niet in en bleef
// daardoor in de chat hangen. Deze route werkt op het gesprek, en zet het
// document in de klantmap in Drive.
export async function POST(req: NextRequest) {
  try {
    if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
    if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

    const slug = String(body.slug || "").trim();
    const g = await guardSlug(req, slug); if (!g.ok) return g.res;
    const gesprek = String(body.tekst || body.analysis || "").trim();
    const titelHint = String(body.titel || "").trim().slice(0, 200);
    const extra = String(body.extra || "").trim().slice(0, 1500);
    if (!slug || !gesprek) return NextResponse.json({ ok: false, error: "Klant en tekst zijn verplicht." }, { status: 400 });

    let spec, title;
    try { ({ spec, title } = await gesprekDocSpec(slug, gesprek, titelHint || undefined, extra || undefined)); }
    catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Kon de analyse niet samenvatten." }, { status: 500 }); }

    let buffer: Buffer;
    try { buffer = await buildPingwinDoc(spec); }
    catch (e) { return NextResponse.json({ ok: false, error: `Kon het document niet opmaken: ${e instanceof Error ? e.message : "onbekende fout"}` }, { status: 500 }); }

    // Korte klantvriendelijke uitleg voor het ?-veld in het klantdashboard.
    let klantUitleg = "We hebben jullie site als geheel bekeken en vastgelegd wat er nodig is om beter gevonden te worden.";
    try {
      const s = await callClaude(
        "Geef in 1 tot 2 korte zinnen, in gewone taal voor een klant (geen jargon, geen emoji), wat we hebben geanalyseerd en waarom dat belangrijk is. Geef ALLEEN die zinnen terug.",
        [{ role: "user", content: gesprek.slice(0, 8000) }], 200,
      );
      if (s.trim()) klantUitleg = s.trim();
    } catch { /* standaardzin */ }

    const folderId = await ensureClientFolder(slug).catch(() => null);
    const filename = `${safeName(spec.klant)}-advies-${safeName(title)}.docx`;
    let link = "", driveFout = "";
    if (folderId) {
      try { ({ link } = await uploadDocx(folderId, filename, buffer)); }
      catch (e) { driveFout = e instanceof Error ? e.message : "upload mislukt"; }
    } else {
      driveFout = "Drive is niet gekoppeld, dus het document kon niet worden opgeslagen.";
    }

    // Als werkzaamheid vastleggen, met de link erbij, net als de andere opleveringen.
    // Het gesprek hangt niet aan één pagina; daarom de pseudo-URL van de klantmap,
    // en een stap-soort per onderwerp zodat twee analyses elkaar niet overschrijven.
    const client = await getClientBySlug(slug).catch(() => null);
    let taskId: number | null = null;
    if (body.alsWerkzaamheid !== false) {
      taskId = await upsertStepTask(slug, {
        pageUrl: CLIENT_FOLDER_KEY,
        stepKind: `gesprek_advies:${safeName(title).toLowerCase()}`,
        title: `Advies: ${title}`,
        link: link || undefined,
        clientLink: link || undefined,
        klantToelichting: klantUitleg,
        wie: "SEO",
        fase: "Bouwen",
        klantZichtbaar: true,
      }).catch(() => null);
    }

    return NextResponse.json({
      ok: true, link, filename, title, taskId, driveFout,
      klant: client?.name || slug,
      omslag: laatsteOmslagGelukt(),
      omslagMelding: laatsteOmslagGelukt() ? "" : "De omslag kon niet getekend worden; het document heeft nu een sobere tekst-omslag.",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Onverwachte serverfout: ${e instanceof Error ? e.message : "onbekend"}` }, { status: 500 });
  }
}
