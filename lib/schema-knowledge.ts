import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";
import { getOrgData, saveOrgData, type OrgData } from "./org-data";
import { getClientBySlug } from "./clients";
import { ontbrekendeVelden, identiteit, naamKaal, isEchteVestiging, LEGE_VESTIGING, type OrgVestiging } from "./org-vereist";
export { identiteit, isEchteVestiging } from "./org-vereist";
import { callClaude } from "./anthropic";
import { GEEN_DATUM, isNieuwerDan, leesbaar, type BronDatum, type DatumBron } from "./bron-datum";

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

// Van wanneer is één gegeven, en waar kwam het vandaan. Per veld, niet per
// document: een screenshot van alleen de openingstijden mag het adres van
// vorige week niet overschrijven omdat het bestand toevallig nieuwer is.
export type VeldStempel = { datum: string; bron: DatumBron; waar: string };
export type VeldStempels = Record<string, VeldStempel>;

export type KennisEntiteit = {
  id: number; categorie: string; naam: string; velden: Record<string, string>; bron: string; updatedAt: string;
  /** Per veld: van wanneer die waarde is en waar hij vandaan komt. */
  stempels: VeldStempels;
};
export type KennisVoorstel = {
  id: number; bron: string; samenvatting: string;
  entiteiten: { categorie: string; naam: string; velden: Record<string, string>; oordeel: "nieuw" | "aanvulling" | "ouder" }[];
  /** Van wanneer dit aangeleverde materiaal zelf is, en hoe we dat weten. */
  inhoudDatum: string;
  datumBron: DatumBron;
  datumUitleg: string;
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

// De identiteits-helpers (wanneer is iets hetzelfde gegeven) staan in
// lib/org-vereist.ts, zodat zowel de kennisbank als het automatisch ophalen
// dezelfde regels gebruiken zonder kringverwijzing tussen de bestanden.

// ─── Samenvoegen op datum, per gegeven ───
//
// Hier zit de hele afspraak in, en het is bewust één functie: nieuwer wint,
// gelijk verandert niets, en zonder datum wordt er niet overschreven.
//
// Waarom per gégeven en niet per document: stuurt de klant een schermafdruk van
// alleen de openingstijden, dan is dat bestand nieuwer dan alles wat er ligt,
// maar het zegt niets over het adres. Vergelijken per document zou het hele
// adresblok weggooien omdat er een nieuwer bestand langskwam. Vergelijken per
// gegeven kijkt alleen naar wat er écht in staat.
//
// Waarom een gelijke waarde de oude datum houdt: halen wij vandaag het adres van
// de site en het staat daar al twee jaar hetzelfde, dan is "sinds wanneer weten
// we dit" belangrijker dan "wanneer keken we voor het laatst". Anders zou elke
// controle-ronde onze eigen gegevens kunstmatig verjongen, en dan verliest een
// klantdocument van vorige week het van een adres dat al jaren zo staat.
export type Botsing = { veld: string; oud: string; nieuw: string; reden: string };

export function voegVeldenSamen(
  bestaand: Record<string, string>,
  bestaandeStempels: VeldStempels,
  nieuw: Record<string, string>,
  aanlevering: BronDatum,
  waar: string,
): { velden: Record<string, string>; stempels: VeldStempels; botsingen: Botsing[] } {
  const velden = { ...(bestaand || {}) };
  const stempels: VeldStempels = { ...(bestaandeStempels || {}) };
  const botsingen: Botsing[] = [];
  const stempel = (): VeldStempel => ({ datum: aanlevering.datum, bron: aanlevering.bron, waar });

  for (const [veld, ruw] of Object.entries(nieuw || {})) {
    const waarde = String(ruw || "").trim();
    if (!waarde) continue;
    const oud = String(velden[veld] || "").trim();

    // 1. Nog niets bekend: aanvullen mag altijd, ook zonder datum. Er gaat
    //    niets verloren, dus er valt niets te beslissen.
    if (!oud) { velden[veld] = waarde; stempels[veld] = stempel(); continue; }

    // 2. Zelfde waarde: niets veranderen, en de oorspronkelijke datum houden.
    if (oud === waarde) continue;

    // 3. Andere waarde: alleen de aantoonbaar nieuwere wint.
    const oudeDatum = stempels[veld]?.datum || "";
    if (isNieuwerDan(aanlevering.datum, oudeDatum)) {
      velden[veld] = waarde;
      stempels[veld] = stempel();
      continue;
    }
    botsingen.push({
      veld, oud, nieuw: waarde,
      reden: !aanlevering.datum
        ? "van het aangeleverde materiaal is geen datum bekend"
        : !oudeDatum
          ? "van wat er nu staat is geen datum bekend"
          : `het aangeleverde stuk is van ${leesbaar(aanlevering.datum)}, wat er staat van ${leesbaar(oudeDatum)}`,
    });
  }
  return { velden, stempels, botsingen };
}

/**
 * De stempels van een bestaande regel, met terugwerkende kracht.
 *
 * Alles wat er vóór deze aanpak in stond heeft geen stempel per veld. Die
 * krijgen de datum waarop de regel in het dashboard kwam. Dat is een eerlijke
 * ondergrens (verder terug dan dit kan het niet zijn) en het zorgt ervoor dat de
 * vergelijking meteen werkt in plaats van pas over een half jaar.
 */
function stempelsMetTerugwerkendeKracht(ruw: unknown, velden: Record<string, string>, gemaaktOp: string): VeldStempels {
  const opgeslagen = (ruw || {}) as VeldStempels;
  const uit: VeldStempels = {};
  for (const veld of Object.keys(velden || {})) {
    const s = opgeslagen[veld];
    uit[veld] = s && s.datum
      ? { datum: s.datum, bron: (s.bron || "onbekend") as DatumBron, waar: s.waar || "" }
      : { datum: gemaaktOp, bron: "onbekend", waar: "stond er al" };
  }
  return uit;
}

// De tabellen worden één keer gebouwd per database, niet bij elke koude
// server opnieuw. Zie lib/schema-stand.ts. Verander je iets aan doEnsure(),
// hoog dan het cijfer in de versie hieronder op; anders komt het er nooit in.
const SCHEMA_VERSIE = "schema-knowledge-77c46347";

function ensureTable(): Promise<void> {
  return eenmalig("schema-knowledge", SCHEMA_VERSIE, doEnsure);
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
  // Per veld: van wanneer die waarde is en waar hij vandaan komt. Hierop wordt
  // besloten wie wint bij een nieuwe aanlevering, dus dit is de kern van het
  // versiebeheer en niet zomaar een extraatje voor op het scherm.
  await sql`ALTER TABLE client_schema_knowledge ADD COLUMN IF NOT EXISTS veld_stempels JSONB`;
  // Van wanneer het aangeleverde materiaal zelf is (staat op de 'drop'-rij),
  // plus hoe we aan die datum komen, in gewone taal.
  await sql`ALTER TABLE client_schema_knowledge ADD COLUMN IF NOT EXISTS inhoud_datum TIMESTAMPTZ`;
  await sql`ALTER TABLE client_schema_knowledge ADD COLUMN IF NOT EXISTS datum_bron TEXT`;
  await sql`ALTER TABLE client_schema_knowledge ADD COLUMN IF NOT EXISTS datum_uitleg TEXT`;
}

export async function listKnowledge(slug: string): Promise<KennisEntiteit[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT id, categorie, naam, velden, bron, created_at, veld_stempels FROM client_schema_knowledge
    WHERE client_slug = ${slug} AND soort = 'entiteit' AND status = 'actueel'
    ORDER BY categorie, naam`;
  return rows.map((r) => {
    const velden = normaliseerVelden((r.velden as Record<string, string>) || {});
    const gemaakt = r.created_at ? new Date(r.created_at as string).toISOString() : "";
    return {
      id: r.id as number, categorie: (r.categorie as string) || "overig", naam: (r.naam as string) || "",
      velden, bron: (r.bron as string) || "", updatedAt: gemaakt,
      stempels: stempelsMetTerugwerkendeKracht(r.veld_stempels, velden, gemaakt),
    };
  });
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
    SELECT id, bron, samenvatting, velden, inhoud_datum, datum_bron, datum_uitleg FROM client_schema_knowledge
    WHERE client_slug = ${slug} AND soort = 'drop' AND status = 'voorstel' ORDER BY id ASC`;
  return rows.map((r) => ({
    id: r.id as number, bron: (r.bron as string) || "", samenvatting: (r.samenvatting as string) || "",
    entiteiten: ((r.velden as { entiteiten?: KennisVoorstel["entiteiten"] }) || {}).entiteiten || [],
    inhoudDatum: r.inhoud_datum ? new Date(r.inhoud_datum as string).toISOString() : "",
    datumBron: ((r.datum_bron as string) || "onbekend") as DatumBron,
    datumUitleg: (r.datum_uitleg as string) || GEEN_DATUM.uitleg,
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

// Drop → AI structureert naar entiteiten en vergelijkt met wat er al staat.
//
// `aanlevering` is van wanneer het materiaal zélf is (zie lib/bron-datum.ts).
// Die datum reist mee tot het verwerken en beslist dan per gegeven wie wint.
// Wordt hij niet meegegeven, dan geldt "onbekend", en dan vult dit materiaal
// alleen lege plekken aan in plaats van iets te overschrijven.
export async function proposeKnowledge(slug: string, bron: string, tekst: string, aanlevering: BronDatum = GEEN_DATUM): Promise<KennisVoorstel> {
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
      INSERT INTO client_schema_knowledge (client_slug, soort, bron, samenvatting, velden, status, inhoud_datum, datum_bron, datum_uitleg)
      VALUES (${slug}, 'drop', ${bron}, ${uitJson.samenvatting}, ${JSON.stringify({ entiteiten })}, 'voorstel',
              ${aanlevering.datum || null}, ${aanlevering.bron}, ${aanlevering.uitleg})
      RETURNING id`;
    return {
      id: rows[0].id as number, bron, samenvatting: uitJson.samenvatting, entiteiten,
      inhoudDatum: aanlevering.datum, datumBron: aanlevering.bron, datumUitleg: aanlevering.uitleg,
    };
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
    INSERT INTO client_schema_knowledge (client_slug, soort, bron, samenvatting, velden, status, inhoud_datum, datum_bron, datum_uitleg)
    VALUES (${slug}, 'drop', ${bron}, ${samenvatting}, ${JSON.stringify({ entiteiten })}, 'voorstel',
            ${aanlevering.datum || null}, ${aanlevering.bron}, ${aanlevering.uitleg})
    RETURNING id`;
  return {
    id: rows[0].id as number, bron, samenvatting, entiteiten,
    inhoudDatum: aanlevering.datum, datumBron: aanlevering.bron, datumUitleg: aanlevering.uitleg,
  };
}

// Verwerken: entiteiten samenvoegen in de kennisbank (append-only, oude rij blijft).
//
// Per gegeven wint de nieuwste, gemeten aan de datum van het materiaal zelf (zie
// voegVeldenSamen hierboven). Wat níet overgenomen kon worden, verdwijnt niet
// stilletjes: dat komt als botsing terug en staat daarna op het scherm, met de
// reden erbij. Dat is de enige eerlijke uitkomst als het dashboard zelf beslist:
// alles wat het zeker weet gaat vanzelf, en wat het niet zeker weet komt bij jou.
export async function confirmKnowledge(slug: string, id: number): Promise<{ ok: boolean; error?: string; verwerkt?: number; botsingen?: string[] }> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT velden, bron, inhoud_datum, datum_bron, datum_uitleg FROM client_schema_knowledge
    WHERE client_slug = ${slug} AND id = ${id} AND soort = 'drop' AND status = 'voorstel' LIMIT 1`;
  if (!rows[0]) return { ok: false, error: "Voorstel niet gevonden (misschien al verwerkt)." };
  const entiteiten = ((rows[0].velden as { entiteiten?: KennisVoorstel["entiteiten"] })?.entiteiten) || [];
  const waar = String(rows[0].bron || "aangeleverd materiaal");
  const aanlevering: BronDatum = {
    datum: rows[0].inhoud_datum ? new Date(rows[0].inhoud_datum as string).toISOString() : "",
    bron: ((rows[0].datum_bron as string) || "onbekend") as DatumBron,
    uitleg: (rows[0].datum_uitleg as string) || GEEN_DATUM.uitleg,
  };
  const huidig = await listKnowledge(slug);
  // Op identiteit vergelijken, en de kaart meelopend bijwerken: zo landt een
  // gegeven dat twee keer in dezelfde aanlevering staat óók op één regel.
  const byKey = new Map<string, KennisEntiteit>();
  for (const e of huidig) if (!byKey.has(identiteit(e.categorie, e.naam, e.velden))) byKey.set(identiteit(e.categorie, e.naam, e.velden), e);
  let verwerkt = 0;
  const botsingen: string[] = [];
  for (const e of entiteiten) {
    const sleutelId = identiteit(e.categorie, e.naam, e.velden || {});
    const bestaand = byKey.get(sleutelId);
    const samen = voegVeldenSamen(bestaand?.velden || {}, bestaand?.stempels || {}, e.velden || {}, aanlevering, waar);
    for (const b of samen.botsingen) {
      botsingen.push(`${e.naam}, ${VELD_TEKST[b.veld] || b.veld}: "${kort(b.nieuw)}" niet overgenomen, "${kort(b.oud)}" blijft staan (${b.reden}).`);
    }
    // De duidelijkste naam winnen laten: de langste van de twee (met titel of
    // met plaatsaanduiding) zegt doorgaans meer dan de korte variant.
    const naam = bestaand && bestaand.naam.length >= e.naam.trim().length ? bestaand.naam : e.naam.trim();
    if (bestaand) await sql`UPDATE client_schema_knowledge SET status = 'vervangen' WHERE client_slug = ${slug} AND id = ${bestaand.id}`;
    const ins = await sql`
      INSERT INTO client_schema_knowledge (client_slug, soort, categorie, naam, velden, bron, status, veld_stempels)
      VALUES (${slug}, 'entiteit', ${e.categorie}, ${naam}, ${JSON.stringify(samen.velden)}, ${`voorstel #${id}`}, 'actueel', ${JSON.stringify(samen.stempels)})
      RETURNING id`;
    byKey.set(sleutelId, {
      id: ins.rows[0].id as number, categorie: e.categorie, naam,
      velden: samen.velden, stempels: samen.stempels, bron: `voorstel #${id}`, updatedAt: "",
    });
    verwerkt++;
  }
  await sql`UPDATE client_schema_knowledge SET status = 'verwerkt' WHERE client_slug = ${slug} AND id = ${id}`;
  await opruimenDubbel(slug);
  return { ok: true, verwerkt, botsingen };
}

// Namen van velden in gewone taal, voor de melding hierboven. Eén lijstje, want
// de kaartjes op het scherm hebben er ook een; die leest hieruit.
export const VELD_TEKST: Record<string, string> = {
  adres: "adres", postcode: "postcode", plaats: "plaats", telefoon: "telefoon", email: "e-mailadres",
  openingstijden: "openingstijden", functie: "functie", specialisatie: "specialisatie", big: "BIG-nummer",
  linkedin: "LinkedIn", profielUrl: "pagina", foto: "foto", omschrijving: "omschrijving", kvk: "KVK-nummer",
  btw: "btw-id", logo: "logo", oprichtingsjaar: "oprichtingsjaar", mapsUrl: "Google Maps",
};
const kort = (s: string) => (s.length > 60 ? `${s.slice(0, 57)}…` : s);

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
    const velden = { ...winnaar.velden };
    const stempels: VeldStempels = { ...winnaar.stempels };
    // Bij ontdubbelen vullen oudere regels alleen lege plekken aan; ze
    // overschrijven nooit. De stempel van het gegeven reist mee, anders zou een
    // waarde na het opruimen zijn datum kwijt zijn en daarna alles verliezen.
    for (const ouder of gesorteerd.slice(1)) {
      for (const [veld, ruw] of Object.entries(ouder.velden || {})) {
        const waarde = String(ruw || "").trim();
        if (!waarde || String(velden[veld] || "").trim()) continue;
        velden[veld] = waarde;
        stempels[veld] = ouder.stempels[veld] || { datum: ouder.updatedAt, bron: "onbekend", waar: "stond er al" };
      }
    }
    const naam = gesorteerd.map((g) => g.naam).sort((a, b) => b.length - a.length)[0];
    await sql`
      UPDATE client_schema_knowledge SET velden = ${JSON.stringify(velden)}, naam = ${naam}, veld_stempels = ${JSON.stringify(stempels)}
      WHERE client_slug = ${slug} AND id = ${winnaar.id}`;
    for (const weg of gesorteerd.slice(1)) {
      await sql`UPDATE client_schema_knowledge SET status = 'vervangen' WHERE client_slug = ${slug} AND id = ${weg.id}`;
      opgeruimd++;
    }
  }
  return opgeruimd;
}

// Alle openstaande voorstellen in één klik verwerken (na een reeks drops).
export async function confirmAllKnowledge(slug: string): Promise<{ voorstellen: number; verwerkt: number; botsingen: string[] }> {
  const open = await getOpenProposals(slug);
  let verwerkt = 0;
  const botsingen: string[] = [];
  for (const v of open) {
    const r = await confirmKnowledge(slug, v.id);
    if (r.ok) { verwerkt += r.verwerkt || 0; botsingen.push(...(r.botsingen || [])); }
  }
  return { voorstellen: open.length, verwerkt, botsingen };
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
  const client = await getClientBySlug(slug).catch(() => null);
  const { data, nieuweVestigingen, nieuweArtsen } = kennisNaarOrg(rec.data, entiteiten, client?.domain || "");
  const gevuld = JSON.stringify(data) === voor ? 0 : 1;
  if (gevuld) await saveOrgData(slug, data, "admin");
  return { gevuld, nieuweVestigingen, nieuweArtsen };
}

// De omzetting zelf: los van de database, zodat hij te controleren is.
export function kennisNaarOrg(bron: OrgData, entiteiten: KennisEntiteit[], eigenDomein = ""): { data: OrgData; nieuweVestigingen: number; nieuweArtsen: number } {
  const d: OrgData = JSON.parse(JSON.stringify(bron));
  // De eigen website hoort niet tussen de sociale profielen: "sameAs" gaat over
  // vermeldingen elders (Facebook, LinkedIn, Google Business), niet over jezelf.
  const eigen = String(eigenDomein || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "").toLowerCase();
  const isEigenSite = (u: string) => {
    if (!eigen) return false;
    const host = u.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "").toLowerCase();
    return host === eigen;
  };
  if (eigen) d.sameAs = d.sameAs.filter((u) => !isEigenSite(u));
  let nieuweVestigingen = 0, nieuweArtsen = 0;

  // Eerst opruimen wat er al dubbel in het formulier staat.
  const gezienV = new Map<string, OrgVestiging>();
  for (const v of d.vestigingen) {
    const k = identiteit("locatie", v.naam, { adres: v.straat, postcode: v.postcode, plaats: v.plaats });
    const eerder = gezienV.get(k);
    if (!eerder) { gezienV.set(k, v); continue; }
    for (const veld of Object.keys(LEGE_VESTIGING) as (keyof OrgVestiging)[]) eerder[veld] = vul(eerder[veld], v[veld]);
  }
  // Rijen die niets méér dragen dan een plaatsnaam (een testpunt of een stad die
  // ooit als "locatie" werd opgepikt) zijn geen vestiging en verdwijnen uit het
  // formulier. Zodra er een huisnummer, postcode, openingstijd of contactgegeven
  // in staat, blijft de rij gewoon staan; zelf ingetypte rijen raak je dus niet kwijt.
  // Wat een vestiging maakt is een bezoekadres (huisnummer of postcode), eigen
  // openingstijden of een eigen Maps-vermelding. Een telefoonnummer of e-mail
  // telt bewust niet mee: dat is bij een keten voor alle locaties hetzelfde en
  // maakt van een genoemde plaats dus geen vestiging.
  d.vestigingen = [...gezienV.values()].filter((v) =>
    /\d/.test(v.straat || "") || String(v.postcode || "").trim()
    || String(v.openingstijden || "").trim() || String(v.mapsUrl || "").trim());
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
        if (!/^https?:\/\//i.test(u) || isEigenSite(u)) continue;
        if (!d.sameAs.some((s) => sleutel(s) === sleutel(u))) d.sameAs.push(u);
      }
    }
  }

  // Locaties → vestigingen (elke locatie een eigen rij met adres en tijden).
  for (const l of entiteiten.filter((e) => e.categorie === "locatie")) {
    if (!isEchteVestiging(l.velden)) continue; // alleen locaties met een echt bezoekadres
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

// Bouwt dezelfde samengevoegde bedrijfsgegevens op die het rode lijstje en de
// weekplan-kaart allebei gebruiken: het formulier plus wat er los in de
// kennisbank staat maar nog geen rij in het formulier heeft.
async function gapsBron(slug: string): Promise<OrgData> {
  const [org, entiteiten] = await Promise.all([getOrgData(slug), listKnowledge(slug)]);
  const d: OrgData = JSON.parse(JSON.stringify(org.data));

  // Locaties uit de kennisbank die nog geen vestigingsrij hebben, tijdelijk
  // meenemen: zo verschijnt een aangeleverde locatie meteen in het lijstje met
  // precies wat er van díé locatie nog mist.
  for (const l of entiteiten.filter((e) => e.categorie === "locatie")) {
    if (!isEchteVestiging(l.velden)) continue; // een genoemde plaats is geen vestiging
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
  return d;
}

export async function knowledgeGaps(slug: string): Promise<string[]> {
  const d = await gapsBron(slug);
  return ontbrekendeVelden(d).map((o) => o.regel).slice(0, 40);
}

// Dezelfde ontbrekende velden, maar gegroepeerd per veldtype ("Openingstijden
// ontbreken bij: A, B, C") in plaats van één losse regel per vestiging of arts.
// Voor de weekplan-kaart en de mail: die tonen de kaarttekst via de gedeelde
// weergave-laag (lib/card-info.ts), die bijna-identieke regels ("Vestiging X:
// openingstijden ontbreken.", "Vestiging Y: openingstijden ontbreken.", ...) als
// hetzelfde punt herkent en dan alle-op-één-na laat vallen. Bij één rijtje
// vestigingen met dezelfde ontbrekende gegevens verdwenen zo ongemerkt de
// meeste namen. Eén samengevoegde regel per veldtype heeft dat probleem niet en
// is bovendien korter en beter leesbaar in een mail aan de klant.
export async function knowledgeGapsPerVeld(slug: string): Promise<string[]> {
  const d = await gapsBron(slug);
  const ontbrekend = ontbrekendeVelden(d).slice(0, 40);
  const perLabel = new Map<string, string[]>();
  const los: string[] = [];
  for (const o of ontbrekend) {
    if (o.naam) {
      const lijst = perLabel.get(o.label) || [];
      if (!lijst.includes(o.naam)) lijst.push(o.naam);
      perLabel.set(o.label, lijst);
    } else {
      los.push(o.regel);
    }
  }
  const gegroepeerd = [...perLabel.entries()].map(([label, namen]) =>
    namen.length > 1 ? `${label} ontbreekt bij: ${namen.join(", ")}.` : `${label} ontbreekt bij ${namen[0]}.`);
  return [...los, ...gegroepeerd];
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
