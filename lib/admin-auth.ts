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

export function makeAdminSession(): string {
  return `admin.${sign("admin")}`;
}

export function verifyAdminSession(value: string | undefined | null): boolean {
  if (!value || !secret()) return false;
  const idx = value.lastIndexOf(".");
  if (idx <= 0) return false;
  const who = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  if (who !== "admin") return false;
  const expected = sign("admin");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export { ADMIN_COOKIE };
