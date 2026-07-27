import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, makeAdminSession } from "../../../lib/admin-auth";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════
// ÉÉN-KLIK-INGANG (bookmark) VOOR DE EIGENAAR
// ═══════════════════════════════════════════════════════════
// Doel: als eigenaar binnenkomen zonder inlognaam/wachtwoord te typen.
// Bookmark simpelweg /admin/enter en je bent ingelogd als eigenaar.
//
// Beveiliging is optioneel en staat standaard UIT (bewuste keuze van de
// eigenaar: een open, klik-en-klaar link). Wil je 'm later toch privé maken,
// zet dan de env-variabele ADMIN_MAGIC_KEY in Vercel; dan werkt alleen nog
// /admin/enter?key=<die waarde>. Geen codewijziging nodig.
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  if (!process.env.SESSION_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Server niet geconfigureerd (SESSION_SECRET ontbreekt)." },
      { status: 500 },
    );
  }

  // Optioneel slot: alleen actief als ADMIN_MAGIC_KEY is gezet.
  const need = process.env.ADMIN_MAGIC_KEY;
  if (need) {
    const key = new URL(req.url).searchParams.get("key") || "";
    if (key !== need) {
      return NextResponse.json({ ok: false, error: "Ongeldige link." }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  url.pathname = "/admin";
  url.search = "";
  const res = NextResponse.redirect(url);
  res.cookies.set(ADMIN_COOKIE, makeAdminSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // een jaar; klik de bookmark opnieuw en hij is weer vers
  });
  return res;
}
