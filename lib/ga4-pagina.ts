import { sql } from "@vercel/postgres";
import { getGoogleAccessToken, ga4PropertyVoor } from "./google";

// ═══════════════════════════════════════════════════════════
// WAT ÉÉN PAGINA IN GOOGLE ANALYTICS DOET
// ═══════════════════════════════════════════════════════════
// Analytics zat al in dit dashboard, maar alleen op site-niveau (de vergelijking
// per periode) en als voor-en-na rond een wijziging. Voor het Pagina-lab is een
// derde vorm nodig: de kale stand van één pagina, nú, met de verdeling over
// mobiel en desktop erbij. Want een oordeel over conversie of bruikbaarheid
// verandert volledig als blijkt dat 80% van het bezoek mobiel is en juist daar
// niemand doorklikt.
//
// Waarom een eigen bestand en niet in lib/google.ts erbij: dat bestand staat op
// de erfenis-lijst van te grote bestanden (het mag alleen korter worden), en dit
// hoort bij het lab, niet bij de bestaande SEO-motoren.
//
// Deze laag MEET, hij oordeelt niet. Wat hier uitkomt is wat er gebeurd is,
// zonder mening erover. Het oordeel komt uit de kennisbank, met deze cijfers
// ernaast.
// ═══════════════════════════════════════════════════════════

const API = "https://analyticsdata.googleapis.com/v1beta";

export type Gedrag = {
  /** Paginaweergaven in de periode. */
  weergaven: number;
  /** Sessies die op deze pagina begonnen. */
  instappen: number;
  /** Percentage sessies dat als betrokken telt (GA4 rekent dat zelf uit). */
  betrokkenheid: number;
  /** Percentage sessies dat meteen weer weg is. */
  wegklikken: number;
  /** Gemiddelde tijd op de pagina, in seconden. */
  seconden: number;
  /** Conversies (in GA4 sinds 2024 "sleutelgebeurtenissen") toegeschreven aan deze pagina. */
  conversies: number;
};

export type PaginaCijfers = {
  gekoppeld: boolean;
  /** Null als er geen property gevonden is bij deze klant. */
  property: string | null;
  dagen: number;
  pad: string;
  totaal: Gedrag | null;
  /** Dezelfde cijfers per apparaat, want daar zit meestal het verhaal. */
  perApparaat: { apparaat: string; gedrag: Gedrag }[];
  /** Waarom er niets is, in gewone taal. Leeg als alles gelukt is. */
  melding?: string;
};

const LEEG: Gedrag = { weergaven: 0, instappen: 0, betrokkenheid: 0, wegklikken: 0, seconden: 0, conversies: 0 };

function padVan(url: string): string {
  try { return new URL(url).pathname || "/"; } catch { return url.startsWith("/") ? url : `/${url}`; }
}

function dagenTerug(dagen: number): { startDate: string; endDate: string } {
  const eind = new Date();
  const start = new Date();
  start.setDate(start.getDate() - dagen);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: iso(start), endDate: iso(eind) };
}

// De metrieken in de volgorde waarin ze teruggelezen worden. `conversions` heet
// in nieuwere properties `keyEvents`; welke van de twee een property kent
// verschilt, dus als de eerste wordt geweigerd gaat dezelfde vraag nog een keer
// met de andere naam. Alleen die ene naam verschilt, de rest blijft gelijk.
const METRIEKEN = ["screenPageViews", "sessions", "engagementRate", "bounceRate", "userEngagementDuration"];
const CONVERSIE_NAMEN = ["conversions", "keyEvents"];

type ApiRij = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };

function leesGedrag(waarden: string[]): Gedrag {
  const n = (i: number) => Number(waarden[i]) || 0;
  const weergaven = n(0);
  return {
    weergaven,
    instappen: n(1),
    betrokkenheid: Math.round(n(2) * 1000) / 10,
    wegklikken: Math.round(n(3) * 1000) / 10,
    seconden: weergaven ? Math.round(n(4) / weergaven) : 0,
    conversies: n(5),
  };
}

/**
 * De cijfers van één pagina, in totaal en per apparaat.
 *
 * Eén aanvraag, uitgesplitst op apparaat; het totaal is de optelsom daarvan.
 * Dat scheelt een tweede aanvraag en het kan niet uit elkaar lopen, wat bij twee
 * losse aanvragen wél gebeurt zodra de periode net over een dagrand valt.
 */
export async function ga4VoorPagina(slug: string, url: string, dagen = 28, domainHint = ""): Promise<PaginaCijfers> {
  const pad = padVan(url);
  const basis: PaginaCijfers = { gekoppeld: false, property: null, dagen, pad, totaal: null, perApparaat: [] };

  const token = await getGoogleAccessToken();
  if (!token) return { ...basis, melding: "Google is niet gekoppeld in dit dashboard." };

  const property = await ga4PropertyVoor(slug, domainHint);
  if (!property) {
    return { ...basis, gekoppeld: true, melding: "Bij deze klant is geen Analytics-property gevonden. Vul hem met de hand in, of geef het Google-account toegang tot deze property." };
  }

  async function vraag(conversieNaam: string): Promise<{ ok: boolean; rijen: ApiRij[]; status: number }> {
    const res = await fetch(`${API}/properties/${property}:runReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [dagenTerug(dagen)],
        dimensions: [{ name: "deviceCategory" }],
        dimensionFilter: { filter: { fieldName: "pagePath", stringFilter: { matchType: "EXACT", value: pad } } },
        metrics: [...METRIEKEN, conversieNaam].map((name) => ({ name })),
        limit: 10,
      }),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, rijen: [], status: res.status };
    const j = await res.json();
    return { ok: true, rijen: (j.rows || []) as ApiRij[], status: 200 };
  }

  let uitkomst = await vraag(CONVERSIE_NAMEN[0]).catch(() => ({ ok: false, rijen: [] as ApiRij[], status: 0 }));
  if (!uitkomst.ok) {
    uitkomst = await vraag(CONVERSIE_NAMEN[1]).catch(() => ({ ok: false, rijen: [] as ApiRij[], status: 0 }));
  }
  if (!uitkomst.ok) {
    return { ...basis, gekoppeld: true, property, melding: "Analytics gaf geen antwoord op deze vraag." };
  }

  const perApparaat = uitkomst.rijen.map((r) => ({
    apparaat: r.dimensionValues?.[0]?.value || "onbekend",
    gedrag: leesGedrag((r.metricValues || []).map((m) => m.value || "0")),
  }));

  if (!perApparaat.length) {
    return { ...basis, gekoppeld: true, property, totaal: { ...LEEG }, melding: `Analytics kent geen bezoek op ${pad} in de laatste ${dagen} dagen.` };
  }

  // Het totaal: optellen wat op te tellen is, en middelen wat een percentage of
  // een gemiddelde is. Percentages van twee apparaten optellen zou onzin geven,
  // dus die wegen mee naar rato van het aantal weergaven.
  const weergaven = perApparaat.reduce((s, a) => s + a.gedrag.weergaven, 0);
  const gewogen = (kies: (g: Gedrag) => number) =>
    weergaven ? Math.round((perApparaat.reduce((s, a) => s + kies(a.gedrag) * a.gedrag.weergaven, 0) / weergaven) * 10) / 10 : 0;

  const totaal: Gedrag = {
    weergaven,
    instappen: perApparaat.reduce((s, a) => s + a.gedrag.instappen, 0),
    betrokkenheid: gewogen((g) => g.betrokkenheid),
    wegklikken: gewogen((g) => g.wegklikken),
    seconden: Math.round(gewogen((g) => g.seconden)),
    conversies: perApparaat.reduce((s, a) => s + a.gedrag.conversies, 0),
  };

  perApparaat.sort((a, b) => b.gedrag.weergaven - a.gedrag.weergaven);
  return { gekoppeld: true, property, dagen, pad, totaal, perApparaat };
}

/**
 * Alleen kijken óf er een property bekend is, zonder er data bij te halen.
 * Voor het overzicht met de stand per klant.
 */
export async function ga4Stand(slug: string, domainHint = ""): Promise<{ gekoppeld: boolean; property: string | null }> {
  const token = await getGoogleAccessToken();
  if (!token) return { gekoppeld: false, property: null };
  const property = await ga4PropertyVoor(slug, domainHint).catch(() => null);
  return { gekoppeld: true, property };
}

/**
 * De properties die al bekend zijn, rechtstreeks uit de kolom.
 *
 * Bewust ZONDER zoeken: een overzicht van dertig klanten zou anders dertig keer
 * het hele Analytics-account aflopen, en dat is precies waarom `ga4PropertyFor`
 * zijn zoekpogingen een week uit elkaar houdt. Voor een lijstje "waar staat het
 * al" is de opgeslagen waarde genoeg.
 */
export async function ga4PropertiesBekend(): Promise<Record<string, string>> {
  const { rows } = await sql`SELECT slug, ga4_property_id FROM clients WHERE ga4_property_id IS NOT NULL AND ga4_property_id <> ''`;
  const uit: Record<string, string> = {};
  for (const r of rows) uit[String(r.slug)] = String(r.ga4_property_id);
  return uit;
}

/** Een property met de hand vastleggen of weghalen (leeg = weghalen). */
export async function bewaarGa4Property(slug: string, property: string): Promise<void> {
  const schoon = property.trim().replace(/^properties\//, "");
  if (!schoon) {
    await sql`UPDATE clients SET ga4_property_id = NULL, ga4_gezocht_op = NULL WHERE slug = ${slug}`;
    return;
  }
  await sql`UPDATE clients SET ga4_property_id = ${schoon}, ga4_gezocht_op = now() WHERE slug = ${slug}`;
}
