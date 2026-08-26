// ═══════════════════════════════════════════════════════════
// EEN GEPLAKTE KIJK-SLEUTEL MAG NOOIT MEER VANZELF VERVALLEN
// ═══════════════════════════════════════════════════════════
// Op 15-08-2026 heeft Maarten de kijk-sleutel zesendertig keer opnieuw in zijn
// Claude-omgeving gezet. Niet omdat hij iets fout deed, maar door een lus die
// het dashboard zelf aanjoeg:
//
//   1. Een omgevingsvariabele geldt pas vanaf een NIEUWE chat, dus de lopende
//      chat had nog de oude waarde en kreeg "andere-sleutel".
//   2. De melding zei: maak op /admin een nieuwe sleutel.
//   3. Een nieuwe maken trok de sleutel in die hij net had geplakt.
//   4. Terug naar 1.
//
// De reparatie is dat een sleutel geldig blijft tot hij met de hand ingetrokken
// wordt, en dat élke geldige sleutel de deur opent. Deze proef bewaakt precies
// die twee dingen, plus de melding die de lus aanjoeg, want dit is bij uitstek
// iets dat "netjes opruimen" er ooit weer in fietst.

import { readFileSync } from "node:fs";
import { join } from "node:path";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

const wortel = join(__dirname, "..");
const lees = (...p: string[]) => readFileSync(join(wortel, ...p), "utf8");
const bron = lees("lib", "claude-view-key.ts");

/** De tekst van één functie, van zijn kop tot de volgende export. */
function functie(naam: string): string {
  const start = bron.indexOf(`export async function ${naam}(`);
  if (start < 0) return "";
  const rest = bron.slice(start + 10);
  const eind = rest.indexOf("\nexport ");
  return eind < 0 ? rest : rest.slice(0, eind);
}

// ── 1. Een nieuwe sleutel maken trekt de oude niet in ──
const maken = functie("createViewKey");
proef("createViewKey bestaat nog", maken.length > 0);
proef(
  "een nieuwe sleutel maken trekt de bestaande niet in",
  !/revoked_at\s*=\s*now\(\)\s*WHERE\s*revoked_at\s*IS\s*NULL\s*(RETURNING|$)/i.test(maken.replace(/\s+/g, " ")),
  "Hier stond een UPDATE die álle geldige sleutels introk zodra je er een maakte.\n" +
    "     | Dat is de lus van 15-08-2026: de knop brak precies de sleutel die net geplakt was.\n" +
    "     | Een bovengrens (de oudste eraf boven MAX_ACTIEF) mag wel; alles intrekken niet.",
);
proef(
  "er zit een bovengrens op het aantal geldige sleutels",
  /MAX_ACTIEF/.test(maken) && /export const MAX_ACTIEF\s*=\s*\d+/.test(bron),
  "Zonder bovengrens groeit de lijst geldige sleutels eindeloos.",
);

// ── 1b. De knop keurt zichzelf, en maar op één plek ──
// Op 26-08-2026 stond er een sleutel op het scherm mét de melding dat de ingang
// hem niet accepteerde. Dat kwam doordat het scherm ná het aanmaken zelf nog een
// tweede verzoek deed om het te controleren. Twee plekken die hetzelfde
// nakijken geven vroeg of laat twee antwoorden, en dan weet je niets meer. De
// server keurt nu in hetzelfde verzoek waarin hij de sleutel maakt.
const knop = lees("app", "admin", "KijkSleutel.tsx");
proef(
  "het scherm doet geen eigen tweede controle meer",
  !/\/api\/kijk\?test=1/.test(knop),
  "Het aanmaken controleert de sleutel al op de server. Vraag het antwoord daar op\n" +
    "     | (`getest` in het antwoord van POST /api/admin/kijk-sleutel) in plaats van er\n" +
    "     | een tweede verzoek naast te zetten dat iets anders kan zeggen.",
);
proef(
  "en leest het oordeel uit het antwoord van het aanmaken",
  /getest/.test(knop) && /getest:\s*true/.test(lees("app", "api", "admin", "kijk-sleutel", "route.ts")),
);
proef(
  "createViewKey deelt geen sleutel uit die hij niet zelf heeft gekeurd",
  /testViewKey\(/.test(maken) && /throw new Error/.test(maken),
  "Zonder deze keuring komt er een sleutel uit die pas stukloopt als Maarten hem plakt.",
);

// ── 1c. De opzoeking mag nooit een oud antwoord kunnen teruggeven ──
// Een vraag die élke keer woordelijk gelijk is en geen enkele waarde bevat, kan
// onderweg blijven hangen; dan krijg je de sleutels van een minuut geleden en
// ontbreekt precies de sleutel die net gemaakt is.
proef(
  "de sleutel-opzoeking bevat een waarde die per keer verandert",
  /\$\{nu\}/.test(functie("getActiveKeys")),
  "Zet er een waarde in die elke aanroep anders is (zoals het tijdstip van nu),\n" +
    "     | zodat geen twee vragen gelijk zijn en er nooit een bewaard antwoord terugkomt.",
);

// ── 2. Élke geldige sleutel opent de deur ──
for (const naam of ["checkViewKey", "testViewKey"]) {
  const f = functie(naam);
  proef(`${naam} kijkt naar álle geldige sleutels, niet alleen de nieuwste`, /getActiveKeys\(\)/.test(f),
    "Met alleen de nieuwste sleutel is een geplakte sleutel weer waardeloos zodra er\n" +
      "     | een nieuwe naast komt, en dan is de hele reparatie stilletjes weg.");
}

// ── 3. De melding jaagt de lus niet meer aan ──
const ingang = lees("app", "api", "kijk", "route.ts");
const afwijzing = ingang.slice(ingang.indexOf('"andere-sleutel"'), ingang.indexOf('leeg:'));
proef(
  "de afwijzing raadt niet aan om nóg een sleutel te maken",
  /nieuwe chat/i.test(afwijzing) && /géén tweede|geen tweede/i.test(afwijzing),
  "Deze melding moet twee dingen zeggen: open een NIEUWE chat, en maak geen tweede\n" +
    "     | sleutel. Zonder die twee zinnen begint de lus van 36 keer plakken opnieuw.",
);

console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef(en) mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
