// ═══════════════════════════════════════════════════════════
// EEN SCHEMA-BESTAND (JSON-LD) EXACT INLEZEN
// ═══════════════════════════════════════════════════════════
// Apart van de kennisbank omdat het een eigen onderwerp is met eigen regels, en
// omdat lib/schema-knowledge.ts anders over de duizend regels gaat (zie de
// bestandsmaat-proef: opknippen, niet de grens verhogen).
// ═══════════════════════════════════════════════════════════

import { normaliseerVelden, sleutel } from "./veld-namen";
import { identiteit } from "./org-vereist";

/** Eén gestructureerd gegeven zoals het uit een aanlevering komt. */
export type AangeleverdeEntiteit = {
  categorie: string; naam: string; velden: Record<string, string>;
  oordeel: "nieuw" | "aanvulling" | "ouder";
};

// ─── Een JSON-LD-bestand exact inlezen (geen AI) ───
// Een aangeleverd schema-bestand ÍS al gestructureerde data. Dat door een model
// laten samenvatten is niet alleen verspilling, het verliest ook gegevens: juist
// de geneste stukken (sameAs-lijst, BIG-nummer in identifier, adres, tijden per
// dag) sneuvelden. Daarom lezen we zo'n bestand regel voor regel uit; wat erin
// staat komt erin, niets meer en niets minder.

type LdNode = Record<string, unknown>;
const DAG_KORT: Record<string, string> = {
  monday: "ma", tuesday: "di", wednesday: "wo", thursday: "do", friday: "vr", saturday: "za", sunday: "zo",
};
const DAG_VOLGORDE = ["ma", "di", "wo", "do", "vr", "za", "zo"];

function ldTypes(n: LdNode): string[] {
  const t = n["@type"];
  return (Array.isArray(t) ? t : [t]).map((x) => String(x || "")).filter(Boolean);
}
function ldTekst(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v).trim();
  if (Array.isArray(v)) return v.map(ldTekst).filter(Boolean).join(", ");
  const o = v as LdNode;
  return String(o.name || o.url || o.value || o.telephone || o.email || "").trim();
}
function ldUrls(v: unknown): string[] {
  return ldTekst(v).split(/[\s,;]+/).filter((s) => /^https?:\/\//i.test(s));
}
// identifier: {propertyID: "BIG-register", value: "…"} → de waarde bij een label.
function ldIdentifier(n: LdNode, zoek: RegExp): string {
  const lijst = Array.isArray(n.identifier) ? n.identifier : n.identifier ? [n.identifier] : [];
  for (const i of lijst as LdNode[]) {
    if (i && typeof i === "object" && zoek.test(String(i.propertyID || i.name || ""))) return ldTekst(i.value);
  }
  return "";
}
function ldAdres(n: LdNode): { adres: string; postcode: string; plaats: string } {
  const a = (n.address && typeof n.address === "object" ? n.address : {}) as LdNode;
  return { adres: ldTekst(a.streetAddress), postcode: ldTekst(a.postalCode), plaats: ldTekst(a.addressLocality) };
}
// openingHoursSpecification → leesbare regel, opeenvolgende gelijke dagen samen:
// "ma 12:00-20:00, di t/m vr 09:00-17:00, za 09:00-12:00".
function ldOpeningstijden(n: LdNode): string {
  const spec = Array.isArray(n.openingHoursSpecification) ? n.openingHoursSpecification : n.openingHoursSpecification ? [n.openingHoursSpecification] : [];
  const perDag = new Map<string, string>();
  for (const s of spec as LdNode[]) {
    const dagen = Array.isArray(s.dayOfWeek) ? s.dayOfWeek : [s.dayOfWeek];
    const tijd = `${ldTekst(s.opens)}-${ldTekst(s.closes)}`;
    if (tijd === "-") continue;
    for (const d of dagen) {
      const kort = DAG_KORT[String(d || "").toLowerCase().replace(/^https?:\/\/schema\.org\//, "").toLowerCase()];
      if (kort) perDag.set(kort, tijd);
    }
  }
  if (!perDag.size) return ldTekst(n.openingHours);
  const stukken: string[] = [];
  let start = "", vorige = "", tijd = "";
  for (const dag of DAG_VOLGORDE) {
    const t = perDag.get(dag);
    if (t && t === tijd) { vorige = dag; continue; }
    if (start) stukken.push(vorige && vorige !== start ? `${start} t/m ${vorige} ${tijd}` : `${start} ${tijd}`);
    start = t ? dag : ""; vorige = t ? dag : ""; tijd = t || "";
  }
  if (start) stukken.push(vorige && vorige !== start ? `${start} t/m ${vorige} ${tijd}` : `${start} ${tijd}`);
  return stukken.join(", ");
}

function schoon(velden: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(velden).filter(([, v]) => String(v || "").trim()));
}

export function entiteitenUitJsonLd(tekst: string): { samenvatting: string; entiteiten: AangeleverdeEntiteit[] } | null {
  let data: unknown;
  try { data = JSON.parse(tekst); } catch { return null; }
  const wortel = (Array.isArray(data) ? data : [data]) as LdNode[];
  const nodes: LdNode[] = [];
  for (const w of wortel) {
    if (!w || typeof w !== "object") continue;
    const graph = w["@graph"];
    if (Array.isArray(graph)) nodes.push(...(graph as LdNode[]));
    else nodes.push(w);
  }
  if (!nodes.length || !nodes.some((n) => ldTypes(n).length)) return null;

  const entiteiten: AangeleverdeEntiteit[] = [];
  const tel = { organisatie: 0, persoon: 0, locatie: 0, dienst: 0 };
  for (const n of nodes) {
    const types = ldTypes(n);
    const naam = ldTekst(n.name);
    if (!naam || types.includes("WebSite")) continue;
    const isPersoon = types.some((t) => /^(Person|Physician|MedicalDoctor|Nurse)$/i.test(t));
    const isBedrijf = types.some((t) => /(Organization|Clinic|LocalBusiness|Hospital|Store|Dentist|Pharmacy)/i.test(t));
    const isDienst = types.some((t) => /(Procedure|Service|Product|Offer|MedicalTest|MedicalTherapy)/i.test(t));
    const adres = ldAdres(n);
    const contact = (n.contactPoint && typeof n.contactPoint === "object" ? n.contactPoint : {}) as LdNode;

    if (isPersoon) {
      const links = ldUrls(n.sameAs);
      const werkt = (Array.isArray(n.affiliation) ? n.affiliation : n.affiliation ? [n.affiliation] : []) as LdNode[];
      entiteiten.push({
        categorie: "persoon", naam, oordeel: "nieuw",
        velden: schoon({
          functie: ldTekst(n.jobTitle),
          specialisatie: ldTekst(n.medicalSpecialty),
          big: ldIdentifier(n, /BIG/i),
          linkedin: links.find((u) => /linkedin/i.test(u)) || "",
          profielUrl: links.find((u) => !/linkedin/i.test(u)) || links[0] || "",
          foto: ldTekst(n.image),
          vestigingen: werkt.map((a) => ldTekst(a.name)).filter(Boolean).join(", "),
        }),
      });
      tel.persoon++;
    } else if (isBedrijf && adres.adres) {
      // Een bedrijfsnode MÉT adres is een vestiging.
      entiteiten.push({
        categorie: "locatie", naam, oordeel: "nieuw",
        velden: schoon({
          adres: adres.adres, postcode: adres.postcode, plaats: adres.plaats,
          telefoon: ldTekst(n.telephone) || ldTekst(contact.telephone),
          email: ldTekst(n.email) || ldTekst(contact.email),
          openingstijden: ldOpeningstijden(n),
          profielUrl: ldTekst(n.url), omschrijving: ldTekst(n.description),
        }),
      });
      tel.locatie++;
    } else if (isBedrijf) {
      // Zonder adres: de overkoepelende organisatie (of een verzamelnode).
      const socials = [...ldUrls(n.sameAs)];
      entiteiten.push({
        categorie: "organisatie", naam, oordeel: "nieuw",
        velden: schoon({
          bedrijfstype: types.some((t) => /Medical|Clinic|Hospital|Dentist|Pharmacy/i.test(t)) ? "kliniek" : "",
          telefoon: ldTekst(n.telephone) || ldTekst(contact.telephone),
          email: ldTekst(n.email) || ldTekst(contact.email),
          kvk: ldIdentifier(n, /KVK|KvK/i), btw: ldIdentifier(n, /BTW|VAT/i),
          logo: ldTekst(n.logo) || ldTekst(n.image),
          oprichtingsjaar: ldTekst(n.foundingDate),
          priceRange: ldTekst(n.priceRange),
          areaServed: ldTekst(n.areaServed),
          openingstijden: ldOpeningstijden(n),
          sameAs: socials.join(", "),
          omschrijving: ldTekst(n.description),
        }),
      });
      tel.organisatie++;
    } else if (isDienst) {
      entiteiten.push({
        categorie: "dienst", naam, oordeel: "nieuw",
        velden: schoon({
          omschrijving: ldTekst(n.description) || ldTekst(n.howPerformed),
          profielUrl: ldTekst(n.url),
        }),
      });
      tel.dienst++;
    }
  }
  if (!entiteiten.length) return null;
  // Eén bestand beschrijft hetzelfde bedrijf soms in meerdere nodes (organisatie,
  // kliniek, koepel). Die horen één regel te worden, anders staat dezelfde naam
  // straks dubbel in de kennisbank.
  const samengevoegd: AangeleverdeEntiteit[] = [];
  const index = new Map<string, number>();
  for (const e of entiteiten) {
    const k = identiteit(e.categorie, e.naam, e.velden);
    const bestaat = index.get(k);
    if (bestaat === undefined) { index.set(k, samengevoegd.length); samengevoegd.push(e); continue; }
    const doel = samengevoegd[bestaat];
    // Twee nodes uit hetzelfde bestand: er is geen ouder of nieuwer, dus alleen
    // aanvullen wat nog leeg is. De eerste vermelding blijft leidend.
    for (const [veld, ruw] of Object.entries(e.velden || {})) {
      const waarde = String(ruw || "").trim();
      if (waarde && !String(doel.velden[veld] || "").trim()) doel.velden[veld] = waarde;
    }
    if (e.naam.length > doel.naam.length) doel.naam = e.naam;
  }
  entiteiten.length = 0; entiteiten.push(...samengevoegd);
  for (const k of Object.keys(tel) as (keyof typeof tel)[]) tel[k] = entiteiten.filter((e) => e.categorie === k).length;
  const delen = [
    tel.organisatie ? `${tel.organisatie} organisatie${tel.organisatie === 1 ? "" : "s"}` : "",
    tel.locatie ? `${tel.locatie} vestiging${tel.locatie === 1 ? "" : "en"}` : "",
    tel.persoon ? `${tel.persoon} perso${tel.persoon === 1 ? "on" : "nen"}` : "",
    tel.dienst ? `${tel.dienst} dienst${tel.dienst === 1 ? "" : "en"}` : "",
  ].filter(Boolean);
  return {
    samenvatting: `Een schema-bestand (JSON-LD), letterlijk ingelezen: ${delen.join(", ")}. Er is niets geïnterpreteerd of aangevuld; alleen wat er in het bestand staat.`,
    entiteiten,
  };
}
