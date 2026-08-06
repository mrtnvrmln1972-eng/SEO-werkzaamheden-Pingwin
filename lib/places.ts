// ═══════════════════════════════════════════════════════════
// DE MEETDEUR: GOOGLE PLACES (MAPS)
// ═══════════════════════════════════════════════════════════
// Waarom deze deur bestaat naast de beheerdeur (lib/gbp.ts): dit is de enige
// manier om een Google-bedrijfsprofiel te meten zónder beheerder te zijn. Dat
// betekent twee dingen die de beheerdeur nooit kan:
//
// 1. Het werkt meteen. Alleen een sleutel, geen goedkeuringstraject bij Google.
// 2. Het werkt voor de CONCURRENTEN van de klant, en dat is precies waar de
//    waarde zit: "42 reviews" zegt niets, "42 tegenover 180" is een gesprek.
//
// Wat deze deur NIET geeft: bezoekcijfers, posts, vragen, de volledige
// reviewlijst en het kunnen wijzigen van het profiel. Dat zit in lib/gbp.ts.
//
// Env-var (Vercel): GOOGLE_MAPS_API_KEY. Zonder die sleutel meet dit niets en
// zegt het scherm dat eerlijk, in plaats van een leeg resultaat te tonen.
// Kosten: de velden die we opvragen vallen in de duurste staffel (ongeveer twee
// cent per opvraging), met een gratis marge per maand die we met een handvol
// klanten en hun concurrenten niet halen. Daarom is er ook een cache van een
// dag: twee keer hetzelfde scherm openen mag nooit twee keer kosten.
// ═══════════════════════════════════════════════════════════

const BASE = "https://places.googleapis.com/v1";

// Alleen wat we echt gebruiken: het veldmasker bepaalt de prijs én de snelheid.
const DETAIL_FIELDS = [
  "id", "displayName", "formattedAddress", "addressComponents", "location",
  "nationalPhoneNumber", "internationalPhoneNumber", "websiteUri", "googleMapsUri",
  "rating", "userRatingCount", "reviews",
  "regularOpeningHours", "currentOpeningHours", "businessStatus",
  "primaryType", "primaryTypeDisplayName", "types", "photos", "editorialSummary",
].join(",");

const ZOEK_FIELDS = [
  "places.id", "places.displayName", "places.formattedAddress",
  "places.rating", "places.userRatingCount", "places.googleMapsUri",
  "places.businessStatus", "places.primaryTypeDisplayName", "places.websiteUri",
].join(",");

export function placesConfigured(): boolean {
  return !!(process.env.GOOGLE_MAPS_API_KEY || "").trim();
}

export type PlaatsReview = {
  sterren: number;
  tekst: string;
  auteur: string;
  wanneer: string;      // ISO, leeg als Google het niet geeft
  wanneerTekst: string; // "3 weken geleden", zoals Google het zelf zegt
  beantwoord: boolean;  // via deze deur nooit te zien; blijft false (zie gbp.ts)
};

export type PlaatsProfiel = {
  placeId: string;
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  telefoon: string;
  website: string;
  mapsUrl: string;
  gemiddelde: number | null;
  aantalReviews: number;
  reviews: PlaatsReview[];
  openingstijden: string[];  // per dag, zoals Google ze teruggeeft
  status: string;            // OPERATIONAL / CLOSED_TEMPORARILY / CLOSED_PERMANENTLY
  hoofdcategorie: string;
  categorieen: string[];
  aantalFotos: number;
  omschrijving: string;
  gemetenOp: string;
};

export type ZoekTreffer = {
  placeId: string;
  naam: string;
  adres: string;
  gemiddelde: number | null;
  aantalReviews: number;
  mapsUrl: string;
  status: string;
  categorie: string;
  website: string;
};

// ── Een dag cache in het geheugen van de instantie ──
// Een bedrijfsprofiel verandert niet per uur, en elke opvraging kost geld. Dit
// is bewust geen databasetabel: de scan bewaart zijn eigen uitkomst al, dit
// vangt alleen het dubbel opvragen binnen één werksessie af.
const CACHE_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { tijd: number; data: unknown }>();

function uitCache<T>(sleutel: string): T | null {
  const c = cache.get(sleutel);
  if (!c || Date.now() - c.tijd > CACHE_MS) return null;
  return c.data as T;
}
function inCache(sleutel: string, data: unknown): void {
  // Ruim opgeruimd houden: de cache mag nooit ongelimiteerd groeien in een
  // instantie die dagen blijft leven.
  if (cache.size > 500) cache.clear();
  cache.set(sleutel, { tijd: Date.now(), data });
}

async function haal(url: string, fieldMask: string, body?: unknown): Promise<Record<string, unknown> | null> {
  const key = (process.env.GOOGLE_MAPS_API_KEY || "").trim();
  if (!key) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": fieldMask,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tekst(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v.text === "string") return v.text;
  return "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adresDeel(comps: any[], type: string): string {
  const c = (comps || []).find((x) => Array.isArray(x?.types) && x.types.includes(type));
  return c ? String(c.longText || c.shortText || "") : "";
}

/**
 * Zoek een bedrijf op naam plus plaats. Geeft de kandidaten terug zodat een
 * mens kiest; automatisch de eerste treffer nemen is precies hoe je het profiel
 * van een naamgenoot aan een klant koppelt.
 */
export async function zoekProfiel(vraag: string, max = 5): Promise<ZoekTreffer[]> {
  const v = (vraag || "").trim();
  if (!v || !placesConfigured()) return [];
  const sleutel = `zoek:${v.toLowerCase()}:${max}`;
  const c = uitCache<ZoekTreffer[]>(sleutel);
  if (c) return c;

  const data = await haal(`${BASE}/places:searchText`, ZOEK_FIELDS, {
    textQuery: v,
    languageCode: "nl",
    regionCode: "NL",
    maxResultCount: Math.min(Math.max(max, 1), 20),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rijen: any[] = Array.isArray(data?.places) ? (data!.places as any[]) : [];
  const uit: ZoekTreffer[] = rijen.map((p) => ({
    placeId: String(p.id || ""),
    naam: tekst(p.displayName),
    adres: String(p.formattedAddress || ""),
    gemiddelde: typeof p.rating === "number" ? p.rating : null,
    aantalReviews: Number(p.userRatingCount || 0),
    mapsUrl: String(p.googleMapsUri || ""),
    status: String(p.businessStatus || ""),
    categorie: tekst(p.primaryTypeDisplayName),
    website: String(p.websiteUri || ""),
  })).filter((p) => p.placeId);
  inCache(sleutel, uit);
  return uit;
}

/** Het volledige profiel bij een place-id. */
export async function haalProfiel(placeId: string): Promise<PlaatsProfiel | null> {
  const id = (placeId || "").trim();
  if (!id || !placesConfigured()) return null;
  const sleutel = `detail:${id}`;
  const c = uitCache<PlaatsProfiel>(sleutel);
  if (c) return c;

  const p = await haal(`${BASE}/places/${encodeURIComponent(id)}?languageCode=nl&regionCode=NL`, DETAIL_FIELDS);
  if (!p || !p.id) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = p as any;
  const comps = Array.isArray(any.addressComponents) ? any.addressComponents : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reviews: PlaatsReview[] = (Array.isArray(any.reviews) ? any.reviews : []).map((r: any) => ({
    sterren: Number(r.rating || 0),
    tekst: tekst(r.text) || tekst(r.originalText),
    auteur: String(r.authorAttribution?.displayName || ""),
    wanneer: r.publishTime ? new Date(String(r.publishTime)).toISOString() : "",
    wanneerTekst: String(r.relativePublishTimeDescription || ""),
    beantwoord: false,
  })).filter((r: PlaatsReview) => r.sterren > 0);

  const uit: PlaatsProfiel = {
    placeId: String(any.id),
    naam: tekst(any.displayName),
    adres: String(any.formattedAddress || ""),
    postcode: adresDeel(comps, "postal_code"),
    plaats: adresDeel(comps, "locality") || adresDeel(comps, "postal_town"),
    telefoon: String(any.nationalPhoneNumber || any.internationalPhoneNumber || ""),
    website: String(any.websiteUri || ""),
    mapsUrl: String(any.googleMapsUri || ""),
    gemiddelde: typeof any.rating === "number" ? any.rating : null,
    aantalReviews: Number(any.userRatingCount || 0),
    reviews,
    openingstijden: Array.isArray(any.regularOpeningHours?.weekdayDescriptions)
      ? any.regularOpeningHours.weekdayDescriptions.map(String)
      : [],
    status: String(any.businessStatus || ""),
    hoofdcategorie: tekst(any.primaryTypeDisplayName) || String(any.primaryType || ""),
    categorieen: Array.isArray(any.types) ? any.types.map(String) : [],
    aantalFotos: Array.isArray(any.photos) ? any.photos.length : 0,
    omschrijving: tekst(any.editorialSummary),
    gemetenOp: new Date().toISOString(),
  };
  inCache(sleutel, uit);
  return uit;
}

/**
 * Zoekt mogelijke dubbele profielen: hetzelfde bedrijf dat onder twee
 * vermeldingen leeft. Dat is de kaartversie van twee pagina's die om hetzelfde
 * zoekwoord vechten, en bij meerdere vestigingen de meest voorkomende fout.
 * Bewust richtinggevend: alleen een mens kan zien of het echt een dubbel is of
 * gewoon een tweede vestiging.
 */
export async function zoekDubbelen(naam: string, plaats: string, eigenIds: string[]): Promise<ZoekTreffer[]> {
  const n = (naam || "").trim();
  if (!n) return [];
  const treffers = await zoekProfiel([n, plaats].filter(Boolean).join(" "), 10);
  const kaal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const eigen = new Set(eigenIds.filter(Boolean));
  return treffers.filter((t) => !eigen.has(t.placeId) && kaal(t.naam).includes(kaal(n).slice(0, 12)));
}
