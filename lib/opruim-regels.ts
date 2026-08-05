import { sql, ensureSchema } from "./db";
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
  updatedAt: string | null;
};

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ready) ready = doEnsure().catch((e) => { ready = null; throw e; });
  return ready;
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
}

const padVan = (u: string) => { try { return new URL(u).pathname; } catch { return (u || "").trim(); } };

export async function getOpruimRegels(slug: string): Promise<OpruimRegel[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT van, besluit, naar, notitie, doorgevoerd, updated_at
    FROM client_opruim_regels WHERE client_slug = ${slug} ORDER BY van`;
  return rows.map((r) => ({
    van: r.van as string,
    besluit: ((r.besluit as string) || "redirect") as OpruimRegel["besluit"],
    naar: (r.naar as string) || "",
    notitie: (r.notitie as string) || "",
    doorgevoerd: !!r.doorgevoerd,
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
  await sql`
    INSERT INTO client_opruim_regels (client_slug, van, besluit, naar, notitie, doorgevoerd, updated_at)
    VALUES (${slug}, ${p}, ${besluit || "redirect"}, ${naar}, ${notitie}, ${doorgevoerd ?? false}, now())
    ON CONFLICT (client_slug, van) DO UPDATE SET
      besluit     = COALESCE(${besluit}, client_opruim_regels.besluit),
      naar        = COALESCE(${naar}, client_opruim_regels.naar),
      notitie     = COALESCE(${notitie}, client_opruim_regels.notitie),
      doorgevoerd = COALESCE(${doorgevoerd}, client_opruim_regels.doorgevoerd),
      updated_at  = now()`;
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

/** Is een pad een advertentiepagina? Ook alles eronder telt mee, zodat een hele
    map (bijvoorbeeld /ads/) in één regel afgeschermd is. */
export function isAdsPad(pad: string, ads: AdsPaginas): boolean {
  const p = padVan(pad).replace(/\/$/, "").toLowerCase();
  return ads.paden.some((a) => {
    const b = a.replace(/\/$/, "").toLowerCase();
    return p === b || p.startsWith(b + "/");
  });
}

export async function adsAlsInstructie(slug: string): Promise<string> {
  const ads = await getAdsPaginas(slug);
  if (!ads.paden.length) return "";
  return [
    "ADVERTENTIEPAGINA'S. Dit is een HARDE regel en kent geen uitzondering.",
    `Deze pagina's (en alles eronder) zijn landingspagina's voor Google Ads: ${ads.paden.join(", ")}.`,
    "Ze staan vaak op noindex en halen daarom weinig of niets uit de organische zoekresultaten. Dat is de bedoeling, geen probleem.",
    "- Stel ze NOOIT voor om op te ruimen, om te leiden, samen te voegen of te verhuizen.",
    "- Noem ze ook niet als verliezer in een cluster en gebruik ze niet als redirect-doel.",
    "- Kom je ze tegen in de data, sla ze dan gewoon over.",
  ].join("\n");
}

export async function regelsAlsInstructie(slug: string): Promise<string> {
  const structuur = [await structuurAlsInstructie(slug), await adsAlsInstructie(slug)].filter(Boolean).join("\n\n");
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
