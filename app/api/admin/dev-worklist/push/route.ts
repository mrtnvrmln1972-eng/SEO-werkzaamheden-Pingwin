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
// Alt-teksten gaan per AFBEELDING, niet per pagina: pushAltTexts schrijft naar
// de mediabibliotheek, en daar hangt de alt-tekst aan het bestand. Vandaar dat
// een foto op veertig pagina's ook één keer doorgevoerd wordt.
//
// Er wordt niets meer geblokkeerd. Vroeger hielden we een gedeelde foto tegen,
// omdat de alt-tekst bij één pagina hoorde en dan op de andere niet klopte. De
// tekst beschrijft nu wat er op de foto staat, dus hij klopt overal.
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

  let gelukt = 0, mislukt = 0, zonderTekst = 0, afgekapt = 0;
  const meldingen: string[] = [];
  const noteer = (regel: string) => { if (meldingen.length < 5) meldingen.push(regel); };

  if (wat === "meta") {
    const doelen: WorklistPage[] = alleenUrl ? data.pages.filter((p) => p.url === alleenUrl) : data.pages.slice(0, 60);
    if (!doelen.length) return NextResponse.json({ ok: false, error: "Die pagina staat niet in de werklijst." }, { status: 400 });
    afgekapt = !alleenUrl && data.pages.length > 60 ? data.pages.length - 60 : 0;
    for (const p of doelen) {
      try {
        const doeTitle = p.newTitle && alleenVeld !== "desc";
        const doeDesc = p.newDesc && alleenVeld !== "title";
        if (!doeTitle && !doeDesc) continue;
        const r = await pushMetaToSite(slug, p.url, { title: doeTitle ? p.newTitle : undefined, desc: doeDesc ? p.newDesc : undefined });
        if (r.ok) {
          gelukt++;
          if (doeTitle) await setWorklistMark(slug, metaKey(p.url, "title"), true, "Pingwin (automatisch)", p.url);
          if (doeDesc) await setWorklistMark(slug, metaKey(p.url, "desc"), true, "Pingwin (automatisch)", p.url);
        } else { mislukt++; noteer(`${p.path}: ${r.detail}`); }
      } catch (e) {
        // Eén pagina die klapt (bijvoorbeeld geen koppeling) mag de rest niet
        // meeslepen; we melden het en gaan door.
        mislukt++;
        noteer(`${p.path}: ${(e as Error).message}`);
      }
    }
  } else {
    // Alt-teksten: één keer per afbeelding, want zo staat het ook in WordPress.
    const kandidaten = data.images.filter((a) => (!alleenFile || normFile(a.file) === normFile(alleenFile)));
    if (!kandidaten.length) return NextResponse.json({ ok: false, error: "Die afbeelding staat niet in de werklijst." }, { status: 400 });
    const mag = kandidaten.filter((a) => a.altNodig !== false && a.alt.trim()).slice(0, 60);
    zonderTekst = kandidaten.filter((a) => a.altNodig !== false && !a.alt.trim()).length;
    afgekapt = Math.max(0, kandidaten.filter((a) => a.altNodig !== false && a.alt.trim()).length - mag.length);
    if (mag.length) {
      // pushAltTexts schrijft naar de mediabibliotheek; de pagina-URL is er
      // alleen om de juiste site-inloggegevens te kiezen.
      const auth = alleenUrl || data.pages[0]?.url || "";
      try {
        const r = await pushAltTexts(slug, auth, mag);
        gelukt += r.gezet;
        mislukt += r.mislukt.length;
        // Een alt-tekst hangt aan de afbeelding, niet aan één pagina. Voor het
        // logboek koppelen we hem aan de eerste pagina waar die foto staat, zodat
        // je het effect op die pagina kunt volgen.
        for (const a of mag) {
          if (r.mislukt.includes(a.file)) continue;
          let paginaUrl = alleenUrl || "";
          if (!paginaUrl && a.paths?.[0]) { try { paginaUrl = new URL(a.paths[0], data.pages[0]?.url || "").toString(); } catch { paginaUrl = ""; } }
          await setWorklistMark(slug, altKey(a.file), true, "Pingwin (automatisch)", paginaUrl || undefined);
        }
        if (r.mislukt.length) noteer(r.detail);
      } catch (e) {
        mislukt += mag.length;
        noteer((e as Error).message);
      }
    }
  }

  const label = wat === "meta" ? "pagina's met meta's" : "alt-teksten";
  const delen = [`${gelukt} ${label} doorgevoerd`];
  if (mislukt) delen.push(`${mislukt} mislukt`);
  if (zonderTekst) delen.push(`${zonderTekst} overgeslagen (nog geen alt-tekst geschreven)`);
  if (afgekapt) delen.push(`${afgekapt} niet meegenomen (maximaal 60 per keer)`);
  return NextResponse.json({ ok: true, gelukt, mislukt, geblokkeerd: zonderTekst, melding: `${delen.join(", ")}.${meldingen.length ? ` ${meldingen.join(" · ")}` : ""}` });
}
