import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../../lib/clients";
import { measurePage } from "../../../../../lib/page-measure";

export const runtime = "nodejs";

// Haalt de LIVE meta-titel en -beschrijving van een pagina op, zodat het dashboard
// kan laten zien dat een doorgevoerde wijziging ook echt op de site staat.
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const rawUrl = String(body.url || "").trim();
  if (!slug || !rawUrl) return NextResponse.json({ ok: false, error: "Klant en URL zijn verplicht." }, { status: 400 });

  const client = await getClientBySlug(slug);
  const domain = (client?.domain || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${domain}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;

  const m = await measurePage(url, { staticOnly: true });
  if (!m.ok) return NextResponse.json({ ok: false, error: `Pagina niet leesbaar (status ${m.status ?? "?"}).` });
  return NextResponse.json({ ok: true, url, title: m.metaTitle || "", description: m.metaDescription || "" });
}
