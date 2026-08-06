import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { googleStatus } from "./google";
import { getOrgData } from "./org-data";
import { ontbrekendeVelden } from "./org-vereist";
import { getCompetitors } from "./competitors";
import { getEuroInstelling } from "./opruim-euro";
import { hasWpCreds } from "./wp-creds";
import { ahrefsConfigured } from "./ahrefs";
import { PROFILE_HEADER, TOV_HEADER } from "./constants";

// ═══════════════════════════════════════════════════════════
// ONBOARDING: DE VASTE VOLGORDE, DE POORT EN HET SIGNAAL
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat. Alle onderdelen van een klantstart bestonden al, maar elk
// op een eigen plek en zonder volgorde: het klantprofiel bij Pagina's, de
// bedrijfsgegevens bij Klantgegevens, de concurrenten in een eigen tabel, de
// scans op vier tabjes. Gevolg: een scan kon draaien terwijl niemand wist wie de
// klant is, en niemand kon zien wat er bij een bestaande klant nog miste.
//
// Drie dingen regelt dit bestand, en het is voor alle drie de enige bron:
//
// 1. DE VOLGORDE. Eén lijst, hieronder. Het scherm, de startknop en het signaal
//    in de klantenlijst lezen alle drie hieruit, dus ze kunnen nooit iets anders
//    beweren. Dezelfde afspraak als FASE_VOLGORDE voor de zeven pagina-fases.
//
// 2. DE STATUS WORDT AFGELEID, NIET BIJGEHOUDEN. Elke stap heeft één vraag die
//    we beantwoorden uit de echte data ("staat er een tone of voice?", "zijn er
//    concurrenten?", "draaide de scan al?"). Er is dus geen tweede administratie
//    met vinkjes die achter kan gaan lopen, en een bestaande klant hoeft niets
//    extra's: dezelfde lijst toont vanzelf wat er bij hem nog ontbreekt.
//
// 3. DE POORT. Elke stap noemt waar hij van afhangt. `poort()` zegt of een scan
//    mag draaien en zo niet, wat er eerst moet gebeuren. Dat staat hier één keer
//    in plaats van in elk scan-endpoint apart.
//
// Onboarding raakt nooit "af": concurrenten wisselen, een site verandert,
// bedrijfsgegevens verouderen. Daarom heeft een aantal stappen `verouderdNa`.
// ═══════════════════════════════════════════════════════════

import {
  ONBOARDING, STAP, stapLabel,
  type StapKey, type StapDef, type Staat, type StapStand, type Stand, type Door,
} from "./onboarding-stappen";

// De stappenlijst en de typen staan in lib/onboarding-stappen.ts (browser-veilig).
// Alles wat de server erbij doet (de status uitrekenen en de poort) staat hier.
// Her-export, zodat een aanroeper maar één bestand hoeft te kennen.
export * from "./onboarding-stappen";


// ═══════════════════════════════════════════════════════════
// DE FEITEN OPHALEN
// ═══════════════════════════════════════════════════════════
// Bewust rechtstreeks op de tabellen voor de drie scan-runs, in plaats van via
// hun eigen lees-functies: die rekenen er bedragen en voortgangslabels bij die
// we hier niet nodig hebben, en dit lijstje wordt ook voor álle klanten tegelijk
// opgebouwd voor het signaal in de klantenlijst.
// Elke lees-actie heeft zijn eigen vangnet: een tabel die nog nooit is
// aangemaakt (een scan die bij geen enkele klant draaide) mag geen foutmelding
// opleveren, dat is gewoon "nog niet gedaan".

type RunStand = { bezig: boolean; klaar: boolean; sinds: string | null };
const GEEN_RUN: RunStand = { bezig: false, klaar: false, sinds: null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runUitRij(rows: any[]): RunStand {
  const r = rows[0];
  if (!r) return GEEN_RUN;
  return {
    bezig: r.status === "running",
    klaar: !!r.heeft,
    sinds: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
  };
}

async function prioRun(slug: string): Promise<RunStand> {
  try {
    const { rows } = await sql`SELECT status, updated_at, (result IS NOT NULL) AS heeft FROM client_prioriteiten_scan WHERE client_slug = ${slug} LIMIT 1`;
    return runUitRij(rows);
  } catch { return GEEN_RUN; }
}
async function opruimRun(slug: string): Promise<RunStand> {
  try {
    const { rows } = await sql`SELECT status, updated_at, (result IS NOT NULL) AS heeft FROM client_cannibal_analysis WHERE client_slug = ${slug} LIMIT 1`;
    return runUitRij(rows);
  } catch { return GEEN_RUN; }
}
async function linkRun(slug: string): Promise<RunStand> {
  try {
    const { rows } = await sql`SELECT status, updated_at, (result IS NOT NULL) AS heeft FROM client_internal_links WHERE client_slug = ${slug} LIMIT 1`;
    const st = runUitRij(rows);
    // Deze analyse heeft geen cron-vangnet: zonder hartslag is hij afgebroken.
    // Dan hoort hier "nog te doen" te staan en niet "draait", anders wacht je op
    // iets wat nooit meer komt (live aangetroffen, 6 augustus 2026).
    if (st.bezig && st.sinds && Date.now() - new Date(st.sinds).getTime() > 15 * 60 * 1000) return { ...st, bezig: false };
    return st;
  } catch { return GEEN_RUN; }
}
// De Google-profielscan heeft twee stappen die uit dezelfde rij volgen: is er
// een profiel gekoppeld/gevonden, en is er echt doorgemeten. Bewust rechtstreeks
// op de tabel, net als de andere runs hierboven.
type GmbFeiten = { gekoppeld: number; locaties: number; klaar: boolean; bezig: boolean; beheer: boolean; sinds: string | null };
const GEEN_GMB: GmbFeiten = { gekoppeld: 0, locaties: 0, klaar: false, bezig: false, beheer: false, sinds: null };

async function gmbFeiten(slug: string): Promise<GmbFeiten> {
  try {
    const { rows } = await sql`SELECT status, updated_at, result, koppelingen FROM client_gmb WHERE client_slug = ${slug} LIMIT 1`;
    const r = rows[0];
    if (!r) return GEEN_GMB;
    let koppelingen: Record<string, string> = {};
    try { koppelingen = r.koppelingen ? JSON.parse(r.koppelingen as string) : {}; } catch { /* leeg */ }
    let locaties = 0, gevonden = 0, beheer = false;
    try {
      const res = r.result ? JSON.parse(r.result as string) : null;
      if (res && Array.isArray(res.locaties)) {
        locaties = res.locaties.length;
        gevonden = res.locaties.filter((l: { profiel?: unknown }) => !!l.profiel).length;
      }
      beheer = !!res?.beheerdeur?.werkt;
    } catch { /* een kapot resultaat telt als niet gedraaid */ }
    return {
      gekoppeld: Math.max(Object.keys(koppelingen).length, gevonden),
      locaties,
      klaar: r.status === "done" && gevonden > 0,
      bezig: r.status === "running",
      beheer,
      sinds: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
    };
  } catch { return GEEN_GMB; }
}

async function telUrls(slug: string): Promise<{ aantal: number; sinds: string | null }> {
  try {
    const { rows } = await sql`SELECT COUNT(*)::int AS n, MAX(last_scanned) AS laatst FROM client_urls WHERE client_slug = ${slug}`;
    return { aantal: Number(rows[0]?.n || 0), sinds: rows[0]?.laatst ? new Date(rows[0].laatst as string).toISOString() : null };
  } catch { return { aantal: 0, sinds: null }; }
}
async function telKansen(slug: string): Promise<{ aantal: number; sinds: string | null }> {
  try {
    const { rows } = await sql`SELECT COUNT(*)::int AS n, MAX(updated_at) AS laatst FROM client_keyword_opportunities WHERE client_slug = ${slug}`;
    return { aantal: Number(rows[0]?.n || 0), sinds: rows[0]?.laatst ? new Date(rows[0].laatst as string).toISOString() : null };
  } catch { return { aantal: 0, sinds: null }; }
}
async function telStrategie(slug: string): Promise<{ aantal: number; sinds: string | null }> {
  try {
    const { rows } = await sql`SELECT COUNT(*)::int AS n, MAX(created_at) AS laatst FROM client_strategy_sessions WHERE client_slug = ${slug}`;
    return { aantal: Number(rows[0]?.n || 0), sinds: rows[0]?.laatst ? new Date(rows[0].laatst as string).toISOString() : null };
  } catch { return { aantal: 0, sinds: null }; }
}

/** Bevat het profielveld de betreffende automatisch gegenereerde sectie, met inhoud? */
function heeftSectie(profiel: string, header: string): boolean {
  const tekst = profiel || "";
  const i = tekst.indexOf(header);
  if (i === -1) return false;
  const rest = tekst.slice(i + header.length);
  const eind = rest.search(/\n##\s/);
  return (eind === -1 ? rest : rest.slice(0, eind)).trim().length > 40;
}

// ═══════════════════════════════════════════════════════════
// DE STAND PER KLANT
// ═══════════════════════════════════════════════════════════

const dagenGeleden = (iso: string | null): number | null =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null;

export async function getOnboardingStand(slug: string): Promise<Stand> {
  await ensureSchema();
  const client = await getClientBySlug(slug);
  if (!client) {
    return { slug, naam: slug, stappen: [], af: 0, totaal: 0, mist: [], aanJou: [], klaar: false };
  }

  const [google, urls, org, euro, comps, kansen, prio, opruim, links, wp, strat, gmb] = await Promise.all([
    googleStatus().catch(() => ({ configured: false, connected: false, account: null })),
    telUrls(slug),
    getOrgData(slug).catch(() => null),
    getEuroInstelling(slug).catch(() => ({ klantwaarde: 0, conversie: 0, ingevuld: false })),
    getCompetitors(slug).catch(() => [] as string[]),
    telKansen(slug),
    prioRun(slug),
    opruimRun(slug),
    linkRun(slug),
    hasWpCreds(slug).catch(() => false),
    telStrategie(slug),
    gmbFeiten(slug),
  ]);

  const domein = (client.domain || "").trim();
  const profiel = client.seoProfile || "";
  const orgData = org?.data || null;
  const ontbreekt = orgData ? ontbrekendeVelden(orgData) : [];
  const orgGevuld = !!orgData && !!(orgData.bedrijfsnaam || "").trim() && !!orgData.bedrijfstype;

  // Per stap: is hij af, en wat is het detail dat je op het scherm leest? Eén
  // regel per stap, zodat je hier in één oogopslag ziet waaruit de status volgt.
  const uitkomst: Record<StapKey, { af: boolean; bezig?: boolean; detail: string; sinds: string | null }> = {
    domein: { af: !!domein, detail: domein ? `Gekoppeld aan ${domein}.` : "Er is nog geen website-adres ingevuld.", sinds: null },
    searchconsole: {
      af: google.connected,
      detail: !google.configured
        ? "De Google-koppeling is niet ingesteld in deze omgeving."
        : google.connected ? `Gekoppeld${google.account ? ` via ${google.account}` : ""}.` : "Nog niet gekoppeld; zonder Search Console is er geen zoekdata.",
      sinds: null,
    },
    ahrefs: {
      af: !!(client.ahrefsProjectId || "").trim() || ahrefsConfigured(),
      detail: (client.ahrefsProjectId || "").trim()
        ? "Er is een Ahrefs-project aan deze klant gekoppeld."
        : ahrefsConfigured() ? "Ahrefs is beschikbaar; een eigen project-ID is nog niet ingevuld." : "Ahrefs is niet beschikbaar in deze omgeving.",
      sinds: null,
    },
    urls: {
      af: urls.aantal > 0,
      detail: urls.aantal > 0 ? `${urls.aantal} pagina's ingelezen.` : "De pagina's van de site zijn nog niet ingelezen.",
      sinds: urls.sinds,
    },
    beheeromgeving: {
      af: wp || !!(client.backendUrl || "").trim(),
      detail: wp ? "WordPress is gekoppeld; teksten kunnen direct doorgezet worden."
        : (client.backendUrl || "").trim() ? "Er staat een inlogadres voor de beheeromgeving." : "Nog geen koppeling met de beheeromgeving van de site.",
      sinds: null,
    },
    profiel: {
      af: heeftSectie(profiel, PROFILE_HEADER),
      detail: heeftSectie(profiel, PROFILE_HEADER) ? "Het klantprofiel staat er." : "Er is nog geen klantprofiel; teksten en analyses missen hun basis.",
      sinds: null,
    },
    tov: {
      af: heeftSectie(profiel, TOV_HEADER),
      detail: heeftSectie(profiel, TOV_HEADER) ? "De tone of voice is vastgelegd." : "De schrijfstijl van de klant is nog niet vastgelegd.",
      sinds: null,
    },
    bedrijfsgegevens: {
      af: orgGevuld && ontbreekt.length === 0,
      detail: !orgGevuld
        ? "De bedrijfsgegevens zijn nog niet ingevuld; zonder die gegevens kan er geen structured data op de site."
        : ontbreekt.length ? `Nog ${ontbreekt.length} ${ontbreekt.length === 1 ? "gegeven ontbreekt" : "gegevens ontbreken"}: ${ontbreekt.slice(0, 3).map((o) => o.label.toLowerCase()).join(", ")}${ontbreekt.length > 3 ? " en meer" : ""}.`
        : "Compleet.",
      sinds: org?.updatedAt || null,
    },
    werkgebied: (() => {
      const plaatsen = (orgData?.vestigingen || []).map((v) => (v.plaats || "").trim()).filter(Boolean);
      const gebied = orgData?.areaServed || [];
      const bezoek = !!orgData && !orgData.geenBezoekadres && !!(orgData.plaats || "").trim();
      return {
        af: gebied.length > 0 || bezoek || plaatsen.length > 0,
        detail: gebied.length
          ? `Werkgebied: ${gebied.slice(0, 4).join(", ")}${gebied.length > 4 ? " en meer" : ""}.`
          : plaatsen.length
            ? `Volgt uit de vestigingen: ${[...new Set(plaatsen)].slice(0, 4).join(", ")}${plaatsen.length > 4 ? " en meer" : ""}.`
            : bezoek
              ? `Volgt uit het bezoekadres in ${orgData!.plaats}.`
              : "Nog niet bepaald waar de klant zijn klanten vandaan haalt.",
        sinds: org?.updatedAt || null,
      };
    })(),
    concurrenten: {
      af: comps.length >= 2,
      detail: comps.length ? `${comps.length} ${comps.length === 1 ? "concurrent" : "concurrenten"}: ${comps.join(", ")}.` : "Er zijn nog geen concurrenten bepaald.",
      sinds: null,
    },
    klantwaarde: {
      af: euro.ingevuld,
      detail: euro.ingevuld
        ? `€ ${Math.round(euro.klantwaarde).toLocaleString("nl-NL")} per klant, ${euro.conversie}% conversie.`
        : "Klantwaarde en conversiepercentage zijn nog niet ingevuld; alle lijsten blijven daardoor zonder bedragen.",
      sinds: null,
    },
    googleprofiel: {
      af: gmb.gekoppeld > 0,
      bezig: gmb.bezig,
      detail: gmb.gekoppeld > 0
        ? `${gmb.gekoppeld} ${gmb.gekoppeld === 1 ? "profiel" : "profielen"} gekoppeld${gmb.locaties > gmb.gekoppeld ? ` van ${gmb.locaties} vestigingen` : ""}.`
        : "Er is nog geen Google-bedrijfsprofiel gekoppeld; zonder profiel meten we niets op de kaart.",
      sinds: gmb.sinds,
    },
    gmbbeheer: {
      af: gmb.beheer,
      detail: gmb.beheer
        ? "Pingwin is beheerder; de bezoekcijfers van het profiel komen binnen."
        : "Nog geen beheertoegang. Vraag de klant om Pingwin als beheerder toe te voegen, dan zien we hoe vaak het profiel gezien wordt en wat optimalisaties opleveren.",
      sinds: null,
    },
    gmbscan: {
      af: gmb.klaar,
      bezig: gmb.bezig,
      detail: gmb.klaar ? "Het Google-profiel is doorgemeten." : gmb.bezig ? "De profielscan draait." : "Het Google-profiel is nog niet doorgemeten.",
      sinds: gmb.sinds,
    },
    zoekwoorden: {
      af: kansen.aantal > 0,
      detail: kansen.aantal > 0 ? `${kansen.aantal} zoekwoordkansen verzameld.` : "De zoekwoordkansen zijn nog niet opgehaald.",
      sinds: kansen.sinds,
    },
    prioriteiten: { af: prio.klaar, bezig: prio.bezig, detail: prio.klaar ? "De prioriteitenscan is gedraaid." : prio.bezig ? "De scan draait." : "De prioriteitenscan is nog nooit gedraaid voor deze klant.", sinds: prio.sinds },
    opruimen: { af: opruim.klaar, bezig: opruim.bezig, detail: opruim.klaar ? "De opruimanalyse is gedraaid." : opruim.bezig ? "De analyse draait." : "Er is nog niet gekeken welke pagina's elkaar in de weg zitten.", sinds: opruim.sinds },
    internelinks: { af: links.klaar, bezig: links.bezig, detail: links.klaar ? "De interne-link-analyse is gedraaid." : links.bezig ? "De analyse draait." : "De interne links zijn nog niet doorgemeten.", sinds: links.sinds },
    strategie: {
      af: strat.aantal > 0,
      detail: strat.aantal > 0 ? `${strat.aantal} ${strat.aantal === 1 ? "strategiesessie" : "strategiesessies"} vastgelegd.` : "De koers is nog niet vastgelegd in een strategiesessie.",
      sinds: strat.sinds,
    },
  };

  const afSet = new Set<StapKey>(ONBOARDING.filter((s) => uitkomst[s.key].af).map((s) => s.key));

  const stappen: StapStand[] = ONBOARDING.map((def) => {
    const u = uitkomst[def.key];
    const oud = def.verouderdNa != null && u.af && (dagenGeleden(u.sinds) ?? 0) > def.verouderdNa;
    const staat: Staat = u.af ? (oud ? "verouderd" : "af") : u.bezig ? "bezig" : "open";
    const dagen = dagenGeleden(u.sinds);
    return {
      ...def,
      staat,
      detail: oud ? `${u.detail} Voor het laatst bijgewerkt ${dagen} dagen geleden; tijd om opnieuw te kijken.` : u.detail,
      sinds: u.sinds,
      wacht: u.af ? [] : def.nodig.filter((n) => !afSet.has(n)).map((n) => ({ key: n, label: stapLabel(n) })),
    };
  });

  const verplicht = stappen.filter((s) => !s.optioneel);
  const af = verplicht.filter((s) => s.staat === "af").length;
  const mist = verplicht.filter((s) => s.staat === "open" || s.staat === "verouderd").map((s) => s.label);
  const aanJou = verplicht.filter((s) => s.staat === "open" && s.door === "jij" && !s.wacht.length).map((s) => s.key);

  return { slug, naam: client.name, stappen, af, totaal: verplicht.length, mist, aanJou, klaar: af === verplicht.length };
}

// ═══════════════════════════════════════════════════════════
// DE POORT
// ═══════════════════════════════════════════════════════════
// Eén functie die zegt of iets mag draaien. Het antwoord is bewust een hele zin
// plus de ontbrekende stappen, zodat het scherm er meteen een knop van kan maken
// die naar de juiste plek brengt, in plaats van "er ging iets mis".
//
// De keten wordt helemaal uitgelopen: mist het website-adres, dan is niet alleen
// "pagina's ingelezen" open maar ook alles wat dáárvan afhangt, en dan moet de
// melding het adres noemen en niet een tussenstap.

export type PoortUitslag = { mag: boolean; reden: string; ontbreekt: { key: StapKey; label: string; door: Door; tab?: string }[] };

function ketenTekort(stand: Stand, keys: StapKey[], gezien = new Set<StapKey>()): StapKey[] {
  const uit: StapKey[] = [];
  for (const k of keys) {
    if (gezien.has(k)) continue;
    gezien.add(k);
    const s = stand.stappen.find((x) => x.key === k);
    if (!s || s.staat === "af" || s.staat === "verouderd") continue;
    const dieper = ketenTekort(stand, s.nodig, gezien);
    if (dieper.length) uit.push(...dieper);
    else uit.push(k);
  }
  return uit;
}

/**
 * Mag deze stap draaien? Geef de stap zelf mee (bijvoorbeeld "prioriteiten"),
 * niet zijn voorwaarden; die staan in de lijst hierboven.
 */
export async function poort(slug: string, key: StapKey): Promise<PoortUitslag> {
  const def = STAP.get(key);
  if (!def) return { mag: true, reden: "", ontbreekt: [] };
  const stand = await getOnboardingStand(slug);
  const tekort = ketenTekort(stand, def.nodig);
  if (!tekort.length) return { mag: true, reden: "", ontbreekt: [] };

  const ontbreekt = tekort.map((k) => {
    const d = STAP.get(k)!;
    return { key: k, label: d.label, door: d.door, tab: d.tab };
  });
  const namen = ontbreekt.map((o) => o.label.toLowerCase());
  const lijst = namen.length === 1 ? namen[0] : `${namen.slice(0, -1).join(", ")} en ${namen[namen.length - 1]}`;
  return {
    mag: false,
    reden: `${def.label} kan nog niet: eerst ${lijst}. Zonder die inventarisatie levert deze analyse een gok op in plaats van een meting. Je regelt het op de Onboarding-pagina.`,
    ontbreekt,
  };
}

/**
 * De poort voor de pagina-documenten (analyse, blauwdruk, copy). Die horen niet
 * in de stappenlijst thuis (ze zijn per pagina, niet per klant), maar ze mogen
 * net zo min draaien zonder inventarisatie: zonder klantprofiel en tone of voice
 * schrijft een analyse over een willekeurig bedrijf in een willekeurige stem.
 */
export async function poortDocumenten(slug: string): Promise<PoortUitslag> {
  const stand = await getOnboardingStand(slug);
  const tekort = ketenTekort(stand, ["profiel", "tov"]);
  if (!tekort.length) return { mag: true, reden: "", ontbreekt: [] };
  const ontbreekt = tekort.map((k) => { const d = STAP.get(k)!; return { key: k, label: d.label, door: d.door, tab: d.tab }; });
  const namen = ontbreekt.map((o) => o.label.toLowerCase());
  return {
    mag: false,
    reden: `Dit document kan nog niet: eerst ${namen.join(" en ")}. Anders schrijft de tekst over een willekeurig bedrijf in een willekeurige stem. Eén klik op de Onboarding-pagina regelt het.`,
    ontbreekt,
  };
}

/** Kort samengevat voor het signaal in de klantenlijst. */
export type Signaal = { slug: string; af: number; totaal: number; mist: string[]; aanJou: number; klaar: boolean };

// De klantenlijst vraagt dit voor álle klanten tegelijk. Vijf minuten cache in
// het geheugen van de instantie: het is een signaal, geen live meting, en zonder
// cache zou elke keer openen tientallen klanten x tien queries kosten.
let cache: { tijd: number; data: Signaal[] } | null = null;

export async function getOnboardingSignalen(slugs: string[]): Promise<Signaal[]> {
  if (cache && Date.now() - cache.tijd < 300000) return cache.data;
  const uit: Signaal[] = [];
  // Vier klanten tegelijk: genoeg om snel te zijn, weinig genoeg om de database
  // niet vol te zetten met een piek bij elk openen van het overzicht.
  for (let i = 0; i < slugs.length; i += 4) {
    const groep = await Promise.all(slugs.slice(i, i + 4).map((s) =>
      getOnboardingStand(s).then((st) => ({ slug: s, af: st.af, totaal: st.totaal, mist: st.mist, aanJou: st.aanJou.length, klaar: st.klaar }))
        .catch(() => ({ slug: s, af: 0, totaal: 0, mist: [], aanJou: 0, klaar: false }))));
    uit.push(...groep);
  }
  cache = { tijd: Date.now(), data: uit };
  return uit;
}

export function wisSignaalCache(): void { cache = null; }
