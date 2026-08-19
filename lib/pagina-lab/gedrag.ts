import { ga4VoorPagina } from "../ga4-pagina";
import { clarityVoorPagina, clarityStand } from "../clarity";
import type { PaginaCijfers } from "../ga4-pagina";
import type { ClarityStand, PaginaGedrag } from "../clarity";

// ═══════════════════════════════════════════════════════════
// WAT BEZOEKERS OP ÉÉN PAGINA DEDEN, UIT BEIDE BRONNEN TEGELIJK
// ═══════════════════════════════════════════════════════════
// De derde poot van het Pagina-lab. De brug haalt de pagina op en fotografeert
// hem, de kennisbank zegt waar je naar kijkt, en dit zegt wat bezoekers er
// werkelijk deden. Zonder deze laag blijft elk oordeel een oordeel over hoe iets
// eruitziet, en niet over hoe het uitpakt.
//
// Twee bronnen, met opzet, want ze meten verschillende dingen:
//  - Analytics: hoeveel, hoe lang, hoe vaak weg, hoeveel conversies, per apparaat.
//  - Clarity: wrijving. Dode klikken, woedeklikken, terugspringen, scrolldiepte.
//
// DEZE LAAG LEEST ALLEEN. Hij haalt niets op bij Clarity (dat mag maar tien keer
// per dag, dus dat gebeurt bewust op één plek, bij de koppeling zelf) en hij
// schrijft niets weg. Het lab leest mee met alles wat er al is en laat het
// lopende SEO-werk met rust; `proeven/pagina-lab-schrijft-niet.proef.ts` rekent
// dat na.
// ═══════════════════════════════════════════════════════════

export type PaginaGedragUitkomst = {
  url: string;
  analytics: PaginaCijfers;
  clarity: { stand: ClarityStand; pagina: PaginaGedrag | null };
};

export async function gedragVoorPagina(slug: string, url: string, dagen = 28, domainHint = ""): Promise<PaginaGedragUitkomst> {
  const [analytics, stand, pagina] = await Promise.all([
    ga4VoorPagina(slug, url, dagen, domainHint),
    clarityStand(slug),
    clarityVoorPagina(slug, url).catch(() => null),
  ]);
  return { url, analytics, clarity: { stand, pagina } };
}
