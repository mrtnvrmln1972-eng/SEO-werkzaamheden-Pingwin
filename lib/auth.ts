import crypto from "crypto";
import { SESSION_COOKIE } from "./constants";

// ═══════════════════════════════════════════════════════════
// LOGIN-SESSIE (server-side, niet te vervalsen)
// ═══════════════════════════════════════════════════════════
// De cookie bevat: "<slug>.<handtekening>". De handtekening is een
// HMAC over de slug met SESSION_SECRET. Zonder dat geheim kan niemand
// een geldige cookie voor een andere klant maken. Het wachtwoord
// staat dus nooit in de browser.
//
// Let op: dit bestand gebruikt Node's crypto en hoort dus alleen in
// Node-runtime (API-routes, server components), niet in de middleware.
// ═══════════════════════════════════════════════════════════

export { SESSION_COOKIE };

function secret(): string {
  return process.env.SESSION_SECRET || "";
}

function sign(slug: string): string {
  return crypto.createHmac("sha256", secret()).update(slug).digest("hex");
}

export function makeSessionValue(slug: string): string {
  return `${slug}.${sign(slug)}`;
}

// Geeft de geldige slug terug, of null als de cookie ontbreekt/niet klopt.
export function verifySessionValue(value: string | undefined | null): string | null {
  if (!value || !secret()) return null;
  const idx = value.lastIndexOf(".");
  if (idx <= 0) return null;
  const slug = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  const expected = sign(slug);
  // timing-veilige vergelijking
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? slug : null;
}
