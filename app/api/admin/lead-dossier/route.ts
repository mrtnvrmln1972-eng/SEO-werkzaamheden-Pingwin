import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { addDossierItem, listDossier, getDossierItem, deleteDossierItem } from "../../../../lib/lead-dossier";
import { readDriveDoc, fileName } from "../../../../lib/drive";
import { leesAangeleverdDocument } from "../../../../lib/doc-versions";

export const runtime = "nodejs";
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// ── Een link die een link blijft ─────────────────────────────────────────────
// Niet alles is uit te lezen: een pdf in Drive, een map, een link naar een
// andere omgeving. Dat is geen fout. Het stuk hoort dan in het dossier te staan
// als wat het is: de naam van het document, en een knop die het opent op de plek
// waar het echt staat. Titel en samenvatting geven we zelf mee, zodat er geen
// AI-ronde nodig is voor iets waar toch geen tekst in zit.
function naamUitLink(link: string): string {
  try {
    const u = new URL(link);
    const laatste = u.pathname.split("/").filter(Boolean).pop() || "";
    const schoon = decodeURIComponent(laatste).replace(/[-_]+/g, " ").trim();
    return schoon && schoon.length > 2 ? schoon.slice(0, 120) : u.hostname;
  } catch { return link.slice(0, 120); }
}

function bronVanLink(link: string): string {
  try { return `Link: ${new URL(link).hostname}`; } catch { return "Link"; }
}

function bewaarAlsLink(slug: string, link: string, naam: string, bron: string) {
  const titel = (naam || "").trim() || naamUitLink(link);
  return addDossierItem(slug, {
    inhoud: link,
    titel,
    soort: "document",
    samenvatting: `${titel}. Bewaard als link; het document zelf staat op zijn oorspronkelijke plek, met de opmaak van het origineel.`,
    bron,
    driveLink: link,
  });
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

    // Eén inleesweg voor élk aangeleverd bestand, dezelfde die de pagina-dropzone
    // en de mail-bijlage gebruiken. Deze route had zijn eigen, beperktere versie
    // en weigerde daardoor pdf, terwijl het systeem pdf allang kan lezen. Precies
    // het geval dat je nodig hebt: een Ads-analyse van een collega komt als pdf.
    // Lege pagina meegeven: een lead heeft geen pagina's, dus het bestand landt
    // in de map van het bedrijf zelf in plaats van in een verzonnen paginamap.
    const lees = await leesAangeleverdDocument(slug, "", naam, buf);
    if (!lees.ok || !lees.tekst?.trim()) {
      // Er kwam geen tekst uit (een scan bijvoorbeeld), maar het bestand zelf is
      // wél bewaard. Dan blijft het gewoon een link met de naam van het bestand,
      // in plaats van een foutmelding en niets in het dossier.
      if (lees.driveLink) return NextResponse.json({ ok: true, item: await bewaarAlsLink(slug, lees.driveLink, naam, `Bestand: ${naam}`) });
      return NextResponse.json({ ok: false, error: lees.error || "Kon geen leesbare tekst uit dit bestand halen." }, { status: 400 });
    }

    const item = await addDossierItem(slug, {
      inhoud: lees.tekst, titel: "", soort: "document",
      bron: `Bestand: ${naam}`, driveLink: lees.driveLink || "",
    });
    return NextResponse.json({ ok: true, item });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen bedrijf opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const driveLink = String(body.driveLink || "").trim();
  if (driveLink) {
    // Lukt het lezen, dan komt de inhoud mee (dan kan de chat er ook op zoeken).
    // Lukt het niet, dan blijft het gewoon een link: een pdf in Drive, een map,
    // of een link naar buiten hoort in het dossier te landen met de naam van het
    // document erbij, niet als foutmelding.
    const read = await readDriveDoc(driveLink, 60000);
    if (read.ok && (read.text || "").trim()) {
      const item = await addDossierItem(slug, {
        inhoud: read.text || "", titel: read.name || "", soort: "document",
        bron: "Google Drive", driveLink,
      });
      return NextResponse.json({ ok: true, item });
    }
    const naam = (read.name || "").trim() || (await fileName(driveLink).catch(() => "")) || naamUitLink(driveLink);
    return NextResponse.json({ ok: true, item: await bewaarAlsLink(slug, driveLink, naam, bronVanLink(driveLink)) });
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
