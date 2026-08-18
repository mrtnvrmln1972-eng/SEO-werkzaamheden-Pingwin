// ═══════════════════════════════════════════════════════════
// VAN MAIL NAAR TAAK, EN VERDER TERUG KIJKEN IN DE MAILBOX
// ═══════════════════════════════════════════════════════════
// Twee dingen bij "Laatste mails" die stilletjes kunnen sneuvelen zonder dat een
// bouw rood wordt:
//
//  1. Het knopje "Taak" naast Superhuman. Dat is een ketting van vier schakels
//     (knop → route → kaart → aantekening), en als er één schakel wegvalt, staat
//     er gewoon een knop die niets doet. Vooral de aantekening is kwetsbaar: de
//     verleiding om er "even een eigen veldje" bij te zetten is groot, en dan
//     staat dezelfde soort tekst op twee plekken. Dat mag hier niet: de korte
//     beschrijving hoort in het BESTAANDE veld Aantekeningen van de kaart.
//  2. De knop "Meer" onderaan de lijst. Die vraagt een hoger aantal op bij de
//     mailroute; zet iemand daar weer een vast getal neer, dan blijft de lijst
//     op vijftien staan terwijl de knop wél blijft bestaan.

import fs from "node:fs";
import path from "node:path";

const WORTEL = path.resolve(__dirname, "..");
const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");

let fouten = 0;
function check(naam: string, goed: boolean, waarom: string) {
  if (!goed) fouten++;
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) console.log(`       ${waarom}`);
}

const cockpit = lees("app/admin/client/[slug]/ClientCockpit.tsx");
const route = lees("app/api/admin/mail-taak/route.ts");
const mailroute = lees("app/api/admin/mail/route.ts");

console.log("\n── Van mail naar taak ──");
check("er staat een knop Taak in de mailregel",
  /className="btn btn-ghost btn-klein email-taak"/.test(cockpit),
  "Het knopje naast Superhuman is weg, of gebruikt het knopsysteem niet meer.");
check("de knop roept de route aan",
  /fetch\("\/api\/admin\/mail-taak"/.test(cockpit),
  "De knop moet /api/admin/mail-taak aanroepen; anders doet hij niets.");
check("de mail gaat mee, met de link erbij",
  /onderwerp:/.test(cockpit) && /superhumanLink \|\| e\.webLink/.test(cockpit),
  "Zonder onderwerp en link kan de route geen taak maken die naar de mail terugwijst.");
check("de planning ververst na het aanmaken",
  /maakTaakVanMail[\s\S]{0,900}setWeekplanReload/.test(cockpit),
  "De taak komt er wel, maar je ziet hem pas na verversen; dan lijkt de knop niets gedaan te hebben.");

console.log("\n── Wat de route doet ──");
check("de route maakt een echte kaart in de planning",
  /addWeekplanTasks\(/.test(route),
  "De route moet de taak in de weekplanning zetten.");
check("de mail hangt als bronmail aan de kaart",
  /bronMail:/.test(route),
  "Zonder bronmail heeft de kaart geen knop terug naar de mail.");
check("de korte beschrijving gaat naar het BESTAANDE veld Aantekeningen",
  /setWeekplanNotitie\(/.test(route),
  "De beschrijving hoort in het bestaande aantekeningenveld, niet in een nieuw veld ernaast.");
check("er komt geen nieuw veld op de kaart bij",
  !/ALTER TABLE client_weekplan/.test(route),
  "Deze route mag geen eigen kolom op de taakkaart toevoegen; het aantekeningenveld bestaat al.");
check("de titel wordt kort gehouden",
  /TITEL_MAX/.test(route),
  "Zonder begrenzing wordt de onderwerpregel van een doorgestuurde mail de kaarttitel.");
check("zonder AI-sleutel werkt de knop gewoon door",
  /anthropicConfigured\(\)/.test(route),
  "Een knop die niets doet omdat een sleutel ontbreekt is erger dan een minder mooie titel; er moet een terugval zijn.");
check("de mailtekst gaat door dezelfde opschoner als de rest",
  /eigenTekst\(/.test(route),
  "Anders belanden handtekening en citaatgeschiedenis in de samenvatting.");

console.log("\n── Meer mails ophalen ──");
check("de mailroute accepteert een aantal",
  /searchParams\.get\("aantal"\)/.test(mailroute),
  "Zonder dit blijft de lijst altijd op vijftien staan.");
check("het aantal is begrensd",
  /Math\.min\(100/.test(mailroute),
  "Een onbegrensd aantal laat Graph de hele mailbox uitlezen bij één klik.");
check("de route zegt of er nog meer is",
  /meer:/.test(mailroute),
  "Zonder dat signaal blijft de knop 'Meer' staan als er niets ouders meer is.");
check("er is een knop Meer onderaan de lijst",
  /className="email-meer"/.test(cockpit) && /Meer mails/.test(cockpit),
  "De knop onderaan de mailkolom is weg.");
check("de knop vraagt er telkens twintig bij",
  /mailAantal \+ 20/.test(cockpit),
  "Het ophogen gebeurt niet meer; dan haalt de knop steeds dezelfde lijst op.");

console.log("\n── De mails komen in 'Wat we doen' ──");
const vullen = lees("lib/activiteit-vullen.ts");
check("het logboek leest ook de live mailbox",
  /msSearchClientEmails/.test(vullen),
  "Live mail wordt niet opgeslagen; leest het logboek alleen de database, dan ontbreekt juist de recente correspondentie.");
check("dezelfde zeef als bij Laatste mails",
  /isRuisMail/.test(vullen) && /fromMatchesAllowlist/.test(vullen),
  "Zonder die twee filters lopen nieuwsbrieven en automatische meldingen het logboek van de klant in.");
check("de afzenderzeef staat maar op één plek",
  /export function fromMatchesAllowlist/.test(lees("lib/snapshots.ts")),
  "De zeef hoort gedeeld te worden, niet gekopieerd; twee kopieën lopen uit elkaar.");

console.log(fouten === 0 ? "\nAlles klopt.\n" : `\n${fouten} fout(en).\n`);
process.exit(fouten === 0 ? 0 : 1);
