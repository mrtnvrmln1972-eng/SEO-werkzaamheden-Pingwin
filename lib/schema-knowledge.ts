import { sql, ensureSchema } from "./db";
import { getOrgData, saveOrgData, type OrgData } from "./org-data";
import { ontbrekendeVelden, LEGE_VESTIGING, type OrgVestiging } from "./org-vereist";
import { callClaude } from "./anthropic";

// ═══════════════════════════════════════════════════════════
// STRUCTURED DATA-KENNISBANK PER KLANT (Klant-tab)
// ═══════════════════════════════════════════════════════════
// De centrale verzamelbak: Maarten dropt er alles in (documenten, gegevens over
// artsen/opto's met BIG en LinkedIn, bestaande schema-code) en het dashboard
// structureert dat tot entiteiten: organisatie, personen, locaties, diensten.
// Append-only: bevestigde entiteiten vervangen hun voorganger als "actueel",
// maar de oude rij blijft bewaard (status "vervangen"). Een drop is eerst een
// VOORSTEL; pas na Maartens klik op "Verwerk" wordt de kennisbank bijgewerkt.
// De kennisbank is dé bron voor alle structured data van de klant, en het rode
// lijstje "Nog aan te leveren" toont wat er voor dit soort bedrijf nog mist.
// ═══════════════════════════════════════════════════════════

export const KENNIS_CATEGORIEEN = ["organisatie", "persoon", "locatie", "dienst", "overig"] as const;
export const CAT_LABEL: Record<string, string> = { organisatie: "Organisatie", persoon: "Personen", locatie: "Locaties", dienst: "Diensten", overig: "Overig" };

export type KennisEntiteit = { id: number; categorie: string; naam: string; velden: Record<string, string>; bron: string; updatedAt: string };
export type KennisVoorstel = {
  id: number; bron: string; samenvatting: string;
  entiteiten: { categorie: string; naam: string; velden: Record<string, string>; oordeel: "nieuw" | "aanvulling" | "ouder" }[];
};

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

// ─── Dubbel herkennen: op identiteit, niet op letterlijke naam ───
// "Dr. Amit Atwal" en "Amit Atwal" zijn dezelfde arts; "OneDayClinic Utrecht" en
// "Utrecht (Amsterdamsestraatweg 542)" dezelfde vestiging. Vergelijken op de
// exacte naam leverde daardoor bij elke aanlevering een nieuwe regel op. Daarom
// bepalen we per gegeven een identiteit: een BIG-nummer is uniek, een adres met
// postcode en huisnummer ook; pas als die er niet zijn valt hij terug op de naam.
const TITELS = /\b(dr|drs|prof|ir|ing|mr|mevr|mw|dhr)\b\.?/gi;
const RECHTSVORMEN = /\b(b\.?v\.?|n\.?v\.?|v\.?o\.?f\.?|holding)\b/gi;
function naamKaal(n: string): string {
  return String(n || "").toLowerCase().replace(TITELS, " ").replace(RECHTSVORMEN, " ")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
const cijfers = (s: string) => String(s || "").replace(/\D/g, "");

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

// Velden samenvoegen. Bij "ouder" materiaal vullen we alleen lege plekken aan,
// zodat verouderde gegevens nooit een nieuwere waarde overschrijven.
function voegVeldenSamen(bestaand: Record<string, string>, nieuw: Record<string, string>, ouder: boolean): Record<string, string> {
  const uit = { ...(bestaand || {}) };
  for (const [k, v] of Object.entries(nieuw || {})) {
    const waarde = String(v || "").trim();
    if (!waarde) continue;
    if (ouder && String(uit[k] || "").trim()) continue;
    uit[k] = waarde;
  }
  return uit;
}

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_schema_knowledge (
      id          SERIAL PRIMARY KEY,
      client_slug TEXT NOT NULL,
      soort       TEXT NOT NULL DEFAULT 'entiteit',
      categorie   TEXT,
      naam        TEXT,
      velden      JSONB,
      bron        TEXT,
      samenvatting TEXT,
      status      TEXT NOT NULL DEFAULT 'actueel',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_csk_slug ON client_schema_knowledge (client_slug, status)`;
}

export async function listKnowledge(slug: string): Promise<KennisEntiteit[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT id, categorie, naam, velden, bron, created_at FROM client_schema_knowledge
    WHERE client_slug = ${slug} AND soort = 'entiteit' AND status = 'actueel'
    ORDER BY categorie, naam`;
  return rows.map((r) => ({
    id: r.id as number, categorie: (r.categorie as string) || "overig", naam: (r.naam as string) || "",
    velden: normaliseerVelden((r.velden as Record<string, string>) || {}), bron: (r.bron as string) || "",
    updatedAt: r.created_at ? new Date(r.created_at as string).toISOString() : "",
  }));
}

// ALLE openstaande voorstellen. Eerder werd er maar één getoond en gooide een
// volgende drop de vorige weg: sleepte je vijf documenten achter elkaar, dan
// overleefde alleen het laatste, zonder melding. Vandaar dat er materiaal
// "gedropt maar nooit aangekomen" bleek. Nu blijft elk voorstel staan tot jij
// erover beslist.
export async function getOpenProposals(slug: string): Promise<KennisVoorstel[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT id, bron, samenvatting, velden FROM client_schema_knowledge
    WHERE client_slug = ${slug} AND soort = 'drop' AND status = 'voorstel' ORDER BY id ASC`;
  return rows.map((r) => ({
    id: r.id as number, bron: (r.bron as string) || "", samenvatting: (r.samenvatting as string) || "",
    entiteiten: ((r.velden as { entiteiten?: KennisVoorstel["entiteiten"] }) || {}).entiteiten || [],
  }));
}

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

export function entiteitenUitJsonLd(tekst: string): { samenvatting: string; entiteiten: KennisVoorstel["entiteiten"] } | null {
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

  const entiteiten: KennisVoorstel["entiteiten"] = [];
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
  const samengevoegd: KennisVoorstel["entiteiten"] = [];
  const index = new Map<string, number>();
  for (const e of entiteiten) {
    const k = identiteit(e.categorie, e.naam, e.velden);
    const bestaat = index.get(k);
    if (bestaat === undefined) { index.set(k, samengevoegd.length); samengevoegd.push(e); continue; }
    const doel = samengevoegd[bestaat];
    doel.velden = voegVeldenSamen(doel.velden, e.velden, true);
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

// Drop → AI structureert naar entiteiten en vergelijkt met wat er al staat.
export async function proposeKnowledge(slug: string, bron: string, tekst: string): Promise<KennisVoorstel> {
  await ensureSchema();
  await ensureTable();
  const huidig = await listKnowledge(slug);

  // Is het aangeleverde stuk zelf al JSON-LD, lees het dan exact in.
  const uitJson = entiteitenUitJsonLd(tekst);
  if (uitJson) {
    const bestaand = new Map(huidig.map((e) => [`${e.categorie}|${sleutel(e.naam)}`, e]));
    const entiteiten = uitJson.entiteiten.map((e) => ({
      ...e,
      velden: normaliseerVelden(e.velden),
      oordeel: bestaand.has(`${e.categorie}|${sleutel(e.naam)}`) ? ("aanvulling" as const) : ("nieuw" as const),
    }));
    const { rows } = await sql`
      INSERT INTO client_schema_knowledge (client_slug, soort, bron, samenvatting, velden, status)
      VALUES (${slug}, 'drop', ${bron}, ${uitJson.samenvatting}, ${JSON.stringify({ entiteiten })}, 'voorstel')
      RETURNING id`;
    return { id: rows[0].id as number, bron, samenvatting: uitJson.samenvatting, entiteiten };
  }

  const huidigTekst = huidig.map((e) => `- [${e.categorie}] ${e.naam}: ${JSON.stringify(e.velden)}`).join("\n") || "(kennisbank is nog leeg)";
  const sys = `Je bent structured data-specialist bij SEO-bureau Pingwin. Je krijgt aangeleverd materiaal over een klant (documenten, gegevens over artsen/medewerkers, schema-code, wat dan ook) en structureert dat tot entiteiten voor de structured data-kennisbank.
Regels:
- Categorieën: organisatie | persoon | locatie | dienst | overig. Eén entiteit per persoon, per locatie, per dienst.
- "velden" is een plat object, alleen wat er ECHT in het materiaal staat. NOOIT iets verzinnen of aanvullen uit eigen kennis.
- GEBRUIK UITSLUITEND DEZE VELDNAMEN (exact zo geschreven), anders komt het gegeven niet op zijn plek terecht:
  adres, postcode, plaats, telefoon, email, openingstijden, mapsUrl, functie, specialisatie, big, linkedin, profielUrl, foto, omschrijving, kvk, btw, logo, oprichtingsjaar.
  Staat er iets in het materiaal dat hier niet in past, gebruik dan een eigen korte veldnaam.
- VOLLEDIGHEID GAAT VOOR BEKNOPTHEID: neem ELKE locatie, ELKE persoon en ELKE dienst uit het materiaal op, ook als het er veel zijn. Sla er nooit een over en vat een lijst nooit samen.
- Hoort een adres of openingstijd bij een specifieke vestiging, zet die dan bij die locatie-entiteit (niet bij de organisatie).
- Vergelijk met de huidige kennisbank en geef per entiteit een "oordeel": nieuw (stond er nog niet) | aanvulling (bestaat al, dit voegt velden toe of wijzigt ze) | ouder (dit lijkt verouderde informatie t.o.v. wat er staat).
- "samenvatting": 2-3 zinnen in gewone taal: wat dit materiaal is en wat het toevoegt.
Antwoord met UITSLUITEND geldige JSON: {"samenvatting":"...","entiteiten":[{"categorie":"...","naam":"...","velden":{...},"oordeel":"nieuw|aanvulling|ouder"}]}`;
  // Ruim materiaal meesturen en ruim antwoord toestaan: een lijst met alle
  // vestigingen plus openingstijden liep eerder tegen de limiet aan, waardoor de
  // laatste locaties stilletjes wegvielen en daarna als "ontbreekt" opdoken.
  const user = `Bron: ${bron}\n\nAANGELEVERD MATERIAAL:\n${(tekst || "").slice(0, 60000)}\n\nHUIDIGE KENNISBANK:\n${huidigTekst.slice(0, 6000)}`;
  const raw = await callClaude(sys, [{ role: "user", content: user }], 16000, { slug, action: "kennisbank-structureren" });
  const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1)) as { samenvatting?: string; entiteiten?: KennisVoorstel["entiteiten"] };
  const entiteiten = (parsed.entiteiten || [])
    .filter((e) => e && e.naam && (KENNIS_CATEGORIEEN as readonly string[]).includes(e.categorie))
    .map((e) => ({ ...e, velden: normaliseerVelden(e.velden || {}) }))
    .slice(0, 200);
  if (!entiteiten.length) throw new Error("Geen herkenbare gegevens gevonden in het aangeleverde materiaal.");
  const samenvatting = (parsed.samenvatting || "Aangeleverd materiaal.").trim();
  // Bewust GEEN eerder voorstel sluiten: elk aangeleverd stuk blijft staan tot
  // Maarten het verwerkt of negeert. Anders verdwijnt materiaal ongemerkt.
  const { rows } = await sql`
    INSERT INTO client_schema_knowledge (client_slug, soort, bron, samenvatting, velden, status)
    VALUES (${slug}, 'drop', ${bron}, ${samenvatting}, ${JSON.stringify({ entiteiten })}, 'voorstel')
    RETURNING id`;
  return { id: rows[0].id as number, bron, samenvatting, entiteiten };
}

// Verwerken: entiteiten samenvoegen in de kennisbank (append-only, oude rij blijft).
export async function confirmKnowledge(slug: string, id: number): Promise<{ ok: boolean; error?: string; verwerkt?: number }> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT velden FROM client_schema_knowledge WHERE client_slug = ${slug} AND id = ${id} AND soort = 'drop' AND status = 'voorstel' LIMIT 1`;
  if (!rows[0]) return { ok: false, error: "Voorstel niet gevonden (misschien al verwerkt)." };
  const entiteiten = ((rows[0].velden as { entiteiten?: KennisVoorstel["entiteiten"] })?.entiteiten) || [];
  const huidig = await listKnowledge(slug);
  // Op identiteit vergelijken, en de kaart meelopend bijwerken: zo landt een
  // gegeven dat twee keer in dezelfde aanlevering staat óók op één regel.
  const byKey = new Map<string, KennisEntiteit>();
  for (const e of huidig) if (!byKey.has(identiteit(e.categorie, e.naam, e.velden))) byKey.set(identiteit(e.categorie, e.naam, e.velden), e);
  let verwerkt = 0;
  for (const e of entiteiten) {
    const sleutelId = identiteit(e.categorie, e.naam, e.velden || {});
    const bestaand = byKey.get(sleutelId);
    const velden = voegVeldenSamen(bestaand?.velden || {}, e.velden || {}, e.oordeel === "ouder");
    // De duidelijkste naam winnen laten: de langste van de twee (met titel of
    // met plaatsaanduiding) zegt doorgaans meer dan de korte variant.
    const naam = bestaand && bestaand.naam.length >= e.naam.trim().length ? bestaand.naam : e.naam.trim();
    if (bestaand) await sql`UPDATE client_schema_knowledge SET status = 'vervangen' WHERE client_slug = ${slug} AND id = ${bestaand.id}`;
    const ins = await sql`
      INSERT INTO client_schema_knowledge (client_slug, soort, categorie, naam, velden, bron, status)
      VALUES (${slug}, 'entiteit', ${e.categorie}, ${naam}, ${JSON.stringify(velden)}, ${`voorstel #${id}`}, 'actueel')
      RETURNING id`;
    byKey.set(sleutelId, { id: ins.rows[0].id as number, categorie: e.categorie, naam, velden, bron: `voorstel #${id}`, updatedAt: "" });
    verwerkt++;
  }
  await sql`UPDATE client_schema_knowledge SET status = 'verwerkt' WHERE client_slug = ${slug} AND id = ${id}`;
  await opruimenDubbel(slug);
  return { ok: true, verwerkt };
}

// Wat er al dubbel in de kennisbank staat (van vóór het ontdubbelen) alsnog
// samenvoegen: nieuwste regel wint per veld, oudere regels gaan op "vervangen".
export async function opruimenDubbel(slug: string): Promise<number> {
  const huidig = await listKnowledge(slug);
  const groepen = new Map<string, KennisEntiteit[]>();
  for (const e of huidig) {
    const k = identiteit(e.categorie, e.naam, e.velden);
    groepen.set(k, [...(groepen.get(k) || []), e]);
  }
  let opgeruimd = 0;
  for (const groep of groepen.values()) {
    if (groep.length < 2) continue;
    const gesorteerd = [...groep].sort((a, b) => b.id - a.id); // nieuwste eerst
    const winnaar = gesorteerd[0];
    let velden = { ...winnaar.velden };
    for (const ouder of gesorteerd.slice(1)) velden = voegVeldenSamen(velden, ouder.velden, true);
    const naam = gesorteerd.map((g) => g.naam).sort((a, b) => b.length - a.length)[0];
    await sql`UPDATE client_schema_knowledge SET velden = ${JSON.stringify(velden)}, naam = ${naam} WHERE client_slug = ${slug} AND id = ${winnaar.id}`;
    for (const weg of gesorteerd.slice(1)) {
      await sql`UPDATE client_schema_knowledge SET status = 'vervangen' WHERE client_slug = ${slug} AND id = ${weg.id}`;
      opgeruimd++;
    }
  }
  return opgeruimd;
}

// Alle openstaande voorstellen in één klik verwerken (na een reeks drops).
export async function confirmAllKnowledge(slug: string): Promise<{ voorstellen: number; verwerkt: number }> {
  const open = await getOpenProposals(slug);
  let verwerkt = 0;
  for (const v of open) {
    const r = await confirmKnowledge(slug, v.id);
    if (r.ok) verwerkt += r.verwerkt || 0;
  }
  return { voorstellen: open.length, verwerkt };
}

// Eén regel uit de kennisbank halen. Hij verdwijnt uit het overzicht, uit het
// rode lijstje en uit de structured data, maar de rij blijft in de historie
// staan (status 'verwijderd'), zodat er nooit iets echt weg is.
export async function deleteKnowledgeEntity(slug: string, id: number): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`UPDATE client_schema_knowledge SET status = 'verwijderd' WHERE client_slug = ${slug} AND id = ${id} AND soort = 'entiteit'`;
}

export async function ignoreKnowledge(slug: string, id: number): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`UPDATE client_schema_knowledge SET status = 'genegeerd' WHERE client_slug = ${slug} AND id = ${id} AND status = 'voorstel'`;
}

// ─── Van kennisbank naar formulier: de gedropte gegevens op hun plek zetten ───
// De kennisbank was een eindstation: alles wat Maarten in de dropzone gooide bleef
// als losse entiteit staan en de bedrijfsgegevens-velden bleven leeg, met als
// gevolg dat aangeleverde vestigingen en artsen tóch als "ontbreekt" opdoken.
// Na "Verwerk in kennisbank" vullen we daarom ook het formulier: lege velden
// worden gevuld, ingevulde velden blijven staan (nooit stilletjes overschrijven),
// en onbekende vestigingen, artsen en diensten worden als nieuwe rij aangemaakt.

// "Keizersgracht 100, 1015 CS Amsterdam" → losse delen.
export function splitsAdres(adres: string): { straat: string; postcode: string; plaats: string } {
  const heel = String(adres || "").replace(/\s+/g, " ").trim();
  if (!heel) return { straat: "", postcode: "", plaats: "" };
  const pc = heel.match(/\b([1-9][0-9]{3})\s?([A-Za-z]{2})\b/);
  const postcode = pc ? `${pc[1]} ${pc[2].toUpperCase()}` : "";
  let rest = postcode ? heel.replace(pc![0], "|").trim() : heel;
  let straat = "", plaats = "";
  if (postcode) {
    const [voor, na] = rest.split("|");
    straat = (voor || "").replace(/[,\s]+$/, "").trim();
    plaats = (na || "").replace(/^[,\s]+/, "").trim();
  } else {
    const delen = rest.split(",").map((s) => s.trim()).filter(Boolean);
    straat = delen[0] || "";
    plaats = delen.slice(1).join(", ");
  }
  return { straat, postcode, plaats };
}

// Veldnamen waarin een sociale of externe profiel-link kan zitten.
const SOCIAL_VELDEN = /^(sameas|socials?|sociale?profielen|facebook|instagram|linkedin|twitter|x|youtube|tiktok|pinterest|whatsapp|mapsurl|googlebusiness|googlemaps|vermeldingen)$/i;

const sleutel = (s: string) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const vul = (huidig: string, nieuw: string) => (String(huidig || "").trim() ? huidig : String(nieuw || "").trim());

export async function applyKnowledgeToOrg(slug: string): Promise<{ gevuld: number; nieuweVestigingen: number; nieuweArtsen: number }> {
  const [rec, entiteiten] = await Promise.all([getOrgData(slug), listKnowledge(slug)]);
  if (rec.locked) return { gevuld: 0, nieuweVestigingen: 0, nieuweArtsen: 0 };
  const voor = JSON.stringify(rec.data);
  const { data, nieuweVestigingen, nieuweArtsen } = kennisNaarOrg(rec.data, entiteiten);
  const gevuld = JSON.stringify(data) === voor ? 0 : 1;
  if (gevuld) await saveOrgData(slug, data, "admin");
  return { gevuld, nieuweVestigingen, nieuweArtsen };
}

// De omzetting zelf: los van de database, zodat hij te controleren is.
export function kennisNaarOrg(bron: OrgData, entiteiten: KennisEntiteit[]): { data: OrgData; nieuweVestigingen: number; nieuweArtsen: number } {
  const d: OrgData = JSON.parse(JSON.stringify(bron));
  let nieuweVestigingen = 0, nieuweArtsen = 0;

  // Eerst opruimen wat er al dubbel in het formulier staat.
  const gezienV = new Map<string, OrgVestiging>();
  for (const v of d.vestigingen) {
    const k = identiteit("locatie", v.naam, { adres: v.straat, postcode: v.postcode, plaats: v.plaats });
    const eerder = gezienV.get(k);
    if (!eerder) { gezienV.set(k, v); continue; }
    for (const veld of Object.keys(LEGE_VESTIGING) as (keyof OrgVestiging)[]) eerder[veld] = vul(eerder[veld], v[veld]);
  }
  d.vestigingen = [...gezienV.values()];
  const gezienA = new Map<string, OrgData["artsen"][number]>();
  for (const a of d.artsen) {
    const k = identiteit("persoon", a.naam, { big: a.big });
    const eerder = gezienA.get(k);
    if (!eerder) { gezienA.set(k, a); continue; }
    eerder.functie = vul(eerder.functie, a.functie); eerder.specialisatie = vul(eerder.specialisatie, a.specialisatie);
    eerder.big = vul(eerder.big, a.big); eerder.fotoUrl = vul(eerder.fotoUrl, a.fotoUrl); eerder.profielUrl = vul(eerder.profielUrl, a.profielUrl);
  }
  d.artsen = [...gezienA.values()];

  // Organisatie-entiteiten: de algemene bedrijfsvelden.
  for (const o of entiteiten.filter((e) => e.categorie === "organisatie")) {
    const v = o.velden;
    d.bedrijfsnaam = vul(d.bedrijfsnaam, o.naam);
    d.telefoon = vul(d.telefoon, v.telefoon); d.email = vul(d.email, v.email);
    d.kvk = vul(d.kvk, v.kvk); d.btw = vul(d.btw, v.btw);
    d.logoUrl = vul(d.logoUrl, v.logo); d.oprichtingsjaar = vul(d.oprichtingsjaar, v.oprichtingsjaar);
    d.openingstijden = vul(d.openingstijden, v.openingstijden);
    if (v.adres) {
      const a = splitsAdres(v.adres);
      d.straat = vul(d.straat, a.straat); d.postcode = vul(d.postcode, a.postcode); d.plaats = vul(d.plaats, a.plaats);
    }
    d.priceRange = vul(d.priceRange, v.priceRange);
    if (!d.bedrijfstype && ["kliniek", "webshop", "dienstverlener", "lokaal", "informatief"].includes(v.bedrijfstype || "")) {
      d.bedrijfstype = v.bedrijfstype as OrgData["bedrijfstype"];
    }
    for (const plek of String(v.areaServed || "").split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)) {
      if (!d.areaServed.some((a) => sleutel(a) === sleutel(plek))) d.areaServed.push(plek);
    }
    // Sociale profielen: alles wat als link in een social-veld of in de sameAs-lijst
    // staat. Eerder werden alleen "linkedin" en "profielUrl" bekeken, waardoor een
    // aangeleverde sameAs-lijst met Facebook, Instagram en X nergens aankwam.
    for (const [naam, waarde] of Object.entries(v)) {
      if (!SOCIAL_VELDEN.test(naam.replace(/[^a-z0-9]/gi, ""))) continue;
      for (const u of String(waarde || "").split(/[\s,;]+/)) {
        if (/^https?:\/\//i.test(u) && !d.sameAs.some((s) => sleutel(s) === sleutel(u))) d.sameAs.push(u);
      }
    }
  }

  // Locaties → vestigingen (elke locatie een eigen rij met adres en tijden).
  for (const l of entiteiten.filter((e) => e.categorie === "locatie")) {
    const a = splitsAdres(l.velden.adres || "");
    const kern = identiteit("locatie", l.naam, l.velden);
    const bestaand = d.vestigingen.find((x) => identiteit("locatie", x.naam, { adres: x.straat, postcode: x.postcode, plaats: x.plaats }) === kern);
    const rij: OrgVestiging = bestaand || { ...LEGE_VESTIGING, naam: l.naam };
    rij.naam = vul(rij.naam, l.naam);
    rij.straat = vul(rij.straat, a.straat);
    rij.postcode = vul(rij.postcode, l.velden.postcode || a.postcode);
    rij.plaats = vul(rij.plaats, l.velden.plaats || a.plaats);
    rij.telefoon = vul(rij.telefoon, l.velden.telefoon);
    rij.email = vul(rij.email, l.velden.email);
    rij.openingstijden = vul(rij.openingstijden, l.velden.openingstijden);
    rij.mapsUrl = vul(rij.mapsUrl, l.velden.mapsUrl);
    if (!bestaand) { d.vestigingen.push(rij); nieuweVestigingen++; }
  }

  // Personen → artsen en behandelaren.
  for (const p of entiteiten.filter((e) => e.categorie === "persoon")) {
    const kern = identiteit("persoon", p.naam, p.velden);
    const bestaand = d.artsen.find((a) => identiteit("persoon", a.naam, { big: a.big }) === kern);
    const rij = bestaand || { naam: p.naam, functie: "", specialisatie: "", big: "", fotoUrl: "", profielUrl: "" };
    if (p.naam.length > rij.naam.length) rij.naam = p.naam;
    rij.functie = vul(rij.functie, p.velden.functie);
    rij.specialisatie = vul(rij.specialisatie, p.velden.specialisatie);
    rij.big = vul(rij.big, p.velden.big);
    rij.fotoUrl = vul(rij.fotoUrl, p.velden.foto);
    rij.profielUrl = vul(rij.profielUrl, p.velden.profielUrl || p.velden.linkedin);
    if (!bestaand) { d.artsen.push(rij); nieuweArtsen++; }
  }

  // Diensten → dienstenlijst.
  for (const s of entiteiten.filter((e) => e.categorie === "dienst")) {
    const bestaand = d.diensten.find((x) => naamKaal(x.naam) === naamKaal(s.naam));
    if (bestaand) bestaand.omschrijving = vul(bestaand.omschrijving, s.velden.omschrijving);
    else d.diensten.push({ naam: s.naam, omschrijving: s.velden.omschrijving || "" });
  }

  // Zijn er vestigingen, dan is het hoofdadres niet langer verplicht; staat er nog
  // niets, dan neemt de eerste vestiging die plek in (één-locatiebedrijven).
  if (!d.straat && d.vestigingen.length === 1) {
    const v = d.vestigingen[0];
    d.straat = v.straat; d.postcode = v.postcode; d.plaats = v.plaats;
    d.openingstijden = vul(d.openingstijden, v.openingstijden);
  }

  return { data: d, nieuweVestigingen, nieuweArtsen };
}

// ─── Rood lijstje "Nog aan te leveren": wat mist er voor dit soort bedrijf ───
// Precies dezelfde uitkomst als de rode velden in het formulier: één bron
// (lib/org-vereist.ts), zodat scherm en lijstje nooit uiteenlopen. Wat alleen in
// de kennisbank staat en nog niet in het formulier, telt gewoon mee.

export async function knowledgeGaps(slug: string): Promise<string[]> {
  const [org, entiteiten] = await Promise.all([getOrgData(slug), listKnowledge(slug)]);
  const d: OrgData = JSON.parse(JSON.stringify(org.data));

  // Locaties uit de kennisbank die nog geen vestigingsrij hebben, tijdelijk
  // meenemen: zo verschijnt een aangeleverde locatie meteen in het lijstje met
  // precies wat er van díé locatie nog mist.
  for (const l of entiteiten.filter((e) => e.categorie === "locatie")) {
    const kern = identiteit("locatie", l.naam, l.velden);
    if (d.vestigingen.some((v) => identiteit("locatie", v.naam, { adres: v.straat, postcode: v.postcode, plaats: v.plaats }) === kern)) continue;
    const a = splitsAdres(l.velden.adres || "");
    d.vestigingen.push({
      ...LEGE_VESTIGING, naam: l.naam, straat: a.straat,
      postcode: l.velden.postcode || a.postcode, plaats: l.velden.plaats || a.plaats,
      telefoon: l.velden.telefoon || "", email: l.velden.email || "",
      openingstijden: l.velden.openingstijden || "", mapsUrl: l.velden.mapsUrl || "",
    });
  }
  for (const p of entiteiten.filter((e) => e.categorie === "persoon")) {
    const kern = identiteit("persoon", p.naam, p.velden);
    if (d.artsen.some((a) => identiteit("persoon", a.naam, { big: a.big }) === kern)) continue;
    d.artsen.push({
      naam: p.naam, functie: p.velden.functie || "", specialisatie: p.velden.specialisatie || "",
      big: p.velden.big || "", fotoUrl: p.velden.foto || "", profielUrl: p.velden.profielUrl || p.velden.linkedin || "",
    });
  }
  for (const s of entiteiten.filter((e) => e.categorie === "dienst")) {
    if (!d.diensten.some((x) => naamKaal(x.naam) === naamKaal(s.naam))) d.diensten.push({ naam: s.naam, omschrijving: s.velden.omschrijving || "" });
  }
  return ontbrekendeVelden(d).map((o) => o.regel).slice(0, 40);
}

// Platte tekst van de kennisbank voor de schema-prompt (per pagina-run).
export async function knowledgeText(slug: string): Promise<string> {
  const entiteiten = await listKnowledge(slug).catch(() => [] as KennisEntiteit[]);
  if (!entiteiten.length) return "";
  const perCat = new Map<string, string[]>();
  for (const e of entiteiten) {
    const regel = `- ${e.naam}: ${Object.entries(e.velden).map(([k, v]) => `${k}=${v}`).join("; ")}`;
    perCat.set(e.categorie, [...(perCat.get(e.categorie) || []), regel]);
  }
  return [...perCat.entries()].map(([c, regels]) => `${CAT_LABEL[c] || c}:\n${regels.join("\n")}`).join("\n\n").slice(0, 6000);
}
