import fs from "node:fs";
import path from "node:path";
import { gesprekDatum, korteDatum, hoeLangGeleden } from "../lib/chat-datum";

// ═══════════════════════════════════════════════════════════
// ELK GESPREK LAAT ZIEN VAN WANNEER HET IS
// ═══════════════════════════════════════════════════════════
// Waarom deze proef bestaat: bij Paul Hoevenaars stond op /hovenier-oss/ een
// uitgewerkt gesprek uit juli en op /hovenier-uden/ een gesprek van 14 augustus
// met de herziene strategie. Op het scherm zagen die twee er identiek uit, want
// er stond alleen een titel. Wie alleen de titel ziet kan niet vaststellen welke
// afspraak nog geldt, en de fases erna (analyse, blauwdruk, copy) draaien op de
// laatste conclusie. Dan genereer je een document op een achterhaald uitgangspunt.
//
// De opmaak van die datum stond al twee keer los in de code, met elk een eigen
// manier om de maand af te korten. Dat is precies het patroon dat in dit project
// steeds opnieuw uiteenloopt, dus: één bron (lib/chat-datum.ts), één CSS-regel
// (.gesprek-datum), en deze poort die nakijkt of het zo blijft.

const WORTEL = path.resolve(__dirname, "..");
let fouten = 0;
function check(wat: string, goed: boolean, waarom: string) {
  console.log(`${goed ? "ok " : "FOUT"}  ${wat}`);
  if (!goed) { console.log(`      ${waarom}`); fouten++; }
}

const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");

// ── 1. De bron zelf doet wat hij belooft ─────────────────────────────────────

const nu = new Date();
const vandaag = nu.toISOString();
const langGeleden = new Date(nu.getFullYear() - 1, 2, 14).toISOString();

check("een datum van vandaag levert een leesbaar label", !!korteDatum(vandaag),
  "Zonder label staat er niets in beeld en is het gesprek weer ongedateerd.");

check("een gesprek uit een ander jaar krijgt het jaartal erbij", /\d{4}/.test(korteDatum(langGeleden)),
  'Anders leest "14 mrt" van vorig jaar als een gesprek van deze maand.');

check("een gesprek van dit jaar krijgt GEEN jaartal", !/\d{4}/.test(korteDatum(vandaag)),
  "Het jaartal is dan ruis in elke rij van de lijst.");

check("onzin-data leveren niets op in plaats van een verkeerd antwoord",
  korteDatum("") === "" && korteDatum("geen datum") === "" && korteDatum(new Date(0).toISOString()) === "",
  "Een leeg veld dat als tijdstempel gelezen wordt (1970) mag nooit als datum in beeld komen.");

check("een datum in de toekomst telt niet mee",
  korteDatum(new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()) === "",
  "Een computer met een verkeerde klok zou anders het nieuwste gesprek lijken.");

check('"vandaag" en "gisteren" staan er in gewone taal',
  hoeLangGeleden(vandaag) === "vandaag"
  && hoeLangGeleden(new Date(Date.now() - 24 * 3600 * 1000).toISOString()) === "gisteren",
  "De tooltip moet in gewone taal zeggen hoe oud een gesprek is.");

const dat = gesprekDatum(vandaag, new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString());
check("de tooltip vertelt het hele verhaal (wanneer, hoe lang geleden, wanneer gestart)",
  dat.titel.includes("Laatste bericht") && dat.titel.includes("vandaag") && dat.titel.includes("gestart"),
  "Een gesprek dat over meerdere dagen liep, moet dat in de tooltip laten zien.");

check("een gesprek zonder datum levert geen half label op",
  gesprekDatum("").label === "" && gesprekDatum("").titel === "",
  "Liever niets dan een streepje of een lege tooltip.");

// ── 2. Er is maar ÉÉN plek waar een gespreksdatum tekst wordt ────────────────

const bron = lees("lib/chat-datum.ts");
check("lib/chat-datum.ts is de enige die een datum opmaakt", /toLocaleDateString/.test(bron),
  "De opmaak hoort hier te staan, niet in een scherm.");

// Elk scherm dat een gespreksdatum toont, haalt hem hier. Een eigen `korteDatum`
// (of een eigen toLocaleDateString op een updatedAt) is hoe de twee kopieën van
// vóór 20-08-2026 zijn ontstaan.
const SCHERMEN = [
  "app/admin/client/[slug]/OverviewChat.tsx",
  "app/admin/client/[slug]/ChatPanel.tsx",
  "app/admin/client/[slug]/DocumentenPanel.tsx",
  "app/admin/client/[slug]/PagesPanel.tsx",
  "app/admin/client/[slug]/pagina-chat/StrategieKaart.tsx",
  "app/admin/client/[slug]/weekplan-kaart/KaartChat.tsx",
];
for (const p of SCHERMEN) {
  const code = lees(p);
  const naam = p.split("/").pop();
  check(`${naam} gebruikt de gedeelde datum-bron`,
    /from "(\.\.\/)+lib\/chat-datum"/.test(code),
    "Importeer korteDatum/gesprekDatum uit lib/chat-datum in plaats van er een eigen versie neer te zetten.");
  check(`${naam} schrijft de datum niet zelf op`,
    !/function korteDatum\b/.test(code),
    "Twee eigen versies liepen al uiteen op de manier waarop ze de maand afkortten.");
}

// ── 3. Elke gesprekkenlijst zet die datum ook echt neer ──────────────────────

const LIJSTEN: [string, string][] = [
  ["de gesprekken op de takenpagina", "app/admin/client/[slug]/OverviewChat.tsx"],
  ["de eerdere chats bij een pagina", "app/admin/client/[slug]/pagina-chat/StrategieKaart.tsx"],
  ["het gesprek op de projectkaart", "app/admin/client/[slug]/weekplan-kaart/KaartChat.tsx"],
];
for (const [wat, p] of LIJSTEN) {
  check(`${wat} toont de datum`, /gesprek-datum/.test(lees(p)),
    "Zonder datum weet je niet welk gesprek het laatste woord had.");
}

check("de gesprekkenkeuze in het zwevende venster zet de datum in het label",
  /korteDatum\(t\.updatedAt\)/.test(lees("app/admin/client/[slug]/ChatPanel.tsx")),
  "Een uitklaplijst kan geen los kolommetje tonen, dus de datum hoort in de regel zelf.");

check("het paginadossier dateert zijn chatregels",
  /gesprekDatum\(c\.updatedAt/.test(lees("lib/dossier-blok.ts")),
  'De regels onder "Achtergrond en afspraken" stonden zonder datum, naast tijdlijnregels die er wél een hadden.');

check("de vastgelegde strategie laat zien wanneer hij is vastgelegd",
  /vastgelegd \{gesprekDatum\(planDatum\)\.label\}/.test(lees("app/admin/client/[slug]/PagesPanel.tsx")),
  "Een tabblad dat nog openstond toonde na het vastleggen gewoon de oude tekst; met een datum zie je dat meteen.");

// ── 4. De database stuurt de data mee ────────────────────────────────────────

const chats = lees("lib/page-chats.ts");
check("de chatlijst stuurt zowel de start- als de laatste datum mee",
  /createdAt: string/.test(chats) && /SELECT id, title, messages, created_at, updated_at/.test(chats),
  "Zonder created_at kan de tooltip niet zeggen dat een gesprek over meerdere dagen liep.");

check("één chat opvragen levert zijn data mee",
  /export async function getChat\([\s\S]{0,200}updatedAt: string/.test(chats),
  "De projectkaart opent één gesprek en moet daar de datum bij kunnen zetten.");

check("een gesprek van de klant-chat stuurt zijn datum mee",
  /getChatUpdatedAt/.test(lees("app/api/admin/chat/route.ts")),
  "Met nothreads=1 kwam er geen datum mee, dus stond een kaart-gesprek ongedateerd in beeld.");

// ── 5. Eén CSS-regel, en niet stiekem een tweede ─────────────────────────────

const css = lees("app/globals.css");
const regels = css.match(/^\.gesprek-datum\b[^{]*\{/gm) || [];
check("er is precies één opmaakregel voor de gespreksdatum", regels.length === 1,
  `Gevonden: ${regels.length}. Twee regels lopen uiteen en dan ziet dezelfde datum er per scherm anders uit.`);

console.log(fouten === 0 ? "\nGespreksdatums staan overal, uit één bron." : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);
