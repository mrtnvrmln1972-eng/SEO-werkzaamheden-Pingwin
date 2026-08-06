import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getWeekplan, updateWeekplanTask, deleteWeekplanTask, isoWeek, setWeekplanNaarDev, setWeekplanKaart } from "../../../../lib/weekplan";
import { getWeekplanPages } from "../../../../lib/overview";
import { splitsBestaandeKaarten } from "../../../../lib/weekplan-splitsen";
import { verkortTitels } from "../../../../lib/weekplan-titel";
import { urlKey } from "../../../../lib/url-key";
import { registreerFases } from "../../../../lib/fase-historie";

export const runtime = "nodejs";

// Staat het automatisch inkorten van volgelopen kaarttitels aan? Zie de uitleg
// in de GET hieronder.
const TITELS_AUTOMATISCH = false;

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
  // En daarna de titels die door de oude " + "-plakker zijn volgelopen één keer
  // inkorten. Doet niets zodra ze in de vaste vorm staan, dus dit is na de
  // eerste keer gratis. De oude titel gaat naar het archief van de kaart.
  //
  // Staat bewust nog UIT: deze stap raakt alle klanten tegelijk, dus hij draait
  // eerst in de proefstand (?titels=proef hieronder, die verandert niets) zodat
  // er met eigen ogen te zien is wát hij zou wijzigen.
  if (TITELS_AUTOMATISCH) await verkortTitels(slug).catch(() => []);

  // De proefstand. Alleen kijken, nooit wijzigen, dus ook veilig voor een
  // meekijk-sessie die niets mag veranderen.
  if (req.nextUrl.searchParams.get("titels") === "proef") {
    const zouden = await verkortTitels(slug, { droog: true }).catch(() => []);
    return NextResponse.json({ ok: true, proef: true, zouden });
  }

  const [tasks, allePages] = await Promise.all([
    getWeekplan(slug),
    getWeekplanPages(slug).catch(() => ({} as Awaited<ReturnType<typeof getWeekplanPages>>)),
  ]);
  const keys = new Set(tasks.filter((t) => t.url).map((t) => urlKey(t.url || "")));
  const pages = Object.fromEntries(Object.entries(allePages).filter(([k]) => keys.has(k)));
  const now = new Date();
  // Sinds wanneer staat elke fase zo? Wordt hier bijgehouden omdat de standen
  // grotendeels afgeleid zijn (copy live, schema aanwezig): er is geen moment
  // waarop iemand "klaar" aanklikt. Elke uitlezing vergelijkt met de vorige.
  const sinds = await registreerFases(slug, pages);
  return NextResponse.json({ ok: true, tasks, current: isoWeek(now), pages, sinds });
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
  // te maken. Wat je hier zelf typt is vanaf nu de titel: de automaat die te
  // lange titels inkort laat een handgeschreven titel met rust.
  if (typeof body.taak === "string") {
    const nieuw = body.taak.trim();
    if (!nieuw) return NextResponse.json({ ok: false, error: "Een kaart moet een titel houden." }, { status: 400 });
    await setWeekplanKaart(slug, id, { taak: nieuw, handmatig: true });
    return NextResponse.json({ ok: true });
  }

  const patch: { weekYear?: number; weekNo?: number; status?: string; sortOrder?: number; datum?: string | null } = {};
  if (typeof body.weekYear === "number") patch.weekYear = body.weekYear;
  if (typeof body.weekNo === "number") patch.weekNo = body.weekNo;
  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;
  // De gekozen dag. Een lege string wist hem weer; alles anders moet een echte
  // datum zijn, anders laat de database de hele update klappen.
  if (typeof body.datum === "string") {
    const d = body.datum.trim();
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return NextResponse.json({ ok: false, error: "Datum moet als jjjj-mm-dd." }, { status: 400 });
    }
    patch.datum = d || null;
  }
  await updateWeekplanTask(slug, id, patch);
  return NextResponse.json({ ok: true });
}
