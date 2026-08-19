// ═══════════════════════════════════════════════════════════
// EEN VERHUIZING MAG NIETS VERGETEN EN NIETS OPENZETTEN
// ═══════════════════════════════════════════════════════════
// De verhuizing haalt een klant met alles erin uit een losse omgeving naar het
// dashboard. Twee dingen kunnen daar stil misgaan, en allebei merk je het pas
// veel later:
//
//  1. Iets gaat niet mee. Dat gebeurt zodra er ergens een handmatige lijst met
//     soorten gegevens staat; die veroudert bij het eerstvolgende nieuwe stuk.
//     De databrug van juni had zo'n lijst: acht soorten, terwijl er
//     vierenzeventig tabellen aan een klant hangen.
//  2. De deur blijft openstaan. Het inlezen gebeurt van server naar server, dus
//     zonder ingelogde gebruiker. Zo'n deur zonder slot is precies de fout die
//     in augustus 2026 al een keer live stond bij de snelle beheerder-ingang.
//
// Deze proef bewaakt allebei, plus het omzetten van waarden onderweg, want daar
// verlies je stilletjes de inhoud van een chat als het misgaat.

import { readFileSync } from "node:fs";
import { join } from "node:path";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

const wortel = join(__dirname, "..");
const lees = (...p: string[]) => readFileSync(join(wortel, ...p), "utf8");

// ── 1. Onderweg blijft de inhoud heel ───────────────────────

const { klaarVoorDatabase } = require(join(wortel, "lib", "verhuizing.ts")) as typeof import("../lib/verhuizing");

const chat = [{ role: "user", content: "Wat staat er open?" }, { role: "assistant", content: "Zes taken." }];
proef("een chat gaat als JSON terug de database in",
  klaarVoorDatabase(chat, "jsonb") === JSON.stringify(chat),
  "Een JSON-kolom die als lijst wordt aangeboden, wordt geweigerd door de database.");

proef("een JSON-kolom met alleen tekst erin blijft JSON",
  klaarVoorDatabase(["a", "b"], "jsonb") === '["a","b"]',
  "Hier zit de val: zo'n waarde ziet eruit als een gewone lijst, maar de kolom is JSON.");

proef("een echte lijstkolom blijft een lijst",
  Array.isArray(klaarVoorDatabase(["a", "b"], "ARRAY")),
  "Een lijstkolom (zoals rechten per klant) moet als lijst mee, niet als tekst.");

proef("gewone waarden blijven zoals ze zijn",
  klaarVoorDatabase("tekst", "text") === "tekst" && klaarVoorDatabase(null, "text") === null
    && klaarVoorDatabase("2026-08-18T10:00:00.000Z", "timestamp with time zone") === "2026-08-18T10:00:00.000Z",
  "Tekst, leeg en datums horen ongemoeid door te gaan.");

// ── 2. Niets vergeten: de soorten komen uit de database ─────

const bron = lees("lib", "verhuizing.ts");
proef("de soorten gegevens komen uit de database zelf",
  bron.includes("information_schema.columns") && bron.includes("column_name = 'client_slug'"),
  "Zonder deze vraag staat er ergens een lijst, en die veroudert.");

proef("er staat geen handgeschreven lijst met tabellen in",
  !/const [A-Z_]+ *(: *string\[\])? *= *\[\s*"client_/.test(bron),
  "Een vaste lijst met tabelnamen betekent: wat er later bijkomt, verhuist niet mee.");

proef("de klantkaart gaat mee zonder inlog en zonder bedragen",
  /login_enabled/.test(bron) && /false/.test(bron)
    && !/maandbudget|uurtarief|beschikbare_uren/.test(bron),
  "Een verhuisde klant hoort geen inlog en geen budget te erven.");

proef("twee keer verhuizen levert geen dubbele rijen op",
  bron.includes("DELETE FROM") && bron.includes("vervang"),
  "Zonder vervangen groeit de lijst bij elke poging.");

// ── 3. Niets openzetten ─────────────────────────────────────

const deur = lees("app", "api", "verhuis-inlaad", "route.ts");
const codeCheck = deur.indexOf("codeGeldig");
proef("de inlaaddeur controleert de code vóór er iets geschreven wordt",
  codeCheck > 0 && codeCheck < deur.indexOf("inlaad(") && codeCheck < deur.indexOf("zorgVoorKlant("),
  "Zonder controle vooraf kan iedereen die het adres kent gegevens wegschrijven.");

proef("de inlaaddeur houdt zich aan het klantvenster",
  deur.includes("vensterPoort"),
  "In een omgeving die maar één klant toont, mag er ook maar één klant binnenkomen.");

const code = lees("lib", "verhuis-code.ts");
proef("de verhuiscode staat versleuteld opgeslagen",
  code.includes("createHash") && code.includes("afdruk(code)") && !code.includes("${code}"),
  "Wie in de database kijkt mag er niet mee naar binnen kunnen.");

proef("een code vervalt vanzelf en is in te trekken",
  code.includes("vervalt") && code.includes("ingetrokken"),
  "Een sleutel die eeuwig geldig is, is geen sleutel.");

const bediening = lees("app", "api", "admin", "verhuizing", "route.ts");
const adresRegel = lees("lib", "omgeving.ts");
proef("er kan alleen naar een Pingwin-omgeving gestuurd worden",
  bediening.includes("pingwinAdresOk")
  && /export function pingwinAdresOk/.test(adresRegel)
  && adresRegel.includes("https:") && adresRegel.includes(".vercel.app"),
  "Zonder grens wordt deze route een middel om vanaf deze server een willekeurig adres aan te roepen.");

proef("alleen de eigenaar mag verhuizen",
  bediening.includes("guardSlug") && bediening.includes("isOwner"),
  "Verhuizen verplaatst alles van een klant; dat is geen gasten-actie.");

console.log(fouten === 0 ? "\nAlles goed." : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
