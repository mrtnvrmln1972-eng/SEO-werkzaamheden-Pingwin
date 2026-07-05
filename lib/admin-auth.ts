import crypto from "crypto";
import { ADMIN_COOKIE } from "./constants";

// ═══════════════════════════════════════════════════════════
// ADMIN-SESSIE (alleen voor Maarten)
// ═══════════════════════════════════════════════════════════
// Zelfde principe als de klant-sessie: een ondertekende cookie. Toegang
// tot het adminscherm via het wachtwoord in ADMIN_PASSWORD. Node-runtime
// only (gebruikt crypto), niet in de middleware.
// ═══════════════════════════════════════════════════════════

function secret(): string {
  return process.env.SESSION_SECRET || "";
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

// Wie er in de cookie zit: de env-eigenaar ("owner") of een teamgebruiker
// (een gast, met zijn database-id). De cookie is een ondertekend "<wie>.<HMAC>".
//  - Env-eigenaar (ADMIN_PASSWORD):  admin.<HMAC over "admin">   (ongewijzigd)
//  - Teamgebruiker (gast):           u<id>.<HMAC over "u<id>">
export type AdminPrincipal = { kind: "owner" } | { kind: "user"; userId: number };

export function makeAdminSession(): string {
  return `admin.${sign("admin")}`;
}

// Sessie-cookie voor een teamgebruiker (gast), met zijn database-id in de naam.
export function makeUserSession(userId: number): string {
  const who = `u${userId}`;
  return `${who}.${sign(who)}`;
}

// Controleert de handtekening en geeft het principal terug (owner of user-id),
// of null als de cookie ontbreekt/niet klopt.
export function getAdminPrincipal(value: string | undefined | null): AdminPrincipal | null {
  if (!value || !secret()) return null;
  const idx = value.lastIndexOf(".");
  if (idx <= 0) return null;
  const who = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  const expected = sign(who);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  if (who === "admin") return { kind: "owner" };
  const m = who.match(/^u(\d+)$/);
  if (m) return { kind: "user", userId: Number(m[1]) };
  return null;
}

// Geldige adminsessie (owner óf teamgebruiker met geldige handtekening)?
// Blijft een simpele boolean, zodat bestaande routes onveranderd werken.
export function verifyAdminSession(value: string | undefined | null): boolean {
  return getAdminPrincipal(value) !== null;
}

export { ADMIN_COOKIE };
