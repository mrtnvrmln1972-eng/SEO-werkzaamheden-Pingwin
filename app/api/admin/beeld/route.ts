import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getAdminScope, guardSlug } from "../../../../lib/admin-scope";
import { bewaarBeeld, MAX_BYTES, TOEGESTANE_SOORTEN } from "../../../../lib/veld-beelden";

export const runtime = "nodejs";

// Een screendump die in een tekstveld gesleept of geplakt is: bewaren en het
// adres teruggeven waarmee hij in de tekst komt te staan. De uitleg over waarom
// dit in de database landt en niet in Drive staat in lib/veld-beelden.ts.
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "Geen beeld ontvangen." }, { status: 400 });

  // Hoort het veld bij een klant, dan gelden de rechten van die klant. Velden
  // zonder klant (de developer-pagina) vallen terug op het gewone bereik: wie
  // niets mag wijzigen, mag hier ook niets neerzetten. Meekijken blijft kijken.
  const slug = String(form.get("slug") || "").trim();
  if (slug) {
    const g = await guardSlug(req, slug);
    if (!g.ok) return g.res;
  } else {
    const scope = await getAdminScope(req);
    if (!scope?.canEdit) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });
  }

  const file = form.get("beeld");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Geen beeld ontvangen." }, { status: 400 });
  const mime = (file.type || "").toLowerCase();
  if (!TOEGESTANE_SOORTEN.includes(mime)) {
    return NextResponse.json({ ok: false, error: "Dit soort bestand kan hier niet: alleen een afbeelding (png, jpg, gif of webp)." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Deze afbeelding is groter dan 12 MB." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.length) return NextResponse.json({ ok: false, error: "Het beeld was leeg." }, { status: 400 });
  const id = await bewaarBeeld(slug, file.name || "schermafbeelding", mime, bytes);
  return NextResponse.json({ ok: true, id, url: `/api/admin/beeld/${id}`, naam: file.name || "schermafbeelding" });
}
