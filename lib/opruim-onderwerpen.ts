import { getKeywordsOverview } from "./ahrefs";
import { getGscQueryPagePairs } from "./google";
import { getClientUrls } from "./site-urls";
import { termUitPad } from "./opruim-waarde";

// ═══════════════════════════════════════════════════════════
// HET ONDERWERP-CLUSTER: EEN THEMA DAT OVER MEERDERE PAGINA'S LIGT
// ═══════════════════════════════════════════════════════════
// Waarom dit nodig was. De opruim-analyse koos een bestemming op één regel:
// "welke pagina bezit het zoekwoord dat deze pagina leent, gemeten in
// vertoningen". Dat gaat mis zodra een heel onderwerp verspreid ligt over
// pagina's die géén van alle goed scoren.
//
// Het echte voorbeeld (05-08-2026):
//   /soa-test-thuis/    rankt nergens op
//   /soa-thuistest/     "soa thuistest", 500 per maand, plek 28
//   /anonieme-soa-test/ "soa zelftest" 1000 (plek 43), "thuis soa test" 200 (plek 11)
// Samen ruim 2000 zoekopdrachten per maand, en geen enkele pagina in de top 10.
// De motor stelde voor om /soa-test-thuis/ naar /anonieme-soa-test/ te leiden,
// puur omdat die toevallig de meeste vertoningen had op de geleende term. Dat
// /soa-thuistest/ over exact hetzelfde gaat, kwam nergens in beeld.
//
// Eén omleiding is hier het verkeerde antwoord. De vraag is: welke van deze
// pagina's wordt de thuisbasis voor dit onderwerp, en wat doen we met de rest.
// Dat is een besluit, geen regel, dus het krijgt een eigen blok in plaats van
// stilletjes een bestemming.
// ═══════════════════════════════════════════════════════════

/** Woorden die in bijna elke URL voorkomen en dus niets zeggen over het onderwerp. */
const RUIS = new Set(["nl", "en", "de", "het", "een", "www", "index", "home", "page", "pagina", "html", "php", "over", "ons"]);

/**
 * De stam van een woord, zodat spellingvarianten samenvallen. "thuistest",
 * "thuistesten" en "thuis" worden allemaal "thuis"; "zelftest" wordt "zelf".
 * Bewust grof: we zoeken familie, geen taalkundige perfectie.
 */
export function stam(woord: string): string {
  let w = woord.toLowerCase();
  w = w.replace(/(testen|test|tests)$/, "");
  w = w.replace(/(en|s)$/, "");
  return w.length >= 3 ? w : woord.toLowerCase();
}

export function onderwerpWoorden(pad: string): string[] {
  return (pad || "").toLowerCase().split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !RUIS.has(w))
    .map(stam)
    .filter((w) => w.length > 2);
}

export type OnderwerpPagina = {
  pad: string;
  term: string;            // waar deze pagina op mikt (uit het pad)
  bestePositie: number | null;
  vertoningen: number;
  klikken: number;
};

export type Onderwerp = {
  sleutel: string;         // het gedeelde woord, bijvoorbeeld "thuis"
  paginas: OnderwerpPagina[];
  termen: { keyword: string; volume: number | null; positie: number | null }[];
  volumeTotaal: number;    // zoekopdrachten per maand voor het hele onderwerp
  bestePositie: number | null;
  voorstel: string;        // de pagina die de beste thuisbasis is
};

const padVan = (u: string) => { try { return new URL(u).pathname; } catch { return (u || "").trim(); } };
const norm = (u: string) => padVan(u).replace(/\/+$/, "").toLowerCase();

/** Vanaf hoeveel pagina's over hetzelfde onderwerp is het een cluster? */
const MIN_PAGINAS = 3;
/** En vanaf welke positie noemen we het "staat niemand in de top"? */
const BUITEN_BEELD = 10;

/**
 * Zoekt onderwerpen die over meerdere pagina's verspreid liggen zonder dat er
 * één van in de top 10 staat. Gebruikt de eigen Search Console-data plus het
 * zoekvolume, allebei al beschikbaar; de Ahrefs-opvraag zit achter de cache van
 * 30 dagen, dus een tweede analyse in dezelfde maand kost niets extra.
 */
export async function vindOnderwerpen(slug: string, domain: string): Promise<Onderwerp[]> {
  const [urls, paren] = await Promise.all([
    getClientUrls(slug).catch(() => []),
    getGscQueryPagePairs(domain, 90).catch(() => []),
  ]);
  const live = urls.filter((u) => (u.status ?? 200) === 200);
  if (live.length < MIN_PAGINAS) return [];

  // Per pagina de cijfers uit Search Console.
  const perPagina = new Map<string, { klikken: number; vertoningen: number; beste: number | null }>();
  for (const p of paren) {
    const k = norm(p.page);
    const e = perPagina.get(k) || { klikken: 0, vertoningen: 0, beste: null };
    e.klikken += p.clicks; e.vertoningen += p.impressions;
    if (e.beste == null || p.position < e.beste) e.beste = p.position;
    perPagina.set(k, e);
  }

  // Welke pagina's delen een onderwerpswoord? Een woord dat op de halve site
  // staat (soa, test) is geen onderwerp maar ruis, dus die vallen af.
  const perWoord = new Map<string, string[]>();
  for (const u of live) {
    const pad = padVan(u.url);
    for (const w of new Set(onderwerpWoorden(pad))) {
      if (!perWoord.has(w)) perWoord.set(w, []);
      perWoord.get(w)!.push(pad);
    }
  }
  const bovengrens = Math.max(MIN_PAGINAS + 1, Math.round(live.length * 0.08));

  const kandidaten = [...perWoord.entries()]
    .filter(([, paden]) => paden.length >= MIN_PAGINAS && paden.length <= bovengrens);
  if (!kandidaten.length) return [];

  // Het zoekvolume van de term per pagina, in één opvraag voor alles.
  const alleTermen = new Set<string>();
  for (const [, paden] of kandidaten) for (const p of paden) {
    const t = termUitPad(p);
    if (t && t.split(" ").length >= 2) alleTermen.add(t);
  }
  const overzicht = await getKeywordsOverview([...alleTermen]).catch(() => []);
  const volumes = new Map(overzicht.map((o) => [o.keyword.toLowerCase(), o.volume]));

  const uit: Onderwerp[] = [];
  for (const [woord, paden] of kandidaten) {
    const uniek = [...new Set(paden)];
    const paginas: OnderwerpPagina[] = uniek.map((p) => {
      const g = perPagina.get(norm(p));
      return {
        pad: p, term: termUitPad(p),
        bestePositie: g?.beste != null ? Math.round(g.beste * 10) / 10 : null,
        vertoningen: g?.vertoningen || 0, klikken: g?.klikken || 0,
      };
    });

    // Alleen interessant als er echt volume in zit en niemand hem pakt. Staat er
    // al een pagina in de top 10, dan is dit onderwerp gewoon in orde.
    const termen = paginas
      .map((p) => ({ keyword: p.term, volume: volumes.get(p.term) ?? null, positie: p.bestePositie }))
      .filter((t) => t.keyword && (t.volume || 0) > 0);
    const volumeTotaal = termen.reduce((n, t) => n + (t.volume || 0), 0);
    if (volumeTotaal < 200) continue;

    const posities = paginas.map((p) => p.bestePositie).filter((p): p is number => p != null);
    const bestePositie = posities.length ? Math.min(...posities) : null;
    if (bestePositie != null && bestePositie <= BUITEN_BEELD) continue;

    // Welke pagina is de logische thuisbasis? Die met de meeste klikken; bij
    // gelijke stand die met de beste positie, en anders de eerste. Bewust een
    // voorstel en geen besluit: Maarten kiest.
    const voorstel = [...paginas].sort((a, b) =>
      b.klikken - a.klikken ||
      (a.bestePositie ?? 999) - (b.bestePositie ?? 999) ||
      b.vertoningen - a.vertoningen)[0]?.pad || uniek[0];

    uit.push({
      sleutel: woord,
      paginas: paginas.sort((a, b) => (a.bestePositie ?? 999) - (b.bestePositie ?? 999)),
      termen: termen.sort((a, b) => (b.volume || 0) - (a.volume || 0)),
      volumeTotaal, bestePositie, voorstel,
    });
  }

  return uit.sort((a, b) => b.volumeTotaal - a.volumeTotaal).slice(0, 12);
}

/**
 * De inhoudelijke tweeling van een pagina: bestaande pagina's die over hetzelfde
 * onderwerp gaan. Hiermee krijgt een omleiding een tweede kandidaat-bestemming
 * naast "wie bezit de geleende term", zodat /soa-test-thuis/ ook /soa-thuistest/
 * in beeld krijgt in plaats van alleen /anonieme-soa-test/.
 */
export function tweelingenVan(pad: string, allePaden: string[], maxDeelSite = 0.08): string[] {
  const eigen = new Set(onderwerpWoorden(pad));
  if (!eigen.size) return [];
  const freq = new Map<string, number>();
  for (const p of allePaden) for (const w of new Set(onderwerpWoorden(p))) freq.set(w, (freq.get(w) || 0) + 1);
  const grens = Math.max(4, Math.round(allePaden.length * maxDeelSite));

  return allePaden
    .filter((p) => norm(p) !== norm(pad))
    .map((p) => {
      const anders = new Set(onderwerpWoorden(p));
      let gedeeld = 0;
      for (const w of eigen) if (anders.has(w) && (freq.get(w) || 0) <= grens) gedeeld++;
      return { p, gedeeld };
    })
    .filter((x) => x.gedeeld > 0)
    .sort((a, b) => b.gedeeld - a.gedeeld)
    .slice(0, 3)
    .map((x) => padVan(x.p));
}
