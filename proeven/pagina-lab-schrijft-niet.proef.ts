// ═══════════════════════════════════════════════════════════
// HET PAGINA-LAB LEEST MEE EN SCHRIJFT NIETS
// ═══════════════════════════════════════════════════════════
// Het Pagina-lab is een eigen tak: pagina's beoordelen op conversie,
// bruikbaarheid, vormgeving en interactie, naast de SEO die er al is. Het groeit
// apart tot het af genoeg is om ingepast te worden, en de belofte daarbij is
// dat het lopende SEO-werk er niet door kan breken.
//
// Die belofte is een controle, geen afspraak. Dat is binnen dit project de vaste
// les: een regel die alleen in een document leeft, wordt gebroken zodra iemand
// haast heeft. Zie de opmaakregels, de knopconventie en de proeven-poort, alle
// drie pas echt geland toen er iets rood van werd.
//
// Wat hier rood van wordt: iets in `lib/pagina-lab/` of in
// `app/api/admin/pagina-lab/` dat naar de database schrijft, of dat een taak,
// een werklijst of een fase aanraakt. Lezen mag alles. Zodra Maarten zegt dat
// het lab naar binnen mag, gaat deze proef weg of wordt hij versmald; tot die
// tijd is dit de garantie.
// ═══════════════════════════════════════════════════════════

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const WORTEL = join(__dirname, "..");

const MAPPEN = [join(WORTEL, "lib", "pagina-lab"), join(WORTEL, "app", "api", "admin", "pagina-lab")];

// Elk patroon met de uitleg die erbij hoort, zodat de melding zegt wat er moet
// gebeuren in plaats van alleen wat er fout is.
const VERBODEN: { patroon: RegExp; waarom: string }[] = [
  { patroon: /\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/i, waarom: "schrijft naar de database" },
  { patroon: /from\s+["'](\.\.\/)+lib\/(tasks|dev-worklist|weekplan|fase-historie|phase-marks|klussen)["']/, waarom: "raakt taken, werklijst of fases aan" },
  { patroon: /\bensureSchema\b|\bensureTable\b/, waarom: "bouwt of wijzigt een tabel" },
];

type Vondst = { bestand: string; regel: number; waarom: string; tekst: string };

function loop(map: string, uit: Vondst[]): void {
  if (!existsSync(map)) return;
  for (const naam of readdirSync(map)) {
    const pad = join(map, naam);
    if (statSync(pad).isDirectory()) { loop(pad, uit); continue; }
    if (!/\.(ts|tsx)$/.test(naam)) continue;
    const regels = readFileSync(pad, "utf8").split("\n");
    regels.forEach((r, i) => {
      // Een uitleg in commentaar over wat er niet mag, is geen overtreding.
      if (/^\s*(\/\/|\*|\/\*)/.test(r)) return;
      for (const { patroon, waarom } of VERBODEN) {
        if (patroon.test(r)) uit.push({ bestand: pad.slice(WORTEL.length + 1), regel: i + 1, waarom, tekst: r.trim().slice(0, 80) });
      }
    });
  }
}

const vondsten: Vondst[] = [];
for (const map of MAPPEN) loop(map, vondsten);

if (vondsten.length) {
  console.error("Het Pagina-lab mag alleen lezen, en hier wordt geschreven:\n");
  for (const v of vondsten) {
    console.error(`  ${v.bestand}:${v.regel} ${v.waarom}`);
    console.error(`    ${v.tekst}`);
  }
  console.error("\nHet lab groeit apart tot Maarten zegt dat het ingepast mag worden.");
  console.error("Moet er echt iets bewaard worden, bespreek dat eerst; anders kan het lopende SEO-werk erdoor breken.");
  process.exit(1);
}

console.log(`Pagina-lab: leest mee, schrijft niets (${MAPPEN.filter((m) => existsSync(m)).length} van de 2 mappen bestaan).`);
