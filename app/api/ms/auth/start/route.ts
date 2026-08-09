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
  // Een label ("Maarten", een collega-naam) reist mee in de state en komt bij
  // de callback terug; zo weet msExchangeCode onder welke naam deze mailbox
  // moet verschijnen in de lijst gekoppelde mailboxen (R5, meerdere mailboxen).
  const label = (req.nextUrl.searchParams.get("label") || "").trim().slice(0, 60);
  const state = label ? `lbl:${encodeURIComponent(label)}:${crypto.randomUUID()}` : crypto.randomUUID();
  return NextResponse.redirect(msAuthUrl(origin, state));
}
