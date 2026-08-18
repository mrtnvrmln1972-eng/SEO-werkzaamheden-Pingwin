// ═══════════════════════════════════════════════════════════
// WAT IS NODIG EN WAT MIST NOG (één bron voor scherm en lijstje)
// ═══════════════════════════════════════════════════════════
// Eén plek bepaalt welke bedrijfsgegevens nodig zijn voor de structured data en
// welke daarvan nog leeg zijn. Het formulier gebruikt dit om die velden ROOD te
// tonen (dus wél zichtbaar, met de melding dat ze ontbreken) en de kennisbank
// gebruikt exact dezelfde uitkomst voor het rode lijstje "Nog aan te leveren".
// Zo kan het scherm nooit iets anders beweren dan het lijstje.
// Geen database, geen server-code: dit bestand draait ook in de browser.
// ═══════════════════════════════════════════════════════════

export type OrgVestiging = {
  naam: string; straat: string; postcode: string; plaats: string;
  telefoon: string; email: string; openingstijden: string; mapsUrl: string;
};

export const LEGE_VESTIGING: OrgVestiging = {
  naam: "", straat: "", postcode: "", plaats: "", telefoon: "", email: "", openingstijden: "", mapsUrl: "",
};

// De velden die dit bestand nodig heeft; zowel OrgData (server) als OrgFormData
// (browser) voldoen hieraan.
export type OrgVeldenBron = {
  bedrijfsnaam: string; bedrijfstype: string; kvk: string; telefoon: string; email: string;
  straat: string; postcode: string; plaats: string; geenBezoekadres: boolean;
  openingstijden: string; logoUrl: string; sameAs: string[]; areaServed: string[];
  retourUrl: string; retourTermijn: string;
  vestigingen: OrgVestiging[];
  artsen: { naam: string; functie: string; specialisatie: string; big: string; fotoUrl: string; profielUrl: string }[];
  diensten: { naam: string; omschrijving: string }[];
};

export type Ontbrekend = {
  key: string;      // "kvk", "vestiging.2.openingstijden", "arts.0.big"
  label: string;    // korte naam van het veld, voor in het formulier
  regel: string;    // hele zin, voor het lijstje "Nog aan te leveren"
  hard: boolean;    // true = het bedrijf is zonder dit veld niet te identificeren
  naam?: string;    // bij wie (vestiging/arts/dienst), voor het groeperen per veldtype
};

// ── Moet en mooi-meegenomen ────────────────────────────────────────────────
// Dit lijstje is twee dingen tegelijk, en dat ging mis. Voor het formulier is
// het een perfectielijstje: alles wat de structured data rijker maakt hoort
// rood te kleuren, tot de LinkedIn-link van de derde arts aan toe. Voor de
// onboarding is het een startpoort: mag er gemeten worden bij deze klant?
//
// Bij One Day Clinic stonden 7 vestigingen, 14 artsen, 13 diensten, KvK, logo en
// 4 sociale profielen ingevuld, en tóch zei de onboarding "bedrijfsgegevens: nog
// te doen". Reden: drie ontbrekende profielpagina's van artsen wogen even zwaar
// als een ontbrekend KvK-nummer. Dat is geen ontbrekende inventarisatie, dat is
// een aanvulling.
//
// Vandaar het onderscheid. HARD = zonder dit veld weet Google (en weten wij) niet
// wélk bedrijf dit is of waar het zit: naam, type, KvK, telefoon, e-mail, adres
// of werkgebied, openingstijden. ZACHT = alles wat het verhaal rijker maakt maar
// niets blokkeert: logo, sociale profielen, credentials per persoon,
// dienstomschrijvingen, retourbeleid.
//
// Het formulier blijft ALLES tonen, precies zoals nu. Alleen de poort voor de
// scans kijkt naar de harde velden.
const leeg = (v: unknown) => !String(v ?? "").trim();

// Alles wat nodig is voor de structured data en nu nog niet ingevuld staat.
export function ontbrekendeVelden(d: OrgVeldenBron): Ontbrekend[] {
  const uit: Ontbrekend[] = [];
  const mis = (key: string, label: string, regel: string, hard = true, naam?: string) => uit.push({ key, label, regel, hard, naam });

  // ── Basis: de bouwstenen van het site-brede identiteitsblok ──
  if (leeg(d.bedrijfsnaam)) mis("bedrijfsnaam", "Bedrijfsnaam", "Bedrijfsnaam ontbreekt.");
  if (leeg(d.bedrijfstype)) mis("bedrijfstype", "Bedrijfstype", "Bedrijfstype (kliniek, webshop, dienstverlener, lokaal of informatief) is nog niet gekozen.");
  if (leeg(d.kvk)) mis("kvk", "KVK-nummer", "KvK-nummer ontbreekt.");
  if (leeg(d.telefoon)) mis("telefoon", "Telefoon", "Telefoonnummer ontbreekt.");
  if (leeg(d.email)) mis("email", "E-mail", "Algemeen e-mailadres ontbreekt.");
  if (leeg(d.logoUrl)) mis("logoUrl", "Logo-URL", "Logo-URL ontbreekt.", false);
  if (!d.sameAs?.length) mis("sameAs", "Sociale profielen", "Social/profiel-links (sameAs) ontbreken, bijv. LinkedIn of Facebook van het bedrijf.", false);

  const vestigingen = (d.vestigingen || []).filter((v) => !leeg(v?.naam) || !leeg(v?.straat) || !leeg(v?.plaats));
  const heeftVestigingen = vestigingen.length > 0;

  // Hoofdadres: alleen nodig als er géén vestigingenlijst is en het bedrijf een
  // bezoekadres heeft. Met meerdere vestigingen zijn die de adressen.
  if (!d.geenBezoekadres && !heeftVestigingen) {
    if (leeg(d.straat)) mis("straat", "Straat + huisnummer", "Bezoekadres ontbreekt (of vink 'geen bezoekadres' aan, of vul de vestigingen in).");
    if (leeg(d.postcode)) mis("postcode", "Postcode", "Postcode van het bezoekadres ontbreekt.");
    if (leeg(d.plaats)) mis("plaats", "Plaats", "Plaats van het bezoekadres ontbreekt.");
  }
  if (d.geenBezoekadres && !d.areaServed?.length) {
    mis("areaServed", "Werkgebied", "Werkgebied ontbreekt; zonder bezoekadres is dat de plaatsbepaling voor Google.");
  }
  // Openingstijden: bij één locatie op bedrijfsniveau, bij meerdere per vestiging.
  const tijdenNodig = d.bedrijfstype === "kliniek" || d.bedrijfstype === "lokaal" || (!d.geenBezoekadres && !!d.bedrijfstype);
  if (tijdenNodig && !heeftVestigingen && leeg(d.openingstijden)) {
    mis("openingstijden", "Openingstijden", "Openingstijden ontbreken.");
  }

  // ── Vestigingen: zonder adres en tijden geen vermelding per locatie ──
  vestigingen.forEach((v, i) => {
    const naam = v.naam?.trim() || v.plaats?.trim() || `vestiging ${i + 1}`;
    // Een locatie zonder bezoekadres (geen huisnummer, geen postcode) is nog
    // geen vestiging maar een genoemde plaats. Die levert één regel op in plaats
    // van vier; anders verzuipt het lijstje in dezelfde melding per veld.
    const heeftBezoekadres = /\d/.test(v.straat || "") || !leeg(v.postcode);
    if (!heeftBezoekadres && leeg(v.openingstijden)) {
      mis(`vestiging.${i}.straat`, "Adres en openingstijden", `Vestiging ${naam}: hiervan is alleen de naam bekend, adres en openingstijden ontbreken nog.`, true, naam);
      return;
    }
    if (leeg(v.straat)) mis(`vestiging.${i}.straat`, "Straat + huisnummer", `Vestiging ${naam}: straat en huisnummer ontbreken.`, true, naam);
    if (leeg(v.postcode)) mis(`vestiging.${i}.postcode`, "Postcode", `Vestiging ${naam}: postcode ontbreekt.`, true, naam);
    if (leeg(v.plaats)) mis(`vestiging.${i}.plaats`, "Plaats", `Vestiging ${naam}: plaats ontbreekt.`, true, naam);
    if (leeg(v.openingstijden)) mis(`vestiging.${i}.openingstijden`, "Openingstijden", `Vestiging ${naam}: openingstijden ontbreken.`, true, naam);
    if (leeg(v.telefoon) && leeg(d.telefoon)) mis(`vestiging.${i}.telefoon`, "Telefoon", `Vestiging ${naam}: telefoonnummer ontbreekt.`, false, naam);
  });

  // ── Artsen en behandelaren (kliniek): credentials dragen het E-E-A-T-verhaal ──
  const artsen = (d.artsen || []).filter((a) => !leeg(a?.naam));
  if (d.bedrijfstype === "kliniek") {
    if (!artsen.length) mis("artsen", "Artsen en behandelaren", "Nog geen artsen of behandelaars aangeleverd (naam, functie, BIG-nummer, profielpagina).");
    // Per persoon zijn dit aanvullingen, geen blokkades: de kliniek is met veertien
    // artsen op naam prima geïdentificeerd, ook als er drie LinkedIn-links missen.
    artsen.forEach((a, i) => {
      if (leeg(a.functie)) mis(`arts.${i}.functie`, "Functie", `${a.naam}: functie ontbreekt.`, false, a.naam);
      if (leeg(a.big)) mis(`arts.${i}.big`, "BIG-nummer", `${a.naam}: BIG-nummer ontbreekt.`, false, a.naam);
      if (leeg(a.profielUrl)) mis(`arts.${i}.profielUrl`, "Profielpagina", `${a.naam}: profielpagina of LinkedIn ontbreekt.`, false, a.naam);
    });
  }

  // ── Diensten en webshop ──
  (d.diensten || []).filter((s) => !leeg(s?.naam)).forEach((s, i) => {
    if (leeg(s.omschrijving)) mis(`dienst.${i}.omschrijving`, "Omschrijving", `Dienst ${s.naam}: korte omschrijving ontbreekt.`, false, s.naam);
  });
  if (d.bedrijfstype === "webshop" && leeg(d.retourUrl) && leeg(d.retourTermijn)) {
    mis("retourUrl", "Retourbeleid", "Retourinformatie ontbreekt (nodig voor product-schema).", false);
  }
  return uit;
}

/**
 * Alleen wat een klant écht onherkenbaar maakt. Dit is wat de onboarding en de
 * poort voor de scans gebruiken; het formulier gebruikt de volledige lijst.
 */
export function ontbrekendeHardeVelden(d: OrgVeldenBron): Ontbrekend[] {
  return ontbrekendeVelden(d).filter((o) => o.hard);
}

// Alleen de sleutels, handig om in het formulier snel te toetsen.
export function ontbrekendeSleutels(d: OrgVeldenBron): Set<string> {
  return new Set(ontbrekendeVelden(d).map((o) => o.key));
}

// ─── Dubbel herkennen: op identiteit, niet op letterlijke naam ───
// "Dr. Amit Atwal" en "Amit Atwal" zijn dezelfde arts; "OneDayClinic Utrecht" en
// "Utrecht (Amsterdamsestraatweg 542)" dezelfde vestiging. Vergelijken op de
// exacte naam leverde daardoor bij elke aanlevering een nieuwe regel op. Daarom
// bepalen we per gegeven een identiteit: een BIG-nummer is uniek, een adres met
// postcode en huisnummer ook; pas als die er niet zijn valt hij terug op de naam.
const TITELS = /\b(dr|drs|prof|ir|ing|mr|mevr|mw|dhr)\b\.?/gi;
const RECHTSVORMEN = /\b(b\.?v\.?|n\.?v\.?|v\.?o\.?f\.?|holding)\b/gi;
export function naamKaal(n: string): string {
  return String(n || "").toLowerCase().replace(TITELS, " ").replace(RECHTSVORMEN, " ")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
const cijfers = (s: string) => String(s || "").replace(/\D/g, "");

// Is dit een échte vestiging? Alleen een locatie met een bezoekadres telt mee.
// De structured data-lezer haalt namelijk ook plaatsen op die alléén genoemd
// worden (een testpunt, een stad in een opsomming). Dat zijn geen vestigingen
// met een balie en openingstijden, dus die horen niet in het formulier en
// mogen ook niet als "adres ontbreekt" in het rode lijstje verschijnen.
// De toets: er staat een huisnummer in het adres, of er is een postcode.
export function isEchteVestiging(velden: Record<string, string>): boolean {
  const adres = String(velden?.adres || "").trim();
  const postcode = String(velden?.postcode || "").trim();
  if (!adres) return false;
  return /\d/.test(adres) || !!postcode;
}

/**
 * Mag dit aangeleverde gegeven op naam aan een bestaande regel gekoppeld worden?
 *
 * Ja, zolang het stuk zelf niets draagt waarmee we het hárd kunnen herkennen.
 * Een schermafdruk met alleen openingstijden per vestiging noemt de vestiging bij
 * naam en verder niets: geen adres, geen postcode. De identiteit hieronder valt
 * dan terug op de naam, en die botst niet met de bestaande regel die wél een
 * adres heeft. Zonder deze uitzondering komt zo'n aanlevering als een tweede,
 * adresloze regel naast de bestaande te staan, en dan telt hij nergens meer mee.
 *
 * Draagt het stuk wél een adres of een BIG-nummer, dan is de identiteit
 * betrouwbaar en gokken we niet op de naam: twee vestigingen van dezelfde keten
 * zouden anders samenvallen.
 */
export function magOpNaamKoppelen(categorie: string, velden: Record<string, string>): boolean {
  if (categorie === "locatie") return !isEchteVestiging(velden || {});
  if (categorie === "persoon") return cijfers(velden?.big || "").length < 8;
  return true; // organisatie, dienst en overig gaan sowieso al op naam
}

export function identiteit(categorie: string, naam: string, velden: Record<string, string>): string {
  const v = velden || {};
  if (categorie === "persoon" && cijfers(v.big).length >= 8) return `persoon|big:${cijfers(v.big)}`;
  if (categorie === "locatie") {
    const pc = String(v.postcode || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const nr = (String(v.adres || "").match(/\d+\s*[a-z]?/i) || [""])[0].replace(/\s+/g, "").toLowerCase();
    if (pc && nr) return `locatie|adres:${pc}-${nr}`;
    const straat = naamKaal(v.adres || ""), plaats = naamKaal(v.plaats || "");
    if (straat && plaats) return `locatie|adres:${plaats}-${straat}`;
  }
  return `${categorie}|${naamKaal(naam) || String(naam || "").trim().toLowerCase()}`;
}
