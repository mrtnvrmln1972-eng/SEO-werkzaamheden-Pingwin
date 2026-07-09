import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { callClaude } from "./anthropic";
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
};

export const EMPTY_ORG: OrgData = {
  bedrijfsnaam: "", bedrijfstype: "", rechtsvorm: "", kvk: "", btw: "", telefoon: "", email: "",
  straat: "", postcode: "", plaats: "", geenBezoekadres: false, openingstijden: "", logoUrl: "",
  priceRange: "", oprichtingsjaar: "", sameAs: [], areaServed: [], reviewUrl: "", reviewGemiddelde: "",
  reviewAantal: "", notitie: "",
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
  const token = crypto.randomBytes(18).toString("base64url");
  await sql`INSERT INTO client_org_data (client_slug, data, share_token) VALUES (${slug}, ${JSON.stringify(EMPTY_ORG)}, ${token}) ON CONFLICT (client_slug) DO NOTHING`;
  return { data: { ...EMPTY_ORG }, locked: false, shareToken: token, updatedAt: null, updatedBy: "" };
}

export async function saveOrgData(slug: string, data: OrgData, by: "admin" | "klant"): Promise<{ ok: boolean; error?: string }> {
  await ensureSchema();
  await ensureTable();
  const current = await getOrgData(slug);
  if (current.locked && by === "klant") return { ok: false, error: "Deze gegevens zijn vergrendeld; alleen Pingwin kan ze nog aanpassen." };
  await sql`
    INSERT INTO client_org_data (client_slug, data, updated_by, updated_at) VALUES (${slug}, ${JSON.stringify(normalize(data))}, ${by}, now())
    ON CONFLICT (client_slug) DO UPDATE SET data = ${JSON.stringify(normalize(data))}, updated_by = ${by}, updated_at = now()`;
  return { ok: true };
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

export async function autofillOrgData(slug: string): Promise<{ ok: boolean; data?: OrgData; error?: string }> {
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

  const system = `Je vult een bedrijfsgegevens-formulier in op basis van de website van het bedrijf (tekst + bestaande JSON-LD hieronder). Dit formulier wordt de bron voor schema.org structured data.
Geef UITSLUITEND geldige JSON met exact deze velden (string tenzij anders vermeld; onvindbaar = lege string/lege lijst, NOOIT gokken of verzinnen):
{"bedrijfsnaam":"","bedrijfstype":"kliniek|webshop|dienstverlener|lokaal|informatief","rechtsvorm":"","kvk":"","btw":"","telefoon":"","email":"","straat":"","postcode":"","plaats":"","geenBezoekadres":false,"openingstijden":"","logoUrl":"","priceRange":"","oprichtingsjaar":"","sameAs":[],"areaServed":[],"reviewUrl":"","reviewGemiddelde":"","reviewAantal":"","notitie":""}
- bedrijfstype: kies wat het beste past. kliniek = zorg/medisch; webshop = verkoopt producten online; dienstverlener = diensten/lead-gen (ook aan huis); lokaal = fysieke locatie waar klanten komen (winkel/praktijk/restaurant); informatief = vooral content.
- geenBezoekadres: true als het duidelijk een aan-huis/ambulant bedrijf is zonder bezoeklocatie.
- sameAs: volledige URL's van sociale profielen en een Google Business/Maps-link als die op de site staat.
- areaServed: plaatsen/regio's die de site expliciet noemt als werkgebied.
- reviewGemiddelde/reviewAantal: ALLEEN als er op de site zichtbaar een gemiddelde en aantal staan.
- openingstijden: leesbaar samenvatten, bijv. "ma t/m vr 9:00-17:30, za 10:00-14:00".
- notitie: één zin met wat je NIET kon vinden en de klant moet aanvullen.`;

  const user = `BESTAANDE JSON-LD OP DE SITE:\n${jsonLd.join("\n---\n") || "(geen aangetroffen)"}\n\n${textParts.join("\n\n")}`;
  try {
    const raw = await callClaude(system, [{ role: "user", content: user.slice(0, 90000) }], 2000, { slug, action: "org_autofill" });
    const parsed = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());
    const data = normalize(parsed);
    await saveOrgData(slug, data, "admin");
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: `Automatisch vullen mislukt: ${(e as Error).message}` };
  }
}
