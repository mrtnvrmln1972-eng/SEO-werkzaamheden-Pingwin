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
  // ?purpose=drive = de losse Drive-koppeling; anders de data-koppeling (GSC+GA).
  // De purpose reist mee in de state, zodat de callback weet waar hij hem opslaat.
  const purpose = req.nextUrl.searchParams.get("purpose") === "drive" ? "drive" : "data";
  const state = `${purpose}:${crypto.randomUUID()}`;
  return NextResponse.redirect(googleAuthUrl(req.nextUrl.origin, state, purpose));
}
