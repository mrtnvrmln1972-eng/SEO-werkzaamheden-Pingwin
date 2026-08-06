import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { waitUntil } from "@vercel/functions";
import { draaiKlus, getKlus } from "../../../../lib/klussen";
import { getClientUrls } from "../../../../lib/site-urls";
import { getClientBySlug } from "../../../../lib/clients";
import { captureAndDetect } from "../../../../lib/content-tracking";

export const runtime = "nodejs";
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Scant alle live pagina's van een klant op inhoudelijke wijzigingen. De eerste
// keer legt hij de basislijn vast (geen wijzigingen); daarna detecteert hij
// verschillen en maakt change events aan.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Klant is verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  // Een meegegeven lijst wint: zo kan de navigatie-roadmap gericht de pagina's
  // meten die nog geen score hebben (die staan niet altijd in client_urls).
  // Altijd hard filteren op het domein van de klant; een lijst uit de browser
  // mag nooit een andere site laten scannen.
  const gevraagd = Array.isArray(body.urls) ? body.urls.map((u) => String(u || "").trim()).filter(Boolean) : [];
  let urls: string[];
  if (gevraagd.length) {
    const client = await getClientBySlug(slug);
    const host = (client?.domain || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    urls = gevraagd.filter((u) => { try { return !!host && new URL(u).host.replace(/^www\./, "") === host; } catch { return false; } }).slice(0, 50);
    if (!urls.length) return NextResponse.json({ ok: false, error: "Geen geldige pagina's van deze klant opgegeven." }, { status: 400 });
  } else {
    urls = (await getClientUrls(slug).catch(() => []))
      .filter((u) => u.status && u.status >= 200 && u.status < 300)
      .map((u) => u.url)
      .slice(0, 200);
  }

  // Tweehonderd pagina's uitlezen duurt minuten. Dat wacht de browser niet meer
  // af: de klus draait door op de server en de stand is overal zichtbaar.
  const lopend = await getKlus(slug, "wijzigingen-scan").catch(() => null);
  if (lopend?.status === "bezig") return NextResponse.json({ ok: true, alBezig: true });

  const POOL = 5;
  const blokken = Math.ceil(urls.length / POOL);
  waitUntil(draaiKlus(slug, "wijzigingen-scan", "Wijzigingen op de site zoeken", blokken, async (stap) => {
    let scanned = 0, changed = 0;
    for (let i = 0; i < urls.length; i += POOL) {
      const batch = urls.slice(i, i + POOL);
      const results = await Promise.all(batch.map((u) => captureAndDetect(slug, u).catch(() => ({ changed: false }))));
      scanned += batch.length;
      changed += results.filter((r) => r.changed).length;
      await stap(Math.floor(i / POOL) + 1, `${scanned} van de ${urls.length} pagina's nagekeken, ${changed} gewijzigd`);
    }
    return `${scanned} pagina's nagekeken, ${changed} gewijzigd.`;
  }));
  return NextResponse.json({ ok: true, gestart: true, totaal: urls.length });
}
