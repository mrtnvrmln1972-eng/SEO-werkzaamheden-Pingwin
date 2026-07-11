import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getClientUrls, getPageClusterAdvice, getOutgoingClusterAdvice } from "../../../../../lib/site-urls";
import { extractClusterAdvice } from "../../../../../lib/page-chat-ground";
import { anthropicConfigured } from "../../../../../lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Zoekt in een analyse naar ANDERE cluster-pagina's waarover concreet advies staat,
// zodat je dat advies aan die pagina's kunt meegeven ("half plan").
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const url = String(body.url || "").trim();
  const analysis = String(body.analysis || "").trim();
  if (!slug || !url || !analysis) return NextResponse.json({ ok: false, error: "Klant, URL en analyse zijn verplicht." }, { status: 400 });

  try {
    const urls = await getClientUrls(slug);
    const { items, notFound } = await extractClusterAdvice(analysis, url, urls.map((u) => u.url));
    return NextResponse.json({ ok: true, items, notFound });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}

// GET: het cluster-advies dat AAN deze pagina is meegegeven (voor de "vertrekpunt"-kaart),
// of met direction=out: wat er VANUIT deze pagina aan andere pagina's is doorgegeven
// (voor het overzichtje met vinkjes in de "Doorgeven"-kaart).
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en URL zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (req.nextUrl.searchParams.get("direction") === "out") {
    const outgoing = await getOutgoingClusterAdvice(slug, url);
    return NextResponse.json({ ok: true, outgoing });
  }
  const incoming = await getPageClusterAdvice(slug, url);
  return NextResponse.json({ ok: true, incoming });
}
