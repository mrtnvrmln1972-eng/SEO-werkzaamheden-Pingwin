import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientUrls, getPagePlan, savePageClusterAdvice } from "../../../../lib/site-urls";
import { extractClusterAdvice } from "../../../../lib/page-chat-ground";
import { anthropicConfigured } from "../../../../lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Start "Gelieerde pagina's" vanaf de projectkaart: gebruikt de vastgelegde
// strategie van de pagina als analyse, haalt daar concreet advies voor andere
// cluster-pagina's uit en zet dat advies direct op die pagina's (het "half plan").
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const url = String(body.url || "").trim();
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en URL zijn verplicht." }, { status: 400 });

  const plan = (await getPagePlan(slug, url).catch(() => "")) || "";
  if (!plan.trim()) return NextResponse.json({ ok: false, error: "Leg eerst de strategie voor deze pagina vast; die is de bron voor het advies aan gelieerde pagina's." }, { status: 400 });

  try {
    const urls = await getClientUrls(slug);
    const { items } = await extractClusterAdvice(plan, url, urls.map((u) => u.url));
    let saved = 0;
    for (const it of items) {
      const u = String(it?.url || "").trim();
      const advice = String(it?.advice || "").trim();
      if (u && advice) { await savePageClusterAdvice(slug, u, advice, url, plan.slice(0, 16000)); saved++; }
    }
    if (!saved) return NextResponse.json({ ok: true, saved: 0, message: "Geen concreet advies voor gelieerde pagina's gevonden in de strategie." });
    return NextResponse.json({ ok: true, saved });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
