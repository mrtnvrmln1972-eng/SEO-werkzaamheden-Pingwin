import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, getAdminPrincipal, makeViewAsToken } from "../../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../../lib/constants";
import { getTeamUserById } from "../../../../lib/team-users";

export const runtime = "nodejs";

// Kijk-als-modus: de eigenaar bekijkt het adminscherm tijdelijk exact zoals een
// gast het ziet. Bewust op het RUWE principal gecontroleerd (niet op de scope),
// zodat de eigenaar de modus ook weer kan verlaten terwijl hij "als gast" kijkt.

function isRealOwner(req: NextRequest): boolean {
  const principal = getAdminPrincipal(req.cookies.get(ADMIN_COOKIE)?.value);
  return principal?.kind === "owner";
}

export async function POST(req: NextRequest) {
  if (!isRealOwner(req)) {
    return NextResponse.json({ ok: false, error: "Alleen de eigenaar mag dit." }, { status: 403 });
  }
  let body: { id?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "Geen geldige gebruiker." }, { status: 400 });

  const user = await getTeamUserById(id);
  if (!user) return NextResponse.json({ ok: false, error: "Gebruiker niet gevonden." }, { status: 404 });

  const res = NextResponse.json({ ok: true, label: user.name || user.loginId });
  res.cookies.set(ADMIN_VIEWAS_COOKIE, makeViewAsToken(id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 4, // vier uur; daarna vervalt de kijk-als-modus vanzelf
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  if (!isRealOwner(req)) {
    return NextResponse.json({ ok: false, error: "Alleen de eigenaar mag dit." }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_VIEWAS_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
