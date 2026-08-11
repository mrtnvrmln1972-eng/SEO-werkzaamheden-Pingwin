// meta-machine.ts — de correctielus van de meta-motor, op één plek.
//
// lib/meta-rules.ts weet WAT er moet kloppen (pixels, tekens, zoekwoord, CTA).
// Dit bestand zorgt dat het ook ECHT klopt in wat we opleveren: het model kan
// geen pixels tellen, dus meten wij na en laten we gericht herschrijven tot de
// tekst door de opleverpoort komt.
//
// Waarom dit bestand er is: dezelfde lus stond drie keer los uitgeschreven (in
// page-doc voor de documenten, in meta-ctr voor de voorstellen, en de
// klantversie deed helemaal niets). Ze liepen uit elkaar, en juist daardoor kon
// een titel van 380 px het klantdocument in, waar de pixel-motor hem twee
// alinea's verderop afkeurde als "te kort, ruimte onbenut". Eén bron, dus
// iedereen die een meta uitlevert, levert dezelfde kwaliteit.

import { callClaude, LIGHT_MODEL } from "./anthropic";
import {
  META_RULES_PROMPT,
  META_TITLE_PX,
  META_DESC_PX,
  metaOpleverIssues,
  metaPixelInfo,
  pixelAfstand,
  type MetaContext,
  type MetaKind,
} from "./meta-rules";

const LABEL: Record<MetaKind, string> = {
  meta_title: "meta-title",
  meta_description: "meta-description",
};

export type PerfectMeta = {
  /** De beste tekst die de lus wist te bereiken. */
  tekst: string;
  /** Wat er dan nog aan mankeert; leeg = door de poort. */
  issues: string[];
  /** Is de tekst onderweg veranderd? */
  gewijzigd: boolean;
  ok: boolean;
};

export type PerfectOpties = MetaContext & {
  kind: MetaKind;
  tekst: string;
  /** Klant-slug, alleen voor de kostenteller van Claude. */
  slug: string;
  /** Waar de pagina over gaat (H1, H2's, eerste alinea): stof om mee aan te vullen. */
  context?: string;
  /** Standaard 3; genoeg om uit een te korte titel te komen, zonder te stapelen. */
  maxPogingen?: number;
};

/**
 * Meet een meta-title of meta-description, en laat hem herschrijven zolang hij
 * niet door de opleverpoort komt. Geeft altijd de beste kandidaat terug, ook
 * als het niet lukte; nooit een lege of slechtere tekst dan waarmee begonnen is.
 */
export async function perfectioneerMeta(opts: PerfectOpties): Promise<PerfectMeta> {
  const { kind, slug, context } = opts;
  const ctx: MetaContext = { keyword: opts.keyword, h1: opts.h1, title: opts.title };
  const origineel = (opts.tekst || "").trim();
  const maxPogingen = opts.maxPogingen ?? 3;

  let best = origineel;
  let issues = metaOpleverIssues(kind, best, ctx);
  if (!origineel || !issues.length) {
    return { tekst: best, issues, gewijzigd: false, ok: !issues.length && !!origineel };
  }

  const venster = kind === "meta_title" ? META_TITLE_PX : META_DESC_PX;
  const doelTekens = kind === "meta_title" ? "50 tot 58 tekens" : "140 tot 155 tekens";

  for (let poging = 0; issues.length && poging < maxPogingen; poging++) {
    const info = metaPixelInfo(kind, best);
    const user = [
      `Herschrijf deze ${LABEL[kind]} zodat hij aan ALLE regels voldoet.`,
      `Wat er nu aan mankeert: ${issues.join("; ")}.`,
      `Meting van de huidige tekst: ${info.chars} tekens, ${info.px} px. Het venster van Google is ${venster.min} tot ${venster.max} px; mik op ${doelTekens} en vul het venster zo goed mogelijk zonder eroverheen te gaan.`,
      opts.keyword ? `Primair zoekwoord (moet ${kind === "meta_title" ? "in de eerste drie tot vier woorden staan" : "1x letterlijk in de eerste 120 tekens staan"}): ${opts.keyword}` : "",
      opts.h1 && kind === "meta_title" ? `H1 van de pagina (titel moet hier qua kernwoorden op aansluiten): ${opts.h1}` : "",
      opts.title && kind === "meta_description" ? `De meta-title van deze pagina (niet letterlijk herhalen): ${opts.title}` : "",
      context ? `WAAR DE PAGINA OVER GAAT (hieruit put je om de ruimte te vullen; verzin niets wat hier niet in staat):\n${context.slice(0, 1200)}` : "",
      `Huidige tekst: ${best}`,
      `Geef ALLEEN de nieuwe tekst terug, exact zoals hij in Google moet komen. Eén regel, geen uitleg, geen aanhalingstekens.`,
    ].filter(Boolean).join("\n");

    const raw = await callClaude(META_RULES_PROMPT, [{ role: "user", content: user }], 300, { slug, action: "meta_correctie" }, LIGHT_MODEL).catch(() => "");
    const kandidaat = (raw || "").trim().split("\n")[0].replace(/^["'“”]+|["'“”]+$/g, "").trim();
    if (!kandidaat) break;

    // Alleen overnemen als het écht beter is: minder gebreken, of bij gelijk
    // spel dichter bij het venster van Google. Die tie-break telt beide kanten
    // op: eerder won "smaller", waardoor een te korte titel nóg korter mocht.
    const kIssues = metaOpleverIssues(kind, kandidaat, ctx);
    const dichterbij = pixelAfstand(kind, kandidaat) < pixelAfstand(kind, best);
    if (kIssues.length < issues.length || (kIssues.length === issues.length && dichterbij)) {
      best = kandidaat;
      issues = kIssues;
    }
  }

  return { tekst: best, issues, gewijzigd: best !== origineel, ok: !issues.length };
}
