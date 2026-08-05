import { metaPixelInfo } from "./meta-rules";

// ═══════════════════════════════════════════════════════════
// PAGINASCORE: een snelle thermometer per pagina (0-100)
// ═══════════════════════════════════════════════════════════
// Geen analyse, geen AI: puur rekenwerk op de gegevens die de wekelijkse
// content-scan toch al vastlegt. Zo is de score gratis, meteen klaar en geeft
// hij elke keer hetzelfde antwoord. Bedoeld om in één oogopslag te zien welke
// pagina's het meeste werk nodig hebben, niet om een analyse te vervangen.
//
// Twee dingen houden de score eerlijk:
//  1. Menu en footer tellen niet mee. Die staan op élke pagina, dus zonder
//     correctie haalt iedereen de interne links en zakt iedereen op alt-teksten.
//  2. Wat niet van toepassing is, kost geen punten: heeft een pagina geen eigen
//     afbeeldingen, dan vervalt dat onderdeel uit de som (in plaats van dat de
//     pagina er automatisch onder blijft hangen).
// ═══════════════════════════════════════════════════════════

export type ScoreInvoer = {
  metaTitle: string;
  metaDescription: string;
  h1: string;
  h1Count: number | null;          // null = nog niet gemeten (oude snapshot)
  h2s: string[];
  altTags: { src: string; alt: string }[];
  internalLinks: { href: string; text: string }[];
  wordCount: number;               // hele body, dus inclusief menu en footer
  mainWordCount: number | null;    // alleen de eigen tekst; null = nog niet gemeten
  schemaTypes: string[];
};

export type KlantContext = {
  vasteLinks: Set<string>;         // links die op vrijwel elke pagina staan (menu, footer)
  vasteAfbeeldingen: Set<string>;  // idem voor afbeeldingen (logo, iconen)
  omlijstingWoorden: number;       // schatting van menu + footer, alleen als terugval
  betrouwbaar: boolean;            // false bij te weinig gemeten pagina's
};

export type ScorePunt = { naam: string; behaald: number; max: number; uitleg: string };

export type PaginaScore = {
  score: number;
  label: string;
  niveau: "goed" | "matig" | "zwak";
  woorden: number;
  woordenGeschat: boolean;
  punten: ScorePunt[];
};

const MIN_PAGINAS_VOOR_CONTEXT = 5;
const VASTE_DREMPEL = 0.8;         // op 80% of meer van de pagina's = vaste omlijsting
const TECHNISCHE_SCHEMAS = new Set(["WebSite", "WebPage", "Organization", "BreadcrumbList", "SearchAction", "ImageObject", "SiteNavigationElement", "CollectionPage"]);

const linkSleutel = (href: string) => (href || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
const zinnigeAlt = (a: { src: string; alt: string }) => {
  const alt = (a.alt || "").trim();
  if (alt.length < 3) return false;
  // Een alt die de bestandsnaam herhaalt ("IMG_2043.jpg") zegt niets.
  const kaal = a.src.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim().toLowerCase();
  return alt.toLowerCase() !== kaal;
};

/**
 * Bepaalt uit alle gemeten pagina's van één klant wat de vaste omlijsting is
 * (menu, footer, logo). Eén keer per klant berekenen en meegeven aan scorePagina.
 */
export function klantContext(alle: ScoreInvoer[]): KlantContext {
  const n = alle.length;
  const betrouwbaar = n >= MIN_PAGINAS_VOOR_CONTEXT;
  const vasteLinks = new Set<string>();
  const vasteAfbeeldingen = new Set<string>();
  if (betrouwbaar) {
    const linkTeller = new Map<string, number>();
    const imgTeller = new Map<string, number>();
    for (const p of alle) {
      for (const h of new Set(p.internalLinks.map((l) => linkSleutel(l.href)))) linkTeller.set(h, (linkTeller.get(h) || 0) + 1);
      for (const s of new Set(p.altTags.map((a) => a.src))) imgTeller.set(s, (imgTeller.get(s) || 0) + 1);
    }
    const grens = n * VASTE_DREMPEL;
    for (const [k, v] of linkTeller) if (v >= grens) vasteLinks.add(k);
    for (const [k, v] of imgTeller) if (v >= grens) vasteAfbeeldingen.add(k);
  }
  // Terugval voor pagina's zonder gemeten eigen tekst: het laagste woordaantal
  // van de site benadert de vaste omlijsting. Bewust alleen als terugval; het
  // trekt structureel iets te veel af.
  const woorden = alle.map((p) => p.wordCount).filter((w) => w > 0);
  const omlijstingWoorden = woorden.length ? Math.min(...woorden) : 0;
  return { vasteLinks, vasteAfbeeldingen, omlijstingWoorden, betrouwbaar };
}

/** Rekent één pagina door tot een score van 0 tot 100 met de onderbouwing erbij. */
export function scorePagina(s: ScoreInvoer, ctx: KlantContext): PaginaScore {
  const punten: ScorePunt[] = [];

  // ── Eigen tekst (25) ──
  const geschat = s.mainWordCount == null;
  const woorden = geschat ? Math.max(s.wordCount - ctx.omlijstingWoorden, 0) : (s.mainWordCount as number);
  const tekstPunten = woorden >= 600 ? 25 : woorden >= 300 ? 12 : Math.round((woorden / 300) * 12);
  punten.push({ naam: "Eigen tekst", behaald: tekstPunten, max: 25, uitleg: `${woorden} woorden${geschat ? " (geschat)" : ""}${woorden >= 600 ? "" : ", 600 is vol"}` });

  // ── Koppen (20): één H1 en een werkbaar aantal H2's ──
  const h1Punten = s.h1Count == null ? (s.h1.trim() ? 8 : 0) : s.h1Count === 1 ? 8 : 0;
  const h1Uitleg = s.h1Count == null ? (s.h1.trim() ? "H1 aanwezig" : "H1 ontbreekt") : s.h1Count === 1 ? "precies één H1" : s.h1Count === 0 ? "geen H1" : `${s.h1Count} H1's, dat moet er één zijn`;
  const aantalH2 = s.h2s.length;
  const h2Punten = aantalH2 >= 4 && aantalH2 <= 12 ? 12 : aantalH2 >= 1 ? 6 : 0;
  punten.push({ naam: "Koppen", behaald: h1Punten + h2Punten, max: 20, uitleg: `${h1Uitleg}, ${aantalH2} H2${aantalH2 === 1 ? "" : "'s"}${aantalH2 >= 4 && aantalH2 <= 12 ? "" : " (4 tot 12 is goed)"}` });

  // ── Meta-titel en meta-description (15 + 15) ──
  for (const [naam, kind, tekst] of [["Meta-titel", "meta_title", s.metaTitle], ["Meta-description", "meta_description", s.metaDescription]] as const) {
    if (!tekst.trim()) { punten.push({ naam, behaald: 0, max: 15, uitleg: "ontbreekt" }); continue; }
    const info = metaPixelInfo(kind, tekst);
    const p = info.status === "ok" ? 15 : info.status === "bijna" ? 13 : 8;
    const woord = info.status === "over" ? "te lang, Google kapt hem af" : info.status === "kort" ? "te kort, ruimte onbenut" : info.status === "bijna" ? "past, bijna vol" : "past";
    punten.push({ naam, behaald: p, max: 15, uitleg: `${info.chars} tekens, ${woord}` });
  }

  // ── Alt-teksten (15), alleen over de eigen afbeeldingen ──
  const eigenAfbeeldingen = s.altTags.filter((a) => !ctx.vasteAfbeeldingen.has(a.src));
  if (eigenAfbeeldingen.length === 0) {
    punten.push({ naam: "Alt-teksten", behaald: 0, max: 0, uitleg: "geen eigen afbeeldingen, telt niet mee" });
  } else {
    const met = eigenAfbeeldingen.filter(zinnigeAlt).length;
    const aantal = eigenAfbeeldingen.length;
    punten.push({ naam: "Alt-teksten", behaald: Math.round((met / aantal) * 15), max: 15, uitleg: aantal === 1 ? (met ? "de afbeelding heeft een zinnige alt-tekst" : "de afbeelding heeft geen zinnige alt-tekst") : `${met} van de ${aantal} afbeeldingen ${met === 1 ? "heeft" : "hebben"} een zinnige alt-tekst` });
  }

  // ── Interne links (5), zonder menu en footer ──
  const eigenLinks = new Set(s.internalLinks.map((l) => linkSleutel(l.href)).filter((h) => h && !ctx.vasteLinks.has(h)));
  const linkPunten = eigenLinks.size >= 5 ? 5 : eigenLinks.size >= 3 ? 3 : 0;
  punten.push({ naam: "Interne links", behaald: linkPunten, max: 5, uitleg: `${eigenLinks.size} link${eigenLinks.size === 1 ? "" : "s"} vanuit de tekst${ctx.betrouwbaar ? "" : " (menu telt nog mee, te weinig gemeten pagina's)"}` });

  // ── Structured data (5) ──
  const inhoudelijk = s.schemaTypes.filter((t) => !TECHNISCHE_SCHEMAS.has(t));
  const schemaPunten = inhoudelijk.length ? 5 : s.schemaTypes.length ? 2 : 0;
  punten.push({ naam: "Structured data", behaald: schemaPunten, max: 5, uitleg: inhoudelijk.length ? inhoudelijk.slice(0, 3).join(", ") : s.schemaTypes.length ? "alleen technische blokken" : "geen schema" });

  const behaald = punten.reduce((t, p) => t + p.behaald, 0);
  const maxToepasbaar = punten.reduce((t, p) => t + p.max, 0) || 1;
  const score = Math.round((behaald / maxToepasbaar) * 100);
  const niveau = score >= 80 ? "goed" : score >= 50 ? "matig" : "zwak";
  const label = niveau === "goed" ? "Goed ingericht" : niveau === "matig" ? "Kan beter" : "Nog veel te doen";
  return { score, label, niveau, woorden, woordenGeschat: geschat, punten };
}
