import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";
import { getClientBySlug } from "./clients";
import { getOrgData, type OrgData } from "./org-data";
import { getCompetitors } from "./competitors";
import { logActiviteit } from "./activiteit";
import { placesConfigured, haalProfiel, zoekProfiel, zoekDubbelen, type PlaatsProfiel, type ZoekTreffer } from "./places";
import { gbpStatus, haalAccounts, haalLocaties, haalAlles, type GbpDetail, type GbpPrestaties } from "./gbp";
import {
  CHECK, CHECKS, DREMPEL, checkGeldt, standUit, suggestiesVoor,
  type Bedrijfstype, type Bril, type Stand, type Suggestie, type Zwaarte, type Hardheid, type Bron,
} from "./gmb-kennis";

// ═══════════════════════════════════════════════════════════
// DE MOTOR: HOE STAAT HET GOOGLE-BEDRIJFSPROFIEL ERVOOR
// ═══════════════════════════════════════════════════════════
// Zelfde patroon als Opruimen en de prioriteitenscan: een motor die meet en
// wegschrijft, en een scherm dat de uitkomst toont. De criteria en de teksten
// staan NIET hier maar in lib/gmb-kennis.ts, zodat scherm en motor nooit iets
// anders kunnen beweren.
//
// Drie bronnen, en het verschil ertussen is bewust zichtbaar:
// - de meetdeur (Places): werkt altijd, ook voor concurrenten
// - de beheerdeur (Business Profile): alleen mét beheerrechten én goedkeuring
// - het dashboard zelf (bedrijfsgegevens, vestigingen, site)
//
// EEN WAARSCHUWING DIE HIER HOORT. In de bedrijfsgegevens staan al een
// reviewcijfer en een Maps-link. Die worden hier NIET overschreven. De
// bedrijfsgegevens blijven "wat wij hebben vastgelegd", deze scan meet "wat er
// nu live staat", en het verschil tussen die twee is zelf een bevinding
// (check `reviewcijfer-wijkt-af`). Twee administraties die elkaar overschrijven
// is precies de fout die hier al drie keer is gemaakt.
// ═══════════════════════════════════════════════════════════

export type Bevinding = {
  key: string;
  bril: Bril;
  label: string;
  waarom: string;
  actie: string;
  zwaarte: Zwaarte;
  hardheid: Hardheid;
  bron: Bron;
  /** Wat we gemeten hebben, in gewone taal. Altijd het bewijs onder de bevinding. */
  bewijs: string;
};

export type ConcurrentMeting = {
  naam: string;
  mapsUrl: string;
  gemiddelde: number | null;
  aantalReviews: number;
  aantalFotos: number;
  hoofdcategorie: string;
  gevonden: boolean;
};

export type LocatieUitslag = {
  /** Sleutel van de vestiging: het adres of de naam uit de bedrijfsgegevens. */
  sleutel: string;
  /** Hoe de vestiging in het dashboard heet. */
  vestiging: string;
  placeId: string;
  gekoppeld: boolean;
  profiel: PlaatsProfiel | null;
  stand: Stand;
  bevindingen: Bevinding[];
  concurrenten: ConcurrentMeting[];
  dubbelen: ZoekTreffer[];
  /** Alleen met de beheerdeur. */
  prestaties: GbpPrestaties | null;
  prestaties90: GbpPrestaties | null;
  /** Reviews van drie sterren of lager die nog geen antwoord hebben. */
  seintjes: { sterren: number; tekst: string; auteur: string; wanneer: string; beantwoord: boolean }[];
  /** Hoeveel van de reviews beantwoord zijn (alleen met de beheerdeur meetbaar). */
  reviewsBeantwoord: { beantwoord: number; totaal: number } | null;
};

export type GmbResultaat = {
  samenvatting: string;
  locaties: LocatieUitslag[];
  suggesties: Suggestie[];
  /** Wat we niet konden meten, en waarom. Nooit stilzwijgend overslaan. */
  nietGemeten: string[];
  beheerdeur: { connected: boolean; werkt: boolean; melding: string };
  meetdeur: boolean;
  gedraaidOp: string;
};

export type GmbStand = {
  status: "idle" | "running" | "done" | "error";
  result: GmbResultaat | null;
  error: string;
  updatedAt: string | null;
  /** De handmatige koppelingen: vestigingssleutel → place-id. */
  koppelingen: Record<string, string>;
};

// ═══════════════════════════════════════════════════════════
// OPSLAG
// ═══════════════════════════════════════════════════════════

// De tabellen worden één keer gebouwd per database, niet bij elke koude
// server opnieuw. Zie lib/schema-stand.ts. Verander je iets aan doEnsure(),
// hoog dan het cijfer in de versie hieronder op; anders komt het er nooit in.
const SCHEMA_VERSIE = "gmb-35d5052c";

function ensureTable(): Promise<void> {
  return eenmalig("gmb", SCHEMA_VERSIE, doEnsure);
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_gmb (
      client_slug TEXT PRIMARY KEY,
      status      TEXT NOT NULL DEFAULT 'idle',
      result      TEXT,
      error       TEXT,
      koppelingen TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  // Welke reviews we al gezien hebben. Zonder dit gaat het seintje bij elke scan
  // opnieuw af voor dezelfde review, en dan kijkt niemand er meer naar.
  await sql`
    CREATE TABLE IF NOT EXISTS client_gmb_reviews (
      client_slug TEXT NOT NULL,
      review_key  TEXT NOT NULL,
      sterren     INT  NOT NULL DEFAULT 0,
      gezien_op   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, review_key)
    )`;
}

export async function getGmbStand(slug: string): Promise<GmbStand> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT * FROM client_gmb WHERE client_slug = ${slug} LIMIT 1`;
  const r = rows[0];
  const leeg: GmbStand = { status: "idle", result: null, error: "", updatedAt: null, koppelingen: {} };
  if (!r) return leeg;
  let result: GmbResultaat | null = null;
  let koppelingen: Record<string, string> = {};
  try { result = r.result ? JSON.parse(r.result as string) : null; } catch { result = null; }
  try { koppelingen = r.koppelingen ? JSON.parse(r.koppelingen as string) : {}; } catch { koppelingen = {}; }
  return {
    status: (r.status as GmbStand["status"]) || "idle",
    result,
    error: (r.error as string) || "",
    updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
    koppelingen,
  };
}

export async function zetKoppeling(slug: string, sleutel: string, placeId: string): Promise<Record<string, string>> {
  await ensureSchema();
  await ensureTable();
  const huidig = (await getGmbStand(slug)).koppelingen;
  const nieuw = { ...huidig };
  if (placeId.trim()) nieuw[sleutel] = placeId.trim();
  else delete nieuw[sleutel];
  await sql`
    INSERT INTO client_gmb (client_slug, koppelingen, updated_at) VALUES (${slug}, ${JSON.stringify(nieuw)}, now())
    ON CONFLICT (client_slug) DO UPDATE SET koppelingen = ${JSON.stringify(nieuw)}, updated_at = now()`;
  return nieuw;
}

export async function markGmbRunning(slug: string): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`
    INSERT INTO client_gmb (client_slug, status, error, updated_at) VALUES (${slug}, 'running', '', now())
    ON CONFLICT (client_slug) DO UPDATE SET status = 'running', error = '', updated_at = now()`;
}

async function bewaar(slug: string, result: GmbResultaat): Promise<void> {
  await sql`
    INSERT INTO client_gmb (client_slug, status, result, error, updated_at)
    VALUES (${slug}, 'done', ${JSON.stringify(result)}, '', now())
    ON CONFLICT (client_slug) DO UPDATE SET status = 'done', result = EXCLUDED.result, error = '', updated_at = now()`;
}

async function bewaarFout(slug: string, error: string): Promise<void> {
  await sql`
    INSERT INTO client_gmb (client_slug, status, error, updated_at) VALUES (${slug}, 'error', ${error}, now())
    ON CONFLICT (client_slug) DO UPDATE SET status = 'error', error = ${error}, updated_at = now()`;
}

// ═══════════════════════════════════════════════════════════
// HULPJES
// ═══════════════════════════════════════════════════════════

const kaal = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const cijfers = (s: string) => (s || "").replace(/\D/g, "").replace(/^0031/, "0").replace(/^31/, "0");

function domeinVan(url: string): string {
  return (url || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^www\./i, "").toLowerCase();
}

function maandenTussen(iso: string): number {
  if (!iso) return 999;
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30.4));
}

/** Reviews per maand, gerekend over de periode die we echt zien. */
function reviewTempo(reviews: { wanneer: string }[]): number | null {
  const data = reviews.map((r) => r.wanneer).filter(Boolean).sort();
  if (data.length < 2) return null;
  const spanMaanden = maandenTussen(data[0]) - maandenTussen(data[data.length - 1]);
  if (spanMaanden <= 0.5) return null;
  return data.length / spanMaanden;
}

function bevinding(key: string, bewijs: string): Bevinding | null {
  const c = CHECK.get(key);
  if (!c) return null;
  return {
    key: c.key, bril: c.bril, label: c.label, waarom: c.waarom, actie: c.actie,
    zwaarte: c.zwaarte, hardheid: c.hardheid, bron: c.bron, bewijs,
  };
}

/** De vestigingen waarvoor we een profiel zoeken. Geen vestigingen: dan het bedrijf zelf. */
type Vestiging = { sleutel: string; naam: string; straat: string; postcode: string; plaats: string; telefoon: string };

function vestigingenUit(org: OrgData, klantnaam: string): Vestiging[] {
  const uit: Vestiging[] = (org.vestigingen || []).map((v) => ({
    sleutel: kaal(`${v.naam}${v.straat}${v.plaats}`) || kaal(v.naam),
    naam: v.naam || [v.straat, v.plaats].filter(Boolean).join(", ") || klantnaam,
    straat: v.straat || "", postcode: v.postcode || "", plaats: v.plaats || "", telefoon: v.telefoon || "",
  })).filter((v) => v.sleutel);
  if (uit.length) return uit;
  // Eén locatie (of nog geen vestigingen ingevuld): het bedrijf zelf.
  return [{
    sleutel: "hoofd",
    naam: org.bedrijfsnaam || klantnaam,
    straat: org.straat || "", postcode: org.postcode || "", plaats: org.plaats || "", telefoon: org.telefoon || "",
  }];
}

// ═══════════════════════════════════════════════════════════
// DE BEOORDELING VAN ÉÉN LOCATIE
// ═══════════════════════════════════════════════════════════

function beoordeel(
  vest: Vestiging,
  p: PlaatsProfiel | null,
  org: OrgData,
  domein: string,
  type: Bedrijfstype | "",
  concurrenten: ConcurrentMeting[],
  dubbelen: ZoekTreffer[],
  detail: GbpDetail | null,
  heeftLocatiepagina: boolean | null,
): Bevinding[] {
  const uit: (Bevinding | null)[] = [];
  const voeg = (key: string, bewijs: string) => {
    const c = CHECK.get(key);
    if (c && checkGeldt(c, type)) uit.push(bevinding(key, bewijs));
  };

  if (!p) {
    voeg("geen-profiel", `Er is voor ${vest.naam} geen Google-bedrijfsprofiel gevonden of gekoppeld.`);
    return uit.filter(Boolean) as Bevinding[];
  }

  // ── Compleet ──
  if (p.status && p.status !== "OPERATIONAL") {
    voeg("niet-actief", `Google meldt de status "${p.status === "CLOSED_TEMPORARILY" ? "tijdelijk gesloten" : "permanent gesloten"}".`);
  }
  if (!p.hoofdcategorie) voeg("geen-categorie", "Er is geen hoofdcategorie zichtbaar op het profiel.");
  if (!p.website) voeg("geen-website", "Er staat geen website-link op het profiel.");
  if (!p.telefoon) voeg("geen-telefoon", "Er staat geen telefoonnummer op het profiel.");
  if (!p.openingstijden.length) voeg("geen-openingstijden", "Google toont geen openingstijden bij dit profiel.");

  // ── Klopt met de site ──
  const vastNaam = org.bedrijfsnaam || "";
  if (vastNaam && p.naam && kaal(p.naam) !== kaal(vastNaam)) {
    voeg("naam-wijkt-af", `Op het profiel staat "${p.naam}", in de bedrijfsgegevens "${vastNaam}".`);
  }
  const vastStraat = vest.straat || org.straat;
  if (vastStraat && p.adres && !kaal(p.adres).includes(kaal(vastStraat).slice(0, 8))) {
    voeg("adres-wijkt-af", `Op het profiel staat "${p.adres}", in het dashboard "${[vastStraat, vest.postcode || org.postcode, vest.plaats || org.plaats].filter(Boolean).join(", ")}".`);
  }
  const vastTel = vest.telefoon || org.telefoon;
  if (vastTel && p.telefoon && cijfers(vastTel) !== cijfers(p.telefoon)) {
    voeg("telefoon-wijkt-af", `Op het profiel staat ${p.telefoon}, in het dashboard ${vastTel}.`);
  }
  if (p.website && domein && domeinVan(p.website) !== domein) {
    voeg("website-wijkt-af", `De link op het profiel wijst naar ${domeinVan(p.website)}, het domein van deze klant is ${domein}.`);
  }
  if (p.gemiddelde != null && org.reviewGemiddelde) {
    const vast = parseFloat(org.reviewGemiddelde.replace(",", "."));
    if (!Number.isNaN(vast) && Math.abs(vast - p.gemiddelde) >= 0.2) {
      voeg("reviewcijfer-wijkt-af", `Live staat ${p.gemiddelde.toFixed(1)} uit ${p.aantalReviews} reviews; in de bedrijfsgegevens staat ${org.reviewGemiddelde}${org.reviewAantal ? ` uit ${org.reviewAantal}` : ""}.`);
    }
  }
  const bekendeLinks = [...(org.sameAs || []), ...(org.vestigingen || []).map((v) => v.mapsUrl)].filter(Boolean);
  if (p.mapsUrl && !bekendeLinks.some((l) => l.includes(p.placeId) || kaal(l) === kaal(p.mapsUrl))) {
    voeg("geen-mapslink-vastgelegd", `De gevonden profiellink staat nog niet bij de vermeldingen in de bedrijfsgegevens.`);
  }
  if (heeftLocatiepagina === false && (org.vestigingen || []).length > 1) {
    voeg("locatie-zonder-pagina", `Het profiel van ${vest.naam} wijst naar ${p.website || "de site"}, en dat lijkt geen eigen locatiepagina te zijn.`);
  }

  // ── Reviews ──
  if (p.aantalReviews < DREMPEL.reviewsWeinig) {
    voeg("geen-reviews", `Er staan ${p.aantalReviews} reviews op het profiel.`);
  }
  const tempo = reviewTempo(p.reviews);
  if (tempo != null && tempo < DREMPEL.reviewsPerMaand && p.aantalReviews >= DREMPEL.reviewsWeinig) {
    voeg("reviewtempo-laag", `De laatste ${p.reviews.length} reviews komen neer op ongeveer ${tempo.toFixed(1)} review per maand.`);
  }
  const laag = p.reviews.filter((r) => r.sterren <= DREMPEL.lageReviewSterren);
  const laagOnbeantwoord = detail?.reviews
    ? detail.reviews.filter((r) => r.sterren <= DREMPEL.lageReviewSterren && !r.beantwoord)
    : laag;
  if (laagOnbeantwoord.length) {
    voeg("lage-review", `${laagOnbeantwoord.length} review(s) van ${DREMPEL.lageReviewSterren} sterren of lager ${detail?.reviews ? "zonder antwoord" : "zichtbaar op het profiel"}.`);
  }
  if (p.reviews.length >= 3) {
    const metInhoud = p.reviews.filter((r) => r.tekst.trim().split(/\s+/).length >= 8).length;
    if (metInhoud / p.reviews.length < 0.4) {
      voeg("reviews-zonder-inhoud", `${metInhoud} van de ${p.reviews.length} zichtbare reviews bevat een echte tekst.`);
    }
  }

  // ── Foto's ──
  if (p.aantalFotos < DREMPEL.fotosWeinig) {
    voeg("geen-fotos", `Google toont ${p.aantalFotos} foto('s) bij dit profiel.`);
  }

  // ── Alleen met de beheerdeur ──
  if (detail) {
    const loc = detail.locatie;
    if (loc && (loc.omschrijving || "").length < DREMPEL.beschrijvingMin) {
      voeg("geen-beschrijving", `De bedrijfsomschrijving is ${(loc.omschrijving || "").length} tekens; ${DREMPEL.beschrijvingMin} of meer is de bedoeling.`);
    }
    if (loc && !loc.heeftFeestdagen) {
      voeg("geen-feestdagen", "Er staan geen afwijkende openingstijden voor feestdagen ingesteld.");
    }
    if (detail.reviews) {
      const beantwoord = detail.reviews.filter((r) => r.beantwoord).length;
      if (detail.reviews.length >= 3 && beantwoord / detail.reviews.length < 0.5) {
        voeg("reviews-onbeantwoord", `${beantwoord} van de ${detail.reviews.length} reviews heeft een antwoord.`);
      }
    }
    if (detail.posts) {
      const laatste = detail.posts.map((x) => x.wanneer).filter(Boolean).sort().pop() || "";
      const dagen = laatste ? Math.floor((Date.now() - new Date(laatste).getTime()) / 86400000) : 9999;
      if (dagen > DREMPEL.postStil) {
        voeg("geen-posts", laatste ? `De laatste post is ${dagen} dagen geleden geplaatst.` : "Er zijn geen posts gevonden op dit profiel.");
      }
    }
    if (detail.vragen) {
      const open = detail.vragen.filter((v) => !v.beantwoord).length;
      if (open > 0) voeg("vragen-onbeantwoord", `${open} van de ${detail.vragen.length} vragen op het profiel is niet beantwoord.`);
    }
  }

  // ── Tegenover de concurrent ──
  const gevonden = concurrenten.filter((c) => c.gevonden);
  if (gevonden.length) {
    const beste = gevonden.reduce((a, b) => (b.aantalReviews > a.aantalReviews ? b : a));
    if (beste.aantalReviews > p.aantalReviews * DREMPEL.concurrentFactor && beste.aantalReviews - p.aantalReviews >= 10) {
      voeg("minder-reviews", `${beste.naam} heeft ${beste.aantalReviews} reviews, dit profiel ${p.aantalReviews}.`);
    }
    const cijfers = gevonden.map((c) => c.gemiddelde).filter((x): x is number => x != null);
    if (p.gemiddelde != null && cijfers.length) {
      const hoogste = Math.max(...cijfers);
      if (p.gemiddelde < hoogste - 0.2 || p.gemiddelde < DREMPEL.gemiddeldeOndergrens) {
        voeg("lager-cijfer", `Dit profiel staat op ${p.gemiddelde.toFixed(1)}, de beste concurrent op ${hoogste.toFixed(1)}.`);
      }
    }
    const meesteFotos = Math.max(...gevonden.map((c) => c.aantalFotos));
    if (meesteFotos > p.aantalFotos * 2 && meesteFotos - p.aantalFotos >= 5) {
      voeg("minder-fotos", `De concurrent met de meeste foto's heeft er ${meesteFotos}, dit profiel ${p.aantalFotos}.`);
    }
    const andereCat = gevonden.filter((c) => c.hoofdcategorie && kaal(c.hoofdcategorie) !== kaal(p.hoofdcategorie));
    if (p.hoofdcategorie && andereCat.length >= 2) {
      voeg("smallere-categorie", `Dit profiel staat in "${p.hoofdcategorie}"; concurrenten staan in ${andereCat.slice(0, 2).map((c) => `"${c.hoofdcategorie}"`).join(" en ")}.`);
    }
  }

  if (dubbelen.length) {
    voeg("dubbel-profiel", `Gevonden onder vrijwel dezelfde naam: ${dubbelen.slice(0, 3).map((d) => `${d.naam} (${d.adres})`).join("; ")}.`);
  }

  return uit.filter(Boolean) as Bevinding[];
}

// ═══════════════════════════════════════════════════════════
// DE SCAN
// ═══════════════════════════════════════════════════════════

export async function runGmbScan(slug: string): Promise<void> {
  try {
    await ensureSchema();
    await ensureTable();
    const client = await getClientBySlug(slug);
    if (!client) { await bewaarFout(slug, "Deze klant bestaat niet (meer)."); return; }

    const meetdeur = placesConfigured();
    const org = (await getOrgData(slug).catch(() => null))?.data;
    const nietGemeten: string[] = [];

    if (!meetdeur) {
      nietGemeten.push("De Google Maps-sleutel staat niet in deze omgeving, dus er kon geen enkel profiel gemeten worden. Zet GOOGLE_MAPS_API_KEY in Vercel.");
    }
    if (!org || !(org.bedrijfsnaam || "").trim()) {
      nietGemeten.push("De bedrijfsgegevens zijn nog niet ingevuld, dus we konden het profiel alleen op de klantnaam zoeken en niets vergelijken.");
    }

    const orgData: OrgData = org || ({} as OrgData);
    const type = (orgData.bedrijfstype || "") as Bedrijfstype | "";
    const domein = domeinVan(client.domain || "");
    const vestigingen = vestigingenUit(orgData, client.name);
    const koppelingen = (await getGmbStand(slug)).koppelingen;

    // ── De beheerdeur, één keer voor alle locaties ──
    const bStatus = await gbpStatus().catch(() => ({ configured: false, connected: false, account: null, werkt: false, melding: "Kon de status van de beheerkoppeling niet ophalen." }));
    let gbpLocaties: { account: string; loc: Awaited<ReturnType<typeof haalLocaties>> extends (infer U)[] | null ? U : never }[] = [];
    if (bStatus.werkt) {
      const accounts = (await haalAccounts().catch(() => null)) || [];
      for (const a of accounts.slice(0, 5)) {
        const locs = (await haalLocaties(a.naam).catch(() => null)) || [];
        for (const l of locs) gbpLocaties.push({ account: a.naam, loc: l });
      }
    } else if (bStatus.melding) {
      nietGemeten.push(`Bezoekcijfers, posts, vragen en de antwoorden op reviews zijn niet gemeten. ${bStatus.melding}`);
    }

    // ── De concurrenten, één keer meten en bij elke locatie hergebruiken ──
    const concurrentDomeinen = await getCompetitors(slug).catch(() => [] as string[]);
    const hoofdplaats = orgData.plaats || vestigingen[0]?.plaats || "";
    const concurrenten: ConcurrentMeting[] = [];
    if (meetdeur) {
      for (const d of concurrentDomeinen) {
        const treffers = await zoekProfiel(`${d.replace(/\.(nl|com|be|eu)$/i, "")} ${hoofdplaats}`.trim(), 3).catch(() => []);
        // Alleen aannemen als de website van het profiel echt dit domein is;
        // anders koppelen we het profiel van een naamgenoot aan de concurrent.
        const raak = treffers.find((t) => domeinVan(t.website) === d);
        if (!raak) {
          concurrenten.push({ naam: d, mapsUrl: "", gemiddelde: null, aantalReviews: 0, aantalFotos: 0, hoofdcategorie: "", gevonden: false });
          continue;
        }
        const vol = await haalProfiel(raak.placeId).catch(() => null);
        concurrenten.push({
          naam: vol?.naam || raak.naam,
          mapsUrl: vol?.mapsUrl || raak.mapsUrl,
          gemiddelde: vol?.gemiddelde ?? raak.gemiddelde,
          aantalReviews: vol?.aantalReviews ?? raak.aantalReviews,
          aantalFotos: vol?.aantalFotos ?? 0,
          hoofdcategorie: vol?.hoofdcategorie || raak.categorie,
          gevonden: true,
        });
      }
    }
    if (!concurrentDomeinen.length) {
      nietGemeten.push("Er staan nog geen concurrenten bij deze klant, dus er is niets om het profiel tegenover te zetten. Dat regel je bij KPI's, knop Concurrenten.");
    } else if (concurrenten.every((c) => !c.gevonden) && meetdeur) {
      nietGemeten.push("Van geen van de concurrenten kon een Google-profiel gevonden worden dat aantoonbaar bij hun domein hoort. De vergelijking blijft daardoor leeg.");
    }

    // ── Per locatie ──
    const locaties: LocatieUitslag[] = [];
    for (const vest of vestigingen) {
      let placeId = koppelingen[vest.sleutel] || "";
      let profiel: PlaatsProfiel | null = null;

      if (meetdeur) {
        if (!placeId) {
          // Zelf zoeken, maar alleen aannemen bij een overtuigende treffer:
          // het domein moet kloppen, of naam plus plaats moeten allebei raken.
          const vraag = [orgData.bedrijfsnaam || client.name, vest.straat, vest.plaats].filter(Boolean).join(" ");
          const treffers = await zoekProfiel(vraag, 5).catch(() => []);
          const zeker = treffers.find((t) => domein && domeinVan(t.website) === domein)
            || treffers.find((t) => vest.plaats && kaal(t.adres).includes(kaal(vest.plaats)) && kaal(t.naam).includes(kaal(orgData.bedrijfsnaam || client.name).slice(0, 8)));
          if (zeker) placeId = zeker.placeId;
        }
        if (placeId) profiel = await haalProfiel(placeId).catch(() => null);
      }

      // De beheerdeur koppelen op place-id: dat is de enige harde sleutel tussen
      // beide deuren. Lukt dat niet, dan draait deze locatie op de meetdeur.
      const bij = gbpLocaties.find((g) => g.loc && profiel && g.loc.placeId === profiel.placeId);
      const detail: GbpDetail | null = bij && bij.loc ? await haalAlles(bij.account, bij.loc).catch(() => null) : null;

      // Heeft deze vestiging een eigen pagina achter zich, of wijst het profiel
      // naar de homepage? Alleen zinvol bij meerdere vestigingen.
      const heeftLocatiepagina = profiel?.website
        ? (() => { try { return new URL(profiel.website).pathname.replace(/\/+$/, "").length > 1; } catch { return null; } })()
        : null;

      const dubbelen = meetdeur && profiel
        ? await zoekDubbelen(orgData.bedrijfsnaam || client.name, vest.plaats, [profiel.placeId, ...Object.values(koppelingen)]).catch(() => [])
        : [];

      const bevindingen = beoordeel(vest, profiel, orgData, domein, type, concurrenten, dubbelen, detail, heeftLocatiepagina);

      // De seintjes: lage reviews. Uit de beheerdeur als die er is (want die
      // weet of er geantwoord is), anders uit de meetdeur.
      const bron = detail?.reviews || profiel?.reviews || [];
      const seintjes = bron
        .filter((r) => r.sterren > 0 && r.sterren <= DREMPEL.lageReviewSterren)
        .map((r) => ({
          sterren: r.sterren,
          tekst: (r.tekst || "").slice(0, 400),
          auteur: r.auteur || "",
          wanneer: r.wanneer || "",
          beantwoord: "beantwoord" in r ? !!r.beantwoord : false,
        }))
        .sort((a, b) => (b.wanneer || "").localeCompare(a.wanneer || ""));

      await meldNieuweSeintjes(slug, vest.naam, profiel?.mapsUrl || "", seintjes);

      locaties.push({
        sleutel: vest.sleutel,
        vestiging: vest.naam,
        placeId: profiel?.placeId || placeId,
        gekoppeld: !!koppelingen[vest.sleutel],
        profiel,
        stand: standUit(bevindingen),
        bevindingen,
        concurrenten,
        dubbelen,
        prestaties: detail?.prestaties || null,
        prestaties90: detail?.prestatiesVorig || null,
        seintjes,
        reviewsBeantwoord: detail?.reviews
          ? { beantwoord: detail.reviews.filter((r) => r.beantwoord).length, totaal: detail.reviews.length }
          : null,
      });
    }

    const totaalBev = locaties.reduce((n, l) => n + l.bevindingen.length, 0);
    const zwaar = locaties.reduce((n, l) => n + l.bevindingen.filter((b) => b.zwaarte === "hoog").length, 0);
    const zonder = locaties.filter((l) => !l.profiel).length;
    const samenvatting = zonder === locaties.length
      ? `Er is voor ${locaties.length === 1 ? "deze klant" : `geen van de ${locaties.length} vestigingen`} een Google-bedrijfsprofiel gevonden. Koppel het profiel handmatig, of maak er een aan.`
      : `${locaties.length} ${locaties.length === 1 ? "locatie" : "locaties"} bekeken, ${totaalBev} ${totaalBev === 1 ? "punt" : "punten"} gevonden waarvan ${zwaar} zwaarwegend.${zonder ? ` Bij ${zonder} vestiging(en) is geen profiel gevonden.` : ""}`;

    await bewaar(slug, {
      samenvatting,
      locaties,
      suggesties: suggestiesVoor(type),
      nietGemeten,
      beheerdeur: { connected: bStatus.connected, werkt: bStatus.werkt, melding: bStatus.melding },
      meetdeur,
      gedraaidOp: new Date().toISOString(),
    });
  } catch (e) {
    await bewaarFout(slug, `De profielscan is misgegaan: ${(e as Error).message}`).catch(() => { /* laatste redmiddel */ });
  }
}

// ═══════════════════════════════════════════════════════════
// HET SEINTJE BIJ EEN LAGE REVIEW
// ═══════════════════════════════════════════════════════════
// Eén keer per review, niet bij elke scan opnieuw: een seintje dat elke keer
// afgaat is binnen een week achtergrondruis. Het landt in de activiteit, want
// dat is de plek waar de tijdlijn van deze klant al staat. Bewust intern:
// een binnengekomen review is geen werk van ons.

async function meldNieuweSeintjes(
  slug: string,
  vestiging: string,
  mapsUrl: string,
  seintjes: { sterren: number; tekst: string; auteur: string; wanneer: string }[],
): Promise<void> {
  for (const s of seintjes) {
    const sleutel = `${kaal(vestiging)}:${kaal(s.auteur)}:${s.wanneer || kaal(s.tekst).slice(0, 24)}`;
    try {
      const { rowCount } = await sql`
        INSERT INTO client_gmb_reviews (client_slug, review_key, sterren) VALUES (${slug}, ${sleutel}, ${s.sterren})
        ON CONFLICT (client_slug, review_key) DO NOTHING`;
      if (!rowCount) continue; // al eerder gezien
      await logActiviteit({
        slug,
        soort: "gmb-review",
        bron: "gmb-review",
        bronId: sleutel,
        gebeurdeOp: s.wanneer || undefined,
        intern: `Review van ${s.sterren} ${s.sterren === 1 ? "ster" : "sterren"} op het Google-profiel${vestiging ? ` (${vestiging})` : ""}${s.auteur ? ` door ${s.auteur}` : ""}: reageren`,
        klant: "Nieuwe review op Google",
        bewijs: mapsUrl || null,
        zichtbaar: false,
      });
    } catch {
      /* een seintje mag de scan nooit laten mislukken */
    }
  }
}
