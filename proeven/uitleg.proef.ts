// ═══════════════════════════════════════════════════════════
// DE UITLEG BLIJFT OPGEKNIPT, EN NIETS VALT ERBUITEN
// ═══════════════════════════════════════════════════════════
// De uitleg stond tot 11-08-2026 als 2.629 regels in één `lib/uitleg.ts`. Elke
// chat die iets opleverde moest daar in schrijven, dus twee chats op één dag
// botsten altijd, in tekst die niets met elkaar te maken had. Nu is het één
// bestand per hoofdstuk in `lib/uitleg/`, en twee grote hoofdstukken hebben een
// eigen map met een bestand per onderwerp.
//
// Zonder poort groeit dat binnen een paar maanden terug naar één monster: er is
// altijd een sessie die "even" een hoofdstuk laat uitdijen in plaats van het te
// splitsen. Deze proef bewaakt daarom drie dingen:
//
//  1. Geen bestand in de map wordt langer dan de maat. Word je hier rood, dan
//     is het antwoord niet "de maat omhoog" maar: splits het hoofdstuk in een
//     eigen map met een bestand per onderwerp (zie 04-motoren/ en 15-agenda/).
//  2. Elk hoofdstukbestand hangt in de index, en de index verwijst nergens naar
//     iets dat niet bestaat. Een hoofdstuk dat er wél staat maar nergens aan
//     hangt is onzichtbaar op /uitleg zonder dat iemand het merkt.
//  3. De inhoud zelf klopt: unieke ids, geen lege tekst, en elke leesroute
//     wijst naar hoofdstukken die er echt zijn.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { HOOFDSTUKKEN, LEESROUTES, zichtbareHoofdstukken, type Uitklapper } from "../lib/uitleg";

const MAP = join(__dirname, "..", "lib", "uitleg");
const MAX_REGELS = 250;

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

// ── Alle .ts-bestanden in lib/uitleg/, één en twee niveaus diep ──
function bestanden(map: string, prefix = ""): string[] {
  return readdirSync(map).flatMap((naam) => {
    const pad = join(map, naam);
    if (statSync(pad).isDirectory()) return bestanden(pad, `${prefix}${naam}/`);
    return naam.endsWith(".ts") ? [`${prefix}${naam}`] : [];
  });
}

const alle = bestanden(MAP);
proef("de map lib/uitleg/ bestaat en heeft bestanden", alle.length > 5);

// ── 1. Niets groeit terug naar één monster ─────────────────
const teLang = alle
  .map((b) => ({ b, regels: readFileSync(join(MAP, b), "utf8").split("\n").length }))
  .filter((x) => x.regels > MAX_REGELS);
proef(
  `geen bestand langer dan ${MAX_REGELS} regels (${alle.length} bestanden)`,
  teLang.length === 0,
  teLang.length
    ? `Te lang: ${teLang.map((x) => `${x.b} (${x.regels})`).join(", ")}\n` +
      `     | Niet de maat verhogen: geef dit hoofdstuk een eigen map met een bestand per\n` +
      `     | onderwerp, zoals lib/uitleg/04-motoren/ en lib/uitleg/15-agenda/.`
    : "",
);

// ── 2. Elk hoofdstukbestand hangt in de index ──────────────
const index = readFileSync(join(MAP, "index.ts"), "utf8");
// Hoofdstukken zijn de bestanden op het eerste niveau (01-… tot 16-…) plus de
// mappen met een eigen index. De onderdelen daarbinnen hangen aan hun eigen index.
const hoofdstukbestanden = alle.filter((b) => /^\d\d-[a-z0-9-]+(\.ts|\/index\.ts)$/.test(b));
const losgeraakt = hoofdstukbestanden.filter((b) => {
  const naam = b.replace(/\/index\.ts$/, "").replace(/\.ts$/, "");
  return !index.includes(`from "./${naam}"`);
});
proef(
  `elk hoofdstuk hangt in de index (${hoofdstukbestanden.length} hoofdstukken)`,
  losgeraakt.length === 0,
  losgeraakt.length ? `Niet geïmporteerd in lib/uitleg/index.ts: ${losgeraakt.join(", ")}` : "",
);
proef(
  "de index toont evenveel hoofdstukken als er bestanden zijn",
  HOOFDSTUKKEN.length === hoofdstukbestanden.length,
  `HOOFDSTUKKEN heeft er ${HOOFDSTUKKEN.length}, de map heeft er ${hoofdstukbestanden.length}. ` +
    `Een geïmporteerd hoofdstuk dat niet in de lijst staat, staat niet op /uitleg.`,
);

// Onderdelen in een hoofdstukmap moeten BEREIKBAAR zijn vanaf de index van díe
// map. Dat was eerst "rechtstreeks geïmporteerd door de index", en dat is één slag
// te streng: een onderdeel dat te groot werd en in tweeën ging (opruimen.ts plus
// opruimen-veiligheid.ts) hangt dan aan zijn buurman in plaats van aan de index,
// en stond hier ten onrechte als losgeraakt. Waar het om gaat is dat een stuk
// tekst niet stilletjes van de pagina kan verdwijnen, en dat kan niet zolang er
// een keten van imports vanaf de index naartoe loopt. Die keten volgen we dus.
for (const submap of alle.filter((b) => b.endsWith("/index.ts")).map((b) => b.replace("/index.ts", ""))) {
  const delen = alle
    .filter((b) => b.startsWith(`${submap}/`) && !b.endsWith("/index.ts"))
    .map((b) => b.slice(submap.length + 1).replace(/\.ts$/, ""));

  const bereikbaar = new Set<string>();
  const teLezen = ["index"];
  while (teLezen.length) {
    const nu = teLezen.pop()!;
    const inhoud = readFileSync(join(MAP, submap, `${nu}.ts`), "utf8");
    for (const d of delen) {
      if (bereikbaar.has(d)) continue;
      if (inhoud.includes(`from "./${d}"`)) { bereikbaar.add(d); teLezen.push(d); }
    }
  }

  const kwijt = delen.filter((d) => !bereikbaar.has(d));
  proef(
    `elk onderdeel van ${submap}/ is bereikbaar vanaf zijn eigen index (${delen.length} onderdelen)`,
    kwijt.length === 0,
    kwijt.length
      ? `Niet bereikbaar vanaf ${submap}/index.ts: ${kwijt.join(", ")}. ` +
        `Zo'n bestand staat niet op /uitleg, hoe goed de tekst ook is.`
      : "",
  );
}

// ── 3. De inhoud zelf klopt ────────────────────────────────
const ids = HOOFDSTUKKEN.map((h) => h.id);
const dubbel = ids.filter((id, i) => ids.indexOf(id) !== i);
proef("elk hoofdstuk heeft een eigen id", dubbel.length === 0, dubbel.length ? `Dubbel: ${dubbel.join(", ")}` : "");

proef("elk hoofdstuk heeft een titel, een intro en uitklappers", HOOFDSTUKKEN.every(
  (h) => h.titel.trim() && h.intro.trim().length > 20 && h.uitklappers.length > 0,
));

function plat(lijst: Uitklapper[]): Uitklapper[] {
  return lijst.flatMap((u) => [u, ...(u.sub ? plat(u.sub) : [])]);
}
const alleBlokken = HOOFDSTUKKEN.flatMap((h) => plat(h.uitklappers));
const leeg = alleBlokken.filter((u) => !u.titel.trim() || u.tekst.trim().length < 20);
proef(
  `elke uitklapper heeft een titel en echte tekst (${alleBlokken.length} uitklappers)`,
  leeg.length === 0,
  leeg.length ? `Leeg of te kort: ${leeg.map((u) => u.titel || "(zonder titel)").join(", ")}` : "",
);

const zoek = LEESROUTES.flatMap((r) => r.hoofdstukken).filter((id) => !ids.includes(id));
proef(
  "elke leesroute wijst naar bestaande hoofdstukken",
  zoek.length === 0,
  zoek.length ? `Onbekend hoofdstuk in LEESROUTES: ${zoek.join(", ")}` : "",
);

// Het interne hoofdstuk mag nooit per ongeluk openbaar worden: daar staan de
// gaten en de risico's, en de link naar /uitleg gaat naar klanten en leads.
const openbaar = zichtbareHoofdstukken(false).map((h) => h.id);
proef(
  "interne hoofdstukken blijven achter de beheerderslogin",
  HOOFDSTUKKEN.filter((h) => h.intern).every((h) => !openbaar.includes(h.id)),
);
proef("er is minstens één intern hoofdstuk (de eerlijke agenda)", HOOFDSTUKKEN.some((h) => h.intern));

console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef(en) mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
