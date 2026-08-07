import { NextRequest, NextResponse } from "next/server";
import { getOrgData, getSlugByOrgDevToken } from "../../../../lib/org-data";
import { getClientBySlug } from "../../../../lib/clients";
import { buildSitewideJsonLd, detectSitewideAnchor } from "../../../../lib/page-schema";

export const runtime = "nodejs";

// Publieke (token-beveiligde), alleen-lezen API voor de sitebouwer/developer:
// toont de bedrijfsgegevens plus de kant-en-klare site-brede JSON-LD. Geen
// POST: deze link kan nooit iets wijzigen, in tegenstelling tot de klantlink
// (/api/share/org) die dezelfde gegevens wél bewerkbaar maakt.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const slug = await getSlugByOrgDevToken(token);
  if (!slug) return NextResponse.json({ ok: false, error: "Deze link is niet (meer) geldig." }, { status: 404 });
  const [rec, client] = await Promise.all([getOrgData(slug), getClientBySlug(slug)]);
  const domain = (client?.domain || "").trim();
  const site = domain ? (domain.match(/^https?:\/\//i) ? domain : `https://${domain}`).replace(/\/+$/, "") : "";
  let sitewideJsonld = "", plugin = "", gekoppeld = false;
  if (site && rec.data.bedrijfsnaam) {
    const detectie = await detectSitewideAnchor(site).catch(() => ({ pluginLabel: "", gekoppeld: false, anchor: null as { id: string; type: string } | null }));
    sitewideJsonld = buildSitewideJsonLd(rec.data, site, detectie.anchor);
    plugin = detectie.gekoppeld ? detectie.pluginLabel : "";
    gekoppeld = !!detectie.anchor;
  }
  return NextResponse.json({
    ok: true,
    data: rec.data,
    locked: rec.locked,
    clientName: client?.name || "",
    sitewideJsonld,
    plugin,
    gekoppeld,
    updatedAt: rec.updatedAt,
  });
}
