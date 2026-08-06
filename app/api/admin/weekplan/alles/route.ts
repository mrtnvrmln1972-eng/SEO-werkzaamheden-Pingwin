import { NextRequest, NextResponse } from "next/server";
import { getAdminScope } from "../../../../../lib/admin-scope";
import { getWeekplanAlleKlanten, isoWeek } from "../../../../../lib/weekplan";
import { getWeekplanPages } from "../../../../../lib/overview";
import { urlKey } from "../../../../../lib/url-key";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════
// HET OVERZICHT: alle klanten, alles wat er nog ligt
// ═══════════════════════════════════════════════════════════
// De planning per klant beantwoordt "wat ligt er bij deze klant". Deze route
// beantwoordt de vraag waar een werkweek écht mee begint: "wat moet ik vandaag
// en de komende weken doen", ongeacht bij wie het hoort.
//
// Wat hier NIET gebeurt: kaarten splitsen en fase-standen wegschrijven. Dat doet
// de per-klant-route al bij het openen van een klant. Het overzicht is een
// kijkscherm; een kijkscherm hoort niets te veranderen.
export async function GET(req: NextRequest) {
  const scope = await getAdminScope(req);
  if (!scope) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });

  const tasks = await getWeekplanAlleKlanten(scope.allowedSlugs);

  // De fase-standen erbij, maar alleen voor de klanten die hier echt in beeld
  // komen, en alleen voor de pagina's die aan een kaart hangen. Alle negentien
  // klanten doorrekenen voor zeven kaarten is werk dat niemand ziet.
  const perKlant = new Map<string, Set<string>>();
  for (const t of tasks) {
    if (!t.url || t.status === "klaar") continue;
    if (!perKlant.has(t.slug)) perKlant.set(t.slug, new Set());
    perKlant.get(t.slug)!.add(urlKey(t.url));
  }
  const paren = await Promise.all([...perKlant.entries()].map(async ([slug, keys]) => {
    // Eén klant met een hapering mag het hele overzicht niet leegtrekken: dan
    // missen alleen daar de fase-letters, en de rest staat er gewoon.
    const pages = await getWeekplanPages(slug, keys).catch(() => ({}));
    return [slug, pages] as const;
  }));

  return NextResponse.json({
    ok: true,
    tasks,
    pages: Object.fromEntries(paren),
    current: isoWeek(new Date()),
  });
}
