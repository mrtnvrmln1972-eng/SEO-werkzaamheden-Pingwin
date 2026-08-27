import { readFileSync } from "fs";
import { join } from "path";
import {
  CORRECTIE_HEADER, VOORRANG_ZIN, regelsNaarBlok, voegCorrectiesVoor, bronLabel, datumKort,
  type CorrectieRegel,
} from "../lib/klant-correcties";
import { mergeProfileSection } from "../lib/client-profile-gen";

// ═══════════════════════════════════════════════════════════
// WAT DE KLANT ZELF ZEGT: de poort
// ═══════════════════════════════════════════════════════════
// Op 27-08-2026 verdween de nuancering die Paul Hoevenaars had aangeleverd
// (vestigingsplaats Vorstenbosch, geen HOOG-partner meer, niet het woord
// "exclusief") in één misklik op "Tone-of-voice analyse". Twee oorzaken, allebei
// hier nagerekend:
//
//  1. De samenvoeging verving alles vanaf de tone-of-voice-kop tot het EIND van
//     het profielveld, en de eigen know-how stond daar nu eenmaal onder. Die
//     werd dus meegenomen in de vervanging.
//  2. Bijna elke motor kapt het profiel af (1.200 tot 3.500 tekens). Wat
//     achteraan staat is het eerste dat wegvalt, en dat was precies de door de
//     klant aangeleverde kennis.
//
// Deze proef laat de bouw mislukken zodra een van die twee terugkomt.
// ═══════════════════════════════════════════════════════════

const fouten: string[] = [];
const wortel = join(__dirname, "..");
const lees = (p: string) => readFileSync(join(wortel, p), "utf8");

function check(voorwaarde: boolean, melding: string) {
  if (!voorwaarde) fouten.push(melding);
}

// ── 1. Het blok zelf ────────────────────────────────────────────────────────
const regels: CorrectieRegel[] = [
  { id: 1, correctieId: 1, categorie: "feit", regel: "Het bedrijf is gevestigd in Vorstenbosch, niet in Uden.", bron: "mail Paul", datum: "2026-08-20", vervallenDoor: null },
  { id: 2, correctieId: 1, categorie: "woorden", regel: "Gebruik het woord exclusief niet.", bron: "mail Paul", datum: "2026-08-20", vervallenDoor: null },
  { id: 3, correctieId: 1, categorie: "aanbod", regel: "Richt je niet op groot groen of grote zakelijke onderhoudscontracten.", bron: "mail Paul", datum: "2026-08-20", vervallenDoor: null },
  { id: 4, correctieId: 0, categorie: "feit", regel: "Vermeld HOOG Official Partner.", bron: "mail Paul", datum: "2026-06-08", vervallenDoor: 1 },
];

const blok = regelsNaarBlok(regels);
check(blok.startsWith(CORRECTIE_HEADER), "Het correctieblok begint niet met de vaste kop; dan herkent geen enkele prompt hem terug.");
check(blok.includes(VOORRANG_ZIN), "De voorrangszin staat niet in het blok. Zonder die zin weet de AI niet dat deze regels vóór de site-analyse gaan.");
check(blok.includes("Vorstenbosch") && blok.includes("exclusief") && blok.includes("groot groen"), "Niet elke geldende regel komt in het blok terecht.");
check(!blok.includes("HOOG Official Partner"), "Een VERVALLEN regel staat nog in het blok. Achterhaalde afspraken mogen de AI nooit meer bereiken.");
check(blok.includes("(mail Paul, 20-08-2026)"), "De bron en datum staan niet achter de regel; dan is niet te zien wanneer iets is afgesproken.");
for (const kop of ["Feiten", "Wat we wel en niet doen", "Woorden en toon"]) {
  check(blok.includes(`**${kop}**`), `Het bakje "${kop}" ontbreekt in het blok.`);
}
check(regelsNaarBlok([]) === "", "Zonder regels hoort het blok leeg te zijn, zodat er niets verandert aan wat de motoren al deden.");
check(bronLabel("mail Paul", "2026-08-20") === "mail Paul, 20-08-2026", "De bronvermelding klopt niet.");
check(datumKort("2026-08-20") === "20-08-2026", "De datumnotatie klopt niet.");

// ── 2. Het blok staat VOORAAN, altijd ───────────────────────────────────────
const profiel = "## Klantprofiel (automatisch gegenereerd)\n\nGevestigd in Uden.";
const samen = voegCorrectiesVoor(blok, profiel) || "";
check(samen.indexOf(CORRECTIE_HEADER) === 0, "Het correctieblok staat niet vooraan. Dan valt het weg zodra een motor het profiel afkapt, en dat is precies wat er misging.");
check(samen.indexOf("Vorstenbosch") < samen.indexOf("Gevestigd in Uden"), "De correctie staat niet vóór het automatische profiel dat hem tegenspreekt.");
check(voegCorrectiesVoor("", profiel) === profiel, "Zonder correcties mag het profiel niet veranderen.");

// Een motor die op 1.200 tekens afkapt (het krapste geval, nav-plan.ts) moet de
// correcties nog steeds compleet meekrijgen.
const lang = samen + "\n" + "x".repeat(5000);
check(lang.slice(0, 1200).includes(VOORRANG_ZIN), "Bij de krapste afkapping (1.200 tekens) valt de voorrangszin al weg.");

// ── 3. De analyseknoppen mogen niets buiten hun eigen blok raken ────────────
// Dit is de regressietest van 27-08-2026, letterlijk het geval dat misging.
const metKnowhow = [
  "## Klantprofiel (automatisch gegenereerd)",
  "Oud profiel.",
  "",
  "## Tone of voice (automatisch gegenereerd)",
  "Oude tone of voice.",
  "",
  "Eigen know-how: Paul wil geen abonnementsvorm noemen.",
].join("\n");
const na = mergeProfileSection(metKnowhow, "## Tone of voice (automatisch gegenereerd)\nNieuwe tone of voice.");
check(na.includes("Eigen know-how"), "De tone-of-voice-knop gooit de eigen know-how eronder weg. Dit is exact de fout van 27-08-2026; herstel mergeProfileSection.");
check(na.includes("Nieuwe tone of voice") && !na.includes("Oude tone of voice"), "De tone-of-voice-sectie wordt niet vervangen.");
check(na.includes("Oud profiel."), "De klantprofiel-sectie sneuvelt bij een tone-of-voice-ronde.");

// ── 4. Opslaan gaat altijd over de RUWE profieltekst ────────────────────────
// getClientBySlug plakt de correcties vóór `seoProfile`. Slaat een scherm dat
// veld terug op, dan komt het blok in de opgeslagen tekst en staat het bij de
// volgende ronde dubbel. Elke schrijver hoort `seoProfileRuw` te gebruiken.
const schrijvers: [string, string][] = [
  ["app/api/admin/client-profile/generate/route.ts", "mergeProfileSection"],
  ["app/api/admin/client-profile/route.ts", "profile:"],
  ["lib/overview-actions.ts", "mergeProfielSectie"],
  ["lib/onboarding-run.ts", "mergeProfileSection"],
  ["lib/samenvoegen.ts", "seo_profile"],
];
for (const [bestand, waar] of schrijvers) {
  const tekst = lees(bestand);
  for (const regel of tekst.split("\n")) {
    if (!regel.includes(waar)) continue;
    check(!/\.seoProfile\b/.test(regel),
      `${bestand} slaat het profiel op met .seoProfile in plaats van .seoProfileRuw; dan komt het correctieblok in de opgeslagen tekst terecht en gaat het dubbel staan.`);
  }
}

// Het scherm dat het profiel laat bewerken hoort ook de ruwe tekst te tonen.
const cockpit = lees("app/admin/client/[slug]/ClientCockpit.tsx");
for (const regel of cockpit.split("\n")) {
  if (!regel.includes("initialProfile=")) continue;
  check(regel.includes("seoProfileRuw"),
    "ClientCockpit geeft het bewerkbare profiel niet als seoProfileRuw mee; dan bewerkt Maarten het correctieblok mee en slaat hij het dubbel op.");
}

// ── 5. De koppeling zelf mag niet stilletjes verdwijnen ─────────────────────
const clients = lees("lib/clients.ts");
check(clients.includes("voegCorrectiesVoor(await correctieBlok(slug)"),
  "getClientBySlug plakt de correcties niet meer vóór het profiel. Zonder die ene regel leest geen enkele motor ze nog.");
check(clients.includes("seoProfileRuw"), "Het veld seoProfileRuw ontbreekt in lib/clients.ts.");

// De vier analyse-prompts moeten de voorrang zelf ook uitspreken, anders
// schrijft de volgende analyse de rechtgezette feiten gewoon weer terug.
const gen = lees("lib/client-profile-gen.ts");
const aantal = gen.split("Wat de klant zelf zegt (LEIDEND)").length - 1;
check(aantal >= 4, `Niet alle vier de analyse-prompts noemen het correctieblok (nu ${aantal} van de 4). Dan schrijft een nieuwe analyse rechtgezette feiten terug.`);
check(gen.includes("ctx.correcties"), "De analyse krijgt het correctieblok niet mee als context.");

// ── 6. De nieuwste datum wint, niet de invoervolgorde ──────────────────────
// Op 27-08-2026 werd de mail van 8 juni als laatste verwerkt en zette daarmee
// afspraken van 15 juli en 20 augustus opzij. Paul noemde in juni "Exclusieve
// tuin" nog een goed zoekwoord en wilde datzelfde woord in augustus niet meer.
// Wat hij het laatst zei hoort te gelden, ongeacht wanneer je die mail invoert.
{
  const bron = lees("lib/klant-correcties.ts");
  check(/function datumBeslist/.test(bron),
    "lib/klant-correcties.ts: datumBeslist is weg. Dan wint weer de volgorde waarin je mails verwerkt in plaats van de datum, en zet een oude mail een nieuwe afspraak opzij.");
  check(/return datumBeslist\(/.test(bron),
    "lib/klant-correcties.ts: alleRegels laat de datum niet meer beslissen. Zowel het scherm als het blok dat de AI leest hangen daaraan.");
  // De volgorde in de database mag niet uitmaken: een oudere regel die een
  // nieuwere "vervangt" hoort zélf te vervallen.
  const oud: CorrectieRegel = { id: 1, correctieId: 1, categorie: "woorden", regel: "Exclusief mag.", bron: "mail", datum: "2026-06-08", vervallenDoor: null };
  const nieuw: CorrectieRegel = { id: 2, correctieId: 2, categorie: "woorden", regel: "Exclusief niet.", bron: "mail", datum: "2026-08-20", vervallenDoor: null };
  // Zo staat het in de database als de JUNI-mail als laatste verwerkt is:
  // de augustusregel is "vervangen door" de juniregel.
  const blokNa = regelsNaarBlok([{ ...nieuw, vervallenDoor: 1 }, oud]);
  check(!blokNa.includes("Exclusief niet."),
    "regelsNaarBlok werkt op de ruwe stand; de datumkeuze hoort in alleRegels te vallen, en die is hier niet nagerekend.");
}

if (fouten.length) {
  console.error("Wat de klant zelf zegt: er ging iets mis.\n");
  for (const f of fouten) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("Wat de klant zelf zegt: blok, voorrang, geschiedenis en opslag kloppen.");
