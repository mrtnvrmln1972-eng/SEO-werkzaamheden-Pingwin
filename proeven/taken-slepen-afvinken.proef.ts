// ═══════════════════════════════════════════════════════════
// SLEPEN ZONDER DATUM, EN DE STAND OP DE REGEL
// ═══════════════════════════════════════════════════════════
// Waarom dit bestand er is: allebei de dingen hieronder zagen er in de code
// helemaal goed uit en werkten in de praktijk niet.
//
//  1. Slepen bij "Nog geen datum". Je zag netjes de streep waar de taak zou
//     komen, en bij loslaten sprong hij terug naar zijn oude plek. De reden: het
//     rekenwerk voor de volgorde ging uit van een WEEK, en een taak zonder datum
//     heeft geen week die ergens op slaat. De som stopte er dus stilzwijgend mee.
//     Alles compileerde, alle proeven waren groen, en niemand kon het zien
//     zonder het echt te proberen.
//  2. De stand van een taak. Waar iets ligt (bij ons, bij de developer, bij de
//     klant, of af) kon je alleen in de opengeklapte kaart zetten, terwijl dat
//     precies is wat je van een takenlijst wilt weten. En een afgeronde taak uit
//     de planning kwam nergens terecht: hij verdween van het scherm en er stond
//     niet meer dát hij gebeurd was, laat staan wannéér.
//
// Deze proef rekent de volgorde echt na (geen tekstvergelijking) en controleert
// daarna dat de schermen en de opslag de draad ook echt vasthouden.

import fs from "node:fs";
import path from "node:path";
import { nieuweVolgordeInLijst, nieuweVolgorde } from "../lib/weekplan-slepen";
import { STANDEN } from "../lib/taak-stand";

const WORTEL = path.resolve(__dirname, "..");
const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");

let fouten = 0;
function check(naam: string, gekregen: unknown, verwacht: unknown) {
  const ok = String(gekregen) === String(verwacht);
  if (!ok) fouten++;
  console.log(`${ok ? "OK  " : "FOUT"} | ${naam}`);
  if (!ok) console.log(`       verwacht: ${JSON.stringify(verwacht)}\n       gekregen: ${JSON.stringify(gekregen)}`);
}
function checkWaar(naam: string, goed: boolean, waarom: string) {
  if (!goed) fouten++;
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) console.log(`       ${waarom}`);
}

// ── 1. De volgorde van een lijst zonder datum ──
type T = { id: number; sortOrder: number };
const lijst: T[] = [
  { id: 1, sortOrder: 10 },
  { id: 2, sortOrder: 20 },
  { id: 3, sortOrder: 30 },
  { id: 4, sortOrder: 40 },
];
const volgorde = (r: T[]) => r.map((t) => t.id).join(",");

console.log("\n── Slepen bij 'Nog geen datum' ──");
check("de laatste naar boven, boven de eerste",
  volgorde(nieuweVolgordeInLijst(lijst, lijst[3], 1)), "4,1,2,3");
// "Boven het doel" is geen smaakkeuze: de oranje streep die je tijdens het
// slepen ziet, wordt bóven de regel getekend waar je boven hangt (.wb-doel-aan
// staat op top). Waar de streep staat, moet de taak landen.
check("de eerste naar beneden, boven de derde",
  volgorde(nieuweVolgordeInLijst(lijst, lijst[0], 3)), "2,1,3,4");
check("naar het eind (loslaten onderaan)",
  volgorde(nieuweVolgordeInLijst(lijst, lijst[0], null)), "2,3,4,1");
check("op zichzelf loslaten verandert niets",
  nieuweVolgordeInLijst(lijst, lijst[1], 2).length, 0);
check("de nummers lopen weer met stappen van tien",
  nieuweVolgordeInLijst(lijst, lijst[3], 1).map((t) => t.sortOrder).join(","), "10,20,30,40");

// Een taak die nog wél een datum had en hier tussen wordt losgelaten: die staat
// nog niet in de lijst en moet er gewoon tussen passen.
const vanBuiten: T = { id: 9, sortOrder: 0 };
check("een taak van buiten de lijst komt op de goede plek",
  volgorde(nieuweVolgordeInLijst(lijst, vanBuiten, 3)), "1,2,9,3,4");
check("een onbekend doel zet hem achteraan in plaats van vooraan",
  volgorde(nieuweVolgordeInLijst(lijst, vanBuiten, 77)), "1,2,3,4,9");

// De weekversie mag hier niet door veranderd zijn: die rekent nog steeds binnen
// één week, en dat is precies waarom er een tweede som moest komen.
console.log("\n── De weekversie blijft doen wat hij deed ──");
const weekTaken = [
  { id: 1, weekYear: 2026, weekNo: 33, sortOrder: 10 },
  { id: 2, weekYear: 2026, weekNo: 33, sortOrder: 20 },
  { id: 3, weekYear: 2026, weekNo: 34, sortOrder: 10 },
];
check("een andere week telt niet mee in de volgorde",
  nieuweVolgorde(weekTaken, 3, 1, 2026, 33).map((t) => t.id).join(","), "3,1,2");

// ── 2. Het scherm gebruikt die som ook echt ──
console.log("\n── De planning houdt de draad vast ──");
const planning = lees("app/admin/client/[slug]/Planning.tsx");
checkWaar("loslaten zonder datum rekent de volgorde na",
  /nieuweVolgordeInLijst/.test(planning) && /bewaarLosseVolgorde/.test(planning),
  "Planning.tsx gebruikt nieuweVolgordeInLijst/bewaarLosseVolgorde niet meer. Dan sleep je wel, maar springt de taak weer terug.");
checkWaar("de staart is ook een sleepdoel voor taken zonder datum",
  /onDragOver=\{\(e\) => \{ if \(!sleep\) return;/.test(planning),
  "De 'Nog geen datum'-zone accepteert alleen nog taken mét datum; dan kun je binnen die lijst niets meer naar onderen slepen.");
checkWaar("de volgorde gaat zonder week naar de server",
  !/bewaarLosseVolgorde\([^)]*week/i.test(planning),
  "Bij een taak zonder datum mag de week niet meegestuurd worden; die betekent daar niets en overschrijft wat er stond.");

console.log("\n── De stand zetten op de regel ──");
// Hier stond een los vinkje om af te vinken. Dat is per 18-08-2026 opgegaan in
// een keuzelijst met vier standen (gepland, bij developer, bij klant, afgerond),
// want "waar ligt dit nu" is de vraag die je van een takenlijst wilt kunnen
// beantwoorden én zetten, en twee knoppen voor "afgerond" in dezelfde regel is
// er een te veel. Wat blijft gelden: het moet op de regel kunnen, en afgerond
// moet in "Wat we doen" belanden.
checkWaar("er staat een keuzelijst met de stand op de regel", /className=\{"wb-stand-kies/.test(planning),
  "Zonder die lijst kun je de stand alleen nog in de opengeklapte kaart zetten.");
checkWaar("de vier standen komen uit één bron", /STANDEN\.map/.test(planning) && /from "\.\.\/\.\.\/\.\.\/\.\.\/lib\/taak-stand"/.test(planning),
  "De standen horen uit lib/taak-stand.ts te komen; schrijf de vertaling nooit opnieuw uit in een scherm.");
checkWaar("kiezen schrijft de stand én de developer-vlag weg", /naarOpslag\(stand\)/.test(planning) && /naarDev: opslag\.naarDev/.test(planning),
  "De developer-vlag woont in een eigen kolom. Zet je die niet mee, dan blijft een taak op de developerlijst staan terwijl hij daar niet meer ligt.");
checkWaar("afgerond werk staat onderaan achter een dichte uitklapper",
  /Afgeronde taken/.test(planning) && /useState\(false\)[\s\S]{0,40}toonAfgerond|const \[toonAfgerond, setToonAfgerond\] = useState\(false\)/.test(planning),
  "Afgeronde taken horen onderaan in een blok dat dicht begint; anders scroll je er elke dag langs.");
checkWaar("een afgeronde taak is terug te zetten", /function zetTerug\(/.test(planning) && /Terugzetten/.test(planning),
  "Een regel die bij één keuze van het scherm verdwijnt zonder weg terug voelt als weggegooid.");

// Het raster van de regel: evenveel kolommen als kinderen. Schuift dat uit
// elkaar, dan puilt de datumknop uit een kolom van 22 pixels en wordt het
// kruisje een brede knop. Dat is hier al een keer gebeurd.
const css = lees("app/globals.css");
const raster = css.match(/\.wb-rij\s*\{[\s\S]*?grid-template-columns:\s*([^;]+);/);
const kolommen = raster ? raster[1].trim().split(/\s+(?![^(]*\))/).length : 0;
check("de regel heeft zeven kolommen (handvat, taak, fases, stand, datum, effect, kruisje)", kolommen, 7);
checkWaar("de keuzelijst heeft opmaak", /\.wb-stand-kies\s*\{/.test(css),
  "Planning.tsx zet de klasse wb-stand-kies, maar er is geen stijlregel. Dan staat er een kale browserlijst in de regel.");
checkWaar("het oude vinkje is echt weg", !/wb-vink/.test(planning) && !/\.wb-vink\s*\{/.test(css),
  "Laat geen tweede knop voor 'afgerond' in dezelfde regel staan; dan bestaan er twee wegen naar dezelfde stand.");

// De kolom is de ruimte die de taaktitel NIET krijgt, dus het langste label
// bepaalt hoeveel titel je kwijt bent. "bij developer" en "dag kiezen" aten
// samen ruim zestig pixels op, precies waar een pad als
// /lensimplantatie/refractive-pro-art-lens/ moet staan (gemeld 20-08-2026).
// Vandaar een grens: schrijf een label langer, dan word je hier rood in plaats
// van dat de browser hem stilletjes afkapt.
const langste = STANDEN.reduce((a, s) => Math.max(a, s.label.length), 0);
checkWaar(`het langste label past in de kolom (${langste} letters)`, langste <= 8,
  "Een label van meer dan acht letters past niet in de kolom naast de titel. Zet de uitleg in `uitleg`, dat verschijnt als je erover gaat staan.");
checkWaar("de datumknop heeft een kort label", /: "datum"/.test(lees("app/admin/client/[slug]/DatumKiezer.tsx")),
  "Dit knopje staat op elke regel zonder datum; \"dag kiezen\" was vijf letters te lang.");

console.log("\n── Afgevinkt werk komt in 'Wat we doen' ──");
const weekplan = lees("lib/weekplan.ts");
checkWaar("afvinken schrijft mee in het logboek",
  /logAfgevinkteTaak/.test(weekplan) && /if \(status === "klaar"\) await logAfgevinkteTaak/.test(weekplan),
  "Zonder deze regel verdwijnt een afgevinkte taak van het scherm zonder dat ergens staat dat hij gebeurd is.");
const vullen = lees("lib/activiteit-vullen.ts");
checkWaar("ook de al afgevinkte taken van vroeger komen erin",
  /bron: "client_weekplan"/.test(vullen),
  "Het terugwerkend vullen slaat de planning over; taken die al op klaar stonden blijven dan onzichtbaar in het logboek.");

console.log(fouten === 0 ? "\nAlles klopt.\n" : `\n${fouten} fout(en).\n`);
process.exit(fouten === 0 ? 0 : 1);
