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
