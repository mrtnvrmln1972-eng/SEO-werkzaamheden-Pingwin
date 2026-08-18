// ═══════════════════════════════════════════════════════════
// VELDNAMEN GELIJKTREKKEN (één plek, onderaan de stapel)
// ═══════════════════════════════════════════════════════════
// Aangeleverd materiaal noemt hetzelfde ding elke keer anders. Dit bestand
// vertaalt elke schrijfwijze naar één vaste naam. Het staat los van de
// kennisbank omdat de JSON-LD-lezer het óók nodig heeft; stond het daar, dan
// verwezen die twee naar elkaar in een kringetje.
// ═══════════════════════════════════════════════════════════

// ─── Veldnamen gelijktrekken (weergave-laag, dus ook voor bestaande gegevens) ───
// Aangeleverd materiaal noemt hetzelfde ding elke keer anders: "adres", "straat",
// "bezoekadres", "vestigingsadres", of "openingstijden", "openingsuren", "tijden".
// Zonder gelijktrekken staat een locatie mét adres tóch als "adres ontbreekt" in
// het rode lijstje. Daarom vertalen we elke veldnaam naar één vaste naam, en doen
// we dat bij het uitlezen: bestaande entiteiten profiteren er direct van.
const VELD_ALIASSEN: Record<string, string> = {
  adres: "adres", straat: "adres", straatnaam: "adres", straatenhuisnummer: "adres", bezoekadres: "adres",
  vestigingsadres: "adres", locatieadres: "adres", praktijkadres: "adres", address: "adres", streetaddress: "adres", street: "adres",
  postcode: "postcode", postalcode: "postcode", zipcode: "postcode", zip: "postcode",
  plaats: "plaats", stad: "plaats", woonplaats: "plaats", vestigingsplaats: "plaats", city: "plaats", locality: "plaats",
  telefoon: "telefoon", telefoonnummer: "telefoon", tel: "telefoon", telnr: "telefoon", phone: "telefoon", telephone: "telefoon",
  email: "email", emailadres: "email", mail: "email", mailadres: "email",
  openingstijden: "openingstijden", openingstijd: "openingstijden", openingsuren: "openingstijden", openingsdagen: "openingstijden",
  tijden: "openingstijden", bereikbaarheid: "openingstijden", spreekuur: "openingstijden", spreekuren: "openingstijden",
  openinghours: "openingstijden", openinghoursspecification: "openingstijden",
  big: "big", bignummer: "big", bignr: "big", bigregistratie: "big", bigregistratienummer: "big",
  linkedin: "linkedin", linkedinurl: "linkedin", linkedinprofiel: "linkedin",
  profielurl: "profielUrl", profiel: "profielUrl", profielpagina: "profielUrl", website: "profielUrl",
  webpagina: "profielUrl", url: "profielUrl", link: "profielUrl", pagina: "profielUrl",
  functie: "functie", rol: "functie", titel: "functie", beroep: "functie",
  specialisatie: "specialisatie", specialisme: "specialisatie", specialisaties: "specialisatie",
  specialismen: "specialisatie", aandachtsgebied: "specialisatie", expertise: "specialisatie",
  omschrijving: "omschrijving", beschrijving: "omschrijving", description: "omschrijving", toelichting: "omschrijving",
  howperformed: "omschrijving", uitvoering: "omschrijving", werkwijze: "omschrijving",
  foto: "foto", fotourl: "foto", afbeelding: "foto", image: "foto", photo: "foto",
  kvk: "kvk", kvknummer: "kvk", btw: "btw", btwnummer: "btw", btwid: "btw",
  logo: "logo", logourl: "logo", oprichtingsjaar: "oprichtingsjaar", opgericht: "oprichtingsjaar",
  maps: "mapsUrl", mapsurl: "mapsUrl", googlemaps: "mapsUrl", googlebusiness: "mapsUrl", googlemapslink: "mapsUrl",
};

function canoniek(naam: string): string {
  const kaal = String(naam || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return VELD_ALIASSEN[kaal] || String(naam || "").trim();
}

// Velden gelijktrekken en losse adresdelen samenvoegen tot één "adres".
export function normaliseerVelden(velden: Record<string, string>): Record<string, string> {
  const uit: Record<string, string> = {};
  const los: Record<string, string> = {};
  for (const [k, v] of Object.entries(velden || {})) {
    const waarde = String(v ?? "").trim();
    if (!waarde) continue;
    const c = canoniek(k);
    // Een los "straat"-veld is een adresdeel; samen met postcode en plaats vormt
    // dat het volledige adres, maar het blijft ook als eigen veld bewaard.
    if (/^(straat|straatnaam|street|streetaddress)$/i.test(k.replace(/[^a-z]/gi, ""))) los.straat = waarde;
    if (c === "postcode") los.postcode = waarde;
    if (c === "plaats") los.plaats = waarde;
    if (uit[c] && uit[c] !== waarde) { if (!uit[c].includes(waarde)) uit[c] = `${uit[c]}, ${waarde}`; }
    else uit[c] = waarde;
  }
  if (!uit.adres && (los.straat || los.plaats)) {
    uit.adres = [los.straat, [los.postcode, los.plaats].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  }
  return uit;
}

/** Twee namen die alleen in hoofdletters of spaties verschillen zijn hetzelfde. */
export const sleutel = (s: string) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
