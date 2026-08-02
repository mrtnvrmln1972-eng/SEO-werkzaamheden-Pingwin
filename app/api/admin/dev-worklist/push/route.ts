import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getWorklistData, setWorklistMark, metaKey, altKey, type WorklistPage } from "../../../../../lib/dev-worklist";
import { pushMetaToSite, pushAltTexts } from "../../../../../lib/wp-push";
import { normFile } from "../../../../../lib/image-classify";

export const runtime = "nodejs";
export const maxDuration = 300;

// De snelweg: meta's en alt-teksten rechtstreeks in WordPress zetten via de
// bestaande koppeling, met terug-controle. Gelukte punten worden meteen
// afgevinkt als "Pingwin (automatisch)".
//
// Drie niveaus, allemaal via deze ene route:
//   - alles:      { slug, wat }
//   - één pagina: { slug, wat, url }
//   - één regel:  { slug, wat: "alt", url, file }  of  { slug, wat: "meta", url, veld }
//
// Alt-teksten van foto's die nog uniek gemaakt moeten worden gaan er nooit in:
// de alt hangt in WordPress aan de foto zelf en zou dan op de verkeerde pagina
// terechtkomen. Die blijven in de lijst staan, rood, tot ze uniek zijn.
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const wat = String(body.wat || "").trim();
  const alleenUrl = String(body.url || "").trim();
  const alleenFile = String(body.file || "").trim();
  const alleenVeld = String(body.veld || "").trim();
  if (!slug || !["meta", "alt"].includes(wat)) return NextResponse.json({ ok: false, error: "Klant en soort (meta of alt) zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const data = await getWorklistData(slug);
  if (!data.pages.length) return NextResponse.json({ ok: false, error: "Er is nog geen werklijst; maak die eerst." }, { status: 400 });

  const doelen: WorklistPage[] = alleenUrl ? data.pages.filter((p) => p.url === alleenUrl) : data.pages.slice(0, 60);
  if (!doelen.length) return NextResponse.json({ ok: false, error: "Die pagina staat niet in de werklijst." }, { status: 400 });
  const afgekapt = !alleenUrl && data.pages.length > 60 ? data.pages.length - 60 : 0;

  let gelukt = 0, mislukt = 0, geblokkeerd = 0;
  const meldingen: string[] = [];
  const noteer = (regel: string) => { if (meldingen.length < 5) meldingen.push(regel); };

  for (const p of doelen) {
    try {
      if (wat === "meta") {
        const doeTitle = p.newTitle && alleenVeld !== "desc";
        const doeDesc = p.newDesc && alleenVeld !== "title";
        if (!doeTitle && !doeDesc) continue;
        const r = await pushMetaToSite(slug, p.url, { title: doeTitle ? p.newTitle : undefined, desc: doeDesc ? p.newDesc : undefined });
        if (r.ok) {
          gelukt++;
          if (doeTitle) await setWorklistMark(slug, metaKey(p.url, "title"), true, "Pingwin (automatisch)");
          if (doeDesc) await setWorklistMark(slug, metaKey(p.url, "desc"), true, "Pingwin (automatisch)");
        } else { mislukt++; noteer(`${p.path}: ${r.detail}`); }
      } else {
        // Alleen wat er nu op mag: niet geblokkeerd, wel een alt-tekst nodig,
        // en (bij een losse regel) precies de aangeklikte afbeelding.
        const kandidaten = p.alts.filter((a) => (!alleenFile || normFile(a.file) === normFile(alleenFile)));
        const mag = kandidaten.filter((a) => !a.dubbel && a.altNodig !== false && a.alt.trim());
        geblokkeerd += kandidaten.filter((a) => a.dubbel).length;
        if (!mag.length) continue;
        const r = await pushAltTexts(slug, p.url, mag);
        gelukt += r.gezet;
        mislukt += r.mislukt.length;
        for (const a of mag) if (!r.mislukt.includes(a.file)) await setWorklistMark(slug, altKey(p.url, a.file), true, "Pingwin (automatisch)");
        if (r.mislukt.length) noteer(`${p.path}: ${r.detail}`);
      }
    } catch (e) {
      // Eén pagina die klapt (bijvoorbeeld geen koppeling) mag de rest niet
      // meeslepen; we melden het en gaan door.
      mislukt++;
      noteer(`${p.path}: ${(e as Error).message}`);
    }
  }

  const label = wat === "meta" ? "pagina's met meta's" : "alt-teksten";
  const delen = [`${gelukt} ${label} doorgevoerd`];
  if (mislukt) delen.push(`${mislukt} mislukt`);
  if (geblokkeerd) delen.push(`${geblokkeerd} overgeslagen (foto moet eerst uniek worden gemaakt)`);
  if (afgekapt) delen.push(`${afgekapt} pagina's niet meegenomen (maximaal 60 per keer)`);
  return NextResponse.json({ ok: true, gelukt, mislukt, geblokkeerd, melding: `${delen.join(", ")}.${meldingen.length ? ` ${meldingen.join(" · ")}` : ""}` });
}
