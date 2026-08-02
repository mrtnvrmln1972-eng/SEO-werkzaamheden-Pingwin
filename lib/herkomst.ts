// ═══════════════════════════════════════════════════════════
// PERSOONSNAMEN IN KAARTTEKST
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat: in een kaart van Paul Hoevenaars stond "copy is op 5 juli
// meegestuurd aan Sander Coppens". Sander werkt niet voor die klant. Hij zat wel
// in de mailset, omdat een tariefgesprek met zijn bureau toevallig de naam van de
// klant noemde, en de assistent maakte daar een conclusie van. Die conclusie is
// daarna als platte tekst in de kaart blijven staan en werd sindsdien overal
// herhaald, ook in mails naar buiten.
//
// De oplossing zit hier, in de weergave-laag: een zin die een document aan een
// persoon toeschrijft, verliest die persoon, tenzij die persoon aantoonbaar bij
// deze klant hoort. Omdat het in de weergave zit, schoont het ook alle kaarten op
// die er al staan, bij elke klant. Zie de vaste regel "met terugwerkende kracht"
// in CLAUDE.md.
//
// Wat blijft staan: het feit zelf ("Copy-document klaar op 2-7-2026 (mail 5-7)").
// Alleen de persoon verdwijnt. We gooien dus nooit informatie weg die klopt.
// ═══════════════════════════════════════════════════════════

// Een persoonsnaam: één of twee hoofdletterwoorden, eventueel met tussenvoegsel.
const NAAM = "[A-Z][a-zà-ÿ'’-]+(?:\\s+(?:van|de|den|der|het|te|ten|ter|op|aan)\\s+)?(?:\\s[A-Z][a-zà-ÿ'’-]+){0,2}";

// "meegestuurd aan X", "gestuurd naar X", "opgeleverd aan X", "gedeeld met X".
const TOESCHRIJVING = new RegExp(
  `\\s*(?:,\\s*)?\\b(?:mee)?(?:gestuurd|gedeeld|opgeleverd|verstuurd|aangeleverd|doorgestuurd|toegestuurd)\\s+(?:aan|naar|met|richting)\\s+(${NAAM})`,
  "g",
);
// "aan X gestuurd", andersom.
const TOESCHRIJVING_OMGEKEERD = new RegExp(
  `\\s*(?:,\\s*)?\\b(?:aan|naar)\\s+(${NAAM})\\s+(?:mee)?(?:gestuurd|gedeeld|opgeleverd|verstuurd|aangeleverd|doorgestuurd|toegestuurd)`,
  "g",
);

// "(mail van 5-7 naar X)" en "bericht aan X": een verwijzing naar post, zonder
// werkwoord. Dit is de vorm waarin het in de praktijk in de kaarten stond.
const POST_NAAR = new RegExp(
  `((?:mail|e-?mail|bericht|berichtje)\\b[^,;)\\n]{0,24}?)\\s+(?:aan|naar)\\s+(${NAAM})`,
  "g",
);

/** Namen die altijd mogen: onszelf, en de klant zelf. */
function altijdGoed(extra: (string | null | undefined)[]): Set<string> {
  const uit = new Set(["maarten", "pingwin", "google", "claude"]);
  for (const e of extra) for (const w of String(e || "").toLowerCase().split(/\s+/)) if (w.length > 2) uit.add(w);
  return uit;
}

export type HerkomstContext = {
  /** Namen en adressen die echt in de mailset van deze klant voorkomen. */
  bekend?: (string | null | undefined)[];
  /** Naam van de klant en van de sitebouwer van deze klant. */
  eigen?: (string | null | undefined)[];
};

function isBekend(naam: string, ctx: HerkomstContext): boolean {
  const goed = altijdGoed(ctx.eigen || []);
  const delen = naam.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (delen.some((d) => goed.has(d))) return true;
  const bron = (ctx.bekend || []).map((b) => String(b || "").toLowerCase()).join(" | ");
  if (!bron) return false;
  // De volledige naam moet erin staan, niet alleen een losse voornaam: anders
  // glipt "Sander" alsnog binnen via een willekeurige andere Sander.
  return bron.includes(naam.toLowerCase());
}

/**
 * Haalt uit een regel de toeschrijving aan een persoon weg als die persoon niet
 * bij deze klant hoort. Het feit blijft staan, alleen de persoon verdwijnt.
 */
export function striptToeschrijving(regel: string, ctx: HerkomstContext = {}): string {
  let uit = String(regel || "");
  for (const re of [TOESCHRIJVING, TOESCHRIJVING_OMGEKEERD]) {
    uit = uit.replace(re, (hele, naam: string) => (isBekend(naam, ctx) ? hele : ""));
  }
  uit = uit.replace(POST_NAAR, (hele, kop: string, naam: string) => (isBekend(naam, ctx) ? hele : kop));
  // Restjes opruimen: dubbele spaties, een losse komma vlak voor een haakje of punt.
  return uit.replace(/\s{2,}/g, " ").replace(/\s+([,.;)])/g, "$1").replace(/\(\s*\)/g, "").trim();
}

/** Hetzelfde, maar over een hele tekst met regels. */
export function striptToeschrijvingen(tekst: string, ctx: HerkomstContext = {}): string {
  return String(tekst || "").split("\n").map((r) => striptToeschrijving(r, ctx)).join("\n");
}
