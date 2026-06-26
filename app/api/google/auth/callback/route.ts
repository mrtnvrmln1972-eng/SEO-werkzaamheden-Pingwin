import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { googleExchangeCode } from "../../../../../lib/google";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  const code = req.nextUrl.searchParams.get("code");
  const err = req.nextUrl.searchParams.get("error");
  if (err) return NextResponse.redirect(new URL(`/admin?google=error&msg=${encodeURIComponent(err)}`, req.url));
  if (!code) return NextResponse.redirect(new URL("/admin?google=error&msg=geen+code", req.url));
  const result = await googleExchangeCode(req.nextUrl.origin, code);
  if (!result.ok) return NextResponse.redirect(new URL(`/admin?google=error&msg=${encodeURIComponent(result.error || "mislukt")}`, req.url));
  return NextResponse.redirect(new URL("/admin?google=ok", req.url));
}
