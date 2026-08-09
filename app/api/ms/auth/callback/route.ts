import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { msExchangeCode } from "../../../../../lib/ms-graph";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  const code = req.nextUrl.searchParams.get("code");
  const err = req.nextUrl.searchParams.get("error_description") || req.nextUrl.searchParams.get("error");
  if (err) {
    return NextResponse.redirect(new URL(`/admin?ms=error&msg=${encodeURIComponent(err)}`, req.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/admin?ms=error&msg=geen+code", req.url));
  }
  // Label (indien meegegeven bij het koppelen) staat vóórin de state, zie
  // /api/ms/auth/start. Zonder herkenbaar voorvoegsel: geen label, dan valt
  // msExchangeCode terug op de mailboxnaam van het account zelf.
  const state = req.nextUrl.searchParams.get("state") || "";
  const labelMatch = /^lbl:([^:]*):/.exec(state);
  const label = labelMatch ? decodeURIComponent(labelMatch[1]) : undefined;
  const result = await msExchangeCode(req.nextUrl.origin, code, label);
  if (!result.ok) {
    return NextResponse.redirect(new URL(`/admin?ms=error&msg=${encodeURIComponent(result.error || "mislukt")}`, req.url));
  }
  return NextResponse.redirect(new URL("/admin?ms=ok", req.url));
}
