import { getSetting, setSetting } from "./settings";

// ═══════════════════════════════════════════════════════════
// HOE VER LIGT DEZE PLAATS VAN DIE ANDERE?
// ═══════════════════════════════════════════════════════════
// De keuzeladder sloeg trede 2 (de dichtstbijzijnde zusterpagina) over bij
// plaatspagina's, met het argument dat we niet kunnen aantonen dat iemand die
// naar Veldhoven zocht geholpen is op de pagina van een andere stad. Dat argument
// klopte alleen zolang we de afstand niet wisten. Nabijheid is geen mening, hij
// is op te vragen, en dan wordt het een meting in plaats van een aanname.
//
// De coördinaten komen van de PDOK Locatieserver: de open plaatsendienst van de
// Nederlandse overheid. Geen sleutel, geen kosten, geen limiet die ons raakt, en
// gezaghebbender dan welke lijst dan ook die we zelf zouden bijhouden. Elke
// plaats wordt één keer opgezocht en daarna bewaard, dus een tweede analyse doet
// geen enkele opvraag.
//
// Buiten Nederland levert dit niets op. Dat is geen storing maar een grens: komt
// er geen coördinaat terug, dan valt de ladder gewoon terug op de categorie
// erboven. Nooit een afstand verzinnen.
// ═══════════════════════════════════════════════════════════

export type Coord = { lat: number; lon: number; naam: string };

const sleutel = (plaats: string) =>
  `plaatscoord:${plaats.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;

/** Bewaarde uitkomst "deze plaats bestaat niet", zodat we niet elke keer opnieuw zoeken. */
const NIETS = "-";

async function zoekBijPdok(plaats: string): Promise<Coord | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    // De plaats komt soms als sleutel binnen ("den-haag"), zoals de plaatsanalyse
    // hem bewaart. De zoekdienst wil gewone woorden, dus streepjes worden spaties.
    const q = new URLSearchParams({
      q: plaats.replace(/-+/g, " ").trim(), fq: "type:woonplaats", rows: "1", fl: "weergavenaam,centroide_ll",
    });
    const res = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?${q}`, {
      signal: ctrl.signal, cache: "no-store", headers: { "User-Agent": "PingwinSeoDashboard/1.0 (+https://pingwin.nl)" },
    });
    if (!res.ok) return null;
    const d = await res.json().catch(() => null) as { response?: { docs?: { weergavenaam?: string; centroide_ll?: string }[] } } | null;
    const doc = d?.response?.docs?.[0];
    // De dienst geeft het punt als "POINT(5.4697 51.4416)": eerst lengte, dan breedte.
    const m = /POINT\(\s*([\d.\-]+)\s+([\d.\-]+)\s*\)/i.exec(doc?.centroide_ll || "");
    if (!m) return null;
    return { lon: Number(m[1]), lat: Number(m[2]), naam: doc?.weergavenaam || plaats };
  } catch { return null; } finally { clearTimeout(timer); }
}

/** De coördinaat van één plaats, uit de bewaarde stand of anders opgezocht. */
export async function coordVan(plaats: string): Promise<Coord | null> {
  const naam = (plaats || "").trim();
  if (naam.length < 3) return null;
  const k = sleutel(naam);
  const bewaard = await getSetting(k).catch(() => null);
  if (bewaard === NIETS) return null;
  if (bewaard) {
    try { return JSON.parse(bewaard) as Coord; } catch { /* stuk, opnieuw zoeken */ }
  }
  const gevonden = await zoekBijPdok(naam);
  await setSetting(k, gevonden ? JSON.stringify(gevonden) : NIETS).catch(() => { /* bewaren is bijvangst */ });
  return gevonden;
}

/** Meerdere plaatsen in één keer, met hooguit een handvol opvragen tegelijk. */
export async function coordenVan(plaatsen: string[]): Promise<Map<string, Coord>> {
  const uniek = [...new Set(plaatsen.map((p) => (p || "").trim()).filter((p) => p.length >= 3))];
  const uit = new Map<string, Coord>();
  for (let i = 0; i < uniek.length; i += 5) {
    const groep = uniek.slice(i, i + 5);
    const rij = await Promise.all(groep.map((p) => coordVan(p).catch(() => null)));
    groep.forEach((p, j) => { const c = rij[j]; if (c) uit.set(p.toLowerCase(), c); });
  }
  return uit;
}

/** Hemelsbrede afstand in kilometers. */
export function afstandKm(a: Coord, b: Coord): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/**
 * Tot hoe ver is een andere vestiging nog een redelijk antwoord voor iemand die
 * naar zíjn plaats zocht? Veertig kilometer hemelsbreed, en dat is een keuze met
 * een reden: binnen die straal is de rit naar de kliniek te doen zonder dat je
 * je afvraagt of er niet iets dichterbij is, en dat is precies de toets van de
 * ladder ("zou de bezoeker het gevoel hebben dat hij kreeg waarvoor hij kwam").
 * Daarboven is het geen vervanging meer maar een verwijzing, en dan hoort de
 * bezoeker op het locatie-overzicht zelf te kiezen.
 *
 * Koudekerke is het ijkpunt: die ligt op zestig kilometer van de dichtstbijzijnde
 * vestiging, en gaat daarom naar de hub in plaats van naar Rotterdam.
 */
export const MAX_KM = 40;
