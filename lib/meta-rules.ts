/**
 * meta-rules.ts — de meta-motor: één bron van waarheid voor meta title en
 * meta description (lengte, pixelbreedte, CTR-regels).
 *
 * Google kapt titels en beschrijvingen af op PIXELBREEDTE, niet op aantal
 * tekens. Een "W" is breed, een "i" smal. Deze module rekent de breedte na
 * in Arial (het SERP-lettertype) en toetst daarnaast de bewezen CTR-regels
 * uit extern onderzoek (Zyppy/Backlinko/Ahrefs, 2025-2026):
 *   - titel 40-60 tekens en ≤ 580 px, zoekwoord vooraan, merk achteraan
 *     met koppelteken (pijp wordt 2x zo vaak door Google herschreven),
 *     geen [vierkante haken], geen ALL CAPS, geen woordherhaling;
 *   - description 120-155 tekens en ≤ 920 px, kern + zoekwoord in de
 *     eerste ~120 tekens (mobiel kapt daar af), zoekwoord 1x letterlijk
 *     (max 2x), actieve CTA en minstens één concreet feit.
 *
 * Pure functies, geen DOM: bruikbaar op de server (prompts, validatie,
 * correctielus) én in de browser (live meter). Kalibratie alleen via
 * META_TITLE_PX / META_DESC_PX hieronder.
 */

/* ------------------------------------------------------------------
 * Google's vakbreedtes en lettergroottes (desktop).
 *   - font: lettergrootte in px waarin Google de tekst rendert.
 *   - min : onder deze breedte blijft ruimte onbenut (te kort).
 *   - max : boven deze breedte kapt Google af (te lang).
 * Titel ~580 px @ 20px Arial (veilige grens; mobiel kapt rond 480 px),
 * beschrijving ~920 px @ 13px Arial (mobiel toont grofweg de eerste
 * 120 tekens).
 * ------------------------------------------------------------------ */
export const META_TITLE_PX = { font: 20, min: 430, max: 580 } as const;
export const META_DESC_PX = { font: 13, min: 800, max: 920 } as const;

/** Mobiele richtwaarden, alleen ter informatie in teksten en prompts. */
export const META_MOBILE = { titleMaxPx: 480, descFirstChars: 120 } as const;

export type MetaKind = "meta_title" | "meta_description";

/**
 * Arial-glyphbreedtes in eenheden per em (1000 = 1 em), de standaard
 * font-metrics van Arial/Helvetica. Breedte in px = (eenheden / 1000) * font.
 */
const ARIAL_WIDTHS: Record<string, number> = {
  " ": 278, "!": 278, '"': 355, "#": 556, $: 556, "%": 889, "&": 667, "'": 191,
  "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278,
  "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556,
  "8": 556, "9": 556, ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556,
  "@": 1015, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722,
  I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722,
  S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, "[": 278,
  "\\": 278, "]": 278, "^": 469, _: 556, "`": 333, a: 556, b: 556, c: 500, d: 556,
  e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556,
  o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500,
  y: 500, z: 500, "{": 334, "|": 260, "}": 334, "~": 584,
};

function charUnits(ch: string): number {
  const w = ARIAL_WIDTHS[ch];
  if (w !== undefined) return w;
  if (ch >= "A" && ch <= "Z") return 667;
  return 556;
}

/** Pixelbreedte van een tekst in Arial bij een gegeven lettergrootte. */
export function measureTextPx(text: string, fontSizePx: number): number {
  if (!text) return 0;
  // Diakrieten (é, ë, ï, ö, ...) afsplitsen zodat we de basisletter meten;
  // het accent-teken voegt zelf nauwelijks breedte toe.
  const norm = text.normalize("NFD").replace(/[̀-ͯ]/g, "");
  let units = 0;
  for (const ch of norm) units += charUnits(ch);
  return (units / 1000) * fontSizePx;
}

export type PixelStatus = "kort" | "ok" | "bijna" | "over";

export type MetaPixelInfo = {
  px: number;
  chars: number;
  min: number;
  max: number;
  status: PixelStatus;
  /** Binnen [min, max], dus niet afgekapt en geen onbenutte ruimte. */
  ok: boolean;
};

/** Meet een titel of beschrijving en geef pixels, tekens en oordeel terug. */
export function metaPixelInfo(kind: MetaKind, text: string): MetaPixelInfo {
  const cfg = kind === "meta_title" ? META_TITLE_PX : META_DESC_PX;
  const px = Math.round(measureTextPx(text ?? "", cfg.font));
  const chars = [...(text ?? "")].length;
  const ok = px >= cfg.min && px <= cfg.max;
  const status: PixelStatus =
    px > cfg.max
      ? "over"
      : px < cfg.min
        ? "kort"
        : px > cfg.max * 0.92
          ? "bijna"
          : "ok";
  return { px, chars, min: cfg.min, max: cfg.max, status, ok };
}

/** Korte oordeelregel voor in meetprofielen en chat, bv.
 *  `54 tekens, 512 px van max 580; past`. */
export function metaVerdictText(kind: MetaKind, text: string): string {
  const info = metaPixelInfo(kind, text);
  const woord =
    info.status === "over"
      ? "te lang, wordt door Google afgekapt"
      : info.status === "kort"
        ? "te kort, ruimte onbenut"
        : info.status === "bijna"
          ? "past, bijna vol"
          : "past";
  return `${info.chars} tekens, ${info.px} px van max ${info.max}; ${woord}`;
}

/**
 * Harde gebreken die een herschrijving rechtvaardigen (te breed voor Google,
 * pijp, vierkante haken). Te kort is geen hard gebrek: dat kost geen afkapping.
 * Gedeeld door de correctielus in page-doc en de CTR-machine.
 */
export function metaHardIssues(kind: MetaKind, text: string): string[] {
  const issues: string[] = [];
  const info = metaPixelInfo(kind, text);
  if (info.px > info.max) issues.push(`te breed: ${info.px} px, harde grens ${info.max} px (${info.chars} tekens)`);
  if (kind === "meta_title" && /\|/.test(text)) issues.push("bevat een pijp (|); gebruik een koppelteken of laat het merk weg");
  if (kind === "meta_title" && /[\[\]]/.test(text)) issues.push("bevat vierkante haken; die worden door Google herschreven");
  return issues;
}

/* ------------------------------------------------------------------
 * CTR-regelchecks (uitvoerbare vorm van META-01 t/m META-10).
 * ------------------------------------------------------------------ */

export type MetaCheck = {
  id: string;
  label: string;
  pass: boolean;
  /** Gemeten waarde of korte toelichting bij het oordeel. */
  waarde: string;
};

const CTA_RE = /\b(bekijk|ontdek|vraag|bereken|lees|vergelijk|start|kies|plan|ontvang|krijg|bestel|boek|probeer|download|neem)\b/i;
const FEIT_RE = /(\d|€|%|\bgratis\b|\bbinnen\b|\bvanaf\b|\bgarantie\b|\bjaar\b|\bvandaag\b|\bdirect\b)/i;

function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function tokens(s: string): string[] {
  return norm(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

/** Alle harde titel-checks. `keyword` = primair zoekwoord, `h1` optioneel. */
export function checkMetaTitle(title: string, keyword?: string, h1?: string): MetaCheck[] {
  const t = title || "";
  const chars = [...t].length;
  const info = metaPixelInfo("meta_title", t);
  const checks: MetaCheck[] = [];

  checks.push({
    id: "META-02",
    label: "Lengte 40-60 tekens en binnen 580 px",
    pass: chars >= 40 && chars <= 60 && info.px <= info.max,
    waarde: `${chars} tekens, ${info.px} px (max ${info.max})`,
  });

  if (keyword) {
    const front = norm(t).slice(0, 30);
    const pass = front.includes(norm(keyword));
    checks.push({
      id: "META-03",
      label: "Primair zoekwoord front-loaded (eerste 30 tekens)",
      pass,
      waarde: pass ? `'${keyword}' vooraan` : `'${keyword}' niet in eerste 30 tekens`,
    });
  }

  const heeftPijp = /\|/.test(t);
  checks.push({
    id: "META-05",
    label: "Scheidingsteken is koppelteken, geen pijp",
    pass: !heeftPijp,
    waarde: heeftPijp ? "bevat | (pijp wordt 2x zo vaak herschreven)" : "geen pijp",
  });

  const haken = /[\[\]]/.test(t);
  checks.push({
    id: "META-11",
    label: "Geen vierkante haken",
    pass: !haken,
    waarde: haken ? "bevat [ of ] (78% wordt herschreven)" : "ok",
  });

  const capsWoord = t.match(/\b[A-Z]{4,}\b/);
  const uitroep = (t.match(/!/g) || []).length;
  checks.push({
    id: "META-12",
    label: "Geen ALL CAPS, max 1 uitroepteken, geen emoji",
    pass: !capsWoord && uitroep <= 1 && !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t),
    waarde: capsWoord ? `'${capsWoord[0]}' in hoofdletters` : uitroep > 1 ? `${uitroep} uitroeptekens` : "ok",
  });

  const woorden = tokens(t);
  const dubbel = woorden.find((w, i) => woorden.indexOf(w) !== i);
  checks.push({
    id: "META-13",
    label: "Geen woordherhaling in de titel",
    pass: !dubbel,
    waarde: dubbel ? `'${dubbel}' komt dubbel voor` : "ok",
  });

  if (h1) {
    const ht = new Set(tokens(h1));
    const overlap = woorden.filter((w) => ht.has(w)).length;
    const basis = Math.min(woorden.length, ht.size) || 1;
    const pass = overlap / basis >= 0.4;
    checks.push({
      id: "H1-03",
      label: "Titel deelt de kern met de H1 (anti-herschrijf)",
      pass,
      waarde: `${overlap} gedeelde kernwoorden`,
    });
  }

  return checks;
}

/** Alle harde description-checks. */
export function checkMetaDescription(desc: string, keyword?: string, title?: string): MetaCheck[] {
  const d = desc || "";
  const chars = [...d].length;
  const info = metaPixelInfo("meta_description", d);
  const checks: MetaCheck[] = [];

  checks.push({
    id: "META-07",
    label: "Lengte 120-155 tekens en binnen 920 px",
    pass: chars >= 120 && chars <= 155 && info.px <= info.max,
    waarde: `${chars} tekens, ${info.px} px (max ${info.max})`,
  });

  if (keyword) {
    const kw = norm(keyword);
    const voorkomens = norm(d).split(kw).length - 1;
    checks.push({
      id: "META-08",
      label: "Zoekwoord 1x letterlijk (max 2x, wordt vet in Google)",
      pass: voorkomens >= 1 && voorkomens <= 2,
      waarde: `${voorkomens}x '${keyword}'`,
    });
    const inKern = norm(d).slice(0, META_MOBILE.descFirstChars).includes(kw);
    checks.push({
      id: "META-14",
      label: `Kernboodschap + zoekwoord in de eerste ${META_MOBILE.descFirstChars} tekens (mobiel)`,
      pass: inKern,
      waarde: inKern ? "zoekwoord in de kern" : "zoekwoord pas na de mobiele afkap",
    });
  }

  const cta = d.match(CTA_RE);
  checks.push({
    id: "META-09",
    label: "Actieve CTA (Ontdek, Bekijk, Plan, Bereken, ...)",
    pass: !!cta,
    waarde: cta ? `'${cta[0]}'` : "geen CTA-werkwoord gevonden",
  });

  const feit = d.match(FEIT_RE);
  checks.push({
    id: "META-15",
    label: "Minstens één concreet feit (getal, prijs, termijn, garantie)",
    pass: !!feit,
    waarde: feit ? `'${feit[0]}'` : "geen concreet feit gevonden",
  });

  if (title) {
    const kopie = norm(d).slice(0, 30) === norm(title).slice(0, 30);
    checks.push({
      id: "META-10",
      label: "Description herhaalt de titel niet letterlijk",
      pass: !kopie,
      waarde: kopie ? "eerste 30 tekens identiek aan de titel" : "ok",
    });
  }

  return checks;
}

export type MetaValidation = {
  title: { info: MetaPixelInfo; checks: MetaCheck[]; ok: boolean };
  description: { info: MetaPixelInfo; checks: MetaCheck[]; ok: boolean };
  ok: boolean;
};

/** Toets titel + description in één keer tegen alle harde regels. */
export function validateMeta(
  title: string,
  description: string,
  keyword?: string,
  h1?: string,
): MetaValidation {
  const tChecks = checkMetaTitle(title, keyword, h1);
  const dChecks = checkMetaDescription(description, keyword, title);
  const tOk = tChecks.every((c) => c.pass);
  const dOk = dChecks.every((c) => c.pass);
  return {
    title: { info: metaPixelInfo("meta_title", title), checks: tChecks, ok: tOk },
    description: { info: metaPixelInfo("meta_description", description), checks: dChecks, ok: dOk },
    ok: tOk && dOk,
  };
}

/* ------------------------------------------------------------------
 * Promptblok: dezelfde regels in schrijfinstructie-vorm, ter injectie in
 * elke systeemprompt die een meta title of description genereert of toetst.
 * ------------------------------------------------------------------ */
export const META_RULES_PROMPT = `META-REGELS (hard, altijd toepassen bij meta title en meta description):
Titel:
- 40-60 tekens (doel 50-58) en maximaal ~580 px in Arial; wordt anders door Google afgekapt.
- Primair zoekwoord (of natuurlijke variant) in de eerste 3-4 woorden, vóór het scheidingsteken.
- Merknaam achteraan met " - " (koppelteken). NOOIT een pijp (|): die wordt 2x zo vaak door Google herschreven. Laat de merknaam weg als de titel anders te lang wordt (Google toont de sitenaam toch al).
- Sluit qua kernwoorden nauw aan op de H1 (grootste middel tegen herschrijven door Google), maar hoeft niet woordelijk identiek te zijn.
- Nooit [vierkante haken]; (gewone haakjes) mogen, bv. (2026). Geen ALL CAPS, geen emoji, max 1 uitroepteken, geen woordherhaling.
- Een concreet cijfer of jaartal alleen als het eerlijk bij de pagina past; geen hype-woorden ("ultiem", "beste ooit"): die kosten aantoonbaar kliks.
- Nederlandse zinsopbouw: alleen het eerste woord en eigennamen met hoofdletter.
Description:
- 120-155 tekens en maximaal ~920 px; de kernboodschap MET het zoekwoord in de eerste 120 tekens (mobiel kapt daar af).
- Zoekwoord 1x letterlijk (wordt vetgedrukt in Google), maximaal 2x.
- Actieve zin met één CTA-werkwoord (Ontdek, Bekijk, Vergelijk, Plan, Bereken, Vraag aan) en minstens één concreet feit (getal, prijs, termijn, garantie, USP).
- Vat de echte pagina-inhoud samen (verlaagt de kans dat Google de tekst vervangt), herhaal de titel niet letterlijk, uniek per pagina.
Toon: positief en concreet, passend bij de zoekintentie (informatie = antwoordbelofte, commercieel = USP + bewijs, transactioneel = aanbod + CTA). Noem waar relevant iets wat een AI-antwoord niet biedt: plaatsnaam, prijs, bewijs, actualiteit.`;
