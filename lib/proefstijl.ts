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
// WAT DIT BEWUST NIET IS
// ──────────────────────
// Geen instelling die je aanzet en vergeet. Hij leeft in jouw browser, niet in
// de database, en een klant of een collega ziet er niets van. Bevalt een
// richting, dan gaat hij via de code echt live, voor iedereen. Anders zou het
// dashboard er voor jou anders uitzien dan voor de volgende die inlogt, en dat
// is precies het probleem dat we net hebben opgelost.
// ═══════════════════════════════════════════════════════════

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
 * Pas een stand toe op het hele document.
 *
 * De uitgangsmaten worden uit het scherm zélf gelezen (getComputedStyle), niet
 * uit een kopie in dit bestand. Anders speel je met andere waarden dan er in de
 * opmaak staan zodra iemand een token wijzigt. Daarom wordt eerst alles wat
 * deze functie stuurt weggehaald: anders lees je de vorige proefstand terug en
 * stapelt hij op zichzelf.
 */
export function pasProefstijlToe(thema: Thema) {
  if (typeof document === "undefined") return;
  const r = document.documentElement;
  wisProefstijl();

  const basis = getComputedStyle(r);
  const px = (naam: string) => parseFloat(basis.getPropertyValue(naam)) || 0;

  r.style.setProperty("--letter", thema.letter);
  for (const naam of ["--orange", "--accent"]) r.style.setProperty(naam, thema.accent);
  r.style.setProperty("--orange-dark", donkerder(thema.accent, 0.18));
  r.style.setProperty("--orange-light", lichter(thema.accent, 0.9));
  r.style.setProperty("--brand-orange-faint", lichter(thema.accent, 0.96));

  for (const naam of GESTUURD.filter((n) => n.startsWith("--s-"))) {
    const p = px(naam);
    if (p > 0) r.style.setProperty(naam, `${Math.round(p * thema.ruimte)}px`);
  }
  for (const naam of GESTUURD.filter((n) => n.startsWith("--fs-"))) {
    r.style.setProperty(naam, `${Math.round(px(naam) * thema.tekst * 2) / 2}px`);
  }
  for (const naam of GESTUURD.filter((n) => n.startsWith("--lh-"))) {
    r.style.setProperty(naam, `${Math.round(px(naam) * thema.tekst)}px`);
  }

  const [klein, knop, kaart] = thema.ronding;
  r.style.setProperty("--r-sm", `${klein}px`);
  r.style.setProperty("--r-md", `${knop}px`);
  r.style.setProperty("--r-lg", `${kaart}px`);

  const d = thema.diepte;
  r.style.setProperty("--shadow-sm", d === 0 ? "none" : `0 1px ${3 * d}px rgba(51, 48, 46, ${0.06 * d})`);
  r.style.setProperty("--shadow-md", d === 0 ? "none"
    : `0 ${4 * d}px ${16 * d}px rgba(51, 48, 46, ${0.07 * d}), 0 1px 3px rgba(51, 48, 46, ${0.05 * d})`);
  r.style.setProperty("--shadow-lg", d === 0 ? "none"
    : `0 ${8 * d}px ${24 * d}px rgba(51, 48, 46, ${0.1 * d}), 0 2px 6px rgba(51, 48, 46, ${0.06 * d})`);
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
