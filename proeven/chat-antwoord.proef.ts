// Proef op wat er gebeurt als een chatvraag NIET lukt.
//
// WAAROM DIT BESTAAT
// ══════════════════
// Op 11 augustus 2026 stelde Maarten een tweede vraag in de chat van een
// projectkaart (One Day Clinic, "Linkjes naar belangrijke locatiepagina's op de
// homepage"). Er kwam geen antwoord. Geen foutmelding, geen molentje, niets. Hij
// stelde hem nog een keer; weer niets. In beeld stonden twee identieke vragen
// zonder antwoord eronder.
//
// Er waren drie oorzaken, en alle drie hebben dezelfde vorm: er ging iets mis en
// niemand kon dat zien.
//
//  1. De foutmelding van de chat ging naar de melding-regel van de FASE-lijst.
//     Een kaart zonder pagina heeft geen fase-lijst, dus die regel werd nooit
//     getekend. De reden bestond wel, alleen niet in beeld.
//  2. De vraag zelf was weg. Het invulveld werd leeggemaakt vóór het versturen en
//     nooit teruggezet, dus opnieuw proberen betekende overtypen of plakken.
//     Daar komen de twee identieke vragen vandaan.
//  3. Loopt zo'n zware vraag over de tijdslimiet van het platform, dan komt er
//     een foutpagina terug in plaats van JSON. Het dashboard klapte daar stil op
//     stuk. Nu kappen we zelf af, ruim binnen die limiet, met een leesbare reden.
//
// Deze proef legt die drie vast, want ze zijn alle drie onzichtbaar als ze
// terugkomen: je merkt het pas als iemand een vraag stelt die toevallig lang duurt.

import fs from "fs";
import path from "path";
import { CHAT_AFKAP_MS, CHAT_AFKAP_TEKST, metAfkap } from "../lib/afkap";

let fouten = 0;
function check(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

const WORTEL = path.join(__dirname, "..");
const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");

// ── 1. De melding staat in de chat, niet in de fase-lijst ──
console.log("\n── De reden staat waar de vraag staat ──");

const kaart = lees("app/admin/client/[slug]/WeekplanCard.tsx");

const naBody = kaart.indexOf("wp-chat-body");
const naFout = kaart.indexOf("wp-chat-fout");
const naInput = kaart.indexOf("wp-chat-input");
check("de kaart heeft een eigen foutmelding voor de chat", kaart.includes("chatFout"),
  "Zonder eigen melding valt een mislukte vraag terug op de fase-melding, en die bestaat niet op een kaart zonder pagina.");
check("die melding staat binnen het chatvenster", naBody > 0 && naFout > naBody && naFout < naInput,
  "wp-chat-fout hoort tussen wp-chat-body en wp-chat-input te staan, dus onder de vraag die niet lukte.");

// De chat-verzendfunctie mag zijn fout niet meer in `foutje` zetten: dat is de
// melding van de fase-lijst, en die staat op een heel andere plek in beeld.
const sendStart = kaart.indexOf("async function sendChat()");
const sendEind = kaart.indexOf("async function verwijderChatBericht");
const sendChat = sendStart > 0 && sendEind > sendStart ? kaart.slice(sendStart, sendEind) : "";
check("sendChat is gevonden", !!sendChat);
check("sendChat meldt niet meer via de fase-melding", !!sendChat && !sendChat.includes("setFoutje("),
  "setFoutje tekent in het fase-blok; dat blok bestaat niet op een kaart zonder pagina.");

// ── 2. De vraag gaat niet verloren ──
console.log("\n── De vraag blijft van jou ──");
check("een mislukte vraag komt terug in het invulveld", !!sendChat && /setInput\(tekst\)/.test(sendChat),
  "Anders moet je hem overtypen of opnieuw plakken, en dan staat dezelfde vraag twee keer in beeld.");
check("en de losse vraagballon verdwijnt weer", !!sendChat && /setMsgs\(voorheen\)/.test(sendChat),
  "Een vraag zonder antwoord die blijft staan, leest als 'hij is verstuurd en genegeerd'.");
check("er is een knop om het opnieuw te proberen", kaart.includes("Probeer opnieuw"));

// ── 3. Wij kappen af, niet het platform ──
console.log("\n── Er komt altijd een leesbaar antwoord terug ──");

for (const route of ["app/api/admin/chat/route.ts", "app/api/admin/page-chat/route.ts"]) {
  const inhoud = lees(route);
  const max = Number(/maxDuration\s*=\s*(\d+)/.exec(inhoud)?.[1] || 0);
  check(`${route}: kapt zelf af`, inhoud.includes("metAfkap"),
    "Zonder eigen afkapping stuurt het platform een foutpagina, en daar kan de browser geen reden uit halen.");
  check(`${route}: de afkap ligt vóór de tijdslimiet van het platform`, max > 0 && CHAT_AFKAP_MS < max * 1000,
    `maxDuration is ${max}s, de afkap staat op ${Math.round(CHAT_AFKAP_MS / 1000)}s.`);
}

check("de afkap laat genoeg lucht om het antwoord nog te versturen", 300_000 - CHAT_AFKAP_MS >= 10_000,
  "Te dicht op de limiet en het platform is je alsnog voor.");
check("de reden is in gewone taal en zegt wat je kunt doen",
  CHAT_AFKAP_TEKST.length > 80 && /splits|gerichter/i.test(CHAT_AFKAP_TEKST));

// ── 4. De extra rondes beginnen alleen als er tijd voor is ──
console.log("\n── Geen extra ronde zonder tijd ──");

const chatLib = lees("lib/chat.ts");
check("er is één klok die de extra rondes tegenhoudt", chatLib.includes("ruimteVoorRonde"),
  "Afronden, uitschrijven en feitencontrole zijn elk een model-aanroep van tientallen seconden.");
const bewaakt = (chatLib.match(/ruimteVoorRonde\(/g) || []).length;
// Drie rondes kunnen ná het hoofdantwoord nog een model-aanroep doen: alsnog
// uitschrijven, alsnog afronden, en de herstelronde van de feitencontrole.
check("en die klok staat vóór elke extra ronde", bewaakt >= 3,
  `Gevonden: ${bewaakt} bewaakte rondes, verwacht minstens 3.`);
// De waarschuwingsregel is rekenwerk, geen model-aanroep. Die moet blijven staan
// ook als er geen tijd meer is om het antwoord over te doen, anders lijkt een
// ongecontroleerd cijfer alsnog betrouwbaar.
check("de waarschuwing 'niet bevestigd' hangt niet aan de herstelronde",
  chatLib.includes("Let op, niet bevestigd") && /if \(!controle\.ok\) \{\s*\n\s*if \(ruimteVoorRonde/.test(chatLib),
  "De controle zelf kost geen tijd; alleen het overdoen wel.");

// ── 5. metAfkap doet wat hij belooft ──
async function afkapperZelf() {
  console.log("\n── De afkapper zelf ──");
  const traag = new Promise<string>((r) => setTimeout(() => r("te laat"), 300));
  const snel = Promise.resolve("op tijd");
  check("werk dat binnen de tijd klaar is, komt gewoon door", (await metAfkap(snel, 50, "afgekapt")) === "op tijd");
  check("werk dat te lang duurt, geeft de afkap-waarde", (await metAfkap(traag, 30, "afgekapt")) === "afgekapt");
}

void afkapperZelf().then(() => {
  console.log(`\n${fouten === 0 ? "Alles goed." : `${fouten} fout(en).`}`);
  if (fouten > 0) process.exit(1);
});
