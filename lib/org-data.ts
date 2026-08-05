import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { callClaudeWebSearch } from "./anthropic";
import { LEGE_VESTIGING, identiteit, naamKaal, ontbrekendeVelden, type OrgVestiging } from "./org-vereist";
import crypto from "crypto";

// ═══════════════════════════════════════════════════════════
// BEDRIJFSGEGEVENS PER KLANT (fundament voor structured data)
// ═══════════════════════════════════════════════════════════
// Eén formulier per klant met de organisatiegegevens die het site-brede
// schema-blok (Organization/LocalBusiness + WebSite) nodig heeft. Automatisch
// gevuld vanaf de website, deelbaar met de klant via een token-link (nalopen
// en aanvullen), en vergrendelbaar: na de lock is dit de vaste bron voor alle
// structured-data-generatie (stap 7 per pagina + site-wide).
// ═══════════════════════════════════════════════════════════

export type OrgData = {
  bedrijfsnaam: string;
  // Stuurt de schema-keuze: kliniek → MedicalClinic, webshop → Product-focus,
  // dienstverlener → Service+Organization, lokaal → LocalBusiness, informatief → Article-focus.
  bedrijfstype: "" | "kliniek" | "webshop" | "dienstverlener" | "lokaal" | "informatief";
  rechtsvorm: string;
  kvk: string;
  btw: string;
  telefoon: string;
  email: string;
  straat: string;
  postcode: string;
  plaats: string;
  geenBezoekadres: boolean; // aan-huis-bedrijf: dan geen LocalBusiness-adres forceren
  openingstijden: string;   // leesbare notatie, bijv. "ma t/m vr 9:00-17:00"
  logoUrl: string;
  priceRange: string;       // bijv. "€€" of "vanaf €1.500"
  oprichtingsjaar: string;
  sameAs: string[];         // socials, Google Business-URL, KVK-URL, Wikipedia
  areaServed: string[];     // plaatsen/regio's (voor dienstverleners zonder bezoekadres)
  reviewUrl: string;
  reviewGemiddelde: string; // alleen als het zichtbaar/echt is
  reviewAantal: string;
  notitie: string;
  // Vestigingen: elke locatie met eigen adres en openingstijden. Bij meerdere
  // vestigingen zijn dít de adressen (het hoofdadres hierboven blijft leeg mogen).
  vestigingen: OrgVestiging[];
  // Type-specifieke aanvullingen (welke sectie getoond wordt volgt uit bedrijfstype):
  artsen: { naam: string; functie: string; specialisatie: string; big: string; fotoUrl: string; profielUrl: string }[]; // kliniek
  merken: string[];        // webshop
  retourUrl: string;       // webshop: pagina met retourbeleid
  retourTermijn: string;   // webshop: bijv. "30 dagen"
  verzendInfo: string;     // webshop: bijv. "gratis vanaf €50, levering 1-2 werkdagen"
  diensten: { naam: string; omschrijving: string }[]; // dienstverlener
};

export const EMPTY_ORG: OrgData = {
  bedrijfsnaam: "", bedrijfstype: "", rechtsvorm: "", kvk: "", btw: "", telefoon: "", email: "",
  straat: "", postcode: "", plaats: "", geenBezoekadres: false, openingstijden: "", logoUrl: "",
  priceRange: "", oprichtingsjaar: "", sameAs: [], areaServed: [], reviewUrl: "", reviewGemiddelde: "",
  reviewAantal: "", notitie: "", vestigingen: [],
  artsen: [], merken: [], retourUrl: "", retourTermijn: "", verzendInfo: "", diensten: [],
};

export type OrgRecord = { data: OrgData; locked: boolean; shareToken: string; updatedAt: string | null; updatedBy: string };

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_org_data (
      client_slug TEXT PRIMARY KEY,
      data        JSONB NOT NULL DEFAULT '{}',
      locked      BOOLEAN NOT NULL DEFAULT false,
      share_token TEXT,
      updated_by  TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}

function normalize(raw: unknown): OrgData {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : "");
  const arr = (k: string) => (Array.isArray(r[k]) ? (r[k] as unknown[]).map(String).filter(Boolean) : []);
  const type = str("bedrijfstype");
  return {
    ...EMPTY_ORG,
    bedrijfsnaam: str("bedrijfsnaam"), rechtsvorm: str("rechtsvorm"), kvk: str("kvk"), btw: str("btw"),
    telefoon: str("telefoon"), email: str("email"), straat: str("straat"), postcode: str("postcode"),
    plaats: str("plaats"), geenBezoekadres: !!r.geenBezoekadres, openingstijden: str("openingstijden"),
    logoUrl: str("logoUrl"), priceRange: str("priceRange"), oprichtingsjaar: str("oprichtingsjaar"),
    sameAs: arr("sameAs"), areaServed: arr("areaServed"), reviewUrl: str("reviewUrl"),
    reviewGemiddelde: str("reviewGemiddelde"), reviewAantal: str("reviewAantal"), notitie: str("notitie"),
    bedrijfstype: (["kliniek", "webshop", "dienstverlener", "lokaal", "informatief"].includes(type) ? type : "") as OrgData["bedrijfstype"],
    retourUrl: str("retourUrl"), retourTermijn: str("retourTermijn"), verzendInfo: str("verzendInfo"),
    merken: arr("merken"),
    vestigingen: (Array.isArray(r.vestigingen) ? (r.vestigingen as Record<string, unknown>[]) : [])
      .filter((v) => v && typeof v === "object")
      .map((v) => ({
        ...LEGE_VESTIGING,
        naam: String(v.naam || "").trim(), straat: String(v.straat || "").trim(), postcode: String(v.postcode || "").trim(),
        plaats: String(v.plaats || "").trim(), telefoon: String(v.telefoon || "").trim(), email: String(v.email || "").trim(),
        openingstijden: String(v.openingstijden || "").trim(), mapsUrl: String(v.mapsUrl || "").trim(),
      }))
      .filter((v) => v.naam || v.straat || v.plaats),
    artsen: (Array.isArray(r.artsen) ? (r.artsen as Record<string, unknown>[]) : [])
      .filter((a) => a && typeof a === "object")
      .map((a) => ({
        naam: String(a.naam || "").trim(), functie: String(a.functie || "").trim(), specialisatie: String(a.specialisatie || "").trim(),
        big: String(a.big || "").trim(), fotoUrl: String(a.fotoUrl || "").trim(), profielUrl: String(a.profielUrl || "").trim(),
      }))
      .filter((a) => a.naam),
    diensten: (Array.isArray(r.diensten) ? (r.diensten as Record<string, unknown>[]) : [])
      .filter((d) => d && typeof d === "object")
      .map((d) => ({ naam: String(d.naam || "").trim(), omschrijving: String(d.omschrijving || "").trim() }))
      .filter((d) => d.naam),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRecord(r: any): OrgRecord {
  return {
    data: normalize(typeof r.data === "string" ? JSON.parse(r.data) : r.data),
    locked: !!r.locked,
    shareToken: (r.share_token as string) || "",
    updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
    updatedBy: (r.updated_by as string) || "",
  };
}

// Bestaat deze klant echt? Zonder deze controle maakte élke typefout in een
// klantnaam hieronder een lege rij aan die bij niemand hoort.
async function klantBestaat(slug: string): Promise<boolean> {
  if (!String(slug || "").trim()) return false;
  return !!(await getClientBySlug(slug).catch(() => null));
}

export async function getOrgData(slug: string): Promise<OrgRecord> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT * FROM client_org_data WHERE client_slug = ${slug} LIMIT 1`;
  if (rows[0]) {
    const rec = rowToRecord(rows[0]);
    if (!rec.shareToken) {
      rec.shareToken = crypto.randomBytes(18).toString("base64url");
      await sql`UPDATE client_org_data SET share_token = ${rec.shareToken} WHERE client_slug = ${slug}`;
    }
    return rec;
  }
  // Nog geen rij: alleen aanmaken voor een klant die echt bestaat.
  if (!(await klantBestaat(slug))) return { data: { ...EMPTY_ORG }, locked: false, shareToken: "", updatedAt: null, updatedBy: "" };
  const token = crypto.randomBytes(18).toString("base64url");
  await sql`INSERT INTO client_org_data (client_slug, data, share_token) VALUES (${slug}, ${JSON.stringify(EMPTY_ORG)}, ${token}) ON CONFLICT (client_slug) DO NOTHING`;
  return { data: { ...EMPTY_ORG }, locked: false, shareToken: token, updatedAt: null, updatedBy: "" };
}

export async function saveOrgData(slug: string, data: OrgData, by: "admin" | "klant"): Promise<{ ok: boolean; error?: string }> {
  await ensureSchema();
  await ensureTable();
  if (!(await klantBestaat(slug))) return { ok: false, error: "Deze klant bestaat niet (meer)." };
  const current = await getOrgData(slug);
  if (current.locked && by === "klant") return { ok: false, error: "Deze gegevens zijn vergrendeld; alleen Pingwin kan ze nog aanpassen." };
  await sql`
    INSERT INTO client_org_data (client_slug, data, updated_by, updated_at) VALUES (${slug}, ${JSON.stringify(normalize(data))}, ${by}, now())
    ON CONFLICT (client_slug) DO UPDATE SET data = ${JSON.stringify(normalize(data))}, updated_by = ${by}, updated_at = now()`;
  return { ok: true };
}

// Wees-regels opruimen: bedrijfsgegevens die bij geen enkele klant horen én
// helemaal leeg zijn. Zulke rijen ontstonden door een verkeerd gespelde
// klantnaam op te vragen. De voorwaarde is bewust dubbel: geen klant met die
// naam ÉN geen enkel ingevuld veld. Eén gevulde waarde en de rij blijft staan,
// zodat er nooit iets verdwijnt dat ergens bij hoort.
export async function opruimWeesOrgData(): Promise<number> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT o.client_slug, o.data, o.locked
    FROM client_org_data o
    LEFT JOIN clients c ON c.slug = o.client_slug
    WHERE c.slug IS NULL`;
  let weg = 0;
  for (const r of rows) {
    if (r.locked) continue; // vergrendeld is nooit zomaar weg te gooien
    const d = normalize(typeof r.data === "string" ? JSON.parse(r.data as string) : r.data);
    const gevuld = Object.entries(d).some(([k, v]) => {
      if (k === "geenBezoekadres") return v === true;
      if (Array.isArray(v)) return v.length > 0;
      return String(v ?? "").trim() !== "";
    });
    if (gevuld) continue;
    await sql`DELETE FROM client_org_data WHERE client_slug = ${r.client_slug as string}`;
    weg++;
  }
  return weg;
}

export async function setOrgLocked(slug: string, locked: boolean): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await getOrgData(slug); // rij garanderen
  await sql`UPDATE client_org_data SET locked = ${locked}, updated_at = now() WHERE client_slug = ${slug}`;
}

// Slug opzoeken bij een deel-token (voor de klantpagina zonder login).
export async function getSlugByOrgToken(token: string): Promise<string | null> {
  if (!token) return null;
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT client_slug FROM client_org_data WHERE share_token = ${token} LIMIT 1`;
  return rows[0] ? (rows[0].client_slug as string) : null;
}

// ── Automatisch vullen vanaf de website ──
// Leest de homepage + contact/over-ons-pagina's en alle bestaande JSON-LD uit,
// en laat Claude het formulier zo compleet mogelijk invullen. Onvindbare velden
// blijven leeg (de klant vult aan via de deellink). Er wordt niets verzonnen.

// ─── Samenvoegen in plaats van vervangen ───
// Het automatisch ophalen zette eerder de hele rij in de plaats van wat er stond.
// Eén klik kon daarmee bevestigde vestigingen, BIG-nummers en behandelingen
// wissen. Vanaf nu geldt: wat ingevuld is blijft staan, gevonden gegevens landen
// alleen in lege velden, en onbekende vestigingen/artsen/diensten komen erbij.
export function voegOrgSamen(bestaand: OrgData, gevonden: OrgData): { data: OrgData; gevuld: number; nieuweVestigingen: number; nieuweArtsen: number; nieuweDiensten: number } {
  const d: OrgData = JSON.parse(JSON.stringify(bestaand));
  let gevuld = 0;
  const vul = <K extends keyof OrgData>(k: K) => {
    const huidig = String(d[k] ?? "").trim();
    const nieuw = String(gevonden[k] ?? "").trim();
    if (!huidig && nieuw) { (d[k] as unknown as string) = nieuw; gevuld++; }
  };
  (["bedrijfsnaam", "bedrijfstype", "rechtsvorm", "kvk", "btw", "telefoon", "email", "straat", "postcode",
    "plaats", "openingstijden", "logoUrl", "priceRange", "oprichtingsjaar", "reviewUrl", "reviewGemiddelde",
    "reviewAantal", "retourUrl", "retourTermijn", "verzendInfo", "notitie"] as (keyof OrgData)[]).forEach(vul);

  // Lijsten van losse waarden: aanvullen, nooit vervangen.
  for (const k of ["sameAs", "areaServed", "merken"] as const) {
    for (const w of gevonden[k] || []) {
      if (!d[k].some((x) => naamKaal(x) === naamKaal(w))) { d[k].push(w); gevuld++; }
    }
  }

  const vulRij = (doel: Record<string, string>, bron: Record<string, string>) => {
    for (const [k, v] of Object.entries(bron)) {
      if (String(v || "").trim() && !String(doel[k] || "").trim()) { doel[k] = v; gevuld++; }
    }
  };
  const vestId = (v: OrgVestiging) => identiteit("locatie", v.naam, { adres: v.straat, postcode: v.postcode, plaats: v.plaats });
  let nieuweVestigingen = 0, nieuweArtsen = 0, nieuweDiensten = 0;
  for (const v of gevonden.vestigingen || []) {
    // Op adres én op naam vergelijken. Vindt het web een afwijkend adres voor een
    // vestiging die we al kennen, dan hoort dat geen tweede regel op te leveren:
    // de naam wijst hem aan, en het bestaande adres blijft gewoon staan.
    const bestaandeRij = d.vestigingen.find((x) => vestId(x) === vestId(v))
      || (naamKaal(v.naam) ? d.vestigingen.find((x) => naamKaal(x.naam) === naamKaal(v.naam)) : undefined);
    if (bestaandeRij) vulRij(bestaandeRij as unknown as Record<string, string>, v as unknown as Record<string, string>);
    else { d.vestigingen.push({ ...v }); nieuweVestigingen++; }
  }
  for (const a of gevonden.artsen || []) {
    const bestaandeRij = d.artsen.find((x) => identiteit("persoon", x.naam, { big: x.big }) === identiteit("persoon", a.naam, { big: a.big }));
    if (bestaandeRij) vulRij(bestaandeRij as unknown as Record<string, string>, a as unknown as Record<string, string>);
    else { d.artsen.push({ ...a }); nieuweArtsen++; }
  }
  for (const s of gevonden.diensten || []) {
    const bestaandeRij = d.diensten.find((x) => naamKaal(x.naam) === naamKaal(s.naam));
    if (bestaandeRij) vulRij(bestaandeRij as unknown as Record<string, string>, s as unknown as Record<string, string>);
    else { d.diensten.push({ ...s }); nieuweDiensten++; }
  }
  return { data: d, gevuld, nieuweVestigingen, nieuweArtsen, nieuweDiensten };
}

async function fetchPage(url: string): Promise<string> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 15000);
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; PingwinDashboard)" }, signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return "";
    return await res.text();
  } catch { return ""; }
}

function extractJsonLd(html: string): string[] {
  const out: string[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) { const t = (m[1] || "").trim(); if (t) out.push(t.slice(0, 6000)); }
  return out.slice(0, 6);
}

function htmlToText(html: string): string {
  return (html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

// Ophalen wat er nog ontbreekt. Vult alleen lege plekken; overschrijft nooit.
export async function autofillOrgData(slug: string): Promise<{ ok: boolean; data?: OrgData; error?: string; gevuld?: number; nieuweVestigingen?: number; nieuweArtsen?: number; nieuweDiensten?: number }> {
  const client = await getClientBySlug(slug);
  const domain = (client?.domain || "").trim();
  if (!domain) return { ok: false, error: "Deze klant heeft nog geen domein ingevuld." };
  const base = (domain.match(/^https?:\/\//i) ? domain : `https://${domain}`).replace(/\/+$/, "");

  const homeHtml = await fetchPage(base);
  if (!homeHtml) return { ok: false, error: "De website is niet bereikbaar om uit te lezen." };

  // Contact/over-ons-pagina's vinden via de links op de homepage.
  const linkRe = /href=["']([^"'#?]+)["']/gi;
  const candidates = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(homeHtml))) {
    const href = m[1];
    if (/contact|over-ons|over_ons|overons|about|team|praktijk|kliniek/i.test(href)) {
      try {
        const u = new URL(href, base);
        if (u.hostname.replace(/^www\./, "") === new URL(base).hostname.replace(/^www\./, "")) candidates.add(u.toString());
      } catch { /* geen geldige link */ }
    }
  }
  const extraPages = Array.from(candidates).slice(0, 3);
  const extraHtml = await Promise.all(extraPages.map(fetchPage));

  const jsonLd = [homeHtml, ...extraHtml].flatMap(extractJsonLd);
  const textParts = [
    `HOMEPAGE (${base}):\n${htmlToText(homeHtml).slice(0, 6000)}`,
    ...extraPages.map((u, i) => `PAGINA ${u}:\n${htmlToText(extraHtml[i] || "").slice(0, 5000)}`),
  ];

  const system = `Je vult een bedrijfsgegevens-formulier in voor schema.org structured data. Je hebt twee bronnen: (1) de website van het bedrijf (tekst + bestaande JSON-LD hieronder) en (2) het web via je zoekfunctie.
GEBRUIK JE ZOEKFUNCTIE ACTIEF voor wat niet op de site staat: het KVK-nummer (zoek in het KVK-register/kvk.nl), de Google Business-vermelding (Google Maps-link + zichtbaar reviewgemiddelde en -aantal), sociale profielen (Facebook, Instagram, LinkedIn, YouTube), reviewplatforms (Trustpilot, Klantenvertellen, Google) en het oprichtingsjaar.
VERIFICATIE-EIS: neem een gevonden gegeven alleen op als het aantoonbaar bij DIT bedrijf hoort (zelfde naam plus zelfde plaats/domein/telefoon). Bij naamgenoten of twijfel: veld leeg laten en in "notitie" vermelden. Reviewcijfers alleen invullen met de bron-URL erbij in reviewUrl.
Geef UITSLUITEND geldige JSON met exact deze velden (string tenzij anders vermeld; onvindbaar = lege string/lege lijst, NOOIT gokken of verzinnen):
{"bedrijfsnaam":"","bedrijfstype":"kliniek|webshop|dienstverlener|lokaal|informatief","rechtsvorm":"","kvk":"","btw":"","telefoon":"","email":"","straat":"","postcode":"","plaats":"","geenBezoekadres":false,"openingstijden":"","logoUrl":"","priceRange":"","oprichtingsjaar":"","sameAs":[],"areaServed":[],"reviewUrl":"","reviewGemiddelde":"","reviewAantal":"","notitie":"","vestigingen":[{"naam":"","straat":"","postcode":"","plaats":"","telefoon":"","email":"","openingstijden":"","mapsUrl":""}],"artsen":[{"naam":"","functie":"","specialisatie":"","big":"","fotoUrl":"","profielUrl":""}],"merken":[],"retourUrl":"","retourTermijn":"","verzendInfo":"","diensten":[{"naam":"","omschrijving":""}]}
- bedrijfstype: kies wat het beste past. kliniek = zorg/medisch; webshop = verkoopt producten online; dienstverlener = diensten/lead-gen (ook aan huis); lokaal = fysieke locatie waar klanten komen (winkel/praktijk/restaurant); informatief = vooral content.
- geenBezoekadres: true als het duidelijk een aan-huis/ambulant bedrijf is zonder bezoeklocatie.
- sameAs: volledige URL's van sociale profielen en een Google Business/Maps-link als die op de site staat.
- areaServed: plaatsen/regio's die de site expliciet noemt als werkgebied.
- reviewGemiddelde/reviewAantal: ALLEEN als er op de site zichtbaar een gemiddelde en aantal staan.
- openingstijden: leesbaar samenvatten, bijv. "ma t/m vr 9:00-17:30, za 10:00-14:00".
- vestigingen: ELKE locatie die het bedrijf heeft, met per locatie het volledige adres, telefoon en openingstijden. Heeft het bedrijf maar één locatie, zet die dan óók als vestiging én in de losse adresvelden hierboven. Heeft het meerdere locaties, vul dan alle vestigingen en laat de losse adresvelden leeg of gebruik ze voor het hoofdkantoor. Zoek de ontbrekende adressen en openingstijden actief op (locatie-/contactpagina's en de Google Business-vermelding per vestiging).
- artsen: ALLEEN bij een kliniek/zorgbedrijf: elke arts/behandelaar die op de site staat (team-/over-ons-pagina), met functie, specialisatie en BIG-nummer als dat vermeld staat; anders lege lijst.
- merken/retourUrl/retourTermijn/verzendInfo: ALLEEN bij een webshop, en alleen wat de site zelf vermeldt; anders leeg.
- diensten: ALLEEN bij een dienstverlener: de hoofddiensten van de site (naam + één zin omschrijving); anders lege lijst.
- sameAs: neem ook via de zoekfunctie gevonden en geverifieerde profielen op (volledige URL's).
- notitie: één zin met wat je NIET kon vinden of niet zeker wist (de klant vult aan).`;

  const user = `BESTAANDE JSON-LD OP DE SITE:\n${jsonLd.join("\n---\n") || "(geen aangetroffen)"}\n\n${textParts.join("\n\n")}`;
  try {
    const raw = await callClaudeWebSearch(system, [{ role: "user", content: user.slice(0, 90000) }], 3000, { slug, action: "org_autofill" }, 8);
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
    const gevonden = normalize(parsed);
    const huidig = await getOrgData(slug);
    if (huidig.locked) return { ok: false, error: "Deze gegevens zijn vergrendeld; er wordt niets meer aangevuld." };
    const uitkomst = voegOrgSamen(huidig.data, gevonden);
    if (uitkomst.gevuld) await saveOrgData(slug, uitkomst.data, "admin");
    return {
      ok: true, data: uitkomst.data, gevuld: uitkomst.gevuld,
      nieuweVestigingen: uitkomst.nieuweVestigingen, nieuweArtsen: uitkomst.nieuweArtsen, nieuweDiensten: uitkomst.nieuweDiensten,
    };
  } catch (e) {
    return { ok: false, error: `Automatisch vullen mislukt: ${(e as Error).message}` };
  }
}
