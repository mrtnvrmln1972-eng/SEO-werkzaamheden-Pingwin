import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { addDossierItem, listDossier, getDossierItem, deleteDossierItem } from "../../../../lib/lead-dossier";
import { readDriveDoc, uploadDocx } from "../../../../lib/drive";
import { getPageDriveFolder } from "../../../../lib/site-urls";

export const runtime = "nodejs";
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// De inhoudsopgave van het dossier (zonder de volledige inhoud), of één stuk
// volledig als er een id meegegeven is.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen bedrijf opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const id = Number(req.nextUrl.searchParams.get("id") || 0);
  if (id) {
    const item = await getDossierItem(slug, id);
    if (!item) return NextResponse.json({ ok: false, error: "Niet gevonden." }, { status: 404 });
    return NextResponse.json({ ok: true, item });
  }
  return NextResponse.json({ ok: true, items: await listDossier(slug) });
}

// Aanleveren. Drie manieren, allemaal naar dezelfde plek:
//  - multipart: een bestand gesleept
//  - JSON met driveLink: een Google-document geplakt
//  - JSON met tekst: geplakte tekst of een losse notitie
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const ctype = req.headers.get("content-type") || "";

  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ ok: false, error: "Geen bestand ontvangen." }, { status: 400 });
    const slug = String(form.get("slug") || "").trim();
    const file = form.get("file");
    if (!slug || !(file instanceof File)) return NextResponse.json({ ok: false, error: "Bedrijf en bestand zijn verplicht." }, { status: 400 });
    const g = await guardSlug(req, slug); if (!g.ok) return g.res;

    const naam = file.name || "aangeleverd-document";
    const buf = Buffer.from(await file.arrayBuffer());
    let tekst = "";
    let driveLink = "";

    if (/\.(txt|md|json|csv|tsv)$/i.test(naam)) {
      tekst = buf.toString("utf8");
    } else if (/\.docx$/i.test(naam)) {
      // Het origineel gaat veilig naar Drive (blijft onaangetast bewaard) en de
      // omgezette versie lezen we uit voor de tekst.
      let dest = "";
      try { const f = await getPageDriveFolder(slug, "__lead__"); if (f) dest = f.folderId; } catch { /* hoofdmap */ }
      try {
        const up = await uploadDocx(dest || "root", `Aangeleverd-${new Date().toISOString().slice(0, 10)}-${naam}`, buf);
        driveLink = up.link;
        const read = await readDriveDoc(up.id, 60000);
        if (read.ok) tekst = read.text || "";
      } catch (e) {
        return NextResponse.json({ ok: false, error: "Uploaden naar Drive mislukte: " + (e as Error).message }, { status: 500 });
      }
    } else {
      return NextResponse.json(
        { ok: false, error: "Dit bestandstype kan ik nog niet lezen. Sleep een .docx, .txt, .md of .csv, of zet het bestand in Drive en plak de link (een PDF wordt door Drive vanzelf leesbaar gemaakt)." },
        { status: 400 },
      );
    }
    if (!tekst.trim()) return NextResponse.json({ ok: false, error: "Kon geen leesbare tekst uit dit bestand halen." }, { status: 400 });

    const item = await addDossierItem(slug, { inhoud: tekst, titel: "", soort: "document", bron: `Bestand: ${naam}`, driveLink });
    return NextResponse.json({ ok: true, item });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen bedrijf opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const driveLink = String(body.driveLink || "").trim();
  if (driveLink) {
    const read = await readDriveDoc(driveLink, 60000);
    if (!read.ok) return NextResponse.json({ ok: false, error: read.error || "Kon dat document niet lezen." }, { status: 400 });
    const item = await addDossierItem(slug, {
      inhoud: read.text || "", titel: read.name || "", soort: "document",
      bron: "Google Drive", driveLink,
    });
    return NextResponse.json({ ok: true, item });
  }

  const tekst = String(body.tekst || "").trim();
  if (!tekst) return NextResponse.json({ ok: false, error: "Er is niets om te bewaren." }, { status: 400 });
  const item = await addDossierItem(slug, {
    inhoud: tekst,
    titel: String(body.titel || "").trim(),
    soort: String(body.soort || "notitie"),
    bron: "Handmatig toegevoegd",
  });
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const id = Number(req.nextUrl.searchParams.get("id") || 0);
  if (!slug || !id) return NextResponse.json({ ok: false, error: "Bedrijf en nummer zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  return NextResponse.json({ ok: await deleteDossierItem(slug, id) });
}
