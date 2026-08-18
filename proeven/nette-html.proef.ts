// ═══════════════════════════════════════════════════════════
// ÉÉN OPMAAK, ÉÉN POORT: VOOR ALLES WAT HET DASHBOARD ZELF MAAKT
// ═══════════════════════════════════════════════════════════
// Op 17 augustus 2026 bleek de opmaakregel op twee niveaus tegelijk lek:
//
//  1. OP HET SCHERM bestonden er vier uiterlijken naast elkaar voor dezelfde
//     soort tekst. Een tabel in een chat-antwoord had een licht-oranje kop, een
//     tabel uit de renderer een donkere, een geplakte tabel een derde en de
//     oogstlijst een vierde. Kopjes waren in de chat oranje met een lijntje en
//     elders bruin zonder. Maarten wees de chat aan als de juiste: die is nu de
//     enige, en hij staat in één gedeeld blok in `app/globals.css`.
//
//  2. IN DE CODE besliste élk scherm zélf hoe tekst HTML werd. Twee plekken
//     hadden dezelfde regel woordelijk uitgeschreven; andere deden iets
//     zwakkers, waardoor `## Kopje` gewoon in beeld kwam. Dat is nu één functie:
//     `netteHtml` in `lib/nette-html.ts`.
//
// Beide kunnen stilletjes terugvallen: iemand voegt een selector toe die alleen
// voor zijn eigen scherm geldt, of rendert tekst even snel met een eigen regel.
// Vandaar deze proef.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { netteHtml, isAlHtml } from "../lib/nette-html";

const WORTEL = join(__dirname, "..");

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

// ── 1. De poort doet wat hij belooft ─────────────────────────────────────────
const md = netteHtml(
  "## Laag 2, plaatspagina's\n\n**Doel:** ranken op hovenier [plaats].\n\n- /hovenier/etten-leur/\n- /hovenier/oosterhout/\n\n| Plaats | Status |\n| --- | --- |\n| Etten-Leur | Bouwen |",
  { basis: "kamsteeg.nl" },
);
// `#` wordt h3, `##` wordt h4: een paginakop hoort bij de pagina, niet bij de
// inhoud, dus de renderer schuift alles een niveau op.
proef("een kopje wordt een kop", /<h4>Laag 2/.test(md), md);
proef("één hekje wordt de hoogste inhoudskop", /<h3>Kern<\/h3>/.test(netteHtml("# Kern")));
proef("vet wordt vet", /<strong>Doel:<\/strong>/.test(md), md);
proef("een opsomming wordt een opsomming", /<ul>\s*<li>/.test(md), md);
proef("een tabel wordt een tabel", /<table class="md-table">/.test(md), md);
proef(
  "een pad wordt klikbaar naar de site van de klant",
  /<a href="https:\/\/kamsteeg\.nl\/hovenier\/etten-leur\/"/.test(md),
  md,
);
proef("er blijft geen ruw opmaakteken staan", !/(^|>)\s*#{1,6}\s|\*\*/.test(md), md);

// Al opgemaakte tekst (uit een rijk tekstveld) blijft staan zoals hij is.
const bestaand = netteHtml('<p>Zie <a href="https://x.nl/a/">de pagina</a>.</p>', { basis: "x.nl" });
proef("bestaande HTML blijft bestaande HTML", /^<p>Zie <a href="https:\/\/x\.nl\/a\/"/.test(bestaand), bestaand);
proef("een bestaande link wordt niet dubbel gelinkt", (bestaand.match(/<a /g) || []).length === 1, bestaand);
proef("scripts gaan eruit", !/script/i.test(netteHtml('<p>hoi</p><script>alert(1)</script>')));
proef("lege tekst geeft lege HTML", netteHtml("   ") === "");

// De beslissing zelf: markdown wint van een losse tag, want een genoemde tag
// hoort als leestekst in beeld te komen.
proef("echte HTML wordt herkend", isAlHtml("<p>hoi</p>"));
proef("markdown met een genoemde tag telt als markdown", !isAlHtml("## Kop\nGebruik <h1> niet."));
proef("platte tekst is geen HTML", !isAlHtml("gewoon een zin"));

// ── 2. Niemand rendert meer op eigen houtje ──────────────────────────────────
// De beslissing "al HTML of nog markdown?" hoort maar op één plek te staan.
const bronnen = [
  "app/admin/client/[slug]/PagesPanel.tsx",
  "app/admin/client/[slug]/pagina-chat/useStrategieChat.ts",
  "app/admin/client/[slug]/BespreekLijsten.tsx",
  "app/admin/client/[slug]/Notities.tsx",
  "app/admin/client/[slug]/weekplan-kaart/KaartFases.tsx",
];
const EIGEN_BESLISSING = /<\\\/\[a-z\]\[a-z0-9\]\*>/;
for (const b of bronnen) {
  const inhoud = readFileSync(join(WORTEL, b), "utf8");
  proef(
    `${b.split("/").pop()} rendert via de gedeelde poort`,
    inhoud.includes("netteHtml("),
    "Verwacht een aanroep van netteHtml uit lib/nette-html.ts.",
  );
  proef(
    `${b.split("/").pop()} schrijft de beslissing niet zelf uit`,
    !EIGEN_BESLISSING.test(inhoud),
    "De regel die bepaalt of iets al HTML is, hoort alleen in lib/nette-html.ts te staan.",
  );
}

// ── 2b. Een nieuw scherm kan geen zesde manier verzinnen ─────────────────────
// Elke plek die HTML op het scherm zet gaat door de gedeelde poort of de gedeelde
// renderer. Wat er van vóór 17-08-2026 nog buitenom gaat, staat in
// `render-erfenis.json`, en die lijst mag alleen korter worden.
type Erfenis = { toegestaan: string[]; vrijgesteld: Record<string, string> };
const erfenis = JSON.parse(readFileSync(join(__dirname, "render-erfenis.json"), "utf8")) as Erfenis;

function alleTsx(map: string): string[] {
  const uit: string[] = [];
  for (const naam of readdirSync(map, { withFileTypes: true })) {
    const pad = join(map, naam.name);
    if (naam.isDirectory()) uit.push(...alleTsx(pad));
    else if (naam.name.endsWith(".tsx")) uit.push(pad);
  }
  return uit;
}

const buitenom: string[] = [];
const schoonGeworden: string[] = [];
for (const pad of alleTsx(join(WORTEL, "app"))) {
  const relatief = pad.slice(WORTEL.length + 1);
  const inhoud = readFileSync(pad, "utf8");
  // Een <style> of <script> zet geen tekst op het scherm; die gaan over opmaak
  // en gedrag. De poort gaat over lopende tekst, dus daar hoort dit niet doorheen
  // (de vastgelegde huisstijl in app/layout.tsx is zo'n <style>). Elke andere
  // dangerouslySetInnerHTML is nog steeds tekst in beeld en moet door de poort.
  const zonderOpmaakTags = inhoud.replace(/<(style|script)\b[^>]*>/g, "");
  const aanroepen = zonderOpmaakTags.match(/dangerouslySetInnerHTML=\{\{\s*__html:\s*([A-Za-z_$][\w$]*)/g) || [];
  if (!aanroepen.length) continue;
  // Een kort hulpje in het bestand zelf mag, zolang het niets anders doet dan de
  // poort aanroepen (bijvoorbeeld `const puntHtml = (t) => netteHtml(t, ...)`).
  // Dat is geen tweede manier, dat is dezelfde manier met een kortere naam.
  const doorgeefluik = (naam: string) => {
    const def = new RegExp(`(const|function)\\s+${naam}\\b[^\\n]*(\\n[^\\n]*){0,4}`).exec(inhoud);
    return !!def && erfenis.toegestaan.some((goed) => def[0].includes(`${goed}(`));
  };
  const eigen = aanroepen
    .map((a) => a.replace(/[\s\S]*__html:\s*/, ""))
    .filter((naam) => !erfenis.toegestaan.includes(naam) && !doorgeefluik(naam));
  const vrijgesteld = relatief in erfenis.vrijgesteld;
  if (eigen.length && !vrijgesteld) buitenom.push(`${relatief} (${[...new Set(eigen)].join(", ")})`);
  if (!eigen.length && vrijgesteld) schoonGeworden.push(relatief);
}

proef(
  "geen enkel scherm zet HTML op het scherm buiten de gedeelde poort om",
  buitenom.length === 0,
  buitenom.length
    ? `Deze plek(ken) renderen zelf:\n     | ${buitenom.join("\n     | ")}\n     | Gebruik netteHtml uit lib/nette-html.ts, of zet het bestand met een reden in\n     | proeven/render-erfenis.json als het écht een losse regel of een echte mail is.`
    : "",
);
proef(
  "de erfenislijst bevat niets wat allang schoon is",
  schoonGeworden.length === 0,
  schoonGeworden.length
    ? `Haal deze uit proeven/render-erfenis.json, dan kan het niet meer terugvallen:\n     | ${schoonGeworden.join("\n     | ")}`
    : "",
);

// ── 3. Eén uiterlijk op het scherm ───────────────────────────────────────────
const css = readFileSync(join(WORTEL, "app", "globals.css"), "utf8");

proef(
  "tabellen in tekst hebben één uiterlijk",
  /\.md-table, \.chat-table, \.paste-table \{/.test(css),
  "De drie tabelklassen (renderer, chat, geplakt) horen in één regel te staan.",
);
proef(
  "er staat geen tweede tabelkop-stijl naast",
  !/^\.chat-table th \{/m.test(css),
  "Een eigen `.chat-table th` overschrijft het gedeelde blok en de kop wijkt weer af.",
);
// Het gedeelde blok staat bovenaan het bestand. Élke regel dáárna die dezelfde
// onderdelen nog een keer opmaakt, wint stilletjes en zet de boel weer uit
// elkaar. Zo is het vier keer misgegaan: de chatbubbel had een eigen set, de
// chat-klasse zelf ook, de bird's eye-blokken een derde en de tabellen een
// vierde. Deze controle leest alles ná het gedeelde blok en wordt rood zodra
// iemand er weer eentje bijzet.
const EINDE_GEDEELD = ".md-table td a, .chat-table td a, .paste-table td a { word-break: break-word; }";
const NA_GEDEELD = css.slice(css.indexOf(EINDE_GEDEELD) + EINDE_GEDEELD.length);
const ONDERDEEL = "(?:h[1-6]|ul|ol|li|a|strong|em|code|hr|p|blockquote|table)";
const eigenSets = NA_GEDEELD.split("\n").filter((regel) => {
  const sel = regel.split("{")[0];
  if (!regel.includes("{") || regel.trim().startsWith("/*") || regel.trim().startsWith("*")) return false;
  // Alleen selectors die .md, .chat-md of .focus-rich als bouwsteen gebruiken én
  // een van de onderdelen opmaken. Een eigen klasse (.opr-tabel, .task-table)
  // mag alles: die gaat niet over lopende tekst.
  if (!/\.(chat-md|md|focus-rich)(?![\w-])/.test(sel)) return false;
  return new RegExp(`\\.(chat-md|md|focus-rich)(?![\\w-])[^,{]*\\b${ONDERDEEL}\\b\\s*[,{]`).test(sel);
});
// Wat hier wél mag: puur positioneren (plakkende tabelkop) en het uitzetten van
// het pijltje in lijstjes die hun eigen opsommingsteken terugzetten.
const toegestaan = /position:\s*sticky|content:\s*none|padding-left:\s*0|max-width|word-break/;
const echtFout = eigenSets.filter((r) => !toegestaan.test(r));
proef(
  "niemand zet ná het gedeelde blok een eigen opmaak voor dezelfde onderdelen",
  echtFout.length === 0,
  echtFout.length
    ? `Deze regel(s) overschrijven het gedeelde blok:\n     | ${echtFout.slice(0, 3).map((r) => r.trim().slice(0, 110)).join("\n     | ")}\n     | Zet de opmaak in het gedeelde blok bovenaan, niet hier.`
    : "",
);
// De kern van het gedeelde blok: kop, bullet, link en tabel staan er voor alle
// drie de soorten tekst tegelijk in (gerenderd, chat, zelf getypt).
for (const selector of [
  ".md h1, .md h2, .md h3, .chat-md h1, .chat-md h2, .chat-md h3,",
  ".md ul, .chat-md ul, .focus-rich ul",
  ".md ul > li::before, .chat-md ul > li::before, .focus-rich ul > li::before",
  ".md a, .chat-md a, .focus-rich a",
]) {
  proef(`gedeelde opmaak aanwezig: ${selector.slice(0, 46)}…`, css.includes(selector), `Verwacht: ${selector}`);
}

console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef(en) mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
