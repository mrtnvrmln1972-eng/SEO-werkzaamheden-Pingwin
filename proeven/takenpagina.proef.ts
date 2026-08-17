import fs from "node:fs";
import path from "node:path";

// ═══════════════════════════════════════════════════════════
// DE TAKENPAGINA HOUDT ZIJN KOP
// ═══════════════════════════════════════════════════════════
// Waarom deze proef bestaat: precies dit is hier al twee keer stilletjes
// weggevallen. "Top Prio's" (het veld prioHtml) bestond maanden, voedde elke
// chatvraag mee, maar stond op géén enkel scherm; en het blok met de vastgelegde
// strategiegesprekken hing alleen nog onder een bestand dat nergens meer werd
// aangeroepen, terwijl de chat na het vastleggen nog steeds zei "je vindt hem
// bovenaan het Taken-tabblad".
//
// Allebei niet zichtbaar in de code: alles compileert, alle andere proeven zijn
// groen, en toch is het scherm leeg. Een verwijzing die nergens meer heen wijst
// is dus geen stijlfout maar een stille storing, en die hoort een poort te zijn.

const WORTEL = path.resolve(__dirname, "..");
let fouten = 0;
function check(wat: string, goed: boolean, waarom: string) {
  console.log(`${goed ? "ok " : "FOUT"}  ${wat}`);
  if (!goed) { console.log(`      ${waarom}`); fouten++; }
}

const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");
const cockpit = lees("app/admin/client/[slug]/ClientCockpit.tsx");
const taken = cockpit.slice(
  cockpit.indexOf('{tab === "werkzaamheden" &&'),
  cockpit.indexOf('{tab === "resultaten" &&'),
);

check("het koersblok staat op de takenpagina", /<KoersBlok/.test(taken),
  "Zonder dat blok heeft de takenpagina geen antwoord op 'waar werken we naartoe'.");

check("de vastgelegde strategiegesprekken staan op de takenpagina", /<StrategyPanel/.test(taken),
  "De chat belooft na het vastleggen dat je ze bovenaan Taken vindt; die belofte moet kloppen.");

const koers = lees("app/admin/client/[slug]/KoersBlok.tsx");

check("de koers is een eigen veld", /soort="koers"/.test(koers),
  "Zonder soort=koers schrijft het blok in het verkeerde veld.");

check("het oppak-lijstje wordt getoond", /soort="prio"/.test(koers),
  "Het veld prioHtml voedt elke chatvraag; als het nergens op het scherm staat, stuurt het zonder dat je het kunt zien.");

check("de tellingen komen uit de werkvoorraad-route", /\/api\/admin\/werkvoorraad/.test(koers),
  "De chips horen te tellen wat er ligt, niet zelf iets te berekenen.");

// De koers is Maartens eigen tekst. Zodra de controle erin mag schrijven in
// plaats van ernaast, is hij na twee rondes niet meer van hem, en dan is het
// precies het automatisch samengeraapte lijstje dat hier niet gewenst is.
const koersCheck = lees("app/api/admin/koers-check/route.ts");
check("de koers-controle schrijft niet in het veld zelf", !/saveFocus/.test(koersCheck),
  "Deze route mag alleen commentaar teruggeven, nooit de koers overschrijven.");

// Deze route wordt bij élke keer openen van de takenpagina aangeroepen, tien keer
// per dag, voor elke klant. Start hij een motor, dan kost het openen van een
// scherm geld en tijd.
const voorraad = lees("app/api/admin/werkvoorraad/route.ts");
const starters = ["startPrioRun", "runPrioriteitenScan", "refreshMetaPages", "startCannibal", "startInternalLinks", "generateMetaProposal"];
const gestart = starters.filter((s) => voorraad.includes(s));
check("de werkvoorraad-route start geen enkele motor", gestart.length === 0,
  `Deze route mag alleen opgeslagen uitkomsten lezen. Gevonden: ${gestart.join(", ")}.`);

// "Nog niet gedraaid" en "0" betekenen iets heel anders. Een 0 die eigenlijk
// "onbekend" is, is precies het cijfer waarop je iets ten onrechte laat liggen.
check("een motor die nooit draaide geeft geen 0 terug", /aantal: number \| null/.test(voorraad) && /=== null \? null/.test(voorraad),
  "Een niet-gedraaide motor hoort null te geven, zodat de chip 'nog niet gedraaid' kan tonen.");

// ── Het oppak-lijstje moet zijn eigen ouderdom laten zien ──
// Dit veld is een notitieblok en verandert dus alleen als er iemand in typt. Bij
// Kamsteeg stond er daardoor op 17 augustus 2026 nog het oude lijstje terwijl de
// strategie een dag eerder in een gesprek volledig herzien was. Niets op het
// scherm liet dat zien, en die verouderde tekst ging óók nog eens bij élke
// chatvraag mee als "wat Maarten zelf bovenaan heeft gezet". Een lijstje zonder
// datum is precies het lijstje waarvan je niet doorhebt dat het achterloopt.
check("het oppak-lijstje toont wanneer het is bijgewerkt", /bijgewerkt \$\{korteDatum/.test(koers),
  "Zonder datum is een verouderd lijstje niet van een vers lijstje te onderscheiden.");

check("het oppak-lijstje meldt wat er daarna nog is besloten", /\/api\/admin\/oppak-stand/.test(koers),
  "Zonder dit seintje kan een herziene strategie ongemerkt naast het lijstje blijven liggen.");

const stand = lees("app/api/admin/oppak-stand/route.ts");
check("de stand-route start geen enkele motor en geen model", !/callClaude|getPrioriteitenScan|getMetaKansen/.test(stand),
  "Deze route draait bij élke keer openen van de takenpagina en mag dus niets kosten.");

// Zelfde harde grens als bij de koers-controle: het voorstel is een voorstel.
// Een lijstje dat zichzelf mag overschrijven is na twee rondes niet meer van
// Maarten, en dan is het het automatisch samengeraapte lijstje dat hier juist
// niet gewenst is.
const voorstelRoute = lees("app/api/admin/oppak-voorstel/route.ts");
check("het voorstel wordt nooit zelf opgeslagen", !/saveFocus/.test(voorstelRoute),
  "Deze route mag alleen een voorstel teruggeven; overnemen gebeurt op Maartens klik.");

check("het voorstel leest de gesprekken die nieuwer zijn dan het lijstje", /getOppakStand/.test(voorstelRoute) && /getChatHistory/.test(voorstelRoute),
  "Zonder de nieuwere gesprekken stelt hij het oude lijstje opnieuw voor.");

console.log(fouten === 0
  ? "\nDe takenpagina vertelt nog steeds waar we naartoe werken."
  : `\n${fouten} punt(en) mis.`);
process.exit(fouten === 0 ? 0 : 1);
