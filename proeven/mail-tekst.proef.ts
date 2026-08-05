// Proef op het uitlezen van een mailbody.
//
// Waarom dit bestand er is: de afspraken-controle miste Punt 2 uit een echte mail
// omdat de tekst op 2500 tekens werd afgeknipt, precies door de tabellen heen. Bij
// het repareren daarvan moest `naarTekst` tabellen leesbaar gaan maken, maar
// diezelfde functie voedt ook de mailscoring in page-emails.ts. Die mag NIET
// stilletjes anders gaan werken; dat faalt namelijk zonder foutmelding.
//
// De eerste proef hieronder is daarom geschreven vóórdat er iets veranderd werd,
// en legt het bestaande gedrag van `naarTekst` vast.

import { naarTekst, naarTekstMetTabellen, eigenTekst, eigenTekstRijk, knipOpAlinea } from "../lib/mail-tekst";

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

// ── Een echte-mail-achtige tabel, zoals Maartens Punt 2 ──
const TABEL = `<table>
<tr><th>#</th><th>Pagina</th><th>Waarom</th></tr>
<tr><td>1</td><td>Homepage (/)</td><td>Sterkste pagina qua autoriteit; vermeld Etten-Leur in het werkgebied-blok</td></tr>
<tr><td>2</td><td>Hovenier-hub (/hovenier/)</td><td>Directe thematische ouder met een lijst van plaatsen</td></tr>
</table>`;

// ── 1. REGRESSIE: naarTekst blijft exact doen wat het deed ──
// Het oude gedrag: </tr> wordt een newline, maar <td> en </td> vallen onder de
// generieke tag-strip en worden dus een spatie. Cellen plakken aan elkaar.
const oud = naarTekst(TABEL);
checkWaar(
  "naarTekst plakt cellen nog steeds met spaties aaneen (oud gedrag blijft)",
  oud.includes("1 Homepage (/) Sterkste pagina") && !oud.includes("|"),
  `kreeg: ${JSON.stringify(oud.slice(0, 120))}`,
);
check("naarTekst zet een rij nog steeds op een eigen regel", oud.split("\n").length >= 3, true);
check("naarTekst laat gewone HTML ongemoeid", naarTekst("<p>Hallo <b>daar</b></p>"), "Hallo daar");
check("naarTekst zet br om naar een regelovergang", naarTekst("een<br>twee"), "een\ntwee");

// ── 2. De rijke variant maakt kolommen zichtbaar ──
const rijk = naarTekstMetTabellen(TABEL);
checkWaar(
  "naarTekstMetTabellen scheidt kolommen met een pijp",
  rijk.includes("1 | Homepage (/) | Sterkste pagina"),
  `kreeg: ${JSON.stringify(rijk.slice(0, 160))}`,
);
checkWaar("de tweede rij komt ook mee", rijk.includes("2 | Hovenier-hub (/hovenier/)"), `kreeg: ${JSON.stringify(rijk)}`);
checkWaar("geen losse pijp aan het begin of eind van een regel", !/^\s*\||\|\s*$/m.test(rijk), `kreeg: ${JSON.stringify(rijk)}`);

// Lay-outtabellen (handtekening, knop, logo) mogen GEEN pijpen krijgen, anders
// staat elke Outlook-handtekening vol streepjes.
const LAYOUT = `<table><tr><td><img src="logo.png"></td></tr></table>`;
checkWaar("een lay-outtabel van één cel krijgt geen pijpen", !naarTekstMetTabellen(LAYOUT).includes("|"));
const LAYOUT2 = `<table><tr><td>Kamsteeg Tuinen BV</td></tr><tr><td>Breda</td></tr></table>`;
checkWaar("een tabel van één kolom krijgt geen pijpen", !naarTekstMetTabellen(LAYOUT2).includes("|"));

// ── 3. Knippen op een alinea in plaats van middenin een zin ──
const LANG = "Eerste alinea met wat tekst erin.\n\nTweede alinea die veel langer is en doorloopt tot voorbij de grens die we zo meegeven.";
// De alinea-grens ligt op teken 33; bij max 40 is dat ruim binnen de marge, dus
// daar mag geknipt worden.
const geknipt = knipOpAlinea(LANG, 40);
checkWaar("knipOpAlinea knipt op een lege regel", geknipt === "Eerste alinea met wat tekst erin.", `kreeg: ${JSON.stringify(geknipt)}`);
// Bij max 60 zou knippen op teken 33 bijna de helft weggooien. Dan is hard
// afkappen beter dan een grens halen die te veel kost.
checkWaar(
  "knipOpAlinea gooit niet te veel weg om een grens te halen",
  knipOpAlinea(LANG, 60).length > 40,
  `kreeg: ${JSON.stringify(knipOpAlinea(LANG, 60))}`,
);
check("knipOpAlinea laat korte tekst met rust", knipOpAlinea("kort", 100), "kort");

// ── 4. DE KERNPROEF: het echte geval dat misging ──
// Een mail zoals die van 30 juli: Punt 1 vooraan, Punt 2 met tabellen erachter,
// en een handtekening onderaan. Met het oude budget van 2500 viel Punt 2 eruit.
// Zo lang gekozen dat de kop van Punt 2 nog nét binnen 2500 tekens valt en de
// tabel eronder niet. Precies de verhouding uit de echte mail van 30 juli: 5765
// tekens totaal, "Punt 2" op teken 2043, tabellen doorlopend tot ongeveer 4500.
const VULLING = "Wat inleidende tekst over de resultaten van de afgelopen maand. ".repeat(37);
const MAIL = `<div>
<div>Hoi Sander,</div>
<div>${VULLING}</div>
<div>Punt 1: Locatiepagina's uit het menu en de footer</div>
<div>Kun jij ze uit het primaire menu en de footer-navigatie halen?</div>
<div>Punt 2: Interne links om orphans te voorkomen</div>
${TABEL}
<div>Vriendelijke groet,</div>
<div>Maarten Vermeulen</div>
</div>`;

const krap = eigenTekst(MAIL, "", 2500);
checkWaar(
  "met het oude budget van 2500 viel de tabel er inderdaad uit (dit was de bug)",
  !krap.includes("Hovenier-hub"),
  "als dit faalt, was de diagnose verkeerd",
);

const ruim = eigenTekstRijk(MAIL, "", 12000);
checkWaar("met ruim budget staat Punt 2 er wel in", ruim.includes("Punt 2"));
checkWaar("en de eerste tabelrij compleet", ruim.includes("1 | Homepage (/)"), `kreeg staart: ${JSON.stringify(ruim.slice(-200))}`);
checkWaar("en de tweede tabelrij compleet", ruim.includes("2 | Hovenier-hub (/hovenier/)"));
checkWaar("de handtekening blijft eraf", !ruim.includes("Maarten Vermeulen"));

// ── 5. Overleeft de citaatcontrole de pijp-tabellen? ──
// Dit is de stille aanname waar de hele afspraken-extractie op rust: een citaat
// uit een tabelcel moet, genormaliseerd, terug te vinden zijn in de brontekst.
// Zelfde normalisatie als lib/mail-afspraken.ts gebruikt.
function normaliseer(s: string): string {
  return (s || "").toLowerCase()
    .replace(/[‘’‚‛']/g, "'").replace(/[“”„‟"]/g, '"')
    .replace(/[^a-z0-9à-ÿ'"]+/gi, " ").trim().replace(/\s+/g, " ");
}
const citaat = "Sterkste pagina qua autoriteit; vermeld Etten-Leur in het werkgebied-blok";
checkWaar(
  "een citaat uit een tabelcel wordt teruggevonden in de rijke tekst",
  normaliseer(ruim).includes(normaliseer(citaat)),
  "zonder dit gooit de nacontrole elk tabelpunt weg",
);
checkWaar(
  "een citaat dat over twee cellen heen loopt wordt óók teruggevonden",
  normaliseer(ruim).includes(normaliseer("Homepage (/) Sterkste pagina qua autoriteit")),
);
checkWaar(
  "een verzonnen citaat valt nog steeds door de mand",
  !normaliseer(ruim).includes(normaliseer("plaats hier een link naar de contactpagina")),
);

console.log(`\n${fouten === 0 ? "ALLES GOED" : `${fouten} PROEVEN MISLUKT`}`);
process.exit(fouten === 0 ? 0 : 1);
