// Proef op de huisstijl van knoppen.
//
// WAAROM DIT BESTAAT
// ══════════════════
// "Alle knoppen zien er hetzelfde uit, geen emoji, alles op één regel" staat in
// het projectgeheugen, staat in het brein, en is volgens Maarten al tien keer
// besproken. En op 15 augustus 2026 stonden er op de developer-pagina drie
// knoppen onder elkaar, in twee verschillende knopsystemen tegelijk, met een
// emoji ervoor. Diezelfde ochtend zette ik zelf een nieuwe knop bovenop een
// bestaande knop.
//
// De les is dus niet "beter opschrijven". De regel stónd er, en werd gelezen, en
// ging alsnog fout. Wat wél werkt is een controle die rood wordt.
//
// `proeven/opmaak.proef.ts` bewaakte al de kopbalk, de bouwstenen en de
// schaal-tokens, maar over knoppen zei hij bijna niets: hij verbood precies drie
// oude klassenamen, in één map, met veertig bestanden op de vrijstellingslijst.
// Een knop met een verzonnen naam, een eigen kleur en een emoji kwam er dus
// gewoon doorheen. Dat gat sluit dit bestand.
//
// TWEE REGELS, MEER NIET
// ══════════════════════
//  1. Een knop gebruikt het knopsysteem (.btn plus een variant), of hij is een
//     los teken-knopje (een kruisje, een vinkje, een pijltje) dat geen knop in
//     de huisstijl hoort te zijn.
//  2. In het label van een knop met tekst staat geen emoji.
//
// Bewust niet meer dan dit. Een proef die over elk detail valt geeft ruis, en
// dan zet iemand hem uit; dat staat al in opmaak.proef.ts en het blijft waar.
//
// DE ERFENIS-LIJST IS EEN RATEL
// ═════════════════════════════
// De bestanden van vóór deze proef staan hieronder. Die lijst mag alleen korter
// worden: verbouw je een bestand, haal het eraf, en daarna kan het niet meer
// terugvallen. Een NIEUW bestand staat er per definitie niet op en moet dus
// meteen goed zijn. Zet deze proef nooit uit; haal er bestanden af.

import fs from "fs";
import path from "path";

const WORTEL = path.join(__dirname, "..");

// ── De bestanden die er al waren toen deze proef werd gemaakt ──
// Alleen korter maken, nooit langer. Twee aparte lijsten, en dat is met opzet:
// het knopsysteem heeft honderdzestig oude gevallen en migreert dus geleidelijk,
// maar de emoji-lijst is LEEG en blijft leeg. Die zes gevallen waren in tien
// minuten op te ruimen, en een regel zonder uitzonderingen is de enige soort die
// niet langzaam uitholt. Zet hier dus nooit een bestand bij; haal de emoji weg.
const ERFENIS: { knopsysteem: string[]; emoji: string[] } = JSON.parse(
  fs.readFileSync(path.join(__dirname, "huisstijl-erfenis.json"), "utf8"),
);
const ERF_SYSTEEM = new Set(ERFENIS.knopsysteem);
const ERF_EMOJI = new Set(ERFENIS.emoji);

// Losse tekens die als knopje mogen dienen zonder het knopsysteem: sluiten,
// aan-/uitvinken, uitklappen, slepen. Dat zijn geen knoppen in de huisstijl maar
// bedieningstekens, en die horen klein en kaal te zijn.
const TEKEN_KNOP = /^[\s×✕✓✔☑☐▾▴▸▪▶◀←→↑↓⋮⋯•·+\-–—?!()0-9]*$/u;

// De inklapkop van een paneel is óók geen knop in de huisstijl. Hij voert niets
// uit op de data, hij vouwt een blok open of dicht, en hij is de volle breedte
// met een eigen achtergrond; een .btn eromheen zou hem juist kapotmaken.
//
// Bewust een korte, VASTE lijst en geen patroon: elke naam hierin staat één keer
// in globals.css en wordt gedeeld. Zo blijft dit een benoemd onderdeel van het
// systeem en geen achterdeur waardoor "mijn knop is nou eenmaal anders" alsnog
// binnenkomt. Verzint een scherm een eigen kop-klasse, dan is deze proef nog
// steeds rood, en dat hoort ook.
//
// Twee niveaus sinds 19-08-2026: `strategy-head` is de kop van een heel paneel
// (de kleurverloop-balk), `deelkop` is een kop bínnen zo'n paneel (het lijntje).
// Daarvóór hadden zes plekken daar hun eigen vorm voor.
// `schakel-knop` hoort er sinds 19-08-2026 ook bij: kiezen tussen twee weergaven
// van dezelfde data is geen actie op die data, en die knopjes horen klein en
// stil te zijn. Vijf plekken hadden daar hun eigen vorm voor.
// De gedeelde inklapkoppen van een paneel. `client-profile-toggle` hoort hier
// net zo goed bij als `strategy-head`: het is de kop van een cockpit-kaart, geen
// actieknop, en hij wordt door meerdere panelen gedeeld. Zet hier alleen een
// klasse bij die écht een gedeelde kop is; een gewone knop hoort op .btn.
const KOP_KNOP = /\b(strategy-head|deelkop|schakel-knop|werkbalk-knop|client-profile-toggle)\b/;

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

/**
 * Vind alle <button>-elementen, met hun open-tag en hun inhoud.
 *
 * Een regex is hier niet genoeg: in de open-tag zitten arrow-functies met een
 * `>` erin (`onClick={() => ...}`), dus `<button[^>]*>` knipt op de verkeerde
 * plek. Daarom teken voor teken, met de diepte van accolades en aanhalingstekens
 * erbij. Zonder dat vlagt deze proef de verkeerde knoppen, en een proef die
 * onterecht rood wordt, zet iemand uit.
 */
function knoppen(bron: string): { open: string; inhoud: string; regel: number }[] {
  const uit: { open: string; inhoud: string; regel: number }[] = [];
  let i = 0;
  while ((i = bron.indexOf("<button", i)) !== -1) {
    let j = i + 7;
    let diepte = 0;
    let quote = "";
    let zelfsluitend = false;
    for (; j < bron.length; j++) {
      const c = bron[j];
      if (quote) { if (c === quote) quote = ""; continue; }
      if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
      if (c === "{") { diepte++; continue; }
      if (c === "}") { diepte--; continue; }
      if (c === ">" && diepte === 0) { zelfsluitend = bron[j - 1] === "/"; break; }
    }
    const open = bron.slice(i, j + 1);
    let inhoud = "";
    if (!zelfsluitend) {
      const eind = bron.indexOf("</button>", j);
      inhoud = eind === -1 ? "" : bron.slice(j + 1, eind);
    }
    uit.push({ open, inhoud, regel: bron.slice(0, i).split("\n").length });
    i = j + 1;
  }
  return uit;
}

/** De zichtbare tekst van een knop: expressies eruit, tags eruit. */
function label(inhoud: string): string {
  return inhoud
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Alle tekst die zichtbaar kán worden, dus ook uit `{x ? "a" : "b"}`. */
function alleTekst(inhoud: string): string {
  const uitExpressies = [...inhoud.matchAll(/["'`]([^"'`]*)["'`]/g)].map((m) => m[1]).join(" ");
  return ontcijfer(`${label(inhoud)} ${uitExpressies}`);
}

/**
 * `&#128279;` is 🔗, en dat is precies zo'n emoji als de regel hierboven verbiedt.
 * Geschreven als code ziet de proef er niets van, en zo stond er tot 19-08-2026
 * een link-emoji in de werkbalk van elk rijk tekstveld terwijl de emoji-lijst
 * leeg was en leeg heette te blijven. Een regel met een achterdeur is geen regel.
 */
const NAAM_TEKENS: Record<string, string> = {
  times: "\u00d7", bull: "\u2022", raquo: "\u00bb", laquo: "\u00ab",
  larr: "\u2190", rarr: "\u2192", uarr: "\u2191", darr: "\u2193",
  mdash: "\u2014", ndash: "\u2013", hellip: "\u2026", middot: "\u00b7",
  check: "\u2713", nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"',
  rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201d", ldquo: "\u201c",
};

function ontcijfer(tekst: string): string {
  return tekst
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (heel, naam) => NAAM_TEKENS[String(naam).toLowerCase()] ?? heel);
}

function alleTsx(map: string): string[] {
  const uit: string[] = [];
  for (const naam of fs.readdirSync(path.join(WORTEL, map))) {
    const rel = `${map}/${naam}`;
    if (fs.statSync(path.join(WORTEL, rel)).isDirectory()) uit.push(...alleTsx(rel));
    else if (naam.endsWith(".tsx")) uit.push(rel);
  }
  return uit;
}

const zonderSysteem: string[] = [];
const metEmoji: string[] = [];
const gezien = new Set<string>();
let schoon = 0;

for (const rel of alleTsx("app")) {
  const bron = fs.readFileSync(path.join(WORTEL, rel), "utf8");
  const fouten: { soort: "systeem" | "emoji"; melding: string }[] = [];

  for (const k of knoppen(bron)) {
    const klasse = /className=(?:"([^"]*)"|\{([^}]*)\})/.exec(k.open);
    const klasseTekst = klasse ? `${klasse[1] || ""} ${klasse[2] || ""}` : "";
    // Ontcijferd, want `&times;` is precies zo'n kruisje als `×`, alleen dan
    // als code geschreven. Zonder deze stap meldde deze proef vijf sluitkruisjes
    // als "knop zonder knopsysteem", terwijl de regel er juist zegt dat een
    // teken-knopje kaal mag blijven. Een proef die het goede werk afkeurt, wordt
    // uitgezet, en dan bewaakt hij niets meer.
    const tekst = ontcijfer(label(k.inhoud));
    const isTeken = TEKEN_KNOP.test(tekst) && tekst.length <= 3;

    // 1. Het knopsysteem. Een teken-knopje (kruisje, vinkje) en de gedeelde
    //    inklapkop van een paneel mogen kaal blijven.
    if (!isTeken && !KOP_KNOP.test(klasseTekst) && !/\bbtn\b/.test(klasseTekst)) {
      fouten.push({
        soort: "systeem",
        melding: `${rel}:${k.regel} knop "${tekst.slice(0, 30)}" gebruikt het knopsysteem niet (className: ${klasseTekst.trim().slice(0, 40) || "geen"})`,
      });
    }

    // 2. Geen emoji in een knop die ook tekst heeft.
    if (/[A-Za-zÀ-ÿ]{3,}/.test(tekst) && EMOJI.test(alleTekst(k.inhoud))) {
      fouten.push({
        soort: "emoji",
        melding: `${rel}:${k.regel} knop "${tekst.slice(0, 30)}" heeft een emoji in het label`,
      });
    }
  }

  if (ERF_SYSTEEM.has(rel) || ERF_EMOJI.has(rel)) gezien.add(rel);
  if (fouten.length === 0) { schoon++; continue; }
  if (!ERF_SYSTEEM.has(rel)) {
    zonderSysteem.push(...fouten.filter((f) => f.soort === "systeem").map((f) => f.melding));
  }
  if (!ERF_EMOJI.has(rel)) {
    metEmoji.push(...fouten.filter((f) => f.soort === "emoji").map((f) => f.melding));
  }
}

let fout = 0;
function toets(naam: string, goed: boolean, uitleg = "") {
  if (!goed) fout++;
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}${goed || !uitleg ? "" : `\n       ${uitleg}`}`);
}

toets(
  `elke knop gebruikt het knopsysteem (${schoon} bestanden schoon, ${gezien.size} op de erfenis-lijst)`,
  zonderSysteem.length === 0,
  `Gebruik .btn met precies één van .btn-primary / .btn-ghost / .btn-quiet / .btn-danger, plus .btn-klein voor de compacte maat.\n       ${zonderSysteem.slice(0, 12).join("\n       ")}${zonderSysteem.length > 12 ? `\n       … en nog ${zonderSysteem.length - 12}.` : ""}`,
);

toets(
  "geen emoji in een knoplabel",
  metEmoji.length === 0,
  `Emoji horen niet in een knop met tekst; de tekst zegt het al.\n       ${metEmoji.slice(0, 12).join("\n       ")}${metEmoji.length > 12 ? `\n       … en nog ${metEmoji.length - 12}.` : ""}`,
);

// De ratel: een bestand dat schoon is geworden hoort van de lijst af, anders
// kan het stilletjes terugvallen zonder dat iemand het merkt.
const onnodig = [...ERF_SYSTEEM].filter((rel) => {
  if (!fs.existsSync(path.join(WORTEL, rel))) return true;
  const bron = fs.readFileSync(path.join(WORTEL, rel), "utf8");
  return knoppen(bron).every((k) => {
    const klasse = /className=(?:"([^"]*)"|\{([^}]*)\})/.exec(k.open);
    const klasseTekst = klasse ? `${klasse[1] || ""} ${klasse[2] || ""}` : "";
    const tekst = label(k.inhoud);
    const isTeken = TEKEN_KNOP.test(ontcijfer(tekst)) && ontcijfer(tekst).length <= 3;
    const systeemOk = isTeken || KOP_KNOP.test(klasseTekst) || /\bbtn\b/.test(klasseTekst);
    const emojiOk = !(/[A-Za-zÀ-ÿ]{3,}/.test(tekst) && EMOJI.test(alleTekst(k.inhoud)));
    return systeemOk && emojiOk;
  });
});
toets(
  "de erfenis-lijst bevat geen schone of verdwenen bestanden meer",
  onnodig.length === 0,
  `Haal deze uit proeven/huisstijl-erfenis.json, ze voldoen al:\n       ${onnodig.join("\n       ")}`,
);

toets(
  "de emoji-regel heeft geen uitzonderingen",
  ERF_EMOJI.size === 0,
  "De emoji-lijst hoort leeg te blijven. Haal de emoji uit het knoplabel in plaats van het bestand vrij te stellen.",
);

console.log(fout ? `\n${fout} proef(en) mislukt.` : "\nAlle proeven geslaagd.");
process.exit(fout ? 1 : 0);
