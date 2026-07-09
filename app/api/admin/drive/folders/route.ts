import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug, getAdminScope } from "../../../../../lib/admin-scope";
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
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const url = req.nextUrl.searchParams.get("url") || "";
  // Lichte modus: alleen de al gekozen bestemmingsmap ophalen (geen Drive-call),
  // voor bij het laden van een pagina.
  if (req.nextUrl.searchParams.get("chosenOnly")) {
    const chosen = slug && url ? await getPageDriveFolder(slug, url).catch(() => null) : null;
    return NextResponse.json({ ok: true, chosen });
  }
  // PRIVACY: de Google-koppeling is het Drive-account van de eigenaar. Alleen de
  // eigenaar mag daarin bladeren; gasten zien anders mapnamen die niet voor hen
  // bedoeld zijn. Gasten krijgen een nette melding (documenten worden gedownload).
  if (!g.scope.isOwner) {
    return NextResponse.json({ ok: false, connected: false, error: "De Drive-koppeling is van de eigenaar; alleen de eigenaar kan hier een map kiezen. Jouw documenten worden gewoon als download geleverd." }, { status: 200 });
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
      // Mappen aanmaken gebeurt in het Drive-account van de eigenaar: eigenaar-only.
      const scope = await getAdminScope(req);
      if (!scope?.isOwner) return NextResponse.json({ ok: false, error: "Alleen de eigenaar kan mappen in Drive maken." }, { status: 403 });
      const parent = String(body.parent || "root");
      const name = String(body.name || "").trim();
      if (!name) return NextResponse.json({ ok: false, error: "Geef een mapnaam." }, { status: 400 });
      const folder = await createFolder(parent, name);
      return NextResponse.json({ ok: true, folder });
    }
    if (action === "save") {
      const slug = String(body.slug || "").trim();
      const g2 = await guardSlug(req, slug); if (!g2.ok) return g2.res;
      // Een bestemmingsmap kiezen hoort bij het bladeren: eigenaar-only.
      if (!g2.scope.isOwner) return NextResponse.json({ ok: false, error: "Alleen de eigenaar kan een Drive-map koppelen." }, { status: 403 });
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
