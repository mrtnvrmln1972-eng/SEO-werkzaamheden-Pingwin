import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getPageDocOutputs } from "../../../../lib/site-urls";
import { connectorFor } from "../../../../lib/site-connector";
import { logActiviteit } from "../../../../lib/activiteit";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST {slug, url} : zet de geldende ("goedgekeurde") copy van deze pagina als
// CONCEPT in de site van de klant (R6). Verandert nooit de bestaande, live
// pagina; publiceren blijft een mensenklik in WordPress zelf.
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({})) as { slug?: string; url?: string };
  const slug = (body.slug || "").trim(), url = (body.url || "").trim();
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en pagina verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const outputs = await getPageDocOutputs(slug, url);
  const copy = outputs.copy || "";
  if (!copy.trim()) return NextResponse.json({ ok: false, error: "Er is nog geen goedgekeurde copy voor deze pagina." }, { status: 400 });

  try {
    const result = await connectorFor(slug).pushCopyDraft(slug, url, copy);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.detail, previewUrl: result.previewUrl || null }, { status: 422 });
    await logActiviteit({
      slug, soort: "copy-concept", bron: "copy-concept", bronId: `${url}|${Date.now()}`,
      url, intern: "Copy als concept in de site gezet", wie: "Pingwin",
    });
    return NextResponse.json({ ok: true, detail: result.detail, previewUrl: result.previewUrl || null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
