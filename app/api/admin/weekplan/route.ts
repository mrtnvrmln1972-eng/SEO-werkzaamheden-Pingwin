import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getWeekplan, updateWeekplanTask, deleteWeekplanTask, isoWeek, setWeekplanNaarDev, setWeekplanKaart } from "../../../../lib/weekplan";
import { getWeekplanPages } from "../../../../lib/overview";
import { splitsBestaandeKaarten } from "../../../../lib/weekplan-splitsen";
import { urlKey } from "../../../../lib/url-key";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET: alle weekplanning-taken van een klant + de huidige ISO-week (om te markeren).
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  // De pijplijn-stand per pagina reist mee, zodat elke projectkaart in het bord
  // live de fases en de volgende stap toont. Taken en paginastand laden PARALLEL
  // (sneller bord); daarna filteren op de pagina's die echt in het bord staan.
  // Eerst de opruimstap: kaarten die over meerdere pagina's gaan alsnog per
  // pagina zetten. Dit geldt met terugwerkende kracht, want de splitser draaide
  // tot nu toe alleen bij het aanmaken en de kaarten die er al stonden bleven
  // dubbel. Doet niets als er niets te splitsen valt.
  await splitsBestaandeKaarten(slug).catch(() => ({ gesplitst: 0, toegevoegd: 0 }));

  const [tasks, allePages] = await Promise.all([
    getWeekplan(slug),
    getWeekplanPages(slug).catch(() => ({} as Awaited<ReturnType<typeof getWeekplanPages>>)),
  ]);
  const keys = new Set(tasks.filter((t) => t.url).map((t) => urlKey(t.url || "")));
  const pages = Object.fromEntries(Object.entries(allePages).filter(([k]) => keys.has(k)));
  const now = new Date();
  return NextResponse.json({ ok: true, tasks, current: isoWeek(now), pages });
}

// POST: één taak bijwerken (week/status/volgorde) of verwijderen.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const id = Number(body.id);
  if (!slug || !id) return NextResponse.json({ ok: false, error: "Klant en taak-id zijn verplicht." }, { status: 400 });

  if (body.delete === true) { await deleteWeekplanTask(slug, id); return NextResponse.json({ ok: true }); }

  // Naar de developerpagina doorzetten. Bewust hier en niet via een aparte route:
  // het is gewoon een eigenschap van de kaart, net als de week of de status.
  if (typeof body.naarDev === "boolean") {
    await setWeekplanNaarDev(slug, id, body.naarDev);
    return NextResponse.json({ ok: true });
  }

  // Titel bijstellen. De kaarttitel is wat je in het bord leest en wat als
  // opdracht doorgaat; die moet je kunnen herschrijven zonder de kaart opnieuw
  // te maken.
  if (typeof body.taak === "string") {
    const nieuw = body.taak.trim();
    if (!nieuw) return NextResponse.json({ ok: false, error: "Een kaart moet een titel houden." }, { status: 400 });
    await setWeekplanKaart(slug, id, { taak: nieuw });
    return NextResponse.json({ ok: true });
  }

  const patch: { weekYear?: number; weekNo?: number; status?: string; sortOrder?: number } = {};
  if (typeof body.weekYear === "number") patch.weekYear = body.weekYear;
  if (typeof body.weekNo === "number") patch.weekNo = body.weekNo;
  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;
  await updateWeekplanTask(slug, id, patch);
  return NextResponse.json({ ok: true });
}
