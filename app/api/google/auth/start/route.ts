import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { googleConfigured, googleAuthUrl } from "../../../../../lib/google";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/admin?google=notconfigured", req.url));
  }
  return NextResponse.redirect(googleAuthUrl(req.nextUrl.origin, crypto.randomUUID()));
}
