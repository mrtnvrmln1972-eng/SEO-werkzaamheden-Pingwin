import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../../lib/clients";
import { validateAction, executeAction } from "../../../../../lib/overview-actions";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Voert een actie direct uit vanaf een werkplan-kaart-knop (Ontwikkel/Meta/Alt-teksten).
// De klik ís de menselijke goedkeuring. Hergebruikt dezelfde validatie + uitvoering
// als de bird's eye-acties.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  const id = `w${Date.now().toString(36)}`;
  const raw: Record<string, unknown> = { type: body.type, url: body.url, steps: body.steps, keyword: body.keyword };
  const action = validateAction(raw, domain, id);
  if (!action) return NextResponse.json({ ok: false, error: "Onbekende of onvolledige actie." }, { status: 400 });
  const result = await executeAction(slug, action);
  return NextResponse.json({ ok: result.ok, result });
}
