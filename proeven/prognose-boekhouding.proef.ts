// Proef op het uitlezen van de boekhouding voor de prognose.
//
// WAAROM DIT BESTAAT
// ══════════════════
// Deze knop zet de bedragen van álle klanten tegelijk om. Als het rekenwerk
// erachter een klein beetje scheef staat, staat de hele prognose scheef, en dan
// ziet niemand het: de bedragen zijn plausibel, ze komen uit de boekhouding, wie
// gaat dat natellen. Twee dingen gaan hier gegarandeerd een keer mis:
//
//  1. HET VERSCHIL TUSSEN MAANDELIJKS EN NIET-MAANDELIJKS. Een klant die per
//     kwartaal 4.500 factureert, kost je drie keer te veel omzet in de prognose
//     als je "het middelste bedrag van de maanden mét een factuur" pakt. En een
//     maandklant met één extra projectfactuur wordt juist te duur als je het
//     gemiddelde pakt. Het moet allebei goed gaan, en dat is één regel verschil.
//  2. NAMEN AAN ELKAAR KNOPEN. "One Day Clinic B.V." op de factuur en
//     "One Day Clinic" in het dashboard zijn dezelfde klant. Maar een sleutel
//     die te makkelijk matcht, gooit twee klanten op één hoop en schrijft de
//     linkbuilding van de een op de ander. Te streng is hinderlijk, te los is
//     stil fout, en stil fout is erger.

import { maandbedragUit, sleutel, noemtKlant } from "../lib/prognose-boekhouding";

let fouten = 0;
function check(naam: string, gekregen: unknown, verwacht: unknown) {
  const ok = String(gekregen) === String(verwacht);
  if (!ok) fouten++;
  console.log(`${ok ? "OK  " : "FOUT"} | ${naam}${ok ? "" : `\n       gekregen ${gekregen}, verwacht ${verwacht}`}`);
}

const maanden = (bedragen: number[]) =>
  bedragen.map((bedrag, i) => ({ maand: `2026-0${i + 1}`, bedrag }));

// ── 1. Een vaste maandklant ──
{
  const u = maandbedragUit(maanden([1500, 1500, 1500, 1500, 1500, 1500]), 6);
  check("een vaste maandklant levert zijn maandbedrag op", u.bedrag, 1500);
  check("en daar is niets bij op te merken", u.meldingen.length, 0);
}

// ── 2. Een maandklant met één uitschieter ──
// De extra factuur (een eenmalig project) mag het maandbedrag niet optillen,
// want dat bedrag komt volgende maand niet terug.
{
  const u = maandbedragUit(maanden([1500, 1500, 4500, 1500, 1500, 1500]), 6);
  check("een eenmalige uitschieter tilt het maandbedrag niet op", u.bedrag, 1500);
  check("maar hij wordt wel gemeld", u.meldingen.length, 1);
  check("de melding noemt de bandbreedte", /wisselt per maand/.test(u.meldingen[0]), "true");
}

// ── 3. Een kwartaalklant ──
// Hier zou de mediaan 4.500 per maand zeggen terwijl het er 1.500 zijn.
{
  const u = maandbedragUit(maanden([4500, 0, 0, 4500, 0, 0]), 6);
  check("een kwartaalklant wordt naar een maandbedrag gerekend", u.bedrag, 1500);
  check("en dat wordt erbij gemeld", /niet elke maand gefactureerd/.test(u.meldingen[0]), "true");
}

// ── 4. Eén gemiste maand is geen opzegging ──
// Een factuur die net over de maandgrens valt mag geen kwartaalklant maken.
{
  const u = maandbedragUit(maanden([1500, 1500, 0, 1500, 1500, 1500]), 6);
  check("één gemiste maand telt nog als maandelijks", u.bedrag, 1500);
}

// ── 5. Niets gefactureerd ──
{
  const u = maandbedragUit(maanden([0, 0, 0, 0, 0, 0]), 6);
  check("zonder facturen is het bedrag nul", u.bedrag, 0);
  check("en dat wordt gezegd, niet geraden", u.meldingen[0], "geen facturen in deze periode");
}

// ── 6. Namen aan elkaar knopen ──
check("een rechtsvorm doet er niet toe", sleutel("One Day Clinic B.V."), sleutel("One Day Clinic"));
check("hoofdletters en spaties ook niet", sleutel("Paul  Hoevenaars"), "paulhoevenaars");
check("een domein leest als de naam", sleutel("onedayclinic.nl"), "onedayclinic");
check("een ampersand wordt uitgeschreven", sleutel("Jansen & Zn"), "jansenenzn");
check("twee verschillende bedrijven blijven verschillend", sleutel("Kamsteeg") === sleutel("Kamstra"), "false");

// ── 7. Een klantnaam terugvinden in een factuurregel ──
{
  const odc = sleutel("One Day Clinic");
  const domein = sleutel("onedayclinic.nl");
  check("de klantnaam in de omschrijving telt", noemtKlant("Linkbuilding One Day Clinic juli", odc, domein), "true");
  check("het domein telt ook", noemtKlant("3 links onedayclinic.nl", odc, domein), "true");
  check("een andere klant telt niet", noemtKlant("Linkbuilding Kamsteeg juli", odc, domein), "false");
  check("een lege omschrijving telt niet", noemtKlant("", odc, domein), "false");
  // De belangrijkste: een korte sleutel matcht op van alles. "Bo" zit in
  // "Linkbuilding", en dan zou élke regel naar die ene klant gaan.
  check("een te korte naam koppelt niets", noemtKlant("Linkbuilding juli", sleutel("Bo"), ""), "false");
  check("zonder naam en zonder domein koppelt niets", noemtKlant("wat dan ook", "", ""), "false");
}

// ── 8. De omschrijvingen zoals ze er in het echt uitzien ──
// Vastgelegd op 15-08-2026 aan de hand van de werkelijke facturen van de
// linkbuilder. Ze noemen géén klant ("Linkbuilding februari 2026"), en dat is
// hier geen randgeval maar de normale situatie. Deze proef legt dat vast zodat
// niemand later denkt dat de koppeling stuk is: er valt niets te koppelen.
{
  const echte = [
    "Linkbuilding",
    "Linkbuilding februari 2026",
    "Linkbuilding december 2025",
    "Factuur voor linkbuilding",
    "Diensten voor tuinonderhoud en SEO",
  ];
  const klanten = [
    ["One Day Clinic", "onedayclinic.nl"],
    ["Kamsteeg", "kamsteeg.nl"],
    ["Paul Hoevenaars", "paulhoevenaars.nl"],
  ];
  const gekoppeld = echte.filter((tekst) =>
    klanten.some(([naam, domein]) => noemtKlant(tekst, sleutel(naam), sleutel(domein))),
  );
  check("een factuurregel zonder klantnaam koppelt aan niemand", gekoppeld.length, 0);
  // En andersom: zodra de leverancier de klant er wél bij zet, moet het meteen
  // werken zonder dat er iets aan de code hoeft te veranderen.
  check(
    "met een klantnaam erbij koppelt hij wel",
    noemtKlant("Linkbuilding februari 2026 One Day Clinic", sleutel("One Day Clinic"), sleutel("onedayclinic.nl")),
    "true",
  );
}

console.log(fouten === 0 ? "\nHet uitlezen klopt.\n" : `\n${fouten} fout(en) bij het uitlezen.\n`);
process.exit(fouten === 0 ? 0 : 1);
