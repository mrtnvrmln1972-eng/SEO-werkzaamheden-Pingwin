// ═══════════════════════════════════════════════════════════
// DE TITEL VAN EEN PROJECTKAART
// ═══════════════════════════════════════════════════════════
// Eén vaste vorm: het pad, een puntje, en wat we met die pagina doen.
//
//   /hovenier/etten-leur/ · herstellen
//   /tuinontwerp/strandtuin/ · optimaliseren
//
// Waarom dit bestand er is: de titel groeide vanzelf vol. Er werd bij elke keer
// dat de planning geladen werd een nieuwe opdracht met " + " achter de titel
// geplakt, tot 190 tekens. De kaart van /hovenier/etten-leur/ stond op 6 augustus
// 2026 op 183 tekens en las als een alinea. Een titel is geen opdrachtenlijst;
// die opdrachten horen ín de kaart, niet in de kop.
//
// De regel is verder: wat je zelf typt blijft staan. Deze functies bepalen alleen
// hoe een AUTOMATISCHE titel eruitziet.

/** De vaste scheiding tussen het pad en het werkwoord. */
export const TITEL_SCHEIDING = " · ";

export type TitelPagina = { live?: boolean } | null | undefined;

/**
 * Wat doen we met deze pagina? Afgeleid uit wat er in de kaart staat, met de
 * stand van de pagina als terugval.
 *
 * De volgorde is de volgorde van dringendheid: een 404 herstellen is iets anders
 * dan optimaliseren, ook al staat de pagina technisch "live".
 */
export function werkwoordVoor(taak: string, page?: TitelPagina): string {
  const t = (taak || "").toLowerCase();
  if (/\b404\b|\bfix\b|herstel|kapot|niet bereikbaar|dode link/.test(t)) return "herstellen";
  if (/publiceer|publicatie|live zetten|online zetten/.test(t)) return "publiceren";
  if (/controleer|bevestig|\bcheck\b|verifieer|nakijken/.test(t)) return "controleren";
  // Dezelfde regel die de planning-regel al gebruikt: bestaat de pagina, dan
  // optimaliseer je hem; bestaat hij niet, dan maak je hem.
  return page?.live ? "optimaliseren" : "maken";
}

/** Het pad uit een volledige URL. Lukt dat niet, dan de URL zelf. */
export function padVan(url: string | null | undefined): string {
  if (!url) return "";
  try { return new URL(url).pathname; } catch { return url; }
}

/**
 * Staat deze titel al in de vaste vorm? Dit is de poort die voorkomt dat de
 * eenmalige opschoning bij élke keer laden opnieuw werk doet.
 */
export function isKorteTitel(taak: string): boolean {
  return /^\/\S*\s·\s\S+$/.test((taak || "").trim());
}

/**
 * De titel in de vaste vorm. Zonder pagina valt hij terug op de eerste zin van
 * de bestaande titel: dan is er geen pad om te tonen, en is een verzonnen
 * puntjesvorm alleen maar misleidend.
 */
export function korteTitel(taak: string, url: string | null | undefined, page?: TitelPagina): string {
  const pad = padVan(url) || padUitTitel(taak);
  if (!pad || pad.length < 2) return eersteOpdracht(taak);
  return `${pad}${TITEL_SCHEIDING}${werkwoordVoor(taak, page)}`;
}

/** Een pad dat vooraan in de titel staat, zoals "/hovenier/etten-leur/: fix 404". */
function padUitTitel(taak: string): string {
  const m = /^(\/[^\s:·]*)/.exec((taak || "").trim());
  return m ? m[1] : "";
}

/**
 * De eerste opdracht uit een volgeplakte titel, netjes afgekapt. Alleen als
 * terugval gebruikt: een kaart zonder pagina houdt gewoon zijn eigen woorden.
 */
export function eersteOpdracht(taak: string): string {
  const eerste = (taak || "").split(" + ")[0].replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (eerste.length <= 60) return eerste;
  const kort = eerste.slice(0, 60);
  const spatie = kort.lastIndexOf(" ");
  return (spatie > 30 ? kort.slice(0, spatie) : kort).trim() + "…";
}

/**
 * De losse opdrachten uit een volgeplakte titel, zodat ze in de kaart kunnen
 * landen in plaats van te verdwijnen. "Fix 404 ... + bevestig ... + controleer
 * ... (actie Sander)" wordt vier regels: drie opdrachten en de aantekening.
 *
 * De haakjes achteraan tellen apart mee. Daar stond bij Kamsteeg "(actie Sander)"
 * in, en dat is een aantekening, geen opdracht.
 */
export function opdrachtenUitTitel(taak: string): string[] {
  const heel = (taak || "").trim();
  if (!heel) return [];
  const uit: string[] = [];
  let romp = heel;
  const haakje = /\(([^)]*)\)\s*$/.exec(heel);
  if (haakje) {
    romp = heel.slice(0, haakje.index).trim();
    if (haakje[1].trim()) uit.push(haakje[1].trim());
  }
  for (const deel of romp.split(" + ")) {
    const d = deel.trim();
    if (d) uit.push(d.charAt(0).toUpperCase() + d.slice(1));
  }
  return uit;
}
