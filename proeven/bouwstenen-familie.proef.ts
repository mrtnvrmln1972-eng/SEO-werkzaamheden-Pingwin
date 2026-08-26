// Proef: één scherm gebruikt één bouwsteen-familie, niet twee generaties door
// elkaar.
//
// WAAROM DIT BESTAAT
// ══════════════════
// Op 26-08-2026 kwam er een nieuwe pagina (werkplanning-proef) live die Maarten
// terecht "een ratjetoe" noemde: de oudere, generieke bouwstenen uit het
// allereerste design-fundament (`.card`, `.section`, `.row`, `.chip`, van vóór
// de rijkere cockpit-stijl bestond) stonden er naast de nieuwere cockpit-familie
// (`.cockpit-card`, `.strategy-card`/`.strategy-head`/`.strategy-body`,
// `.ck-section-head`, `.pnl-acties-groep`, `.deelkop`). Los bekeken voldeed alles:
// de knoppen gebruikten het knopsysteem keurig (huisstijl.proef.ts was groen),
// geen enkele CSS-regel overschreef een bouwsteen (bouwstenen.proef.ts was
// groen). Maar niets controleerde de vraag die er echt toe deed: kiest dit
// scherm überhaupt één stijlsysteem?
//
// `proeven/bouwstenen.proef.ts` bewaakt of een SELECTOR een bouwsteen zijn eigen
// uiterlijk afneemt. Dit bestand bewaakt iets anders en eenvoudigers: gebruikt
// één SCHERM zowel een klasse uit de oude familie als een klasse uit de nieuwe.
// Dat is op zichzelf al een teken dat twee generaties door elkaar lopen, ook als
// geen van beide een CSS-overtreding pleegt.
//
// DE ERFENIS-LIJST IS EEN RATEL
// ═════════════════════════════
// Vijf schermen mengden dit al vóór deze proef bestond (drie met een klein
// randje overlap, werkplanning-proef met bijna de hele lijst aan beide kanten).
// Die lijst mag alleen korter worden: verbouw je een scherm naar één familie,
// haal het eraf. Een NIEUW scherm staat er per definitie niet op.

import fs from "fs";
import path from "path";

const WORTEL = path.join(__dirname, "..");
let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { if (uitleg) console.log(`     | ${uitleg}`); fouten++; }
}

/** De oudere, generieke primitieven uit het allereerste design-fundament. */
const OUDE_FAMILIE = new Set(["card", "section", "row", "chip"]);
/** De nieuwere cockpit-familie, opgebouwd voor de klant-cockpit specifiek. */
const NIEUWE_FAMILIE = new Set([
  "cockpit-card", "strategy-card", "strategy-head", "strategy-body",
  "ck-section-head", "pnl-acties-groep", "deelkop",
]);

const ERFENIS = new Set<string>([
  "app/admin/client/[slug]/LeadKaart.tsx",
  "app/admin/client/[slug]/LeadMail.tsx",
  "app/admin/client/[slug]/Planning.tsx",
  "app/admin/client/[slug]/WerkplanPanel.tsx",
  "app/admin/client/[slug]/werkplanning-proef/WerkplanningProef.tsx",
]);

function alleTsx(map: string): string[] {
  const uit: string[] = [];
  for (const naam of fs.readdirSync(map)) {
    const vol = path.join(map, naam);
    if (fs.statSync(vol).isDirectory()) { if (naam !== "node_modules") uit.push(...alleTsx(vol)); continue; }
    if (naam.endsWith(".tsx")) uit.push(vol);
  }
  return uit;
}

const gemengd: string[] = [];
const erfenisGezien = new Set<string>();
let schoon = 0;
for (const vol of alleTsx(path.join(WORTEL, "app"))) {
  const rel = path.relative(WORTEL, vol).split(path.sep).join("/");
  const inhoud = fs.readFileSync(vol, "utf8");
  const klassen = new Set<string>();
  for (const m of inhoud.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    for (const k of (m[1] || m[2] || "").split(/\s+/)) if (k) klassen.add(k);
  }
  const oud = [...klassen].filter((k) => OUDE_FAMILIE.has(k));
  const nieuw = [...klassen].filter((k) => NIEUWE_FAMILIE.has(k));
  if (ERFENIS.has(rel)) { erfenisGezien.add(rel); continue; }
  if (oud.length && nieuw.length) gemengd.push(`${rel}: oud (${oud.join(", ")}) naast nieuw (${nieuw.join(", ")})`);
  else schoon++;
}

proef(
  `elk scherm kiest één bouwsteen-familie (${schoon} schoon, ${erfenisGezien.size} op de erfenis-lijst)`,
  gemengd.length === 0,
  gemengd.length
    ? `Gebruik óf de generieke bouwstenen (.card/.section/.row/.chip) óf de cockpit-familie ` +
      `(.cockpit-card/.strategy-card/.ck-section-head/.pnl-acties-groep/.deelkop), niet allebei op ` +
      `één scherm; dat is precies hoe "alles staat door elkaar" ontstaat.\n     | ${gemengd.join("\n     | ")}`
    : "",
);

const onnodig = [...ERFENIS].filter((rel) => {
  const vol = path.join(WORTEL, rel);
  if (!fs.existsSync(vol)) return true;
  const inhoud = fs.readFileSync(vol, "utf8");
  const klassen = new Set<string>();
  for (const m of inhoud.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    for (const k of (m[1] || m[2] || "").split(/\s+/)) if (k) klassen.add(k);
  }
  const oud = [...klassen].some((k) => OUDE_FAMILIE.has(k));
  const nieuw = [...klassen].some((k) => NIEUWE_FAMILIE.has(k));
  return !(oud && nieuw);
});
proef(
  "de erfenis-lijst bevat geen schone of verdwenen schermen meer",
  onnodig.length === 0,
  onnodig.length ? `Haal deze van de lijst, ze mengen niet meer of bestaan niet meer: ${onnodig.join(", ")}` : "",
);

console.log(fouten ? `\n${fouten} proef(en) mislukt.` : "\nAlle proeven geslaagd.");
process.exit(fouten ? 1 : 0);
