import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { getChangeEvent, getChangeEventsForUrl } from "../../../../../lib/content-tracking";
import { getClientBySlug } from "../../../../../lib/clients";
import { getGscDailyForPage, getGscKeywordsBeforeAfter, getGa4PageSignalsBeforeAfter } from "../../../../../lib/google";
import { getAhrefsKeywords } from "../../../../../lib/ahrefs-keywords";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// KPI-impact van één wijziging: GSC-daglijnen (kliks/positie/vertoningen/CTR)
// en keyword-rankings, 60 dagen voor en na het wijzigingsmoment.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const id = Number(req.nextUrl.searchParams.get("id") || "");
  if (!slug || !id) return NextResponse.json({ ok: false, error: "Klant en id verplicht." }, { status: 400 });

  const event = await getChangeEvent(slug, id);
  if (!event) return NextResponse.json({ ok: false, error: "Wijziging niet gevonden." }, { status: 404 });
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  if (!domain) return NextResponse.json({ ok: true, changeDate: event.detectedAt.slice(0, 10), daily: [], keywords: [], note: "Geen domein bij deze klant." });

  const changeDate = event.detectedAt.slice(0, 10);
  const day = 86400000;

  // Alle verandermomenten van deze pagina, geclusterd per <=2 dagen (nieuwste eerst
  // uit de DB; hier oplopend gesorteerd voor het clusteren).
  const siblings = await getChangeEventsForUrl(slug, event.url).catch(() => [event]);
  const asc = [...siblings].sort((a, b) => a.detectedAt.localeCompare(b.detectedAt));
  const TWO = 2 * day;
  const moments: { id: number; date: string }[] = [];
  let group: typeof asc = [];
  const flush = () => { if (group.length) { const rep = group[group.length - 1]; moments.push({ id: rep.id, date: rep.detectedAt.slice(0, 10) }); group = []; } };
  for (const e of asc) {
    if (group.length && new Date(e.detectedAt).getTime() - new Date(group[group.length - 1].detectedAt).getTime() > TWO) flush();
    group.push(e);
  }
  flush();

  // Venster: van 60 dagen vóór het vroegste moment t/m 60 dagen ná het laatste
  // (gemaximeerd op nu-3d en op ~16 maanden terug, de GSC-limiet).
  const times = moments.length ? moments.map((m) => new Date(m.date + "T00:00:00Z").getTime()) : [new Date(changeDate + "T00:00:00Z").getTime()];
  const minC = Math.min(...times), maxC = Math.max(...times);
  const floor = Date.now() - 480 * day;
  const startDate = new Date(Math.max(minC - 60 * day, floor)).toISOString().slice(0, 10);
  const endDate = new Date(Math.min(maxC + 60 * day, Date.now() - 3 * day)).toISOString().slice(0, 10);

  const [daily, keywordsRaw, ga4, ahrefs] = await Promise.all([
    getGscDailyForPage(domain, event.url, startDate, endDate).catch(() => []),
    getGscKeywordsBeforeAfter(domain, event.url, changeDate, 60).catch(() => []),
    getGa4PageSignalsBeforeAfter(slug, event.url, changeDate, 60).catch(() => null),
    getAhrefsKeywords(slug).catch(() => []),
  ]);

  // Zoekvolume uit de opgeslagen Ahrefs-pool bij de zoekwoorden zetten (geen credits).
  const volMap = new Map<string, number | null>();
  for (const a of ahrefs) volMap.set(a.keyword.toLowerCase(), a.volume);
  const keywords = keywordsRaw.map((k) => ({ ...k, volume: volMap.has(k.keyword.toLowerCase()) ? volMap.get(k.keyword.toLowerCase()) ?? null : null }));

  return NextResponse.json({ ok: true, changeDate, daily, keywords, ga4, moments });
}
