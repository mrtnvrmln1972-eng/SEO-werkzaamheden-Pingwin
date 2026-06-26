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

export type ClientConfig = {
  id: number;
  slug: string;
  loginId: string;
  name: string;
  email: string | null;
  sheetId: string;
  gid: string;
  domain: string | null;
  ahrefsProjectId: string | null;
  budget: ClientBudget;
  cockpit: ClientCockpit;
};

type ClientRow = {
  id: number;
  slug: string;
  login_id: string;
  name: string;
  email: string | null;
  sheet_id: string;
  gid: string;
  maandbudget: string | number;
  linkbuilding: string | number;
  urenbudget: string | number;
  uurtarief: string | number;
  beschikbare_uren: string | number;
  password_hash: string;
  domain: string | null;
  ahrefs_project_id: string | null;
  email_domain: string | null;
  work_doc_url: string | null;
  results_url: string | null;
  status: string | null;
  last_contact: string | null;
  notes: string | null;
};

function rowToConfig(r: ClientRow): ClientConfig {
  return {
    id: r.id,
    slug: r.slug,
    loginId: r.login_id,
    name: r.name,
    email: r.email,
    sheetId: r.sheet_id,
    gid: r.gid,
    domain: r.domain ?? null,
    ahrefsProjectId: r.ahrefs_project_id ?? null,
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
  const { rows } = await sql<ClientRow>`SELECT * FROM clients WHERE lower(login_id) = ${id} LIMIT 1`;
  if (!rows[0]) return null;
  return { config: rowToConfig(rows[0]), passwordHash: rows[0].password_hash };
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
  sheetId: string;
  gid: string;
  maandbudget: number;
  linkbuilding: number;
  uurtarief: number;
  beschikbareUren: number;
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
       maandbudget, linkbuilding, urenbudget, uurtarief, beschikbare_uren, password_hash)
    VALUES
      (${slug}, ${input.loginId.trim()}, ${input.name.trim()}, ${input.email.trim() || null},
       ${input.sheetId}, ${input.gid},
       ${input.maandbudget}, ${input.linkbuilding}, ${urenBudget}, ${input.uurtarief},
       ${input.beschikbareUren}, ${passwordHash})
    RETURNING *`;

  return { client: rowToConfig(rows[0]), password };
}

// Genereert een nieuw wachtwoord voor een bestaande klant.
export async function resetClientPassword(slug: string): Promise<string | null> {
  await ensureSchema();
  const password = generatePassword();
  const passwordHash = hashPassword(password);
  const { rowCount } = await sql`UPDATE clients SET password_hash = ${passwordHash} WHERE slug = ${slug}`;
  return rowCount && rowCount > 0 ? password : null;
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
