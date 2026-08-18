// ═══════════════════════════════════════════════════════════
// DE PROEFSTIJL: EEN ONTWERP UITPROBEREN OVER HET HELE DASHBOARD
// ═══════════════════════════════════════════════════════════
// De speelruimte op /admin/stijl liet je aan het ontwerp draaien, maar alleen
// op dát scherm. Maartens vraag op 18-08-2026 was precies de goede: "als ik daar
// iets kies, waar zie ik dan hoe dat uitpakt?" Het antwoord was toen: nergens.
// En dat is het slechtst denkbare antwoord, want een ontwerp beoordeel je op de
// schermen waar je de hele dag zit, niet op de instellingenpagina.
//
// Daarom staat de gekozen stand nu in de browser opgeslagen en wordt hij op élk
// beheerscherm toegepast, met een balkje bovenin dat zegt dat je naar een proef
// kijkt. Je kiest op de stijlpagina, je loopt naar je takenpagina, je klantkaart
// en je agenda, en je ziet het daar echt.
//
// WAAROM DIT IN ÉÉN BESTAND STAAT
// ───────────────────────────────
// Twee plekken passen dezelfde stand toe: de speelruimte (terwijl je draait) en
// de schil om alle beheerschermen (op elke andere pagina). Diezelfde stand op
// twee plekken uitschrijven is precies de fout die in dit project al zeven keer
// is opgeschreven. Eén bestand, allebei lezen eruit.
//
// EEN PROEF IS NOG GEEN KEUZE
// ───────────────────────────
// De proefstand leeft in jouw browser, niet in de database, en een klant of een
// collega ziet er niets van. Bevalt een richting, dan leg je hem vast met de
// knop in de speelruimte; dán geldt hij voor iedereen (lib/huisstijl.ts). Dat
// onderscheid is met opzet: anders zou het dashboard er voor jou anders uitzien
// dan voor de volgende die inlogt, zonder dat iemand dat besloten heeft.
// ═══════════════════════════════════════════════════════════

import BASISMATEN from "./stijl-basis.json";

export type Thema = {
  accent: string;
  letter: string;
  /** Vermenigvuldiger op de ruimte-schaal: 0,8 is compact, 1,25 is ruim. */
  ruimte: number;
  /** Vermenigvuldiger op de tekst-schaal. */
  tekst: number;
  /** De drie rondingen, van klein naar kaart. */
  ronding: [number, number, number];
  /** Hoe diep de schaduwen zijn; 0 is vlak. */
  diepte: number;
  /** De naam van de richting, voor het balkje bovenin. */
  naam: string;
};

export const BASIS: Thema = {
  naam: "Zoals het nu is",
  accent: "#E7773F",
  letter: "'Montserrat', sans-serif",
  ruimte: 1,
  tekst: 1,
  ronding: [6, 10, 14],
  diepte: 1,
};

/**
 * Vier afgemaakte richtingen binnen de Pingwin-huisstijl.
 *
 * Bewust hele werelden en geen losse knopjes: kiezen tussen "zacht en luchtig"
 * en "strak en zakelijk" kan iedereen, kiezen tussen 10 en 12 pixels ronding
 * niemand. De losse knoppen zijn om bij te sturen ná die keuze.
 */
export const RICHTINGEN: { wat: string; thema: Thema }[] = [
  { wat: "De huidige stand, om tegen af te zetten.", thema: BASIS },
  {
    wat: "Minder ronding, vlakkere schaduw, compacter. Meer op het scherm, zakelijker toon.",
    thema: { ...BASIS, naam: "Strak en zakelijk", ruimte: 0.85, tekst: 0.95, ronding: [4, 6, 8], diepte: 0.4 },
  },
  {
    wat: "Rondere hoeken, meer lucht, iets grotere tekst. Rustiger om lang naar te kijken.",
    thema: { ...BASIS, naam: "Zacht en luchtig", ruimte: 1.25, tekst: 1.05, ronding: [10, 16, 22], diepte: 1.4 },
  },
  {
    wat: "Vlak, compact en gedempt. Voor schermen die vooral tabellen en cijfers zijn.",
    thema: { ...BASIS, naam: "Rustig en datadicht", accent: "#C9622F", ruimte: 0.8, tekst: 0.95, ronding: [3, 5, 7], diepte: 0 },
  },
];

export const LETTERTYPES: { naam: string; waarde: string }[] = [
  { naam: "Montserrat (huisstijl)", waarde: "'Montserrat', sans-serif" },
  { naam: "Systeem", waarde: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { naam: "Schreefloos klassiek", waarde: "Helvetica, Arial, sans-serif" },
  { naam: "Met schreef", waarde: "Georgia, 'Times New Roman', serif" },
];

export const OPSLAGSLEUTEL = "pingwin-proefstijl";
/** Zodat de speelruimte en het balkje bovenin elkaar meteen zien. */
export const WIJZIG_EVENT = "pingwin-proefstijl-gewijzigd";

/** De tokens die deze proefstijl overschrijft. Alles hierbuiten blijft staan. */
const GESTUURD = [
  "--letter", "--orange", "--accent", "--orange-dark", "--orange-light", "--brand-orange-faint",
  "--r-sm", "--r-md", "--r-lg", "--shadow-sm", "--shadow-md", "--shadow-lg",
  "--s-1", "--s-2", "--s-3", "--s-4", "--s-5", "--s-6", "--s-8", "--s-10", "--s-12",
  "--fs-xs", "--fs-sm", "--fs-base", "--fs-md", "--fs-lg", "--fs-xl",
  "--lh-xs", "--lh-sm", "--lh-base", "--lh-md", "--lh-lg", "--lh-xl",
];

function rgb(hex: string): [number, number, number] {
  const k = hex.replace("#", "");
  const zes = k.length === 3 ? k.split("").map((c) => c + c).join("") : k;
  return [parseInt(zes.slice(0, 2), 16), parseInt(zes.slice(2, 4), 16), parseInt(zes.slice(4, 6), 16)];
}
const naarHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");
const donkerder = (hex: string, deel: number) => {
  const [r, g, b] = rgb(hex);
  return naarHex(r * (1 - deel), g * (1 - deel), b * (1 - deel));
};
const lichter = (hex: string, deel: number) => {
  const [r, g, b] = rgb(hex);
  return naarHex(r + (255 - r) * deel, g + (255 - g) * deel, b + (255 - b) * deel);
};

/** Haal de proefstijl weg; het scherm staat daarna weer zoals het hoort. */
export function wisProefstijl() {
  if (typeof document === "undefined") return;
  for (const naam of GESTUURD) document.documentElement.style.removeProperty(naam);
}

/**
 * De som, één keer, zonder scherm eromheen: welke tokens krijgen welke waarde?
 *
 * Twee plekken hebben dezelfde uitkomst nodig en ze kunnen niet allebei dezelfde
 * weg lopen. In de browser worden de uitgangsmaten uit het scherm zélf gelezen
 * (getComputedStyle), zodat je nooit met andere waarden speelt dan er in de
 * opmaak staan. Op de server, voor een vastgelegde stijl, bestaat er nog geen
 * scherm; die geeft de maten uit lib/stijl-basis.json mee. Alleen de herkomst
 * van die getallen verschilt dus, de som staat hier en nergens anders.
 */
export function themaTokens(thema: Thema, basis: (naam: string) => number): Record<string, string> {
  const uit: Record<string, string> = {
    "--letter": thema.letter,
    "--orange": thema.accent,
    "--accent": thema.accent,
    "--orange-dark": donkerder(thema.accent, 0.18),
    "--orange-light": lichter(thema.accent, 0.9),
    "--brand-orange-faint": lichter(thema.accent, 0.96),
  };

  for (const naam of GESTUURD.filter((n) => n.startsWith("--s-"))) {
    const p = basis(naam);
    if (p > 0) uit[naam] = `${Math.round(p * thema.ruimte)}px`;
  }
  for (const naam of GESTUURD.filter((n) => n.startsWith("--fs-"))) {
    uit[naam] = `${Math.round(basis(naam) * thema.tekst * 2) / 2}px`;
  }
  for (const naam of GESTUURD.filter((n) => n.startsWith("--lh-"))) {
    uit[naam] = `${Math.round(basis(naam) * thema.tekst)}px`;
  }

  const [klein, knop, kaart] = thema.ronding;
  uit["--r-sm"] = `${klein}px`;
  uit["--r-md"] = `${knop}px`;
  uit["--r-lg"] = `${kaart}px`;

  const d = thema.diepte;
  uit["--shadow-sm"] = d === 0 ? "none" : `0 1px ${3 * d}px rgba(51, 48, 46, ${0.06 * d})`;
  uit["--shadow-md"] = d === 0 ? "none"
    : `0 ${4 * d}px ${16 * d}px rgba(51, 48, 46, ${0.07 * d}), 0 1px 3px rgba(51, 48, 46, ${0.05 * d})`;
  uit["--shadow-lg"] = d === 0 ? "none"
    : `0 ${8 * d}px ${24 * d}px rgba(51, 48, 46, ${0.1 * d}), 0 2px 6px rgba(51, 48, 46, ${0.06 * d})`;

  return uit;
}

/**
 * Pas een stand toe op het hele document.
 *
 * Eerst wordt alles wat deze functie stuurt weggehaald: anders lees je de vorige
 * proefstand terug als uitgangsmaat en stapelt hij op zichzelf. Een inline waarde
 * op het document wint het van de opmaak, dus een proefstijl gaat ook over een
 * vastgelegde stijl heen; dat is de bedoeling, je wilt kunnen proberen zonder
 * eerst iets te moeten losmaken.
 */
export function pasProefstijlToe(thema: Thema) {
  if (typeof document === "undefined") return;
  const r = document.documentElement;
  wisProefstijl();

  const gemeten = getComputedStyle(r);
  const tokens = themaTokens(thema, (naam) => parseFloat(gemeten.getPropertyValue(naam)) || 0);
  for (const [naam, waarde] of Object.entries(tokens)) r.style.setProperty(naam, waarde);
}

/**
 * Dezelfde stand als een blok opmaak, voor in de kop van de pagina.
 *
 * Gebruikt door de vastgelegde huisstijl: die moet er staan vóór het eerste
 * beeld, anders zie je een tel lang de oude stijl en daarna de nieuwe.
 */
export function themaNaarCss(thema: Thema): string {
  const maten = BASISMATEN as Record<string, number>;
  const tokens = themaTokens(thema, (naam) => maten[naam] ?? 0);
  const regels = Object.entries(tokens).map(([naam, waarde]) => `${naam}:${waarde}`).join(";");
  // Twee keer :root, met opzet. De opmaak zet dezelfde tokens ook op :root, en
  // welke van de twee wint hangt anders af van de volgorde waarin het framework
  // de opmaak in de kop zet. Dat is niets om op te gokken. Een handmatige stand
  // in de browser (de proefstijl) wint hier nog steeds van, want die staat op het
  // element zelf.
  return `:root:root{${regels}}`;
}

/** De opgeslagen stand, of null als er geen proef loopt. */
export function leesProefstijl(): Thema | null {
  if (typeof window === "undefined") return null;
  try {
    const rauw = window.localStorage.getItem(OPSLAGSLEUTEL);
    if (!rauw) return null;
    const t = JSON.parse(rauw) as Thema;
    return typeof t?.accent === "string" && Array.isArray(t?.ronding) ? t : null;
  } catch {
    return null;
  }
}

/** Bewaar een stand (of null om de proef te beëindigen) en laat het weten. */
export function bewaarProefstijl(thema: Thema | null) {
  if (typeof window === "undefined") return;
  try {
    if (thema) window.localStorage.setItem(OPSLAGSLEUTEL, JSON.stringify(thema));
    else window.localStorage.removeItem(OPSLAGSLEUTEL);
  } catch {
    // Privémodus of volle opslag: dan werkt de proef alleen op deze pagina.
    // Geen melding; dit is een hulpmiddel, geen functie waar werk op leunt.
  }
  window.dispatchEvent(new CustomEvent(WIJZIG_EVENT));
}

/** Is dit dezelfde stand? Gebruikt om te zien welke richting aanstaat. */
export const zelfdeThema = (a: Thema, b: Thema) =>
  a.accent === b.accent && a.letter === b.letter && a.ruimte === b.ruimte
  && a.tekst === b.tekst && a.diepte === b.diepte
  && a.ronding.join() === b.ronding.join();
