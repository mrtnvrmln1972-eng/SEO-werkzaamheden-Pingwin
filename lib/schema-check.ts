// ═══════════════════════════════════════════════════════════
// SCHEMA-CONTROLE: inventarisatie, plugin-detectie en validatie in code
// ═══════════════════════════════════════════════════════════
// Geen AI hier: dit zijn de harde checks rond de structured data-motor.
// 1. analyzeExistingSchema: wat staat er al op de pagina en van welke plugin
//    komt het (herkend aan @id-patronen, niet geraden door het model).
// 2. validateJsonLd: klopt de gegenereerde JSON-LD (graph, @id's, geen
//    dubbelingen naast de plugin, verplichte velden, geen beweringen die
//    nergens op de pagina of in de bevestigde gegevens staan).
// Fouten gaan terug de motor in voor één herstelronde; wat overblijft wordt
// een zichtbare waarschuwing, nooit een stille doorlevering.
// ═══════════════════════════════════════════════════════════

type Node = Record<string, unknown>;

export type SchemaInventory = {
  plugin: "yoast" | "rankmath" | "aioseo" | "handmatig" | "geen";
  pluginLabel: string;
  types: string[];
  ids: string[];
  blokken: number;
};

// @graph en geneste arrays platslaan tot losse nodes.
function flatten(input: unknown, out: Node[] = []): Node[] {
  if (Array.isArray(input)) { for (const i of input) flatten(i, out); return out; }
  if (input && typeof input === "object") {
    const n = input as Node;
    if (Array.isArray(n["@graph"])) flatten(n["@graph"], out);
    if (n["@type"]) out.push(n);
  }
  return out;
}

function typesOf(n: Node): string[] {
  const t = n["@type"];
  return (Array.isArray(t) ? t : [t]).map((x) => String(x || "")).filter(Boolean);
}

export function analyzeExistingSchema(rawLd: string[]): SchemaInventory {
  const nodes: Node[] = [];
  let blokken = 0;
  for (const raw of rawLd || []) {
    try { flatten(JSON.parse(raw), nodes); blokken++; } catch { /* kapot blok telt niet mee */ }
  }
  const types = [...new Set(nodes.flatMap(typesOf))];
  const ids = [...new Set(nodes.map((n) => String(n["@id"] || "")).filter(Boolean))];
  const alles = rawLd.join(" ").toLowerCase();
  let plugin: SchemaInventory["plugin"] = nodes.length ? "handmatig" : "geen";
  // Herkenning aan de vaste @id/context-patronen van de grote WordPress-plugins.
  if (ids.some((i) => i.includes("#/schema/")) || alles.includes("yoast")) plugin = "yoast";
  else if (alles.includes("rankmath") || ids.some((i) => /#richsnippet/i.test(i))) plugin = "rankmath";
  else if (alles.includes("aioseo")) plugin = "aioseo";
  const labels: Record<SchemaInventory["plugin"], string> = {
    yoast: "Yoast SEO", rankmath: "Rank Math", aioseo: "All in One SEO", handmatig: "handmatig/onbekend", geen: "geen",
  };
  return { plugin, pluginLabel: labels[plugin], types, ids, blokken };
}

// Verplichte velden per hoofdtype (pragmatische kern, geen volledige schema.org-spec).
const REQUIRED: Record<string, string[]> = {
  Product: ["offers"],
  LocalBusiness: ["address"],
  MedicalClinic: ["address"],
  Service: ["provider"],
  Article: ["author", "datePublished"],
  BlogPosting: ["author", "datePublished"],
  FAQPage: ["mainEntity"],
  Physician: ["name"],
  BreadcrumbList: ["itemListElement"],
};

// Alleen-verwijzing-node: {@id, @type, name} mag altijd, ook als de plugin het type al levert.
function isReference(n: Node): boolean {
  const keys = Object.keys(n).filter((k) => !["@id", "@type", "name", "@context"].includes(k));
  return keys.length === 0 && !!n["@id"];
}

export function validateJsonLd(jsonld: unknown, ctx: { bestaand: SchemaInventory; paginaTekst: string; bevestigd: string }): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodes = flatten(jsonld);
  if (!nodes.length) return { errors: ["De gegenereerde JSON-LD bevat geen enkele node met een @type."], warnings };

  // Dubbele @id's binnen onze eigen graph.
  const seenIds = new Map<string, number>();
  for (const n of nodes) { const id = String(n["@id"] || ""); if (id) seenIds.set(id, (seenIds.get(id) || 0) + 1); }
  for (const [id, count] of seenIds) if (count > 1) errors.push(`De @id "${id}" komt ${count} keer voor in de gegenereerde code; elke node hoort een unieke @id te hebben.`);

  // Botsing met bestaand schema: zelfde @id opnieuw definiëren (met inhoud) mag niet,
  // en een type dat de plugin al levert mag alleen als kale verwijzing terugkomen.
  const bestaandeIds = new Set(ctx.bestaand.ids);
  const bestaandeTypes = new Set(ctx.bestaand.types);
  for (const n of nodes) {
    if (isReference(n)) continue;
    const id = String(n["@id"] || "");
    if (id && bestaandeIds.has(id)) errors.push(`De @id "${id}" bestaat al in het schema dat ${ctx.bestaand.pluginLabel} levert; onze code mag die alleen als verwijzing gebruiken, niet opnieuw definiëren.`);
    for (const t of typesOf(n)) {
      if (bestaandeTypes.has(t)) errors.push(`Type ${t} staat al op de pagina (via ${ctx.bestaand.pluginLabel}); een tweede volledige ${t}-node geeft dubbel schema. Alleen aanvullen met ontbrekende types, of verwijzen met de bestaande @id.`);
    }
  }

  // Verplichte velden per type.
  for (const n of nodes) {
    if (isReference(n)) continue;
    for (const t of typesOf(n)) {
      for (const req of REQUIRED[t] || []) {
        if (n[req] == null || (typeof n[req] === "string" && !String(n[req]).trim())) errors.push(`${t}-node mist het verplichte veld "${req}".`);
      }
    }
  }

  // Hallucinatie-rem: cijfers in gevoelige velden moeten aantoonbaar ergens vandaan komen.
  const bron = `${ctx.paginaTekst}\n${ctx.bevestigd}`.toLowerCase();
  const checkCijfer = (label: string, value: unknown) => {
    const v = String(value ?? "").trim();
    if (!v) return;
    const kaal = v.replace(/[^0-9.,]/g, "");
    if (kaal && !bron.includes(kaal) && !bron.includes(kaal.replace(".", ","))) {
      errors.push(`${label} "${v}" is niet terug te vinden op de pagina of in de bevestigde gegevens; weglaten (nooit verzinnen).`);
    }
  };
  for (const n of nodes) {
    const rating = n["aggregateRating"] as Node | undefined;
    if (rating && typeof rating === "object") {
      checkCijfer("Reviewcijfer", rating["ratingValue"]);
      checkCijfer("Aantal reviews", rating["reviewCount"] ?? rating["ratingCount"]);
    }
    if (n["review"] && !bron.includes("review") && !bron.includes("beoordel")) warnings.push("Er staat een review-node in de code terwijl de pagina niets over reviews toont; controleer of dit klopt.");
    const offers = n["offers"] as Node | undefined;
    if (offers && typeof offers === "object") checkCijfer("Prijs", offers["price"]);
  }

  return { errors: [...new Set(errors)].slice(0, 12), warnings: [...new Set(warnings)].slice(0, 6) };
}

// ─── Paginatype-routing: welke schema-set hoort erbij (per bedrijfstype × paginatype) ───

export const PAGINATYPES = ["home", "dienst", "locatie", "product", "artikel", "contact", "overig"] as const;
export type Paginatype = (typeof PAGINATYPES)[number];

export function normalizePaginatype(vrij: string): Paginatype {
  const v = (vrij || "").toLowerCase();
  if (/home|voorpagina/.test(v)) return "home";
  if (/product/.test(v)) return "product";
  if (/artikel|blog|nieuws|informatie/.test(v)) return "artikel";
  if (/locatie|vestiging|plaats|stad|regio|lokaal/.test(v)) return "locatie";
  if (/contact/.test(v)) return "contact";
  if (/dienst|service|behandel|landings/.test(v)) return "dienst";
  return "overig";
}

// Verwachte hoofdtypes bovenop de basis (WebPage + BreadcrumbList) per combinatie.
export function expectedTypes(bedrijfstype: string, paginatype: Paginatype): string[] {
  const basis = ["WebPage", "BreadcrumbList"];
  const per: Record<string, Partial<Record<Paginatype, string[]>>> = {
    kliniek: { dienst: ["MedicalProcedure"], locatie: ["MedicalClinic"], artikel: ["Article"], home: ["MedicalClinic"] },
    webshop: { product: ["Product"], artikel: ["Article"], home: ["Organization"] },
    dienstverlener: { dienst: ["Service"], locatie: ["Service"], artikel: ["Article"], home: ["Organization"] },
    lokaal: { dienst: ["Service"], locatie: ["LocalBusiness"], home: ["LocalBusiness"] },
    informatief: { artikel: ["Article"], home: ["Organization"] },
  };
  return [...basis, ...((per[bedrijfstype] || {})[paginatype] || [])];
}

// Controle achteraf: welke verwachte types ontbreken in (bestaand + gegenereerd) samen.
export function missingExpected(bedrijfstype: string, paginatype: Paginatype, bestaand: string[], gegenereerd: unknown): string[] {
  const aanwezig = new Set([...bestaand, ...flatten(gegenereerd).flatMap(typesOf)]);
  // Subtypes tellen mee voor hun ouder (MedicalClinic is een LocalBusiness enz.).
  const dekt = (t: string) => aanwezig.has(t)
    || (t === "LocalBusiness" && [...aanwezig].some((a) => /Business|Clinic|Store|Restaurant/i.test(a)))
    || (t === "Organization" && [...aanwezig].some((a) => /Organization|Business|Clinic/i.test(a)))
    || (t === "Article" && [...aanwezig].some((a) => /Article|Posting/i.test(a)));
  return expectedTypes(bedrijfstype, paginatype).filter((t) => !dekt(t));
}
