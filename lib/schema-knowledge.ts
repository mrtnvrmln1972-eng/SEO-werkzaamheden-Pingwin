import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";
import { getOrgData, saveOrgData, plattePaden, padSleutel, type OrgData, type OrgVeldStempels } from "./org-data";
import { getClientBySlug } from "./clients";
import { ontbrekendeVelden, identiteit, magOpNaamKoppelen, naamKaal, isEchteVestiging, LEGE_VESTIGING, type OrgVestiging } from "./org-vereist";
export { identiteit, isEchteVestiging } from "./org-vereist";
import { callClaude } from "./anthropic";
import { normaliseerVelden, sleutel } from "./veld-namen";
import { entiteitenUitJsonLd, type AangeleverdeEntiteit } from "./json-ld-kennis";
// Deze twee stonden hier eerder zelf; ze zijn verhuisd omdat de JSON-LD-lezer ze
// ook nodig heeft. Doorgeven zodat alles wat hierop importeerde blijft werken.
export { normaliseerVelden } from "./veld-namen";
export { entiteitenUitJsonLd } from "./json-ld-kennis";
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
  entiteiten: AangeleverdeEntiteit[];
  /** Van wanneer dit aangeleverde materiaal zelf is, en hoe we dat weten. */
  inhoudDatum: string;
  datumBron: DatumBron;
  datumUitleg: string;
};

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
 * Bij welke bestaande regel hoort dit aangeleverde gegeven?
 *
 * Eerst op identiteit: postcode plus huisnummer voor een vestiging, BIG-nummer
 * voor een persoon, anders de naam. Levert dat niets op én draagt het stuk zelf
 * geen adres of BIG (zie magOpNaamKoppelen), dan zoeken we op naam.
 *
 * Waarom dit erbij moest (18-08-2026): een schermafdruk met de openingstijden
 * van tien vestigingen noemt per vestiging alleen de naam en de tijden. De
 * identiteit viel daardoor terug op de naam, terwijl de bestaande regel op
 * postcode plus huisnummer stond. Gevolg: tien nieuwe, adresloze regels naast de
 * bestaande, en die tellen nergens mee, want zonder bezoekadres is iets geen
 * vestiging. De tijden kwamen dus wel binnen en toch nergens aan.
 *
 * Alleen bij precies één naamgenoot, anders zouden twee vestigingen van dezelfde
 * keten (of twee mensen met dezelfde naam) samenvallen. Bij twijfel liever een
 * losse regel die je ziet dan een stille samenvoeging die je niet ziet.
 */
export function koppelSleutel(bestaand: Map<string, KennisEntiteit>, categorie: string, naam: string, velden: Record<string, string>): string {
  const eigen = identiteit(categorie, naam, velden || {});
  if (bestaand.has(eigen)) return eigen;
  if (!magOpNaamKoppelen(categorie, velden || {})) return eigen;
  const kaal = naamKaal(naam);
  if (!kaal) return eigen;
  const treffers = [...bestaand.entries()].filter(([, e]) => e.categorie === categorie && naamKaal(e.naam) === kaal);
  return treffers.length === 1 ? treffers[0][0] : eigen;
}

/**
 * De regel die het meeste houvast geeft, staat vooraan.
 *
 * Belangrijk bij het koppelen hierboven: de regel mét adres moet als eerste in
 * het register staan, anders wordt de adresloze regel het anker en koppelt de
 * regel met adres er niet meer aan vast (die mag immers niet op naam gokken).
 */
function ankerEerst(a: KennisEntiteit, b: KennisEntiteit): number {
  const hard = (e: KennisEntiteit) => (magOpNaamKoppelen(e.categorie, e.velden) ? 0 : 1);
  return hard(b) - hard(a) || Object.keys(b.velden).length - Object.keys(a.velden).length;
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
  // De regels met een echt adres of BIG-nummer eerst, want die zijn het anker
  // waar een aanlevering zonder adres straks op naam aan vastgeknoopt wordt.
  const byKey = new Map<string, KennisEntiteit>();
  for (const e of [...huidig].sort(ankerEerst)) {
    const k = identiteit(e.categorie, e.naam, e.velden);
    if (!byKey.has(k)) byKey.set(k, e);
  }
  let verwerkt = 0;
  const botsingen: string[] = [];
  for (const e of entiteiten) {
    const sleutelId = koppelSleutel(byKey, e.categorie, e.naam, e.velden || {});
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
  // Dezelfde koppelregel als bij het verwerken, zodat een adresloze regel die
  // eerder als los gegeven is binnengekomen (de openingstijden-schermafdruk)
  // alsnog bij zijn vestiging landt in plaats van er eeuwig naast te blijven staan.
  const groepen = new Map<string, KennisEntiteit[]>();
  const anker = new Map<string, KennisEntiteit>();
  for (const e of [...huidig].sort(ankerEerst)) {
    const k = koppelSleutel(anker, e.categorie, e.naam, e.velden);
    if (!anker.has(k)) anker.set(k, e);
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

const vul = (huidig: string, nieuw: string) => (String(huidig || "").trim() ? huidig : String(nieuw || "").trim());

/**
 * Hetzelfde als vul(), maar een ingevulde waarde mag wél wijken voor iets dat
 * aantoonbaar nieuwer is.
 *
 * Waarom dit erbij hoort (18-08-2026): de datumregel gold tot nu toe alleen in de
 * kennisbank. Het formulier ernaast werd alleen aangevuld waar het leeg was, dus
 * stuurde een klant nieuwe openingstijden, dan nam de kennisbank die netjes over
 * en bleef in het formulier de oude tijd staan. Dan klopt de regel tot halverwege.
 *
 * Waartegen wordt gemeten: de laatste keer dat het formulier is opgeslagen. Per
 * veld weten we dat niet, per formulier wel, en dat is precies genoeg voor de
 * afspraak die telt: **wat jij zelf hebt ingevuld wint, tot er materiaal komt van
 * ná jouw wijziging.** Zonder datum op het materiaal gebeurt er niets, net als
 * overal elders: onbekend overschrijft nooit.
 */
type Vervanging = { wat: string; pad: string; oud: string; nieuw: string; datum: string; bron: DatumBron; waar: string };
function vulOfVervang(
  huidig: string, nieuw: string, stempel: VeldStempel | undefined,
  /** De datum van dít veld in het formulier, of de formulierdatum als terugval. */
  veldDatum: string, pad: string, wat: string, log: Vervanging[],
): string {
  const oud = String(huidig || "").trim();
  const waarde = String(nieuw || "").trim();
  if (!waarde) return huidig;
  if (!oud) return waarde;
  if (oud === waarde) return huidig;
  if (!isNieuwerDan(stempel?.datum || "", veldDatum)) return huidig;
  log.push({
    wat, pad, oud, nieuw: waarde,
    datum: stempel?.datum || "", bron: stempel?.bron || "onbekend", waar: stempel?.waar || "",
  });
  return waarde;
}

export async function applyKnowledgeToOrg(slug: string): Promise<{ gevuld: number; nieuweVestigingen: number; nieuweArtsen: number; vervangen: string[] }> {
  const [rec, entiteiten] = await Promise.all([getOrgData(slug), listKnowledge(slug)]);
  if (rec.locked) return { gevuld: 0, nieuweVestigingen: 0, nieuweArtsen: 0, vervangen: [] };
  const voor = JSON.stringify(rec.data);
  const client = await getClientBySlug(slug).catch(() => null);
  // De laatste keer dat dit formulier is opgeslagen. Alleen materiaal van ná dat
  // moment mag een ingevulde waarde vervangen.
  const { data, nieuweVestigingen, nieuweArtsen, vervangen } =
    kennisNaarOrg(rec.data, entiteiten, client?.domain || "", rec.updatedAt || "", rec.veldStempels || {});
  const gevuld = JSON.stringify(data) === voor ? 0 : 1;
  if (gevuld) {
    // Elk veld dat uit de kennisbank kwam krijgt de datum van dát materiaal, niet
    // de datum van nu: anders zou het meteen "vers" lijken en zou het volgende
    // klantdocument het altijd verliezen. Velden die Maarten zelf zette blijven
    // staan zoals ze stonden.
    const stempels: OrgVeldStempels = { ...(rec.veldStempels || {}) };
    for (const v of vervangen) stempels[v.pad] = { datum: v.datum, bron: v.bron, waar: v.waar };
    // Nieuw gevulde lege velden ook stempelen, met de datum van het materiaal.
    for (const [pad, waarde] of Object.entries(plattePaden(data))) {
      if (stempels[pad] || plattePaden(rec.data)[pad] === waarde) continue;
      stempels[pad] = { datum: rec.updatedAt || "", bron: "onbekend", waar: "uit de kennisbank" };
    }
    await saveOrgData(slug, data, "admin", stempels);
  }
  return {
    gevuld, nieuweVestigingen, nieuweArtsen,
    vervangen: vervangen.map((v) => `${v.wat}: "${kort(v.nieuw)}" vervangt "${kort(v.oud)}" (materiaal van ${leesbaar(v.datum)}).`),
  };
}

// De omzetting zelf: los van de database, zodat hij te controleren is.
export function kennisNaarOrg(
  bron: OrgData, entiteiten: KennisEntiteit[], eigenDomein = "",
  /** Wanneer het formulier voor het laatst is opgeslagen: de terugval voor velden
      die nog geen eigen datum hebben (alles van vóór 18-08-2026). */
  formulierDatum = "",
  /** Per veld wanneer die waarde er kwam. Dít is waar tegen gemeten wordt. */
  formulierStempels: OrgVeldStempels = {},
): { data: OrgData; nieuweVestigingen: number; nieuweArtsen: number; vervangen: Vervanging[] } {
  const vervangen: Vervanging[] = [];
  // De datum van één veld: die van het veld zelf, en anders die van het hele
  // formulier. Zo geldt de afspraak meteen ook voor gegevens van vóór vandaag.
  const datumVan = (pad: string) => formulierStempels[pad]?.datum || formulierDatum;
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
    // Aanvullen waar het leeg is, en vervangen waar het materiaal aantoonbaar
    // nieuwer is dan de laatste keer dat dit formulier is opgeslagen.
    const neem = (huidig: string, veld: string, waarde: string, wat: string, pad = veld) =>
      vulOfVervang(huidig, waarde, o.stempels?.[veld], datumVan(pad), pad, wat, vervangen);
    d.bedrijfsnaam = vul(d.bedrijfsnaam, o.naam);
    d.telefoon = neem(d.telefoon, "telefoon", v.telefoon, "Telefoon");
    d.email = neem(d.email, "email", v.email, "E-mailadres");
    d.kvk = neem(d.kvk, "kvk", v.kvk, "KVK-nummer");
    d.btw = neem(d.btw, "btw", v.btw, "Btw-id");
    d.logoUrl = neem(d.logoUrl, "logo", v.logo, "Logo", "logoUrl");
    d.oprichtingsjaar = neem(d.oprichtingsjaar, "oprichtingsjaar", v.oprichtingsjaar, "Oprichtingsjaar");
    d.openingstijden = neem(d.openingstijden, "openingstijden", v.openingstijden, "Openingstijden");
    if (v.adres) {
      const a = splitsAdres(v.adres);
      d.straat = neem(d.straat, "adres", a.straat, "Straat", "straat");
      d.postcode = neem(d.postcode, "adres", a.postcode, "Postcode", "postcode");
      d.plaats = neem(d.plaats, "adres", a.plaats, "Plaats", "plaats");
    }
    d.priceRange = neem(d.priceRange, "priceRange", v.priceRange, "Prijsindicatie");
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
    const rijSleutel = padSleutel(rij.postcode || l.velden.postcode || "") || padSleutel(rij.naam || l.naam) || padSleutel(rij.plaats || "");
    const neem = (huidig: string, veld: string, waarde: string, wat: string, padVeld = veld) =>
      vulOfVervang(huidig, waarde, l.stempels?.[veld], datumVan(`vestiging|${rijSleutel}|${padVeld}`),
        `vestiging|${rijSleutel}|${padVeld}`, `${l.naam}, ${wat}`, vervangen);
    rij.naam = vul(rij.naam, l.naam);
    rij.straat = neem(rij.straat, "adres", a.straat, "straat", "straat");
    rij.postcode = neem(rij.postcode, "postcode", l.velden.postcode || a.postcode, "postcode");
    rij.plaats = neem(rij.plaats, "plaats", l.velden.plaats || a.plaats, "plaats");
    rij.telefoon = neem(rij.telefoon, "telefoon", l.velden.telefoon, "telefoon");
    rij.email = neem(rij.email, "email", l.velden.email, "e-mailadres");
    rij.openingstijden = neem(rij.openingstijden, "openingstijden", l.velden.openingstijden, "openingstijden");
    rij.mapsUrl = neem(rij.mapsUrl, "mapsUrl", l.velden.mapsUrl, "Google Maps");
    // Verhuist de sleutel doordat er nu een postcode bij staat, dan verhuist de
    // datum mee; anders zou dit veld morgen weer "geen datum" hebben.
    if (!bestaand) { d.vestigingen.push(rij); nieuweVestigingen++; }
  }

  // Personen → artsen en behandelaren.
  for (const p of entiteiten.filter((e) => e.categorie === "persoon")) {
    const kern = identiteit("persoon", p.naam, p.velden);
    const bestaand = d.artsen.find((a) => identiteit("persoon", a.naam, { big: a.big }) === kern);
    const rij = bestaand || { naam: p.naam, functie: "", specialisatie: "", big: "", fotoUrl: "", profielUrl: "" };
    if (p.naam.length > rij.naam.length) rij.naam = p.naam;
    const artsSleutel = padSleutel(rij.big || p.velden.big || "") || padSleutel(rij.naam || p.naam);
    const neem = (huidig: string, veld: string, waarde: string, wat: string, padVeld = veld) =>
      vulOfVervang(huidig, waarde, p.stempels?.[veld], datumVan(`arts|${artsSleutel}|${padVeld}`),
        `arts|${artsSleutel}|${padVeld}`, `${p.naam}, ${wat}`, vervangen);
    rij.functie = neem(rij.functie, "functie", p.velden.functie, "functie");
    rij.specialisatie = neem(rij.specialisatie, "specialisatie", p.velden.specialisatie, "specialisatie");
    rij.big = neem(rij.big, "big", p.velden.big, "BIG-nummer");
    rij.fotoUrl = neem(rij.fotoUrl, "foto", p.velden.foto, "foto", "fotoUrl");
    rij.profielUrl = neem(rij.profielUrl, "profielUrl", p.velden.profielUrl || p.velden.linkedin, "pagina", "profielUrl");
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

  return { data: d, nieuweVestigingen, nieuweArtsen, vervangen };
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
