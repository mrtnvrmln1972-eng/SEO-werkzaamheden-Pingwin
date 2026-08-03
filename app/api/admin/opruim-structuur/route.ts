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

  // Hoe vaak komt elk woord voor? Wat zeldzaam is, is de plaatsnaam.
  const freq = new Map<string, number>();
  const woorden = (p: string) => p.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  for (const u of live) for (const w of new Set(woorden(padVan(u.url)))) freq.set(w, (freq.get(w) || 0) + 1);
  const grens = Math.max(3, Math.round(live.length * 0.06));

  const vormVan = (p: string): string => {
    const seg = p.replace(/^\/|\/$/g, "").split("/");
    if (!seg[0]) return "/";
    const uit = seg.map((s) => {
      const delen = s.split("-");
      const vervangen = delen.map((d) => ((freq.get(d.toLowerCase()) || 0) <= grens && d.length > 2 ? "<plaats>" : d));
      // Alleen als er echt iets zeldzaams in zat is dit een locatievorm.
      return vervangen.join("-");
    });
    return "/" + uit.join("/") + "/";
  };

  const perVorm = new Map<string, string[]>();
  for (const u of live) {
    const p = padVan(u.url);
    const v = vormVan(p);
    if (!v.includes("<plaats>")) continue;         // geen locatievorm, niet interessant hier
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
    .filter((f) => f.aantal > 1)
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
