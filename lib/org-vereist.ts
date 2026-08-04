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
};

const leeg = (v: unknown) => !String(v ?? "").trim();

// Alles wat nodig is voor de structured data en nu nog niet ingevuld staat.
export function ontbrekendeVelden(d: OrgVeldenBron): Ontbrekend[] {
  const uit: Ontbrekend[] = [];
  const mis = (key: string, label: string, regel: string) => uit.push({ key, label, regel });

  // ── Basis: de bouwstenen van het site-brede identiteitsblok ──
  if (leeg(d.bedrijfsnaam)) mis("bedrijfsnaam", "Bedrijfsnaam", "Bedrijfsnaam ontbreekt.");
  if (leeg(d.bedrijfstype)) mis("bedrijfstype", "Bedrijfstype", "Bedrijfstype (kliniek, webshop, dienstverlener, lokaal of informatief) is nog niet gekozen.");
  if (leeg(d.kvk)) mis("kvk", "KVK-nummer", "KvK-nummer ontbreekt.");
  if (leeg(d.telefoon)) mis("telefoon", "Telefoon", "Telefoonnummer ontbreekt.");
  if (leeg(d.email)) mis("email", "E-mail", "Algemeen e-mailadres ontbreekt.");
  if (leeg(d.logoUrl)) mis("logoUrl", "Logo-URL", "Logo-URL ontbreekt.");
  if (!d.sameAs?.length) mis("sameAs", "Sociale profielen", "Social/profiel-links (sameAs) ontbreken, bijv. LinkedIn of Facebook van het bedrijf.");

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
    // Een locatie waarvan we alleen de naam kennen levert één regel op in plaats
    // van vier; anders verzuipt het lijstje in dezelfde melding per veld.
    if (leeg(v.straat) && leeg(v.postcode) && leeg(v.plaats) && leeg(v.openingstijden)) {
      mis(`vestiging.${i}.straat`, "Adres en openingstijden", `Vestiging ${naam}: hiervan is alleen de naam bekend, adres en openingstijden ontbreken nog.`);
      return;
    }
    if (leeg(v.straat)) mis(`vestiging.${i}.straat`, "Straat + huisnummer", `Vestiging ${naam}: straat en huisnummer ontbreken.`);
    if (leeg(v.postcode)) mis(`vestiging.${i}.postcode`, "Postcode", `Vestiging ${naam}: postcode ontbreekt.`);
    if (leeg(v.plaats)) mis(`vestiging.${i}.plaats`, "Plaats", `Vestiging ${naam}: plaats ontbreekt.`);
    if (leeg(v.openingstijden)) mis(`vestiging.${i}.openingstijden`, "Openingstijden", `Vestiging ${naam}: openingstijden ontbreken.`);
    if (leeg(v.telefoon) && leeg(d.telefoon)) mis(`vestiging.${i}.telefoon`, "Telefoon", `Vestiging ${naam}: telefoonnummer ontbreekt.`);
  });

  // ── Artsen en behandelaren (kliniek): credentials dragen het E-E-A-T-verhaal ──
  const artsen = (d.artsen || []).filter((a) => !leeg(a?.naam));
  if (d.bedrijfstype === "kliniek") {
    if (!artsen.length) mis("artsen", "Artsen en behandelaren", "Nog geen artsen of behandelaars aangeleverd (naam, functie, BIG-nummer, profielpagina).");
    artsen.forEach((a, i) => {
      if (leeg(a.functie)) mis(`arts.${i}.functie`, "Functie", `${a.naam}: functie ontbreekt.`);
      if (leeg(a.big)) mis(`arts.${i}.big`, "BIG-nummer", `${a.naam}: BIG-nummer ontbreekt.`);
      if (leeg(a.profielUrl)) mis(`arts.${i}.profielUrl`, "Profielpagina", `${a.naam}: profielpagina of LinkedIn ontbreekt.`);
    });
  }

  // ── Diensten en webshop ──
  (d.diensten || []).filter((s) => !leeg(s?.naam)).forEach((s, i) => {
    if (leeg(s.omschrijving)) mis(`dienst.${i}.omschrijving`, "Omschrijving", `Dienst ${s.naam}: korte omschrijving ontbreekt.`);
  });
  if (d.bedrijfstype === "webshop" && leeg(d.retourUrl) && leeg(d.retourTermijn)) {
    mis("retourUrl", "Retourbeleid", "Retourinformatie ontbreekt (nodig voor product-schema).");
  }
  return uit;
}

// Alleen de sleutels, handig om in het formulier snel te toetsen.
export function ontbrekendeSleutels(d: OrgVeldenBron): Set<string> {
  return new Set(ontbrekendeVelden(d).map((o) => o.key));
}
