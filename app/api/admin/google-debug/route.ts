import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getClientBySlug } from "../../../../lib/clients";
import { gscDebug } from "../../../../lib/google";
import { vensterPoort } from "../../../../lib/klantvenster";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Diagnose voor "GSC laadt niet": laat het verbonden Google-account zien, of dat
// account de property van dit domein/klant ziet, en welke property gekozen wordt.
// Gebruik: /api/admin/google-debug?domain=gardenswimm.nl  of  ?slug=gardenswimm
export async function GET(req: NextRequest) {
  const weg = vensterPoort(); if (weg) return weg;
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let domain = (req.nextUrl.searchParams.get("domain") || "").trim();
  const slug = (req.nextUrl.searchParams.get("slug") || "").trim();
  if (!domain && slug) { const c = await getClientBySlug(slug).catch(() => null); domain = (c?.domain || "").trim(); }
  if (!domain) return NextResponse.json({ ok: false, error: "Geef ?domain=… of ?slug=… op." }, { status: 400 });
  return NextResponse.json({ ok: true, domain, ...(await gscDebug(domain)) });
}
