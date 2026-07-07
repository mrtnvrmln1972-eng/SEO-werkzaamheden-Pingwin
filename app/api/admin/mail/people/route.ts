import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { msSearchPeople } from "../../../../../lib/ms-graph";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Tolerante lezing: true/1/yes/ja/on (hoofdletters en spaties maken niet uit).
function peopleEnabled(): boolean {
  return ["true", "1", "yes", "ja", "on"].includes((process.env.MAIL_PEOPLE_SUGGEST || "").trim().toLowerCase());
}

// Contactpersonen-suggesties uit het M365-account voor de mail-autocomplete.
// BEWUST afgeschermd met MAIL_PEOPLE_SUGGEST: deze feature hoort alleen in het
// Pingwin-dashboard (Maartens eigen mailcontacten), niet in de NOC-omgeving waar
// collega's werken. Zet de env-var UITSLUITEND op het Pingwin-project.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!peopleEnabled()) return NextResponse.json({ ok: true, people: [] });
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ ok: true, people: [] });
  const people = await msSearchPeople(q, 8).catch(() => null);
  return NextResponse.json({ ok: true, people: people || [] });
}
