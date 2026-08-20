// ═══════════════════════════════════════════════════════════
// DE METING: WAT ER OP DEZE PAGINA STAAT, IN CIJFERS
// ═══════════════════════════════════════════════════════════
// De kennisbank zegt per criterium hóe je het vaststelt: uit een meting, van de
// foto, of met een oordeel erbij. Dit bestand vult de eerste soort. Zonder deze
// laag zou een oordeel over contrast, over het aantal formuliervelden of over de
// laadtijd een indruk zijn, en een indruk is precies wat we hier niet willen: bij
// een klant moet elke bevinding terug te leiden zijn naar iets dat is gemeten.
//
// ÉÉN BEZOEK, DRIE UITKOMSTEN
// ═══════════════════════════
// Lezen, meten en fotograferen gebeuren in hetzelfde paginabezoek. Dat scheelt
// tijd, maar de echte reden is dat het dan gegarandeerd dezelfde pagina is. Twee
// losse bezoeken kunnen twee verschillende pagina's opleveren (een A/B-test, een
// wisselende kop, een uitverkochte actie), en dan gaat het oordeel over iets
// anders dan de foto laat zien.
//
// WAT DEZE METING NIET IS
// ═══════════════════════
// Het is een meting in ónze browser, op een server, met een snelle verbinding.
// Dat is geen veldmeting: wat Google in Core Web Vitals ziet, komt van echte
// bezoekers op echte telefoons en valt vrijwel altijd slechter uit. Elke
// snelheidswaarde zegt dat er daarom bij. Liegen door weglating is hier het
// grootste risico, want een getal ziet er altijd hard uit.
//
// EN HIJ SCHRIJFT NIETS. Zie `proeven/pagina-lab-schrijft-niet.proef.ts`.
// ═══════════════════════════════════════════════════════════

import { metBrowser } from "../browser";
import {
  APPARATEN,
  gaNaar,
  klikCookieWeg,
  leesDocument,
  waaromNiet,
  zetScherm,
  type Apparaat,
  type PaginaBron,
} from "./bron";

/** Eén gemeten feit, met de criteria waar het bewijs voor is. */
export type MetingWaarde = {
  /** Vaste sleutel, zodat een bevinding ernaar kan verwijzen. */
  sleutel: string;
  label: string;
  /** Het feit zelf, in gewone taal. Nooit een oordeel. */
  waarde: string;
  /** De voorbeelden eronder: welke velden, welke teksten, welke elementen. */
  detail?: string;
  /** De codes uit de kennisbank die met dit feit vast te stellen zijn. */
  criteria: string[];
};

export type RuweMeting = {
  formulier: { velden: number; zonderLabel: string[]; verplichtGemarkeerd: number; optioneelGemarkeerd: number; metAutomatischInvullen: number };
  contrast: { gekeken: number; teLaag: { tekst: string; ratio: number; voor: string; achter: string; grootte: number }[]; onbekend: number };
  typografie: { kleinste: number; gangbaar: number; tekensPerRegel: number };
  links: { totaal: number; vaag: string[] };
  zoom: { geblokkeerd: boolean; melding: string };
  breedte: { scherm: number; inhoud: number; uitstekend: string[] };
  tikdoelen: { totaal: number; teKlein: string[] };
  overlays: { cookiemelding: boolean; afdekkend: { wat: string; dekking: number }[] };
  beweging: { autoplayVideo: number; eindeloosBewegend: number };
  knoppen: { totaal: number; zonderVorm: string[] };
  beeld: { totaal: number; zonderAlt: number; grootZonderAlt: string[] };
  snelheid: { lcpMs: number; lcpElement: string; cls: number; ttfbMs: number; domKlaarMs: number };
};

/** Wat er uit één bezoek komt: de pagina, de cijfers en de foto's. */
export type Opname = {
  apparaat: Apparaat;
  bron: PaginaBron;
  ruw: RuweMeting;
  meting: MetingWaarde[];
  /** JPEG als base64, zonder `data:`-kop. Het eerste scherm, dus zonder scrollen. */
  eersteScherm: string;
  /** De hele pagina, tot een begrensde hoogte. Alleen als er om gevraagd is. */
  helePagina?: string;
  /** Hoe hoog de pagina in werkelijkheid is, om te zien of de foto is afgekapt. */
  paginaHoogte: number;
};

// Hoe ver de foto van de hele pagina mag reiken. Daarboven wordt een beeld zo
// smal uitgerekt dat er niets meer op te zien is, en het kost alleen maar tijd.
const MAX_FOTO_HOOGTE = 6000;

// ── De meetopdracht in de browser ──────────────────────────
// Dit draait ín de pagina van de klant, dus zonder onze eigen hulpfuncties. Het
// levert alleen feiten op; het benoemen ervan gebeurt hieronder in `naarWaarden`,
// buiten de browser, zodat die vertaling te controleren is met een proef.
function meetInPagina(): RuweMeting {
  const zichtbaar = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && st.visibility !== "hidden" && st.display !== "none" && Number(st.opacity || "1") > 0.05;
  };
  const kort = (t: string, n = 60): string => {
    const s = (t || "").replace(/\s+/g, " ").trim();
    return s.length > n ? `${s.slice(0, n)}…` : s;
  };
  const naam = (el: Element): string => {
    const k = (el.getAttribute("class") || "").split(" ").filter(Boolean)[0];
    return el.tagName.toLowerCase() + (k ? `.${k}` : "");
  };

  // ── Kleur en contrast ──
  type Kleur = { r: number; g: number; b: number; a: number };
  const kleurUit = (waarde: string): Kleur | null => {
    const m = (waarde || "").match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const d = m[1].split(",").map((x) => parseFloat(x));
    if (d.length < 3 || d.some((x) => Number.isNaN(x))) return null;
    return { r: d[0], g: d[1], b: d[2], a: d.length > 3 ? d[3] : 1 };
  };
  const opElkaar = (voor: Kleur, achter: Kleur): Kleur => ({
    r: voor.r * voor.a + achter.r * (1 - voor.a),
    g: voor.g * voor.a + achter.g * (1 - voor.a),
    b: voor.b * voor.a + achter.b * (1 - voor.a),
    a: 1,
  });
  const helderheid = (c: Kleur): number => {
    const f = (x: number) => {
      const v = x / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const verhouding = (a: Kleur, b: Kleur): number => {
    const l1 = helderheid(a);
    const l2 = helderheid(b);
    const hoog = Math.max(l1, l2);
    const laag = Math.min(l1, l2);
    return (hoog + 0.05) / (laag + 0.05);
  };
  // De achtergrond waar deze tekst werkelijk op ligt. Omhoog lopen tot er een
  // dekkende kleur is; komt er onderweg een afbeelding of een kleurverloop
  // langs, dan is het contrast niet te berekenen en zeggen we dat ook. Een
  // gegokt getal is hier erger dan geen getal.
  const achtergrondVan = (el: Element): Kleur | "onbekend" => {
    const lagen: Kleur[] = [];
    let n: Element | null = el;
    while (n) {
      const st = getComputedStyle(n);
      if (st.backgroundImage && st.backgroundImage !== "none") return "onbekend";
      const c = kleurUit(st.backgroundColor);
      if (c && c.a > 0.01) {
        lagen.push(c);
        if (c.a > 0.99) break;
      }
      n = n.parentElement;
    }
    let uit: Kleur = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = lagen.length - 1; i >= 0; i--) uit = opElkaar(lagen[i], uit);
    return uit;
  };

  const tekstElementen = Array.from(document.querySelectorAll("body *")).filter((el) => {
    if (!zichtbaar(el)) return false;
    return Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || "").trim().length > 2);
  });
  const teLaag: RuweMeting["contrast"]["teLaag"] = [];
  const gezien = new Set<string>();
  let onbekend = 0;
  for (const el of tekstElementen.slice(0, 400)) {
    const st = getComputedStyle(el);
    const voor = kleurUit(st.color);
    if (!voor) continue;
    const achter = achtergrondVan(el);
    if (achter === "onbekend") { onbekend++; continue; }
    const grootte = parseFloat(st.fontSize) || 16;
    const dik = Number(st.fontWeight) >= 700 || st.fontWeight === "bold";
    const groot = grootte >= 24 || (grootte >= 18.66 && dik);
    const eis = groot ? 3 : 4.5;
    const r = Math.round(verhouding(opElkaar(voor, achter), achter) * 10) / 10;
    if (r >= eis) continue;
    const merk = `${st.color}|${grootte}|${r}`;
    if (gezien.has(merk)) continue;
    gezien.add(merk);
    teLaag.push({ tekst: kort(el.textContent || ""), ratio: r, voor: st.color, achter: `rgb(${Math.round(achter.r)}, ${Math.round(achter.g)}, ${Math.round(achter.b)})`, grootte: Math.round(grootte) });
  }

  // ── Typografie: hoe klein is de tekst, en hoe lang is een regel ──
  const alineas = Array.from(document.querySelectorAll("p, li")).filter(zichtbaar);
  const groottes = alineas.map((el) => parseFloat(getComputedStyle(el).fontSize) || 16);
  const gesorteerd = [...groottes].sort((a, b) => a - b);
  const langste = alineas
    .map((el) => {
      const st = getComputedStyle(el);
      const regelhoogte = parseFloat(st.lineHeight) || (parseFloat(st.fontSize) || 16) * 1.4;
      const regels = Math.max(1, Math.round(el.getBoundingClientRect().height / regelhoogte));
      const tekens = (el.textContent || "").replace(/\s+/g, " ").trim().length;
      return regels > 1 ? Math.round(tekens / regels) : 0;
    })
    .filter((n) => n > 0)
    .sort((a, b) => b - a);

  // ── Formulier ──
  const velden = Array.from(document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea")).filter(zichtbaar);
  const zonderLabel: string[] = [];
  let metAutomatischInvullen = 0;
  for (const v of velden) {
    const id = v.getAttribute("id");
    const eigenLabel = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
    const omhullend = v.closest("label");
    const heeftLabel = !!(eigenLabel && zichtbaar(eigenLabel)) || !!(omhullend && zichtbaar(omhullend) && (omhullend.textContent || "").trim().length > 1);
    if (!heeftLabel) zonderLabel.push(kort(v.getAttribute("name") || v.getAttribute("placeholder") || v.getAttribute("aria-label") || naam(v), 40));
    const auto = (v.getAttribute("autocomplete") || "").trim().toLowerCase();
    if (auto && auto !== "off") metAutomatischInvullen++;
  }
  const formulierTekst = Array.from(document.querySelectorAll("form")).map((f) => f.textContent || "").join(" ").toLowerCase();
  const verplichtGemarkeerd = velden.filter((v) => v.hasAttribute("required") || v.getAttribute("aria-required") === "true").length
    + (/\*|verplicht/.test(formulierTekst) ? 0 : 0);
  const optioneelGemarkeerd = /optioneel|niet verplicht|\(optional\)/i.test(formulierTekst) ? 1 : 0;

  // ── Links met een tekst die niets zegt ──
  const vageTekst = /^(lees meer|meer|meer lezen|meer informatie|meer info|klik hier|hier|verder|lees verder|read more|click here|more|details)$/i;
  const alleLinks = Array.from(document.querySelectorAll("a[href]")).filter(zichtbaar);
  const vaag = Array.from(new Set(alleLinks.map((a) => (a.textContent || "").replace(/\s+/g, " ").trim()).filter((t) => vageTekst.test(t))));

  // ── Zoomen ──
  const viewport = (document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null)?.content || "";
  const maxSchaal = parseFloat((viewport.match(/maximum-scale\s*=\s*([\d.]+)/) || [])[1] || "0");
  const zoomUit = /user-scalable\s*=\s*(no|0)/i.test(viewport) || (maxSchaal > 0 && maxSchaal < 2);

  // ── Past de inhoud op het scherm ──
  const schermBreedte = document.documentElement.clientWidth;
  const uitstekend = Array.from(document.querySelectorAll("body *"))
    .filter((el) => {
      if (!zichtbaar(el)) return false;
      const r = el.getBoundingClientRect();
      return r.right > schermBreedte + 2 && r.width > 20 && r.width < schermBreedte * 3;
    })
    .slice(0, 5)
    .map((el) => naam(el));

  // ── Tikdoelen ──
  const bedienbaar = Array.from(document.querySelectorAll("a[href], button, input:not([type=hidden]), select, [role=button]")).filter(zichtbaar);
  const teKlein = bedienbaar
    .filter((el) => {
      const r = el.getBoundingClientRect();
      // Een link midden in een lopende zin telt niet mee: die hoort bij de tekst
      // en is in elke norm een uitzondering.
      if (el.tagName === "A" && el.closest("p, li")) return false;
      return Math.min(r.width, r.height) < 24;
    })
    .slice(0, 8)
    .map((el) => `${kort(el.textContent || naam(el), 30)} (${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)})`);

  // ── Wat de pagina bij binnenkomst afdekt ──
  const schermHoogte = document.documentElement.clientHeight;
  const afdekkend = Array.from(document.querySelectorAll("body *"))
    .filter((el) => {
      const st = getComputedStyle(el);
      if (st.position !== "fixed" && st.position !== "sticky") return false;
      if (!zichtbaar(el)) return false;
      const r = el.getBoundingClientRect();
      // Ook naar links en rechts kijken. Een mobiel menu staat dicht door het
      // buiten beeld te schuiven (translateX), maar het heeft dan nog steeds een
      // breedte en een hoogte. Zonder deze twee voorwaarden meldde de meting op
      // de homepage van een klant "een open menu over 22% van het scherm" terwijl
      // dat menu netjes dicht was, en dat is precies het soort bevinding dat een
      // heel oordeel onbetrouwbaar maakt.
      if (r.left >= schermBreedte || r.right <= 0) return false;
      const zichtbaarDeel = Math.max(0, Math.min(r.right, schermBreedte) - Math.max(r.left, 0))
        * Math.max(0, Math.min(r.bottom, schermHoogte) - Math.max(r.top, 0));
      return r.top < schermHoogte && r.bottom > 0 && zichtbaarDeel / (schermBreedte * schermHoogte) > 0.15;
    })
    .slice(0, 4)
    .map((el) => {
      const r = el.getBoundingClientRect();
      const deel = Math.max(0, Math.min(r.right, schermBreedte) - Math.max(r.left, 0))
        * Math.max(0, Math.min(r.bottom, schermHoogte) - Math.max(r.top, 0));
      return { wat: `${naam(el)}: ${kort(el.textContent || "", 40)}`, dekking: Math.round((deel / (schermBreedte * schermHoogte)) * 100) };
    });

  // ── Beweging ──
  const autoplayVideo = Array.from(document.querySelectorAll("video[autoplay]")).length;
  const eindeloosBewegend = Array.from(document.querySelectorAll("body *")).filter((el) => {
    const st = getComputedStyle(el);
    return st.animationName !== "none" && st.animationIterationCount === "infinite" && zichtbaar(el);
  }).length;

  // ── Knoppen die er niet als knop uitzien ──
  const knoppen = Array.from(document.querySelectorAll("button, [role=button], input[type=submit], a.btn, a.button")).filter(zichtbaar);
  const zonderVorm = knoppen
    .filter((el) => {
      const st = getComputedStyle(el);
      const vulling = kleurUit(st.backgroundColor);
      const randDik = parseFloat(st.borderTopWidth) || 0;
      return (!vulling || vulling.a < 0.05) && randDik < 1;
    })
    .slice(0, 6)
    .map((el) => kort(el.textContent || naam(el), 30));

  // ── Beeld ──
  const beelden = Array.from(document.querySelectorAll("img")).filter(zichtbaar);
  const zonderAlt = beelden.filter((i) => !(i.getAttribute("alt") || "").trim()).length;
  const grootZonderAlt = beelden
    .filter((i) => !(i.getAttribute("alt") || "").trim() && i.getBoundingClientRect().width > 200)
    .slice(0, 5)
    .map((i) => kort((i as HTMLImageElement).currentSrc || (i as HTMLImageElement).src || "", 60));

  // ── Snelheid, gemeten tijdens het laden ──
  const gemeten = (window as unknown as { __pl?: { lcp: number; lcpEl: string; cls: number } }).__pl || { lcp: 0, lcpEl: "", cls: 0 };
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;

  return {
    formulier: { velden: velden.length, zonderLabel, verplichtGemarkeerd, optioneelGemarkeerd, metAutomatischInvullen },
    contrast: { gekeken: Math.min(400, tekstElementen.length), teLaag, onbekend },
    typografie: {
      kleinste: Math.round(gesorteerd[0] || 0),
      gangbaar: Math.round(gesorteerd[Math.floor(gesorteerd.length / 2)] || 0),
      tekensPerRegel: langste[0] || 0,
    },
    links: { totaal: alleLinks.length, vaag },
    zoom: { geblokkeerd: zoomUit, melding: viewport },
    breedte: { scherm: schermBreedte, inhoud: Math.round(document.documentElement.scrollWidth), uitstekend },
    tikdoelen: { totaal: bedienbaar.length, teKlein },
    overlays: { cookiemelding: false, afdekkend },
    beweging: { autoplayVideo, eindeloosBewegend },
    knoppen: { totaal: knoppen.length, zonderVorm },
    beeld: { totaal: beelden.length, zonderAlt, grootZonderAlt },
    snelheid: {
      lcpMs: Math.round(gemeten.lcp || 0),
      lcpElement: gemeten.lcpEl || "",
      cls: Math.round((gemeten.cls || 0) * 1000) / 1000,
      ttfbMs: Math.round(nav?.responseStart || 0),
      domKlaarMs: Math.round(nav?.domContentLoadedEventEnd || 0),
    },
  };
}

/**
 * De ruwe cijfers omzetten naar benoemde feiten, met per feit de criteria waar
 * het bewijs voor is. Bewust buiten de browser en zonder DOM, zodat
 * `proeven/pagina-lab-oordeel.proef.ts` deze vertaling kan narekenen.
 */
export function naarWaarden(ruw: RuweMeting, apparaat: Apparaat): MetingWaarde[] {
  const uit: MetingWaarde[] = [];
  const zet = (sleutel: string, label: string, waarde: string, criteria: string[], detail?: string) =>
    uit.push({ sleutel, label, waarde, criteria, detail });

  // De formulierregels komen er ALTIJD, ook als er geen formulier is. Anders
  // heeft een pagina zonder formulier geen meting voor BRUIK-04, CONV-05 en
  // BRUIK-09, en dan komen die drie op "niet vast te stellen" te staan terwijl er
  // gewoon niets te vragen valt. "Geen formulier" is ook een meting.
  const geenFormulier = ruw.formulier.velden === 0;
  zet("formulier.velden", "Velden in het formulier", geenFormulier ? "geen formulier op deze pagina" : `${ruw.formulier.velden} in te vullen velden`, ["CONV-04"]);
  zet("formulier.labels", "Velden met een zichtbaar label",
    geenFormulier ? "geen formulier op deze pagina" : `${ruw.formulier.velden - ruw.formulier.zonderLabel.length} van de ${ruw.formulier.velden}`,
    ["BRUIK-04"], ruw.formulier.zonderLabel.length ? `Zonder zichtbaar label: ${ruw.formulier.zonderLabel.join(", ")}` : undefined);
  zet("formulier.verplicht", "Verplicht en optioneel gemarkeerd",
    geenFormulier ? "geen formulier op deze pagina" : `${ruw.formulier.verplichtGemarkeerd} veld(en) staan als verplicht in de code; ${ruw.formulier.optioneelGemarkeerd ? "het woord optioneel komt voor" : "het woord optioneel komt niet voor"}`,
    ["CONV-05"]);
  zet("formulier.automatisch", "Velden die de browser zelf kan invullen",
    geenFormulier ? "geen formulier op deze pagina" : `${ruw.formulier.metAutomatischInvullen} van de ${ruw.formulier.velden}`, ["BRUIK-09"]);

  const contrastDetail = ruw.contrast.teLaag
    .slice(0, 6)
    .map((c) => `"${c.tekst}" ${c.ratio}:1 (${c.voor} op ${c.achter}, ${c.grootte}px)`)
    .join("; ");
  zet("contrast.telaag", "Tekst met te weinig contrast",
    ruw.contrast.teLaag.length ? `${ruw.contrast.teLaag.length} soorten tekst onder de norm` : "niets gevonden onder de norm",
    ["BRUIK-01"],
    [contrastDetail, ruw.contrast.onbekend ? `Bij ${ruw.contrast.onbekend} stukken tekst ligt een afbeelding of kleurverloop eronder; daar is het contrast niet te berekenen en is de foto nodig.` : ""].filter(Boolean).join(" "));

  zet("tekst.grootte", "Tekstgrootte in lopende tekst",
    ruw.typografie.gangbaar ? `gangbaar ${ruw.typografie.gangbaar}px, kleinste ${ruw.typografie.kleinste}px` : "geen lopende tekst gevonden", ["BRUIK-02"]);
  zet("tekst.regellengte", "Langste regel in tekens",
    ruw.typografie.tekensPerRegel ? `ongeveer ${ruw.typografie.tekensPerRegel} tekens per regel` : "niet vast te stellen", ["BRUIK-02"]);

  zet("links.vaag", "Links die zelf niet zeggen waar ze heen gaan",
    ruw.links.vaag.length ? `${ruw.links.vaag.length} verschillende: ${ruw.links.vaag.slice(0, 6).join(", ")}` : `geen, van ${ruw.links.totaal} links`, ["BRUIK-08"]);

  zet("zoom.geblokkeerd", "Kan de bezoeker inzoomen",
    ruw.zoom.geblokkeerd ? "nee, de pagina blokkeert zoomen" : "ja", ["BRUIK-07"], ruw.zoom.melding ? `viewport: ${ruw.zoom.melding}` : undefined);

  const teBreed = ruw.breedte.inhoud > ruw.breedte.scherm + 2;
  zet("breedte.past", "Past de inhoud op het scherm",
    teBreed ? `nee, de inhoud is ${ruw.breedte.inhoud}px bij een scherm van ${ruw.breedte.scherm}px` : `ja, op ${ruw.breedte.scherm}px breed`,
    ["BRUIK-06"], ruw.breedte.uitstekend.length ? `Steekt uit: ${ruw.breedte.uitstekend.join(", ")}` : undefined);

  zet("tikdoelen.klein", "Knoppen en links die kleiner zijn dan 24 pixels",
    ruw.tikdoelen.teKlein.length ? `${ruw.tikdoelen.teKlein.length} van de ${ruw.tikdoelen.totaal}` : `geen, van ${ruw.tikdoelen.totaal}`,
    ["INT-04"], ruw.tikdoelen.teKlein.join("; "));

  zet("overlay.binnenkomst", "Wat er bij binnenkomst over de pagina heen ligt",
    ruw.overlays.cookiemelding ? "een cookiemelding, die wij hebben weggeklikt vóór het meten" : (ruw.overlays.afdekkend.length ? `${ruw.overlays.afdekkend.length} vast blok over de inhoud` : "niets"),
    ["INT-05", "VAK-06"],
    ruw.overlays.afdekkend.map((a) => `${a.wat} (${a.dekking}% van het scherm)`).join("; "));

  zet("beweging.eindeloos", "Beweging die vanzelf blijft doorgaan",
    `${ruw.beweging.eindeloosBewegend} eindeloos bewegende elementen, ${ruw.beweging.autoplayVideo} vanzelf startende video's`, ["INT-07"]);

  zet("knoppen.vorm", "Knoppen zonder eigen vorm (geen vulling, geen rand)",
    ruw.knoppen.zonderVorm.length ? `${ruw.knoppen.zonderVorm.length} van de ${ruw.knoppen.totaal}` : `geen, van ${ruw.knoppen.totaal}`,
    ["VORM-05"], ruw.knoppen.zonderVorm.join("; "));

  zet("beeld.alt", "Afbeeldingen zonder alt-tekst",
    `${ruw.beeld.zonderAlt} van de ${ruw.beeld.totaal}`, ["VORM-06"],
    [ruw.beeld.grootZonderAlt.join("; "), "Staat er belangrijke tekst ín zo'n afbeelding, dan is die zonder alt-tekst voor niemand te lezen. Óf er tekst in staat, moet van de foto komen; dat is niet te meten."].filter(Boolean).join(" "));

  // De snelheidsregels zeggen er zelf bij wat ze niet zijn. Zonder die zin gaat
  // een labmeting binnen een week als veldmeting rond in een klantgesprek.
  const labZin = `Gemeten in onze eigen browser op een server (${apparaat}), niet bij echte bezoekers. Google kijkt naar veldcijfers en die vallen vrijwel altijd trager uit.`;
  zet("snelheid.lcp", "Grootste element in beeld (LCP)",
    ruw.snelheid.lcpMs ? `${(ruw.snelheid.lcpMs / 1000).toFixed(1)} seconde` : "niet gemeten", ["INT-01", "CONV-07"],
    `${ruw.snelheid.lcpElement ? `Het gaat om ${ruw.snelheid.lcpElement}. ` : ""}${labZin}`);
  zet("snelheid.cls", "Verspringen van de opbouw (CLS)",
    `${ruw.snelheid.cls}`, ["INT-03"], labZin);
  zet("snelheid.server", "Eerste antwoord van de server",
    ruw.snelheid.ttfbMs ? `${Math.round(ruw.snelheid.ttfbMs)} ms, pagina-opbouw klaar na ${Math.round(ruw.snelheid.domKlaarMs)} ms` : "niet gemeten",
    ["INT-01", "CONV-07"], labZin);

  return uit;
}

/** De metingen die bij één criterium horen. */
export function metingenVoor(waarden: MetingWaarde[], criterium: string): MetingWaarde[] {
  return waarden.filter((w) => w.criteria.includes(criterium));
}

/** De meting als tekst voor de beoordeling. Elke regel begint met zijn sleutel. */
export function metingAlsTekst(waarden: MetingWaarde[]): string {
  return waarden
    .map((w) => `- [${w.sleutel}] ${w.label}: ${w.waarde}${w.detail ? ` — ${w.detail}` : ""} (criteria: ${w.criteria.join(", ")})`)
    .join("\n");
}

/**
 * Eén bezoek aan de pagina: lezen, meten en fotograferen, in die volgorde.
 * Geeft null terug als de browser op deze server niet kan starten.
 */
export async function neemPaginaOp(url: string, apparaat: Apparaat = "desktop", metHelePagina = false): Promise<Opname | null> {
  const scherm = APPARATEN[apparaat];
  return await metBrowser(async (page) => {
    await zetScherm(page, apparaat);
    // De snelheidsmeters moeten er staan vóórdat de pagina begint te laden; daarna
    // is het grootste element allang getekend en valt er niets meer te zien.
    await page.evaluateOnNewDocument(() => {
      const w = window as unknown as { __pl: { lcp: number; lcpEl: string; cls: number } };
      w.__pl = { lcp: 0, lcpEl: "", cls: 0 };
      try {
        new PerformanceObserver((lijst) => {
          for (const e of lijst.getEntries() as (PerformanceEntry & { element?: Element })[]) {
            w.__pl.lcp = e.startTime;
            const el = e.element;
            w.__pl.lcpEl = el ? el.tagName.toLowerCase() + (String(el.className || "").split(" ")[0] ? `.${String(el.className).split(" ")[0]}` : "") : "";
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((lijst) => {
          for (const e of lijst.getEntries() as (PerformanceEntry & { value?: number; hadRecentInput?: boolean })[]) {
            if (!e.hadRecentInput) w.__pl.cls += e.value || 0;
          }
        }).observe({ type: "layout-shift", buffered: true });
      } catch { /* een browser zonder deze meters: dan blijft het op nul staan */ }
    });

    const resp = await gaNaar(page, url);
    await new Promise((r) => setTimeout(r, 900));
    const eindUrl: string = page.url();
    const fout = await waaromNiet(eindUrl);
    if (fout) throw new Error("De pagina stuurde door naar een adres dat niet opgehaald mag worden.");

    // Eerst kijken wat er over de pagina heen ligt, dán pas wegklikken: dat is
    // zelf een bevinding (VAK-06). Daarna meteen de snelheidscijfers ophalen,
    // vóór het scrollen, want ons eigen scrollen laat beelden nabezorgen en dat
    // zou het verspringen (CLS) hoger maken dan een bezoeker ooit meemaakt.
    const cookiemelding = await klikCookieWeg(page);
    const snelheid = await page.evaluate(() => (window as unknown as { __pl: { lcp: number; lcpEl: string; cls: number } }).__pl);

    // Helemaal naar beneden en terug, zodat alles wat pas bij het scrollen
    // inlaadt er ook echt staat. Zonder dit meet je lege vlakken.
    await page.evaluate(async () => {
      const stap = window.innerHeight;
      const eind = document.body ? document.body.scrollHeight : 0;
      const stappen = Math.min(30, Math.ceil(eind / Math.max(1, stap)));
      for (let i = 0; i < stappen; i++) {
        window.scrollTo(0, i * stap);
        await new Promise((r) => setTimeout(r, 90));
      }
      window.scrollTo(0, 0);
    });
    await new Promise((r) => setTimeout(r, 600));

    const gelezen = await leesDocument(page);
    const ruw: RuweMeting = await page.evaluate(meetInPagina);
    ruw.snelheid.lcpMs = Math.round(snelheid?.lcp || ruw.snelheid.lcpMs);
    ruw.snelheid.lcpElement = snelheid?.lcpEl || ruw.snelheid.lcpElement;
    ruw.snelheid.cls = Math.round((snelheid?.cls || 0) * 1000) / 1000;
    ruw.overlays.cookiemelding = cookiemelding;

    // Let op: puppeteer geeft hier een Uint8Array terug, geen Buffer. Rechtstreeks
    // .toString("base64") erop levert een rij komma's met getallen op, en dan
    // weigert de API het beeld met "invalid base64 data". Vandaar Buffer.from.
    const eersteScherm = Buffer.from(await page.screenshot({ type: "jpeg", quality: 80 }));
    let helePagina: Buffer | null = null;
    if (metHelePagina) {
      const hoog = Math.min(MAX_FOTO_HOOGTE, Math.max(scherm.hoogte, gelezen.hoogte || scherm.hoogte));
      helePagina = Buffer.from(await page.screenshot({
        type: "jpeg", quality: 62, captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: scherm.breedte, height: hoog },
      }));
    }

    const bron: PaginaBron = {
      url,
      eindUrl,
      status: resp ? resp.status() : null,
      ...gelezen,
      woorden: gelezen.tekst.split(/\s+/).filter(Boolean).length,
    };
    return {
      apparaat,
      bron,
      ruw,
      meting: naarWaarden(ruw, apparaat),
      eersteScherm: eersteScherm.toString("base64"),
      helePagina: helePagina ? helePagina.toString("base64") : undefined,
      paginaHoogte: gelezen.hoogte || 0,
    } as Opname;
  });
}
