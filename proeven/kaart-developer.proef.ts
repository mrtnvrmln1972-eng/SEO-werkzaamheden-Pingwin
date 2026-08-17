// Proef op de projectkaart: één ding zegt waar het werk ligt, en één rij regelt
// wat er open staat.
//
// WAAROM DIT BESTAAT
// ══════════════════
// De Implementatie-rij op een kaart is drie keer achter elkaar aangegroeid met
// iets dat over de sitebouwer ging. Op 17 augustus 2026 stonden er tegelijk: een
// knop "Developer", een vinkje "(ligt bij dev)" en een statuspil rechts die óók
// "Bij de developer" zei. Onderaan diezelfde kaart stond er nóg een. Vier plekken
// voor één stand, en Maarten heeft dat twee keer op rij moeten melden.
//
// Sinds 18 augustus 2026 is het één knop: hij vraagt "Naar developer?", en zodra
// de kaart op de developerlijst staat is hij rood en zegt hij "Bij developer".
// Actie en stand in hetzelfde ding, dus ze kunnen niet meer uit elkaar lopen.
//
// Hetzelfde geldt voor de uitklappers bovenaan de kaart: achtergrond, documenten
// en oude versies hadden alle drie hun eigen klepje op hun eigen plek. Nu is het
// één rij met hooguit één open paneel.
//
// Deze proef is er zodat die twee dingen niet stilletjes terugkomen zodra iemand
// haast heeft. Dat is precies hoe ze de vorige keren ontstonden.

import fs from "fs";
import path from "path";

const WORTEL = path.join(__dirname, "..");
// Zonder commentaar lezen: in de uitleg bóven de code staat juist beschreven wat
// er weg is ("het vinkje (ligt bij dev)"), en daar mag deze proef niet over
// vallen. Het gaat om wat het scherm doet, niet om wat erover geschreven staat.
const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .split("\n").filter((r) => !r.trim().startsWith("//")).join("\n");

const fases = lees("app/admin/client/[slug]/weekplan-kaart/KaartFases.tsx");
const onder = lees("app/admin/client/[slug]/weekplan-kaart/KaartOnderRegel.tsx");
const overdeze = lees("app/admin/client/[slug]/weekplan-kaart/KaartOverDeze.tsx");
const docs = lees("app/admin/client/[slug]/DocVersies.tsx");

let fouten = 0;
function proef(naam: string, goed: boolean, waarom: string) {
  console.log(goed ? `ok   ${naam}` : `FOUT  ${naam}`);
  if (!goed) { fouten++; if (waarom) console.log(`      ${waarom}`); }
}

// ── 1. Eén knop voor de developer in de Implementatie-rij ────────────────────
proef(
  "de Implementatie-rij heeft de knop die vraagt én de stand toont",
  /"Naar developer\?"/.test(fases) && /"Bij developer"/.test(fases) && /aria-pressed=\{naarDev\}/.test(fases),
  "Eén knop: \"Naar developer?\" als hij er niet ligt, rood \"Bij developer\" als hij er wel\n"
  + "      ligt. De stand staat in aria-pressed={naarDev}; daar hangt de rode opmaak aan\n"
  + "      (.wp-fase-rij .btn[aria-pressed=\"true\"] in globals.css). Dat was een eigen\n"
  + "      classnaam wp-devknop-aan, en dat telde als een zoveelste soort knop.",
);
proef(
  "er staat geen tweede vinkje voor dezelfde stand naast",
  !/ligt bij dev/i.test(fases) && !/type="checkbox"[\s\S]{0,200}naarDev/.test(fases),
  "Het vinkje \"(ligt bij dev)\" zei precies hetzelfde als de knop ernaast. Eén ding.",
);
proef(
  "de statuspil rechts gaat alleen over de fase, niet over de developer",
  !/"Bij de developer"/.test(fases),
  "De pil rechts hoort ✓ of ✕ te zeggen, net als bij de andere zes fases; anders staat\n"
  + "      dezelfde stand er voor de derde keer.",
);

// ── 2. Onderaan de kaart alleen als er geen fase-blok is ─────────────────────
proef(
  "de onderregel toont developer en mail alleen zonder fase-blok",
  /heeftFases/.test(onder) && /const acties = !heeftFases;/.test(onder),
  "Een kaart mét pagina heeft die twee al in de Implementatie-rij. Alleen een kaart\n"
  + "      zonder pagina (geen fase-blok) heeft ze hier nodig.",
);
proef(
  "de link naar de live pagina staat niet nog een keer onderaan",
  !/title="De live pagina"/.test(onder),
  "Die staat al bovenaan de kaart, in de titel.",
);

// ── 3. Eén rij uitklappers, hooguit één open ─────────────────────────────────
proef(
  "achtergrond, documenten en oude versies zitten in één rij",
  /wp-vouwrij/.test(overdeze)
  && /welke="verhaal"/.test(overdeze) && /welke="docs"/.test(overdeze) && /welke="oud"/.test(overdeze),
  "De drie knoppen horen in dezelfde rij te staan, boven de aantekeningen.",
);
proef(
  "er kan er maar één tegelijk open staan",
  /setVouw\(\(v\) => \(v === welke \? "" : welke\)\)/.test(overdeze),
  "Openen van de een sluit de ander; anders groeit de kaart weer met drie panelen tegelijk.",
);
proef(
  "het documentenblok heeft geen eigen klepje meer",
  !/wp-doc-vouw/.test(docs) && /open\?: boolean/.test(docs),
  "De knop staat in die ene rij. Een tweede klepje in DocVersies zelf betekent twee\n"
  + "      dingen die hetzelfde regelen.",
);
proef(
  "een openstaande versiekeuze zet dat blok vanzelf open",
  /moetKiezen/.test(overdeze) && /setVouw\("docs"\)/.test(overdeze),
  "Liggen er twee versies zonder dat er één geldt, dan wachten de mail en de sitebouwer\n"
  + "      daarop; dat hoort niet achter een dicht klepje te verdwijnen.",
);

// ── 4. De meting staat op de kopregel, niet als losse balk ───────────────────
proef(
  "de verse meting staat rechts op de kopregel",
  /wp-overdeze-kop[\s\S]{0,600}wp-cijfer-nu-lab/.test(overdeze),
  "\"Nu gemeten\" hoort naast \"Over deze pagina\", niet als eigen balk boven de tekst.",
);

console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef(en) mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
