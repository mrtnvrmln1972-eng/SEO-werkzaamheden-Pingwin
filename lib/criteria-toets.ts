import { sql, ensureSchema } from "./db";
import { callClaude } from "./anthropic";
import { SEO_CRITERIA_MD } from "./seo-criteria";
import { getPageDocOutputs } from "./site-urls";

// ═══════════════════════════════════════════════════════════
// VOLDOET DE TERUGGEKREGEN VERSIE NOG AAN DE CRITERIA?
// ═══════════════════════════════════════════════════════════
// De gang van zaken: wij schrijven een copy-document, de klant past het aan en
// stuurt het terug. Meestal is dat prima, maar soms haalt hij precies datgene
// eruit waar de pagina het van moet hebben: het zoekwoord in de H1, een FAQ, een
// kop die op de zoekintentie zit.
//
// Dit is de controle vlak vóór je die versie goedkeurt. Geen nieuw document en
// geen samenvoeging: alleen een oordeel in beeld, tegen dezelfde criteria die de
// analyse en de copywriting al gebruiken (lib/seo-criteria.ts).
//
// De uitkomst wordt bewaard bij de versie, zodat je hem later terugziet zonder
// opnieuw te hoeven toetsen.
// ═══════════════════════════════════════════════════════════

export type Toets = {
  oordeel: "goed" | "let-op" | "niet-goed";
  kop: string;
  behouden: string[];
  verdwenen: string[];
  advies: string;
};

const OORDEEL_TEKST: Record<Toets["oordeel"], string> = {
  "goed": "Deze versie voldoet; je kunt hem goedkeuren.",
  "let-op": "Grotendeels goed, maar er is iets verdwenen dat je zou moeten terugzetten.",
  "niet-goed": "Zo goedkeuren kost vindbaarheid; zet eerst de onderstaande punten terug.",
};

let klaar: Promise<void> | null = null;
async function ensure(): Promise<void> {
  await ensureSchema();
  if (!klaar) klaar = sql`ALTER TABLE page_doc_versions ADD COLUMN IF NOT EXISTS toets JSONB`.then(() => undefined);
  await klaar;
}

/** De eerder bewaarde uitkomst, of null als er nog niet getoetst is. */
export async function bewaardeToets(slug: string, id: number): Promise<Toets | null> {
  await ensure();
  const { rows } = await sql`SELECT toets FROM page_doc_versions WHERE client_slug = ${slug} AND id = ${id} LIMIT 1`;
  const t = rows[0]?.toets;
  return t && typeof t === "object" ? (t as Toets) : null;
}

/**
 * Toetst de tekst van één versie aan de criteria, vergeleken met de tekst die er
 * nu geldt. Het gaat om het verschil: wat is de klant kwijtgeraakt.
 */
export async function toetsVersie(slug: string, id: number): Promise<{ ok: boolean; toets?: Toets; error?: string }> {
  await ensure();
  const { rows } = await sql`
    SELECT url, kind, naam, tekst FROM page_doc_versions WHERE client_slug = ${slug} AND id = ${id} LIMIT 1`;
  const v = rows[0];
  if (!v) return { ok: false, error: "Deze versie bestaat niet meer." };
  const nieuw = String(v.tekst || "").trim();
  if (!nieuw) return { ok: false, error: "Van deze versie is geen leesbare tekst bewaard, dus er valt niets te toetsen." };

  const outputs = await getPageDocOutputs(slug, String(v.url)).catch(() => ({} as Record<string, string>));
  const oud = String(outputs[String(v.kind)] || "").trim();

  const sys = `Je bent SEO-specialist bij bureau Pingwin. Een klant heeft onze tekst aangepast en teruggestuurd. Beoordeel of de teruggekregen versie nog voldoet aan het criteria-document hieronder.

Kijk naar het VERSCHIL met onze versie. Wat telt is wat er verdwenen of verzwakt is: het primaire zoekwoord in de H1 of de eerste 100 woorden, de H2-dekking, de FAQ, de meta-title en -description, de interne links, de opbouw op de zoekintentie.

Antwoord met UITSLUITEND geldige JSON:
{"oordeel":"goed|let-op|niet-goed",
 "kop":"één zin die zegt wat er aan de hand is",
 "behouden":["korte regels: wat goed is gebleven, maximaal 4"],
 "verdwenen":["korte regels: wat eruit is gehaald of verzwakt, met het criterium erbij, maximaal 5"],
 "advies":"twee tot drie zinnen: wat je terug zou zetten voor je deze versie goedkeurt"}

Regels: verzin niets; noem alleen wat je echt in de teksten ziet. Is er niets verdwenen, dan is "verdwenen" een lege lijst en het oordeel "goed". Gewone taal, geen jargon.

CRITERIA-DOCUMENT:
${SEO_CRITERIA_MD.slice(0, 24000)}`;

  const user = `Document: ${v.naam || "(zonder naam)"} (${v.kind})

ONZE VERSIE (zoals die nu geldt):
${oud ? oud.slice(0, 14000) : "(er is nog geen eerdere versie; beoordeel de teruggekregen tekst op zichzelf)"}

TERUGGEKREGEN VERSIE VAN DE KLANT:
${nieuw.slice(0, 14000)}`;

  try {
    const raw = await callClaude(sys, [{ role: "user", content: user }], 1600, { slug, action: "criteria-toets" });
    const schoon = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const p = JSON.parse(schoon.slice(schoon.indexOf("{"), schoon.lastIndexOf("}") + 1)) as Partial<Toets>;
    const toets: Toets = {
      oordeel: (["goed", "let-op", "niet-goed"] as const).includes(p.oordeel as Toets["oordeel"]) ? (p.oordeel as Toets["oordeel"]) : "let-op",
      kop: String(p.kop || "").trim() || "Getoetst aan de criteria.",
      behouden: (Array.isArray(p.behouden) ? p.behouden : []).map(String).slice(0, 4),
      verdwenen: (Array.isArray(p.verdwenen) ? p.verdwenen : []).map(String).slice(0, 5),
      advies: String(p.advies || "").trim() || OORDEEL_TEKST[(p.oordeel as Toets["oordeel"]) || "let-op"],
    };
    await sql`UPDATE page_doc_versions SET toets = ${JSON.stringify(toets)}::jsonb WHERE client_slug = ${slug} AND id = ${id}`;
    return { ok: true, toets };
  } catch (e) {
    return { ok: false, error: "De toets kon niet uitgevoerd worden: " + (e instanceof Error ? e.message : "onbekende fout") };
  }
}

export { OORDEEL_TEKST };
