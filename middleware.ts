import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, ADMIN_COOKIE } from "./lib/constants";

// Eerste poort (Edge): kijkt alleen of de juiste cookie aanwezig is. De
// échte handtekening-controle gebeurt in Node (de pagina's zelf verifiëren
// en sturen een vervalste cookie alsnog weg). Geen crypto hier, want de
// Edge-runtime ondersteunt Node's crypto niet.
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Adminscherm (alleen voor Maarten). /admin/login blijft open.
  if (path.startsWith("/admin")) {
    if (path === "/admin/login") return NextResponse.next();
    if (!req.cookies.get(ADMIN_COOKIE)?.value) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Klant-dashboard.
  if (!req.cookies.get(SESSION_COOKIE)?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin", "/admin/:path*"],
};
