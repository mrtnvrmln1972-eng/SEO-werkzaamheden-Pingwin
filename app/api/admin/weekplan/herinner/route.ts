import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getWeekplan } from "../../../../../lib/weekplan";
import { planOpvolging } from "../../../../../lib/mail-opvolg";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════
// HERINNER ME OVER X DAGEN OM TE CHECKEN
// ═══════════════════════════════════════════════════════════
// Hetzelfde "herinner me"-mechanisme dat al bestond bij het doorzetten naar de
// developer (lib/mail-opvolg.ts), maar dan los daarvan bereikbaar: bij elke
// taak in het overzicht, niet alleen op het moment dat je hem wegzet. Op de
// afgesproken dag verschijnt een melding bij het belletje in de kopbalk.
function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

function zonderHtml(s: string): string {
  return (s || "").replace(/<[^>]*>/g, "").trim();
}

export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const id = Number(body.id || 0);
  const dagen = Number(body.dagen || 0);
  if (!slug || !id) return NextResponse.json({ ok: false, error: "Klant en kaart zijn verplicht." }, { status: 400 });
  if (!dagen || dagen < 1) return NextResponse.json({ ok: false, error: "Aantal dagen is verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const kaart = (await getWeekplan(slug)).find((k) => k.id === id);
  if (!kaart) return NextResponse.json({ ok: false, error: "Kaart niet gevonden." }, { status: 404 });

  const onderwerp = zonderHtml(kaart.taak);
  await planOpvolging({
    clientSlug: slug, taak: onderwerp, onderwerp,
    url: kaart.url || undefined, dagen, soort: "taak",
  });

  return NextResponse.json({ ok: true });
}
