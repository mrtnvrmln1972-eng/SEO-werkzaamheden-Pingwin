import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "./lib/constants";

// Eerste poort (Edge): is er überhaupt een sessie-cookie? Zo niet, terug
// naar /login. De échte handtekening-controle gebeurt in Node (de
// dashboard-pagina zelf verifieert met verifySessionValue en stuurt een
// vervalste cookie alsnog naar /login). Geen crypto hier, want de Edge-
// runtime ondersteunt Node's crypto niet.
export function middleware(req: NextRequest) {
  const value = req.cookies.get(SESSION_COOKIE)?.value;
  if (!value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
