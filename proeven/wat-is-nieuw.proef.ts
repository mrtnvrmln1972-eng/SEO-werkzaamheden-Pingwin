// ═══════════════════════════════════════════════════════════
// DE VORM VAN WAT-IS-NIEUW MOET BOTSVRIJ BLIJVEN
// ═══════════════════════════════════════════════════════════
// lib/wat-is-nieuw.ts staat in .gitattributes op `merge=union`: botsen twee
// chats op dezelfde plek, dan houdt git beide regels in plaats van er een
// conflict van te maken. Dat werkt alleen zolang élke wijziging precies één
// regel is die op zichzelf klopt. Verdeelt iemand een lange tekst over twee
// regels, dan kan een union-merge daar iets kapots van maken, en dan is de
// oplossing van 11 augustus 2026 stilletjes weer weg.
//
// Deze proef bewaakt dus de vorm, niet de inhoud.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WAT_IS_NIEUW, nieuwtjes, leesbareDatum } from "../lib/wat-is-nieuw";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

const bron = readFileSync(join(__dirname, "..", "lib", "wat-is-nieuw.ts"), "utf8").split("\n");
const start = bron.findIndex((r) => r.includes("WAT_IS_NIEUW: Nieuwtje[] = ["));
const eind = bron.findIndex((r, i) => i > start && r.trim() === "];");
const regels = bron.slice(start + 1, eind).filter((r) => r.trim());

proef("de lijst is gevonden", start > 0 && eind > start);
proef("er staat minstens één regel in", regels.length > 0);

// De kern: elke wijziging is één regel, van accolade tot accolade.
const stuk = regels.filter((r) => !/^\s*\{ datum: "\d{4}-\d{2}-\d{2}", tekst: ".*" \},\s*$/.test(r));
proef(
  `elke wijziging staat op één eigen regel (${regels.length} regels)`,
  stuk.length === 0,
  stuk.length ? `Deze regel(s) hebben niet de vaste vorm { datum: "JJJJ-MM-DD", tekst: "..." },\n     | ${stuk[0].trim().slice(0, 90)}\n     | Zonder die vorm kan een samenvoeging uit twee chats er iets kapots van maken.` : "",
);

proef("elke datum is te lezen", WAT_IS_NIEUW.every((n) => !!leesbareDatum(n.datum)));
proef("elke tekst is geschreven taal, geen los woord", WAT_IS_NIEUW.every((n) => n.tekst.trim().length > 20));
proef("nieuwste staat vooraan, ook na een samenvoeging", (() => {
  const g = nieuwtjes();
  return g.every((n, i) => i === 0 || g[i - 1].datum >= n.datum);
})());

console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef(en) mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
