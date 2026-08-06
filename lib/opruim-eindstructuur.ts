import { getClientUrls } from "./site-urls";
import { getAdsPaginas, isAdsPad, getUrlStructuur } from "./opruim-regels";
import { onderwerpWoorden } from "./opruim-onderwerpen";
import type { CannibalResult } from "./cannibal-redirect";

// ═══════════════════════════════════════════════════════════
// HOE DE SITE ERUITZIET ALS DIT ALLEMAAL DOORGEVOERD IS
// ═══════════════════════════════════════════════════════════
// De lijsten hierboven zijn stuk voor stuk begrijpelijk en samen niet te
// overzien: 433 live pagina's, zestig omleidingen, een handvol onderwerpen om te
// bundelen, een paar pagina's om opnieuw op te bouwen en een lijst ontbrekende
// pagina's. Wie dat leest ziet werk, geen resultaat.
//
// Dit blok laat het resultaat zien: de site zoals hij eruitziet als alles is
// doorgevoerd. Netjes gegroepeerd, met per tak de hoofdpagina en de pagina's die
// daaronder horen. Dát is waar het opruimen voor bedoeld was, en het is ook het
// enige beeld dat je aan een klant kunt laten zien zonder eerst zes lijsten uit
// te leggen.
//
// De rekensom is bewust dom en herhaalbaar, zonder AI: neem wat er live staat,
// haal eraf wat wordt omgeleid, haal eraf wat in een thuisbasis opgaat, tel erbij
// op wat er nog moet komen, en groepeer wat overblijft. Twee keer draaien op
// dezelfde gegevens hoort twee keer hetzelfde beeld te geven; een taalmodel zou
// dat niet garanderen.
// ═══════════════════════════════════════════════════════════

export type Rol = "blijft" | "thuisbasis" | "opnieuw opbouwen" | "nieuw";

export type EindPagina = {
  pad: string;
  rol: Rol;
  /** Eén zin: waarom staat deze pagina hier, en wat gebeurt ermee. */
  toelichting: string;
  /** Hoeveel pagina's er in deze pagina opgaan. */
  slokt: string[];
};

export type Tak = {
  /** Vaste sleutel voor deze tak, ook als er geen hoofdpagina is. */
  sleutel: string;
  /** Het pad van de hoofdpagina, leeg als die niet bestaat. */
  pad: string;
  titel: string;
  /** Bestaat de hoofdpagina zelf, of is dit alleen een groepering? */
  bestaat: boolean;
  kinderen: EindPagina[];
};

export type Eindstructuur = {
  takken: Tak[];
  losse: EindPagina[];
  nu: number;          // live pagina's op dit moment
  straks: number;      // wat er overblijft plus wat erbij komt
  weg: number;         // omgeleid of opgegaan in een andere pagina
  erbij: number;       // nieuw te maken
  vorm: string;        // de vastgelegde URL-vorm, als die er is
  volledig: boolean;   // is er een analyse om op te baseren
};

const padVan = (u: string) => { try { return new URL(u).pathname; } catch { return (u || "").trim(); } };
const norm = (p: string) => padVan(p).replace(/\/+$/, "").toLowerCase() || "/";

/** Vanaf hoeveel pagina's noemen we iets een tak. Minder is geen structuur. */
const MIN_TAK = 3;

function mooi(pad: string): string {
  const laatste = norm(pad).split("/").filter(Boolean).pop() || "";
  const t = laatste.replace(/-/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Hoofdpagina";
}

/**
 * De structuur zoals hij wordt. Werkt op de uitkomst die er ligt; is er nog geen
 * analyse, dan toont hij eerlijk de huidige situatie in plaats van te doen alsof
 * er al opgeruimd is.
 */
export async function bouwEindstructuur(slug: string, result: CannibalResult | null): Promise<Eindstructuur> {
  const [urls, ads, vorm] = await Promise.all([
    getClientUrls(slug).catch(() => []),
    getAdsPaginas(slug).catch(() => ({ paden: [], geen: false, ingevuld: false })),
    getUrlStructuur(slug).catch(() => ""),
  ]);
  const live = urls
    .filter((u) => (u.status ?? 200) === 200)
    .map((u) => norm(u.url))
    .filter((p) => !isAdsPad(p, ads));
  const uniekLive = [...new Set(live)];

  // Wat verdwijnt er. Twee bronnen: de werklijst (omleiden) en de onderwerpen
  // (alles wat niet de thuisbasis is, gaat daarin op).
  const verdwijnt = new Map<string, string>();     // pad -> waar het heen gaat
  for (const r of result?.redirectMap || []) {
    const van = norm(String(r.van || "")), naar = norm(String(r.naar || ""));
    if (van && naar && van !== naar) verdwijnt.set(van, naar);
  }
  for (const o of result?.onderwerpen || []) {
    const thuis = norm(o.voorstel);
    for (const p of o.paginas) {
      const pad = norm(p.pad);
      if (pad !== thuis) verdwijnt.set(pad, thuis);
    }
  }

  // Wat krijgt een bijzondere rol. Thuisbasis: hier gaan andere pagina's in op.
  const thuisbasis = new Map<string, string>();
  for (const o of result?.onderwerpen || []) {
    const t = norm(o.voorstel);
    thuisbasis.set(t, `Wordt de vaste pagina voor "${o.termen[0]?.keyword || o.sleutel}", goed voor ongeveer ${o.volumeTotaal} zoekopdrachten per maand.`);
  }
  const opnieuw = new Map<string, string>();
  for (const o of result?.oppakken || []) {
    opnieuw.set(norm(o.pad), `Blijft staan en wordt opnieuw opgebouwd voor "${o.term}" (${o.volume ?? "?"} per maand).`);
  }

  // Wat er bij komt: de ontbrekende pagina's die echt nieuw zijn.
  const nieuw = (result?.gaten || [])
    .filter((g) => g.soort === "nieuwe pagina" && g.haalbaarheid?.oordeel !== "buiten bereik")
    .map((g) => ({ pad: norm(g.voorstelPad.split("  (")[0]), term: g.term, volume: g.volume }))
    .filter((g) => g.pad && g.pad !== "/" && !uniekLive.includes(g.pad));

  // Wie slokt wie op, zodat je onder een pagina ziet wat erin verdwijnt.
  const sloktOp = new Map<string, string[]>();
  for (const [van, naar] of verdwijnt.entries()) {
    if (!sloktOp.has(naar)) sloktOp.set(naar, []);
    sloktOp.get(naar)!.push(van);
  }

  const blijvers: EindPagina[] = uniekLive
    .filter((p) => !verdwijnt.has(p))
    .map((p) => {
      const slokt = (sloktOp.get(p) || []).sort();
      const rol: Rol = thuisbasis.has(p) ? "thuisbasis" : opnieuw.has(p) ? "opnieuw opbouwen" : "blijft";
      const toelichting = thuisbasis.get(p) || opnieuw.get(p) ||
        (slokt.length
          ? `Blijft, en wordt sterker: ${slokt.length} ${slokt.length === 1 ? "pagina gaat" : "pagina's gaan"} hierin op.`
          : "Blijft ongewijzigd staan.");
      return { pad: p, rol, toelichting, slokt };
    });

  const nieuwe: EindPagina[] = nieuw.map((n) => ({
    pad: n.pad, rol: "nieuw" as Rol, slokt: [],
    toelichting: `Bestaat nog niet. Hier wordt ${n.volume} keer per maand op gezocht ("${n.term}") zonder dat de site er een pagina voor heeft.`,
  }));

  const alles = [...blijvers, ...nieuwe];

  // ── Groeperen ────────────────────────────────────────────────────────────
  // Twee soorten sites. Heeft een pad meerdere delen (/soa-klinieken/gouda/), dan
  // is het eerste deel de tak; die structuur ligt er al. Is de site plat (alles
  // direct onder de wortel, zoals bij One Day Clinic), dan bestaat er geen tak en
  // moeten we hem afleiden uit het onderwerpswoord dat de meeste pagina's delen.
  const takMap = new Map<string, EindPagina[]>();
  const plat: EindPagina[] = [];
  for (const p of alles) {
    const delen = p.pad.split("/").filter(Boolean);
    if (delen.length >= 2) {
      const tak = `/${delen[0]}/`;
      if (!takMap.has(tak)) takMap.set(tak, []);
      takMap.get(tak)!.push(p);
    } else {
      plat.push(p);
    }
  }

  // De platte pagina's groeperen op hun sterkste gedeelde woord. Elk pad kiest
  // het woord dat het vaakst voorkomt, zodat "soa-test-gouda" en "soa-test-breda"
  // bij elkaar komen; een woord dat maar één of twee pagina's dekt is geen tak.
  //
  // Twee filters erbij, allebei uit wat er live misging bij One Day Clinic.
  //
  // 1. Een woord dat op een groot deel van de site staat is geen onderwerp maar
  //    ruis. "test" staat daar in bijna elke URL; zonder grens werd dát de tak, en
  //    dan komen /allergie-test/ en /bloedgroep-test/ onder één groep die niets
  //    betekent. Dezelfde 8%-grens als in de onderwerp-detectie.
  // 2. Vraagwoorden zijn geen onderwerp. /alles-wat-je-moet-weten-over-soas/ en
  //    /anale-soa-wat-jij-moet-weten/ delen "wat", en dat leverde een tak "Wat" op.
  //    Ze delen een schrijfstijl, geen thema.
  //
  // En de keuze zelf: van de woorden die overblijven wint het woord dat de meeste
  // pagina's dekt, want dat is de grootste zinvolle groep. Dat is iets anders dan
  // "het vaakst voorkomende woord": de te brede woorden zijn er dan al uit.
  const VRAAGWOORDEN = new Set([
    "wat", "hoe", "waarom", "wanneer", "waar", "welke", "kun", "kan", "moet", "mag",
    "weten", "jij", "jouw", "jezelf", "zelf", "alles", "zonder", "meer", "beste", "goed",
  ]);
  const bruikbaar = (pad: string) => onderwerpWoorden(pad).filter((w) => !VRAAGWOORDEN.has(w));

  const freq = new Map<string, number>();
  // En de nette schrijfwijze erbij. De woordstam is grof (hij knipt "seks" tot
  // "sek"), en dat is prima om mee te groeperen maar niet om als kop te tonen:
  // "Sek" leest als een typefout, zeker op een pagina die een klant te zien
  // krijgt. Daarom onthouden we per stam het woord zoals het echt in de URL staat.
  const schrijfwijze = new Map<string, Map<string, number>>();
  for (const p of plat) {
    const ruw = p.pad.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    for (const w of new Set(bruikbaar(p.pad))) {
      freq.set(w, (freq.get(w) || 0) + 1);
      const origineel = ruw.find((r) => r.startsWith(w)) || w;
      if (!schrijfwijze.has(w)) schrijfwijze.set(w, new Map());
      const m = schrijfwijze.get(w)!;
      m.set(origineel, (m.get(origineel) || 0) + 1);
    }
  }
  const netjes = (stam: string) => {
    const m = schrijfwijze.get(stam);
    if (!m) return stam;
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];
  };
  const teBreed = Math.max(MIN_TAK + 3, Math.round(plat.length * 0.08));
  const losse: EindPagina[] = [];
  for (const p of plat) {
    const woorden = [...new Set(bruikbaar(p.pad))]
      .filter((w) => { const n = freq.get(w) || 0; return n >= MIN_TAK && n <= teBreed; })
      .sort((a, b) => (freq.get(b) || 0) - (freq.get(a) || 0));
    const beste = woorden[0];
    if (!beste) { losse.push(p); continue; }
    const tak = `#${beste}`;
    if (!takMap.has(tak)) takMap.set(tak, []);
    takMap.get(tak)!.push(p);
  }

  const paden = new Set(alles.map((p) => p.pad));
  const takken: Tak[] = [...takMap.entries()]
    .filter(([, kinderen]) => kinderen.length >= MIN_TAK)
    .map(([tak, kinderen]) => {
      const echt = !tak.startsWith("#");
      if (echt) {
        return {
          sleutel: tak,
          pad: tak,
          titel: mooi(tak),
          bestaat: paden.has(norm(tak)),
          kinderen: kinderen.filter((k) => k.pad !== norm(tak)).sort((a, b) => a.pad.localeCompare(b.pad)),
        };
      }
      // Een afgeleide tak heet naar het gedeelde woord, niet naar de kortste
      // pagina erin. Anders krijgt een groep tests de naam van de eerste test die
      // toevallig het kortste pad had, en dat leest als een pagina terwijl het een
      // groepering is. Bestaat er wél een overzichtspagina met precies dat woord,
      // dan is dat de hoofdpagina; anders staat er eerlijk dat die ontbreekt.
      const woord = netjes(tak.slice(1));
      const eigen = kinderen.find((k) => norm(k.pad) === `/${woord}`);
      return {
        sleutel: tak,
        pad: eigen?.pad || "",
        titel: woord.charAt(0).toUpperCase() + woord.slice(1),
        bestaat: !!eigen,
        kinderen: kinderen.filter((k) => k.pad !== eigen?.pad).sort((a, b) => a.pad.localeCompare(b.pad)),
      };
    })
    .sort((a, b) => b.kinderen.length - a.kinderen.length || a.sleutel.localeCompare(b.sleutel));

  // Alles wat niet in een tak van drie belandde, blijft los staan. Dat verzwijgen
  // zou het beeld mooier maken dan het is.
  const inTak = new Set(takken.flatMap((t) => [t.pad, ...t.kinderen.map((k) => k.pad)]).filter(Boolean));
  const echteLosse = [...losse, ...alles.filter((p) => !inTak.has(p.pad) && !losse.some((l) => l.pad === p.pad))]
    .filter((p, i, a) => a.findIndex((x) => x.pad === p.pad) === i)
    .sort((a, b) => a.pad.localeCompare(b.pad));

  return {
    takken,
    losse: echteLosse,
    nu: uniekLive.length,
    straks: blijvers.length + nieuwe.length,
    weg: verdwijnt.size,
    erbij: nieuwe.length,
    vorm,
    volledig: !!result,
  };
}
