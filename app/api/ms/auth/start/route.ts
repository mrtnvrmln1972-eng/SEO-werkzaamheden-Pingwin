import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { msConfigured, msAuthUrl } from "../../../../../lib/ms-graph";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  if (!msConfigured()) {
    return NextResponse.redirect(new URL("/admin?ms=notconfigured", req.url));
  }
  const origin = req.nextUrl.origin;
  const state = crypto.randomUUID();
  return NextResponse.redirect(msAuthUrl(origin, state));
}
