// ═══════════════════════════════════════════════════════════
// POORT: EEN DEEL-LINK GEEFT NOOIT MEER WEG DAN HET ENE STUK
// ═══════════════════════════════════════════════════════════
// Een deel-link gaat naar iemand die niet inlogt en die we niet kennen. De
// belofte eromheen is smal en hard: hij ziet dit ene onderwerp van deze ene
// klant, hij kan er niets mee wijzigen, en hij kan van daaruit nergens anders in
// het dashboard komen. Drie dingen die stilletjes kunnen sneuvelen zodra iemand
// een blok kopieert van een beheerscherm naar een deelpagina, en die je op het
// scherm niet ziet: een link naar /admin doet het gewoon, tot iemand erop klikt.
//
// Vandaar deze proef. Hij leest wat er echt in de bestanden staat:
//
//  1. Elke publieke route onder app/api/share/ heeft ALLEEN een GET. Een POST,
//     PUT, PATCH of DELETE daar zou een schrijfweg zonder inlog zijn. Eén soort
//     deel-link is dat wél met opzet (de afwerklijst waar de sitebouwer punten
//     afvinkt); die staat met reden in proeven/deel-link-erfenis.json en moet
//     dan alsnog eerst het token omzetten naar een klant.
//  2. Elke publieke route begint met het token omzetten naar een klant. Zonder
//     die stap zou een slug in de zoekopdracht al genoeg zijn om bij een andere
//     klant te kijken.
//  3. Geen enkele deelpagina onder app/share/ linkt naar /admin, /dashboard of
//     /login, en roept geen /api/admin-route aan.
//  4. De tokens komen uit één bron (lib/deel-link.ts). Een tweede plek die zelf
//     een token verzint is precies hoe de vier oude deel-links uit elkaar liepen.
//
// Zet deze proef nooit uit; breid hem uit zodra er een nieuwe soort deel-link
// bijkomt, want die hoort vanaf zijn eerste commit onder dezelfde belofte te vallen.
// ═══════════════════════════════════════════════════════════

import fs from "fs";
import path from "path";

const WORTEL = path.join(__dirname, "..");
let fouten = 0;
function checkWaar(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

function bestandenIn(map: string, eind: string): string[] {
  const vol = path.join(WORTEL, map);
  if (!fs.existsSync(vol)) return [];
  const uit: string[] = [];
  for (const naam of fs.readdirSync(vol)) {
    const pad = path.join(vol, naam);
    if (fs.statSync(pad).isDirectory()) uit.push(...bestandenIn(path.join(map, naam), eind));
    else if (naam.endsWith(eind)) uit.push(path.join(map, naam));
  }
  return uit;
}

const erfenis = JSON.parse(fs.readFileSync(path.join(WORTEL, "proeven/deel-link-erfenis.json"), "utf8")) as {
  magSchrijven: Record<string, string>;
  eigenToken: string[];
};

// ── 1 en 2. De publieke routes ─────────────────────────────
const routes = bestandenIn("app/api/share", "route.ts");
checkWaar("er zijn publieke deel-routes gevonden", routes.length > 0, "Is app/api/share verplaatst?");
for (const rel of routes) {
  const bron = fs.readFileSync(path.join(WORTEL, rel), "utf8");
  const schrijft = [...bron.matchAll(/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
  const magSchrijven = Object.prototype.hasOwnProperty.call(erfenis.magSchrijven, rel);
  if (magSchrijven) {
    checkWaar(`${rel} mag met reden schrijven`, true);
    // Een uitzondering die niets meer schrijft, hoort van de lijst af: anders
    // staat er over een jaar een openstaande deur die niemand meer gebruikt.
    checkWaar(`${rel} gebruikt zijn uitzondering nog`, schrijft.length > 0,
      "Deze route schrijft niet meer. Haal hem uit magSchrijven in proeven/deel-link-erfenis.json.");
  } else {
    checkWaar(`${rel} kan alleen lezen`, schrijft.length === 0,
      `Gevonden: ${schrijft.join(", ")}. Een deel-link mag geen schrijfweg zonder inlog zijn; zet dit achter /api/admin. Is afvinken of invullen juist het doel van deze link, zet hem dan met reden in magSchrijven in proeven/deel-link-erfenis.json.`);
  }
  checkWaar(`${rel} zoekt de klant op via het token`, /getSlugBy\w*Token\s*\(/.test(bron),
    "Zonder die stap bepaalt de bezoeker zelf welke klant hij ziet. Gebruik getSlugByDeelToken uit lib/deel-link.ts.");
}

// ── 3. De publieke pagina's ────────────────────────────────
const paginas = bestandenIn("app/share", ".tsx");
checkWaar("er zijn publieke deelpagina's gevonden", paginas.length > 0, "Is app/share verplaatst?");
for (const rel of paginas) {
  const bron = fs.readFileSync(path.join(WORTEL, rel), "utf8");
  // Alleen echte adressen: een href, een fetch of een router-duw. Het woord
  // "admin" in een pad naar een gedeelde component (../../admin/client/...) is
  // een import en geen weg voor de bezoeker.
  const wegen = [...bron.matchAll(/(?:href|action)\s*=\s*[{"'`]+\s*(\/(?:admin|dashboard|login)[^"'`}\s]*)/g)].map((m) => m[1]);
  checkWaar(`${rel} biedt geen weg naar de rest van het dashboard`, wegen.length === 0,
    `Gevonden: ${wegen.join(", ")}. Wie een deel-link krijgt, hoort dit ene stuk te zien en verder niets.`);
  const adminApi = [...bron.matchAll(/fetch\(\s*[`"']([^`"']*\/api\/admin\/[^`"']*)/g)].map((m) => m[1]);
  checkWaar(`${rel} roept geen beheerroute aan`, adminApi.length === 0,
    `Gevonden: ${adminApi.join(", ")}. Die geeft 401 zonder inlog, dus het scherm zou half leeg blijven; haal de aanroep weg.`);
}

// ── 4. Eén bron voor de tokens ─────────────────────────────
const bronBestand = path.join(WORTEL, "lib/deel-link.ts");
checkWaar("lib/deel-link.ts bestaat", fs.existsSync(bronBestand), "Dat is de enige plek waar een deel-token gemaakt wordt.");
const eigenToken = bestandenIn("lib", ".ts")
  .filter((rel) => rel !== "lib/deel-link.ts")
  .filter((rel) => {
    const bron = fs.readFileSync(path.join(WORTEL, rel), "utf8");
    return /randomBytes\([^)]*\)\.toString\("base64url"\)/.test(bron) && /deel|share/i.test(bron);
  });
const nieuweEigen = eigenToken.filter((rel) => !erfenis.eigenToken.includes(rel));
checkWaar("geen nieuwe plek verzint zelf een deel-token", nieuweEigen.length === 0,
  `Gevonden: ${nieuweEigen.join(", ")}. Gebruik getOrCreateDeelToken uit lib/deel-link.ts.`);
// De ratel: een bestand dat schoon is geworden moet van de lijst af, anders
// glipt het er later weer in zonder dat iemand het merkt.
const schoonGeworden = erfenis.eigenToken.filter((rel) => !eigenToken.includes(rel));
checkWaar("de erfenis-lijst bevat geen schone bestanden meer", schoonGeworden.length === 0,
  `Deze maken geen eigen token meer: ${schoonGeworden.join(", ")}. Haal ze uit eigenToken in proeven/deel-link-erfenis.json.`);

if (fouten) {
  console.error(`\n✗ Deel-link: ${fouten} punt(en) niet in orde.\n`);
  process.exit(1);
}
console.log(`\n✓ Deel-link: ${routes.length} publieke route(s) en ${paginas.length} publieke pagina('s) houden zich aan de belofte.`);
