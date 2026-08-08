import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { haalGeleerdeRegels, zetGeleerdeRegel, type Motor } from "../../../../lib/geleerde-regels";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

const MOTOREN: Motor[] = ["meta", "interne_links", "prioriteiten", "opruim"];

// GET ?slug=&motor= : de geleerde regels van deze klant (optioneel op één motor
// gefilterd). Dit is de gedeelde tabel achter elke motor die corrigeerbaar is;
// vandaag alleen de meta-motor, zie lib/geleerde-regels.ts.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const motorParam = req.nextUrl.searchParams.get("motor") || "";
  const motor = (MOTOREN as string[]).includes(motorParam) ? (motorParam as Motor) : undefined;
  const regels = await haalGeleerdeRegels(slug, motor);
  return NextResponse.json({ ok: true, regels });
}

// PATCH {slug, motor, sleutel, actief?, waarom?} : een regel terugdraaien (of
// weer aanzetten), en/of de reden bijwerken.
export async function PATCH(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { slug?: string; motor?: string; sleutel?: string; actief?: boolean; waarom?: string };
  const slug = (body.slug || "").trim();
  const motor = body.motor || "";
  const sleutel = (body.sleutel || "").trim();
  if (!slug || !(MOTOREN as string[]).includes(motor) || !sleutel) {
    return NextResponse.json({ ok: false, error: "Klant, motor en sleutel zijn verplicht." }, { status: 400 });
  }
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  await zetGeleerdeRegel(slug, motor as Motor, sleutel, { actief: body.actief, waarom: body.waarom });
  return NextResponse.json({ ok: true });
}
