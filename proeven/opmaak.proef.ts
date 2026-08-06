// Proef op de opmaakregels.
//
// WAAROM DIT BESTAAT
// ══════════════════
// De opmaakregels staan al maanden uitgeschreven in het projectgeheugen: nooit
// ruwe tekst in beeld, nooit AI-tekst in een kaal invulvak, altijd de vaste
// schaal, altijd een kopbalk. En op 6 augustus 2026 leverde ik een scherm op dat
// er drie brak: geen kop, geen navigatie, tekst tegen de linkerrand en het
// profiel in een kaal tekstvak. Maarten had de regels toen "al honderdduizend
// keer" gegeven.
//
// De les is dat een regel die alleen in een document leeft, gebroken wordt zodra
// iemand haast heeft. Wat wél werkt is een controle die rood wordt. Vandaar dit
// bestand: het maakt van de afspraken iets dat de bouw tegenhoudt in plaats van
// iets om te onthouden.
//
// Bewust GEEN algemene opmaakpolitie die over elk detail valt; dat geeft ruis en
// dan zet iemand hem uit. Alleen de dingen die echt zijn misgegaan.
//
// Deze proef draait niet alleen bij `npm run proef` maar ook als `prebuild`, dus
// óók op Vercel bij elke deploy. Een scherm dat zich niet aan de bouwstenen
// houdt, komt daarmee niet live: de bouw stopt ervoor. Dat is het verschil
// tussen een afspraak en een poort.

import fs from "fs";
import path from "path";

let fouten = 0;
function checkWaar(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

const WORTEL = path.join(__dirname, "..");
const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");

// ── 1. Elk los beheerscherm heeft een kopbalk ──
// Een scherm zonder kop is een scherm zonder terugweg: je landt erop en zit vast.
//
// De schermen hieronder tekenen hun kopbalk nog zelf, van vóór AdminKop bestond.
// Die lijst mag korter worden en nooit langer. Komt er een nieuw scherm bij, dan
// gebruikt dat AdminKop; anders wordt deze proef rood.
const EIGEN_KOPBALK = [
  "app/admin/AdminClient.tsx",
  "app/admin/beheer/BeheerClient.tsx",
  "app/admin/developer/DeveloperOverview.tsx",
  "app/admin/routekaart/RoutekaartClient.tsx",
  "app/admin/client/[slug]/ClientCockpit.tsx",
];

// Deze mappen hebben met opzet geen kopbalk: de login (je bent nog niet binnen),
// de doorgeefluikjes, en de klantvoorvertoning (die toont het klantscherm zelf).
const GEEN_KOP_NODIG = ["login", "enter", "preview", "client"];

function schermMappen(): string[] {
  const map = path.join(WORTEL, "app/admin");
  return fs.readdirSync(map)
    .filter((n) => fs.statSync(path.join(map, n)).isDirectory())
    .filter((n) => !GEEN_KOP_NODIG.includes(n))
    .filter((n) => fs.existsSync(path.join(map, n, "page.tsx")));
}

// Per scherm kijken we naar ALLE bestanden in die map, niet naar één. De kopbalk
// kan namelijk net zo goed in de serverpagina staan als in het clientdeel; wie op
// één bestand controleert, meldt onterecht een fout of mist er juist een.
for (const naam of schermMappen()) {
  const map = path.join(WORTEL, "app/admin", naam);
  const bestanden = fs.readdirSync(map).filter((b) => b.endsWith(".tsx"));
  const inhoud = bestanden.map((b) => fs.readFileSync(path.join(map, b), "utf8")).join("\n");
  const heeftKop = inhoud.includes("<AdminKop") || inhoud.includes('className="header"');
  checkWaar(`kopbalk aanwezig op /admin/${naam}`, heeftKop,
    `Gebruik <AdminKop titel="..." /> uit app/admin/AdminKop.tsx. Zonder kopbalk heeft het scherm geen terugweg.`);
  const eigenKop = EIGEN_KOPBALK.some((p) => p.startsWith(`app/admin/${naam}/`));
  if (heeftKop && !inhoud.includes("<AdminKop") && !eigenKop) {
    checkWaar(`/admin/${naam} gebruikt de gedeelde kopbalk`, false,
      "Dit scherm tekent zijn eigen kopbalk maar staat niet in de migratielijst. Gebruik AdminKop.");
  }
}

// ── 2. Geen kaal invulvak voor tekst die de assistent schreef ──
// Harde regel uit het projectgeheugen: AI-tekst wordt gerenderd getoond, en is
// bewerkbaar via een contentEditable die gerenderd blijft.
const AI_VELDEN = ["app/admin/schrijfstijl/SchrijfstijlClient.tsx"];
for (const bestand of AI_VELDEN) {
  const inhoud = lees(bestand);
  checkWaar(`geen kaal invulvak in ${bestand}`, !inhoud.includes("<textarea"),
    "AI-tekst hoort gerenderd in beeld (mdToHtml), bewerkbaar via contentEditable. Zie MailVenster als patroon.");
  checkWaar(`${bestand} rendert de tekst`, inhoud.includes("mdToHtml"),
    "Zonder mdToHtml staan er sterretjes en streepjes in beeld.");
}

// ── 3. Elk scherm staat in het Intern-menu ──
// Een scherm dat je niet terugvindt, bestaat in de praktijk niet.
const menu = lees("app/admin/OntwikkelMenu.tsx");
const paden = [...menu.matchAll(/pad:\s*"([^"]+)"/g)].map((m) => m[1]);
const mappen = fs.readdirSync(path.join(WORTEL, "app/admin"))
  .filter((n) => fs.statSync(path.join(WORTEL, "app/admin", n)).isDirectory())
  .filter((n) => !["login", "enter", "preview", "client"].includes(n))
  .filter((n) => fs.existsSync(path.join(WORTEL, "app/admin", n, "page.tsx")));
for (const m of mappen) {
  checkWaar(`/admin/${m} staat in het Intern-menu`, paden.includes(`/admin/${m}`),
    `Zet er een regel bij in SCHERMEN in app/admin/OntwikkelMenu.tsx, met één zin over waar je het voor gebruikt.`);
}
checkWaar("het klantenoverzicht staat er ook in", paden.includes("/admin"), "");

// ── 4. De nieuwe opmaak gebruikt de vaste schaal ──
// Losse waarden in plaats van de tokens is precies hoe een ontwerp uit elkaar
// gaat lopen. Alleen de blokken die vandaag zijn toegevoegd worden gecontroleerd;
// de oudere opmaak migreert stuk voor stuk.
// Alleen de regels van de gedeelde beheerscherm-bouwstenen (.beheer-). Bewust per
// regel gezocht en niet "alles vanaf hier tot het eind": er wordt vanuit meerdere
// chats aan dit bestand geschreven, dus wat er ná mijn blok staat is van iemand
// anders en hoort hier niet gemeten te worden. Die te ruime greep gaf op
// 6 augustus meteen een valse melding.
const css = lees("app/globals.css");
const eigenRegels = css.split("\n").filter((r) => /^\.beheer-[\w-]*[\s,{]/.test(r.trim()));
checkWaar("de bouwstenen bestaan", eigenRegels.length > 5, `gevonden: ${eigenRegels.length} regels`);
const losseWaarden = eigenRegels
  .flatMap((r) => [...r.matchAll(/:\s*(\d+)px/g)].map((m) => `${r.trim().slice(0, 30)}… ${m[0]}`))
  .filter((v) => !/:\s*1px/.test(v));
checkWaar("de nieuwe opmaak gebruikt de vaste schaal", losseWaarden.length === 0,
  `Gevonden losse waarden: ${losseWaarden.join(" | ")}. Gebruik --s-*, --fs-*, --r-* in plaats van vaste pixels (een randje van 1px mag).`);

// ── 4. Afbreken midden in een woord staat nooit op een heel blok ──
// Op 6 augustus 2026 kwam er een projectkaart live die duizenden pixels hoog was,
// met een kolom tekst van één letter breed. De oorzaak was één stijlregel:
// `overflow-wrap: anywhere` stond op `.wp-card`, dus op de hele kaart. Die
// eigenschap breekt niet alleen lange woorden af, hij verlaagt ook de kleinst
// mogelijke breedte van alles eronder; in een raster met `minmax(0, 1fr)` mag een
// kolom dan tot één letter samenknijpen.
//
// De regel is dus: `anywhere` en `break-all` mogen alleen op een element dat één
// stuk tekst is (een titel, een link, een tabelcel, een tekstregel), nooit op een
// kaart, een paneel, een rij of een raster. Die woorden staan hieronder.
// Alleen de LAATSTE klasse van een selector telt: dat is het element dat de regel
// echt raakt. ".link-preview-card .lp-url" gaat over de url, niet over de kaart.
// En de naam moet ER OOK OP EINDIGEN: ".wp-card" is een kaart, ".wp-card-url" is
// een webadres. Zonder die twee nuances vlagt deze proef precies de regels die
// wél goed staan, en dan zet iemand hem uit.
const BLOK_EINDE = /(card|kaart|panel|paneel|wrap|grid|rij|row|blok|body|main|kolom)$/i;
const isBlok = (selector: string) => selector.split(",").some((deel) => {
  const laatste = deel.trim().split(/\s+/).pop() || "";
  return laatste.split(/[.:>#]/).filter(Boolean).some((k) => BLOK_EINDE.test(k));
});
const breekRegels = css.split("\n")
  .map((r) => r.trim())
  .filter((r) => /overflow-wrap:\s*anywhere|word-break:\s*break-all/.test(r) && r.startsWith("."));
const teBreed = breekRegels.filter((r) => isBlok(r.split("{")[0]));
checkWaar("afbreken midden in een woord staat alleen op tekst, niet op een heel blok", teBreed.length === 0,
  `Gevonden: ${teBreed.map((r) => r.slice(0, 70)).join(" | ")}. Zet 'overflow-wrap: anywhere' of 'word-break: break-all' op het tekstelement zelf, of gebruik 'break-word' (die laat de minimale breedte met rust).`);
// ── 6. Geen scherm verzint zijn eigen opmaak ──
// Aanvulling van 6 augustus 2026, tweede ronde. De vier controles hierboven
// dekken de schermen die toen misgingen; deze dekt de fout die er daarna
// alsnog doorheen kwam: een paneel dat zijn eigen afstanden, lettergroottes en
// kleuren neerzet in een `style`-attribuut, met tekstmuren en losse rode regels
// als resultaat. Er is nu één set bouwstenen (`app/_ui/Uitkomst.tsx`) waar dat
// allemaal al in zit, en hieronder staat wat er gebeurt als je eromheen bouwt.
//
// De erfenis-lijst is de kern. De schermen van vóór deze datum in één keer
// verbouwen zou werkende schermen breken, dus die staan hieronder. Het werkt als
// een ratel, één kant op:
//   - staat een bestand er NIET in, dan moet het schoon zijn;
//   - een NIEUW scherm staat er per definitie niet in en moet dus meteen goed;
//   - een verbouwd scherm haal je eraf, en dan kan het nooit meer terugvallen.
// De lijst mag dus alleen korter worden.
const ERFENIS = new Set<string>([
  "app/admin/AdminClient.tsx",
  "app/admin/ReadOnlyGuard.tsx",
  "app/admin/beheer/BeheerClient.tsx",
  "app/admin/client/[slug]/ActionCard.tsx",
  "app/admin/client/[slug]/ActiviteitPanel.tsx",
  "app/admin/client/[slug]/AntwoordBlokken.tsx",
  "app/admin/client/[slug]/CannibalPanel.tsx",
  "app/admin/client/[slug]/ChatPanel.tsx",
  "app/admin/client/[slug]/ClientCockpit.tsx",
  "app/admin/client/[slug]/DevDoorzetten.tsx",
  "app/admin/client/[slug]/DocumentenPanel.tsx",
  "app/admin/client/[slug]/GmbPanel.tsx",
  "app/admin/client/[slug]/ImportAnalysis.tsx",
  "app/admin/client/[slug]/InvoiceAlert.tsx",
  "app/admin/client/[slug]/Kennisbank.tsx",
  "app/admin/client/[slug]/KpiPanel.tsx",
  "app/admin/client/[slug]/LeadChat.tsx",
  "app/admin/client/[slug]/LeadTab.tsx",
  "app/admin/client/[slug]/MailAllowlist.tsx",
  "app/admin/client/[slug]/MailControlePanel.tsx",
  "app/admin/client/[slug]/MailUitKaart.tsx",
  "app/admin/client/[slug]/MailVenster.tsx",
  "app/admin/client/[slug]/MetaCtrPanel.tsx",
  "app/admin/client/[slug]/MetaPixelMeter.tsx",
  "app/admin/client/[slug]/OpruimEindstructuur.tsx",
  "app/admin/client/[slug]/OpruimGaten.tsx",
  "app/admin/client/[slug]/OpruimOnderwerpen.tsx",
  "app/admin/client/[slug]/OpruimOppakken.tsx",
  "app/admin/client/[slug]/OpruimStructuur.tsx",
  "app/admin/client/[slug]/OrgDataPanel.tsx",
  "app/admin/client/[slug]/OverviewChat.tsx",
  "app/admin/client/[slug]/PageChat.tsx",
  "app/admin/client/[slug]/PageSummaryCard.tsx",
  "app/admin/client/[slug]/PagesPanel.tsx",
  "app/admin/client/[slug]/SelectionActions.tsx",
  "app/admin/client/[slug]/StrategyPanel.tsx",
  "app/admin/client/[slug]/TasksEditor.tsx",
  "app/admin/client/[slug]/WeekplanCard.tsx",
  "app/admin/client/[slug]/WerkplanPanel.tsx",
  "app/admin/client/[slug]/WijzigingenPanel.tsx",
  "app/admin/client/[slug]/navigatie/NavigatieRoadmap.tsx",
  "app/admin/developer/DeveloperOverview.tsx",
  "app/admin/financien/FinancienClient.tsx",
  "app/admin/financien/page.tsx",
  "app/admin/routekaart/RoutekaartClient.tsx",
  "app/admin/usage/page.tsx",
  "app/dashboard/Dashboard.tsx",
  "app/uitleg/page.tsx",
]);

// Eigen opmaak = een VASTE waarde voor iets waar een schaal voor bestaat. Een
// scherm dat `var(--s-4)` gebruikt doet het juist goed; alleen losse pixels,
// kale getallen en eigen kleurcodes zijn fout. Dat onderscheid is niet
// theoretisch: de eerste versie van deze controle keek alleen naar de naam van
// de eigenschap en meldde meteen twee schermen die keurig de tokens gebruikten.
const SCHAAL_EIGENSCHAPPEN = "fontSize|lineHeight|padding|paddingTop|paddingBottom|paddingLeft|paddingRight|margin|marginTop|marginBottom|marginLeft|marginRight|gap|borderRadius|boxShadow|color|background|backgroundColor";

function vasteWaarden(styleInhoud: string): string[] {
  const uit: string[] = [];
  const patroon = new RegExp(`(${SCHAAL_EIGENSCHAPPEN})\\s*:\\s*("[^"]*"|'[^']*'|\`[^\`]*\`|[^,}]+)`, "g");
  let m: RegExpExecArray | null;
  while ((m = patroon.exec(styleInhoud)) !== null) {
    const waarde = m[2].trim();
    if (waarde.includes("var(--")) continue;         // gebruikt de schaal: goed
    if (/^\{?[a-zA-Z_$][\w$.?[\]'"]*\}?$/.test(waarde)) continue; // een variabele, niet te beoordelen
    if (/\d+\s*px|#[0-9a-fA-F]{3,8}|rgba?\(|^["']?\d+(\.\d+)?["']?$/.test(waarde)) uit.push(`${m[1]}: ${waarde}`);
  }
  return uit;
}
// Manieren waarop tekst netjes door de opmaaklaag gaat.
const GERENDERD = /(mdToHtml|veiligeHtml|linkify|__html:\s*\w*[Hh]tml)/;

function alleSchermen(map: string): string[] {
  const uit: string[] = [];
  for (const naam of fs.readdirSync(map)) {
    const vol = path.join(map, naam);
    if (fs.statSync(vol).isDirectory()) { if (naam !== "node_modules") uit.push(...alleSchermen(vol)); continue; }
    if (naam.endsWith(".tsx")) uit.push(vol);
  }
  return uit;
}

const eigenOpmaak: string[] = [];
const erfenisGezien = new Set<string>();
let schoon = 0;
for (const vol of alleSchermen(path.join(WORTEL, "app"))) {
  const rel = path.relative(WORTEL, vol).split(path.sep).join("/");
  if (ERFENIS.has(rel)) { erfenisGezien.add(rel); continue; }
  const regels = fs.readFileSync(vol, "utf8").split("\n");
  const raak: string[] = [];
  regels.forEach((regel, i) => {
    const style = regel.match(/style=\{\{([^}]*)\}/);
    if (style) {
      const vast = vasteWaarden(style[1]);
      if (vast.length) raak.push(`${rel}:${i + 1} eigen opmaak (${vast.join(", ")}) — ${regel.trim().slice(0, 60)}`);
    }
    if (regel.includes("dangerouslySetInnerHTML") && !GERENDERD.test(regel) && !GERENDERD.test(regels[i + 1] || "")) {
      raak.push(`${rel}:${i + 1} tekst niet gerenderd — ${regel.trim().slice(0, 80)}`);
    }
  });
  if (raak.length) eigenOpmaak.push(...raak); else schoon++;
}

checkWaar(`geen scherm verzint eigen opmaak (${schoon} schoon, ${erfenisGezien.size} nog op de erfenis-lijst)`,
  eigenOpmaak.length === 0,
  `Gebruik app/_ui/Uitkomst.tsx en de schaal-tokens uit app/globals.css.\n       ${eigenOpmaak.slice(0, 12).join("\n       ")}${eigenOpmaak.length > 12 ? `\n       … en nog ${eigenOpmaak.length - 12}.` : ""}`);

const verdwenen = [...ERFENIS].filter((f) => !erfenisGezien.has(f));
checkWaar("de erfenis-lijst bevat geen bestanden die niet meer bestaan", verdwenen.length === 0,
  `Haal deze eruit: ${verdwenen.join(", ")}`);

console.log(fouten ? `\n${fouten} proef(en) mislukt.` : "\nAlle proeven geslaagd.");
process.exit(fouten ? 1 : 0);
