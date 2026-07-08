import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getWpConnForClient, findWpEditUrl, getCanniRowStatuses, setCanniRowStatus } from "../../../../lib/wp";
import { getPageCannibal } from "../../../../lib/page-cannibal";
import { extractClusterAdvice } from "../../../../lib/page-chat-ground";
import { savePageClusterAdvice, deletePageClusterAdvice } from "../../../../lib/site-urls";

export const runtime = "nodejs";
export const maxDuration = 60;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET: statussen (uitgevoerd/afgewezen/doorgezet) per rij van de cannibalisatie-tabel.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Geen klant of pagina opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  try {
    return NextResponse.json({ ok: true, statuses: await getCanniRowStatuses(slug, url) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Ophalen mislukt." }, { status: 500 });
  }
}

// De volledige URL van een rij-pad, op het domein van de geanalyseerde pagina.
function rowFullUrl(pageUrl: string, rowPath: string): string {
  try { return new URL(pageUrl).origin + rowPath; } catch { return rowPath; }
}

// POST: status van een rij zetten/wissen, de wp-admin bewerk-URL opzoeken
// (action=editlink), of het rij-advies doorzetten naar die pagina (action=topage).
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const pageUrl = String(body.pageUrl || "").trim();
  const rowPath = String(body.rowPath || "").trim();
  if (!slug || !pageUrl || !rowPath) return NextResponse.json({ ok: false, error: "Rij onvolledig." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  try {
    if (body.action === "editlink") {
      const conn = await getWpConnForClient(slug);
      if (!conn) return NextResponse.json({ ok: false, error: "Er is nog geen WordPress-koppeling voor deze klant." }, { status: 400 });
      const editUrl = await findWpEditUrl(conn, rowPath);
      if (!editUrl) return NextResponse.json({ ok: false, error: `De pagina ${rowPath} is niet gevonden in WordPress.` }, { status: 404 });
      return NextResponse.json({ ok: true, editUrl });
    }

    if (body.action === "topage") {
      // Advies voor déze ene rij uit de analyse halen en als vertrekpunt bij die
      // pagina klaarzetten (zichtbaar als "half plan" in het Pagina's-tabblad).
      const cur = await getPageCannibal(slug, pageUrl);
      const analysis = (cur.result || "").trim();
      if (!analysis) return NextResponse.json({ ok: false, error: "Er is geen cannibalisatie-analyse meer voor deze pagina." }, { status: 400 });
      const target = rowFullUrl(pageUrl, rowPath);
      const items = await extractClusterAdvice(analysis, pageUrl, [target]);
      const advice = items.find((it) => it.url === target)?.advice || items[0]?.advice || "";
      if (!advice) return NextResponse.json({ ok: false, error: "De analyse bevat geen concreet advies voor deze pagina." }, { status: 400 });
      await savePageClusterAdvice(slug, target, advice, pageUrl, analysis);
      await setCanniRowStatus(slug, pageUrl, rowPath, "doorgezet");
      return NextResponse.json({ ok: true });
    }

    const raw = body.status;
    const status = raw === "uitgevoerd" || raw === "afgewezen" || raw === "doorgezet" ? raw : null;
    // Herstel van een doorgezette rij haalt het klaargezette advies ook weer weg.
    if (!status) {
      const prev = (await getCanniRowStatuses(slug, pageUrl))[rowPath];
      if (prev === "doorgezet") await deletePageClusterAdvice(slug, rowFullUrl(pageUrl, rowPath), pageUrl).catch(() => { /* advies-opruimen is best effort */ });
    }
    await setCanniRowStatus(slug, pageUrl, rowPath, status);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Opslaan mislukt." }, { status: 500 });
  }
}
