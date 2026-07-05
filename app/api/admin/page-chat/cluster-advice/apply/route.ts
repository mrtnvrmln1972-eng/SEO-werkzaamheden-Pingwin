import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../../lib/admin-scope";
import { savePageClusterAdvice } from "../../../../../../lib/site-urls";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Slaat het gekozen cluster-advies op bij de betrokken pagina's (het vertrekpunt/
// "half plan" voor die pagina's). Bron is de pagina waar de analyse op draaide.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const sourceUrl = String(body.sourceUrl || "").trim();
  const sourceAnalysis = String(body.sourceAnalysis || "").trim().slice(0, 16000);
  const items = Array.isArray(body.items) ? (body.items as { url?: string; advice?: string }[]) : [];
  if (!slug) return NextResponse.json({ ok: false, error: "Klant is verplicht." }, { status: 400 });

  let saved = 0;
  for (const it of items) {
    const u = String(it?.url || "").trim();
    const advice = String(it?.advice || "").trim();
    if (u && advice) { await savePageClusterAdvice(slug, u, advice, sourceUrl, sourceAnalysis); saved++; }
  }
  return NextResponse.json({ ok: true, saved });
}
