import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { getClientUrls } from "../../../../lib/site-urls";
import { zwakkePaginas } from "../../../../lib/concurrenten";

export const runtime = "nodejs";
export const maxDuration = 300;

// Het structuuroverzicht: welke SOORTEN pagina's heeft deze site, hoeveel van
// elk, en hoeveel daarvan verdienen geen eigen zoekterm.
//
// Waarom dit boven de redirectlijst hoort: bij One Day Clinic bleken er acht
// verschillende URL-vormen te bestaan voor hetzelfde onderwerp (soa-klinieken,
// soa-test-locaties, soa-poli, soa-kliniek). Zolang die naast elkaar bestaan
// blijf je redirecten. Eerst het patroon zien, dan pas de regels afwerken.
//
// De vorm wordt geteld, niet ingebouwd: het laatste onderscheidende woord van
// een pad wordt vervangen door <plaats>. Werkt dus net zo goed voor een hovenier
// met /hovenier/etten-leur/ als voor een kliniek.

const padVan = (u: string) => { try { return new URL(u).pathname; } catch { return u; } };

export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant." }, { status: 400 });

  const client = await getClientBySlug(slug);
  const urls = await getClientUrls(slug).catch(() => []);
  const live = urls.filter((u) => u.status === 200);
  if (!live.length) return NextResponse.json({ ok: true, families: [], totaalLive: 0, dood: 0 });

  // Wanneer is een woord een PLAATS? Eerder was dat "komt zelden voor", en dat gaf
  // onzin: /testosteron-bloedtest/, /afspraak-maken/ en /algemene-voorwaarden/
  // verschenen als /<plaats>-<plaats>/, waarna de telling "42 pagina's, 35 dood"
  // de algemene voorwaarden op één hoop gooide met Gouda.
  //
  // Een plaatsnaam herken je aan iets anders: hij komt terug in MEERDERE
  // verschillende URL-vormen. Gouda staat in /soa-poli-gouda/ én in
  // /soa-klinieken/soa-test-gouda/. "testosteron" staat op één pagina, in één vorm.
  const woorden = (p: string) => p.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const freq = new Map<string, number>();
  for (const u of live) for (const w of new Set(woorden(padVan(u.url)))) freq.set(w, (freq.get(w) || 0) + 1);
  const grens = Math.max(3, Math.round(live.length * 0.06));

  // Stap 1: welke woorden vullen hetzelfde gat? Neem een pad, haal er één woord
  // uit, en kijk welke andere woorden op die plek voorkomen. In /soa-poli-gouda/
  // levert dat gouda, haarlem, nijmegen enzovoort op: één familie.
  const vullers = new Map<string, Set<string>>();
  for (const u of live) {
    const pad = padVan(u.url).toLowerCase();
    for (const w of new Set(woorden(pad))) {
      const gat = pad.split(w).join("*");
      if (!vullers.has(gat)) vullers.set(gat, new Set());
      vullers.get(gat)!.add(w);
    }
  }
  // Stap 2: hoe groot is de familie waar een woord bij hoort? Een plaatsnaam heeft
  // tientallen broers en zussen (alle steden waar de klant zit). Een ziekte of een
  // dienst heeft er een handvol. Die twintig is het verschil tussen "gouda" en
  // "chlamydia", en tussen "amsterdam" en "voorwaarden".
  const familie = new Map<string, Set<string>>();
  for (const set of vullers.values()) {
    if (set.size < 3) continue;
    for (const w of set) {
      if (!familie.has(w)) familie.set(w, new Set());
      for (const b of set) familie.get(w)!.add(b);
    }
  }
  const isPlaats = (w: string) => (familie.get(w)?.size || 0) >= 20 && (freq.get(w) || 0) <= grens;

  const vormVan = (p: string): string => {
    const seg = p.replace(/^\/|\/$/g, "").split("/");
    if (!seg[0]) return "/";
    const uit = seg.map((s) => s.split("-").map((d) => (isPlaats(d.toLowerCase()) ? "<plaats>" : d)).join("-"));
    return "/" + uit.join("/") + "/";
  };

  const perVorm = new Map<string, string[]>();
  for (const u of live) {
    const p = padVan(u.url);
    const v = vormVan(p);
    if (!v.includes("<plaats>")) continue;         // geen locatievorm, niet interessant hier
    // Een pad dat ALLEEN uit een plaatsnaam bestaat is geen patroon maar een los
    // woord: zo belandden /bloedtesten/ en /afscheiding/ in de lijst.
    if (v === "/<plaats>/") continue;
    if (!perVorm.has(v)) perVorm.set(v, []);
    perVorm.get(v)!.push(p);
  }

  // Welke daarvan verdienen geen eigen zoekterm? Dat komt uit Search Console.
  let doodSet = new Set<string>();
  try {
    const z = await zwakkePaginas(slug, client?.domain || "");
    doodSet = new Set((z.kandidaten || []).map((k) => k.pad));
  } catch { /* zonder GSC tonen we alleen de aantallen */ }

  const families = [...perVorm.entries()]
    .map(([vorm, paden]) => ({
      vorm,
      aantal: paden.length,
      dood: paden.filter((p) => doodSet.has(p)).length,
      voorbeelden: paden.slice(0, 3),
    }))
    // Minder dan drie pagina's is geen patroon maar toeval; die regels maakten de
    // lijst lang zonder er iets aan toe te voegen.
    .filter((f) => f.aantal >= 3)
    .sort((a, b) => b.aantal - a.aantal);

  return NextResponse.json({
    ok: true,
    families,
    totaalLive: live.length,
    totaalVormen: families.reduce((n, f) => n + f.aantal, 0),
    dood: families.reduce((n, f) => n + f.dood, 0),
    gemeten: doodSet.size > 0,
  });
}
