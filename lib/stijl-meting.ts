// ═══════════════════════════════════════════════════════════
// DE MEETLAT ONDER DE STIJL VAN HET DASHBOARD
// ═══════════════════════════════════════════════════════════
// Dit bestand telt. Meer niet. Het leest `app/globals.css` en alle schermen in
// `app/`, en geeft terug hoeveel verschillende kleuren, lettergroottes,
// rondingen, schaduwen en afstanden er op dit moment bestaan.
//
// WAAROM DIT ER IS
// ────────────────
// Er staan al poorten op de opmaak (`opmaak.proef.ts`, `huisstijl.proef.ts`,
// `nette-html.proef.ts`) en die zijn groen. En tóch bestonden er op 17 augustus
// 2026 286 verschillende kleuren, twintig lettergroottes en 94 eigen
// knop-classnamen in één stylesheet van 8.049 regels.
//
// Dat is geen tegenspraak, het is een blinde vlek. Die poorten vragen allemaal
// "gebruikt DIT bestand de bouwstenen?". Geen enkele vraagt "hoeveel
// verschillende waarden bestaan er in TOTAAL?". Een scherm mag dus keurig een
// eigen kleur kiezen zolang het dat netjes doet, en zo groeit een ontwerp uit
// elkaar zonder dat één controle rood wordt.
//
// Deze meetlat vult precies dat gat. `proeven/stijl-teller.proef.ts` gebruikt
// hem als plafond dat alleen mag dalen, en `/admin/stijl` gebruikt hem om te
// laten zien wat er is. Eén bron, twee vensters: dezelfde vaste vorm als overal
// in dit project.
//
// De cijfers zijn met opzet ruw. Het gaat er niet om of een kleur mooi is, maar
// om hoeveel plekken zelf een beslissing nemen die de tokens al genomen hadden.
// ═══════════════════════════════════════════════════════════

import fs from "fs";
import path from "path";
import { TOEGESTAAN } from "./icoontekens";

export const WORTEL = path.join(__dirname, "..");

/** Eén gevonden waarde, met hoe vaak hij voorkomt. Vaak = eerst opruimen. */
export type Waarde = { waarde: string; aantal: number };

/** Een soort waarde (kleur, lettergrootte, …) met zijn stand. */
export type Soort = {
  /** Hoeveel verschillende waarden er los in de opmaak staan. */
  verschillend: number;
  /** Hoeveel er benoemd zijn als token in :root. Dat is het aantal dat mág. */
  benoemd: number;
  /** Alle losse waarden, meest gebruikte eerst. */
  los: Waarde[];
};

/**
 * Een losse kleur naast de token die er het dichtst bij ligt.
 *
 * Dit is het cijfer dat "331 kleuren" pas bruikbaar maakt. Zonder deze
 * vergelijking is 331 alleen een schrikgetal en weet je nog steeds niet wat je
 * moet doen. Mét de vergelijking valt het uiteen in drie stapels, en twee
 * daarvan zijn zoekopdrachten van vijf minuten in plaats van ontwerpwerk.
 */
export type KleurNaast = {
  waarde: string;
  aantal: number;
  /** De token die er het dichtst bij ligt, of null als er geen kleurtoken is. */
  dichtst: string | null;
  /** Hoe ver ervandaan, 0 = exact dezelfde kleur. */
  afstand: number;
  /** In welke stapel deze kleur valt. Zie STAPELS hieronder. */
  stapel: Stapel;
};

/**
 * De vier stapels waarin elke losse kleur valt, plus een vijfde voor
 * doorzichtige kleuren. De eerste drie zijn opruimwerk zonder enige
 * ontwerpbeslissing: er staat al een kleur met een naam die dit doet.
 */
export const STAPELS = {
  gelijk: "Dezelfde kleur, anders opgeschreven",
  bijna: "Met het blote oog niet te onderscheiden",
  familie: "Dezelfde kleurfamilie, net een andere tint",
  anders: "Echt een andere kleur",
  doorzichtig: "Doorzichtig (schaduwen en waas)",
} as const;

export type Stapel = keyof typeof STAPELS;

export type Meting = {
  css: { regels: number; stijlregels: number; classnamen: number };
  kleuren: Soort;
  lettergroottes: Soort;
  rondingen: Soort;
  schaduwen: Soort;
  afstanden: Soort;
  /** Eigen classnamen per familie: hoeveel varianten van hetzelfde ding bestaan er. */
  families: { naam: string; aantal: number; namen: string[] }[];
  /** Losse `style={{ }}` in de schermen: het lek waar geen CSS-poort bij kan. */
  inline: { totaal: number; metVasteWaarde: number; perBestand: { bestand: string; aantal: number }[] };
  /** De tokens zoals ze nu in :root staan, voor de "bedoeling"-helft van het scherm. */
  tokens: { naam: string; waarde: string }[];
  /** Elke losse kleur naast de token die er het dichtst bij ligt. */
  kleurNaastToken: KleurNaast[];
  /** Maten die niet op een stap van de schaal vallen, met wat ze zouden worden. */
  afrondingen: Afronding[];
  /**
   * Tekens die als icoon in beeld staan: hoeveel, hoeveel verschillende, en
   * hoeveel daarvan geen enkel geladen lettertype kan tekenen (dat laatste hoort
   * nul te zijn, anders staat er ergens een leeg vierkantje).
   */
  icoontekens: { totaal: number; verschillend: number; nietTeTekenen: number; top: { teken: string; aantal: number }[] };
  /** De betekenislaag: namen die zeggen waarvóór een waarde dient. */
  betekenis: {
    namen: { naam: string; wijstNaar: string; groep: string }[];
    /** Namen die een eigen waarde kregen in plaats van naar een token te wijzen. Hoort leeg te blijven. */
    eigenWaarde: string[];
    /** Hoe vaak de opmaak de betekenislaag gebruikt. Dit getal mag alleen stijgen. */
    gebruik: number;
    /** Hoe vaak de opmaak nog rechtstreeks op de schaal eronder zit. */
    schaalGebruik: number;
  };
};

/**
 * Een maat die niet op een stap van de schaal valt, naast de stap die er het
 * dichtst bij ligt.
 *
 * Dit is het deel van het opruimen dat NIET onzichtbaar kan. Een kleur die al
 * een naam heeft omzetten verandert niets; een tekstmaat van 13 pixels bestaat
 * niet in de schaal, dus die wordt 12,5 of hij blijft 13. Dat is een keuze, en
 * hij hoort bij Maarten te liggen in plaats van bij een afrondingsregel. Daarom
 * staan ze op /admin/stijl in beeld, met de huidige en de nieuwe maat naast
 * elkaar getekend, in plaats van in een lijst in de chat.
 */
export type Afronding = {
  soort: "Tekstmaat" | "Ronding" | "Ruimte";
  /** Zoals hij nu in de opmaak staat, bijvoorbeeld "13px". */
  waarde: string;
  aantal: number;
  /** De dichtstbijzijnde stap van de schaal. */
  naar: string;
  naarToken: string;
  /** Hoeveel pixels het verschuift. Onder de 1 ziet niemand het. */
  verschil: number;
  /** Waar hij staat, hooguit een handvol, om te kunnen kijken. */
  selectors: string[];
};

/**
 * De voorvoegsels van de betekenislaag. Een token dat hiermee begint zegt
 * waarvóór een waarde dient; al het andere zegt alleen hoe groot of welke
 * kleur hij is. Bewust een expliciete lijst en niet "de waarde begint met
 * var(", want --pingwin doet dat ook en dat is gewoon een alias.
 */
const BETEKENIS_GROEPEN: { voorvoegsel: string; groep: string }[] = [
  { voorvoegsel: "--kleur-", groep: "Kleur" },
  { voorvoegsel: "--type-", groep: "Tekstmaat" },
  { voorvoegsel: "--regel-", groep: "Regelhoogte" },
  { voorvoegsel: "--ruimte-", groep: "Ruimte" },
  { voorvoegsel: "--ronding-", groep: "Ronding" },
  { voorvoegsel: "--diepte-", groep: "Diepte" },
];

const isBetekenis = (naam: string) => BETEKENIS_GROEPEN.some((g) => naam.startsWith(g.voorvoegsel));

const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");

/** Tel voorkomens en geef ze terug van vaak naar zelden. */
function tel(waarden: string[]): Waarde[] {
  const teller = new Map<string, number>();
  for (const w of waarden) teller.set(w, (teller.get(w) ?? 0) + 1);
  return [...teller.entries()]
    .map(([waarde, aantal]) => ({ waarde, aantal }))
    .sort((a, b) => b.aantal - a.aantal || a.waarde.localeCompare(b.waarde));
}

/**
 * Knip het `:root`-blok eruit. Alles daarbinnen is per definitie goed: dat ZIJN
 * de tokens. Alles daarbuiten is een losse beslissing.
 */
function splitsRoot(css: string): { root: string; rest: string } {
  const start = css.indexOf(":root {");
  if (start === -1) return { root: "", rest: css };
  const eind = css.indexOf("\n}", start);
  if (eind === -1) return { root: "", rest: css };
  return { root: css.slice(start, eind + 2), rest: css.slice(0, start) + css.slice(eind + 2) };
}

/** Alle tokens uit :root, in de volgorde waarin ze staan. */
function leesTokens(root: string): { naam: string; waarde: string }[] {
  return [...root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
    .map((m) => ({ naam: m[1], waarde: m[2].trim() }));
}

/**
 * Alle kleurwaarden in een stuk CSS: hex, rgb(), rgba() en hsl().
 * Hex wordt kleingeschreven zodat #FFF en #fff niet als twee kleuren tellen;
 * dat gebeurde echt, en dan lijkt het erger dan het is.
 */
function kleurenIn(tekst: string): string[] {
  const hex = [...tekst.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
  const functies = [...tekst.matchAll(/\b(?:rgba?|hsla?)\([^)]*\)/g)]
    .map((m) => m[0].replace(/\s+/g, " ").toLowerCase());
  return [...hex, ...functies];
}

/** Losse waarden achter een eigenschap, met var(--…) eruit gefilterd. */
function waardenVan(css: string, eigenschap: RegExp, filter: (w: string) => boolean): string[] {
  return css
    .split("\n")
    .flatMap((regel) => [...regel.matchAll(eigenschap)].map((m) => m[1].trim()))
    .filter((w) => !w.includes("var(--"))
    .filter((w) => w !== "0" && w !== "inherit" && w !== "none" && w !== "initial" && w !== "unset")
    .map((w) => w.replace(/\s*!important\s*$/, "").replace(/\s+/g, " "))
    .filter(filter);
}

/** #abc en #aabbcc naar drie getallen 0-255. Geeft null bij alles wat geen hex is. */
function naarRgb(hex: string): [number, number, number] | null {
  const k = hex.replace("#", "");
  const zes = k.length === 3 ? k.split("").map((c) => c + c).join("") : k.slice(0, 6);
  if (zes.length !== 6 || /[^0-9a-f]/i.test(zes)) return null;
  return [
    parseInt(zes.slice(0, 2), 16),
    parseInt(zes.slice(2, 4), 16),
    parseInt(zes.slice(4, 6), 16),
  ];
}

/**
 * Hoe ver twee kleuren uit elkaar liggen zoals een oog het ziet.
 *
 * Bewust niet de kale rekenkundige afstand: het oog is veel gevoeliger voor
 * groen dan voor blauw, dus twee blauwen die rekenkundig ver uit elkaar liggen
 * zien er identiek uit en twee groenen die dichtbij lijken juist niet. Dit is
 * de gangbare weging daarvoor. Grof, maar ruim genoeg voor de vraag die we
 * stellen: "is dit een nieuwe kleur, of dezelfde nog een keer?"
 */
function kleurAfstand(a: [number, number, number], b: [number, number, number]): number {
  const rGem = (a[0] + b[0]) / 2;
  const [dr, dg, db] = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  return Math.sqrt(
    (2 + rGem / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rGem) / 256) * db * db
  );
}

/**
 * Legt elke losse kleur naast de token die er het dichtst bij ligt.
 *
 * De drempels: onder de 3 is het dezelfde kleur anders opgeschreven (#FFF naast
 * #ffffff, of een afronding). Onder de 30 zie je het verschil op een scherm
 * niet. Onder de 60 is het duidelijk dezelfde kleurfamilie, alleen net een
 * andere tint; dat is het geval bij de zes groenen die in dit dashboard naast
 * elkaar "goed" betekenen. Alles daarboven is een echte keuze, en die verdient
 * een naam in :root of hij moet weg.
 */
function legNaastTokens(los: Waarde[], tokens: { naam: string; waarde: string }[]): KleurNaast[] {
  const tokenKleuren = tokens
    .map((t) => ({ naam: t.naam, rgb: naarRgb(t.waarde.trim()) }))
    .filter((t): t is { naam: string; rgb: [number, number, number] } => t.rgb !== null);

  return los.map(({ waarde, aantal }) => {
    // rgba() en hsla() zijn doorzichtig, en een doorzichtige kleur vergelijken
    // met een dekkende token zegt niets: hij ziet eruit als wat eronder ligt.
    // Ze horen bij de schaduwen en de waas achter een venster en worden daar
    // beoordeeld, niet hier.
    if (!waarde.startsWith("#")) {
      return { waarde, aantal, dichtst: null, afstand: 0, stapel: "doorzichtig" as const };
    }
    const rgb = naarRgb(waarde);
    if (!rgb || !tokenKleuren.length) {
      return { waarde, aantal, dichtst: null, afstand: 999, stapel: "anders" as const };
    }
    let beste = tokenKleuren[0];
    let besteAfstand = Infinity;
    for (const t of tokenKleuren) {
      const d = kleurAfstand(rgb, t.rgb);
      if (d < besteAfstand) { besteAfstand = d; beste = t; }
    }
    const stapel: Stapel =
      besteAfstand < 3 ? "gelijk" : besteAfstand < 30 ? "bijna" : besteAfstand < 60 ? "familie" : "anders";
    return { waarde, aantal, dichtst: beste.naam, afstand: Math.round(besteAfstand), stapel };
  });
}

/**
 * Zoekt elke maat op die niet op een stap van de schaal valt, en legt hem naast
 * de stap die er het dichtst bij ligt.
 *
 * Waarom dit met de selector erbij gaat: "13px komt 32 keer voor" is nog geen
 * beslissing. "13px staat op de kop van een taakkaart" wél, want dan weet je
 * waar je gaat kijken. De selector wordt bijgehouden door mee te lezen welk
 * blok er open staat; een regel binnen `@media` hoort bij de selector eronder,
 * niet bij de media-regel zelf.
 */
function zoekAfrondingen(css: string, tokens: { naam: string; waarde: string }[]): Afronding[] {
  const schaal = (voorvoegsel: string) =>
    tokens
      .filter((t) => t.naam.startsWith(voorvoegsel) && /^\d+(\.\d+)?px$/.test(t.waarde.trim()))
      .map((t) => ({ naam: t.naam, px: parseFloat(t.waarde) }))
      .sort((a, b) => a.px - b.px);

  const SOORTEN = [
    { soort: "Tekstmaat" as const, eigenschap: "font-size", stappen: schaal("--fs-") },
    { soort: "Ronding" as const, eigenschap: "border-radius", stappen: schaal("--r-") },
    { soort: "Ruimte" as const, eigenschap: "(?:padding|margin|gap)", stappen: schaal("--s-") },
  ];

  const gevonden = new Map<string, Afronding>();
  const stapel: string[] = [];
  for (const regel of css.split("\n")) {
    const onder = [...stapel].reverse().find((s) => !s.startsWith("@")) ?? "";
    const eigen = regel.includes("{") ? regel.split("{")[0] : "";
    const selector = regel.includes("{") && !eigen.trim().startsWith("@") ? eigen.trim() : onder;

    for (const { soort, eigenschap, stappen } of SOORTEN) {
      if (!stappen.length) continue;
      for (const m of regel.matchAll(new RegExp(`${eigenschap}:\\s*([^;{}]+)`, "g"))) {
        const w = m[1].trim();
        if (w.includes("var(")) continue;
        const enkel = /^(\d+(?:\.\d+)?)px$/.exec(w);
        if (!enkel) continue;
        const px = parseFloat(enkel[1]);
        // 0 en 1 horen bij niemand: 0 is "geen", 1 is een haarlijn. Die tellen
        // niet als afwijking, anders staat de lijst vol met randjes.
        if (px === 0 || px === 1) continue;
        if (stappen.some((s) => s.px === px)) continue;
        const dichtst = stappen.reduce((a, b) => (Math.abs(b.px - px) < Math.abs(a.px - px) ? b : a));
        const sleutel = `${soort}|${w}`;
        const bestaand = gevonden.get(sleutel);
        if (bestaand) {
          bestaand.aantal++;
          if (selector && bestaand.selectors.length < 6 && !bestaand.selectors.includes(selector)) {
            bestaand.selectors.push(selector);
          }
        } else {
          gevonden.set(sleutel, {
            soort, waarde: w, aantal: 1,
            naar: `${dichtst.px}px`, naarToken: dichtst.naam,
            verschil: Math.round(Math.abs(dichtst.px - px) * 100) / 100,
            selectors: selector ? [selector] : [],
          });
        }
      }
    }

    for (const teken of regel) {
      if (teken === "{") stapel.push(eigen.trim() || onder);
      else if (teken === "}") stapel.pop();
    }
  }

  // Het grootste verschil bovenaan: dat is wat je als eerste moet bekijken,
  // want daar verandert er echt iets aan het scherm.
  return [...gevonden.values()].sort((a, b) => b.verschil - a.verschil || b.aantal - a.aantal);
}

// ── Icoontjes die als letter in beeld staan ────────────────────────────────
// Hier stond een met de hand ingetypte "0" op /admin/stijl terwijl het er 419
// waren. Vandaar dat deze meting bestaat: hetzelfde getal, maar geteld.
//
// Eén scanner, hier, gebruikt door zowel de meter op het scherm als
// proeven/icoontekens.proef.ts. Twee keer dezelfde telling uitschrijven is in
// dit project de vaste manier om twee verschillende antwoorden te krijgen.

export type IcoonVondst = { teken: string; bestand: string; regel: number; context: string };

/**
 * Wat niet in beeld komt, telt niet mee: commentaar (daar staat een teken in een
 * uitleg) en een zoekpatroon. Dat tweede is geen muggenzifterij:
 * `AntwoordBlokken.tsx` zoekt met `.replace(/✅|✔️|✔/g, …)` naar emoji in oude
 * antwoorden om ze te vervángen door nette stipjes. Dat teken staat er dus juist
 * omdát het niet in beeld hoort.
 */
function zonderNietZichtbaar(tekst: string): string {
  return tekst
    .replace(/\/\*[\s\S]*?\*\//g, (blok) => blok.replace(/[^\n]/g, " "))
    .split("\n")
    .map((regel) => (/^\s*\/\//.test(regel) ? "" : regel))
    .map((regel) => regel.replace(/\/(?:[^/\\\n]|\\.)+\/[gimsuy]+/g, ""))
    .join("\n");
}

/** Een gewone letter met een accent is geen icoon; Montserrat levert latin-ext mee. */
const LETTER_MET_ACCENT = /[À-ɏ]/;
/** Onzichtbare tekens die een emoji in kleur laten tekenen; die horen bij de emoji ernaast. */
const ONZICHTBAAR = /[︀-️‍]/;

/**
 * Elk teken dat als icoon op een scherm terechtkomt, met waar het staat.
 *
 * Bewust alleen `app/**.tsx` en de `content:`-regels in de opmaak. Een teken in
 * een opdracht aan de AI (`app/api/…`) gaat naar een taalmodel en niet naar een
 * scherm; dat meetellen maakt het getal onbruikbaar.
 */
export function zoekIcoontekens(): IcoonVondst[] {
  const uit: IcoonVondst[] = [];
  const kijk = (bestand: string, tekst: string, alleenContent: boolean) => {
    zonderNietZichtbaar(tekst).split("\n").forEach((regel, i) => {
      const stukken = alleenContent
        ? [...regel.matchAll(/content:\s*("[^"]*"|'[^']*')/g)].map((m) => m[1])
        : [regel];
      for (const stuk of stukken) {
        for (const teken of stuk) {
          if (teken.codePointAt(0)! < 128) continue;
          if (LETTER_MET_ACCENT.test(teken) || ONZICHTBAAR.test(teken)) continue;
          uit.push({
            teken,
            bestand: path.relative(WORTEL, bestand),
            regel: i + 1,
            context: regel.trim().slice(0, 80),
          });
        }
      }
    });
  };
  for (const bestand of alleSchermen()) kijk(bestand, fs.readFileSync(bestand, "utf8"), false);
  const cssPad = path.join(WORTEL, "app", "globals.css");
  kijk(cssPad, fs.readFileSync(cssPad, "utf8"), true);
  return uit;
}

/** De telling voor de meter op /admin/stijl. */
function meetIcoontekens(): Meting["icoontekens"] {
  const vondsten = zoekIcoontekens();
  const perTeken = new Map<string, number>();
  for (const v of vondsten) perTeken.set(v.teken, (perTeken.get(v.teken) ?? 0) + 1);
  return {
    totaal: vondsten.length,
    verschillend: perTeken.size,
    nietTeTekenen: vondsten.filter((v) => !TOEGESTAAN.includes(v.teken)).length,
    top: [...perTeken.entries()]
      .map(([teken, aantal]) => ({ teken, aantal }))
      .sort((a, b) => b.aantal - a.aantal)
      .slice(0, 12),
  };
}

/** Alle .tsx-schermen onder app/, zonder node_modules. */
export function alleSchermen(map = path.join(WORTEL, "app")): string[] {
  const uit: string[] = [];
  for (const naam of fs.readdirSync(map)) {
    const vol = path.join(map, naam);
    if (fs.statSync(vol).isDirectory()) {
      if (naam !== "node_modules") uit.push(...alleSchermen(vol));
      continue;
    }
    if (naam.endsWith(".tsx")) uit.push(vol);
  }
  return uit;
}

/**
 * Houdt alleen de WORTELS over: namen die geen uitbreiding zijn van een andere
 * naam in dezelfde lijst.
 *
 * Waarom dit er is (18-08-2026, en het heeft een deploy gekost). Deze meting
 * telde eerst kale classnamen, en meldde daarmee `.btn`, `.btn-primary`,
 * `.btn-ghost` en `.btn-klein` als vier soorten knop. Dat is precies het
 * omgekeerde van de waarheid: dat is één knopsysteem met drie varianten.
 *
 * Het ging pas echt mis toen een andere chat een uitklapknop toevoegde die het
 * knopsysteem keurig gebruikte (`btn btn-quiet btn-klein wp-vouwknop`), met een
 * toestand `-aan` en een pijltje `-pijl` erbij. Dat pijltje is een span, geen
 * knop. De teller zag drie nieuwe soorten knop, werd rood, en hield een
 * correcte oplevering tegen: main stond stil en niemand wist waarom.
 *
 * Een meter die goed werk tegenhoudt wordt uitgezet, en dan bewaakt hij niets
 * meer. Vandaar deze regel: een naam die begint met een andere naam plus een
 * streepje hoort bij die andere naam. Varianten, toestanden en onderdelen
 * tellen daarmee bij hun eigen component, en wat overblijft is het echte
 * getal: hoe vaak is dit onderdeel opnieuw uitgevonden.
 */
function wortels(namen: string[]): string[] {
  const gesorteerd = [...namen].sort();
  return gesorteerd
    .filter((n) => !gesorteerd.some((ander) => ander !== n && n.startsWith(`${ander}-`)))
    .sort();
}

/**
 * De families waarin dezelfde soort onderdeel steeds opnieuw is uitgevonden.
 * Dit is het cijfer dat het meeste zegt: 94 knop-classnamen betekent dat er 94
 * plekken zijn waar iemand vond dat een knop er net even anders uit moest zien.
 */
const FAMILIES: { naam: string; patroon: RegExp }[] = [
  { naam: "Knoppen", patroon: /(btn|knop|button)/i },
  { naam: "Kaarten en panelen", patroon: /(card|kaart|panel|paneel|pnl)/i },
  { naam: "Tabellen", patroon: /(table|tabel|tbl)/i },
  { naam: "Tabjes", patroon: /(tab|tabje)(?![a-z])/i },
  { naam: "Labels en badges", patroon: /(chip|badge|pill|label|tag)/i },
  { naam: "Invoervelden", patroon: /(input|veld|field|textarea|select)/i },
];

/**
 * De hele meting in één keer. Draait in een halve seconde, dus er is geen reden
 * om ergens een oude uitkomst te bewaren en te hopen dat hij nog klopt.
 */
export function meet(): Meting {
  const css = lees("app/globals.css");
  const { root, rest } = splitsRoot(css);
  const tokens = leesTokens(root);

  // Hoeveel tokens er per soort bestaan. Dat is het getal waar de losse waarden
  // naartoe moeten: niet naar nul, maar naar "alles komt uit de schaal".
  const tokenNamen = tokens.map((t) => t.naam);
  const tokensMet = (p: RegExp) => tokenNamen.filter((n) => p.test(n)).length;
  const tokenKleuren = tokens.filter((t) => /#|rgb|hsl|linear-gradient/.test(t.waarde)).length;

  const classnamen = new Set(
    [...css.matchAll(/\.([a-z][a-z0-9_-]*)/gi)].map((m) => m[1])
  );

  const families = FAMILIES.map(({ naam, patroon }) => {
    const namen = wortels([...classnamen].filter((n) => patroon.test(n)));
    return { naam, aantal: namen.length, namen };
  });

  // ── Losse waarden in de schermen zelf (style={{ … }}) ──
  // Dit is het lek dat geen enkele CSS-controle ziet: opmaak die niet in het
  // stylesheet staat maar in de React-code. Elke regel die je in globals.css
  // strak trekt, geldt hier niet.
  let inlineTotaal = 0;
  const inlinePerBestand: { bestand: string; aantal: number }[] = [];
  const inlineKleuren: string[] = [];
  const inlineMaten: string[] = [];
  let inlineVast = 0;
  for (const vol of alleSchermen()) {
    const rel = path.relative(WORTEL, vol).split(path.sep).join("/");
    const inhoud = fs.readFileSync(vol, "utf8");
    const stukken = [...inhoud.matchAll(/style=\{\{([^}]*)\}/g)].map((m) => m[1]);
    if (!stukken.length) continue;
    inlineTotaal += stukken.length;
    let vastHier = 0;
    for (const stuk of stukken) {
      // Alleen wat een opmaakkeuze IS telt mee. Een kolombreedte, een minimale
      // hoogte of een flex-basis is een indelingsmaat: die hoort in het scherm en
      // niet op de schaal, en meetellen maakte de meter een lijst die nooit nul kan
      // worden. Dan is hij geen werklijst meer maar ruis.
      const zonderLayout = stuk
        .replace(/\b(width|minWidth|maxWidth|height|minHeight|maxHeight|flex|flexBasis|top|left|right|bottom|transform|gridTemplateColumns)\s*:\s*("[^"]*"|`[^`]*`|[^,}]+)/g, "")
        // Een rand van 1 of 2 pixels is een lijn, geen maat op de schaal. Dezelfde
        // vrijstelling die de opmaak-proef al hanteert ("een randje van 1px mag").
        .replace(/\b(border|borderTop|borderRight|borderBottom|borderLeft|outline)\s*:\s*"[12]px\s[^"]*"/g, "");
      const heeftVast = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\d+(\.\d+)?px/.test(zonderLayout);
      if (heeftVast) { vastHier++; inlineVast++; }
      inlineKleuren.push(...kleurenIn(stuk));
      // Ook hier geldt: een scherm dat `fontSize: "var(--fs-sm)"` schrijft doet
      // het juist goed. Zonder deze filter stond var(--fs-sm) bovenaan de lijst
      // met losse maten, wat precies het omgekeerde is van wat er aan de hand is.
      inlineMaten.push(
        ...[...stuk.matchAll(/fontSize\s*:\s*["'`]([^"'`]+)["'`]/g)]
          .map((m) => m[1].trim())
          .filter((w) => !w.includes("var(--") && /\d/.test(w))
      );
    }
    if (vastHier) inlinePerBestand.push({ bestand: rel, aantal: vastHier });
  }
  inlinePerBestand.sort((a, b) => b.aantal - a.aantal);

  const losseKleuren = tel([...kleurenIn(rest), ...inlineKleuren]);

  return {
    css: {
      regels: css.split("\n").length,
      stijlregels: (css.match(/\{/g) ?? []).length,
      classnamen: classnamen.size,
    },
    kleuren: {
      verschillend: losseKleuren.length,
      benoemd: tokenKleuren,
      los: losseKleuren,
    },
    lettergroottes: {
      verschillend: new Set([
        ...waardenVan(rest, /font-size:\s*([^;{}]+)/g, (w) => /\d/.test(w)),
        ...inlineMaten,
      ]).size,
      benoemd: tokensMet(/^--fs-/),
      los: tel([
        ...waardenVan(rest, /font-size:\s*([^;{}]+)/g, (w) => /\d/.test(w)),
        ...inlineMaten,
      ]),
    },
    rondingen: {
      verschillend: new Set(waardenVan(rest, /border-radius:\s*([^;{}]+)/g, (w) => /\d/.test(w))).size,
      benoemd: tokensMet(/^--r-/),
      los: tel(waardenVan(rest, /border-radius:\s*([^;{}]+)/g, (w) => /\d/.test(w))),
    },
    schaduwen: {
      verschillend: new Set(waardenVan(rest, /box-shadow:\s*([^;{}]+)/g, (w) => /\d/.test(w))).size,
      benoemd: tokensMet(/^--shadow-/),
      los: tel(waardenVan(rest, /box-shadow:\s*([^;{}]+)/g, (w) => /\d/.test(w))),
    },
    afstanden: {
      // Alleen de enkelvoudige waarden, want "8px 12px" is een combinatie van
      // twee stappen uit de schaal en geen eigen maat. Anders telt hetzelfde
      // probleem drie keer mee en wordt het getal betekenisloos.
      verschillend: new Set(
        waardenVan(rest, /(?:padding|margin|gap):\s*([^;{}]+)/g, (w) => /^\d+(\.\d+)?px$/.test(w))
      ).size,
      benoemd: tokensMet(/^--s-/),
      los: tel(waardenVan(rest, /(?:padding|margin|gap):\s*([^;{}]+)/g, (w) => /^\d+(\.\d+)?px$/.test(w))),
    },
    families,
    inline: { totaal: inlineTotaal, metVasteWaarde: inlineVast, perBestand: inlinePerBestand },
    tokens,
    kleurNaastToken: legNaastTokens(losseKleuren, tokens),
    afrondingen: zoekAfrondingen(rest, tokens),
    icoontekens: meetIcoontekens(),
    betekenis: meetBetekenislaag(rest, tokens),
  };
}

/**
 * De stand van de betekenislaag: welke namen er zijn, of ze allemaal naar een
 * token wijzen, en hoeveel van de opmaak hem al gebruikt.
 *
 * Dat laatste getal is de reden dat deze meting bestaat. Een laag die netjes
 * gedefinieerd is en door niemand gebruikt wordt is geen fundament maar een
 * vierde stapel naast de drie die er al lagen, en dan is het probleem groter
 * geworden in plaats van kleiner. Het aantal gebruiken is dus een vloer die
 * alleen mag stijgen, precies zoals het aantal losse waarden een plafond is
 * dat alleen mag dalen.
 */
function meetBetekenislaag(rest: string, tokens: { naam: string; waarde: string }[]): Meting["betekenis"] {
  const namen = tokens
    .filter((t) => isBetekenis(t.naam))
    .map((t) => ({
      naam: t.naam,
      wijstNaar: t.waarde.trim(),
      groep: BETEKENIS_GROEPEN.find((g) => t.naam.startsWith(g.voorvoegsel))?.groep ?? "Overig",
    }));

  // Een naam in de betekenislaag hoort naar een token te wijzen, nooit naar een
  // eigen waarde. Zodra dat wél gebeurt is het geen laag erbovenop meer maar een
  // tweede schaal ernaast, en dan lopen ze uit elkaar zoals alles wat hier twee
  // keer los is uitgeschreven.
  // Een mengsel telt óók als verwijzing, mits er een token in zit: dat IS afgeleid
  // van de schaal, alleen met een berekening ertussen. Zo kan een rand "de foutkleur
  // met wat wit erdoor" zijn en meebewegen als de foutkleur verandert, in plaats van
  // een vaste tint die je bij elke wijziging vergeet.
  const eigenWaarde = namen
    .filter((n) => !n.wijstNaar.includes("var(--"))
    .map((n) => `${n.naam}: ${n.wijstNaar}`);

  const alleGebruiken = [...rest.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);
  return {
    namen,
    eigenWaarde,
    gebruik: alleGebruiken.filter(isBetekenis).length,
    schaalGebruik: alleGebruiken.filter((n) => !isBetekenis(n)).length,
  };
}
