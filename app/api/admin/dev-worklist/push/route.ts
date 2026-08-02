import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getWorklistData, setWorklistMark, metaKey, altKey } from "../../../../../lib/dev-worklist";
import { pushMetaToSite, pushAltTexts } from "../../../../../lib/wp-push";

export const runtime = "nodejs";
export const maxDuration = 300;

// De snelweg: meta's en alt-teksten (van unieke afbeeldingen) rechtstreeks in
// WordPress zetten via de bestaande koppeling, met terug-controle. Gelukte
// punten worden meteen afgevinkt als "Pingwin (automatisch)".
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const wat = String(body.wat || "").trim();
  if (!slug || !["meta", "alt"].includes(wat)) return NextResponse.json({ ok: false, error: "Klant en soort (meta of alt) zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const data = await getWorklistData(slug);
  if (!data.pages.length) return NextResponse.json({ ok: false, error: "Er is nog geen werklijst; maak die eerst." }, { status: 400 });

  let gelukt = 0, mislukt = 0, overgeslagen = 0;
  const meldingen: string[] = [];
  try {
    for (const p of data.pages.slice(0, 60)) {
      if (wat === "meta") {
        if (!p.newTitle && !p.newDesc) continue;
        const r = await pushMetaToSite(slug, p.url, { title: p.newTitle || undefined, desc: p.newDesc || undefined });
        if (r.ok) {
          gelukt++;
          if (p.newTitle) await setWorklistMark(slug, metaKey(p.url, "title"), true, "Pingwin (automatisch)");
          if (p.newDesc) await setWorklistMark(slug, metaKey(p.url, "desc"), true, "Pingwin (automatisch)");
        } else { mislukt++; if (meldingen.length < 3) meldingen.push(`${p.path}: ${r.detail}`); }
      } else {
        const uniek = p.alts.filter((a) => !a.dubbel && a.alt.trim());
        overgeslagen += p.alts.length - uniek.length;
        if (!uniek.length) continue;
        const r = await pushAltTexts(slug, p.url, uniek);
        gelukt += r.gezet;
        mislukt += r.mislukt.length;
        for (const a of uniek) if (!r.mislukt.includes(a.file)) await setWorklistMark(slug, altKey(p.url, a.file), true, "Pingwin (automatisch)");
        if (r.mislukt.length && meldingen.length < 3) meldingen.push(`${p.path}: ${r.detail}`);
      }
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
  const label = wat === "meta" ? "pagina's met meta's" : "alt-teksten";
  const delen = [`${gelukt} ${label} doorgevoerd`];
  if (mislukt) delen.push(`${mislukt} mislukt`);
  if (overgeslagen) delen.push(`${overgeslagen} overgeslagen (afbeelding staat op meerdere pagina's)`);
  return NextResponse.json({ ok: true, melding: `${delen.join(", ")}.${meldingen.length ? ` ${meldingen.join(" · ")}` : ""}` });
}
