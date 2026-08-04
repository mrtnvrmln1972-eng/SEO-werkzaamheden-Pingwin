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

export async function getOpenProposal(slug: string): Promise<KennisVoorstel | null> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT id, bron, samenvatting, velden FROM client_schema_knowledge
    WHERE client_slug = ${slug} AND soort = 'drop' AND status = 'voorstel' ORDER BY id DESC LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  const v = (r.velden as { entiteiten?: KennisVoorstel["entiteiten"] }) || {};
  return { id: r.id as number, bron: (r.bron as string) || "", samenvatting: (r.samenvatting as string) || "", entiteiten: v.entiteiten || [] };
}

// Drop → AI structureert naar entiteiten en vergelijkt met wat er al staat.
export async function proposeKnowledge(slug: string, bron: string, tekst: string): Promise<KennisVoorstel> {
  await ensureSchema();
  await ensureTable();
  const huidig = await listKnowledge(slug);
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
  // Eventueel ouder open voorstel sluiten: er is altijd maar één voorstel open.
  await sql`UPDATE client_schema_knowledge SET status = 'genegeerd' WHERE client_slug = ${slug} AND soort = 'drop' AND status = 'voorstel'`;
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
  const key = (c: string, n: string) => `${c}|${n.trim().toLowerCase()}`;
  const byKey = new Map(huidig.map((e) => [key(e.categorie, e.naam), e]));
  let verwerkt = 0;
  for (const e of entiteiten) {
    const bestaand = byKey.get(key(e.categorie, e.naam));
    // Samenvoegen: nieuwe waarden winnen per veld, bestaande velden zonder nieuwe waarde blijven.
    const velden = { ...(bestaand?.velden || {}), ...Object.fromEntries(Object.entries(e.velden || {}).filter(([, v]) => String(v || "").trim())) };
    if (bestaand) await sql`UPDATE client_schema_knowledge SET status = 'vervangen' WHERE client_slug = ${slug} AND id = ${bestaand.id}`;
    await sql`
      INSERT INTO client_schema_knowledge (client_slug, soort, categorie, naam, velden, bron, status)
      VALUES (${slug}, 'entiteit', ${e.categorie}, ${e.naam.trim()}, ${JSON.stringify(velden)}, ${`voorstel #${id}`}, 'actueel')`;
    verwerkt++;
  }
  await sql`UPDATE client_schema_knowledge SET status = 'verwerkt' WHERE client_slug = ${slug} AND id = ${id}`;
  return { ok: true, verwerkt };
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

const sleutel = (s: string) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const vul = (huidig: string, nieuw: string) => (String(huidig || "").trim() ? huidig : String(nieuw || "").trim());

export async function applyKnowledgeToOrg(slug: string): Promise<{ gevuld: number; nieuweVestigingen: number; nieuweArtsen: number }> {
  const [rec, entiteiten] = await Promise.all([getOrgData(slug), listKnowledge(slug)]);
  if (rec.locked) return { gevuld: 0, nieuweVestigingen: 0, nieuweArtsen: 0 };
  const d: OrgData = JSON.parse(JSON.stringify(rec.data));
  const voor = JSON.stringify(d);
  let nieuweVestigingen = 0, nieuweArtsen = 0;

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
    for (const link of [v.linkedin, v.profielUrl, v.mapsUrl]) {
      const u = String(link || "").trim();
      if (/^https?:\/\//i.test(u) && !d.sameAs.some((s) => sleutel(s) === sleutel(u))) d.sameAs.push(u);
    }
  }

  // Locaties → vestigingen (elke locatie een eigen rij met adres en tijden).
  for (const l of entiteiten.filter((e) => e.categorie === "locatie")) {
    const a = splitsAdres(l.velden.adres || "");
    const bestaand = d.vestigingen.find((x) => sleutel(x.naam) === sleutel(l.naam) || (a.plaats && sleutel(x.plaats) === sleutel(a.plaats) && !x.naam));
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
    const bestaand = d.artsen.find((a) => sleutel(a.naam) === sleutel(p.naam));
    const rij = bestaand || { naam: p.naam, functie: "", specialisatie: "", big: "", fotoUrl: "", profielUrl: "" };
    rij.functie = vul(rij.functie, p.velden.functie);
    rij.specialisatie = vul(rij.specialisatie, p.velden.specialisatie);
    rij.big = vul(rij.big, p.velden.big);
    rij.fotoUrl = vul(rij.fotoUrl, p.velden.foto);
    rij.profielUrl = vul(rij.profielUrl, p.velden.profielUrl || p.velden.linkedin);
    if (!bestaand) { d.artsen.push(rij); nieuweArtsen++; }
  }

  // Diensten → dienstenlijst.
  for (const s of entiteiten.filter((e) => e.categorie === "dienst")) {
    const bestaand = d.diensten.find((x) => sleutel(x.naam) === sleutel(s.naam));
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

  const gevuld = JSON.stringify(d) === voor ? 0 : 1;
  if (gevuld) await saveOrgData(slug, d, "admin");
  return { gevuld, nieuweVestigingen, nieuweArtsen };
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
    if (d.vestigingen.some((v) => sleutel(v.naam) === sleutel(l.naam))) continue;
    const a = splitsAdres(l.velden.adres || "");
    d.vestigingen.push({
      ...LEGE_VESTIGING, naam: l.naam, straat: a.straat,
      postcode: l.velden.postcode || a.postcode, plaats: l.velden.plaats || a.plaats,
      telefoon: l.velden.telefoon || "", email: l.velden.email || "",
      openingstijden: l.velden.openingstijden || "", mapsUrl: l.velden.mapsUrl || "",
    });
  }
  for (const p of entiteiten.filter((e) => e.categorie === "persoon")) {
    if (d.artsen.some((a) => sleutel(a.naam) === sleutel(p.naam))) continue;
    d.artsen.push({
      naam: p.naam, functie: p.velden.functie || "", specialisatie: p.velden.specialisatie || "",
      big: p.velden.big || "", fotoUrl: p.velden.foto || "", profielUrl: p.velden.profielUrl || p.velden.linkedin || "",
    });
  }
  for (const s of entiteiten.filter((e) => e.categorie === "dienst")) {
    if (!d.diensten.some((x) => sleutel(x.naam) === sleutel(s.naam))) d.diensten.push({ naam: s.naam, omschrijving: s.velden.omschrijving || "" });
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
