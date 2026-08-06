import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { getClientUrls, scanClientUrls } from "../../../../lib/site-urls";
import { sql } from "../../../../lib/db";
import { waitUntil } from "@vercel/functions";
import { draaiKlus, getKlus } from "../../../../lib/klussen";

export const runtime = "nodejs";
export const maxDuration = 800;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET: de URL-lijst (spiegel + plan-alinea) van een klant.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, urls: await getClientUrls(slug) });
}

// POST: scan de live site opnieuw (ververst de spiegel).
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g2 = await guardSlug(req, slug); if (!g2.ok) return g2.res;
  const client = await getClientBySlug(slug);
  if (!client) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  // Website-domein instellen of bijwerken als het is meegegeven. Dit is de plek
  // waar je het website-adres van een klant zet; er is verder geen apart UI-veld
  // voor. Kaal opslaan (zonder https:// of www) zodat de sitemap-scan én GSC de
  // juiste site vinden.
  const domainInput = String(body.domain || "").trim();
  let domain = client.domain || "";
  if (domainInput) {
    domain = domainInput.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();
    await sql`UPDATE clients SET domain = ${domain} WHERE slug = ${slug}`;
  }
  if (!domain) return NextResponse.json({ ok: false, error: "Deze klant heeft nog geen domein ingesteld." }, { status: 400 });
  // Vroeger wachtte de browser hier tot 445 pagina's ingelezen waren. Klikte je
  // weg, dan was het molentje weg en kon je nergens meer zien of hij nog liep.
  // Nu start de klus en komt het antwoord meteen terug; de voortgang staat in de
  // database en is op elk tabblad zichtbaar.
  const lopend = await getKlus(slug, "site-inlezen").catch(() => null);
  if (lopend?.status === "bezig") return NextResponse.json({ ok: true, alBezig: true });

  waitUntil(draaiKlus(slug, "site-inlezen", "De site inlezen", 2, async (stap) => {
    await stap(1, "De sitemap van de site ophalen en de pagina's nalopen");
    const res = await scanClientUrls(slug, domain);
    await stap(2, `${res.scanned} pagina's ingelezen`);
    return `${res.scanned} pagina's ingelezen.`;
  }));
  return NextResponse.json({ ok: true, gestart: true });
}
