// ═══════════════════════════════════════════════════════════
// GEPLAKTE TEKST ZIET ERUIT ALS GERENDERDE TEKST
// ═══════════════════════════════════════════════════════════
// De harde regel van dit dashboard is: alles wat Maarten ziet is netjes opgemaakt.
// Die regel gold in de praktijk alleen voor tekst die het dashboard zélf rendert
// (de chat, een uitkomst, een rapport). Wat hij met de hand in een vrij tekstveld
// plakte, werd juist kaalgeslagen: kopjes werden gewone letters die aan de
// volgende zin vastplakten, bullets werden regelafbrekingen, lijnen verdwenen,
// en de koppen die er tóch in zaten werden door een `*`-vangnet in de opmaak weer
// even groot gemaakt als gewone tekst. Dezelfde strategie stond dus links prachtig
// en rechts als een muur (17 augustus 2026).
//
// Dat is nu op drie plekken opgelost, en die drie kunnen alle drie stilletjes
// terugvallen. Vandaar deze proef:
//   1. het plakken behoudt de structuur (`rich`), in plaats van hem weg te gooien;
//   2. platte tekst die markdown is wordt gerenderd, niet letterlijk getoond;
//   3. de opmaak van een vrij tekstveld (`.focus-rich`) komt uit dezelfde bron
//      als die van gerenderde tekst (`.md`), zodat er geen tweede, afwijkende
//      set opmaakregels naast ontstaat.
//
// Waarom nagerekend en niet opgeschreven: dit is inmiddels de vierde keer dat een
// opmaakregel die in CLAUDE.md stond alsnog gebroken werd zodra iemand haast had.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHTML } from "linkedom";
import { cleanPastedHtml, lijktOpMarkdown } from "../lib/rich-paste";

const WORTEL = join(__dirname, "..");

// Het opschonen draait in de browser en gebruikt daar `DOMParser` en `Node`.
// Hier zetten we die twee klaar met linkedom, zodat deze proef de échte uitkomst
// nakijkt in plaats van naar de code te turen. De eigen DOMParser van linkedom
// doet raar met losse fragmenten, vandaar de omweg via `parseHTML`.
const basis = parseHTML("<html><body></body></html>");
(globalThis as unknown as { Node: unknown }).Node = basis.Node;
(globalThis as unknown as { DOMParser: unknown }).DOMParser = class {
  parseFromString(html: string) {
    return parseHTML(`<html><body>${html}</body></html>`).document;
  }
};

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

// ── 1. Het veld zelf plakt rijk ──────────────────────────────────────────────
const veld = readFileSync(join(WORTEL, "app", "_velden", "RijkTekstVeld.tsx"), "utf8");

const aanroepen = veld.match(/cleanPastedHtml\([^)]*\)/g) || [];
proef("het rijke tekstveld schoont geplakte HTML op", aanroepen.length > 0);
proef(
  "geplakte HTML wordt rijk opgeschoond, niet kaalgeslagen",
  aanroepen.every((a) => /rich:\s*true/.test(a)),
  "cleanPastedHtml zonder `rich: true` gooit koppen, lijsten, lijnen en alinea's weg;\n"
  + "     | dan staat een geplakte strategie als muur tekst in het veld.",
);
proef(
  "platte tekst die markdown is wordt gerenderd",
  /lijktOpMarkdown\(/.test(veld) && /mdToHtml\(/.test(veld),
  "Zonder deze weg komen `##` en `- ` letterlijk in beeld, en dat is precies de\n"
  + "     | regel 'nooit ruwe markdown in beeld'.",
);

// Eén editor, één plakgedrag. Een tweede contentEditable met een eigen onPaste
// is precies hoe de opmaak eerder uit elkaar liep.
proef(
  "er is geen tweede plak-opschoner naast lib/rich-paste.ts",
  !/function\s+cleanPastedHtml/.test(veld),
  "Het opschonen hoort op één plek te wonen (lib/rich-paste.ts).",
);

// ── 2. Wat het opschonen daadwerkelijk overhoudt ─────────────────────────────
// Precies de tekst die misging: een stuk strategie uit de chat ernaast, met een
// kop, een alinea, een opsomming, een lijn en een tabel erin.
const GEPLAKT = [
  '<div style="font-family:Arial;font-size:19px">',
  '<h2 style="color:#333">Laag 1, dienstpagina\'s</h2>',
  '<p>Doel: ranken op inhoudelijke termen zoals <b>tuinaanleg</b>.</p>',
  '<ul><li><a href="https://kamsteeg.nl/tuinaanleg/">/tuinaanleg/</a></li><li>/tuinontwerp/</li></ul>',
  '<hr>',
  '<table><tr><th>Plaats</th><th>Status</th></tr><tr><td>Etten-Leur</td><td>Bouwen</td></tr></table>',
  '</div>',
].join("");
const schoon = cleanPastedHtml(GEPLAKT, { keepTables: true, rich: true });

proef("er komt iets uit het opschonen", schoon.length > 0, schoon);
proef("een kop blijft een kop", /<h3>Laag 1, dienstpagina's<\/h3>/.test(schoon), schoon);
proef("een alinea blijft een alinea", /<p>Doel:/.test(schoon), schoon);
proef("vet blijft vet", /<strong>tuinaanleg<\/strong>/.test(schoon), schoon);
proef("een opsomming blijft een opsomming", /<ul><li>/.test(schoon), schoon);
proef("een link blijft klikbaar", /<a href="https:\/\/kamsteeg\.nl\/tuinaanleg\/"/.test(schoon), schoon);
proef("een lijn blijft een lijn", /<hr>/.test(schoon), schoon);
proef("een tabel blijft een tabel", /<table class="paste-table">/.test(schoon), schoon);
proef(
  "na een kop begint een nieuw blok, geen losse tekst",
  !/<\/h[1-6]>\s*[^<\s]/.test(schoon),
  "Precies wat er misging: de kop werd gewone letters en de eerste zin eronder\n"
  + "     | plakte eraan vast ('samenvattingKern van de aanpak' als één woord).",
);
proef(
  "lettertype, lettergrootte en kleuren van buiten gaan eruit",
  !/style=/.test(schoon.replace(/style="text-align:right"/g, "")) && !/font-family|font-size|color:/.test(schoon),
  schoon,
);
proef(
  "een omhullende div wordt geen alinea om een kop heen",
  !/<p>\s*<h3/.test(schoon),
  "Een kop in een <p> laat de browser de opmaak uit elkaar klappen.",
);

proef("een kopregel wordt herkend als markdown", lijktOpMarkdown("## Laag 1 - dienstpagina's"));
proef("een bullet wordt herkend als markdown", lijktOpMarkdown("Plan:\n- tuinaanleg\n- tuinontwerp"));
proef("een genummerd punt wordt herkend", lijktOpMarkdown("1. Etten-Leur\n2. Oosterhout"));
proef("een tabelrij wordt herkend", lijktOpMarkdown("| Plaats | URL |\n| --- | --- |"));
proef("vetgedrukte tekst wordt herkend", lijktOpMarkdown("Dit is **belangrijk** voor de koers."));
proef(
  "gewone tekst met een streepje glipt er niet doorheen",
  !lijktOpMarkdown("Kamsteeg is een hovenier in Breda met meer dan 30 jaar ervaring."),
  "Anders zou elke gewone zin door de markdown-renderer gaan.",
);
proef("lege tekst is geen markdown", !lijktOpMarkdown("   "));

// ── 3. Eén bron voor de opmaak ───────────────────────────────────────────────
const css = readFileSync(join(WORTEL, "app", "globals.css"), "utf8");

// De vrije velden hangen aan dezelfde typografie als gerenderde tekst. Wordt
// `.focus-rich` daar losgetrokken, dan lopen de twee weer uit elkaar.
const gedeeld = [
  ["kopjes", ".md h3, .chat-md h3, .focus-rich h3"],
  ["alinea's", ".md p, .chat-md p, .focus-rich p"],
  ["lijsten", ".md ul, .md ol, .chat-md ul, .chat-md ol, .focus-rich ul, .focus-rich ol"],
  ["lijnen", ".md hr, .chat-md hr, .focus-rich hr"],
] as const;
for (const [wat, selector] of gedeeld) {
  proef(
    `${wat} in een vrij tekstveld komen uit dezelfde opmaak als gerenderde tekst`,
    css.includes(selector),
    `Verwacht de selector: ${selector}`,
  );
}

// Het vangnet dat opmaak van buiten tegenhoudt mag de eigen huisstijl niet
// wegvegen. Stond hier eerder `font-size: inherit !important` op `.focus-rich *`,
// en daardoor was een kop precies even groot als gewone tekst.
const blanket = css.split("\n").filter((r) => /^\.rich-cell \*, \.focus-rich \*|^\.focus-rich \*/.test(r.trim()));
proef(
  "het vangnet tegen vreemde opmaak plet de eigen koppen niet",
  blanket.length > 0 && blanket.every((r) => !/font-size:\s*inherit\s*!important/.test(r)),
  "Een `font-size: inherit !important` op `.focus-rich *` maakt elke kop even groot\n"
  + "     | als gewone tekst, hoe netjes de opmaakregels erboven ook zijn.",
);
proef(
  "een geplakte tabel krijgt dezelfde opmaak als een gerenderde tabel",
  /\.md-table,\s*\.paste-table\s*\{/.test(css),
  "Verwacht dat `.paste-table` meeloopt in het `.md-table`-blok.",
);

console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef(en) mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
