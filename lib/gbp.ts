import { sql, ensureSchema } from "./db";
import { googleConfigured, getProfielAccessToken } from "./google";

// ═══════════════════════════════════════════════════════════
// DE BEHEERDEUR: GOOGLE BEDRIJFSPROFIEL (BUSINESS PROFILE API)
// ═══════════════════════════════════════════════════════════
// Dit is de deur die alleen opengaat voor profielen waar Pingwin beheerder van
// is, en pas nadat Google ons project heeft goedgekeurd (een formulier plus een
// beoordeling van maximaal twee weken). Daarom is álles hier optioneel: draait
// het niet, dan meldt het scherm dat eerlijk en blijft de meetdeur (lib/places.ts)
// het werk doen. Nooit een lege uitslag tonen alsof er niets aan de hand is.
//
// Wat deze deur geeft en de meetdeur nooit kan:
// - BEZOEKCIJFERS: hoe vaak het profiel gezien is in zoeken en op de kaart, hoe
//   vaak er gebeld werd, hoeveel routeaanvragen, hoeveel websiteklikken. Dat is
//   de voor-en-na van elke optimalisatie, en de reden dat we hem willen.
// - De VOLLEDIGE reviewlijst inclusief of er geantwoord is (de meetdeur geeft er
//   vijf en verzwijgt de antwoorden).
// - Posts, vragen, foto's, de bedrijfsomschrijving en de attributen.
//
// Wijzigen doen we hier bewust NIET automatisch. Het profiel is de etalage van
// de klant en Google schorst profielen bij vreemde wijzigingen. Het dashboard
// schrijft voor, een mens keurt per stuk goed. Dezelfde staande regel als bij
// het doorvoeren van meta-teksten.
//
// De koppeling deelt de bestaande Google-OAuth-opzet (lib/google.ts), met een
// eigen rij in oauth_tokens onder provider 'google_profiel', zodat de
// data-koppeling van Search Console nooit per ongeluk beheerrechten meekrijgt.
// ═══════════════════════════════════════════════════════════

const ACCOUNTS = "https://mybusinessaccountmanagement.googleapis.com/v1";
const INFO = "https://mybusinessbusinessinformation.googleapis.com/v1";
const PERF = "https://businessprofileperformance.googleapis.com/v1";
const QANDA = "https://mybusinessqanda.googleapis.com/v1";
const LEGACY = "https://mybusiness.googleapis.com/v4"; // reviews en posts leven hier nog

export function gbpConfigured(): boolean {
  return googleConfigured();
}

export async function gbpStatus(): Promise<{ configured: boolean; connected: boolean; account: string | null; werkt: boolean; melding: string }> {
  const configured = gbpConfigured();
  if (!configured) {
    return { configured, connected: false, account: null, werkt: false, melding: "De Google-koppeling is niet ingesteld in deze omgeving." };
  }
  await ensureSchema();
  const { rows } = await sql`SELECT account, refresh_token FROM oauth_tokens WHERE provider = 'google_profiel' LIMIT 1`;
  const connected = !!rows[0]?.refresh_token;
  const account = (rows[0]?.account as string) || null;
  if (!connected) {
    return { configured, connected, account, werkt: false, melding: "Nog niet gekoppeld. Zonder deze koppeling meten we het profiel wel, maar zien we geen bezoekcijfers." };
  }
  // Gekoppeld is niet hetzelfde als goedgekeurd: Google geeft pas data na
  // akkoord op de toegangsaanvraag. Dat verschil moet zichtbaar zijn, anders
  // lijkt een lege lijst op "deze klant heeft geen profielen".
  const acc = await haalAccounts();
  if (acc === null) {
    return { configured, connected, account, werkt: false, melding: "Gekoppeld, maar Google geeft nog geen toegang. Waarschijnlijk is de toegangsaanvraag nog niet goedgekeurd." };
  }
  return { configured, connected, account, werkt: true, melding: `Gekoppeld via ${account || "Google"}; ${acc.length} beheeraccount(s) zichtbaar.` };
}

export async function disconnectGbp(): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM oauth_tokens WHERE provider = 'google_profiel'`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api(url: string, opts: { method?: string; body?: unknown } = {}): Promise<any | null> {
  const token = await getProfielAccessToken();
  if (!token) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, {
      method: opts.method || "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export type GbpAccount = { naam: string; weergavenaam: string };

/** null betekent: we mochten niet kijken (geen goedkeuring). Lege lijst betekent: geen accounts. */
export async function haalAccounts(): Promise<GbpAccount[] | null> {
  const d = await api(`${ACCOUNTS}/accounts`);
  if (!d) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (Array.isArray(d.accounts) ? d.accounts : []).map((a: any) => ({
    naam: String(a.name || ""),
    weergavenaam: String(a.accountName || a.name || ""),
  })).filter((a: GbpAccount) => a.naam);
}

export type GbpLocatie = {
  naam: string;          // "locations/123..."
  titel: string;
  placeId: string;
  adres: string;
  telefoon: string;
  website: string;
  hoofdcategorie: string;
  omschrijving: string;
  heeftFeestdagen: boolean;
  aantalAttributen: number;
};

const LOCATIE_VELDEN = "name,title,storefrontAddress,phoneNumbers,websiteUri,categories,profile,regularHours,specialHours,metadata,serviceItems";

/** Alle locaties onder een beheeraccount. null = geen toegang. */
export async function haalLocaties(account: string): Promise<GbpLocatie[] | null> {
  const d = await api(`${INFO}/${account}/locations?readMask=${encodeURIComponent(LOCATIE_VELDEN)}&pageSize=100`);
  if (!d) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (Array.isArray(d.locations) ? d.locations : []).map((l: any) => ({
    naam: String(l.name || ""),
    titel: String(l.title || ""),
    placeId: String(l.metadata?.placeId || ""),
    adres: [
      (l.storefrontAddress?.addressLines || []).join(" "),
      l.storefrontAddress?.postalCode,
      l.storefrontAddress?.locality,
    ].filter(Boolean).join(", "),
    telefoon: String(l.phoneNumbers?.primaryPhone || ""),
    website: String(l.websiteUri || ""),
    hoofdcategorie: String(l.categories?.primaryCategory?.displayName || ""),
    omschrijving: String(l.profile?.description || ""),
    heeftFeestdagen: Array.isArray(l.specialHours?.specialHourPeriods) && l.specialHours.specialHourPeriods.length > 0,
    aantalAttributen: 0, // attributen zitten in een eigen aanroep; nog niet opgehaald
  })).filter((l: GbpLocatie) => l.naam);
}

// ── Bezoekcijfers ───────────────────────────────────────────
// Dit is waarvoor we de beheerdeur willen: laten zien wat een optimalisatie
// oplevert. Zonder deze cijfers is "het profiel staat er beter voor" een mening.

export type GbpPrestaties = {
  vanaf: string;
  tot: string;
  vertoningenZoek: number;
  vertoningenKaart: number;
  telefoontjes: number;
  routes: number;
  websiteklikken: number;
  berichten: number;
};

const METRIEKEN = [
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS", "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "CALL_CLICKS", "BUSINESS_DIRECTION_REQUESTS", "WEBSITE_CLICKS", "BUSINESS_CONVERSATIONS",
];

function datumDelen(d: Date): { year: number; month: number; day: number } {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * De cijfers over de laatste `dagen` dagen. Google loopt een paar dagen achter,
 * dus we stoppen bewust drie dagen voor vandaag; anders lijkt elke meting een
 * daling omdat de laatste dagen nog leeg zijn.
 */
export async function haalPrestaties(locatie: string, dagen = 30): Promise<GbpPrestaties | null> {
  const tot = new Date(); tot.setUTCDate(tot.getUTCDate() - 3);
  const vanaf = new Date(tot); vanaf.setUTCDate(vanaf.getUTCDate() - dagen);
  const a = datumDelen(vanaf), b = datumDelen(tot);
  const p = new URLSearchParams();
  for (const m of METRIEKEN) p.append("dailyMetrics", m);
  p.set("dailyRange.start_date.year", String(a.year));
  p.set("dailyRange.start_date.month", String(a.month));
  p.set("dailyRange.start_date.day", String(a.day));
  p.set("dailyRange.end_date.year", String(b.year));
  p.set("dailyRange.end_date.month", String(b.month));
  p.set("dailyRange.end_date.day", String(b.day));

  const d = await api(`${PERF}/${locatie}:fetchMultiDailyMetricsTimeSeries?${p.toString()}`);
  if (!d) return null;

  const totalen = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const reeks of (Array.isArray(d.multiDailyMetricTimeSeries) ? d.multiDailyMetricTimeSeries : []) as any[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const m of (Array.isArray(reeks.dailyMetricTimeSeries) ? reeks.dailyMetricTimeSeries : []) as any[]) {
      const naam = String(m.dailyMetric || "");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const som = (m.timeSeries?.datedValues || []).reduce((n: number, v: any) => n + Number(v.value || 0), 0);
      totalen.set(naam, (totalen.get(naam) || 0) + som);
    }
  }
  const t = (k: string) => totalen.get(k) || 0;
  return {
    vanaf: vanaf.toISOString().slice(0, 10),
    tot: tot.toISOString().slice(0, 10),
    vertoningenZoek: t("BUSINESS_IMPRESSIONS_DESKTOP_SEARCH") + t("BUSINESS_IMPRESSIONS_MOBILE_SEARCH"),
    vertoningenKaart: t("BUSINESS_IMPRESSIONS_DESKTOP_MAPS") + t("BUSINESS_IMPRESSIONS_MOBILE_MAPS"),
    telefoontjes: t("CALL_CLICKS"),
    routes: t("BUSINESS_DIRECTION_REQUESTS"),
    websiteklikken: t("WEBSITE_CLICKS"),
    berichten: t("BUSINESS_CONVERSATIONS"),
  };
}

// ── Reviews (de volledige lijst, mét antwoorden) ────────────

export type GbpReview = {
  id: string;
  sterren: number;
  tekst: string;
  auteur: string;
  wanneer: string;
  beantwoord: boolean;
  antwoord: string;
};

const STERREN: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export async function haalReviews(account: string, locatie: string): Promise<GbpReview[] | null> {
  // De reviews-endpoint leeft nog op de oude v4 en verwacht het locatiepad
  // ónder het account, niet het kale "locations/123".
  const kort = locatie.replace(/^locations\//, "");
  const d = await api(`${LEGACY}/${account}/locations/${kort}/reviews?pageSize=50&orderBy=updateTime desc`);
  if (!d) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (Array.isArray(d.reviews) ? d.reviews : []).map((r: any) => ({
    id: String(r.reviewId || r.name || ""),
    sterren: STERREN[String(r.starRating || "")] || 0,
    tekst: String(r.comment || ""),
    auteur: String(r.reviewer?.displayName || ""),
    wanneer: r.createTime ? new Date(String(r.createTime)).toISOString() : "",
    beantwoord: !!r.reviewReply?.comment,
    antwoord: String(r.reviewReply?.comment || ""),
  })).filter((r: GbpReview) => r.sterren > 0);
}

/**
 * Een antwoord plaatsen. Bewust een aparte functie die alleen vanuit een
 * bewuste klik wordt aangeroepen, nooit vanuit de scan: het dashboard schrijft
 * concepten, een mens verstuurt ze.
 */
export async function plaatsReviewAntwoord(account: string, locatie: string, reviewId: string, tekst: string): Promise<{ ok: boolean; error?: string }> {
  const t = (tekst || "").trim();
  if (!t) return { ok: false, error: "Er is geen antwoordtekst." };
  const kort = locatie.replace(/^locations\//, "");
  const d = await api(`${LEGACY}/${account}/locations/${kort}/reviews/${encodeURIComponent(reviewId)}/reply`, {
    method: "PUT", body: { comment: t },
  });
  return d ? { ok: true } : { ok: false, error: "Google heeft het antwoord niet geaccepteerd. Controleer of de koppeling nog geldig is." };
}

// ── Posts en vragen ─────────────────────────────────────────

export type GbpPost = { id: string; tekst: string; wanneer: string; soort: string };

export async function haalPosts(account: string, locatie: string): Promise<GbpPost[] | null> {
  const kort = locatie.replace(/^locations\//, "");
  const d = await api(`${LEGACY}/${account}/locations/${kort}/localPosts?pageSize=20`);
  if (!d) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (Array.isArray(d.localPosts) ? d.localPosts : []).map((p: any) => ({
    id: String(p.name || ""),
    tekst: String(p.summary || ""),
    wanneer: p.createTime ? new Date(String(p.createTime)).toISOString() : "",
    soort: String(p.topicType || ""),
  }));
}

export type GbpVraag = { id: string; vraag: string; beantwoord: boolean; wanneer: string };

export async function haalVragen(locatie: string): Promise<GbpVraag[] | null> {
  const d = await api(`${QANDA}/${locatie}/questions?pageSize=30&answersPerQuestion=1`);
  if (!d) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (Array.isArray(d.questions) ? d.questions : []).map((q: any) => ({
    id: String(q.name || ""),
    vraag: String(q.text || ""),
    beantwoord: Array.isArray(q.topAnswers) && q.topAnswers.length > 0,
    wanneer: q.createTime ? new Date(String(q.createTime)).toISOString() : "",
  }));
}

// ── Alles voor één locatie in één keer ──────────────────────
// De scan roept dit aan. Elk onderdeel mag apart mislukken: een profiel waar we
// de posts niet van mogen zien moet niet de hele meting laten sneuvelen.

export type GbpDetail = {
  locatie: GbpLocatie | null;
  prestaties: GbpPrestaties | null;
  prestatiesVorig: GbpPrestaties | null;
  reviews: GbpReview[] | null;
  posts: GbpPost[] | null;
  vragen: GbpVraag[] | null;
};

export async function haalAlles(account: string, locatie: GbpLocatie): Promise<GbpDetail> {
  const [prestaties, prestatiesVorig, reviews, posts, vragen] = await Promise.all([
    haalPrestaties(locatie.naam, 30).catch(() => null),
    haalPrestaties(locatie.naam, 90).catch(() => null),
    haalReviews(account, locatie.naam).catch(() => null),
    haalPosts(account, locatie.naam).catch(() => null),
    haalVragen(locatie.naam).catch(() => null),
  ]);
  return { locatie, prestaties, prestatiesVorig, reviews, posts, vragen };
}
