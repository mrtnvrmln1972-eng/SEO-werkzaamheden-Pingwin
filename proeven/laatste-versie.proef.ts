import fs from "node:fs";
import path from "node:path";
import { markeerOudeVersies, soortUitKind, zichtbaar, RANG, type VersieKandidaat } from "../lib/laatste-versie";

// ═══════════════════════════════════════════════════════════
// JE STUURT DE LAATSTE VERSIE MEE, NIET NEGEN DOCUMENTEN
// ═══════════════════════════════════════════════════════════
// Wat er misging (20-08-2026, Paul Hoevenaars, /hovenier-oss/): Maarten opende
// "Mail vanuit deze kaart" om de copy naar de bouwer te sturen en kreeg negen
// aanvinkvakjes. Twee heetten "Copy", twee "Blauwdruk", en een analyse van
// 2 augustus stond naast een analyse van vandaag. Zijn woorden: "sowieso wil ik
// eigenlijk default dat alleen de laatste versie getoond wordt".
//
// Elk van die negen documenten is echt: elke ronde levert een nieuw bestand op
// en er wordt bewust nooit iets weggegooid. De fout zat in de lijst, niet in het
// archief. Van elke soort geldt er één versie; de rest staat dichtgeklapt.
//
// Deze proef houdt twee dingen vast: de regel zelf (welke versie wint), en dat
// de twee schermen die regel ook echt gebruiken.

const WORTEL = path.resolve(__dirname, "..");
let fouten = 0;
function check(wat: string, goed: boolean, waarom: string) {
  console.log(`${goed ? "ok " : "FOUT"}  ${wat}`);
  if (!goed) { console.log(`      ${waarom}`); fouten++; }
}
const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");

const k = (url: string, soort: string, rang: number, datum = ""): VersieKandidaat =>
  ({ label: url, url, soort: soort as VersieKandidaat["soort"], rang, datum });
const oud = (uit: ReturnType<typeof markeerOudeVersies>, url: string) => !!uit.find((d) => d.url === url)?.ouder;

// ── 1. Welke versie wint ────────────────────────────────────────────────────

const twee = markeerOudeVersies([
  k("copy-nieuw", "copy", RANG.keten, "2026-08-20T08:00:00Z"),
  k("copy-juli", "copy", RANG.archief, "2026-07-02T09:00:00Z"),
]);
check("van twee copy-documenten blijft alleen de nieuwste staan",
  !oud(twee, "copy-nieuw") && oud(twee, "copy-juli"),
  "Dit is de melding zelf: twee regels die allebei 'Copy' heten, en niet te zien welke telt.");

const goedgekeurd = markeerOudeVersies([
  k("onze-copy", "copy", RANG.keten, "2026-08-20T08:00:00Z"),
  k("klant-copy", "copy", RANG.goedgekeurd, "2026-08-14T08:00:00Z"),
]);
check("de versie die jij hebt aangemerkt wint van een later gemaakt document",
  !oud(goedgekeurd, "klant-copy") && oud(goedgekeurd, "onze-copy"),
  "Heeft de klant de tekst geredigeerd, dan moet díe de site op, ook al is onze copy jonger.");

const zonderDatum = markeerOudeVersies([
  k("keten", "blauwdruk", RANG.keten),
  k("archief", "blauwdruk", RANG.archief, "2026-08-19T08:00:00Z"),
]);
check("het document uit de keten wint van het archief, ook zonder datum",
  !oud(zonderDatum, "keten") && oud(zonderDatum, "archief"),
  "De keten is waar alle motoren mee rekenen; dat is per definitie de geldende tekst.");

const soorten = markeerOudeVersies([
  k("copy", "copy", RANG.keten, "2026-08-01T00:00:00Z"),
  k("blauwdruk", "blauwdruk", RANG.keten, "2026-07-01T00:00:00Z"),
  k("analyse", "analyse", RANG.keten, "2026-06-01T00:00:00Z"),
]);
check("elke soort houdt zijn eigen laatste versie",
  soorten.every((d) => !d.ouder),
  "Analyse, blauwdruk en copy zijn drie lijstjes, geen één; anders blijft er alleen copy over.");

const losse = markeerOudeVersies([
  k("https://site.nl/pagina/", "", RANG.archief),
  k("stappenplan", "", RANG.archief),
  k("bespreekpunten", "", RANG.archief),
]);
check("de pagina en losse stukken raken nooit weg",
  losse.every((d) => !d.ouder),
  "Van een stappenplan of een pagina bestaat geen nieuwere versie; die horen altijd in beeld.");

const volgorde = markeerOudeVersies([k("a", "copy", RANG.keten), k("b", "", RANG.archief), k("c", "copy", RANG.archief)]);
check("de volgorde van de lijst blijft zoals hij binnenkwam",
  volgorde.map((d) => d.url).join(",") === "a,b,c",
  "De volgorde is elders bepaald (pagina vooraan, dan de keten); deze regel zet alleen een vlaggetje.");

check("alleen echte versie-soorten tellen mee",
  soortUitKind("Copy") === "copy" && soortUitKind("blauwdruk") === "blauwdruk" && soortUitKind("overig") === "" && soortUitKind("") === "",
  "Een 'overig' document is geen versie van iets; die mag nooit weggeklapt worden.");

// ── 2. Wat er standaard in beeld staat ──────────────────────────────────────

const lijst = [{ url: "nieuw", ouder: false }, { url: "oud1", ouder: true }, { url: "oud2", ouder: true }];
check("standaard zie je alleen de geldende versies",
  zichtbaar(lijst, () => false, false).map((d) => d.url).join(",") === "nieuw",
  "Dat is de hele vraag: negen vakjes werden er vier.");

check("een oudere versie die je zelf aanvinkt blijft staan",
  zichtbaar(lijst, (d) => d.url === "oud2", false).map((d) => d.url).join(",") === "nieuw,oud2",
  "Anders verdwijnt een bewuste keuze uit beeld terwijl hij wél meegaat in de mail.");

check("openklappen laat alles zien",
  zichtbaar(lijst, () => false, true).length === 3,
  "Het archief verdwijnt niet, het staat één klik verderop.");

// ── 3. De schermen gebruiken die ene regel ──────────────────────────────────

const dev = lees("lib/developer.ts");
check("de documentenlijst deelt de documenten in via die ene regel",
  /markeerOudeVersies\(kandidaten\)/.test(dev),
  "Zonder dit weet geen enkel scherm welke versie geldt en staan ze weer allemaal naast elkaar.");

check("de geldende versies vallen nooit buiten het maximum",
  /const geldend = alles\.filter\(\(d\) => !d\.ouder\)/.test(dev) && /archief = alles\.filter\(\(d\) => d\.ouder\)\.slice/.test(dev),
  "Kapte je de hele lijst af, dan kon juist de copy eraf vallen; dat is het document dat je wilde sturen.");

check("de developerlijst toont alleen de geldende versies",
  /\.then\(\(d\) => d\.filter\(\(x\) => !x\.ouder\)\)/.test(dev),
  "De sitebouwer heeft aan een blauwdruk van vorige maand niets.");

const route = lees("app/api/admin/weekplan/dev/route.ts");
check("de copy die standaard aanstaat is de geldende, niet de eerste met die naam",
  /d\.soort === "copy" && !d\.ouder/.test(route),
  "Op het label matchen pakte de eerste regel die 'Copy: …' heette, en dat kon een oudere ronde zijn.");

for (const [naam, bestand] of [
  ["het mailvenster", "app/admin/client/[slug]/MailUitKaart.tsx"],
  ["het doorzet-venster", "app/admin/client/[slug]/DevDoorzetten.tsx"],
] as const) {
  const src = lees(bestand);
  check(`${naam} klapt oudere versies weg`, /zichtbaar\(/.test(src),
    "Dit scherm toont de documenten weer allemaal naast elkaar.");
  check(`${naam} heeft een knop om ze alsnog te zien`, /Oudere versies \(\$\{aantalOud\}\)/.test(src),
    "Wegklappen zonder uitweg is erger dan een lange lijst: dan kun je een oude versie niet meer meesturen.");
}

console.log(fouten === 0 ? "\nStandaard gaat de laatste versie mee, en het archief is één klik verderop." : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);
