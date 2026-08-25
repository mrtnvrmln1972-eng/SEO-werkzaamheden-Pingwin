// ═══════════════════════════════════════════════════════════
// EEN VRAAG RAAK JE NOOIT MEER KWIJT, EN JE ZIET DAT ER IETS LOOPT
// ═══════════════════════════════════════════════════════════
// Op 25 augustus 2026 stelde Maarten een uitgewerkte vraag in een gesprek, sloot
// het tabblad, en opende het later opnieuw. Er stond niets. Zijn woorden: "dat
// was een hele uitgebreide analyse, daar heb ik net mijn best op gedaan qua
// instructie. Draait hij nog in de achtergrond of wat? Want ik zie hem niet
// meer."
//
// Het antwoord kwam gewoon binnen: het gesprek draait op de server, en een
// gesloten tabblad breekt daar niets af. Maar dat was nergens aan te zien, en
// twee dingen klopten echt niet:
//
//   1. De vraag werd pas SAMEN met het antwoord opgeslagen. Sneuvelde het
//      antwoord (een tijdslimiet, een deploy die de functie omhakt, een fout
//      onderweg), dan was de vraag ook weg. Een uitgewerkte instructie is werk,
//      en werk hoort niet aan een geslaagd antwoord te hangen.
//   2. Tussen versturen en antwoord stond er niets in de database, dus een
//      heropend gesprek was niet te onderscheiden van een mislukt gesprek. Je
//      moest afwachten en gokken.
//
// Deze proef bewaakt allebei. Gaat hij stuk, dan is een lange vraag weer iets
// wat je kwijt kunt raken zonder dat je het merkt.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BEZIG_GELDIG_MS, bezigStand } from "../lib/chat-stand";
import { gesprekBezig, NIET_BEZIG } from "../lib/chat-datum";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

const lees = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// ── 1. De vraag gaat er meteen in ───────────────────────────────────────────
{
  const chat = lees("lib/chat.ts");
  proef("er is een aparte functie die alleen de vraag bewaart",
    /export async function bewaarVraag\(/.test(chat),
    "Zonder die functie hangt de vraag weer aan het antwoord.");
  proef("answerChat bewaart de vraag vóór het antwoorden begint",
    /await bewaarVraag\(slug, thread, messages\)/.test(chat),
    "Roep bewaarVraag aan bovenaan answerChat, niet ergens onderweg.");

  // De volgorde is het hele punt: staat de aanroep ná het antwoord, dan is er
  // niets veranderd. Meten door te kijken wat er eerder in het bestand staat.
  const start = chat.indexOf("export async function answerChat(");
  const bewaar = chat.indexOf("await bewaarVraag(", start);
  const model = chat.indexOf("callClaude", start);
  proef("en dat gebeurt écht vóór de eerste vraag aan het model",
    bewaar > start && (model === -1 || bewaar < model),
    `answerChat op ${start}, bewaarVraag op ${bewaar}, callClaude op ${model}`);

  proef("het opslaan van de vraag mag het antwoorden nooit tegenhouden",
    /await bewaarVraag\([^)]*\)\.catch\(/.test(chat),
    "Hikt de database, dan liever een antwoord zonder merkteken dan geen antwoord.");

  proef("het merkteken wordt weggehaald zodra het antwoord is opgeslagen",
    /bezig_sinds = NULL/.test(chat),
    "Anders blijft een afgerond gesprek 'bezig' zeggen.");

  const db = lees("lib/db.ts");
  proef("de kolom bestaat en wordt vanzelf aangemaakt",
    /ADD COLUMN IF NOT EXISTS bezig_sinds/.test(db),
    "Zonder deze regel valt de chat om op een database die de kolom nog niet heeft.");
}

// ── 2. Een tijdslimiet is geen einde ────────────────────────────────────────
// Bij een tijdslimiet krijgt de browser een melding, maar draait het werk op de
// server door en kan het antwoord alsnog landen (zie lib/afkap.ts). Dan hoort
// "bezig" te blijven staan. Bij elke andere fout komt er niets meer.
{
  const route = lees("app/api/admin/chat/route.ts");
  proef("een echte fout haalt het merkteken weg",
    /wisBezig\(slug, thread\)/.test(route));
  proef("maar een tijdslimiet juist niet",
    /result\.error !== CHAT_AFKAP_TEKST/.test(route),
    "Bij afkap draait het werk door; dan is 'bezig' nog waar.");
  proef("het scherm krijgt te horen of er iets loopt",
    /bezigSinds/.test(route),
    "Zonder dit veld kan het scherm het nooit tonen.");
}

// ── 3. "Bezig" mag nooit voor eeuwig blijven staan ──────────────────────────
// De functie stopt sowieso na 300 seconden. Wat daarna nog op "bezig" staat is
// nooit afgemaakt. Zonder die grens zou een omgehakte functie een gesprek voor
// altijd op "bezig sinds vanochtend" zetten, en dan is het merkteken niets meer
// waard. Dit vervangt een opruim-cron: de waarheid wordt bij het lezen bepaald.
{
  const nu = Date.parse("2026-08-25T12:00:00.000Z");
  const geleden = (ms: number) => new Date(nu - ms).toISOString();

  proef("niets ingevuld is niet bezig", bezigStand("", nu) === "nee");
  proef("onzin is niet bezig", bezigStand("zomaar wat", nu) === "nee");
  proef("net gesteld is bezig", bezigStand(geleden(5000), nu) === "bezig");
  proef("vier minuten oud is nog steeds bezig", bezigStand(geleden(4 * 60 * 1000), nu) === "bezig");
  proef("een uur oud is afgebroken", bezigStand(geleden(60 * 60 * 1000), nu) === "afgebroken");
  proef("de grens ligt ruim boven de tijdslimiet van de functie",
    BEZIG_GELDIG_MS > 300 * 1000,
    `De functie mag 300 seconden draaien; de grens staat op ${Math.round(BEZIG_GELDIG_MS / 1000)}.`);
}

// ── 4. De tekst op het scherm ───────────────────────────────────────────────
{
  const nu = new Date("2026-08-25T09:24:00.000Z").toISOString();
  const bezig = gesprekBezig(nu, "bezig");
  proef("er staat sinds hoe laat er iets loopt", /^bezig sinds \d{2}:\d{2}$/.test(bezig.label), bezig.label);
  proef("de uitleg zegt dat je het scherm gerust mag sluiten",
    /sluiten/.test(bezig.titel), bezig.titel);
  proef("en dat is geen afgebroken stand", bezig.afgebroken === false);

  const stuk = gesprekBezig(nu, "afgebroken");
  proef("een afgebroken antwoord zegt dat ook", stuk.label === "niet afgemaakt", stuk.label);
  proef("en meldt dat de vraag bewaard is gebleven",
    /bewaard/.test(stuk.titel), stuk.titel);
  proef("dat is de stille vorm", stuk.afgebroken === true);

  proef("loopt er niets, dan staat er niets", gesprekBezig(nu, "nee").label === "");
  proef("zonder tijdstip ook niet", gesprekBezig("", "bezig") === NIET_BEZIG);
}

// ── 5. Eén regel, niet twee ─────────────────────────────────────────────────
// Precies de vaste les van dit project: dezelfde regel op twee plekken loopt uit
// elkaar zonder dat iemand het merkt. De grens staat daarom in lib/chat-stand.ts
// (zonder imports, dus bruikbaar in de browser én op de server) en de opmaak
// staat één keer in globals.css.
{
  const chat = lees("lib/chat.ts");
  proef("de grens staat niet óók nog in lib/chat.ts",
    !/BEZIG_GELDIG_MS\s*=/.test(chat),
    "Die hoort alleen in lib/chat-stand.ts te staan.");

  const css = lees("app/globals.css");
  const aantal = (css.match(/^\.gesprek-bezig\s*\{/gm) || []).length;
  proef("er is precies één opmaakregel voor het merkteken", aantal === 1, `gevonden: ${aantal}`);

  for (const bestand of ["app/admin/client/[slug]/OverviewChat.tsx", "app/admin/client/[slug]/ChatPanel.tsx"]) {
    const src = lees(bestand);
    proef(`${bestand.split("/").pop()} toont het merkteken`,
      /gesprek-bezig/.test(src) && /gesprekBezig\(/.test(src),
      "Beide vensters kijken naar hetzelfde gesprek; dan horen ze het ook allebei te tonen.");
  }

  const ovc = lees("app/admin/client/[slug]/OverviewChat.tsx");
  proef("het Chats-blok kijkt zelf of het antwoord er al staat",
    /erLooptIets/.test(ovc) && /setInterval\(/.test(ovc),
    "Anders moet je nog steeds zelf herladen om te zien of het klaar is.");
  proef("en het kijkt alleen zolang er echt iets loopt",
    /if \(!erLooptIets\) return;/.test(ovc),
    "Een gesprek waar niets loopt hoort niets te kosten.");
}

console.log(fouten === 0 ? "\nAlles goed." : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
