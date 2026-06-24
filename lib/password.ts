import crypto from "crypto";

// ═══════════════════════════════════════════════════════════
// WACHTWOORDEN: genereren, hashen en controleren
// ═══════════════════════════════════════════════════════════
// Wachtwoorden worden NOOIT als platte tekst opgeslagen. In de database
// staat alleen een hash (scrypt + salt). Bij het aanmaken van een klant
// genereren we een leesbaar wachtwoord, tonen dat één keer (om te mailen),
// en bewaren alleen de hash.
// ═══════════════════════════════════════════════════════════

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const idx = stored.indexOf(":");
  if (idx <= 0) return false;
  const salt = stored.slice(0, idx);
  const hash = stored.slice(idx + 1);
  const test = crypto.scryptSync(plain, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(test, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Leesbaar wachtwoord zonder verwarrende tekens (geen 0/O, 1/l/I).
export function generatePassword(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
