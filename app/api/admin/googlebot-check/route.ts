import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { googlebotCheck } from "../../../../lib/googlebot-check";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// GET: vraag Google zelf wat Googlebot van een handjevol pagina's vindt
// (URL-inspectie). Bewust een GET zonder bijwerkingen, zodat de meekijk-sessie
// (alleen-lezen) hem ook kan draaien.
export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug);
  if (!g.ok) return g.res;
  const urls = (req.nextUrl.searchParams.get("urls") || "").split(",").filter(Boolean);
  if (!urls.length) return NextResponse.json({ ok: false, error: "Geen pagina's opgegeven." }, { status: 400 });
  const uitkomst = await googlebotCheck(slug, urls);
  return NextResponse.json(uitkomst, { status: uitkomst.ok ? 200 : 400 });
}
