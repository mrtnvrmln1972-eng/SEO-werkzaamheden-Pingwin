import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { msSearchPeople, msPeopleDebug, msStatus } from "../../../../../lib/ms-graph";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Contactpersonen-suggesties uit het M365-account voor de mail-autocomplete.
// BEWUST afgeschermd met MAIL_PEOPLE_SUGGEST: deze feature hoort alleen in het
// Pingwin-dashboard (Maartens eigen mailcontacten), niet in de NOC-omgeving waar
// collega's werken. Zet de env-var UITSLUITEND op het Pingwin-project.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  // Diagnose (?debug=1): laat zien of de env-var aanstaat, of M365 gekoppeld is en wat
  // Graph teruggeeft. Alleen voor de admin; helpt bij "autocomplete blijft leeg".
  if (req.nextUrl.searchParams.get("debug") === "1") {
    const q = (req.nextUrl.searchParams.get("q") || "a").trim();
    return NextResponse.json({
      ok: true,
      envEnabled: process.env.MAIL_PEOPLE_SUGGEST === "true",
      ms: await msStatus().catch(() => null),
      diag: await msPeopleDebug(q).catch((e) => ({ error: String(e) })),
    });
  }
  if (process.env.MAIL_PEOPLE_SUGGEST !== "true") return NextResponse.json({ ok: true, people: [] });
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ ok: true, people: [] });
  const people = await msSearchPeople(q, 8).catch(() => null);
  return NextResponse.json({ ok: true, people: people || [] });
}
