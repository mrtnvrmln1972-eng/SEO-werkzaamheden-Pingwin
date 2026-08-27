import { randomBytes } from "crypto";
import { sql } from "@vercel/postgres";
import { eenmalig } from "./schema-stand";
import { getSetting, setSetting } from "./settings";

// ═══════════════════════════════════════════════════════════
// ÉÉN MANIER OM EEN SCHERM DEELBAAR TE MAKEN
// ═══════════════════════════════════════════════════════════
// Er bestonden vier losse deel-links naast elkaar (het klantdashboard, het
// opruimrapport, de bedrijfsgegevens, de werklijst), elk met een eigen kopie van
// dezelfde vijftig regels: een token maken, opbergen, terugzoeken, intrekken.
// Dat is precies de vaste les uit dit project: dezelfde regel op meerdere
// plekken uitschrijven loopt uit elkaar zonder dat iemand het merkt. Vandaar één
// bron. Een nieuw scherm deelbaar maken is vanaf nu: een soort erbij zetten in
// SLEUTELROMP, en de twee routes die er al staan hergebruiken.
//
// WAAROM DIT VEILIG IS
// ────────────────────
// Het token is de toegang, en verder niets: er hoort bij elke soort één publieke
// GET-route die uitsluitend leest. Alles wat iets wijzigt loopt via /api/admin/*
// en die eisen een admin-cookie, dus een bezoeker van een deel-link krijgt daar
// 401. De leesmodus in het scherm is er voor de duidelijkheid, niet als het slot.
// De publieke pagina toont ook geen enkele weg naar de rest van het dashboard.
//
// WAAROM ER EEN MOMENTOPNAME BIJ HOORT
// ────────────────────────────────────
// Een deel-link mag nooit zwaar werk aanzetten. De sitemap-check haalt de hele
// sitemap van de klant op en legt hem naast de paginaspiegel; dat duurt tientallen
// seconden. Zou de publieke route dat per bezoek doen, dan is iedereen die de
// link heeft in staat om de server (en de site van de klant) plat te leggen door
// te verversen. Dus: het beheerscherm bewaart de uitkomst zodra hij hem berekent,
// en de publieke route léést alleen die opgeslagen stand, met de datum erbij.
// ═══════════════════════════════════════════════════════════

/** Welke schermen deelbaar zijn. Een nieuwe soort erbij is één regel. */
export type DeelSoort = "opruim" | "sitemap" | "werkplan";

/**
 * De romp van de sleutels waaronder een token wordt opgeborgen. Opruim houdt
 * bewust zijn oude romp: die links zijn uitgedeeld en blijven zo werken.
 */
const SLEUTELROMP: Record<DeelSoort, string> = {
  opruim: "opruim_deel",
  sitemap: "sitemap_deel",
  werkplan: "werkplan_deel",
};

/** Het pad van de publieke pagina die bij een soort hoort. */
export const DEEL_PAD: Record<DeelSoort, string> = {
  opruim: "/share/opruim",
  sitemap: "/share/sitemap",
  werkplan: "/share/werkplan",
};

export function isDeelSoort(x: string): x is DeelSoort {
  return Object.prototype.hasOwnProperty.call(SLEUTELROMP, x);
}

const KEY_TOKEN = (soort: DeelSoort, slug: string) => `${SLEUTELROMP[soort]}_token:${slug}`;
const KEY_SLUG = (soort: DeelSoort, token: string) => `${SLEUTELROMP[soort]}_slug:${token}`;

function nieuwToken(): string {
  return randomBytes(18).toString("base64url");
}

export async function getDeelToken(soort: DeelSoort, slug: string): Promise<string | null> {
  return await getSetting(KEY_TOKEN(soort, slug)).catch(() => null);
}

export async function getOrCreateDeelToken(soort: DeelSoort, slug: string): Promise<string> {
  const bestaand = await getDeelToken(soort, slug);
  if (bestaand) return bestaand;
  const t = nieuwToken();
  await setSetting(KEY_TOKEN(soort, slug), t);
  await setSetting(KEY_SLUG(soort, t), slug);
  return t;
}

/** Nieuwe link maken; de oude stopt meteen met werken. */
export async function regenerateDeelToken(soort: DeelSoort, slug: string): Promise<string> {
  const oud = await getDeelToken(soort, slug);
  if (oud) await setSetting(KEY_SLUG(soort, oud), null).catch(() => { /* stil */ });
  const t = nieuwToken();
  await setSetting(KEY_TOKEN(soort, slug), t);
  await setSetting(KEY_SLUG(soort, t), slug);
  return t;
}

/** De link intrekken zonder een nieuwe te maken. */
export async function trekDeelTokenIn(soort: DeelSoort, slug: string): Promise<void> {
  const oud = await getDeelToken(soort, slug);
  if (oud) await setSetting(KEY_SLUG(soort, oud), null).catch(() => { /* stil */ });
  await setSetting(KEY_TOKEN(soort, slug), null);
}

export async function getSlugByDeelToken(soort: DeelSoort, token: string): Promise<string | null> {
  const t = (token || "").trim();
  if (!t || t.length < 10) return null;
  const slug = await getSetting(KEY_SLUG(soort, t)).catch(() => null);
  if (!slug) return null;
  // Tegencontrole: het token moet ook nog het actuele token van die klant zijn,
  // zodat een ingetrokken link niet blijft werken door een oude omgekeerde regel.
  const huidig = await getDeelToken(soort, slug);
  return huidig === t ? slug : null;
}

// ── De bewaarde stand achter een deel-link ─────────────────
// Vingerafdruk van `bouwDeelStand()` hieronder; proeven/schema-versie.proef.ts
// rekent hem na en noemt zelf de waarde die hier hoort te staan.
export const DEEL_STAND_SCHEMA_VERSIE = "deel-stand-69e7aaf4";

async function bouwDeelStand(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS deel_stand (
      soort       TEXT NOT NULL,
      client_slug TEXT NOT NULL,
      inhoud      TEXT NOT NULL,
      bijgewerkt  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (soort, client_slug)
    )`;
}

export function ensureDeelStand(): Promise<void> {
  return eenmalig("deel-stand", DEEL_STAND_SCHEMA_VERSIE, bouwDeelStand);
}

/**
 * De uitkomst wegschrijven die achter de deel-link te zien is. Wordt aangeroepen
 * door het beheerscherm op het moment dat het de controle zelf draait, zodat de
 * gedeelde stand altijd gelijk is aan de laatste controle die Maarten deed.
 */
export async function bewaarDeelStand(soort: DeelSoort, slug: string, inhoud: unknown): Promise<void> {
  await ensureDeelStand();
  const tekst = JSON.stringify(inhoud);
  await sql`
    INSERT INTO deel_stand (soort, client_slug, inhoud, bijgewerkt)
    VALUES (${soort}, ${slug}, ${tekst}, now())
    ON CONFLICT (soort, client_slug) DO UPDATE SET inhoud = ${tekst}, bijgewerkt = now()`;
}

export async function leesDeelStand<T>(soort: DeelSoort, slug: string): Promise<{ inhoud: T; bijgewerkt: string } | null> {
  await ensureDeelStand();
  const { rows } = await sql<{ inhoud: string; bijgewerkt: string }>`
    SELECT inhoud, bijgewerkt FROM deel_stand WHERE soort = ${soort} AND client_slug = ${slug} LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  try { return { inhoud: JSON.parse(r.inhoud) as T, bijgewerkt: new Date(r.bijgewerkt).toISOString() }; }
  catch { return null; }
}
