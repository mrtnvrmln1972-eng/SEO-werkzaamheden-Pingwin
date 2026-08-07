import { NextRequest, NextResponse } from "next/server";
import { getOrgData, getSlugByOrgDevToken } from "../../../../lib/org-data";
import { getClientBySlug } from "../../../../lib/clients";
import { buildSitewideJsonLd } from "../../../../lib/page-schema";

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
  const sitewideJsonld = site && rec.data.bedrijfsnaam ? buildSitewideJsonLd(rec.data, site) : "";
  return NextResponse.json({
    ok: true,
    data: rec.data,
    locked: rec.locked,
    clientName: client?.name || "",
    sitewideJsonld,
    updatedAt: rec.updatedAt,
  });
}
