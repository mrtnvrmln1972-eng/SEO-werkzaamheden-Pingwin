// Bewijst dat een omzetting naar de betekenislaag NIETS heeft veranderd.
//
// GEBRUIK
// ═══════
//   npx tsx scripts/zelfde-uitkomst.ts            (vergelijkt met HEAD)
//   npx tsx scripts/zelfde-uitkomst.ts origin/main
//
// WAAROM DIT BESTAAT
// ══════════════════
// Bij het omzetten van de opmaak naar de betekenislaag (--kleur-*, --type-*,
// --ruimte-*) is er één ding dat je zeker wilt weten: er verandert niets aan wat
// Maarten ziet. De eerste ronden zijn daarvoor met foto's gecontroleerd, vóór en
// ná, pixel voor pixel. Dat werkt, maar het is zwak bewijs en het is duur:
//
//  - een foto dekt alleen wat op dat ene scherm zichtbaar is, en de meeste
//    opmaak zit in toestanden die je niet toevallig in beeld hebt (hover, een
//    open venster, een lege lijst, een foutmelding);
//  - een foto is onbetrouwbaar om redenen die niets met de opmaak te maken
//    hebben. Bij de takenpagina scheelde de foto 158 pixels in hoogte, en dat
//    bleek te komen doordat een teller pas ná een netwerkvraag verschijnt en de
//    wachttijd te kort stond. Een half uur zoeken naar een fout die er niet was.
//
// Deze controle is deterministisch en dekt het hele bestand. Voor élke regel die
// veranderde: los alle var(--…) op tot een letterlijke waarde, aan beide kanten,
// en vergelijk. Komt er ergens iets anders uit, dan noemt hij regel en
// eigenschap. Nul verschil betekent: geen enkele pixel kán anders zijn, ook niet
// in een toestand die je nooit gefotografeerd hebt.
//
// Bewust GEEN proef in `proeven/`: dit is gereedschap voor tijdens een
// omzettingsronde, geen regel die altijd moet gelden. Latere ronden veranderen
// de opmaak juist wél (het afronden van maten die niet op de schaal passen), en
// dan hoort deze controle rood te staan.

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const WORTEL = path.join(__dirname, "..");
const BESTAND = "app/globals.css";
const ref = process.argv[2] || "HEAD";

const na = fs.readFileSync(path.join(WORTEL, BESTAND), "utf8");
let voor: string;
try {
  voor = execSync(`git show ${ref}:${BESTAND}`, { cwd: WORTEL, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
} catch {
  console.error(`Kon ${BESTAND} niet ophalen uit ${ref}. Bestaat die revisie?`);
  process.exit(1);
}

/** De tokens uit :root, als naam-naar-waarde. */
function tokens(css: string): Record<string, string> {
  const start = css.indexOf(":root {");
  const eind = css.indexOf("\n}", start);
  const uit: Record<string, string> = {};
  for (const m of css.slice(start, eind).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) uit[m[1]] = m[2].trim();
  return uit;
}

/**
 * Lost elke var(--x) op tot een letterlijke waarde, ook door meerdere lagen
 * heen (--kleur-accent → --orange → #E7773F). Een terugvalwaarde
 * (var(--x, 12px)) wordt gebruikt als de variabele niet bestaat, precies zoals
 * een browser het doet.
 */
function los(waarde: string, tok: Record<string, string>, diep = 0): string {
  if (diep > 12) return waarde;
  const nieuw = waarde.replace(/var\((--[\w-]+)(?:\s*,\s*([^()]*))?\)/g, (_, naam: string, terugval?: string) =>
    tok[naam] !== undefined ? los(tok[naam], tok, diep + 1) : (terugval ?? "ONBEKEND").trim()
  );
  return nieuw.includes("var(") && nieuw !== waarde ? los(nieuw, tok, diep + 1) : nieuw;
}

/** #fff en #ffffff zijn dezelfde kleur; spaties en hoofdletters doen niet mee. */
function norm(tekst: string): string {
  return tekst
    .trim().toLowerCase()
    .replace(/\s+/g, " ").replace(/\s*,\s*/g, ",")
    .replace(/#([0-9a-f]{3,8})\b/g, (_, h: string) =>
      "#" + (h.length === 3 ? h.split("").map((c) => c + c).join("") : h));
}

const tv = tokens(voor);
const tn = tokens(na);
const rv = voor.split("\n");
const rn = na.split("\n");

if (rv.length !== rn.length) {
  console.error(
    `Het aantal regels verschilt (${rv.length} tegen ${rn.length}). Deze controle vergelijkt regel voor regel,\n` +
    `dus hij werkt alleen op een ronde die alléén waarden omzet. Is er opmaak bij- of weggekomen, gebruik dan een foto.`
  );
  process.exit(1);
}

const verschillen: string[] = [];
let gewijzigd = 0;
for (let i = 0; i < rv.length; i++) {
  if (rv[i] === rn[i]) continue;
  gewijzigd++;
  const declaraties = (regel: string) => {
    const uit: Record<string, string> = {};
    for (const m of regel.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/g)) uit[m[1]] = m[2];
    return uit;
  };
  const da = declaraties(rv[i]);
  const db = declaraties(rn[i]);
  for (const eig of new Set([...Object.keys(da), ...Object.keys(db)])) {
    const a = norm(los(da[eig] ?? "", tv));
    const b = norm(los(db[eig] ?? "", tn));
    if (a !== b) verschillen.push(`  regel ${i + 1} | ${eig}: ${a || "(weg)"} → ${b || "(weg)"}`);
  }
}

console.log(`${gewijzigd} regels gewijzigd sinds ${ref}.`);
if (verschillen.length === 0) {
  console.log("Nul regels waar de uitkomst verandert: deze omzetting is aantoonbaar onzichtbaar.\n");
  process.exit(0);
}
console.log(`\n${verschillen.length} plek(ken) waar de uitkomst WEL verandert:`);
console.log(verschillen.slice(0, 40).join("\n"));
if (verschillen.length > 40) console.log(`  … en nog ${verschillen.length - 40}.`);
console.log("\nIs dat de bedoeling, dan hoort er een foto vóór en ná bij. Zo niet: dit is een fout.\n");
process.exit(1);
