import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { ahrefsConfigured, getAiResponsesCount } from "../../../../lib/ahrefs";

export const runtime = "nodejs";

// AI-vindbaarheid per platform (Ahrefs): hoe vaak wordt het domein aangehaald in
// AI-antwoorden (ChatGPT, Perplexity, Gemini, Copilot, Grok, Google AI). 1 dag
// gecachet, dus het KPI-tabblad kan dit vrij openen zonder credits te verbranden.
export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (!ahrefsConfigured()) return NextResponse.json({ ok: true, platforms: [], note: "Ahrefs is niet gekoppeld." });
  const client = await getClientBySlug(slug);
  if (!client?.domain) return NextResponse.json({ ok: true, platforms: [], note: "Geen domein bij deze klant." });
  try {
    const platforms = await getAiResponsesCount(client.domain);
    return NextResponse.json({ ok: true, platforms });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "Ophalen mislukt." }, { status: 500 });
  }
}
