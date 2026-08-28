import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, ADMIN_COOKIE } from "./lib/constants";
import { vensterKlant, magVensterPad, vensterStartPad } from "./lib/klantvenster";

// Eerste poort (Edge): kijkt alleen of de juiste cookie aanwezig is. De
// échte handtekening-controle gebeurt in Node (de pagina's zelf verifiëren
// en sturen een vervalste cookie alsnog weg). Geen crypto hier, want de
// Edge-runtime ondersteunt Node's crypto niet.
// De interne map onder een gedeelde clusterpagina. Alles eronder zit achter
// een wachtwoord; de openbare versie ernaast blijft vrij.
const INTERN_PAD = "/share/cluster/onedayclinic/intern-9f3a2b";
const INTERN_GEBRUIKER = "pingwin";

// Vergelijken zonder dat de duur van de vergelijking iets verraadt.
function gelijk(a: string, b: string) {
  if (a.length !== b.length) return false;
  let verschil = 0;
  for (let i = 0; i < a.length; i++) verschil |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return verschil === 0;
}

function internToegang(req: NextRequest): NextResponse {
  const wachtwoord = process.env.INTERN_WACHTWOORD;

  // Geen wachtwoord ingesteld = de map bestaat niet. Nooit omdraaien naar
  // "standaard open"; dezelfde regel als bij /admin/enter.
  if (!wachtwoord) return new NextResponse("Niet gevonden", { status: 404 });

  const kop = req.headers.get("authorization") || "";
  if (kop.startsWith("Basic ")) {
    try {
      const [gebruiker, ...rest] = atob(kop.slice(6)).split(":");
      if (gelijk(gebruiker, INTERN_GEBRUIKER) && gelijk(rest.join(":"), wachtwoord)) {
        return NextResponse.next();
      }
    } catch {
      // Onleesbare kop telt als niet ingelogd.
    }
  }

  return new NextResponse("Inloggen vereist", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Pingwin intern", charset="UTF-8"' },
  });
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // ── Interne clusterpagina's: wachtwoord vóór alles ──
  // Staat bovenaan, zodat geen enkele andere regel eronderuit kan komen.
  if (path === INTERN_PAD || path.startsWith(INTERN_PAD + "/")) {
    return internToegang(req);
  }

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
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
    "/api/cron/:path*",
    "/share/cluster/onedayclinic/intern-9f3a2b",
    "/share/cluster/onedayclinic/intern-9f3a2b/:path*",
  ],
};
