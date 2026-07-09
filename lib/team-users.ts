import { sql, ensureSchema } from "./db";
import { hashPassword, generatePassword } from "./password";

// ═══════════════════════════════════════════════════════════
// TEAMGEBRUIKERS (rechten-laag naast de env-eigenaar)
// ═══════════════════════════════════════════════════════════
// De env-eigenaar (ADMIN_PASSWORD) is en blijft de volledige eigenaar met
// toegang tot alles. Daarnaast kunnen teamgebruikers (gasten) inloggen op het
// adminscherm met een eigen inlognaam + wachtwoord. Een gast ziet alleen de
// klanten in allowed_slugs en optioneel de mail/status (can_see_mail).
//
// Wachtwoorden staan NOOIT plat in de database, alleen als scrypt-hash.
// Geen seed: met nul teamgebruikers gedraagt het dashboard zich exact als
// voorheen (alleen de env-eigenaar bestaat dan).
// ═══════════════════════════════════════════════════════════

export type TeamRole = "owner" | "guest";

export type TeamUser = {
  id: number;
  name: string | null;
  loginId: string;
  role: TeamRole;
  allowedSlugs: string[];
  canSeeMail: boolean;
  canEdit: boolean;
  email: string | null;
  createdAt: string | null;
};

type TeamRow = {
  id: number;
  name: string | null;
  login_id: string;
  password_hash: string;
  role: string;
  allowed_slugs: string[] | null;
  can_see_mail: boolean;
  can_edit: boolean;
  email: string | null;
  created_at: string | null;
};

function rowToUser(r: TeamRow): TeamUser {
  return {
    id: r.id,
    name: r.name,
    loginId: r.login_id,
    role: r.role === "owner" ? "owner" : "guest",
    allowedSlugs: Array.isArray(r.allowed_slugs) ? r.allowed_slugs : [],
    canSeeMail: !!r.can_see_mail,
    canEdit: !!r.can_edit,
    email: r.email || null,
    createdAt: r.created_at,
  };
}

export async function listTeamUsers(): Promise<TeamUser[]> {
  await ensureSchema();
  const { rows } = await sql<TeamRow>`SELECT * FROM team_users ORDER BY created_at ASC, id ASC`;
  return rows.map(rowToUser);
}

export async function getTeamUserById(id: number): Promise<TeamUser | null> {
  await ensureSchema();
  const { rows } = await sql<TeamRow>`SELECT * FROM team_users WHERE id = ${id} LIMIT 1`;
  return rows[0] ? rowToUser(rows[0]) : null;
}

// Voor de login: geeft de gebruiker plus de wachtwoord-hash om te controleren.
export async function getTeamUserForLogin(
  loginId: string,
): Promise<{ user: TeamUser; passwordHash: string } | null> {
  await ensureSchema();
  const id = loginId.trim().toLowerCase();
  const { rows } = await sql<TeamRow>`SELECT * FROM team_users WHERE lower(login_id) = ${id} LIMIT 1`;
  if (!rows[0]) return null;
  return { user: rowToUser(rows[0]), passwordHash: rows[0].password_hash };
}

export type NewTeamUserInput = {
  name: string;
  loginId: string;
  allowedSlugs: string[];
  canSeeMail: boolean;
  canEdit: boolean;
  email?: string;
};

// Maakt een gast aan, genereert een wachtwoord en geeft dat ÉÉN keer terug.
export async function createTeamUser(
  input: NewTeamUserInput,
): Promise<{ user: TeamUser; password: string }> {
  await ensureSchema();
  const password = generatePassword();
  const passwordHash = hashPassword(password);
  const slugs = sanitizeSlugs(input.allowedSlugs);
  const { rows } = await sql<TeamRow>`
    INSERT INTO team_users (name, login_id, password_hash, role, allowed_slugs, can_see_mail, can_edit, email)
    VALUES (${input.name.trim() || null}, ${input.loginId.trim()}, ${passwordHash}, 'guest',
            ${slugs as unknown as string}, ${input.canSeeMail}, ${input.canEdit}, ${(input.email || "").trim() || null})
    RETURNING *`;
  return { user: rowToUser(rows[0]), password };
}

export async function updateTeamUser(
  id: number,
  patch: { name?: string | null; allowedSlugs?: string[]; canSeeMail?: boolean; canEdit?: boolean; email?: string | null },
): Promise<boolean> {
  await ensureSchema();
  if (patch.name !== undefined) {
    await sql`UPDATE team_users SET name = ${patch.name || null} WHERE id = ${id}`;
  }
  if (patch.allowedSlugs !== undefined) {
    const slugs = sanitizeSlugs(patch.allowedSlugs);
    await sql`UPDATE team_users SET allowed_slugs = ${slugs as unknown as string} WHERE id = ${id}`;
  }
  if (patch.canSeeMail !== undefined) {
    await sql`UPDATE team_users SET can_see_mail = ${patch.canSeeMail} WHERE id = ${id}`;
  }
  if (patch.canEdit !== undefined) {
    await sql`UPDATE team_users SET can_edit = ${patch.canEdit} WHERE id = ${id}`;
  }
  if (patch.email !== undefined) {
    await sql`UPDATE team_users SET email = ${(patch.email || "").trim() || null} WHERE id = ${id}`;
  }
  const { rows } = await sql`SELECT 1 FROM team_users WHERE id = ${id} LIMIT 1`;
  return rows.length > 0;
}

export async function resetTeamUserPassword(id: number): Promise<string | null> {
  await ensureSchema();
  const password = generatePassword();
  const passwordHash = hashPassword(password);
  const { rowCount } = await sql`UPDATE team_users SET password_hash = ${passwordHash} WHERE id = ${id}`;
  return rowCount && rowCount > 0 ? password : null;
}

export async function deleteTeamUser(id: number): Promise<boolean> {
  await ensureSchema();
  const { rowCount } = await sql`DELETE FROM team_users WHERE id = ${id}`;
  return !!rowCount && rowCount > 0;
}

// Alleen geldige, niet-lege slugs (defensief tegen rommel uit de UI).
function sanitizeSlugs(slugs: string[]): string[] {
  const clean = (Array.isArray(slugs) ? slugs : [])
    .map((s) => String(s || "").trim().toLowerCase())
    .filter((s) => /^[a-z0-9-]+$/.test(s));
  return Array.from(new Set(clean));
}
