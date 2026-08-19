import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { anthropicConfigured } from "../../../../../lib/anthropic";
import { maakOndersteunend } from "../../../../../lib/ondersteunend";

export const runtime = "nodejs";
// Lezen van twee landingspagina's, Search Console erbij en een volledig stuk
// tekst terugschrijven: dat past niet in de standaardtijd van een verzoek.
export const maxDuration = 300;

// Een aangeleverde blog of projecttekst ondersteunend maken aan een of twee
// landingspagina's, in plaats van ermee te concurreren. Het aangeleverde
// document blijft staan; er komt een nieuw document naast.
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  if (!anthropicConfigured()) {
    return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const versieId = Number(body.id);
  if (!slug || !versieId) return NextResponse.json({ ok: false, error: "Klant en document zijn verplicht." }, { status: 400 });

  const doelUrls = (Array.isArray(body.doelUrls) ? body.doelUrls : []).map((u) => String(u || "").trim()).filter(Boolean);
  const uitkomst = await maakOndersteunend({
    slug,
    versieId,
    doelUrls,
    zoekwoorden: String(body.zoekwoorden || "").trim().slice(0, 400),
    folderId: String(body.folderId || "").trim(),
  });
  return NextResponse.json(uitkomst, { status: uitkomst.ok ? 200 : 400 });
}
