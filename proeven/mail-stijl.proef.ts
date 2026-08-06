// Proef op de opbouw van een klantmail.
//
// Waarom dit bestand er is: de mailopdracht is een stapel regels die uit vier
// bestanden komt. Op 6 augustus stonden er twee keer tegenstrijdige regels in
// ("maximaal 120 woorden" naast "maximaal 250", en "vertel nooit het proces na"
// naast een blok dat juist vraagt om het proces te noemen). Een model dat twee
// tegenstrijdige instructies krijgt gokt welke wint, en dat merk je pas als de
// mail eruit rolt. Zulke botsingen zijn alleen te vangen met een proef die de
// opdracht als geheel bekijkt.

import { kiesWerkwijze, werkwijzeBlok, klantBlok, WERKWIJZE_STUKKEN } from "../lib/mail-context";
import { kiesInvalshoek, INVALSHOEKEN, onderbouwing } from "../lib/prioriteiten-onderbouwing";
import { schrijfstijlBlok, leesAntwoord } from "../lib/schrijfstijl";

let fouten = 0;
function check(naam: string, gekregen: unknown, verwacht: unknown) {
  const ok = String(gekregen) === String(verwacht);
  if (!ok) fouten++;
  console.log(`${ok ? "OK  " : "FOUT"} | ${naam}`);
  if (!ok) console.log(`       verwacht: ${JSON.stringify(verwacht)}\n       gekregen: ${JSON.stringify(gekregen)}`);
}
function checkWaar(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

// ── 1. De werkwijze rouleert ──
// Zonder geheugen staat er in elke mail dezelfde alinea over de top 10-analyse.
const eerste = kiesWerkwijze([]);
const tweede = kiesWerkwijze([eerste.sleutel]);
const derde = kiesWerkwijze([eerste.sleutel, tweede.sleutel]);
checkWaar("drie mails, drie verschillende stukken werkwijze",
  new Set([eerste.sleutel, tweede.sleutel, derde.sleutel]).size === 3,
  [eerste.sleutel, tweede.sleutel, derde.sleutel].join(", "));
// Alles een keer gehad: hij begint opnieuw en valt niet stil.
const alles = WERKWIJZE_STUKKEN.map((w) => w.sleutel);
checkWaar("na een volle ronde begint hij opnieuw", !!kiesWerkwijze(alles).sleutel, "");
checkWaar("na een volle ronde pakt hij het langst geleden stuk",
  kiesWerkwijze(alles).sleutel === alles[0], `gekregen: ${kiesWerkwijze(alles).sleutel}`);

// ── 2. De invalshoek rouleert, en past bij de kans ──
const gap = {
  type: "content_gap", titel: "", url: "", zoekwoord: "tuinontwerp laten maken",
  maandvolume: 900, huidigePositie: 0, targetPositie: 5, intentie: "transactional",
  effort: 6, timeToEffect: 4, confidence: 0.3, extraKlikkenPerMaand: 44, bron: "",
};
const h1 = kiesInvalshoek(gap, [], { heeftConcurrenten: true });
const h2 = kiesInvalshoek(gap, [h1.sleutel], { heeftConcurrenten: true });
const h3 = kiesInvalshoek(gap, [h1.sleutel, h2.sleutel], { heeftConcurrenten: true });
checkWaar("drie mails van hetzelfde soort openen verschillend",
  new Set([h1.sleutel, h2.sleutel, h3.sleutel]).size === 3,
  [h1.sleutel, h2.sleutel, h3.sleutel].join(", "));
// Een pagina die nog niet bestaat kan niet openen met "waar je nu staat".
checkWaar("geen positie-opening bij een pagina die niet bestaat",
  ![h1, h2, h3].some((h) => h.sleutel === "positie"), "");
// Zonder concurrentenlijst mag hij daar ook niet over beginnen.
const zonder = [0, 1, 2].reduce<string[]>((gehad) => {
  gehad.push(kiesInvalshoek(gap, gehad, { heeftConcurrenten: false }).sleutel); return gehad;
}, []);
checkWaar("geen concurrent-opening zonder concurrentenlijst", !zonder.includes("concurrent"), zonder.join(", "));
checkWaar("elke invalshoek heeft een opdracht", INVALSHOEKEN.every((h) => h.opdracht.length > 20), "");

// ── 3. De invalshoek komt echt in de mailopdracht terecht ──
const zonderGeheugen = onderbouwing(gap, { klantnaam: "Paul Hoevenaars" });
const metGeheugen = onderbouwing(gap, { klantnaam: "Paul Hoevenaars", eerdereInvalshoeken: [zonderGeheugen.invalshoek] });
checkWaar("de tweede mail krijgt een andere invalshoek",
  zonderGeheugen.invalshoek !== metGeheugen.invalshoek,
  `${zonderGeheugen.invalshoek} tegen ${metGeheugen.invalshoek}`);
checkWaar("de invalshoek staat in de opdracht aan de assistent",
  metGeheugen.mailTaak.length > zonderGeheugen.mailTaak.length / 2 && /Open met|Open NIET|Open /.test(metGeheugen.mailTaak),
  metGeheugen.mailTaak);

// ── 4. Geen tegenstrijdige regels in de opdracht ──
// De kansmail bouwt zijn systeemtekst uit losse blokken. Deze proef bootst die
// stapel na en controleert dat er geen twee regels in zitten die elkaar uitsluiten.
const KANS_REGELS = [
  `- MAXIMAAL 250 woorden tussen aanhef en afsluiting, en dat is een plafond en geen doel.`,
  `- Een enkel **vetgedrukt** woord mag, en een kort lijstje ook.`,
];
const stapel = [
  ...KANS_REGELS,
  werkwijzeBlok(eerste),
  klantBlok({ klantnaam: "Paul", profiel: "Hovenier in Uden.", propositie: "Geen prijsvechter.", feiten: ["Werkgebied: uden, oss"], concurrenten: ["grasengroen.nl"] }),
].join("\n");
checkWaar("geen twee verschillende woordplafonds", !/MAXIMAAL 120 woorden/.test(stapel), stapel.slice(0, 200));
checkWaar("vet niet tegelijk verboden en toegestaan", !/geen vetgedrukte woorden/.test(stapel), "");
checkWaar("proces niet tegelijk verboden en gevraagd", !/Vertel NOOIT het proces na/.test(stapel), "");

// ── 5. De klantkennis komt echt mee ──
const leeg = klantBlok({ klantnaam: "", profiel: "", propositie: "", feiten: [], concurrenten: [] });
check("zonder klantkennis blijft het blok leeg", leeg, "");
const vol = klantBlok({
  klantnaam: "Paul Hoevenaars",
  profiel: "Hovenier die complete tuinen realiseert, met een tuinarchitect erbij.",
  propositie: "Geen prijsvechter, geen los ontwerpbureau.",
  feiten: ["Werkgebied: uden, oss, veghel", "Diensten: tuinaanleg, tuinontwerp"],
  concurrenten: ["grasengroen.nl", "lipsgroen.nl"],
});
for (const stuk of ["tuinarchitect", "prijsvechter", "uden", "grasengroen.nl"]) {
  checkWaar(`klantkennis bevat "${stuk}"`, vol.toLowerCase().includes(stuk), "");
}
checkWaar("de opdracht verbiedt verzinnen", /Verzin NOOIT/.test(vol), "");

// ── 6. Het schrijfprofiel ──
const gelezen = leesAntwoord(`PROFIEL:
- Begint met "Hoi" plus voornaam.
- Korte zinnen, veel witregels.

VOORBEELDEN:
- Zou je mij alsjeblieft even terug willen bellen?
- In alle eerlijkheid hebben we dat nooit voor elkaar gekregen.
- te kort`);
checkWaar("het profiel wordt eruit gehaald", gelezen.profiel.includes("Hoi"), gelezen.profiel);
check("alleen echte zinnen als voorbeeld", gelezen.voorbeelden.length, 2);
checkWaar("het kopje zelf staat niet in het profiel", !/^PROFIEL/i.test(gelezen.profiel), gelezen.profiel);

const blok = schrijfstijlBlok({ profiel: "- Korte zinnen.", voorbeelden: ["Merci!"], gemaaktOp: "", aantalMails: 3, handmatig: false });
checkWaar("het stijlblok noemt de voorbeelden", blok.includes("Merci!"), blok);
check("zonder profiel geen stijlblok",
  schrijfstijlBlok({ profiel: "", voorbeelden: [], gemaaktOp: "", aantalMails: 0, handmatig: false }), "");

console.log(fouten ? `\n${fouten} proef(en) mislukt.` : "\nAlle proeven geslaagd.");
process.exit(fouten ? 1 : 0);
