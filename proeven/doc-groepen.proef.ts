// ═══════════════════════════════════════════════════════════
// TWEE LOSSE STUKKEN ZIJN GEEN TWEE VERSIES
// ═══════════════════════════════════════════════════════════
// Het documentenblok vraagt "welke versie geldt?" zodra er twee documenten van
// hetzelfde soort liggen. Bij een klant die zijn tekst terugstuurt is dat de
// juiste vraag. Bij een taak met twee verschillende projecten erin is het een
// keuze die niet bestaat, en welke van de twee je ook aanvinkt, de andere lijkt
// daarmee vervallen (19-08-2026, twee blogs in één taak van GardenSwimm).
//
// Deze proef bewaakt beide kanten, want ze zijn allebei fout als ze omslaan:
// losse stukken mogen geen keuze opleveren, en echte versies moeten er wél een
// opleveren. Zonder deze proef is dat verschil een gevoel in een reguliere
// expressie.

import { zelfdeOnderwerp, groepeer, groepAantallen, documentVolgorde, onderwerpWoorden } from "../lib/doc-groepen";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

// ── De twee echte documenten uit de taak waar dit uit voortkwam ──
const A = "Natuurlijke zwemvijver in Zeeuws-Vlaanderen";
const B = "Strak natuurzwembad in IJsselstein";
proef("twee verschillende projecten zijn niet hetzelfde onderwerp", !zelfdeOnderwerp(A, B),
  `woorden A: ${onderwerpWoorden(A).join(", ")} | woorden B: ${onderwerpWoorden(B).join(", ")}`);

// ── Een klantversie hoort wél bij het origineel ──
proef("onze versie en de klantversie horen bij elkaar",
  zelfdeOnderwerp("Copy hovenier Etten-Leur", "Copy hovenier Etten-Leur (klantversie)"));
proef("een v2 hoort bij zijn origineel",
  zelfdeOnderwerp("Blauwdruk tuinontwerp Breda", "Blauwdruk tuinontwerp Breda v2"));
proef("een bestandsnaam met extensie hoort bij dezelfde naam zonder",
  zelfdeOnderwerp("copy-natuurzwembad-ijsselstein.docx", "Copy natuurzwembad IJsselstein"));
proef("het ondersteunend gemaakte stuk hoort bij het stuk waar het uit komt",
  zelfdeOnderwerp("Strak natuurzwembad in IJsselstein", "Strak natuurzwembad in IJsselstein (ondersteunend aan /natuurzwembad-aanleggen/)"));

// ── Woorden die niets over het onderwerp zeggen tellen niet mee ──
proef("alleen soortwoorden gedeeld is niet hetzelfde onderwerp",
  !zelfdeOnderwerp("Copy zwemvijver Zeeland", "Copy hovenier Oosterhout"));

// ── Bij niets bruikbaars houden we de oude situatie aan (liever te veel vragen) ──
proef("zonder bruikbare woorden vallen ze samen", zelfdeOnderwerp("copy", "document"));

// ── De groepering zelf ──
const docs = [
  { id: 1, kind: "copy", naam: A },
  { id: 2, kind: "copy", naam: B },
  { id: 3, kind: "copy", naam: `${B} (klantversie)` },
  { id: 4, kind: "blauwdruk", naam: A },
];
const groep = groepeer(docs);
const aantal = groepAantallen(docs, groep);

proef("de twee losse projecten zitten in verschillende groepen", groep[1] !== groep[2],
  JSON.stringify(groep));
proef("de klantversie zit bij zijn eigen project", groep[2] === groep[3], JSON.stringify(groep));
proef("een ander soort is altijd een andere groep", groep[1] !== groep[4], JSON.stringify(groep));
proef("het losse project vraagt geen keuze", (aantal[groep[1]] || 0) === 1, JSON.stringify(aantal));
proef("het project mét klantversie vraagt wél een keuze", (aantal[groep[2]] || 0) === 2, JSON.stringify(aantal));

// Eén document van een soort: nooit een keuze.
const alleen = [{ id: 9, kind: "copy", naam: "Copy hovenier Breda" }];
proef("één document levert nooit een keuze op", groepAantallen(alleen, groepeer(alleen))["copy#0"] === 1);

// ── De volgorde: een afgeleid stuk staat ónder zijn bron ──
// Een stuk dat uit een ander stuk voortkomt is altijd nieuwer, dus "nieuwste
// eerst" zette het bovenaan, met het inspringstreepje dat zegt "ik hoor bij het
// stuk hierboven" terwijl dat stuk eronder stond (21-08-2026).
const lijst = [
  { id: 18, kind: "structured", naam: 'Geldende versie na verwerken van "Advies v2.docx"', bronId: 14, createdAt: "2026-08-07T07:36:00.000Z" },
  { id: 14, kind: "structured", naam: "Advies v2.docx", bronId: 0, createdAt: "2026-08-07T07:24:00.000Z" },
  { id: 3, kind: "copy", naam: "Copy hovenier Breda", bronId: 0, createdAt: "2026-08-06T10:00:00.000Z" },
];
const volgorde = documentVolgorde(lijst, groepeer(lijst)).map((d) => d.id);
proef("de copy staat vóór de structured data", volgorde.indexOf(3) === 0, JSON.stringify(volgorde));
proef("de bron staat boven zijn verwerkte kopie", volgorde.indexOf(14) < volgorde.indexOf(18), JSON.stringify(volgorde));
proef("er raakt geen document zoek in de volgorde", volgorde.length === 3, JSON.stringify(volgorde));
// Een afgeleide waarvan de bron niet in de lijst staat, hoort er gewoon te blijven.
const wees = [{ id: 5, kind: "copy", naam: "Los stuk", bronId: 99, createdAt: "2026-08-06T10:00:00.000Z" }];
proef("een afgeleide zonder bron in beeld blijft staan", documentVolgorde(wees, groepeer(wees)).length === 1);

console.log(fouten === 0 ? "\nAlles goed." : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
