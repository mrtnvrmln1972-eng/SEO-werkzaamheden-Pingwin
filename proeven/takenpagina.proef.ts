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

// Andersom sinds 19-08-2026: het strategie-blok mag hier juist NIET meer staan.
// Het was een tweede plek waar de uitkomst van een gesprek belandde, zonder dat
// Maarten er iets voor deed; de grote lijn houdt hij bij in De koers, en wat uit
// een gesprek volgt wordt meteen een taak via "Wat volgt hieruit?".
check("er staat geen los strategie-blok meer op de takenpagina", !/<StrategyPanel/.test(taken),
  "Eén weg van gesprek naar taak. Een tweede blok met eigen actiepunten komt niet terug.");

const koers = lees("app/admin/client/[slug]/KoersBlok.tsx");

check("de koers is een eigen veld", /soort="koers"/.test(koers),
  "Zonder soort=koers schrijft het blok in het verkeerde veld.");

check("de tellingen komen uit de werkvoorraad-route", /\/api\/admin\/werkvoorraad/.test(koers),
  "De chips horen te tellen wat er ligt, niet zelf iets te berekenen.");

// De koers is Maartens eigen tekst, en er hoort geen enkele motor aan te zitten.
// Er zat een knop "Klopt dit nog?" bij die de koers naast de opgeslagen feiten
// legde en commentaar ernaast zette. Bij Kamsteeg leverde één klik vijf
// opmerkingen op die nergens over gingen; een controle die je moet wegdenken
// kost aandacht en geeft niets terug (18-08-2026). Knop én route zijn weg.
check("er zit geen controleknop of model aan de koers", !/fetch\([^)]*koers-check|callClaude\(/.test(koers),
  "De koers is handwerk. Een model dat er commentaar bij zet, is er eerder uit gehaald\n"
  + "       omdat het onzin opleverde; zet het niet terug zonder dat opnieuw te wegen.");

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

// ── Wat er NIET terug mag komen ──────────────────────────────────────────────
// Hier stonden zeven controles op "Wat we nu oppakken": dat het zijn datum
// toonde, dat het meldde wat er daarna nog besloten was, dat de verwerkt-stempel
// niet meeschoof met het automatisch opslaan, dat het voorstel nooit zichzelf
// opsloeg. Stuk voor stuk terechte reparaties op een strook die er op
// 18 augustus 2026 helemaal uit is.
//
// Waarom hij eruit is: het was handwerk MET een generator, MET een
// verouderings-seintje, MET een streep-in-de-tijd. Vier mechanismen voor één
// veld, en de uitkomst was dat er bij Kamsteeg een strategie stond die op
// 5 augustus klopte en op 16 augustus herzien was, met vier rode uitroeptekens
// erboven waarvan er één naar precies dat ingehaalde gesprek wees. De
// bovenliggende regel is de gewone: één plek per ding. De koers is de grote
// lijn, de knoppen eronder zijn waar het werk vandaan komt, en de planning is
// wat we doen. Daar zat niets tussen.
//
// Deze proef bewaakt nu dat het niet terugsluipt.
const wegGehaald = [
  ["het lijstje zelf", /soort="prio"/],
  ["de generator", /oppak-voorstel/],
  ["het verouderings-seintje", /oppak-stand/],
  ["de streep in de tijd", /oppak-verwerkt|markeerOppakVerwerkt/],
];
for (const [wat, patroon] of wegGehaald as [string, RegExp][]) {
  check(`${wat} is niet teruggekomen op de takenpagina`, !patroon.test(koers),
    "Dit hoorde bij 'Wat we nu oppakken'. Die strook is er bewust uit; zie de uitleg\n"
    + "       bovenaan KoersBlok.tsx voordat je hem terugzet.");
}

// De assistent las dat veld bij élke vraag mee als "wat Maarten nu oppakt".
// Omdat het alleen veranderde als er iemand in typte, gaf het stelselmatig een
// verouderd beeld door: het gesprek dat de strategie herzag zat te praten tegen
// de oude versie in zijn eigen geheugen. De koers doet hetzelfde werk en wordt
// wél bijgehouden.
const chatLib = lees("lib/chat.ts");
check("de chat leest de koers mee", /koersHtml/.test(chatLib),
  "Zonder de koers mist het gesprek het enige stuk richting dat Maarten zelf schrijft.");
check("de chat leest het oude oppak-lijstje niet meer mee", !/prioHtml/.test(chatLib),
  "Dat veld wordt niet meer bijgehouden; meesturen betekent de assistent een verouderd beeld geven.");

// ── Twee uitklappers, allebei dicht ──
// De koers stond even open. Dat maakte de takenpagina juist weer lang, want de
// koers is een heel strategiestuk. Allebei dicht, en wat je openzet blijft per
// klant onthouden.
check("de koers en de bronnen zitten allebei achter een uitklapper", /klap\("koers"\)|kop\("koers"/.test(koers),
  "Zonder uitklapper duwt een lange koers de planning en de chats van het scherm af.");
check("wat je openzet wordt onthouden per klant", /pingwin-koers-open:\$\{slug\}/.test(koers),
  "Anders klap je hem elke keer opnieuw open.");

// ── De chats laten zien wanneer ze voor het laatst liepen ──
// Zonder datum is een gesprek van drie weken terug niet te onderscheiden van dat
// van gisteren, en dat is precies het verschil dat bepaalt welke versie van een
// strategie nog geldt.
const chatScherm = lees("app/admin/client/[slug]/OverviewChat.tsx");
check("elk gespreksonderwerp toont zijn datum", /gesprek-datum/.test(chatScherm),
  "Zonder datum weet je niet welk gesprek het laatste woord had.");
check("elk gespreksonderwerp is te verwijderen, ook het eerste", !/thread === BASE \? "Leegmaken/.test(chatScherm),
  "Het eerste gesprek werd bij elke keer laden opnieuw aangemaakt, dus het kruisje\n"
  + "       maakte hem alleen leeg en hij bleef staan.");

console.log(fouten === 0
  ? "\nDe takenpagina vertelt nog steeds waar we naartoe werken."
  : `\n${fouten} punt(en) mis.`);
process.exit(fouten === 0 ? 0 : 1);
