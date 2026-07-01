import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { listFolders, createFolder } from "../../../../../lib/drive";
import { savePageDriveFolder, getPageDriveFolder } from "../../../../../lib/site-urls";

export const runtime = "nodejs";
export const maxDuration = 60;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET ?parent=ID&slug=&url=  → submappen van parent (root als leeg) + de eventueel
// al gekozen bestemmingsmap voor deze pagina.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const parent = req.nextUrl.searchParams.get("parent") || "root";
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const url = req.nextUrl.searchParams.get("url") || "";
  // Lichte modus: alleen de al gekozen bestemmingsmap ophalen (geen Drive-call),
  // voor bij het laden van een pagina.
  if (req.nextUrl.searchParams.get("chosenOnly")) {
    const chosen = slug && url ? await getPageDriveFolder(slug, url).catch(() => null) : null;
    return NextResponse.json({ ok: true, chosen });
  }
  try {
    const folders = await listFolders(parent);
    const chosen = slug && url ? await getPageDriveFolder(slug, url) : null;
    return NextResponse.json({ ok: true, connected: true, folders, chosen });
  } catch (e) {
    // Meestal: Google niet (opnieuw) gekoppeld met Drive-toestemming.
    return NextResponse.json({ ok: false, connected: false, error: e instanceof Error ? e.message : "Drive niet bereikbaar." }, { status: 200 });
  }
}

// POST {action}: "create" (parent,name) een submap maken; "save" de bestemmingsmap
// voor een pagina vastleggen.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const action = String(body.action || "");
  try {
    if (action === "create") {
      const parent = String(body.parent || "root");
      const name = String(body.name || "").trim();
      if (!name) return NextResponse.json({ ok: false, error: "Geef een mapnaam." }, { status: 400 });
      const folder = await createFolder(parent, name);
      return NextResponse.json({ ok: true, folder });
    }
    if (action === "save") {
      const slug = String(body.slug || "").trim();
      const url = String(body.url || "").trim();
      const folderId = String(body.folderId || "").trim();
      const folderName = String(body.folderName || "").trim();
      const folderPath = String(body.folderPath || "").trim();
      if (!slug || !url || !folderId) return NextResponse.json({ ok: false, error: "Klant, URL en map zijn verplicht." }, { status: 400 });
      await savePageDriveFolder(slug, url, folderId, folderName, folderPath);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Drive-actie mislukt." }, { status: 500 });
  }
}
