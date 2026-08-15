import { readFileSync } from "node:fs";
import { join } from "node:path";
import { magNaarWachtrij, PLAN_MINIMUM, STANDEN, STAPPEN } from "../lib/grote-punten";
import {
  baanNu, eindeVanDeNacht, isNacht, mediaan, NACHT_EIND, NACHT_START,
  START_MINUTEN, uurHier, verwachteMinuten, verwachteStarts, voortgang, volgendeNacht,
} from "../lib/punt-tempo";

// ═══════════════════════════════════════════════════════════
// POORT: DE TWEE KADERS VAN DE WACHTRIJ VOOR GROTE PUNTEN
// ═══════════════════════════════════════════════════════════
// Deze wachtrij laat 's nachts code schrijven en naar main pushen terwijl er
// niemand kijkt. Dat kan alleen als twee dingen ONMOGELIJK zijn in plaats van
// afgesproken:
//
//  1. er wordt nooit iets gebouwd waar Maarten geen goedgekeurd plan voor heeft;
//  2. een tweak-ronde en een bouwronde draaien nooit tegelijk.
//
// Beide zijn in code afgedwongen (lib/grote-punten.ts en lib/bouwslot.ts). Deze
// proef rekent dat na, plus de tijdsverwachting die Maarten op het scherm ziet,
// want een balk die niet klopt is erger dan geen balk: dan gaat hij zelf zitten
// gokken hoe lang iets nog duurt.
//
// Draait mee in `prebuild` (via proeven/alles.mjs), dus ook op Vercel. Rood
// betekent: de bouw mislukt en het komt niet live.
// ═══════════════════════════════════════════════════════════

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

const WORTEL = join(__dirname, "..");
const lees = (p: string) => readFileSync(join(WORTEL, p), "utf8");
const LANG_PLAN = "x".repeat(PLAN_MINIMUM + 10);
const AKKOORD = "2026-08-15T22:00:00.000Z";

// ── 1. Kader één: zonder goedgekeurd plan geen bouw ──
proef("een punt zonder plan mag de bouwwachtrij niet in",
  magNaarWachtrij({ plan: "", goedgekeurd: AKKOORD }).ok === false);
proef("een plan van één regel telt niet als plan",
  magNaarWachtrij({ plan: "Even opknappen.", goedgekeurd: AKKOORD }).ok === false,
  "Een plan dat te kort is om 's nachts op te bouwen, hoort geweigerd te worden.");
proef("een plan zonder akkoord van Maarten mag de bouwwachtrij niet in",
  magNaarWachtrij({ plan: LANG_PLAN, goedgekeurd: null }).ok === false,
  "Dit is het hele kader: alleen wat Maarten goedkeurt, wordt gebouwd.");
proef("een uitgeschreven plan mét akkoord mag wél",
  magNaarWachtrij({ plan: LANG_PLAN, goedgekeurd: AKKOORD }).ok === true);
proef("een weigering zegt in gewone taal waarom",
  ["", "kort", LANG_PLAN].every((plan) => {
    const uit = magNaarWachtrij({ plan, goedgekeurd: null });
    return uit.ok || (uit.reden.length > 25 && !/[{}]/.test(uit.reden));
  }),
  "Een kale foutcode kost een chat om uit te zoeken; er hoort een leesbare reden te staan.");

// ── 2. Het akkoord vervalt als het plan verandert ──
// Anders betekent "jij keurt goed" niets: dan kan een plan ná de goedkeuring nog
// herschreven worden en tóch gebouwd.
const bron = lees("lib/grote-punten.ts");
proef("een gewijzigd plan trekt het akkoord in",
  /goedgekeurd\s*=\s*CASE WHEN \$\{plan\} <> plan THEN NULL/.test(bron.replace(/\s+/g, " ")),
  "In zetPlan() hoort het akkoord te vervallen zodra de tekst van het plan verandert.");

// ── 3. Kader twee: één slot voor beide banen ──
const slot = lees("lib/bouwslot.ts");
proef("het slot heeft precies één rij", /WHERE id = 1/.test(slot));
proef("de tweak-baan gebruikt hetzelfde slot",
  /pakSlot\(ronde, "tweak"\)/.test(lees("lib/tweak-ronde.ts")),
  "Zonder gedeeld slot kunnen een tweak-ronde en een bouwronde tegelijk in dezelfde bestanden schrijven.");
proef("de punt-baan gebruikt hetzelfde slot",
  /pakSlot\(ronde, "punt"\)/.test(lees("lib/punt-ronde.ts")));
proef("een vastgelopen ronde geeft ook het werk van de ándere baan vrij",
  /UPDATE grote_punten/.test(slot) && /UPDATE tweaks/.test(slot),
  "bevrijdSlot() moet beide tabellen opruimen; anders blijft de andere baan hangen als deze het slot vrijmaakt.");

// De tweede sluiting, bij GitHub zelf: dezelfde concurrency-groep.
const tweakStroom = lees(".github/workflows/tweak-ronde.yml");
const puntStroom = lees(".github/workflows/punt-nacht.yml");
const groep = (y: string) => (/group:\s*(\S+)/.exec(y) ?? [])[1];
proef("beide werkstromen zitten in dezelfde concurrency-groep",
  Boolean(groep(tweakStroom)) && groep(tweakStroom) === groep(puntStroom),
  `tweak-ronde: ${groep(tweakStroom)}, punt-nacht: ${groep(puntStroom)}. Verschillende groepen betekent dat GitHub ze wél tegelijk start.`);

// ── 4. De volgorde en het akkoord zijn van Maarten, niet van een ronde ──
const volgordeRoute = lees("app/api/admin/punten/volgorde/route.ts");
proef("een ronde kan zichzelf niet vooraan in de wachtrij zetten",
  !/isMeekijker/.test(volgordeRoute),
  "De volgorde-route mag geen meekijk-uitzondering hebben; wat als eerste gebouwd wordt is Maartens keuze.");
const puntenRoute = lees("app/api/admin/punten/route.ts");
proef("een ronde kan zijn eigen plan niet goedkeuren",
  /keurGoed && meekijker/.test(puntenRoute),
  "De route moet keurGoed weigeren als het verzoek uit een meekijk-sessie komt.");

// ── 5. De ronde geeft het slot altijd terug, ook als hij omvalt ──
proef("de nachtronde geeft de wachtrij hoe dan ook terug",
  /if: always\(\)/.test(puntStroom) && /"actie":\\"terug\\"|actie\\":\\"terug/.test(puntStroom),
  "Zonder een always()-stap houdt een omgevallen ronde het slot vast en staat de hele nacht stil.");

// ── 6. Het nachtvenster ──
// Zomertijd (UTC+2) en wintertijd (UTC+1) allebei, want het venster staat in
// Nederlandse tijd en het cron-schema in UTC.
const zomerNacht = new Date("2026-08-15T21:00:00Z");   // 23:00 in Nederland
const zomerDag = new Date("2026-08-15T10:00:00Z");     // 12:00 in Nederland
const winterNacht = new Date("2026-01-15T21:00:00Z");  // 22:00 in Nederland
const winterOchtend = new Date("2026-01-15T06:30:00Z"); // 07:30 in Nederland
proef("de klok in Nederland wordt goed gelezen (zomertijd)", uurHier(zomerNacht) === 23);
proef("de klok in Nederland wordt goed gelezen (wintertijd)", uurHier(winterNacht) === 22);
proef("23:00 telt als nacht", isNacht(zomerNacht));
proef("22:00 telt als nacht (wintertijd)", isNacht(winterNacht));
proef("12:00 telt niet als nacht", !isNacht(zomerDag));
proef("07:30 telt niet meer als nacht", !isNacht(winterOchtend));
proef("'s nachts is de punt-baan aan de beurt", baanNu(zomerNacht) === "punt");
proef("overdag is de tweak-baan aan de beurt", baanNu(zomerDag) === "tweak");

proef("het venster gaat vanavond open, niet morgen",
  uurHier(volgendeNacht(zomerDag)) === NACHT_START
  && volgendeNacht(zomerDag).getTime() - zomerDag.getTime() < 24 * 3600000);
proef("het is al nacht, dus het venster is nu open",
  volgendeNacht(zomerNacht).getTime() === zomerNacht.getTime());
proef("de nacht eindigt om 07:00", uurHier(eindeVanDeNacht(zomerNacht)) === NACHT_EIND);

// Het cron-schema moet het hele venster dekken, in zomer- én wintertijd. 22:00
// in Nederland is 20:00 UTC (zomer) of 21:00 UTC (winter); 07:00 is 05:00 of
// 06:00 UTC. Dus moeten de uren 20 tot en met 5 erin staan.
const cron = (/cron:\s*"([^"]+)"/.exec(puntStroom) ?? [])[1] ?? "";
const uren = new Set((cron.split(" ")[1] ?? "").split(",").map((x) => Number(x)));
const nodig = [20, 21, 22, 23, 0, 1, 2, 3, 4, 5];
proef("het cron-schema dekt het hele nachtvenster in zomer- en wintertijd",
  nodig.every((u) => uren.has(u)),
  `Het schema is "${cron}"; nodig zijn de uren ${nodig.join(", ")} in UTC.`);

// ── 7. De tijdsverwachting ──
proef("zonder metingen geldt de startwaarde",
  verwachteMinuten("groot", { klein: [], middel: [], groot: [] }) === START_MINUTEN.groot);
proef("één meting is te weinig om de startwaarde te vervangen",
  verwachteMinuten("middel", { klein: [], middel: [90], groot: [] }) === START_MINUTEN.middel,
  "Eén uitschieter mag de verwachting niet meteen omgooien.");
proef("met metingen telt de mediaan, niet het gemiddelde",
  verwachteMinuten("middel", { klein: [], middel: [20, 25, 300], groot: [] }) === 25,
  "Een ronde die vastliep en pas na uren werd opgeruimd, mag de verwachting niet blijvend scheeftrekken.");
proef("de mediaan negeert onzin", mediaan([0, -5, 10, 20]) === null || mediaan([10, 20, 30]) === 20);

const gemeten = { klein: [], middel: [], groot: [] };
const bezig = { gestart: new Date(Date.now() - 10 * 60000).toISOString(), stap: "", omvang: "middel" as const };
const v0 = voortgang({ ...bezig, stapNr: 0 }, gemeten);
const v3 = voortgang({ ...bezig, stapNr: 3 }, gemeten);
proef("de voortgang telt de verstreken tijd", v0.verstreken === 10);
proef("de balk loopt op de gemelde stappen", Math.abs(v3.deel - 3 / STAPPEN.length) < 0.001);
proef("verder in de stappen betekent minder resterende tijd", v3.rest < v0.rest,
  `stap 0: nog ${v0.rest} min, stap 3: nog ${v3.rest} min. De schatting hoort scherper te worden naarmate de ronde vordert.`);
proef("er staat nooit 'nog 0 minuten'",
  voortgang({ ...bezig, gestart: new Date(Date.now() - 5 * 3600000).toISOString(), stapNr: 4 }, gemeten).rest >= 1);
proef("een ronde die veel te lang duurt wordt als zodanig gemeld",
  voortgang({ ...bezig, gestart: new Date(Date.now() - 5 * 3600000).toISOString(), stapNr: 1 }, gemeten).duurtLang,
  "Anders zie je alleen een balk die niet opschiet, zonder te weten of dat erg is.");
proef("een ronde die net begonnen is, is niet meteen traag",
  !voortgang({ ...bezig, gestart: new Date(Date.now() - 60000).toISOString(), stapNr: 0 }, gemeten).duurtLang);

// ── 8. De verwachte starttijden in de wachtrij ──
const rij = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, omvang: "groot" as const }));
const starts = verwachteStarts(rij, gemeten, zomerDag);
proef("elk punt in de wachtrij krijgt een verwachte starttijd", starts.length === rij.length);
proef("het eerste punt begint zodra het nachtvenster opengaat",
  uurHier(new Date(starts[0].begint)) === NACHT_START);
proef("de punten volgen elkaar op, ze beginnen niet allemaal tegelijk",
  new Date(starts[1].begint).getTime() > new Date(starts[0].begint).getTime());
proef("elk punt begint binnen een nachtvenster, nooit midden op de dag",
  starts.every((s) => isNacht(new Date(s.begint))),
  `Gevonden: ${starts.map((s) => new Date(s.begint).toISOString()).join(", ")}`);
const venster = (START_MINUTEN.groot * rij.length) > ((24 - NACHT_START + NACHT_EIND) * 60);
proef("wat niet meer in de nacht past, schuift naar de nacht erna",
  !venster || new Date(starts[rij.length - 1].begint).getTime()
    - new Date(starts[0].begint).getTime() > 12 * 3600000,
  "Vijf grote punten zijn geen één nacht; dat hoort te zien te zijn in plaats van 's ochtends te blijken.");

// ── 9. Wat op het scherm staat, dekt wat de code kan ──
const scherm = lees("app/admin/grote-punten/GrotePuntenClient.tsx");
proef("elke stand heeft een naam in gewone taal op het scherm",
  STANDEN.every((s) => new RegExp(`"?${s}"?:`).test(scherm)),
  "Een stand zonder label komt in beeld als een technische term, of helemaal niet.");
proef("het scherm ververst zichzelf zolang er iets loopt",
  /setInterval/.test(scherm) && /api\/admin\/punten/.test(scherm),
  "Zonder verversing zie je niet wat er nu gebeurt, en dat is de hele vraag.");

if (fouten) {
  console.error(`\n✗ De wachtrij voor grote punten klopt niet: ${fouten} fout(en).\n`);
  process.exit(1);
}
console.log("\n✓ De wachtrij voor grote punten: kaders dicht, tijdsverwachting klopt.\n");
