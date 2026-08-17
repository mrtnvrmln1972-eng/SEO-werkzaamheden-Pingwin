// Proef op de indeling van het mega menu.
//
// WAAROM DIT BESTAAT
// ══════════════════
// De navigatie van de klantcockpit is niet langer "waar was nog ruimte" maar een
// regel: elk scherm staat bij de VRAAG die het beantwoordt. Zonder die regel
// belandde het klantprofiel boven een lijst van 65 URL's, terwijl de tab
// Klantgegevens in zijn eigen omschrijving beloofde dat het daar stond.
//
// Een indeling die alleen in een document leeft, glijdt weg zodra iemand een
// scherm toevoegt en het "even ergens" neerzet. Deze proef maakt daar een poort
// van: komt er een tabblad bij dat in geen enkele groep staat, dan is het uit
// het menu verdwenen en dus onbereikbaar, en mislukt de bouw.
//
// Draait bij élke bouw (`prebuild`), dus ook op Vercel.

import fs from "fs";
import path from "path";

let fouten = 0;
function check(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

const WORTEL = path.join(__dirname, "..");
const bron = fs.readFileSync(path.join(WORTEL, "app/admin/client/[slug]/KlantTabs.tsx"), "utf8");

// Alle tabbladen die bestaan, uit het type Tab.
const typeBlok = bron.slice(bron.indexOf("export type Tab ="), bron.indexOf("export type TabItem"));
const alleTabs = [...typeBlok.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
check("de tabbladen zijn gevonden", alleTabs.length > 10, `gevonden: ${alleTabs.length}`);

// Alle tabbladen die in een groep van het mega menu staan.
const megaBlok = bron.slice(bron.indexOf("export const MEGA_GROEPEN"));
const inMenu = [...megaBlok.matchAll(/tab\("([a-z-]+)"\)/g)].map((m) => m[1]);

// "lead" en "developer" horen bewust NIET in het menu: de leadwerkplek is een
// eigen scherm met een eigen balk, en Developer gaat over álle klanten en staat
// daarom los in de balk. Alle andere tabbladen moeten erin staan.
const BUITEN_MENU = new Set(["lead", "developer"]);

const vergeten = alleTabs.filter((t) => !BUITEN_MENU.has(t) && !inMenu.includes(t));
check("elk tabblad staat in het mega menu", vergeten.length === 0,
  `Niet in een groep: ${vergeten.join(", ")}. Zonder groep is het scherm onbereikbaar geworden; zet het bij de vraag die het beantwoordt.`);

const dubbel = inMenu.filter((t, i) => inMenu.indexOf(t) !== i);
check("geen tabblad staat in twee groepen", dubbel.length === 0,
  `Dubbel: ${dubbel.join(", ")}. Eén scherm beantwoordt één vraag; twee plekken maakt de indeling weer willekeurig.`);

const onbekend = inMenu.filter((t) => !alleTabs.includes(t));
check("het menu verwijst niet naar een tabblad dat niet bestaat", onbekend.length === 0, onbekend.join(", "));

// De groepen zijn vragen, geen categorienamen. Dat is het hele idee: je leest in
// het menu waaróm een scherm daar staat.
const vragen = [...megaBlok.matchAll(/vraag:\s*"([^"]+)"/g)].map((m) => m[1]);
check("er zijn vijf groepen", vragen.length === 5, `gevonden: ${vragen.length} (${vragen.join(" | ")})`);
const geenVraag = vragen.filter((v) => !/^(wat|wie|hoe|waar|waarom)\b/i.test(v));
check("elke groep is een vraag in gewone taal", geenVraag.length === 0,
  `Deze lezen niet als vraag: ${geenVraag.join(", ")}. Een categorienaam zegt niet waaróm een scherm daar staat.`);

// De menu-onderdelen komen uit dezelfde lijsten als de balk, dus een label kan
// nooit op twee plekken iets anders zeggen.
check("het menu leest uit dezelfde lijst als de balk", /const tab = \(id: Tab\): TabItem/.test(bron),
  "MEGA_GROEPEN hoort naar de bestaande TabItem-objecten te wijzen, niet naar eigen labels.");

// Elk scherm heeft een regel uitleg; die staat in het menu zichtbaar onder het
// label. Een leeg zinnetje maakt het menu een kale lijst en dan is er niets
// gewonnen ten opzichte van de twee uitklapmenu's van hiervoor.
const zonderHint = [...bron.matchAll(/\{ id: "([a-z-]+)", label: "[^"]+", hint: "(\s*)" \}/g)].map((m) => m[1]);
check("elk scherm heeft een regel uitleg", zonderHint.length === 0, zonderHint.join(", "));

// ── Het klantprofiel en de strategie staan bij "wie is deze klant" ──
// Dit is de reden dat de hele herindeling begon: het klantprofiel stond boven een
// lijst van 65 URL's op de tab Pagina's, terwijl de tab Klantgegevens in zijn
// eigen omschrijving beloofde dat het daar stond. Zonder deze controle sluipt het
// er zo weer in, want in PagesPanel is die code nog steeds thuis.
const cockpit = fs.readFileSync(path.join(WORTEL, "app/admin/client/[slug]/ClientCockpit.tsx"), "utf8");
const klantTab = cockpit.slice(cockpit.indexOf('{tab === "klant" &&'), cockpit.indexOf('{paginasVisited &&'));
check("het klantprofiel staat op de tab Klantgegevens", /alleenProfiel/.test(klantTab),
  "PagesPanel hoort daar met alleenProfiel te staan; anders is het profiel terug bij de paginalijst.");
// Het vrije tekstveld (heette "Zoekwoorden & links", heet nu "Overzicht") stond
// hier een tijd bij, met het argument dat een afspraak die maanden meegaat geen
// taak van deze week is. Op 17-08-2026 teruggedraaid op verzoek: er staat veel
// meer in dan zoekwoorden, en je houdt het bij terwijl je werkt. Wat blijft
// gelden is de reden dat deze proef bestaat, en dat is niet "waar staat het"
// maar "staat het op precies één plek". Dus: op Taken, en nergens anders.
const takenTab = cockpit.slice(cockpit.indexOf('{tab === "werkzaamheden" &&'), cockpit.indexOf('{tab === "resultaten" &&'));
check("het Overzicht-veld staat op de tab Taken", /<FocusBlock[^>]*titel="Overzicht"/.test(takenTab),
  "Het vrije tekstveld hoort in de rechterkolom van Taken te staan, onder de mails en boven \"Waar we naartoe werken\".");
check("het Overzicht-veld staat niet óók op de tab Klantgegevens", !/FocusBlock/.test(klantTab),
  "Twee plekken voor hetzelfde veld betekent dat je altijd de verkeerde openhebt.");

const pages = fs.readFileSync(path.join(WORTEL, "app/admin/client/[slug]/PagesPanel.tsx"), "utf8");
const keerGetoond = (pages.match(/\{profielBlok\}/g) || []).length;
check("de paginalijst toont het profiel niet zelf meer", keerGetoond === 1,
  `Het profielblok wordt ${keerGetoond} keer getoond; het hoort alleen in de alleenProfiel-stand te staan, anders zie je hem op twee tabbladen tegelijk.`);

console.log(fouten === 0
  ? "\nElk scherm staat bij de vraag die het beantwoordt."
  : `\n${fouten} punt(en) mis.`);
process.exit(fouten === 0 ? 0 : 1);
