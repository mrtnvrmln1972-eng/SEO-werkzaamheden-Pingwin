import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, makeAdminSession } from "../../../lib/admin-auth";

export const runtime = "nodejs";

// Vergelijken zonder dat de tijdsduur iets verraadt over hoeveel tekens er
// klopten. Bij een gewone === kun je een sleutel in theorie teken voor teken
// raden; bij een deur naar alle klantgegevens is dat de moeite van het
// voorkomen waard.
function veiligGelijk(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

// ═══════════════════════════════════════════════════════════
// ÉÉN-KLIK-INGANG (bookmark) VOOR DE EIGENAAR
// ═══════════════════════════════════════════════════════════
// Doel: als eigenaar binnenkomen zonder inlognaam/wachtwoord te typen.
// Bookmark /admin/enter?key=<ADMIN_MAGIC_KEY> en je bent ingelogd.
//
// LET OP, en dit is met opzet zo streng: dit slot stond eerst standaard UIT.
// Zonder ADMIN_MAGIC_KEY deelde deze route aan ELKE bezoeker een volledige
// adminsessie van een jaar uit, en het adres staat in een openbare repo. Dat is
// op 02-08-2026 live aangetroffen en meteen dichtgezet.
//
// Daarom nu andersom: geen sleutel ingesteld = deur dicht. Een nieuwe wereld die
// deze code overneemt staat dus veilig vanaf de eerste deploy, ook als niemand
// eraan denkt om iets in te stellen. Beveiliging hoort nooit iets te zijn dat je
// aan moet zetten.
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  if (!process.env.SESSION_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Server niet geconfigureerd (SESSION_SECRET ontbreekt)." },
      { status: 500 },
    );
  }

  // Verplicht slot. Niet ingesteld? Dan bestaat deze ingang simpelweg niet.
  // Bewust dezelfde melding als bij een verkeerde sleutel: een buitenstaander
  // hoort niet te kunnen zien of de ingang wel of niet geconfigureerd is.
  const need = process.env.ADMIN_MAGIC_KEY || "";
  const key = new URL(req.url).searchParams.get("key") || "";
  if (!need || !veiligGelijk(key, need)) {
    return NextResponse.json({ ok: false, error: "Ongeldige link." }, { status: 401 });
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
