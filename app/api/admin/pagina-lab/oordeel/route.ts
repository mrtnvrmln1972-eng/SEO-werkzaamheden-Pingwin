import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { anthropicConfigured } from "../../../../../lib/anthropic";
import { getClientBySlug } from "../../../../../lib/clients";
import { vensterPoort } from "../../../../../lib/klantvenster";
import { waaromNiet } from "../../../../../lib/pagina-lab/bron";
import { gedragVoorPagina } from "../../../../../lib/pagina-lab/gedrag";
import { neemPaginaOp } from "../../../../../lib/pagina-lab/meting";
import { beoordeelPagina } from "../../../../../lib/pagina-lab/oordeel";
import type { PaginaGedragUitkomst } from "../../../../../lib/pagina-lab/gedrag";

export const runtime = "nodejs";
// Twee volledige paginabezoeken met een echte browser (desktop en mobiel) plus
// de beoordeling zelf. Op een koude server kost alleen het starten van de browser
// al seconden; de eerste echte meting van een homepage zat rond de twee minuten.
export const maxDuration = 300;

// ═══════════════════════════════════════════════════════════
// HET OORDEEL OVER ÉÉN PAGINA
// ═══════════════════════════════════════════════════════════
// De drie lagen van het lab achter elkaar, in één verzoek:
//
//   1. De pagina bezoeken op desktop: lezen, meten, fotograferen (eerste scherm
//      én de hele pagina).
//   2. Hetzelfde op een telefoonscherm, want dat is waar de meeste bezoekers
//      zitten en waar het beeld het meest verschilt.
//   3. Als de klant bekend is: erbij halen wat bezoekers er werkelijk deden.
//
// Daarna gaan de criteria, de meting en de foto's samen naar de beoordeling, en
// komt er per criterium één bevinding terug.
//
// LET OP: er wordt niets bewaard. Het lab leest mee en schrijft niets, dus elke
// beoordeling is een nieuwe. Dat is een bewuste grens tot Maarten zegt dat het
// lab naar binnen mag; `proeven/pagina-lab-schrijft-niet.proef.ts` bewaakt hem.
// ═══════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  // Deze route haalt een willekeurig adres op. Dat hoort niet te kunnen achter
  // een voordeur die met iemand van buiten gedeeld wordt.
  const weg = vensterPoort();
  if (weg) return weg;
  if (!anthropicConfigured()) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY ontbreekt, dus er kan niets beoordeeld worden." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const url = String(body.url || "").trim();
  const slug = String(body.slug || "").trim();
  if (!url) return NextResponse.json({ ok: false, error: "Geef het volledige webadres van de pagina op." }, { status: 400 });
  const fout = await waaromNiet(url);
  if (fout) return NextResponse.json({ ok: false, error: fout }, { status: 400 });

  try {
    const desktop = await neemPaginaOp(url, "desktop", true);
    if (!desktop) {
      return NextResponse.json({ ok: false, error: "De browser kon niet starten op deze server, dus er is niets om naar te kijken." }, { status: 500 });
    }
    // Mislukt de mobiele opname, dan gaat de beoordeling gewoon door met alleen
    // desktop. Een half oordeel met de reden erbij is meer waard dan een foutmelding.
    const mobiel = await neemPaginaOp(url, "mobiel", false).catch(() => null);

    let gedrag: PaginaGedragUitkomst | null = null;
    if (slug) {
      const klant = await getClientBySlug(slug);
      gedrag = await gedragVoorPagina(slug, url, 28, klant?.domain || "").catch(() => null);
    }

    const oordeel = await beoordeelPagina(desktop, mobiel, gedrag, slug || undefined);

    return NextResponse.json({
      ok: true,
      oordeel,
      // De foto's gaan mee terug, want het oordeel hoort naast het beeld te staan
      // waar het op gebaseerd is. Anders kijkt Maarten naar een oordeel over een
      // pagina die intussen alweer iets anders kan tonen.
      fotos: {
        desktop: `data:image/jpeg;base64,${desktop.eersteScherm}`,
        desktopHeel: desktop.helePagina ? `data:image/jpeg;base64,${desktop.helePagina}` : null,
        mobiel: mobiel ? `data:image/jpeg;base64,${mobiel.eersteScherm}` : null,
        afgekapt: desktop.paginaHoogte > 6000,
      },
      metingen: { desktop: desktop.meting, mobiel: mobiel ? mobiel.meting : [] },
      pagina: {
        eindUrl: desktop.bron.eindUrl,
        status: desktop.bron.status,
        titel: desktop.bron.titel,
        woorden: desktop.bron.woorden,
        hoogte: desktop.paginaHoogte,
        mobielGelukt: !!mobiel,
      },
      gedrag,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "Het beoordelen mislukte." }, { status: 502 });
  }
}
