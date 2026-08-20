import fs from "node:fs";
import path from "node:path";
import { zoektermenUitVraag, corrigeerNaam, afstand } from "../lib/mail-zoektermen";

// ═══════════════════════════════════════════════════════════
// EEN VRAAG OVER JE MAIL WORDT OOK ECHT EEN ZOEKOPDRACHT
// ═══════════════════════════════════════════════════════════
// Wat er misging (20-08-2026, Nationaal Oogcentrum): Maarten vroeg "mail van
// pehlevian" en kreeg één mailwisseling terug, over inkoopprijzen. In Superhuman
// stond de mail die hij zocht gewoon: een thread van 31 juli met Emre Pehlivan
// over de nieuwe lenzenpagina's.
//
// De oorzaak was niet het zoeken maar het niet zoeken: het vraagveld haalde de
// zestig recentste mails van die klant op en deed met de woorden van de vraag
// niets. Staat de mail die je zoekt niet in die zestig, dan bestaat hij voor het
// antwoord niet. Bovendien schreef hij de naam verkeerd, en dan levert zelfs een
// goede zoekopdracht niets op.

const WORTEL = path.resolve(__dirname, "..");
let fouten = 0;
function check(wat: string, goed: boolean, waarom: string) {
  console.log(`${goed ? "ok " : "FOUT"}  ${wat}`);
  if (!goed) { console.log(`      ${waarom}`); fouten++; }
}
const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");

// ── 1. Van een vraag naar zoekwoorden ───────────────────────────────────────

const t1 = zoektermenUitVraag("mail van pehlevian");
check("de naam blijft over, de rest valt weg", t1.length === 1 && t1[0] === "pehlevian",
  `Gevonden: ${JSON.stringify(t1)}. "mail" en "van" zeggen niets over wat je zoekt.`);

const t2 = zoektermenUitVraag("wat is er gemaild over de trifocale pro-lens en de refractieve pro-art lens?");
check("de zinvolle woorden komen eruit",
  t2.some((t) => /trifocale/i.test(t)) && t2.some((t) => /refractieve/i.test(t)),
  `Gevonden: ${JSON.stringify(t2)}.`);

const t3 = zoektermenUitVraag('staat er iets over "Analyse locatie pagina\'s NOC" in de mail?');
check("tekst tussen aanhalingstekens blijft één term",
  t3.some((t) => t.toLowerCase().includes("analyse locatie")),
  `Gevonden: ${JSON.stringify(t3)}. Een onderwerpregel hoort niet uit elkaar getrokken te worden.`);

check("er gaan er nooit meer dan een paar naar de mailbox",
  zoektermenUitVraag("alfa bravo charlie delta echo foxtrot golf hotel").length <= 5,
  "Elke term is een aparte vraag aan de mailbox; tien termen is tien rondjes.");

check("een vraag zonder inhoud levert geen zoekopdracht op",
  zoektermenUitVraag("wat is er van de mail?").length === 0,
  "Zoeken op stopwoorden levert de halve mailbox op en helpt niemand.");

// ── 2. Een verschreven naam wordt bijgetrokken ──────────────────────────────

const NAMEN = ["Emre Pehlivan", "pehlivan@nationaaloogcentrum.nl", "Evert Jansen", "John de Vries"];

check("pehlevian wordt Pehlivan", corrigeerNaam("pehlevian", NAMEN).toLowerCase() === "pehlivan",
  "Dit is de melding zelf: de naam stond verkeerd in de vraag en dan vindt de mailbox niets.");

check("een naam die al klopt blijft staan", corrigeerNaam("Pehlivan", NAMEN) === "Pehlivan",
  "Nooit iets 'verbeteren' dat al goed is.");

check("een gewoon woord wordt niet naar een naam getrokken",
  corrigeerNaam("lenzen", NAMEN).toLowerCase() === "lenzen",
  "Anders wordt elk woord in de vraag stilletjes een achternaam.");

check("een kort woord blijft met rust", corrigeerNaam("pro", NAMEN) === "pro",
  "Bij drie letters is één wijziging al een heel ander woord.");

check("zonder bekende namen verandert er niets", corrigeerNaam("pehlevian", []) === "pehlevian",
  "Geen correspondenten, niets om tegen te toetsen.");

check("de afstandmeting klopt",
  afstand("kat", "kat") === 0 && afstand("kat", "kot") === 1 && afstand("pehlevian", "pehlivan") === 2,
  "Zonder een kloppende maat corrigeert hij te veel of te weinig.");

// ── 3. Het vraagveld gebruikt dit ook echt ──────────────────────────────────

const route = lees("app/api/admin/mail-vraag/route.ts");

check("het vraagveld maakt zoekwoorden van de vraag",
  /zoektermenUitVraag\(vraag\)/.test(route),
  "Zonder dit blijft het bij de recentste mails van de klant en vindt hij een oudere mail nooit.");

check("een verschreven naam wordt bijgetrokken tegen de correspondenten",
  /corrigeerNaam\(t, namen\)/.test(route),
  "De namen komen uit de mails van deze klant; dat is de enige lijst die ertoe doet.");

check("er wordt echt in de mailbox gezocht op die woorden",
  /msSearchMail\(`"\$\{t\}"`/.test(route),
  "Termen verzamelen zonder ermee te zoeken verandert niets aan het antwoord.");

check("de gevonden mails komen bij de klantmails, niet in plaats daarvan",
  /for \(const m of klantMails\) samen\.set/.test(route) && /for \(const \[id, m\] of extra\)/.test(route),
  "De recente mails zijn de context waarin de vraag gesteld wordt; die mogen niet wegvallen.");

check("dezelfde mail komt maar één keer in het antwoord",
  /if \(!samen\.has\(id\)\) samen\.set\(id, m\)/.test(route),
  "Een mail die in beide lijsten zit zou anders dubbel meewegen.");

check("het antwoord vertelt waarop gezocht is",
  /ZOCHT OP/.test(route),
  "Is er op een andere schrijfwijze gezocht dan je typte, dan hoor je dat te weten.");

console.log(fouten === 0 ? "\nEen vraag over de mail wordt ook echt een zoekopdracht." : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);
