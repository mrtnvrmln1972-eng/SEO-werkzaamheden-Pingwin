// ═══════════════════════════════════════════════════════════
// DE NACHTRONDE MOET LEZEN WAT HET DASHBOARD ZEGT
// ═══════════════════════════════════════════════════════════
// Op 15-08-2026 draaide de bouwronde, kleurde groen, en deed niets. Niet één
// keer: élke keer, ook 's nachts. De oorzaak was één regel in
// .github/workflows/punt-nacht.yml:
//
//     grep -o '"werk":"[a-z]*"' | head -1
//
// Het antwoord van /api/admin/punten/ronde bevat "werk" twee keer. In `stand`
// staat wat er nú loopt ("bouw" of "plan"), in `volgende` staat wat er
// klaarstaat ("bouwen" of "plan"). `stand` staat vooraan, dus die grep pakte
// altijd de verkeerde: "bouw". Dat is geen van de twee waarden waar de
// werkstroom op kijkt, dus zowel bouwen als een plan schrijven werd
// overgeslagen. Op het scherm bleef het punt op "nog niet begonnen" staan en
// leek de knop "Begin nu met het plan" kapot.
//
// Twee dingen maakten dit onzichtbaar, en die bewaakt deze proef allebei:
//  1. NAAR EEN SLEUTEL VISSEN IN PLAATS VAN EEN PAD LEZEN. `grep -o '"x":"'`
//     weet niet in welk deel van het antwoord hij kijkt. Eén veld erbij op een
//     andere plek en je leest stilletjes iets anders. Dus: jq met een pad.
//  2. WAARDEN DIE NAAST ELKAAR LEVEN ZONDER ELKAAR TE KENNEN. De werkstroom
//     vergeleek met "bouwen" en "plan", maar niets hield die naast het type in
//     lib/punt-ronde.ts. Hernoemt iemand daar iets, dan gebeurt precies
//     hetzelfde opnieuw en meldt niemand het. Dus: deze proef leest de waarden
//     uit de code en legt ze naast de werkstroom.
//
// Zet deze proef nooit uit; hij is het enige dat merkt dat een ronde draait
// zonder werk te doen, want van buitenaf ziet dat er geslaagd uit.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

const wortel = join(__dirname, "..");
const map = join(wortel, ".github", "workflows");
const bestanden = readdirSync(map).filter((n) => n.endsWith(".yml") || n.endsWith(".yaml"));
const werkstromen = bestanden.map((n) => {
  const tekst = readFileSync(join(map, n), "utf8");
  return {
    naam: n,
    tekst,
    // Wat er draait, zonder de toelichting erboven. Een uitleg mag een fout
    // laten zien ("hier stond eerst dit"); alleen wat echt uitgevoerd wordt telt.
    code: tekst.split("\n").filter((r) => !r.trim().startsWith("#")).join("\n"),
  };
});

proef("de werkstromen zijn gevonden", werkstromen.length > 0);

// ── 1. Geen enkele werkstroom vist een sleutel uit JSON ──
const vist = werkstromen.filter((w) => /grep\s+-o\s+'"[a-zA-Z_]+"\s*:/.test(w.code));
proef(
  "geen enkele werkstroom vist een sleutel uit JSON met grep",
  vist.length === 0,
  vist.length
    ? `${vist.map((w) => w.naam).join(", ")} zoekt een sleutel op naam in het hele antwoord.\n` +
      "     | Zo'n grep weet niet in welk deel hij kijkt en pakt de eerste die hij tegenkomt.\n" +
      "     | Gebruik jq met een pad, bijvoorbeeld: jq -r '.volgende.werk // \"geen\"'"
    : "",
);

const punt = werkstromen.find((w) => w.naam === "punt-nacht.yml");
proef("punt-nacht.yml bestaat nog", Boolean(punt));

if (punt) {
  // ── 2. Hij leest het juiste pad ──
  proef(
    "de bouwronde leest .volgende.werk, niet zomaar 'werk'",
    /jq\s+-r\s+'\.volgende\.werk/.test(punt.code),
    "Wat er klaarstaat staat in `volgende`. In `stand` staat wat er nú loopt, en die\n" +
      "     | staat vooraan in het antwoord; die lezen betekent: altijd niets doen.",
  );

  // ── 3. De waarden komen uit de code, niet uit het geheugen ──
  const bron = readFileSync(join(wortel, "lib", "punt-ronde.ts"), "utf8");
  const regel = bron.match(/export type Werk\s*=\s*([^;]+);/);
  proef("het type Werk is te vinden in lib/punt-ronde.ts", Boolean(regel));

  const soorten = regel ? [...regel[1].matchAll(/"([a-z-]+)"/g)].map((m) => m[1]) : [];
  proef("het type Werk noemt minstens twee soorten werk", soorten.length >= 2, `Gevonden: ${soorten.join(", ") || "niets"}`);

  // Elke stap die op het werk kijkt, moet een waarde noemen die echt kan
  // voorkomen: een soort werk uit het type hierboven, of "geen".
  const mag = new Set([...soorten, "geen"]);
  const genoemd = [...punt.code.matchAll(/steps\.kijk\.outputs\.werk\s*[!=]=\s*'([^']*)'/g)].map((m) => m[1]);
  proef("er wordt ergens op het werk gekeken", genoemd.length > 0);

  const onbekend = [...new Set(genoemd.filter((w) => !mag.has(w)))];
  proef(
    "elke vergelijking noemt werk dat het dashboard echt teruggeeft",
    onbekend.length === 0,
    onbekend.length
      ? `De werkstroom vergelijkt met ${onbekend.map((w) => `"${w}"`).join(", ")}, en dat komt nooit voor.\n` +
        `     | Het dashboard geeft terug: ${[...mag].map((w) => `"${w}"`).join(", ")}.\n` +
        "     | Een stap met een waarde die niet bestaat wordt altijd overgeslagen, zonder melding."
      : "",
  );

  // En andersom: elk soort werk dat het dashboard kan teruggeven, moet ook
  // ergens opgepakt worden. Anders komt er werk binnen dat niemand doet.
  const vergeten = soorten.filter((w) => !genoemd.includes(w));
  proef(
    "elk soort werk wordt door een stap opgepakt",
    vergeten.length === 0,
    vergeten.length
      ? `Voor ${vergeten.map((w) => `"${w}"`).join(", ")} is er geen stap in punt-nacht.yml.\n` +
        "     | Dat werk komt dan wel in de wachtrij, maar er gebeurt niets mee."
      : "",
  );

  // ── 4. Een onbekend antwoord mag niet stil voorbijgaan ──
  proef(
    "een onverwacht antwoord laat de ronde mislukken",
    /::error::/.test(punt.code.split("De laatste code ophalen")[0] ?? ""),
    "De stap die kijkt wat er klaarstaat moet stoppen met een fout als hij het antwoord\n" +
      "     | niet herkent. Anders draait de ronde door, doet niets, en meldt 'geslaagd'.",
  );
}

console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef(en) mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
