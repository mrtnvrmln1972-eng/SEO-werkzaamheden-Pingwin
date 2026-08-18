import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { getSetting, setSetting, SETTING_GOOGLE_ACCOUNT, SETTING_GMB_UITNODIGING } from "../../../../../lib/settings";
import { vensterPoort } from "../../../../../lib/klantvenster";

export const runtime = "nodejs";

// De twee instellingen achter de beheer-uitnodiging: met welk Google-adres we
// toegang vragen, en met welke tekst. Eén keer instellen voor heel Pingwin, niet
// per klant: het adres is hetzelfde en de tekst hoort dat ook te zijn.
export async function GET(req: NextRequest) {
  const weg = vensterPoort(); if (weg) return weg;
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const [adres, sjabloon] = await Promise.all([
    getSetting(SETTING_GOOGLE_ACCOUNT).catch(() => null),
    getSetting(SETTING_GMB_UITNODIGING).catch(() => null),
  ]);
  return NextResponse.json({ ok: true, googleAdres: adres || "", sjabloon: sjabloon || "" });
}

export async function POST(req: NextRequest) {
  const weg = vensterPoort(); if (weg) return weg;
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  if (typeof body.googleAdres === "string") {
    const a = body.googleAdres.trim();
    if (a && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a)) {
      return NextResponse.json({ ok: false, error: "Dat lijkt geen geldig e-mailadres." }, { status: 400 });
    }
    await setSetting(SETTING_GOOGLE_ACCOUNT, a || null);
  }
  // Een leeg sjabloon is geldig: dan valt hij terug op de standaardtekst.
  if (typeof body.sjabloon === "string") {
    await setSetting(SETTING_GMB_UITNODIGING, body.sjabloon.trim() || null);
  }
  return NextResponse.json({ ok: true });
}
