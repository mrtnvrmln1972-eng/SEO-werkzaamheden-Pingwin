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
// Deze controle is deterministisch en dekt het hele bestand. Hij leest beide
// versies uit als "wat doet elke selector uiteindelijk": per selector elke
// eigenschap, met alle var(--…) opgelost tot een letterlijke waarde, en met een
// tweede regel die de eerste overschrijft zoals een browser dat doet. Daarna
// legt hij die twee naast elkaar. Nul verschil betekent: geen enkele pixel kán
// anders zijn, ook niet in een toestand die je nooit gefotografeerd hebt.
//
// Per selector en niet per regel, en dat is een les: de eerste versie
// vergeleek regel voor regel, en die weigerde dienst zodra er een token
// bíjkwam. Dat gebeurt elke ronde waarin een rol blijkt te ontbreken, dus
// precies op het moment dat je het bewijs nodig hebt.
//
// Getest met een opzettelijke fout voordat hij vertrouwd werd: een controle die
// altijd groen zegt is erger dan geen controle.
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

/**
 * Zet een stylesheet om in "wat elke selector uiteindelijk doet": per selector
 * de eigenschappen met hun opgeloste waarde.
 *
 * WAAROM NIET REGEL VOOR REGEL (les van 18-08-2026)
 * ─────────────────────────────────────────────────
 * De eerste versie vergeleek regel voor regel, en dat werkt precies zolang een
 * ronde alleen waarden vervangt. Zodra er een token bíjkomt (en dat gebeurt
 * elke keer dat er een rol ontbreekt, zoals --ruimte-groep en --type-cijfer)
 * schuiven alle regelnummers een plek op en weigert de controle dienst. Dan
 * heb je geen bewijs meer op het moment dat je het nodig hebt.
 *
 * Per selector vergelijken heeft dat probleem niet, en het is bovendien wat je
 * echt wilt weten: doet .opr-kop nog exact hetzelfde? Een regel die verplaatst
 * is doet niet mee, een selector die iets anders doet valt meteen op.
 *
 * Een selector die twee keer voorkomt (een tweede regel die de eerste
 * overschrijft) wordt samengevoegd in bronvolgorde, net als in een browser.
 */
function gedrag(css: string, tok: Record<string, string>): Map<string, Record<string, string>> {
  const uit = new Map<string, Record<string, string>>();
  const stapel: string[] = [];
  for (const regel of css.split("\n")) {
    const onder = [...stapel].reverse().find((s) => !s.startsWith("@")) ?? "";
    const eigen = regel.includes("{") ? regel.split("{")[0] : "";
    const selector = regel.includes("{") && !eigen.trim().startsWith("@") ? eigen.trim() : onder;
    if (selector && selector !== ":root") {
      const bestaand = uit.get(selector) ?? {};
      for (const m of regel.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/g)) {
        // De selector zelf staat vóór de accolade; alleen wat erná komt is een
        // declaratie. Zonder dit telt "a:hover" als eigenschap "a".
        const na = regel.includes("{") ? regel.slice(regel.indexOf("{")) : regel;
        if (!na.includes(m[0])) continue;
        bestaand[m[1]] = norm(los(m[2], tok));
      }
      if (Object.keys(bestaand).length) uit.set(selector, bestaand);
    }
    for (const teken of regel) {
      if (teken === "{") stapel.push(eigen.trim() || onder);
      else if (teken === "}") stapel.pop();
    }
  }
  return uit;
}

const gv = gedrag(voor, tv);
const gn = gedrag(na, tn);

const verschillen: string[] = [];
let bekeken = 0;
for (const [selector, voorheen] of gv) {
  const nu = gn.get(selector);
  if (!nu) { verschillen.push(`  ${selector}: bestaat niet meer`); continue; }
  for (const eig of new Set([...Object.keys(voorheen), ...Object.keys(nu)])) {
    bekeken++;
    if (voorheen[eig] !== nu[eig]) {
      verschillen.push(`  ${selector} | ${eig}: ${voorheen[eig] ?? "(niets)"} → ${nu[eig] ?? "(weg)"}`);
    }
  }
}
for (const selector of gn.keys()) if (!gv.has(selector)) verschillen.push(`  ${selector}: is nieuw`);

console.log(`${gv.size} selectors vergeleken sinds ${ref}, ${bekeken} eigenschappen.`);
if (verschillen.length === 0) {
  console.log("Nul plekken waar de uitkomst verandert: deze omzetting is aantoonbaar onzichtbaar.\n");
  process.exit(0);
}
console.log(`\n${verschillen.length} plek(ken) waar de uitkomst WEL verandert:`);
console.log(verschillen.slice(0, 40).join("\n"));
if (verschillen.length > 40) console.log(`  … en nog ${verschillen.length - 40}.`);
console.log("\nIs dat de bedoeling, dan hoort er een foto vóór en ná bij. Zo niet: dit is een fout.\n");
process.exit(1);
