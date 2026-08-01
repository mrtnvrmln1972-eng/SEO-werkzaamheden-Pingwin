import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getPageDriveFolder } from "../../../../../lib/site-urls";
import { uploadDocx, readDriveDoc } from "../../../../../lib/drive";
import { listVersions, proposeVersion, confirmVersion, ignoreVersion } from "../../../../../lib/doc-versions";

export const runtime = "nodejs";
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Versielijst van een pagina (voor het Documenten-blokje op de kaart).
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en pagina zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const versions = await listVersions(slug, url);
  return NextResponse.json({ ok: true, versions });
}

// Drop of besluit. Multipart = bestand geüpload; JSON = Drive-link geplakt of
// een besluit over een voorstel (verwerk/negeer). Een drop verandert NOOIT de
// geldende versie; dat gebeurt pas bij action "verwerk".
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const ctype = req.headers.get("content-type") || "";

  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ ok: false, error: "Geen bestand ontvangen." }, { status: 400 });
    const slug = String(form.get("slug") || "").trim();
    const url = String(form.get("url") || "").trim();
    const kindHint = String(form.get("kind") || "").trim();
    const file = form.get("file");
    if (!slug || !url || !(file instanceof File)) return NextResponse.json({ ok: false, error: "Klant, pagina en bestand zijn verplicht." }, { status: 400 });
    const g = await guardSlug(req, slug); if (!g.ok) return g.res;
    const naam = file.name || "aangeleverd-document";
    const buf = Buffer.from(await file.arrayBuffer());

    let tekst = "";
    let driveLink = "";
    if (/\.(txt|md|json|csv)$/i.test(naam)) {
      tekst = buf.toString("utf8");
    } else if (/\.docx$/i.test(naam)) {
      // Origineel veilig de pagina-Drivemap in (blijft onaangetast bewaard),
      // en de omgezette Google Doc uitlezen voor de tekst.
      const folder = await getPageDriveFolder(slug, url).catch(() => null);
      if (!folder?.folderId) return NextResponse.json({ ok: false, error: "Deze pagina heeft nog geen Drive-map; koppel die eerst (tab Pagina's)." }, { status: 400 });
      const datum = new Date().toISOString().slice(0, 10);
      try {
        const up = await uploadDocx(folder.folderId, `Aangeleverd-${datum}-${naam}`, buf);
        driveLink = up.link;
        const read = await readDriveDoc(up.id, 60000);
        if (read.ok) tekst = read.text || "";
      } catch (e) {
        return NextResponse.json({ ok: false, error: "Uploaden naar Drive mislukte: " + (e as Error).message }, { status: 500 });
      }
    } else {
      return NextResponse.json({ ok: false, error: "Dit bestandstype kan ik nog niet lezen. Sleep een .docx, .txt of .md, of plak een Drive-link." }, { status: 400 });
    }
    if (!tekst.trim()) return NextResponse.json({ ok: false, error: "Kon geen leesbare tekst uit het bestand halen." }, { status: 400 });
    const proposal = await proposeVersion(slug, url, naam, tekst, driveLink, kindHint || undefined);
    return NextResponse.json({ ok: true, proposal });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const action = String(body.action || "").trim();

  if (action === "link") {
    const url = String(body.url || "").trim();
    const driveLink = String(body.driveLink || "").trim();
    if (!url || !driveLink) return NextResponse.json({ ok: false, error: "Pagina en Drive-link zijn verplicht." }, { status: 400 });
    const read = await readDriveDoc(driveLink, 60000);
    if (!read.ok) return NextResponse.json({ ok: false, error: read.error || "Kon het document niet lezen." }, { status: 400 });
    const proposal = await proposeVersion(slug, url, read.name || "gedeeld document", read.text || "", driveLink, String(body.kind || "") || undefined);
    return NextResponse.json({ ok: true, proposal });
  }
  if (action === "verwerk") {
    const id = Number(body.id || 0);
    if (!id) return NextResponse.json({ ok: false, error: "Geen voorstel opgegeven." }, { status: 400 });
    const r = await confirmVersion(slug, id, String(body.kind || "") || undefined);
    return r.ok ? NextResponse.json({ ok: true, docLink: r.docLink || "", samenvatting: r.samenvatting || "" }) : NextResponse.json({ ok: false, error: r.error }, { status: 500 });
  }
  if (action === "negeer") {
    const id = Number(body.id || 0);
    if (!id) return NextResponse.json({ ok: false, error: "Geen voorstel opgegeven." }, { status: 400 });
    await ignoreVersion(slug, id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
}
