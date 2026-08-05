import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { controleerLeesbaarheid } from "../../../../lib/site-controle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════
// KAN IK DEZE SITE ÜBERHAUPT LEZEN?
// ═══════════════════════════════════════════════════════════
// De eerste vraag bij elke controle, en met opzet een eigen antwoord. Sommige
// klantsites weigeren een kale leespoging met een 403. Zonder deze check zou de
// controle dan melden dat er niets op de site staat, terwijl de deur gewoon
// dichtzat, en dat is precies het soort onwaarheid waar een developer ten
// onrechte de schuld van krijgt.
//
// GET, dus ook bruikbaar in de alleen-lezen kijk-modus.
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug);
  if (!g.ok) return g.res;

  const client = await getClientBySlug(slug);
  if (!client) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  if (!client.domain) {
    return NextResponse.json({ ok: false, error: "Deze klant heeft nog geen website ingevuld." }, { status: 400 });
  }

  const { ok, ...rest } = await controleerLeesbaarheid(client.domain);
  // Twee verschillende vragen, dus twee velden: of de route slaagde (ok), en of
  // de site zich liet lezen (leesbaar). Die op één veld gooien maakt "de controle
  // ging mis" ononderscheidbaar van "de site zit dicht".
  return NextResponse.json({ ok: true, leesbaar: ok, ...rest });
}
