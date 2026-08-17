import fs from "node:fs";
import path from "node:path";

// ═══════════════════════════════════════════════════════════
// HET TAAKVENSTER VAN DE DEVELOPER: EIGEN VELD, ECHTE KRUISJES, WEG-KNOP
// ═══════════════════════════════════════════════════════════
// Drie dingen die er op 17-08-2026 alle drie stil naast zaten, en die je alleen
// ziet als je het venster écht opent (alles compileerde, alle proeven waren
// groen):
//
//  1. "Opmerking voor de developer" stond voorgevuld met de door de chat bedachte
//     "Bouw:"-regel uit de kaart in de weekplanning. Dat is Maartens eigen
//     invulveld, dus hij opende het venster met een waslijst die eerst weg moest.
//  2. Het kruisje bij een document deed niets. Twee redenen tegelijk: de meeste
//     documenten zijn niet zelf toegevoegd maar bij de pagina gevonden (dus niet
//     uit `extra_docs` te halen), en het weghalen ging via een UPDATE terwijl een
//     doorgezette kaart vaak nog geen rij in `developer_overview` heeft. Nul
//     rijen geraakt, geen melding, document staat er nog.
//  3. Een taak van de lijst halen kon alleen door hem eerst te openen, terwijl
//     dat de meest voorkomende handeling in die rij is.
//
// Alle drie zijn onzichtbaar in de code en zichtbaar op het scherm; dat is precies
// wat een poort hoort te bewaken.

const WORTEL = path.resolve(__dirname, "..");
let fouten = 0;
function check(wat: string, goed: boolean, waarom: string) {
  console.log(`${goed ? "ok " : "FOUT"}  ${wat}`);
  if (!goed) { console.log(`      ${waarom}`); fouten++; }
}

const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");
const dev = lees("lib/developer.ts");
const scherm = lees("app/admin/developer/DeveloperOverview.tsx");

// ── 1. Het eigen opmerkingveld blijft leeg ───────────────────────────────────
check(
  "de kaarttekst gaat naar kaartOpm, niet naar het eigen opmerkingveld",
  /kaartOpm:\s*devSturing\(/.test(dev),
  "devSturing levert de sturing uit de kaart; die hoort in kaartOpm te landen.",
);
check(
  "toelichting wordt nooit met de kaarttekst voorgevuld",
  !/toelichting:[^\n]*devSturing\(/.test(dev),
  "Zet devSturing nooit in `toelichting`: dat is het veld waar Maarten zelf in typt, en\n"
  + "      dan opent het venster weer met een waslijst die hij eerst moet weggooien.",
);
check(
  "het venster toont de kaarttekst apart, met een knop om hem over te nemen",
  /kaartOpm/.test(scherm) && /Overnemen/.test(scherm),
  "Zonder dat blok raakt de sitebouwer de sturing uit de kaart kwijt.",
);
check(
  "die kaarttekst rendert via de gedeelde poort",
  /netteHtml\(kaartOpm\)/.test(scherm),
  "Anders komt `- Bouw: ...` als ruwe opmaaktekst in beeld; gebruik netteHtml.",
);

// ── 2. Het kruisje haalt echt iets weg ───────────────────────────────────────
check(
  "er is een afhaal-lijst voor documenten die het dashboard zelf vindt",
  /docs_uit/.test(dev),
  "De pagina, de copy, de blauwdruk en de analyse worden elke keer opnieuw bij de pagina\n"
  + "      gevonden. Zonder afhaal-lijst kun je ze niet van één taak afhalen.",
);
check(
  "de afhaal-lijst wordt met een upsert bewaard",
  /INSERT INTO developer_overview \(client_slug, task_key, docs_uit/.test(dev),
  "Een doorgezette kaart heeft vaak nog geen rij in developer_overview, dus een UPDATE\n"
  + "      raakt nul rijen en het kruisje doet stilletjes niets.",
);
check(
  "weggehaalde documenten worden er ook echt uit gefilterd",
  /uit\.has\(d\.url\)/.test(dev),
  "De lijst bewaren is niet genoeg; getDeveloperTasks moet ze er als laatste uit halen,\n"
  + "      zodat het voor alle drie de soorten documenten werkt.",
);

// ── 3. Van de lijst halen kan zonder de taak te openen ───────────────────────
const rij = scherm.slice(scherm.indexOf("dev-rij-acties"), scherm.indexOf("const content ="));
check(
  "de knoppenrij van een taak heeft een weghaal-knop",
  /wegKnop\(r\)/.test(rij),
  "Naast Bekijk, Mail en Controleer hoort de meest gebruikte actie te staan.",
);
check(
  "die knop is als onomkeerbaar vormgegeven",
  /btn btn-danger btn-klein/.test(scherm),
  "Knopconventie: onomkeerbaar is .btn-danger, en dit haalt werk van de lijst.",
);
check(
  "weghalen vraagt eerst om bevestiging",
  /window\.confirm\([\s\S]{0,400}van de developerlijst halen/.test(scherm),
  "Eén klik in een rij mag geen taak weggooien zonder te vragen.",
);

console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef(en) mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
