import { getGscQueryPagePairs } from "./google";
import { getClientUrls } from "./site-urls";
import { termUitPad } from "./opruim-waarde";
import { feitenPerTerm, kampVan, intentieUitleg, type Intentie, type Kamp } from "./opruim-intentie";
import { weegHaalbaarheid, autoriteitVan, type Haalbaarheid } from "./opruim-haalbaarheid";

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
//
// AANVULLING 06-08-2026, de twee remmen. Woorden delen is niet hetzelfde als
// hetzelfde onderwerp zijn. "soa test kopen" en "wat is een soa test" delen bijna
// alles, maar de één wil bestellen en de ander wil het snappen; die op één hoop
// gooien kost een van beide bezoekers. Een cluster wordt daarom eerst gesplitst
// op zoekintentie (opruim-intentie.ts), en pas daarna beoordeeld. En elk cluster
// krijgt een haalbaarheidsoordeel (opruim-haalbaarheid.ts): drie pagina's bundelen
// voor een term die ver boven de autoriteit van het domein ligt is werk zonder
// uitkomst, en dat hoort erbij te staan vóór iemand het op de planning zet.
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
  intentie?: Intentie;     // wat wil iemand die deze term intypt
};

export type Onderwerp = {
  sleutel: string;         // het gedeelde woord, bijvoorbeeld "thuis"
  paginas: OnderwerpPagina[];
  termen: { keyword: string; volume: number | null; positie: number | null }[];
  volumeTotaal: number;    // zoekopdrachten per maand voor het hele onderwerp
  bestePositie: number | null;
  voorstel: string;        // de pagina die de beste thuisbasis is
  /** Het kamp waar dit cluster in valt: wil de bezoeker doen of eerst weten. */
  kamp?: Kamp;
  /** Kan dit onderwerp gewonnen worden met de autoriteit die deze site heeft? */
  haalbaarheid?: Haalbaarheid;
  /** Pagina's die op woorden bij dit cluster hoorden maar er bewust NIET in gaan,
      omdat de bezoeker daar iets anders wil. Zichtbaar, want een pagina die
      stilletjes verdwijnt uit een lijst is niet te controleren. */
  apartGehouden?: { pad: string; term: string; intentie: Intentie; reden: string }[];
  /** Wat dit onderwerp waard is per maand; berekend bij het uitlezen. */
  euro?: import("./opruim-euro").Euro | null;
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
  // Volume, moeilijkheid én intentie per term, plus de autoriteit van het domein.
  const [feiten, autoriteit] = await Promise.all([
    feitenPerTerm([...alleTermen]),
    autoriteitVan(domain).catch(() => null),
  ]);

  const uit: Onderwerp[] = [];
  for (const [woord, paden] of kandidaten) {
    const uniek = [...new Set(paden)];
    const paginas: OnderwerpPagina[] = uniek.map((p) => {
      const g = perPagina.get(norm(p));
      const term = termUitPad(p);
      return {
        pad: p, term,
        bestePositie: g?.beste != null ? Math.round(g.beste * 10) / 10 : null,
        vertoningen: g?.vertoningen || 0, klikken: g?.klikken || 0,
        intentie: feiten.get(term)?.intentie ?? "",
      };
    });

    // REM 1. Splitsen op zoekintentie vóór er ook maar iets gebundeld wordt.
    // Pagina's waar de bezoeker wil DOEN en pagina's waar hij wil WETEN zijn geen
    // één onderwerp, hoeveel woorden ze ook delen. Merk- en onbekende termen
    // kiezen geen kant: die sluiten aan bij het grootste kamp, want ze passen
    // overal bij en mogen een cluster nooit uit elkaar trekken op een aanname.
    const doen = paginas.filter((p) => kampVan(p.intentie || "") === "doen");
    const weten = paginas.filter((p) => kampVan(p.intentie || "") === "weten");
    const rest = paginas.filter((p) => { const k = kampVan(p.intentie || ""); return k !== "doen" && k !== "weten"; });

    const groepen: { kamp: Kamp; leden: OnderwerpPagina[]; anderen: OnderwerpPagina[] }[] =
      doen.length && weten.length
        ? [
            { kamp: "doen" as Kamp, leden: [...doen, ...(doen.length >= weten.length ? rest : [])], anderen: weten },
            { kamp: "weten" as Kamp, leden: [...weten, ...(weten.length > doen.length ? rest : [])], anderen: doen },
          ]
        : [{ kamp: (doen.length ? "doen" : weten.length ? "weten" : "onbekend") as Kamp, leden: paginas, anderen: [] }];

    for (const groep of groepen) {
      const leden = groep.leden;
      if (leden.length < MIN_PAGINAS) continue;

      // Alleen interessant als er echt volume in zit en niemand hem pakt. Staat er
      // al een pagina in de top 10, dan is dit onderwerp gewoon in orde.
      const termen = leden
        .map((p) => ({ keyword: p.term, volume: feiten.get(p.term)?.volume ?? null, positie: p.bestePositie }))
        .filter((t) => t.keyword && (t.volume || 0) > 0);
      const volumeTotaal = termen.reduce((n, t) => n + (t.volume || 0), 0);
      if (volumeTotaal < 200) continue;

      const posities = leden.map((p) => p.bestePositie).filter((p): p is number => p != null);
      const bestePositie = posities.length ? Math.min(...posities) : null;
      if (bestePositie != null && bestePositie <= BUITEN_BEELD) continue;

      // Welke pagina is de logische thuisbasis? Die met de meeste klikken; bij
      // gelijke stand die met de beste positie, en anders de eerste. Bewust een
      // voorstel en geen besluit: Maarten kiest.
      const voorstel = [...leden].sort((a, b) =>
        b.klikken - a.klikken ||
        (a.bestePositie ?? 999) - (b.bestePositie ?? 999) ||
        b.vertoningen - a.vertoningen)[0]?.pad || leden[0].pad;

      // REM 2. De zwaarste term van het cluster bepaalt of dit te winnen is; dat is
      // de term waar de thuisbasis straks op moet gaan staan.
      const gesorteerd = termen.sort((a, b) => (b.volume || 0) - (a.volume || 0));
      const hoofdterm = gesorteerd[0]?.keyword || "";
      const haalbaarheid = weegHaalbaarheid(feiten.get(hoofdterm)?.moeilijkheid ?? null, autoriteit, bestePositie);

      uit.push({
        sleutel: groepen.length > 1 ? `${woord}:${groep.kamp}` : woord,
        paginas: leden.sort((a, b) => (a.bestePositie ?? 999) - (b.bestePositie ?? 999)),
        termen: gesorteerd,
        volumeTotaal, bestePositie, voorstel,
        kamp: groep.kamp,
        haalbaarheid,
        apartGehouden: groep.anderen.map((p) => ({
          pad: p.pad, term: p.term, intentie: p.intentie || "",
          reden: `Hoort qua woorden bij dit onderwerp, maar iemand die "${p.term}" zoekt ${intentieUitleg(p.intentie || "")}. Die bezoeker heeft een andere pagina nodig, dus deze gaat er bewust niet in op.`,
        })),
      });
    }
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
