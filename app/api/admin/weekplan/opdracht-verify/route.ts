import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { verifyOpdracht } from "../../../../../lib/opdracht-verify";

export const runtime = "nodejs";
export const maxDuration = 60;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// "Check live": her-fetcht de live pagina('s) die in de opdrachttekst worden
// genoemd en meldt of ze bereikbaar zijn. Zie lib/opdracht-verify.ts.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const taskId = Number(body.taskId || "");
  const tekst = String(body.tekst || "").trim();
  const url = String(body.url || "").trim();
  if (!slug || !taskId || !tekst) return NextResponse.json({ ok: false, error: "Klant, kaart en opdracht zijn verplicht." }, { status: 400 });
  const uitkomst = await verifyOpdracht(taskId, tekst, url);
  return NextResponse.json({ ok: true, gevonden: uitkomst.ok, melding: uitkomst.melding });
}
