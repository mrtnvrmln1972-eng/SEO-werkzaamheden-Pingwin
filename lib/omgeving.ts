import crypto from "crypto";
import { vensterKlant } from "./klantvenster";

// ═══════════════════════════════════════════════════════════
// WELKE OMGEVING IS DIT, EN KIJKT HIJ NAAR DEZELFDE GEGEVENS?
// ═══════════════════════════════════════════════════════════
// Er draaien twee adressen op dezelfde code: het gewone dashboard en de voordeur
// van één klant. Na de omzetting horen ze naar dezelfde database te kijken. Het
// probleem daarbij is dat je dat aan het scherm niet ziet: een voordeur die nog
// aan zijn oude, losse database hangt toont dezelfde klant met dezelfde soort
// gegevens, alleen zijn het de gegevens van gisteren. Dat merk je pas als je een
// dag in het verkeerde scherm hebt zitten werken.
//
// Daarom een vingerafdruk van de database: een kort, onomkeerbaar kenmerk dat je
// tussen twee omgevingen kunt vergelijken. Gelijk = dezelfde gegevens. Ongelijk
// = twee administraties, en dan is de omzetting niet af.
//
// Bewust géén hostnaam of databasenaam in het antwoord: dat is
// verbindingsinformatie en die hoort nergens naar buiten. Een hash met een vast
// zout is genoeg om te vergelijken en zegt verder niets.
// ═══════════════════════════════════════════════════════════

const ZOUT = "pingwin-omgeving-v1:";

/**
 * Kort kenmerk van de database waar deze omgeving aan hangt, of null als er geen
 * verbinding is ingesteld.
 *
 * De pooler-variant en de directe variant van dezelfde Neon-database hebben een
 * andere hostnaam (`…-pooler.…`), terwijl het één en dezelfde database is. Die
 * staart gaat er daarom af; anders zou dezelfde database twee vingerafdrukken
 * kunnen krijgen en meldt de controle een verschil dat er niet is.
 */
export function gegevensVingerafdruk(): string | null {
  const url =
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    "";
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/-pooler(?=\.|$)/, "");
    const naam = decodeURIComponent((u.pathname || "").replace(/^\/+/, "").split("?")[0]).toLowerCase();
    if (!host) return null;
    return crypto.createHash("sha256").update(`${ZOUT}${host}/${naam}`).digest("hex").slice(0, 12);
  } catch {
    return null;
  }
}

export type OmgevingStand = {
  /** De klant waar deze omgeving toe beperkt is, of null bij het gewone dashboard. */
  venster: string | null;
  /** Vingerafdruk van de database; twee omgevingen met dezelfde waarde delen hun gegevens. */
  gegevens: string | null;
};

export function omgevingStand(): OmgevingStand {
  return { venster: vensterKlant(), gegevens: gegevensVingerafdruk() };
}

/**
 * Het eigen basisadres, voor een absolute link die buiten een route-handler
 * wordt gebouwd (dus zonder `req.nextUrl.origin` bij de hand), bijvoorbeeld in
 * een generator die zowel via een API-route als via de developer-overview kan
 * lopen. Productie kent zijn eigen adres via `VERCEL_PROJECT_PRODUCTION_URL`;
 * zonder dat (lokaal, of een preview-deploy) valt dit terug op het vaste
 * productieadres uit CLAUDE.md.
 */
export function siteOrigin(): string {
  return process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://pingwin-seo-dashboard.vercel.app";
}

/**
 * Mag deze server een ander adres aanroepen? Alleen een Pingwin-omgeving.
 *
 * Staat hier en niet in de route die hem als eerste nodig had, want inmiddels
 * gebruiken de verhuizing én de voordeur-controle dezelfde grens. Twee kopieën
 * van een beveiligingsregel lopen uit elkaar zonder dat iemand het merkt.
 */
export function pingwinAdresOk(adres: string): boolean {
  try {
    const u = new URL(adres);
    if (u.protocol !== "https:") return false;
    return u.hostname.endsWith(".vercel.app") || u.hostname === "pingwin.nl" || u.hostname.endsWith(".pingwin.nl");
  } catch {
    return false;
  }
}
