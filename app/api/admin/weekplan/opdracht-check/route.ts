import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getOpdrachtMarks, setOpdrachtMark } from "../../../../../lib/opdracht-marks";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// De opgeslagen status van elke opdrachtregel op deze kaart (voor het laden
// van de kaart); zie lib/opdracht-marks.ts.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const slug = String(searchParams.get("slug") || "").trim();
  const taskId = Number(searchParams.get("taskId") || "");
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (!slug || !taskId) return NextResponse.json({ ok: false, error: "Klant en kaart zijn verplicht." }, { status: 400 });
  const marks = await getOpdrachtMarks(taskId);
  return NextResponse.json({ ok: true, marks });
}

// Zelf een opdrachtregel afvinken (of terugzetten): "ik heb dit gecontroleerd",
// bijvoorbeeld na een instructie die alleen per mail naar de developer kon,
// niet automatisch op de site te meten. Wint van de automatische stand.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const taskId = Number(body.taskId || "");
  const tekst = String(body.tekst || "").trim();
  const af = body.status === "handmatig";
  if (!slug || !taskId || !tekst) return NextResponse.json({ ok: false, error: "Klant, kaart en opdracht zijn verplicht." }, { status: 400 });
  await setOpdrachtMark(taskId, tekst, af ? "handmatig" : "open");
  return NextResponse.json({ ok: true });
}
