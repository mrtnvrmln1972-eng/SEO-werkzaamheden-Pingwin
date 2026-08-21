import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { bewaarKoppeling, wpKoppelingStand } from "../../../../lib/wp-creds";

export const runtime = "nodejs";
// Bewaren gaat langs een test bij WordPress zelf; dat mag even duren.
export const maxDuration = 60;

// WordPress-koppeling per klant (voor 'Doorvoeren op de site').
// GET ?slug= : is er een koppeling en met welke gebruikersnaam.
// POST {slug, username, appPassword} : koppeling opslaan (versleuteld, ná een test).
//
// De opslag zit in lib/wp-creds.ts, samen met die van /api/admin/wp-creds. Tot
// 21-08-2026 waren dat twee verschillende opslagen voor hetzelfde wachtwoord, en
// die liepen uit elkaar: het ene scherm meldde "gekoppeld" terwijl het andere
// "de site weigert de koppeling" gaf. Zie de uitleg bovenaan wp-creds.ts.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const status = await wpKoppelingStand(slug);
  return NextResponse.json({ ok: true, ...status });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { slug?: string; username?: string; appPassword?: string };
  const slug = (body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const client = await getClientBySlug(slug);
  const uit = await bewaarKoppeling(slug, client?.domain || "", body.username || "", body.appPassword || "");
  return uit.ok ? NextResponse.json({ ok: true }) : NextResponse.json(uit, { status: 400 });
}
