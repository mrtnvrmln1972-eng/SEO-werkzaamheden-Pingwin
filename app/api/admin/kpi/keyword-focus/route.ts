import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { getKeywordFocus, setKeywordFocus, type FocusTier } from "../../../../../lib/keyword-focus";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// De focus-markeringen (prio/secundair) van een klant.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const focus = await getKeywordFocus(slug);
  return NextResponse.json({ ok: true, focus });
}

// Markeert (of wist) één zoekwoord als prio/secundair. tier: "prio" | "secundair" | null.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const keyword = String(body.keyword || "").trim();
  const tierRaw = body.tier === null ? null : String(body.tier || "");
  if (!slug || !keyword) return NextResponse.json({ ok: false, error: "Klant en zoekwoord verplicht." }, { status: 400 });
  const tier: FocusTier | null = tierRaw === "prio" || tierRaw === "secundair" ? tierRaw : null;
  await setKeywordFocus(slug, keyword, tier);
  return NextResponse.json({ ok: true });
}
