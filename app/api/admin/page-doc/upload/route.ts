import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { readDriveDoc } from "../../../../../lib/drive";
import { listVersions, voegVersieToe, ignoreVersion, leesAangeleverdDocument,
         hernoemVersie, keurVersieGoed } from "../../../../../lib/doc-versions";
import { toetsVersie } from "../../../../../lib/criteria-toets";
import { msGetAttachment } from "../../../../../lib/ms-graph";

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

// Een document toevoegen of een versie beheren. Multipart = bestand geüpload;
// JSON = Drive-link geplakt, of hernoemen, goedkeuren of van de lijst halen.
// Toevoegen verandert nooit iets aan de geldende tekst; dat doet alleen "goedkeur".
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

    // Eén inleesweg voor élk aangeleverd bestand, gedeeld met de mail-bijlage.
    // Deze route had zijn eigen docx-logica en weigerde pdf, terwijl het systeem
    // pdf allang kan lezen. Klanten sturen hun geredigeerde teksten juist vaak
    // als pdf terug, dus dat was precies het geval dat niet werkte.
    const lees = await leesAangeleverdDocument(slug, url, naam, buf);
    if (!lees.ok || !lees.tekst?.trim()) {
      return NextResponse.json({ ok: false, error: lees.error || "Kon geen leesbare tekst uit het bestand halen." }, { status: 400 });
    }
    const versie = await voegVersieToe(slug, url, naam, lees.tekst, lees.driveLink || "", kindHint || undefined);
    return NextResponse.json({ ok: true, versie, versions: await listVersions(slug, url) });
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
    const versie = await voegVersieToe(slug, url, read.name || "gedeeld document", read.text || "", driveLink, String(body.kind || "") || undefined);
    return NextResponse.json({ ok: true, versie, versions: await listVersions(slug, url) });
  }
  // Een bijlage die vanuit het paneel Laatste mails naar een taak gesleept is.
  // Het dashboard haalt hem zelf bij Microsoft op, leest hem in en hangt hem als
  // klantversie aan de taak; downloaden en opnieuw uploaden hoeft dus niet.
  if (action === "uit-mail") {
    const url = String(body.url || "").trim();
    const messageId = String(body.messageId || "").trim();
    const attachmentId = String(body.attachmentId || "").trim();
    if (!url || !messageId || !attachmentId) return NextResponse.json({ ok: false, error: "Mail en bijlage zijn verplicht." }, { status: 400 });
    const bin = await msGetAttachment(messageId, attachmentId).catch(() => null);
    if (!bin) return NextResponse.json({ ok: false, error: "Kon de bijlage niet ophalen uit de mail." }, { status: 400 });
    const naam = String(body.naam || bin.naam || "bijlage");
    const lees = await leesAangeleverdDocument(slug, url, naam, bin.buffer);
    if (!lees.ok || !lees.tekst?.trim()) {
      return NextResponse.json({ ok: false, error: lees.error || "Kon geen leesbare tekst uit de bijlage halen." }, { status: 400 });
    }
    const versie = await voegVersieToe(slug, url, naam, lees.tekst, lees.driveLink || "");
    return NextResponse.json({ ok: true, versie, versions: await listVersions(slug, url) });
  }

  // De naam van een versie aanpassen: dat is wat je in de lijst en in de mail ziet.
  if (action === "hernoem") {
    const id = Number(body.id || 0);
    const naam = String(body.naam || "").trim();
    if (!id || !naam) return NextResponse.json({ ok: false, error: "Versie en naam zijn verplicht." }, { status: 400 });
    const ok = await hernoemVersie(slug, id, naam);
    if (!ok) return NextResponse.json({ ok: false, error: "Deze versie bestaat niet meer." }, { status: 400 });
    return NextResponse.json({ ok: true, versions: await listVersions(slug, String(body.url || "")) });
  }
  // Aanmerken als de versie die geldt. Zet ook de geldende tekst waar de rest van
  // het dashboard mee rekent; dat deed vroeger het automatische samenvoegen.
  if (action === "goedkeur") {
    const id = Number(body.id || 0);
    if (!id) return NextResponse.json({ ok: false, error: "Geen versie opgegeven." }, { status: 400 });
    const r = await keurVersieGoed(slug, id, body.aan !== false);
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, versions: await listVersions(slug, String(body.url || "")) });
  }
  // Toetsen of een teruggekregen versie nog aan de SEO-criteria voldoet. Levert
  // een oordeel in beeld, geen document en geen samenvoeging.
  if (action === "toets") {
    const id = Number(body.id || 0);
    if (!id) return NextResponse.json({ ok: false, error: "Geen versie opgegeven." }, { status: 400 });
    const r = await toetsVersie(slug, id);
    return r.ok ? NextResponse.json({ ok: true, toets: r.toets }) : NextResponse.json({ ok: false, error: r.error }, { status: 400 });
  }
  if (action === "negeer") {
    const id = Number(body.id || 0);
    if (!id) return NextResponse.json({ ok: false, error: "Geen versie opgegeven." }, { status: 400 });
    await ignoreVersion(slug, id);
    return NextResponse.json({ ok: true, versions: await listVersions(slug, String(body.url || "")) });
  }
  return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
}
