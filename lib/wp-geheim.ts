import crypto from "crypto";

// ═══════════════════════════════════════════════════════════
// HET APPLICATIEWACHTWOORD VERSLEUTELEN
// ═══════════════════════════════════════════════════════════
// AES-256-GCM met een sleutel afgeleid van SESSION_SECRET. Stond in
// `lib/wp-push.ts`, en is hier apart gezet omdat de opslag van de
// WordPress-koppeling (`lib/wp-creds.ts`) hem óók nodig heeft. Zou wp-creds hem
// uit wp-push halen en wp-push zijn opslag uit wp-creds, dan verwijzen die twee
// naar elkaar; dit stukje kent niets en niemand, dus dat kan niet gebeuren.
//
// Verandert SESSION_SECRET, dan is een opgeslagen wachtwoord niet meer te lezen.
// Dat is met opzet: liever een koppeling die om een nieuwe invoer vraagt dan een
// wachtwoord dat leesbaar blijft als de sleutel gelekt is.
// ═══════════════════════════════════════════════════════════

function key(): Buffer {
  const secret = process.env.SESSION_SECRET || "";
  if (!secret) throw new Error("SESSION_SECRET ontbreekt.");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(stored: string): string {
  const [iv, tag, data] = stored.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
