import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import { updateClientAdmin, resetClientPassword } from "../../../../lib/clients";

export const runtime = "nodejs";

// Beheer-velden van een klant (naam, website-domein, e-mail, klant-login aan/uit)
// plus wachtwoord opnieuw genereren. Uitsluitend voor de eigenaar. Bewust een
// losse route naast /api/admin/clients zodat de Beheer-pagina alleen deze
// simpele velden aanraakt (Sheet/budget blijven in de bestaande route).

export async function PATCH(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });

  if (body.action === "resetPassword") {
    const password = await resetClientPassword(slug);
    if (!password) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
    return NextResponse.json({ ok: true, password });
  }

  const patch: { name?: string; domain?: string | null; email?: string | null; loginEnabled?: boolean; ahrefsKeyRef?: string | null } = {};
  if ("name" in body) patch.name = String(body.name || "").trim();
  if ("domain" in body) patch.domain = String(body.domain || "").trim() || null;
  if ("email" in body) patch.email = String(body.email || "").trim() || null;
  if ("loginEnabled" in body) patch.loginEnabled = body.loginEnabled === true;
  if ("ahrefsKeyRef" in body) patch.ahrefsKeyRef = String(body.ahrefsKeyRef || "").trim() || null;

  const ok = await updateClientAdmin(slug, patch);
  if (!ok) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
