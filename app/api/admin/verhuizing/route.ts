import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";
import { telling, klantKaart, pakket } from "../../../../lib/verhuizing";
import { maakCode, trekIn, stand } from "../../../../lib/verhuis-code";

export const runtime = "nodejs";
export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════
// DE BEDIENING VAN DE VERHUIZING (het scherm /admin/verhuizen)
// ═══════════════════════════════════════════════════════════
// Twee kanten, hetzelfde scherm, want beide omgevingen draaien dezelfde code:
//  - ontvangen: een verhuiscode maken of intrekken;
//  - versturen: per soort gegevens een hap ophalen en doorsturen naar de andere
//    omgeving.
//
// Het versturen gebeurt in happen, aangestuurd vanuit het scherm. Dat is met
// opzet: één groot verzoek dat alles ineens doet loopt tegen de tijdslimiet van
// de server aan, en je ziet niet waar hij is. Nu telt het scherm mee.
//
// Waarom het doeladres beperkt is: deze route haalt op verzoek een andere server
// aan. Zonder grens zou dat een middel worden om vanaf deze server een
// willekeurig adres te benaderen. Alleen een Pingwin-omgeving mag.

const MAAT = 50;

function doelOk(doel: string): boolean {
  try {
    const u = new URL(doel);
    if (u.protocol !== "https:") return false;
    return u.hostname.endsWith(".vercel.app") || u.hostname === "pingwin.nl" || u.hostname.endsWith(".pingwin.nl");
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get("slug") || "").trim().toLowerCase();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (!g.scope.isOwner) return NextResponse.json({ ok: false, error: "Alleen de eigenaar mag verhuizen." }, { status: 403 });

  return NextResponse.json({
    ok: true,
    telling: await telling(slug),
    kaart: await klantKaart(slug),
    code: await stand(slug),
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  const slug = String(body.slug || "").trim().toLowerCase();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (!g.scope.isOwner) return NextResponse.json({ ok: false, error: "Alleen de eigenaar mag verhuizen." }, { status: 403 });

  if (body.actie === "code") {
    const code = await maakCode(slug);
    return NextResponse.json({ ok: true, code, stand: await stand(slug) });
  }
  if (body.actie === "intrekken") {
    await trekIn(slug);
    return NextResponse.json({ ok: true, stand: await stand(slug) });
  }

  if (body.actie === "stuur") {
    const doel = String(body.doel || "").trim().replace(/\/+$/, "");
    const code = String(body.code || "").trim();
    if (!doelOk(doel)) return NextResponse.json({ ok: false, error: "Geef het adres van de andere Pingwin-omgeving, beginnend met https://." }, { status: 400 });
    if (!code) return NextResponse.json({ ok: false, error: "Vul de verhuiscode in die de andere omgeving heeft gemaakt." }, { status: 400 });

    const tabel = String(body.tabel || "").trim();
    const na = Number(body.na) || 0;

    // Zonder soort: dit is de eerste stap, de klantkaart zelf.
    const lading = tabel
      ? await (async () => {
          const p = await pakket(slug, tabel, na, MAAT);
          return { deel: "tabel", tabel, kolommen: p.kolommen, rijen: p.rijen, vervang: na === 0, meer: p.meer };
        })()
      : { deel: "klant", kaart: await klantKaart(slug) };

    let antwoord: Response;
    try {
      antwoord = await fetch(`${doel}/api/verhuis-inlaad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lading, slug, code }),
      });
    } catch (e) {
      return NextResponse.json({ ok: false, error: "De andere omgeving is niet bereikbaar: " + ((e as Error).message || "") }, { status: 502 });
    }

    const uit = await antwoord.json().catch(() => null);
    if (!antwoord.ok || !uit?.ok) {
      return NextResponse.json({ ok: false, error: uit?.error || `De andere omgeving gaf een fout (${antwoord.status}).` }, { status: 502 });
    }
    const gestuurd = tabel ? ("rijen" in lading ? (lading.rijen as unknown[][]).length : 0) : 0;
    return NextResponse.json({
      ok: true,
      deel: lading.deel,
      tabel: tabel || null,
      gestuurd,
      meer: tabel ? Boolean((lading as { meer?: boolean }).meer) : false,
      volgende: tabel ? na + gestuurd : 0,
    });
  }

  return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
}
