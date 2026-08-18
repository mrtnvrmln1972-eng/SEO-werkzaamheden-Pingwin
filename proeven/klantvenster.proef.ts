// ═══════════════════════════════════════════════════════════
// EEN OMGEVING DIE ÉÉN KLANT TOONT, TOONT ER OOK ÉÉN
// ═══════════════════════════════════════════════════════════
// Naast het gewone dashboard komt er een tweede voordeur op een eigen adres, met
// dezelfde gegevens erachter, bedoeld om je scherm mee te delen en om er later
// iemand van buiten in te laten. Zonder slot zou daar de hele klantenlijst
// achter zitten.
//
// Het slot is `WERELD_KLANT` (zie lib/klantvenster.ts) en het werkt omgekeerd
// aan een lijstje met verboden schermen: alles is dicht, behalve wat expliciet
// openstaat. Deze proef rekent dat na, want een deur die alleen in een document
// beschreven staat, gaat open zodra iemand haast heeft.
//
// Rood als: het venster niet vóór de rechten zit (dus ook de eigenaar niet
// tegenhoudt), als een pad buiten de klant tóch open is, als de foto-route langs
// het pad-slot kan, als de automatische ronden in een venster meedraaien, of als
// er een route bij de beheerkant bijkomt zonder poort.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

const wortel = join(__dirname, "..");
const lees = (...p: string[]) => readFileSync(join(wortel, ...p), "utf8");

// ── 1. Het venster zelf: gedrag, niet alleen tekst ──────────

process.env.WERELD_KLANT = "";
const venster = require(join(wortel, "lib", "klantvenster.ts")) as typeof import("../lib/klantvenster");

proef("zonder WERELD_KLANT verandert er niets",
  venster.vensterKlant() === null && venster.magVensterSlug("kamsteeg") && venster.magVensterPad("/admin/financien"),
  "Het gewone dashboard hoort niets van dit slot te merken.");

process.env.WERELD_KLANT = "noc";

proef("met een venster bestaat alleen die klant",
  venster.magVensterSlug("noc") && !venster.magVensterSlug("kamsteeg") && !venster.magVensterSlug(""),
  "magVensterSlug laat een andere klant door.");

const magWel = ["/admin/client/noc", "/admin/client/noc/werklijst", "/admin/preview/noc", "/admin/login", "/admin/enter", "/admin/developer"];
const magNiet = ["/admin", "/admin/client/kamsteeg", "/admin/client/kamsteeg/sitemap", "/admin/financien", "/admin/agenda", "/admin/usage", "/admin/beheer", "/admin/tweaks", "/admin/routekaart", "/admin/preview/kamsteeg", "/admin/grote-punten"];

proef("de schermen van de eigen klant blijven open",
  magWel.every((p) => venster.magVensterPad(p)),
  "Dicht: " + magWel.filter((p) => !venster.magVensterPad(p)).join(", "));

proef("alle andere beheerschermen zijn dicht",
  magNiet.every((p) => !venster.magVensterPad(p)),
  "Nog open: " + magNiet.filter((p) => venster.magVensterPad(p)).join(", "));

proef("een pad met een staartje of hoofdletters glipt er niet langs",
  !venster.magVensterPad("/admin/client/kamsteeg/") && !venster.magVensterPad("/admin/client/noc-extra") && !venster.magVensterPad("/admin/financien?tab=1"),
  "De padcontrole is te makkelijk te omzeilen.");

process.env.WERELD_KLANT = "";

// ── 2. Het venster zit vóór de rechten, niet erin ───────────

const scope = lees("lib", "admin-scope.ts");
const eersteRegels = (naam: string) => {
  const start = scope.indexOf(`export function ${naam}(`);
  return start < 0 ? "" : scope.slice(start, start + 400);
};

proef("canAccessSlug checkt het venster vóór de eigenaar-regel",
  eersteRegels("canAccessSlug").indexOf("magVensterSlug") < eersteRegels("canAccessSlug").indexOf("isOwner"),
  "Staat de eigenaar-regel eerst, dan ziet Maarten op de voordeur alsnog elke klant.");

proef("canEditSlug checkt het venster ook",
  eersteRegels("canEditSlug").includes("magVensterSlug"),
  "Zonder deze regel kun je op de voordeur schrijven bij een andere klant.");

proef("de scope krijgt de vensterklant als bereik",
  scope.includes("allowedSlugs: [venster]"),
  "Schermen die de klantenlijst gebruiken filteren dan niet mee.");

proef("eigenaar-only routes bestaan niet in een venster",
  /export async function guardOwner[\s\S]{0,400}vensterKlant\(\)/.test(scope),
  "guardOwner laat bureau-brede routes (klant aanmaken, team, financiën) alsnog toe.");

// ── 3. De voorpoort in de middleware ────────────────────────

const mw = lees("middleware.ts");
proef("de middleware stuurt vreemde schermen terug naar de eigen klant",
  mw.includes("magVensterPad") && mw.includes("vensterStartPad"),
  "Zonder voorpoort opent het verkeerde scherm eerst en wordt het pas daarna geweigerd.");

proef("automatische ronden draaien niet in een venster",
  mw.includes("/api/cron/") && mw.includes("klantvenster") && mw.includes('"/api/cron/:path*"'),
  "Dan draait elke nachtronde dubbel op dezelfde gegevens.");

proef("de foto-route gebruikt hetzelfde pad-slot",
  lees("app", "api", "admin", "kijkbeeld", "route.ts").includes("magVensterPad"),
  "Anders haal je via een schermfoto alsnog een blik op een andere klant.");

// ── 4. Elke route aan de beheerkant heeft een poort ─────────

// Bewuste uitzonderingen, met reden. Deze lijst mag alleen korter worden.
const VRIJ = new Map<string, string>([
  ["app/api/admin/login/route.ts", "de inlogroute zelf, die moet open"],
  ["app/api/admin/logout/route.ts", "uitloggen mag altijd"],
  ["app/api/admin/mail/people/route.ts", "heeft zijn eigen slot per omgeving (MAIL_PEOPLE_SUGGEST)"],
]);

const POORTEN = ["guardSlug", "guardDev", "guardOwner", "vensterPoort", "magVensterPad", "vensterKlant"];

function routes(map: string): string[] {
  const uit: string[] = [];
  for (const naam of readdirSync(join(wortel, map))) {
    const pad = join(map, naam);
    if (statSync(join(wortel, pad)).isDirectory()) uit.push(...routes(pad));
    else if (naam === "route.ts") uit.push(pad);
  }
  return uit;
}

const zonderPoort: string[] = [];
const overbodigVrij: string[] = [];
for (const pad of routes(join("app", "api", "admin"))) {
  const sleutel = pad.split(/[\\/]/).join("/");
  const bron = lees(pad);
  const heeft = POORTEN.some((p) => bron.includes(p + "("));
  if (heeft && VRIJ.has(sleutel)) overbodigVrij.push(sleutel);
  if (!heeft && !VRIJ.has(sleutel)) zonderPoort.push(sleutel);
}

proef("geen enkele beheerroute staat zonder poort open",
  zonderPoort.length === 0,
  "Zet er een poort op (guardSlug als hij bij één klant hoort, anders vensterPoort):\n     | " + zonderPoort.join("\n     | "));

proef("de vrijstellingslijst bevat niets dat al een poort heeft",
  overbodigVrij.length === 0,
  "Deze staan onnodig op de lijst en horen eraf: " + overbodigVrij.join(", "));

console.log(fouten === 0 ? "\nAlles goed." : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
