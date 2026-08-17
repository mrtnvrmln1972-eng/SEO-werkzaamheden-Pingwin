import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getFocusHistorie, saveFocus } from "../../../../lib/focus";

// ═══════════════════════════════════════════════════════════
// EERDERE VERSIES VAN EEN TEKSTVELD TERUGZETTEN
// ═══════════════════════════════════════════════════════════
// GET  ?slug=...            de bewaarde versies (nieuwste eerst)
// POST { slug, id }         die bewaarde versie terugzetten
// POST { slug, veld, html } een zelf aangeleverde versie terugzetten
//
// Nodig geworden op 11 augustus 2026: het veld "Zoekwoorden & links" had geen
// enkele geschiedenis, dus toen een sleepfout inhoud buiten het tekstvak zette
// en de automatische opslag dat wegschreef, was er geen weg terug.

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, versies: await getFocusHistorie(slug) });
}

export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  // Twee manieren binnen: een bewaarde versie bij id (die vervangt het veld),
  // of zelf aangeleverde HTML. Die tweede wordt er bewust BOVENOP gezet in
  // plaats van eroverheen: bedoeld voor inhoud die verdween voordat er versies
  // bewaard werden, en dan mag de handeling zelf nooit iets kunnen wissen.
  // De drie tekstvelden die deze rij delen. Eén lijst, zodat een vierde veld hier
  // niet stilletjes op "html" terechtkomt en de verkeerde inhoud overschrijft.
  const VELDEN = ["html", "prioHtml", "koersHtml"] as const;
  type Veld = (typeof VELDEN)[number];
  const leesVeld = (v: unknown): Veld => (VELDEN as readonly string[]).includes(String(v)) ? (v as Veld) : "html";
  let veld: Veld = leesVeld(body.veld);
  let html: string | null = null;

  if (body.id !== undefined) {
    const id = Number(body.id);
    const versie = (await getFocusHistorie(slug)).find((v) => v.id === id);
    if (!versie) return NextResponse.json({ ok: false, error: "Die versie bestaat niet meer." }, { status: 404 });
    veld = leesVeld(versie.veld);
    html = versie.html;
  } else if (typeof body.html === "string" && body.html.trim()) {
    const { getFocus } = await import("../../../../lib/focus");
    const nu = await getFocus(slug);
    const bestaand = nu[veld];
    html = `${body.html}${bestaand ? `<p><br></p>${bestaand}` : ""}`;
  }

  if (html === null) return NextResponse.json({ ok: false, error: "Niets om terug te zetten." }, { status: 400 });
  // Terugzetten loopt via saveFocus, dus de huidige inhoud gaat zelf ook weer de
  // geschiedenis in: een verkeerd gekozen herstelpunt is óók terug te draaien.
  const focus = await saveFocus(slug, { [veld]: html });
  return NextResponse.json({ ok: true, focus });
}
