// ═══════════════════════════════════════════════════════════
// DE CLAUDE-GEBRUIKSAANWIJZING MOET BLIJVEN GROEIEN ZONDER TE BOTSEN
// ═══════════════════════════════════════════════════════════
// De tips op /admin/claude-werkwijze stonden in de pagina zelf. Dat werkt tot
// het moment dat twee chats op dezelfde dag allebei een tip toevoegen: dan
// schrijven ze in hetzelfde bestand en botst het, in tekst die niets met elkaar
// te maken heeft. Precies de fout die lib/uitleg.ts en LAATST_BIJGEWERKT eerder
// maakten, en die daar met dezelfde maatregel is opgelost: één bestand per
// onderwerp, en een index die alleen de volgorde bevat.
//
// Deze proef bewaakt dat het zo blijft, plus twee dingen die stilletjes
// misgaan: een hoofdstuk dat losraakt van de index (dan verdwijnt het van de
// pagina zonder foutmelding), en een tip die naar een scherm wijst dat niet
// bestaat (dan stuurt de gebruiksaanwijzing je naar een 404).

import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HOOFDSTUKKEN, anker } from "../lib/claude-tips";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

const wortel = join(__dirname, "..");
const map = join(wortel, "lib", "claude-tips");
const bestanden = readdirSync(map).filter((n) => /^\d\d-.*\.ts$/.test(n));

proef("er staan hoofdstukken in lib/claude-tips", bestanden.length > 0);
proef(
  "elk hoofdstukbestand hangt aan de index",
  bestanden.length === HOOFDSTUKKEN.length,
  `${bestanden.length} bestand(en), ${HOOFDSTUKKEN.length} in de index. Een hoofdstuk dat niet in\n` +
    "     | lib/claude-tips/index.ts staat, verdwijnt stilletjes van de pagina.",
);

// De maatregel zelf: één bestand blijft klein genoeg om van één onderwerp te zijn.
const teGroot = bestanden.filter((n) => readFileSync(join(map, n), "utf8").split("\n").length > 250);
proef(
  "geen hoofdstuk is uitgegroeid tot een verzamelbak",
  teGroot.length === 0,
  teGroot.length
    ? `${teGroot.join(", ")} is boven de 250 regels. Verhoog die grens niet: splits het hoofdstuk,\n` +
      "     | precies zoals lib/uitleg/ dat doet. Een groot gedeeld bestand is waar het botsen begint."
    : "",
);

proef("elk hoofdstuk heeft een titel en zegt waarvoor het is",
  HOOFDSTUKKEN.every((h) => h.titel.trim() && h.waarvoor.trim().length > 20));
proef("elk hoofdstuk heeft minstens één tip", HOOFDSTUKKEN.every((h) => h.tips.length > 0));

const tips = HOOFDSTUKKEN.flatMap((h) => h.tips);
proef("elke tip heeft een korte titel en echte tekst",
  tips.every((t) => t.titel.trim().length > 3 && t.tekst.trim().length > 40));

// Twee hoofdstukken met dezelfde titel geven hetzelfde anker, en dan springt het
// snelmenu naar het verkeerde blok.
const ankers = HOOFDSTUKKEN.map((h) => anker(h.titel));
proef("elk hoofdstuk heeft een eigen anker voor het snelmenu",
  new Set(ankers).size === ankers.length && ankers.every(Boolean));

const dubbel = tips.map((t) => t.titel).filter((t, i, l) => l.indexOf(t) !== i);
proef("geen twee tips met dezelfde titel", dubbel.length === 0,
  dubbel.length ? `Dubbel: ${[...new Set(dubbel)].join(", ")}. Vul de bestaande tip aan in plaats van er een tweede te maken.` : "");

// Een tip die naar een scherm verwijst, moet naar een scherm verwijzen dat bestaat.
const kapot = tips
  .map((t) => t.waar)
  .filter((w): w is string => Boolean(w && w.startsWith("/")))
  .filter((w) => {
    const deel = w.replace(/^\//, "").split("/");
    return !existsSync(join(wortel, "app", ...deel, "page.tsx"));
  });
proef(
  "elk scherm waar een tip naar wijst bestaat ook echt",
  kapot.length === 0,
  kapot.length ? `Deze verwijzingen lopen dood: ${[...new Set(kapot)].join(", ")}` : "",
);

console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef(en) mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
