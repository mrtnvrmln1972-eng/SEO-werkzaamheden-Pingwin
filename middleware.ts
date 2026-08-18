import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, ADMIN_COOKIE } from "./lib/constants";
import { vensterKlant, magVensterPad, vensterStartPad } from "./lib/klantvenster";

// Eerste poort (Edge): kijkt alleen of de juiste cookie aanwezig is. De
// échte handtekening-controle gebeurt in Node (de pagina's zelf verifiëren
// en sturen een vervalste cookie alsnog weg). Geen crypto hier, want de
// Edge-runtime ondersteunt Node's crypto niet.
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // ── Klantvenster: deze omgeving toont maar één klant ──
  // Alleen actief als WERELD_KLANT ingesteld is (zie lib/klantvenster.ts).
  // De echte controle gebeurt verderop in Node, bij elke route; dit is de
  // voorpoort die voorkomt dat er überhaupt een verkeerd scherm opent.
  // Automatische ronden horen bij het gewone dashboard, niet bij een venster.
  // Zou de planner ze hier ook aanroepen, dan draait elk nachtwerk dubbel op
  // dezelfde gegevens. Zonder venster gaan ze gewoon door.
  if (path.startsWith("/api/cron/")) {
    return vensterKlant()
      ? NextResponse.json({ ok: true, overgeslagen: "klantvenster" })
      : NextResponse.next();
  }

  if (vensterKlant()) {
    if (!magVensterPad(path)) {
      const url = req.nextUrl.clone();
      url.pathname = vensterStartPad();
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Maarten met een admin-sessie hoort nooit op de klant-login of het
  // klantdashboard te stranden: stuur hem door naar zijn cockpit (daar
  // zitten de klant-previews). De klant-login zelf blijft ongewijzigd.
  const isAdmin = Boolean(req.cookies.get(ADMIN_COOKIE)?.value);
  const isKlant = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (isAdmin && !isKlant && (path === "/login" || path.startsWith("/dashboard"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  // De klant-login zelf blijft altijd bereikbaar (zonder admin-sessie).
  if (path === "/login") return NextResponse.next();

  // Adminscherm (alleen voor Maarten). /admin/login blijft open.
  if (path.startsWith("/admin")) {
    if (path === "/admin/login") return NextResponse.next();
    // Één-klik-ingang (bookmark): mag door zonder cookie; de route zelf zet
    // de admin-cookie en stuurt door naar /admin.
    if (path === "/admin/enter") return NextResponse.next();
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
  matcher: ["/login", "/dashboard/:path*", "/admin", "/admin/:path*", "/api/cron/:path*"],
};
