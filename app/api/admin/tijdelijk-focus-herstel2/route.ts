import { NextRequest, NextResponse } from "next/server";
import { saveFocus } from "../../../../lib/focus";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════
// EENMALIG HERSTEL (2) — Zoekwoorden & links, Paul Hoevenaars (14-08-2026)
// ═══════════════════════════════════════════════════════════
// Zie tijdelijk-focus-herstel (verwijderd na eerste gebruik). Nodig omdat een
// open browsertab bij Maarten zijn eigen, nog kapotte versie er direct weer
// overheen sloeg zodra hij erin klikte. Wordt na gebruik weer verwijderd.

const SLEUTEL = "9kQx2vLpN7wZrT4mYbH8sJfD6cAeU1oGiXnRk3tWzC5";
const SLUG = "paul-hoevenaars";

export async function POST(req: NextRequest) {
  const sleutel = req.nextUrl.searchParams.get("sleutel");
  if (sleutel !== SLEUTEL) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Geen body." }, { status: 400 }); }
  if (typeof body.html !== "string" || !body.html.trim()) return NextResponse.json({ ok: false, error: "Geen html." }, { status: 400 });
  const focus = await saveFocus(SLUG, { html: body.html });
  return NextResponse.json({ ok: true, lengte: focus.html.length });
}
