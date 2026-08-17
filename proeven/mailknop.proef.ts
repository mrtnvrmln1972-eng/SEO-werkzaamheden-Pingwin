// ═══════════════════════════════════════════════════════════
// PROEF: GEEN MAILKNOP DIE STILZWIJGEND NIETS DOET
// ═══════════════════════════════════════════════════════════
// Aanleiding: de mailknop in de developerlijst "werkte niet meer". Er was
// niets aan die knop veranderd. Hij gooide de browser rechtstreeks naar een
// `mailto:`-adres, en dat werkt alleen zolang er in díe browser een
// mailprogramma aan `mailto:` hangt. Valt dat weg, dan gebeurt er letterlijk
// niets: geen venster, geen melding, geen fout. Je klikt, en je concludeert dat
// het dashboard stuk is.
//
// Dezelfde constructie stond op drie plekken apart uitgeschreven, dus dezelfde
// storing lag er drie keer klaar. Ze lopen nu allemaal via
// `lib/mailto-openen.ts`, dat een echt <a>-element aanklikt (geen leeg tabblad)
// en `false` teruggeeft als er geen ontvanger is, zodat de knop dát kan melden.
//
// Deze proef houdt dat zo. Hij wordt rood zodra er ergens weer een mailknop
// bijkomt die rechtstreeks navigeert:
//
//   window.location.href = "mailto:..."
//   window.open("mailto:...")
//
// Vaste les uit CLAUDE.md: dezelfde regel op meerdere plekken apart
// uitschrijven loopt uit elkaar zonder dat iemand het merkt. Eén bron, en een
// proef die bewaakt dat het één bron blijft.
// ═══════════════════════════════════════════════════════════

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const WORTELS = ["app", "lib"];
const TOEGESTAAN = new Set(["lib/mailto-openen.ts"]);

function bestanden(map: string, uit: string[] = []): string[] {
  for (const naam of readdirSync(map)) {
    if (naam === "node_modules" || naam.startsWith(".")) continue;
    const pad = join(map, naam);
    if (statSync(pad).isDirectory()) bestanden(pad, uit);
    else if (/\.(ts|tsx)$/.test(naam)) uit.push(pad);
  }
  return uit;
}

// `window.location.href = ...mailto:` en `window.open(...mailto:` op één regel.
const NAVIGEERT = /window\s*\.\s*location\s*(?:\.\s*href\s*=|\.\s*assign\s*\(|\.\s*replace\s*\()[^\n]*mailto:/;
const OPENT = /window\s*\.\s*open\s*\([^\n]*mailto:/;

let fouten = 0;
for (const wortel of WORTELS) {
  for (const pad of bestanden(wortel)) {
    if (TOEGESTAAN.has(pad.split("\\").join("/"))) continue;
    const regels = readFileSync(pad, "utf8").split("\n");
    regels.forEach((regel, i) => {
      // Commentaar mag de patronen noemen; het gaat om echte code.
      const kaal = regel.trim();
      if (kaal.startsWith("//") || kaal.startsWith("*")) return;
      if (NAVIGEERT.test(regel) || OPENT.test(regel)) {
        fouten++;
        console.log(`FOUT | ${pad}:${i + 1} opent mailto: rechtstreeks`);
        console.log(`       ${kaal.slice(0, 120)}`);
        console.log("       Gebruik openMailProgramma() uit lib/mailto-openen.ts, of MailPopup.");
      }
    });
  }
}

if (fouten === 0) console.log("OK   | geen enkele mailknop navigeert rechtstreeks naar mailto:");

// De helper zelf moet blijven doen waar hij voor is: een <a> aanklikken en
// melden dat er geen ontvanger was.
const helper = readFileSync("lib/mailto-openen.ts", "utf8");
function check(naam: string, waar: boolean) {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}`);
}
check("helper maakt een echt <a>-element aan", /createElement\(\s*["']a["']\s*\)/.test(helper));
check("helper klikt dat element aan", /\.click\(\)/.test(helper));
check("helper ruimt het element weer op", /\.remove\(\)/.test(helper));
// Zonder ontvanger nog steeds false, zodat een knop mét adresveld in beeld een
// melding toont in plaats van te doen alsof er iets gebeurde. Sinds 17-08-2026
// is er één uitzondering die de aanroeper expliciet moet vragen
// (ontvangerLeegMag): knoppen die vroeger een onthouden adres invulden openen nu
// een leeg mailvenster, want het dashboard hoort nooit te gokken naar wie een
// mail gaat. Zie de ADRESVELD-REGEL in app/admin/client/[slug]/MailUitKaart.tsx.
check("helper geeft false terug zonder ontvanger", /if\s*\(\s*!aan\s*(&&\s*!opts\.ontvangerLeegMag\s*)?\)\s*return\s+false/.test(helper));

if (fouten > 0) {
  console.log(`\n${fouten} keer mis.`);
  process.exit(1);
}
console.log("\nAlles goed.");
