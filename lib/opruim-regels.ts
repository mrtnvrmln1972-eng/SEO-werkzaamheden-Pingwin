import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";
import { getSetting, setSetting } from "./settings";

// ═══════════════════════════════════════════════════════════
// JOUW CORRECTIES ZIJN VOORTAAN VASTE REGELS
// ═══════════════════════════════════════════════════════════
// Dit is de "self-learning"-laag, en die is simpeler dan hij klinkt. Corrigeert
// Maarten een regel in de opruimlijst (deze pagina houden we; dit doel klopt
// niet, hij hoort bij Den Haag), dan wordt dat hier vastgelegd. De volgende
// analyse krijgt die correcties mee als harde regels en maakt dezelfde fout
// nooit meer.
//
// Waarom dat nodig is: de analyse leidt het redirect-doel af uit de zoekwoorden
// die een pagina leent. Dat is een goede aanwijzing, geen feit. Bij
// /soa-test-monster/ kwam Nijmegen eruit terwijl Monster bij Den Haag hoort.
// Zulke dingen weet alleen een mens, en die kennis hoort niet verloren te gaan
// in een chat.
// ═══════════════════════════════════════════════════════════

export type OpruimRegel = {
  van: string;
  besluit: "houden" | "redirect" | "genegeerd";
  naar: string;
  notitie: string;
  doorgevoerd: boolean;
  /** Bij een samenvoeging: is de content al naar het doel overgezet? De
      redirect-knop gaat pas open als dit waar is (of als het briefje zegt dat
      er niets over te zetten valt). Zie lib/opruim-samenvoegen.ts. */
  contentOver: boolean;
  updatedAt: string | null;
};

// De tabellen worden één keer gebouwd per database, niet bij elke koude
// server opnieuw. Zie lib/schema-stand.ts. Verander je iets aan doEnsure(),
// hoog dan het cijfer in de versie hieronder op; anders komt het er nooit in.
const SCHEMA_VERSIE = "opruim-regels-f98aa51e";

function ensureTable(): Promise<void> {
  return eenmalig("opruim-regels", SCHEMA_VERSIE, doEnsure);
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_opruim_regels (
      client_slug  TEXT NOT NULL,
      van          TEXT NOT NULL,
      besluit      TEXT NOT NULL DEFAULT 'redirect',
      naar         TEXT,
      notitie      TEXT,
      doorgevoerd  BOOLEAN NOT NULL DEFAULT false,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, van)
    )`;
  await sql`ALTER TABLE client_opruim_regels ADD COLUMN IF NOT EXISTS content_over BOOLEAN NOT NULL DEFAULT false`;
}

const padVan = (u: string) => { try { return new URL(u).pathname; } catch { return (u || "").trim(); } };

export async function getOpruimRegels(slug: string): Promise<OpruimRegel[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT van, besluit, naar, notitie, doorgevoerd, content_over, updated_at
    FROM client_opruim_regels WHERE client_slug = ${slug} ORDER BY van`;
  return rows.map((r) => ({
    van: r.van as string,
    besluit: ((r.besluit as string) || "redirect") as OpruimRegel["besluit"],
    naar: (r.naar as string) || "",
    notitie: (r.notitie as string) || "",
    doorgevoerd: !!r.doorgevoerd,
    contentOver: !!r.content_over,
    updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
  }));
}

export async function zetOpruimRegel(slug: string, van: string, patch: Partial<Omit<OpruimRegel, "van" | "updatedAt">>): Promise<void> {
  await ensureSchema();
  await ensureTable();
  const p = padVan(van);
  if (!p) return;
  const besluit = patch.besluit ?? null;
  const naar = patch.naar === undefined ? null : padVan(patch.naar);
  const notitie = patch.notitie === undefined ? null : patch.notitie.slice(0, 600);
  const doorgevoerd = patch.doorgevoerd === undefined ? null : patch.doorgevoerd;
  const contentOver = patch.contentOver === undefined ? null : patch.contentOver;
  await sql`
    INSERT INTO client_opruim_regels (client_slug, van, besluit, naar, notitie, doorgevoerd, content_over, updated_at)
    VALUES (${slug}, ${p}, ${besluit || "redirect"}, ${naar}, ${notitie}, ${doorgevoerd ?? false}, ${contentOver ?? false}, now())
    ON CONFLICT (client_slug, van) DO UPDATE SET
      besluit      = COALESCE(${besluit}, client_opruim_regels.besluit),
      naar         = COALESCE(${naar}, client_opruim_regels.naar),
      notitie      = COALESCE(${notitie}, client_opruim_regels.notitie),
      doorgevoerd  = COALESCE(${doorgevoerd}, client_opruim_regels.doorgevoerd),
      content_over = COALESCE(${contentOver}, client_opruim_regels.content_over),
      updated_at   = now()`;
}

/**
 * De correcties als instructie voor de volgende analyse. Dit gaat mee de motor
 * in, zodat een besluit van Maarten nooit twee keer genomen hoeft te worden.
 */
// ── De gekozen URL-structuur ───────────────────────────────────────────────
// Eén vaste vorm voor een type pagina, bijvoorbeeld /soa-klinieken/soa-test-<plaats>/.
// Zonder zo'n keuze blijft opruimen dweilen met de kraan open: One Day Clinic had
// 433 live pagina's in 299 verschillende URL-vormen, en de motor stelde daardoor
// omleidingen voor naar vormen die we juist willen uitfaseren.
export async function getUrlStructuur(slug: string): Promise<string> {
  return (await getSetting(`url_structuur:${slug}`).catch(() => null)) || "";
}
export async function zetUrlStructuur(slug: string, vorm: string): Promise<void> {
  await setSetting(`url_structuur:${slug}`, (vorm || "").trim());
}

export async function structuurAlsInstructie(slug: string): Promise<string> {
  const vorm = await getUrlStructuur(slug);
  if (!vorm) return "";
  return [
    "GEKOZEN URL-STRUCTUUR. Dit is een HARDE regel en gaat vóór je eigen voorkeur.",
    `De enige toegestane vorm voor dit type pagina is: ${vorm}`,
    "Gevolgen die je strikt toepast:",
    `- Stel NOOIT een omleiding voor NAAR een pagina die niet deze vorm heeft, tenzij die doelpagina aantoonbaar op zijn eigen onderwerp rankt en de doelvorm nog niet bestaat.`,
    `- Is de sterkste pagina van een plaats een ANDERE vorm, en rankt hij op zijn eigen plaatsnaam, zet dan "verhuizen": true. Dat betekent dat de content naar de doelvorm gaat en de oude URL daarheen doorverwijst. Vul bij "naar" dan de doel-URL in de gekozen vorm in, ook als die nu nog niet bestaat.`,
    `- Rankt zo'n sterkste pagina NIET op zijn eigen plaatsnaam maar op die van een grotere stad (bijvoorbeeld een dorpspagina die op "merk grote-stad" binnenkomt), dan is het GEEN verhuizing: leid hem gewoon om naar de pagina van die grotere stad, in de gekozen vorm. Zet "verhuizen" dan op false.`,
    `- Levert een plaats in geen enkele variant verkeer op, kies dan de doelvorm als bestemming en leid de rest daarheen. Geen verhuizing, geen discussie.`,
  ].join("\n");
}

// ── Advertentiepagina's (Google Ads) ───────────────────────────────────────
// Een Ads-landingspagina staat vaak op noindex en haalt dus nul uit Google. Voor
// de opruim-analyse ziet zo'n pagina eruit als dood gewicht, terwijl hij gewoon
// moet blijven bestaan: de advertenties wijzen erheen. Eén keer opruimen van zo'n
// pagina kost echt geld. Daarom vragen we ze vóór de analyse uit en zetten we ze
// buiten schot; ze komen niet in de kandidatenlijst en niet in de werklijst.
export type AdsPaginas = { paden: string[]; geen: boolean; ingevuld: boolean };

export async function getAdsPaginas(slug: string): Promise<AdsPaginas> {
  const ruw = await getSetting(`ads_paginas:${slug}`).catch(() => null);
  if (!ruw) return { paden: [], geen: false, ingevuld: false };
  try {
    const d = JSON.parse(ruw) as { paden?: unknown; geen?: unknown };
    const paden = Array.isArray(d.paden) ? d.paden.map((p) => padVan(String(p))).filter(Boolean) : [];
    const geen = d.geen === true;
    return { paden, geen, ingevuld: geen || paden.length > 0 };
  } catch { return { paden: [], geen: false, ingevuld: false }; }
}

export async function zetAdsPaginas(slug: string, paden: string[], geen: boolean): Promise<AdsPaginas> {
  const schoon = [...new Set(paden.map((p) => padVan(String(p))).filter(Boolean))];
  await setSetting(`ads_paginas:${slug}`, JSON.stringify({ paden: schoon, geen: !!geen && !schoon.length }));
  return { paden: schoon, geen: !!geen && !schoon.length, ingevuld: !!geen || schoon.length > 0 };
}

/**
 * Is een pad een advertentiepagina? Ook alles eronder telt mee, zodat een hele
 * map (bijvoorbeeld /ads/) in één regel afgeschermd is.
 *
 * Met één uitzondering die op 7 augustus 2026 de hele analyse leegtrok: de
 * homepage. "/" wordt na het strippen van de slash een lege tekst, en dan is
 * `p.startsWith("" + "/")` waar voor élk pad van de site. Eén regel in een
 * invulveld zette daarmee alle 432 pagina's van One Day Clinic buiten schot: de
 * werklijst, de onderwerpen, de kansen en de gaten kwamen allemaal leeg terug, en
 * de analyse die eroverheen liep leverde nul regels op. Geen foutmelding, gewoon
 * niets. De homepage mag hier gewoon staan; hij dekt dan alleen zichzelf.
 */
export function isAdsPad(pad: string, ads: AdsPaginas): boolean {
  const p = padVan(pad).replace(/\/$/, "").toLowerCase();
  return bruikbareAdsPaden(ads).some((b) => {
    if (!b) return p === "";              // "/" is alleen de homepage zelf
    return p === b || p.startsWith(b + "/");
  });
}

/**
 * ═══════════════════════════════════════════════════════════
 * EEN HELE SECTIE IS GEEN ADVERTENTIEPAGINA (27-08-2026)
 * ═══════════════════════════════════════════════════════════
 * Op de lijst van One Day Clinic stond `/en/`, en omdat een regel álles eronder
 * dekt zette die ene regel 315 pagina's buiten beeld: de complete Engelse sectie.
 * Dat zijn geen advertentiepagina's. Ze staan op `index, follow` met een eigen
 * canonical, 211 ervan hebben een echte positie in Google, en er loopt een
 * kloppende hreflang-koppeling met de Nederlandse pagina's.
 *
 * Dit is dezelfde fout als met `/` een paar weken eerder, en die is toen met een
 * uitzondering opgelost in plaats van met een regel. Nu de regel: een
 * advertentiepagina is een landingspagina, geen taalboom en geen halve site. Een
 * regel die een eigen sectie beslaat wordt genegeerd, en het scherm meldt hem via
 * `teBredeAdsPaden` zodat hij opgeruimd kan worden in plaats van stilletjes te
 * blijven werken.
 *
 * `/` blijft toegestaan, want die dekt (door de regel hierboven) alleen de
 * homepage zelf en is dus per definitie één pagina.
 */
// Hoeveel pagina's mag één regel dekken voordat het een sectie is? Een campagne
// heeft er een handvol; een taalboom heeft er honderden. Deze grens wordt tegen
// de echte pagina's van de site gehouden, niet tegen de vorm van het pad: een
// gewone landingspagina op de wortel (`/soa-test-kopen/`) ziet er hetzelfde uit
// als een map, en die mag natuurlijk gewoon.
const ADS_MAX_PAGINAS = 25;

/** De paden van de lijst die echt als advertentiepagina gelden, genormaliseerd. */
export function bruikbareAdsPaden(ads: AdsPaginas): string[] {
  return ads.paden.map((a) => padVan(a).replace(/\/$/, "").toLowerCase());
}

function dekt(regel: string, paden: string[]): number {
  const b = padVan(regel).replace(/\/$/, "").toLowerCase();
  if (!b) return 1;                       // "/" dekt alleen de homepage
  return paden.filter((p) => {
    const q = padVan(p).replace(/\/$/, "").toLowerCase();
    return q === b || q.startsWith(b + "/");
  }).length;
}

/**
 * Welke regels dekken zoveel pagina's dat het geen landingspagina meer is? Die
 * worden genegeerd; `zonderTeBrede` levert de lijst waarmee gerekend wordt.
 */
export function teBredeAdsPaden(ads: AdsPaginas, livePaden: string[]): { pad: string; paginas: number }[] {
  return ads.paden
    .map((pad) => ({ pad, paginas: dekt(pad, livePaden) }))
    .filter((x) => x.paginas > ADS_MAX_PAGINAS)
    .sort((a, b) => b.paginas - a.paginas);
}

/** De ads-lijst zonder de regels die een hele sectie beslaan. */
export function zonderTeBrede(ads: AdsPaginas, livePaden: string[]): AdsPaginas {
  const weg = new Set(teBredeAdsPaden(ads, livePaden).map((x) => x.pad));
  const paden = ads.paden.filter((p) => !weg.has(p));
  return { ...ads, paden, ingevuld: ads.geen || paden.length > 0 };
}

export async function adsAlsInstructie(slug: string, ads?: AdsPaginas): Promise<string> {
  // De lijst komt bij voorkeur van buiten, want dan is hij al gesmald met
  // `adsVoorKlant`. Zonder dat argument valt hij terug op de ruwe lijst, en dan
  // krijgt het model te horen dat het een hele taalboom moet overslaan. Precies
  // dat gebeurde op 27-08-2026: de code sloot `/en/` niet meer uit, maar de
  // instructie aan het model deed het nog wél, dus kwam er geen enkele Engelse
  // pagina in de clusters terecht.
  const lijst = ads ?? (await getAdsPaginas(slug));
  if (!lijst.paden.length) return "";
  const ads2 = lijst;
  return [
    "ADVERTENTIEPAGINA'S. Dit is een HARDE regel en kent geen uitzondering.",
    `Deze pagina's (en alles eronder) zijn landingspagina's voor Google Ads: ${ads2.paden.join(", ")}.`,
    "Ze staan vaak op noindex en halen daarom weinig of niets uit de organische zoekresultaten. Dat is de bedoeling, geen probleem.",
    "- Stel ze NOOIT voor om op te ruimen, om te leiden, samen te voegen of te verhuizen.",
    "- Noem ze ook niet als verliezer in een cluster en gebruik ze niet als redirect-doel.",
    "- Kom je ze tegen in de data, sla ze dan gewoon over.",
  ].join("\n");
}

export async function regelsAlsInstructie(slug: string, ads?: AdsPaginas): Promise<string> {
  const structuur = [await structuurAlsInstructie(slug), await adsAlsInstructie(slug, ads)].filter(Boolean).join("\n\n");
  const regels = await getOpruimRegels(slug).catch(() => []);
  if (!regels.length) return structuur;
  const houden = regels.filter((r) => r.besluit === "houden");
  const gecorrigeerd = regels.filter((r) => r.besluit === "redirect" && r.naar);
  const genegeerd = regels.filter((r) => r.besluit === "genegeerd");
  const uit: string[] = [];
  if (structuur) uit.push(structuur, "");
  uit.push("EERDERE BESLUITEN VAN MAARTEN. Dit zijn HARDE regels; ze overrulen je eigen analyse zonder discussie.");
  if (houden.length) uit.push(`NOOIT omleiden of opruimen (Maarten heeft besloten dat deze blijven): ${houden.map((r) => r.van + (r.notitie ? ` (${r.notitie})` : "")).join(", ")}.`);
  if (gecorrigeerd.length) uit.push(`Vast redirect-doel, gebruik EXACT dit doel en verzin er geen ander: ${gecorrigeerd.map((r) => `${r.van} -> ${r.naar}`).join("; ")}.`);
  if (genegeerd.length) uit.push(`Niet meer noemen, Maarten heeft ze bewust weggezet: ${genegeerd.map((r) => r.van).join(", ")}.`);
  return uit.join("\n");
}
