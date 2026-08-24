import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";
import { readDriveDoc } from "./drive";
import { driveLinksUit } from "./drive-id";
import { callClaude } from "./anthropic";
import { getPagePlan, getPageClusterAdvice } from "./site-urls";
import { chatTekstVoorPagina } from "./page-chats";

// ═══════════════════════════════════════════════════════════
// AANGELEVERDE DOCUMENTEN GAAN VANZELF MEE, IN ELKE FASE
// ═══════════════════════════════════════════════════════════
// Noem je ergens bij een pagina een Google-document (een strategiestuk, een
// blauwdruk, een linkregister), dan hoort dat document bij die pagina. Punt.
// Je hoeft er verder niets voor te doen: niet op een knop drukken, niet zorgen
// dat het in het juiste veld staat, niet controleren of de samenvatting het
// heeft overgenomen. Dit bestand zoekt de documenten zelf op, leest ze zelf
// uit en zorgt dat de inhoud in de strategie-chat, de analyse, de blauwdruk én
// de copy meeloopt.
//
// Waarom het er is: het strategieveld gaat letterlijk mee de fases in, maar een
// link daarin was dode tekst. De documentmotor kan alleen een pagina en
// concurrenten uitmeten, en een gewone fetch op een Google-adres levert geen
// tekst op (ook niet bij een openbaar document: je krijgt de schil van de
// bewerkomgeving terug, niet de inhoud). Het document rolde er gewoon uit, dus
// niemand zag dat de afspraken nooit waren meegewogen. Dat is de gevaarlijkste
// soort fout: hij ziet er goed uit.
//
// Vier dingen zijn hier hard:
//   1. ZOEKEN DOET HET SYSTEEM. Links worden opgehaald uit de vastgelegde
//      strategie, uit élk gesprek over die pagina, uit meegegeven cluster-advies
//      en uit de extra sturing bij het starten van een fase. Eén keer noemen is
//      genoeg, voor altijd.
//   2. HET DOCUMENT WORDT UITGEWERKT, NIET DOORGEGEVEN. Er wordt één keer een
//      briefing van gemaakt die zegt wat er voor DEZE pagina uit volgt (rol,
//      zoekwoorden, verplichte interne links met ankertekst, buren, projecten,
//      opbouw, verboden). Die briefing gaat compleet mee in elke fase; de
//      volledige documenttekst gaat er ruim achteraan.
//   3. DE BRIEFING WORDT BEWAARD EN VERVALT VANZELF. De sleutel is de inhoud van
//      de documenten zelf: verandert er een letter, dan wordt hij opnieuw
//      gemaakt. Dus geen wachttijd per fase, en nooit een verouderde briefing.
//   4. ER WORDT NOOIT STIL AFGEKAPT. Wat niet gelezen kon worden of niet paste,
//      staat er met zoveel woorden bij, met de opdracht er niets over aan te
//      nemen.
// ═══════════════════════════════════════════════════════════

/** Ruim: een linkregister of een blauwdruk moet er in zijn geheel in passen. */
const MAX_PER_DOC = 120000;
/** Alles bij elkaar, voor het uitwerken van de briefing. */
const MAX_INVOER = 300000;
/** Hoeveel ruwe documenttekst er ná de briefing meegaat de fase in. */
const MAX_RUW_IN_FASE = 120000;
/** Zoveel documenten per pagina. Nooit stil: wat erboven valt wordt gemeld. */
const MAX_DOCS = 8;

export type PlanBron = { link: string; id: string; naam: string; tekst: string; fout: string };

// ── Bewaarplek voor de uitgewerkte briefing ──
const SCHEMA_VERSIE = "page-bron-briefing-923a430c";
async function ensureTable(): Promise<void> {
  return eenmalig("page-bron-briefing", SCHEMA_VERSIE, doEnsureTable);
}
async function doEnsureTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS page_bron_briefing (
      client_slug TEXT NOT NULL,
      url         TEXT NOT NULL,
      sleutel     TEXT NOT NULL,
      briefing    TEXT NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, url)
    )`;
}

/**
 * Alle Google-documenten die bij deze pagina horen, waar ze ook genoemd zijn.
 * Volgorde: de vastgelegde strategie eerst (dat is de bedoeling van de pagina),
 * dan de extra sturing, dan het cluster-advies, dan de gesprekken.
 */
export async function bronLinksVoorPagina(slug: string, url: string, extra = ""): Promise<{ link: string; id: string }[]> {
  const [plan, advies, chats] = await Promise.all([
    getPagePlan(slug, url).catch(() => ""),
    getPageClusterAdvice(slug, url).catch(() => [] as { advice: string; sourceAnalysis: string }[]),
    chatTekstVoorPagina(slug, url).catch(() => ""),
  ]);
  const adviesTekst = advies.map((a) => `${a.advice}\n${a.sourceAnalysis || ""}`).join("\n");
  const gezien = new Set<string>();
  const uit: { link: string; id: string }[] = [];
  for (const tekst of [plan, extra, adviesTekst, chats]) {
    for (const l of driveLinksUit(tekst || "")) {
      if (gezien.has(l.id)) continue;
      gezien.add(l.id);
      uit.push(l);
    }
  }
  return uit;
}

// Een openbaar gedeeld document zonder Drive-koppeling: Google heeft daar een
// export-adres voor dat wél platte tekst teruggeeft. Terugval, geen hoofdroute:
// met de koppeling erbij lezen we ook niet-gedeelde documenten en alle
// tabbladen van een werkblad.
async function openbaarUitgelezen(id: string): Promise<string> {
  const routes: [string, string][] = [["document", "txt"], ["spreadsheets", "csv"], ["presentation", "txt"]];
  for (const [soort, formaat] of routes) {
    try {
      const r = await fetch(`https://docs.google.com/${soort}/d/${id}/export?format=${formaat}`, { redirect: "follow" });
      if (!r.ok) continue;
      const t = (await r.text()).trim();
      if (t && !/^<(!doctype|html)/i.test(t)) return t;
    } catch { /* volgende route */ }
  }
  return "";
}

/** Leest de documenten uit. Geeft per document de tekst of de reden waarom niet. */
export async function leesBronnen(links: { link: string; id: string }[]): Promise<PlanBron[]> {
  return Promise.all(links.map(async ({ link, id }): Promise<PlanBron> => {
    try {
      const r = await readDriveDoc(id, MAX_PER_DOC, { metKoppen: true });
      if (r.ok && (r.text || "").trim()) return { link, id, naam: r.name || "", tekst: (r.text || "").trim(), fout: "" };
      const openbaar = await openbaarUitgelezen(id);
      if (openbaar) return { link, id, naam: r.name || "", tekst: openbaar.slice(0, MAX_PER_DOC), fout: "" };
      return { link, id, naam: r.name || "", tekst: "", fout: r.error || "leeg document" };
    } catch (e) {
      const openbaar = await openbaarUitgelezen(id).catch(() => "");
      if (openbaar) return { link, id, naam: "", tekst: openbaar.slice(0, MAX_PER_DOC), fout: "" };
      return { link, id, naam: "", tekst: "", fout: (e as Error).message };
    }
  }));
}

// Een vingerafdruk over de inhoud zelf: verandert er iets in een document, of
// komt er een document bij, dan hoort de briefing opnieuw gemaakt te worden.
// Bewust niet op de wijzigingsdatum, want die zegt niets over de inhoud.
function vingerafdruk(url: string, bronnen: PlanBron[]): string {
  const ruw = `${url}\n` + bronnen.map((b) => `${b.id}:${b.tekst.length}:${b.tekst.slice(0, 400)}:${b.tekst.slice(-400)}`).join("\n");
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < ruw.length; i++) {
    h1 = Math.imul(h1 ^ ruw.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + ruw.charCodeAt(i), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16)}${h2.toString(16)}`;
}

const BRIEFING_SYSTEM = `Je bent een senior SEO-strateeg bij bureau Pingwin. Je krijgt de documenten die voor één landingspagina zijn aangeleverd (een strategie, een blauwdruk, een schrijfopdracht, een linkregister of iets anders) en je maakt daar de WERKBRIEFING van voor precies die ene pagina.

Deze briefing gaat ongewijzigd mee als leidende opdracht in de analyse, de blauwdruk en de copy van die pagina. Alles wat je hier weglaat, gebeurt daar niet. Alles wat je hier verzint, gebeurt daar wél. Werk dus volledig én strikt.

REGELS
- Neem ALLES over wat op DEZE pagina van toepassing is, tot op het detail: de rol van de pagina, het primaire en secundaire zoekwoord met volumes, de varianten die in de koppen terug moeten, de opbouw en de gewenste lengte, de lokale of inhoudelijke invalshoek, de projecten of bewijsstukken die erbij horen, en de toon.
- Interne links zijn geen samenvatting waard: schrijf ze UITGESCHREVEN uit, één regel per link, met de bestemming, de exacte ankertekst en de plek op de pagina. Staat er in een register een rij voor deze pagina (buurplaatsen, projecten, varianten), neem die rij dan letterlijk over.
- Neem de harde regels en verboden onverkort over (wat nooit als ankertekst mag, hoeveel links maximaal, nooit naar een doorstuuradres, en dergelijke).
- Laat weg wat over ANDERE pagina's gaat. Een register bevat rijen voor het hele cluster; alleen de rij van deze pagina en de regels die voor iedereen gelden horen erin.
- Staat er in de documenten een VOORWAARDE of een norm waaraan nog niet voldaan is (bijvoorbeeld: twee eigen projecten per pagina, terwijl er nul zijn), noem dat dan als FEIT onder het kopje "Wat er wel en niet ligt", met wat er is en wat er ontbreekt. Het is nooit een reden om niet te schrijven en nooit een waarschuwing die in het document terechtkomt: het bepaalt alleen wat er in de tekst kan staan. Is er geen bewijsmateriaal, dan is de opdracht om de sterkst mogelijke pagina te maken met wat er wél is (de inhoudelijke of lokale invalshoek, de diensten, de werkwijze), zonder een project te verzinnen en zonder een lege ruimte open te laten waar bewijs hoort.
- Verzin NIETS. Staat iets er niet in, dan noem je het niet. Spreken twee documenten elkaar tegen, dan benoem je dat expliciet in plaats van te kiezen.
- Geen inleiding, geen afsluiting, geen vraag terug. Alleen de briefing zelf, met korte kopjes en opsommingen.`;

/** Werkt de aangeleverde documenten uit tot de briefing voor deze ene pagina. */
async function maakBriefing(slug: string, url: string, bronnen: PlanBron[]): Promise<string> {
  const gelezen = bronnen.filter((b) => !b.fout && b.tekst);
  if (!gelezen.length) return "";
  let ruimte = MAX_INVOER;
  const stukken = gelezen.map((b) => {
    const tekst = b.tekst.slice(0, Math.max(0, ruimte));
    ruimte -= tekst.length;
    return `--- ${b.naam || "Aangeleverd document"} (${b.link}) ---\n${tekst}`;
  });
  const user = `Maak de werkbriefing voor de pagina ${url}.\n\n${stukken.join("\n\n")}`;
  return (await callClaude(BRIEFING_SYSTEM, [{ role: "user", content: user }], 8000, { slug, action: "bron_briefing" })).trim();
}

async function briefingUitKast(slug: string, url: string, sleutel: string): Promise<string> {
  try {
    await ensureSchema(); await ensureTable();
    const { rows } = await sql`SELECT briefing FROM page_bron_briefing WHERE client_slug = ${slug} AND url = ${url} AND sleutel = ${sleutel} LIMIT 1`;
    return (rows[0]?.briefing as string) || "";
  } catch { return ""; }
}

async function briefingInKast(slug: string, url: string, sleutel: string, briefing: string): Promise<void> {
  try {
    await ensureSchema(); await ensureTable();
    await sql`
      INSERT INTO page_bron_briefing (client_slug, url, sleutel, briefing, updated_at)
      VALUES (${slug}, ${url}, ${sleutel}, ${briefing}, now())
      ON CONFLICT (client_slug, url) DO UPDATE SET sleutel = ${sleutel}, briefing = ${briefing}, updated_at = now()`;
  } catch { /* bewaren is winst, geen voorwaarde */ }
}

/**
 * Het blok dat mee de fase in gaat: de uitgewerkte briefing plus de volledige
 * documenttekst eronder. Leeg als er bij deze pagina geen document is genoemd,
 * zodat zo'n pagina exact dezelfde context houdt als voorheen.
 */
export async function bronContext(slug: string, url: string, extra = ""): Promise<string> {
  const links = await bronLinksVoorPagina(slug, url, extra).catch(() => []);
  if (!links.length) return "";
  const teLezen = links.slice(0, MAX_DOCS);
  const bronnen = await leesBronnen(teLezen);

  const sleutel = vingerafdruk(url, bronnen);
  let briefing = await briefingUitKast(slug, url, sleutel);
  if (!briefing) {
    briefing = await maakBriefing(slug, url, bronnen).catch(() => "");
    if (briefing) await briefingInKast(slug, url, sleutel, briefing);
  }

  const regels: string[] = [
    "AANGELEVERDE DOCUMENTEN VOOR DEZE PAGINA (door de gebruiker meegegeven; LEIDEND).",
    "Dit zijn vastgelegde afspraken over deze pagina. Volg ze letterlijk: structuur, interne links met hun exacte ankertekst, zoekwoorden, opbouw en verboden.",
    "Wijkt een afspraak af van wat jij zou kiezen, volg dan de afspraak en benoem het verschil; ga er niet stilzwijgend omheen.",
    "Ontbreekt er materiaal waar de afspraken om vragen (projecten, foto's, cijfers), dan is dat GEEN reden om te stoppen of om de pagina half te laten: maak de sterkst mogelijke pagina met wat er wél is, verzin niets, en zet geen waarschuwing daarover in het opgeleverde stuk.",
  ];
  if (briefing) regels.push("", "── WERKBRIEFING, uitgewerkt uit die documenten voor precies deze pagina ──", briefing);

  let ruimte = MAX_RUW_IN_FASE;
  regels.push("", "── DE DOCUMENTEN ZELF ──");
  bronnen.forEach((b, i) => {
    const kop = `--- Document ${i + 1}${b.naam ? `: "${b.naam}"` : ""} (${b.link}) ---`;
    if (b.fout) {
      regels.push("", kop, `NIET GELEZEN: ${b.fout}. Neem niets aan over de inhoud van dit document; meld in het stuk dat het ontbreekt.`);
      return;
    }
    if (ruimte < 500) {
      regels.push("", kop, "Niet meegestuurd (de eerdere documenten vulden de ruimte); de werkbriefing hierboven dekt dit stuk.");
      return;
    }
    const tekst = b.tekst.slice(0, ruimte);
    ruimte -= tekst.length;
    const afgekapt = tekst.length < b.tekst.length;
    regels.push("", kop, tekst, afgekapt ? `(hier afgekapt na ${tekst.length} tekens; de rest zit in de werkbriefing hierboven)` : `--- einde document ${i + 1} ---`);
  });

  if (links.length > teLezen.length) {
    regels.push("", `LET OP: er horen nog ${links.length - teLezen.length} ander(e) document(en) bij deze pagina die hier niet zijn uitgelezen (maximaal ${MAX_DOCS} per pagina). Doe geen uitspraken over de inhoud daarvan.`);
  }
  return regels.join("\n");
}
