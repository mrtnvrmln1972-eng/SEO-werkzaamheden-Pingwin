import { HOOFDSTUKKEN, type Uitklapper } from "./uitleg";
import { mdToHtml } from "./markdown";

// ═══════════════════════════════════════════════════════════
// DE VOLLEDIGE BESCHRIJVING VAN EEN ONTWIKKELPUNT
// ═══════════════════════════════════════════════════════════
// De beschrijvingen staan in lib/uitleg/15-agenda/, in het interne hoofdstuk "Eerlijke
// agenda en routekaart". Dat blijft de enige plek waar ze staan; dit haalt ze
// daar alleen vandaan zodat de routekaart ze op het scherm zelf kan tonen.
//
// Waarom: de routekaart linkte naar /uitleg#agenda, en dan sta je in een lang
// document zelf te zoeken naar het punt waar je net op klikte. Twee schermen
// voor hetzelfde punt terwijl je maar één ding wilde weten: wat is de bedoeling.
// Eén bron, twee vensters, geen tweede kopie van de tekst.
// ═══════════════════════════════════════════════════════════

const AGENDA_ID = "agenda";

/** Loopt uitklappers en hun sub-uitklappers af, plat. */
function alleUitklappers(lijst: Uitklapper[]): Uitklapper[] {
  return lijst.flatMap((u) => [u, ...(u.sub ? alleUitklappers(u.sub) : [])]);
}

/**
 * De beschrijving van één punt als HTML, of null als het punt (nog) geen
 * uitklapper heeft. Null is geen fout: een nieuw punt in `lib/routekaart.ts`
 * kan er eerder zijn dan zijn beschrijving.
 */
export function beschrijvingVoor(code: string): string | null {
  const agenda = HOOFDSTUKKEN.find((h) => h.id === AGENDA_ID);
  if (!agenda) return null;
  // "R1. Autoriteit per pagina aansluiten" hoort bij R1, "R10. ..." niet ook.
  const kop = code + ".";
  const punt = alleUitklappers(agenda.uitklappers).find((u) => u.titel.startsWith(kop));
  if (!punt) return null;
  return mdToHtml(punt.tekst);
}

/** Alle beschrijvingen in één keer, als map code → HTML. */
export function beschrijvingen(codes: string[]): Record<string, string> {
  const uit: Record<string, string> = {};
  for (const c of codes) {
    const html = beschrijvingVoor(c);
    if (html) uit[c] = html;
  }
  return uit;
}
