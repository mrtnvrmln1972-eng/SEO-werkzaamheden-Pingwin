import crypto from "crypto";
import { sql, ensureSchema } from "./db";
import { hashPassword, generatePassword } from "./password";

// ═══════════════════════════════════════════════════════════
// KLANTEN (multi-client, uit de database)
// ═══════════════════════════════════════════════════════════
// Eén gedeeld dashboard. Elke klant staat als rij in de tabel "clients".
// Niet-geheim: naam, inlognaam, Google Sheet, budgetbedragen, e-mail.
// Geheim: alleen de wachtwoord-hash (nooit het platte wachtwoord).
// Toevoegen gebeurt via het adminscherm, niet meer in de code.
// ═══════════════════════════════════════════════════════════

export type ClientBudget = {
  maandbudget: number;
  linkbuilding: number;
  urenBudget: number;
  uurtarief: number;
  beschikbareUren: number;
};

export type ClientCockpit = {
  emailDomain: string | null;
  workDocUrl: string | null;
  resultsUrl: string | null;
  status: string | null;
  lastContact: string | null;
  notes: string | null;
};

// Levensfase van een bedrijf in het dashboard. Een lead en een klant zijn
// hetzelfde soort rij; alleen de fase verschilt. Leeg in de database betekent
// "klant", zodat bestaande klanten ongewijzigd blijven werken.
export const FASES = ["lead", "klant", "oud", "verloren"] as const;
export type Fase = (typeof FASES)[number];
export const FASE_LABEL: Record<Fase, string> = {
  lead: "Lead",
  klant: "Klant",
  oud: "Oud-klant",
  verloren: "Niet doorgegaan",
};

export type ClientConfig = {
  id: number;
  slug: string;
  loginId: string;
  name: string;
  // Levensfase; altijd gevuld (leeg in de database wordt "klant").
  fase: Fase;
  email: string | null;
  sheetId: string;
  gid: string;
  domain: string | null;
  ahrefsProjectId: string | null;
  moneybirdContactId: string | null;
  seoProfile: string | null;
  loginEnabled: boolean;
  // Klantgroep: null = eigen Pingwin-klant, "mmc" = Multimedia Concepts.
  grp: string | null;
  // Label van de Ahrefs-sleutel voor deze klant (env AHREFS_API_TOKEN_<LABEL>);
  // null = het hoofdaccount. Nooit de sleutel zelf.
  ahrefsKeyRef: string | null;
  // Inlogpagina van de website-beheeromgeving (leeg = /wp-admin/ achter het domein).
  backendUrl: string | null;
  budget: ClientBudget;
  cockpit: ClientCockpit;
};

type ClientRow = {
  id: number;
  slug: string;
  // Leeg bij een lead (die heeft geen inlog).
  login_id: string | null;
  name: string;
  fase: string | null;
  email: string | null;
  sheet_id: string | null;
  gid: string;
  maandbudget: string | number;
  linkbuilding: string | number;
  urenbudget: string | number;
  uurtarief: string | number;
  beschikbare_uren: string | number;
  password_hash: string | null;
  domain: string | null;
  ahrefs_project_id: string | null;
  moneybird_contact_id: string | null;
  seo_profile: string | null;
  login_enabled: boolean | null;
  grp: string | null;
  ahrefs_key_ref: string | null;
  backend_url: string | null;
  email_domain: string | null;
  work_doc_url: string | null;
  results_url: string | null;
  status: string | null;
  last_contact: string | null;
  notes: string | null;
};

// Lege/onbekende fase telt als "klant": zo blijven alle bestaande rijen, die
// deze kolom nog niet gevuld hebben, zich precies hetzelfde gedragen.
function toFase(v: string | null | undefined): Fase {
  const t = String(v || "").trim().toLowerCase();
  return (FASES as readonly string[]).includes(t) ? (t as Fase) : "klant";
}

function rowToConfig(r: ClientRow): ClientConfig {
  return {
    id: r.id,
    slug: r.slug,
    loginId: r.login_id || "",
    name: r.name,
    fase: toFase(r.fase),
    email: r.email,
    sheetId: r.sheet_id || "",
    gid: r.gid,
    domain: r.domain ?? null,
    ahrefsProjectId: r.ahrefs_project_id ?? null,
    moneybirdContactId: r.moneybird_contact_id ?? null,
    seoProfile: r.seo_profile ?? null,
    loginEnabled: r.login_enabled === null || r.login_enabled === undefined ? true : !!r.login_enabled,
    grp: r.grp || null,
    ahrefsKeyRef: r.ahrefs_key_ref || null,
    backendUrl: r.backend_url || null,
    budget: {
      maandbudget: Number(r.maandbudget),
      linkbuilding: Number(r.linkbuilding),
      urenBudget: Number(r.urenbudget),
      uurtarief: Number(r.uurtarief),
      beschikbareUren: Number(r.beschikbare_uren),
    },
    cockpit: {
      emailDomain: r.email_domain ?? null,
      workDocUrl: r.work_doc_url ?? null,
      resultsUrl: r.results_url ?? null,
      status: r.status ?? null,
      lastContact: r.last_contact ?? null,
      notes: r.notes ?? null,
    },
  };
}

// Bewaart het SEO-klantprofiel (positionering, werkgebied, karakter) dat de
// chat als context gebruikt en waar hij naar vraagt als het ontbreekt.
export async function saveClientProfile(slug: string, profile: string): Promise<void> {
  await ensureSchema();
  await sql`UPDATE clients SET seo_profile = ${profile || null} WHERE slug = ${slug}`;
}

// Witte lijst per klant: mailadressen/domeinen waarvan mail (van/naar) bij deze
// klant mag verschijnen bij "Laatste mails". Leeg = alles tonen (geen filter).
export async function getMailAllowlist(slug: string): Promise<string> {
  await ensureSchema();
  const { rows } = await sql`SELECT mail_allowlist FROM clients WHERE slug = ${slug} LIMIT 1`;
  return (rows[0]?.mail_allowlist as string) || "";
}
export async function setMailAllowlist(slug: string, text: string): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await sql`UPDATE clients SET mail_allowlist = ${text.trim() || null} WHERE slug = ${slug}`;
  return !!rowCount && rowCount > 0;
}

// Koppelt (of ontkoppelt, met lege waarde) het Moneybird-contact van een klant.
export async function setMoneybirdContact(slug: string, contactId: string): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await sql`UPDATE clients SET moneybird_contact_id = ${contactId.trim() || null} WHERE slug = ${slug}`;
  return !!rowCount && rowCount > 0;
}

export async function getClientBySlug(slug: string): Promise<ClientConfig | null> {
  await ensureSchema();
  const { rows } = await sql<ClientRow>`SELECT * FROM clients WHERE slug = ${slug} LIMIT 1`;
  return rows[0] ? rowToConfig(rows[0]) : null;
}

// Voor de login: geeft de config plus de wachtwoord-hash om te controleren.
export async function getClientForLogin(
  loginId: string,
): Promise<{ config: ClientConfig; passwordHash: string } | null> {
  await ensureSchema();
  const id = loginId.trim().toLowerCase();
  if (!id) return null;
  const { rows } = await sql<ClientRow>`SELECT * FROM clients WHERE lower(login_id) = ${id} LIMIT 1`;
  if (!rows[0]) return null;
  // Een lead heeft geen wachtwoord-hash; lege string laat de controle netjes
  // falen in plaats van te klappen.
  return { config: rowToConfig(rows[0]), passwordHash: rows[0].password_hash || "" };
}

export async function listClients(): Promise<ClientConfig[]> {
  await ensureSchema();
  const { rows } = await sql<ClientRow>`SELECT * FROM clients ORDER BY name ASC`;
  return rows.map(rowToConfig);
}

export type NewClientInput = {
  name: string;
  loginId: string;
  email: string;
  // Leeg = geen Google Sheet (cockpit-only klant); het dashboard valt dan
  // terug op de taken uit de database.
  sheetId: string;
  gid: string;
  maandbudget: number;
  linkbuilding: number;
  uurtarief: number;
  beschikbareUren: number;
  // Klantgroep (null/leeg = eigen klant, "mmc" = Multimedia Concepts).
  grp?: string | null;
  // Klant-login direct uit (voor cockpit-only klanten).
  loginEnabled?: boolean;
};

// Maakt een klant aan, genereert een wachtwoord en geeft dat ÉÉN keer terug.
export async function createClient(
  input: NewClientInput,
): Promise<{ client: ClientConfig; password: string }> {
  await ensureSchema();
  const slug = slugify(input.loginId || input.name);
  const urenBudget = input.maandbudget - input.linkbuilding;
  const password = generatePassword();
  const passwordHash = hashPassword(password);

  const { rows } = await sql<ClientRow>`
    INSERT INTO clients
      (slug, login_id, name, email, sheet_id, gid,
       maandbudget, linkbuilding, urenbudget, uurtarief, beschikbare_uren, password_hash,
       grp, login_enabled)
    VALUES
      (${slug}, ${input.loginId.trim()}, ${input.name.trim()}, ${input.email.trim() || null},
       ${input.sheetId}, ${input.gid},
       ${input.maandbudget}, ${input.linkbuilding}, ${urenBudget}, ${input.uurtarief},
       ${input.beschikbareUren}, ${passwordHash},
       ${(input.grp || "").trim() || null}, ${input.loginEnabled ?? true})
    RETURNING *`;

  return { client: rowToConfig(rows[0]), password };
}

// ── Een lead aanmaken ──
// Een lead is dezelfde rij als een klant, maar dan met alleen een naam en een
// website: geen inlog, geen Google Sheet, geen wachtwoord en geen budget. De
// klant-login staat uit, zodat er langs die kant niets open kan staan.
export async function createLead(
  input: { name: string; domain: string; email?: string },
): Promise<ClientConfig> {
  await ensureSchema();
  const base = slugify(input.name);
  if (!base) throw new Error("Geen bruikbare naam voor deze lead.");
  // Botst de slug met een bestaand bedrijf, dan tellen we door (lead-2, lead-3).
  let slug = base;
  for (let n = 2; n < 50; n++) {
    const { rows } = await sql`SELECT 1 FROM clients WHERE slug = ${slug} LIMIT 1`;
    if (!rows.length) break;
    slug = `${base}-${n}`;
  }
  const { rows } = await sql<ClientRow>`
    INSERT INTO clients
      (slug, login_id, name, email, sheet_id, gid, domain,
       maandbudget, linkbuilding, urenbudget, uurtarief, beschikbare_uren,
       password_hash, fase, login_enabled)
    VALUES
      (${slug}, NULL, ${input.name.trim()}, ${(input.email || "").trim() || null}, NULL, '0',
       ${normalizeDomain(input.domain)},
       0, 0, 0, 0, 0, NULL, 'lead', false)
    RETURNING *`;
  return rowToConfig(rows[0]);
}

// Zet de levensfase om ("maak klant" en terug). Alles wat er hangt (chat,
// dossier, documenten) blijft gewoon staan; alleen het label verandert.
export async function setClientFase(slug: string, fase: Fase): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await sql`UPDATE clients SET fase = ${fase} WHERE slug = ${slug}`;
  return !!rowCount && rowCount > 0;
}

// Website netjes maken: "pingwin.nl", "www.pingwin.nl/", "https://pingwin.nl"
// worden allemaal "pingwin.nl". Zo werkt de site-scan er meteen op.
export function normalizeDomain(value: string): string | null {
  const t = (value || "").trim().toLowerCase();
  if (!t) return null;
  return t.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim() || null;
}

// Genereert een nieuw wachtwoord voor een bestaande klant.
export async function resetClientPassword(slug: string): Promise<string | null> {
  await ensureSchema();
  const password = generatePassword();
  const passwordHash = hashPassword(password);
  const { rowCount } = await sql`UPDATE clients SET password_hash = ${passwordHash} WHERE slug = ${slug}`;
  return rowCount && rowCount > 0 ? password : null;
}

// Inlogpagina van de website-beheeromgeving per klant instellen (leeg = wissen).
export async function setClientBackendUrl(slug: string, url: string | null): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await sql`UPDATE clients SET backend_url = ${url || null} WHERE slug = ${slug}`;
  return !!rowCount && rowCount > 0;
}

export async function updateClientCockpit(slug: string, c: ClientCockpit): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await sql`
    UPDATE clients SET
      email_domain = ${c.emailDomain || null},
      work_doc_url = ${c.workDocUrl || null},
      results_url  = ${c.resultsUrl || null},
      status       = ${c.status || null},
      last_contact = ${c.lastContact || null},
      notes        = ${c.notes || null}
    WHERE slug = ${slug}`;
  return !!rowCount && rowCount > 0;
}

// Werkt de kernvelden van een bestaande klant bij (e-mail, Sheet, budget).
// Inlognaam en slug blijven vast, want die zitten in de inlog en de URL.
export type ClientCore = {
  email: string | null;
  sheetId: string;
  gid: string;
  maandbudget: number;
  linkbuilding: number;
  uurtarief: number;
  beschikbareUren: number;
};

export async function updateClientCore(slug: string, c: ClientCore): Promise<boolean> {
  await ensureSchema();
  const urenBudget = c.maandbudget - c.linkbuilding;
  const { rowCount } = await sql`
    UPDATE clients SET
      email            = ${c.email},
      sheet_id         = ${c.sheetId},
      gid              = ${c.gid},
      maandbudget      = ${c.maandbudget},
      linkbuilding     = ${c.linkbuilding},
      urenbudget       = ${urenBudget},
      uurtarief        = ${c.uurtarief},
      beschikbare_uren = ${c.beschikbareUren}
    WHERE slug = ${slug}`;
  return !!rowCount && rowCount > 0;
}

// Beheer-velden die op de Beheer-pagina bewerkbaar zijn: naam, website-domein,
// klant-e-mail en of de klant-login openstaat. Alleen meegegeven velden worden
// bijgewerkt (undefined = ongemoeid laten), zodat dit veilig los te gebruiken is.
export async function updateClientAdmin(
  slug: string,
  p: { name?: string; domain?: string | null; email?: string | null; loginEnabled?: boolean; ahrefsKeyRef?: string | null },
): Promise<boolean> {
  await ensureSchema();
  if (p.name !== undefined && p.name.trim()) {
    await sql`UPDATE clients SET name = ${p.name.trim()} WHERE slug = ${slug}`;
  }
  if (p.ahrefsKeyRef !== undefined) {
    // Alleen een net label (letters/cijfers/underscore), hoofdletters; leeg = hoofdaccount.
    const ref = String(p.ahrefsKeyRef || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "") || null;
    await sql`UPDATE clients SET ahrefs_key_ref = ${ref} WHERE slug = ${slug}`;
  }
  if (p.domain !== undefined) {
    await sql`UPDATE clients SET domain = ${p.domain || null} WHERE slug = ${slug}`;
  }
  if (p.email !== undefined) {
    await sql`UPDATE clients SET email = ${p.email || null} WHERE slug = ${slug}`;
  }
  if (p.loginEnabled !== undefined) {
    await sql`UPDATE clients SET login_enabled = ${p.loginEnabled} WHERE slug = ${slug}`;
  }
  const { rows } = await sql`SELECT 1 FROM clients WHERE slug = ${slug} LIMIT 1`;
  return rows.length > 0;
}

export async function setClientBudget(
  slug: string,
  b: { maandbudget: number; linkbuilding: number; uurtarief: number; beschikbareUren: number },
): Promise<boolean> {
  await ensureSchema();
  const urenBudget = b.maandbudget - b.linkbuilding;
  const { rowCount } = await sql`
    UPDATE clients SET
      maandbudget = ${b.maandbudget}, linkbuilding = ${b.linkbuilding}, urenbudget = ${urenBudget},
      uurtarief = ${b.uurtarief}, beschikbare_uren = ${b.beschikbareUren}
    WHERE slug = ${slug}`;
  return !!rowCount && rowCount > 0;
}

// ── Loginvrije deel-link per klant ──
// Elke klant krijgt automatisch een lange, onraadbare code (share_token).
// De klant opent /k/<code> en zit meteen in het eigen dashboard. De code
// blijft geldig tot je hem in de cockpit vernieuwt.

function newShareToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

// Geeft de deel-code van een klant; maakt hem aan als hij nog niet bestaat.
export async function getOrCreateShareToken(slug: string): Promise<string | null> {
  await ensureSchema();
  const { rows } = await sql`SELECT share_token FROM clients WHERE slug = ${slug} LIMIT 1`;
  if (!rows[0]) return null;
  const existing = (rows[0].share_token as string) || "";
  if (existing) return existing;
  const token = newShareToken();
  await sql`UPDATE clients SET share_token = ${token} WHERE slug = ${slug} AND share_token IS NULL`;
  // Bij een gelijktijdige eerste aanvraag wint er één; lees de definitieve waarde terug.
  const { rows: after } = await sql`SELECT share_token FROM clients WHERE slug = ${slug} LIMIT 1`;
  return (after[0]?.share_token as string) || token;
}

// Vernieuwt de deel-code (oude link stopt meteen met werken).
export async function regenerateShareToken(slug: string): Promise<string | null> {
  await ensureSchema();
  const token = newShareToken();
  const { rowCount } = await sql`UPDATE clients SET share_token = ${token} WHERE slug = ${slug}`;
  return rowCount && rowCount > 0 ? token : null;
}

// Zoekt de klant bij een deel-code (voor de loginvrije route).
export async function getClientByShareToken(token: string): Promise<ClientConfig | null> {
  await ensureSchema();
  const t = token.trim();
  if (!t) return null;
  const { rows } = await sql<ClientRow>`SELECT * FROM clients WHERE share_token = ${t} LIMIT 1`;
  return rows[0] ? rowToConfig(rows[0]) : null;
}

export async function deleteClient(slug: string): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await sql`DELETE FROM clients WHERE slug = ${slug}`;
  return !!rowCount && rowCount > 0;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Haalt het Sheet-id en gid uit een geplakte Google Sheet-link.
export function parseSheetUrl(url: string): { sheetId: string; gid: string } {
  const trimmed = url.trim();
  const idMatch = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = trimmed.match(/[#&?]gid=([0-9]+)/);
  return {
    sheetId: idMatch ? idMatch[1] : "",
    gid: gidMatch ? gidMatch[1] : "0",
  };
}
