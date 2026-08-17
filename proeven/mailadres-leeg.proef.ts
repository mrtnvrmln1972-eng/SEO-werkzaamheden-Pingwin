// ═══════════════════════════════════════════════════════════
// GEEN VOORGEVULD E-MAILADRES, NERGENS
// ═══════════════════════════════════════════════════════════
// Op 17 augustus 2026 stond in het mailvenster van klant Kamsteeg Tuinen het
// adres info@paulhoevenaars.nl al ingevuld. Die twee zijn elkaars concurrent en
// allebei klant bij Pingwin. Eén klik op Versturen en ze wisten van elkaar dat
// ze dezelfde SEO-partner hebben.
//
// De oorzaak was één gedeeld browsergeheugen: de localStorage-sleutel
// "pingwin-dev-email" bewaarde "het laatst gebruikte developer-adres", niet per
// klant maar voor alle klanten tegelijk. Vijf schermen schreven en lazen die
// sleutel. Wie na een mail over klant A een mailvenster van klant B opende,
// begon dus met het adres van A.
//
// De regel die daaruit volgt is bewust absoluut, zonder uitzondering voor
// "veilige" bronnen zoals het klantadres uit de database:
//
//   ELK adresveld begint leeg. Het dashboard vult NOOIT een ontvanger in.
//   Aanvullen mag alleen terwijl Maarten typt, uit zijn eigen Microsoft
//   365-contacten (AdresVeld → /api/admin/mail/people).
//
// Waarom zonder uitzonderingen: zodra één voorinvulling "veilig" heet, komt de
// volgende er ongemerkt bij, en dan is het weer een kwestie van tijd. Precies
// dezelfde afweging als bij de emoji-lijst in proeven/huisstijl-erfenis.json:
// een regel zonder uitzonderingen is de enige soort die niet langzaam uitholt.
// Er is dan ook met opzet GEEN erfenislijst bij deze proef.
//
// Kost dit een handeling? Ja, twee letters typen. Dat is de prijs, en die is
// vele malen lager dan een klant.
// ═══════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const fouten: string[] = [];

function alleBestanden(map: string, uit: string[] = []): string[] {
  for (const naam of readdirSync(map)) {
    const pad = join(map, naam);
    if (statSync(pad).isDirectory()) { if (naam !== "node_modules") alleBestanden(pad, uit); }
    else if (/\.(tsx|ts)$/.test(naam)) uit.push(pad);
  }
  return uit;
}

const bestanden = [...alleBestanden("app"), ...alleBestanden("lib")];

for (const pad of bestanden) {
  const inhoud = readFileSync(pad, "utf8");
  const regels = inhoud.split("\n");

  regels.forEach((regel, i) => {
    // Commentaar telt niet mee: de uitleg waaróm dit niet mag, moet in de code
    // kunnen blijven staan.
    const kaal = regel.trim();
    if (kaal.startsWith("//") || kaal.startsWith("*") || kaal.startsWith("/*")) return;
    const nr = `${pad}:${i + 1}`;

    // 1. Het gedeelde browsergeheugen mag nergens meer terugkomen, onder geen
    //    enkele naam. Een adres onthouden buiten één klant om is de fout zelf.
    if (/localStorage\.(get|set)Item\(\s*["'`][^"'`]*(mail|email|e-mail|adres)[^"'`]*["'`]/i.test(regel)) {
      fouten.push(`${nr}: slaat een e-mailadres op in het browsergeheugen (of leest het terug). Dat geheugen is niet per klant en zette bij Kamsteeg het adres van een concurrent klaar. Laat het veld leeg; AdresVeld vult aan uit de eigen contacten.`);
    }

    // 2. Een adresveld dat met een waarde begint. Leeg (""), een prop die de
    //    aanroeper leeg doorgeeft, of state is prima; een letterlijk adres of
    //    een terugval met || niet.
    const aanTo = regel.match(/aanTo=\{?["'`]([^"'`]+)["'`]/);
    if (aanTo) {
      fouten.push(`${nr}: vult een mailvenster voor met "${aanTo[1]}". Elk adresveld begint leeg (aanTo="").`);
    }
    if (/aanTo=\{[^}]*\|\|/.test(regel)) {
      fouten.push(`${nr}: vult een mailvenster voor met een adres uit een andere bron (terugval met ||). Elk adresveld begint leeg (aanTo="").`);
    }

    // 3. Een letterlijk e-mailadres als beginwaarde van een adres-state.
    if (/\b(setTo|setMailAan|setDevTo)\(\s*["'`][^"'`]*@/.test(regel) || /useState\(\s*["'`][^"'`]*@[^"'`]*\.[a-z]{2,}["'`]\s*\)/i.test(regel)) {
      fouten.push(`${nr}: zet een e-mailadres als beginwaarde van een adresveld. Begin leeg en laat Maarten typen.`);
    }
  });
}

// 4. De sleutel uit de casus mag nergens meer in werkende code voorkomen. In
//    commentaar mag hij juist wél blijven staan: daar staat uitgelegd waarom hij
//    weg is, en dat is precies wat een volgende chat moet lezen.
for (const pad of bestanden) {
  readFileSync(pad, "utf8").split("\n").forEach((regel, i) => {
    const kaal = regel.trim();
    if (kaal.startsWith("//") || kaal.startsWith("*") || kaal.startsWith("/*")) return;
    if (/pingwin-dev-email/.test(regel)) {
      fouten.push(`${pad}:${i + 1}: gebruikt de sleutel "pingwin-dev-email" weer. Dat is het gedeelde adresgeheugen dat op 17-08-2026 bijna een mail naar de concurrent van een klant stuurde.`);
    }
  });
}

// 5. MailPopup mag geen "onthoud dit adres"-mogelijkheid terugkrijgen.
const popup = (() => { try { return readFileSync("app/admin/client/[slug]/MailPopup.tsx", "utf8"); } catch { return ""; } })();
if (/onthoudAls\?:/.test(popup)) {
  fouten.push("app/admin/client/[slug]/MailPopup.tsx: de prop onthoudAls is terug. Dat was de mogelijkheid om een adres te onthouden na versturen, en precies zo kwam een adres bij de verkeerde klant in beeld.");
}

// 6. Elk mailvenster houdt AdresVeld, want zonder aanvullen uit de eigen
//    contacten wordt voorinvullen vroeg of laat weer verleidelijk.
const MET_ADRESVELD = [
  "app/admin/client/[slug]/MailUitKaart.tsx",
  "app/admin/client/[slug]/MailVenster.tsx",
  "app/admin/client/[slug]/MailPopup.tsx",
  "app/admin/client/[slug]/BespreekLijsten.tsx",
];
for (const pad of MET_ADRESVELD) {
  let inhoud = "";
  try { inhoud = readFileSync(pad, "utf8"); } catch { fouten.push(`Bestand ontbreekt: ${pad}`); continue; }
  if (!/AdresVeld/.test(inhoud)) {
    fouten.push(`${pad}: het adresveld met voorstellen uit de eigen contacten (AdresVeld) is eruit. Zonder die hulp is een leeg veld lastig werken, en dat is precies waarom hier ooit voorinvulling kwam.`);
  }
}

if (fouten.length) {
  console.error("Mailadres-proef gezakt (geen voorgevulde ontvangers):\n" + fouten.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
console.log(`Mailadres-proef geslaagd: ${bestanden.length} bestanden nagekeken, geen voorgevuld of onthouden e-mailadres gevonden.`);
