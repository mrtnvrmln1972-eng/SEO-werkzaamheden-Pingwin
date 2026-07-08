import { NextRequest, NextResponse } from "next/server";
import { getClientByShareToken } from "../../../lib/clients";
import { SESSION_COOKIE, makeSessionValue } from "../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Loginvrije deel-link: /k/<code>. De code is lang en onraadbaar en staat per
// klant in de database. Klopt hij, dan krijgt de bezoeker dezelfde sessie-cookie
// als na een gewone login en gaat hij rechtstreeks het klant-dashboard in.
// Klopt hij niet (of is de link vernieuwd), dan kom je op de gewone loginpagina.
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const loginUrl = new URL("/login", req.nextUrl.origin);
  if (!process.env.SESSION_SECRET) return NextResponse.redirect(loginUrl);

  const client = await getClientByShareToken(params.token || "");
  // Zelfde spelregel als de gewone login: staat de klant-login uit, dan ook
  // geen toegang via de deel-link.
  if (!client || client.loginEnabled === false) return NextResponse.redirect(loginUrl);

  const res = NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  res.cookies.set(SESSION_COOKIE, makeSessionValue(client.slug), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
