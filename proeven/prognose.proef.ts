// Proef op het rekenwerk achter de prognose (/admin/financien, blik "Prognose").
//
// WAAROM DIT BESTAAT
// ══════════════════
// Een verkeerd gerekende prognose ziet er precies zo uit als een goede: nette
// kolommen, plausibele bedragen, een balk die vult. Je merkt het pas als je een
// beslissing hebt genomen op een getal dat niet klopte, en dan is het te laat.
// Vier dingen gaan gegarandeerd een keer stuk als niemand ze vastlegt:
//
//  1. DE WEGING VAN EEN LEAD MOET OOK OVER DE KOSTEN. Wie alleen de omzet
//     vermenigvuldigt met de kans en de linkbuilding voor honderd procent
//     meetelt, maakt van elke koude lead een verliespost. Dan lijkt "meer leads"
//     op papier slechter, terwijl het beter is.
//  2. VASTE LASTEN TELLEN ÉÉN KEER PER MAAND. Niet per klant, niet per lead.
//     Zodra dat per regel gebeurt is de winst weg zonder dat je ziet waarom.
//  3. START- EN EINDMAAND ZIJN INCLUSIEF. Een klant die "vanaf oktober" start
//     hoort in oktober zijn eerste maand te draaien, niet in november.
//  4. EEN TERUGKERENDE POST BLIJFT TERUGKOMEN. Een tool die vanaf januari geld
//     kost, kost vanaf januari elke maand geld. Eén maand is een eenmalige post.

import {
  berekenPrognose, maandPlus, maandLabel, normMaand,
  type RegelExtra, type Post, type PrognoseInstelling,
} from "../lib/prognose";

let fouten = 0;
function check(naam: string, gekregen: unknown, verwacht: unknown) {
  const ok = String(gekregen) === String(verwacht);
  if (!ok) fouten++;
  console.log(`${ok ? "OK  " : "FOUT"} | ${naam}${ok ? "" : `\n       gekregen ${gekregen}, verwacht ${verwacht}`}`);
}

const INSTELLING: PrognoseInstelling = { target: 30000, targetOp: "netto", vasteLasten: 0, horizon: 6 };
const VANAF = "2026-08";

const klant = (slug: string, maandbudget: number, linkbuilding = 0) =>
  ({ slug, name: slug, fase: "klant", budget: { maandbudget, linkbuilding } });
const lead = (slug: string, maandbudget: number, linkbuilding = 0) =>
  ({ slug, name: slug, fase: "lead", budget: { maandbudget, linkbuilding } });

const extras = (paren: [string, Partial<RegelExtra>][]) => {
  const m = new Map<string, RegelExtra>();
  for (const [slug, p] of paren) {
    m.set(slug, { kans: 100, startMaand: null, eindMaand: null, extraKosten: 0, opmerking: "", ...p });
  }
  return m;
};

// ── De maandrekenaar zelf ──
check("een maand erbij", maandPlus("2026-08", 1), "2026-09");
check("over de jaarwisseling heen", maandPlus("2026-11", 3), "2027-02");
check("een maand eraf", maandPlus("2026-01", -1), "2025-12");
check("het label leest als een maand", maandLabel("2026-08"), "aug 26");
check("een losse maand wordt geldig gemaakt", normMaand("202610"), "2026-10");
check("maand dertien bestaat niet", normMaand("2026-13"), "null");
check("leeg blijft leeg", normMaand(""), "null");

// ── 1. Klanten tellen vol mee, leads naar kans, kosten inbegrepen ──
{
  const u = berekenPrognose(
    [klant("a", 1000, 200), lead("b", 1000, 200)],
    extras([["b", { kans: 40 }]]),
    [], INSTELLING, VANAF,
  );
  const m = u.maanden[0];
  check("de klant telt vol mee in de omzet", m.zekerOmzet, 1000);
  check("de kosten van de klant tellen vol mee", m.zekerKosten, 200);
  check("de lead telt naar zijn kans mee in de omzet", m.verwachtOmzet, 400);
  check("de kosten van de lead worden ook gewogen", m.verwachtKosten, 80);
  check("het netto klopt", m.netto, 1000 - 200 + 400 - 80);
  // De belangrijkste van allemaal: een lead met dezelfde marge als een klant
  // mag de prognose nooit omlaag trekken, hoe koud hij ook is.
  const zonder = berekenPrognose([klant("a", 1000, 200)], extras([]), [], INSTELLING, VANAF);
  check("een koude lead maakt de prognose nooit slechter", m.netto > zonder.maanden[0].netto, "true");
}

// ── 2. Vaste lasten tellen één keer per maand ──
{
  const met: PrognoseInstelling = { ...INSTELLING, vasteLasten: 2000 };
  const een = berekenPrognose([klant("a", 5000)], extras([]), [], met, VANAF);
  const drie = berekenPrognose([klant("a", 5000), klant("b", 0), klant("c", 0)], extras([]), [], met, VANAF);
  check("vaste lasten hangen aan de maand, niet aan de klant", een.maanden[0].netto, 3000);
  check("meer klanten maken de vaste lasten niet hoger", drie.maanden[0].netto, 3000);
  check("de vaste lasten zitten in de kosten", een.maanden[0].kosten, 2000);
}

// ── 3. Start- en eindmaand zijn inclusief ──
{
  const u = berekenPrognose(
    [klant("nu", 1000), lead("later", 1000), klant("stopt", 1000)],
    extras([
      ["later", { kans: 100, startMaand: "2026-10" }],
      ["stopt", { eindMaand: "2026-09" }],
    ]),
    [], INSTELLING, VANAF,
  );
  const bedrag = (i: number) => u.maanden[i].omzet;
  check("in augustus loopt de latere nog niet mee", bedrag(0), 2000);
  check("in september ook nog niet", bedrag(1), 2000);
  check("in oktober start hij, en de stopper is weg", bedrag(2), 2000);
  check("in november draait alleen wie doorloopt", bedrag(3), 2000);
  const okt = u.maanden[2].bijdragen.map((b) => b.slug).sort().join(",");
  check("in oktober zijn het de juiste twee", okt, "later,nu");
}

// ── 4. Losse posten: eenmalig tegenover terugkerend ──
{
  const posten: Post[] = [
    { id: 1, naam: "Website", soort: "omzet", maand: "2026-10", bedrag: 3000, kans: 50, herhaalt: false },
    { id: 2, naam: "Tool", soort: "kosten", maand: "2026-09", bedrag: 100, kans: 100, herhaalt: true },
  ];
  const u = berekenPrognose([], extras([]), posten, INSTELLING, VANAF);
  check("in augustus loopt er nog geen post", u.maanden[0].netto, 0);
  check("de terugkerende kostenpost start in september", u.maanden[1].netto, -100);
  check("in oktober komt de eenmalige opbrengst erbij, naar kans", u.maanden[2].netto, 3000 * 0.5 - 100);
  check("in november is de eenmalige weg, de terugkerende niet", u.maanden[3].netto, -100);
}

// ── 5. Het doel: wanneer wordt het gehaald, en waarop gemeten ──
{
  const u = berekenPrognose(
    [klant("a", 20000), lead("b", 15000)],
    extras([["b", { kans: 100, startMaand: "2026-10" }]]),
    [], { ...INSTELLING, target: 30000, targetOp: "netto" }, VANAF,
  );
  check("het doel wordt gehaald zodra de lead start", u.doelMaand, "2026-10");
  check("in augustus komt er nog 10.000 tekort", u.tekortNu, 10000);
  check("augustus haalt het doel niet", u.maanden[0].haaltDoel, "false");
  check("oktober wel", u.maanden[2].haaltDoel, "true");

  // Op omzet gemeten ligt de lat op dezelfde plek maar meet je iets anders:
  // met kosten erbij is netto lager dan omzet, dus het doel komt later.
  const opOmzet = berekenPrognose(
    [klant("a", 32000, 4000)],
    extras([]), [], { ...INSTELLING, target: 30000, targetOp: "omzet" }, VANAF,
  );
  check("op omzet gemeten telt de omzet, niet het netto", opOmzet.maanden[0].opDoel, 32000);
  check("en dan wordt het doel wél gehaald", opOmzet.maanden[0].haaltDoel, "true");
  const opNetto = berekenPrognose(
    [klant("a", 32000, 4000)],
    extras([]), [], { ...INSTELLING, target: 30000, targetOp: "netto" }, VANAF,
  );
  check("op netto gemeten niet", opNetto.maanden[0].haaltDoel, "false");
}

// ── 6. Wat er niet ingevuld is, wordt niet geraden ──
{
  const u = berekenPrognose(
    [lead("leeg", 0), lead("beoordeeld", 1000)],
    extras([["beoordeeld", { kans: 80 }]]),
    [], INSTELLING, VANAF,
  );
  const leeg = u.regels.find((r) => r.slug === "leeg");
  check("een lead zonder bedrag wordt gemeld en niet geschat", leeg?.gat, "nog geen maandbedrag ingevuld");
  check("hij telt voor niets mee", u.maanden[0].omzet, 800);
  // Een lead die nooit beoordeeld is krijgt niet stilzwijgend honderd procent:
  // dan belooft de lijn wat er nog niet getekend is.
  check("een onbeoordeelde lead staat niet op zeker", leeg?.kans, 30);
}

// ── 7. De horizon en het gemiddelde per klant ──
{
  const u = berekenPrognose(
    [klant("a", 1000, 100), klant("b", 3000, 500), lead("c", 9000)],
    extras([]), [], { ...INSTELLING, horizon: 12, target: 10000 }, VANAF,
  );
  check("de tabel loopt zo ver als ingesteld", u.maanden.length, 12);
  check("de laatste maand is een jaar verder", u.maanden[11].maand, "2027-07");
  // Het gemiddelde is bedoeld om een tekort in klanten uit te drukken, dus het
  // gaat over lopende klanten en niet over leads die nog niet getekend zijn.
  check("het gemiddelde per klant kijkt naar netto, en alleen naar klanten", u.gemiddeldPerKlant, (900 + 2500) / 2);
}

console.log(fouten === 0 ? "\nDe prognose rekent goed.\n" : `\n${fouten} fout(en) in de prognose.\n`);
process.exit(fouten === 0 ? 0 : 1);
