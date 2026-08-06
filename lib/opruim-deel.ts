import { randomBytes } from "crypto";
import { getSetting, setSetting } from "./settings";

// ═══════════════════════════════════════════════════════════
// DE DEELLINK VAN HET OPRUIMSCHERM
// ═══════════════════════════════════════════════════════════
// Een aparte link per klant waarmee iemand het opruimverhaal kan LEZEN zonder
// in te loggen. Bewust los van de deel-link van het klantdashboard (/k/<token>):
// wie dit rapport deelt, deelt daarmee niet het hele dashboard.
//
// Waarom dit veilig is, en niet alleen "de knoppen staan er niet":
// de publieke route levert uitsluitend de uitkomst van de analyse terug. Alles
// wat iets wijzigt (houden, negeren, doorvoeren, weekplanning, mailen) loopt via
// de admin-routes, en die eisen een geldige admin-cookie. Een bezoeker van de
// deel-link heeft die niet, dus zelfs een gelekte knop zou 401 opleveren. De
// leesmodus in het scherm is er voor de duidelijkheid, niet als het slot.
// ═══════════════════════════════════════════════════════════

const KEY_TOKEN = (slug: string) => `opruim_deel_token:${slug}`;
const KEY_SLUG = (token: string) => `opruim_deel_slug:${token}`;

function nieuwToken(): string {
  return randomBytes(18).toString("base64url");
}

export async function getOpruimToken(slug: string): Promise<string | null> {
  return await getSetting(KEY_TOKEN(slug)).catch(() => null);
}

export async function getOrCreateOpruimToken(slug: string): Promise<string> {
  const bestaand = await getOpruimToken(slug);
  if (bestaand) return bestaand;
  const t = nieuwToken();
  await setSetting(KEY_TOKEN(slug), t);
  await setSetting(KEY_SLUG(t), slug);
  return t;
}

/** Nieuwe link maken; de oude stopt meteen met werken. */
export async function regenerateOpruimToken(slug: string): Promise<string> {
  const oud = await getOpruimToken(slug);
  if (oud) await setSetting(KEY_SLUG(oud), null).catch(() => { /* stil */ });
  const t = nieuwToken();
  await setSetting(KEY_TOKEN(slug), t);
  await setSetting(KEY_SLUG(t), slug);
  return t;
}

/** De link intrekken zonder een nieuwe te maken. */
export async function trekOpruimTokenIn(slug: string): Promise<void> {
  const oud = await getOpruimToken(slug);
  if (oud) await setSetting(KEY_SLUG(oud), null).catch(() => { /* stil */ });
  await setSetting(KEY_TOKEN(slug), null);
}

export async function getSlugByOpruimToken(token: string): Promise<string | null> {
  const t = (token || "").trim();
  if (!t || t.length < 10) return null;
  const slug = await getSetting(KEY_SLUG(t)).catch(() => null);
  if (!slug) return null;
  // Tegencontrole: het token moet ook nog het actuele token van die klant zijn,
  // zodat een ingetrokken link niet blijft werken door een oude omgekeerde regel.
  const huidig = await getOpruimToken(slug);
  return huidig === t ? slug : null;
}
