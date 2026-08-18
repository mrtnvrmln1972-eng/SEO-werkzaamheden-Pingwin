// ═══════════════════════════════════════════════════════════
// EEN AANLEVERING LANDT OP DE BESTAANDE REGEL, NIET ERNAAST
// ═══════════════════════════════════════════════════════════
// Op 18 augustus 2026 leverde een schermafdruk met de openingstijden van tien
// vestigingen precies niets op, terwijl alles goed werd gelezen. De reden: zo'n
// afdruk noemt per vestiging alleen de naam en de tijden. Een bestaande vestiging
// wordt herkend aan postcode plus huisnummer, dus de aanlevering kwam als tien
// nieuwe, adresloze regels naast de bestaande te staan. En een regel zonder
// bezoekadres telt niet als vestiging, dus die tijden kwamen nergens aan.
//
// Deze proef legt de koppelregel vast: zonder eigen adres mag er op naam
// gekoppeld worden, mét eigen adres nooit, en bij twee naamgenoten ook niet.

import { koppelSleutel, type KennisEntiteit } from "../lib/schema-knowledge";
import { identiteit, magOpNaamKoppelen } from "../lib/org-vereist";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

const maak = (categorie: string, naam: string, velden: Record<string, string>): KennisEntiteit =>
  ({ id: 1, categorie, naam, velden, bron: "", updatedAt: "", stempels: {} });

function register(items: KennisEntiteit[]): Map<string, KennisEntiteit> {
  const m = new Map<string, KennisEntiteit>();
  for (const e of items) {
    const k = identiteit(e.categorie, e.naam, e.velden);
    if (!m.has(k)) m.set(k, e);
  }
  return m;
}

// ── Het echte geval: openingstijden per vestiging, verder niets ──
const maastricht = maak("locatie", "Loods 5 Maastricht", { adres: "Sphinxcour 5", postcode: "6211 XZ", plaats: "Maastricht" });
const zaandam = maak("locatie", "Loods 5 Zaandam", { adres: "Pieter Ghijsenlaan 14", postcode: "1506 PV", plaats: "Zaandam" });
const bestaand = register([maastricht, zaandam]);
const sleutelMaastricht = identiteit("locatie", maastricht.naam, maastricht.velden);

const uitAfdruk = koppelSleutel(bestaand, "locatie", "Loods 5 Maastricht", { openingstijden: "ma 11:00-17:30" });
proef("openingstijden zonder adres landen op de bestaande vestiging",
  uitAfdruk === sleutelMaastricht,
  "Zonder deze koppeling ontstaat er een tweede, adresloze regel, en die telt nergens mee omdat een vestiging een bezoekadres nodig heeft.");

// ── Draagt de aanlevering wél een adres, dan gokken we niet op de naam ──
const anderAdres = koppelSleutel(bestaand, "locatie", "Loods 5 Maastricht", { adres: "Andere weg 99", postcode: "1234 AB" });
proef("een aanlevering mét eigen adres wordt niet op naam samengevoegd",
  anderAdres !== sleutelMaastricht,
  "Dat zou twee verschillende vestigingen van dezelfde keten in elkaar schuiven.");

// ── Twee naamgenoten: dan is de naam geen bewijs meer ──
const tweeGelijk = register([
  maak("locatie", "Showroom", { adres: "Straat 1", postcode: "1111 AA" }),
  maak("locatie", "Showroom", { adres: "Weg 2", postcode: "2222 BB" }),
]);
const bijTwee = koppelSleutel(tweeGelijk, "locatie", "Showroom", { openingstijden: "ma-vr 9-17" });
proef("bij twee vestigingen met dezelfde naam wordt er niet gegokt",
  ![...tweeGelijk.keys()].includes(bijTwee),
  "Liever een losse regel die je ziet dan een stille samenvoeging bij de verkeerde vestiging.");

// ── Personen: hetzelfde, maar dan op BIG-nummer ──
proef("een persoon zonder BIG-nummer mag op naam koppelen", magOpNaamKoppelen("persoon", { functie: "opticien" }));
proef("een persoon mét BIG-nummer niet", !magOpNaamKoppelen("persoon", { big: "12345678901" }));
proef("een vestiging met bezoekadres niet", !magOpNaamKoppelen("locatie", { adres: "Straat 12", postcode: "1000 AA" }));
proef("een vestiging zonder bezoekadres wel", magOpNaamKoppelen("locatie", { openingstijden: "ma-vr 9-17" }));

// ── Een naamloze aanlevering hangt nergens aan vast ──
proef("zonder naam en zonder adres blijft het een eigen regel",
  koppelSleutel(bestaand, "locatie", "", { openingstijden: "ma-vr 9-17" }) === identiteit("locatie", "", {}));

console.log(fouten === 0 ? "\nAlles goed: een aanlevering vindt zijn eigen regel terug." : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);
