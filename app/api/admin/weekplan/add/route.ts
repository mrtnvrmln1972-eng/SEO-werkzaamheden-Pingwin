import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { addWeekplanTasks, isoWeek } from "../../../../../lib/weekplan";
import { tidyCards } from "../../../../../lib/weekplan-tidy";
import { getStepLinks } from "../../../../../lib/page-doc-run";
import { getClientUrls, addManualPage } from "../../../../../lib/site-urls";
import { splitsPerPagina, nieuwPaginaPad } from "../../../../../lib/overview-actions";

export const runtime = "nodejs";
// Bij samenvoegen in een bestaande kaart draait er een opruimstap van de assistent;
// zonder ruimere tijd kapt Vercel dat af halverwege.
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Voegt ÉÉN taak (uit een bird's eye-voorstel) toe aan de weekplanning. De week is
// relatief meegegeven (1 = deze week, 2 = volgende week, enzovoort); we rekenen die
// hier om naar het echte ISO-weeknummer.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const taak = String(body.taak || "").trim();
  if (!slug || !taak) return NextResponse.json({ ok: false, error: "Klant en taak zijn verplicht." }, { status: 400 });

  const seq = Math.max(1, Number(body.week) || 1);
  const d = new Date();
  d.setDate(d.getDate() + (seq - 1) * 7);
  const week = isoWeek(d);

  const url = body.url ? String(body.url) : undefined;

  // Eén kaart per pagina, ook langs deze weg. Deze route liep om de splitser
  // heen: een taak als "Controleer of de CRP-pagina's live staan" ging hier
  // ongesplitst het bord in, terwijl hij via de andere wegen wél netjes per
  // pagina werd verdeeld. Dat is precies de knop die in de praktijk gebruikt
  // wordt, dus daar viel het gat.
  let bekendeUrls: string[] = [];
  try { bekendeUrls = (await getClientUrls(slug)).map((u) => u.url); } catch { bekendeUrls = []; }
  const gesplitst = splitsPerPagina([{
    taak,
    toelichting: body.toelichting ? String(body.toelichting) : undefined,
    url,
  }], bekendeUrls).slice(0, 10);

  // Gaat de taak over een pagina die nog niet bestaat, zet die dan meteen als
  // geplande pagina in de paginalijst. Anders kent het bord de pagina niet en
  // blijft het fase-blok op de kaart leeg, juist waar je alle zeven fases nodig
  // hebt.
  for (const t of gesplitst) {
    if (t.url && nieuwPaginaPad(t.taak || "", bekendeUrls)) {
      await addManualPage(slug, t.url, (t.taak || "").slice(0, 200)).catch(() => null);
    }
  }

  const rijen = await Promise.all(gesplitst.map(async (t) => ({
    taak: t.taak,
    toelichting: t.toelichting,
    wie: body.wie ? String(body.wie) : undefined,
    url: t.url,
    taaktype: body.taaktype ? String(body.taaktype) : undefined,
    bronMail: body.bronMail ? String(body.bronMail) : undefined,
    // Copy-link server-side afleiden zodat de bord-kaart direct naar de
    // aangeleverde copy linkt.
    copyUrl: t.url ? await getStepLinks(slug, t.url).then((s) => s.copy).catch(() => "") : "",
    week,
  })));

  const r = await addWeekplanTasks(slug, String(body.thread || ""), rijen);
  // Is er in een bestaande kaart samengevoegd, ruim die dan meteen op. Anders
  // groeit dezelfde constatering in steeds andere woorden aan tot een muur.
  if (r.mergedIds.length) await tidyCards(slug, r.mergedIds).catch(() => 0);
  const n = r.added + r.merged;
  // De id's gaan mee terug, zodat de planning er meteen een dag aan kan hangen
  // als je de taak vanuit "Vandaag" of "Morgen" hebt toegevoegd.
  return n
    ? NextResponse.json({ ok: true, added: n, week, ids: [...r.nieuweIds, ...r.mergedIds] })
    : NextResponse.json({ ok: false, error: "Toevoegen mislukt." }, { status: 500 });
}
