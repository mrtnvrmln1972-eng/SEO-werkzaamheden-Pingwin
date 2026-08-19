import fs from "node:fs";
import path from "node:path";
import { isSiteAssistent, isSiteGesprek } from "../lib/gesprekken";

// ═══════════════════════════════════════════════════════════
// ÉÉN SITE-ASSISTENT, TWEE VENSTERS
// ═══════════════════════════════════════════════════════════
// Waarom deze proef bestaat: er waren twee schermen op dezelfde motor, en welke
// assistent je kreeg hing af van de naam van de thread. Het Overview-blok op de
// takenpagina gaf de bird's eye met de volledige site-context; het zwevende
// venster gaf een lichtere projectchat met een half beeld. Dat verschil was
// nergens te zien: je opende het ene of het andere venster en kreeg iets anders.
// Erger nog, de gesprekkenlijst van het venster was niet gefilterd, dus stonden
// de bird's eye-gesprekken er óók in, met hun technische naam
// (`overzicht:~mshj4bjy`), en klikte je die aan dan wisselde je stilzwijgend van
// assistent.
//
// Sinds 19-08-2026 is het één tool: dezelfde context, dezelfde gereedschappen,
// dezelfde gesprekken. Dat is precies het soort samenvoeging dat vanzelf weer
// uit elkaar loopt zodra iemand ergens een eigen filter of een tweede
// context-builder neerzet. Vandaar deze poort.

const WORTEL = path.resolve(__dirname, "..");
let fouten = 0;
function check(wat: string, goed: boolean, waarom: string) {
  console.log(`${goed ? "ok " : "FOUT"}  ${wat}`);
  if (!goed) { console.log(`      ${waarom}`); fouten++; }
}

const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");
const chat = lees("lib/chat.ts");
const venster = lees("app/admin/client/[slug]/ChatPanel.tsx");
const blok = lees("app/admin/client/[slug]/OverviewChat.tsx");

// ── 1. Eén regel voor welke gesprekken erbij horen ────────────────────────────

for (const [naam, code] of [["het zwevende venster", venster], ["het Overview-blok", blok]] as const) {
  check(`${naam} gebruikt de gedeelde gesprekkenregel`,
    /from "(\.\.\/)+lib\/gesprekken"/.test(code) && /isSiteGesprek\(/.test(code),
    "Beide vensters tonen dezelfde gesprekken. Filter dus met isSiteGesprek uit lib/gesprekken, niet met een eigen regel.");

  // Een eigen filter op de threadnaam is precies hoe ze de vorige keer uit
  // elkaar liepen. In lib/gesprekken.ts mag het, daar hoort het.
  const eigenFilter = /\.(?:startsWith|indexOf)\(\s*["'`]overzicht/.test(code);
  check(`${naam} verzint geen eigen filter op de gespreksnaam`, !eigenFilter,
    'Haal het weg en gebruik isSiteGesprek/gesprekLabel; anders tonen de twee vensters weer een andere lijst.');

  check(`${naam} laat de naam van een gesprek door gesprekLabel lopen`,
    /gesprekLabel\(/.test(code),
    "Anders komt een technische naam als `overzicht:~mshj4bjy` in beeld, of heten twee verschillende gesprekken allebei 'Algemeen'.");
}

// ── 2. Eén context voor elk site-gesprek ──────────────────────────────────────

check("de site-assistent kiest zijn context niet meer op de naam van de thread",
  !/startsWith\(\s*["'`]overzicht["'`]\s*\)/.test(chat),
  "Dat was de oude schakelaar: 'overzicht*' gaf de volledige context, elke andere naam een half beeld.");

check("elk gesprek dat geen Ads of lead is, krijgt de volledige site-context",
  /const isOverview = isSiteAssistent\(/.test(chat) && /: isAds \? await buildAdsContext\(client\) : await buildOverviewContext\(client\)/.test(chat),
  "Zonder dit ontstaat er weer een tweede soort assistent met minder kennis.");

// Het eigen gesprek van een projectkaart staat niet in de lijst, maar draait wél
// op de site-assistent. Die twee vragen zijn apart, en dat moet zo blijven: haal
// je ze door elkaar, dan krijgt een kaartgesprek de Ads-prompt bij de site-data.
check("een kaartgesprek draait op de site-assistent maar staat niet in de lijst",
  isSiteAssistent("overzicht:kaart:12") && !isSiteGesprek("overzicht:kaart:12"),
  "Motor-regel en lijst-regel zijn verschillend; zie lib/gesprekken.ts.");
check("de Ads- en leadgesprekken draaien niet op de site-assistent",
  !isSiteAssistent("ads") && !isSiteAssistent("lead"),
  "Die hebben eigen grounding; hun cijfers en rol horen niet in de site-assistent.");
check("de oude gesprekken blijven zichtbaar", isSiteGesprek("algemeen") && isSiteGesprek("Landingspagina Zwemvijver"),
  "Vrij benoemde gesprekken en 'algemeen' zouden anders stilletjes uit beeld verdwijnen.");

check("er is geen tweede context-builder voor gewone klantgesprekken",
  !/async function buildContext\(/.test(chat),
  "Twee builders voor hetzelfde gesprek lopen uit elkaar; dat is precies wat er gebeurd is.");

// ── 3. Alles ligt op tafel: mail, cijfers, koers, site ────────────────────────

const context = chat.slice(
  chat.indexOf("async function buildOverviewContext("),
  chat.indexOf("async function buildLeadContext("),
);
check("de site-context is echt gevonden", context.length > 2000,
  "buildOverviewContext staat niet meer waar deze proef hem zoekt; werk de proef bij.");

const moet: [string, RegExp][] = [
  ["de e-mail met de klant", /RECENTE E-MAILS/],
  ["de stand van zaken", /STAND VAN ZAKEN/],
  ["de mogelijke acties uit mail", /MOGELIJKE ACTIES UIT MAIL/],
  ["de lopende werkzaamheden", /LOPENDE WERKZAAMHEDEN/],
  ["Search Console, de totalen", /SEARCH CONSOLE, TOTALEN/],
  ["Search Console, de zoekwoord-trend", /ZOEKWOORD-TREND/],
  ["de Ahrefs-sitecijfers", /AHREFS, SITE-CIJFERS/],
  ["Google Ads", /GOOGLE ADS/],
  ["de koers van Maarten", /DE KOERS/],
  ["de volledige paginalijst", /buildUrlContext/],
  ["de werkstatus per pagina", /getPageWorkStatus/],
  ["de concurrenten", /CONCURRENTEN/],
  ["het klantprofiel", /KLANTPROFIEL/],
  ["de notities", /notitiesBlok/],
];
for (const [wat, patroon] of moet) {
  check(`de site-assistent krijgt ${wat} mee`, patroon.test(context),
    "Dit stond in de context van één van de twee oude assistenten. Bij de samenvoeging hoort alles op tafel te liggen.");
}

console.log(fouten === 0 ? "\nGesprekken: alles klopt." : `\nGesprekken: ${fouten} probleem(en).`);
if (fouten > 0) process.exit(1);
