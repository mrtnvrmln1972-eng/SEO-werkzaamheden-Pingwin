import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { buildCopyKlantSpec, copyNaarSecties } from "../../../../lib/copy-doc-klant";
import { buildPingwinDoc, type DocSpec } from "../../../../lib/pingwin-docx";
import { getPageDocOutputs } from "../../../../lib/site-urls";

// Het opgemaakte Word-document van een vastgelegde stap, rechtstreeks als
// download.
//
// Waarom deze route er is: was er voor een pagina geen Drive-map gekozen, dan
// werd de tekst wél opgeslagen maar nooit een document gemaakt. De link bij die
// stap wees dan naar de interne tekstweergave, en dat is precies wat je NIET
// verwacht als je op een copy-link klikt: ruwe tekst in plaats van het
// opgemaakte stuk. Nu is er altijd een document, met of zonder Drive-map.
//
// De inhoud komt uit wat er al ligt; er wordt niets opnieuw bedacht. Voor copy
// is dat de volledige klant-briefing (dus ontdubbeld, met de omslag en het
// metadata-blok), voor de andere stappen de opgeslagen tekst in de huisstijl.

export const runtime = "nodejs";
export const maxDuration = 300;

const LABEL: Record<string, string> = {
  analyse: "SEO-analyse", blauwdruk: "SEO-blauwdruk", copy: "Copy-briefing", structured: "Structured data",
};

function bestandsnaam(kind: string, url: string): string {
  const pad = (() => {
    try { return new URL(url).pathname.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "pagina"; }
    catch { return "pagina"; }
  })();
  return `${LABEL[kind] || kind}-${pad}.docx`;
}

export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const q = req.nextUrl.searchParams;
  const slug = String(q.get("slug") || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const url = String(q.get("url") || "").trim();
  const kind = String(q.get("kind") || "").trim();
  if (!slug || !url || !LABEL[kind]) {
    return NextResponse.json({ ok: false, error: "Klant, pagina en soort zijn verplicht." }, { status: 400 });
  }

  const client = await getClientBySlug(slug);
  if (!client) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });

  const outputs = await getPageDocOutputs(slug, url).catch(() => ({} as Record<string, string>));
  const tekst = (outputs[kind] || "").trim();
  if (!tekst) {
    return NextResponse.json({ ok: false, error: `Er is nog geen ${LABEL[kind].toLowerCase()} voor deze pagina.` }, { status: 404 });
  }

  const pad = (() => { try { return new URL(url).pathname || url; } catch { return url; } })();

  let spec: DocSpec | null = null;
  if (kind === "copy") {
    // De volle klant-briefing: ontdubbeld, met omslag, metadata-blok en de
    // webteksten. Lukt dat niet (bijvoorbeeld zonder AI-sleutel), dan alsnog de
    // opgeslagen tekst in de huisstijl; liever een sober document dan geen.
    const r = await buildCopyKlantSpec(slug, url).catch(() => null);
    if (r?.ok && r.spec) spec = r.spec;
  }
  if (!spec) {
    spec = {
      klant: client.name,
      rapporttype: LABEL[kind],
      titel: `${LABEL[kind]} voor ${pad}`,
      ondertitel: pad,
      meta: { Pagina: pad, Datum: new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) },
      sfeerbeeldUrl: url,
      sections: copyNaarSecties(tekst),
    };
  }

  try {
    const buffer = await buildPingwinDoc(spec);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${bestandsnaam(kind, url)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "Het document kon niet gemaakt worden." }, { status: 500 });
  }
}
