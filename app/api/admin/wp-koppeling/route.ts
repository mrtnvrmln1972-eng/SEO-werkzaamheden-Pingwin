import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";
import { getWpStatus, saveWpCredentials } from "../../../../lib/wp-push";

export const runtime = "nodejs";

// WordPress-koppeling per klant (voor 'Doorvoeren op de site').
// GET ?slug= : is er een koppeling en met welke gebruikersnaam.
// POST {slug, username, appPassword} : koppeling opslaan (wachtwoord versleuteld).
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const status = await getWpStatus(slug);
  return NextResponse.json({ ok: true, ...status });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { slug?: string; username?: string; appPassword?: string };
  const slug = (body.slug || "").trim();
  const username = (body.username || "").trim();
  const appPassword = (body.appPassword || "").trim();
  if (!slug || !username || !appPassword) return NextResponse.json({ ok: false, error: "Vul de gebruikersnaam en het applicatie-wachtwoord in." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  await saveWpCredentials(slug, username, appPassword);
  return NextResponse.json({ ok: true });
}
