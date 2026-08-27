// ═══════════════════════════════════════════════════════════
// DE MEEKIJK-LINK OPENT DE DEUR, EN NIETS ANDERS
// ═══════════════════════════════════════════════════════════
// Gebouwd op 26-08-2026, nadat bleek dat Cowork in een vaste omgeving van
// Anthropic draait en daar géén omgevingsvariabele te zetten is. Een sleutel in
// een env-var helpt die kant dus niet; een link wel.
//
// Wat deze proef bewaakt, is precies wat er mis kan gaan bij zoiets:
//  - hij deelt niets nieuws uit: dezelfde controle als /api/kijk, alleen-lezen,
//    in te trekken met dezelfde knop;
//  - hij stuurt je nooit door naar een adres buiten dit dashboard (een open
//    doorstuur maakt van deze link een springplank);
//  - een afwijzing zegt wat er mis is in plaats van je naar de inlogpagina te
//    gooien, want dan zoek je bij jezelf terwijl de link het probleem is;
//  - de sleutel blijft niet in de adresbalk staan.
// ═══════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { join } from "node:path";

let fout = 0;
const meld = (goed: boolean, wat: string, uitleg = "") => {
  console.log(`${goed ? "OK  " : "FOUT"} | ${wat}`);
  if (!goed) { fout++; if (uitleg) console.log(`     | ${uitleg}`); }
};

const wortel = join(__dirname, "..");
const lees = (...p: string[]) => readFileSync(join(wortel, ...p), "utf8");
const route = lees("app", "kijk", "route.ts");

meld(/checkViewKey\(/.test(route), "de link gebruikt dezelfde controle als /api/kijk",
  "Nooit een tweede controle ernaast schrijven; dan lopen ze uit elkaar.");
meld(/makeViewerSession\(/.test(route), "hij deelt een alleen-lezen sessie uit, geen adminsessie",
  "makeViewerSession is de enige sessie die deze link mag geven.");
meld(!/makeAdminSession|makeOwnerSession/.test(route), "en nooit een volledige sessie");
meld(/startsWith\("\/"\)/.test(route) && /startsWith\("\/\/"\)/.test(route),
  "doorsturen kan alleen naar een pad binnen dit dashboard",
  "Zonder die twee controles is dit een open doorstuur naar elk adres ter wereld.");
meld(/NextResponse\.redirect/.test(route), "na binnenkomst word je doorgestuurd",
  "Anders sta je op een blokje tekst in plaats van in het dashboard, en blijft de sleutel in de adresbalk staan.");
meld(/status: 401/.test(route) && /uitleg\[uitkomst\.reden\]/.test(route),
  "een geweigerde link zegt zelf wat er mis is");
meld(/Referrer-Policy/.test(route), "de sleutel lekt niet mee naar de volgende pagina");

// Het scherm: de link staat er, en de waarschuwing erbij.
const knop = lees("app", "admin", "KijkSleutel.tsx");
meld(/\/kijk\?sleutel=/.test(knop), "de cockpit toont de meekijk-link");
meld(/window\.location\.origin/.test(knop), "de link wijst naar de omgeving waar je zelf staat",
  "Blind naar productie wijzen geeft op een voorbeeldomgeving een link die daar niets doet.");
meld(/Alleen lezen/.test(knop) && /Intrekken/.test(knop),
  "en zegt erbij wat je uitdeelt en hoe je het weer dichtzet");

console.log(fout === 0 ? "\nAlles goed.\n" : `\n${fout} fout(en).\n`);
if (fout) process.exit(1);

export {};
