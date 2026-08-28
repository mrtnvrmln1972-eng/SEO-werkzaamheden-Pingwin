// ═══════════════════════════════════════════════════════════
// HET CLUSTEROVERZICHT LEEST DE MAP UIT, HIJ HOUDT GEEN LIJST BIJ
// ═══════════════════════════════════════════════════════════
// /share/cluster/<klant> toont per cluster twee links: de klantversie en de
// interne versie ernaast. Die lijst komt bij elke bouw uit de map
// public/share/cluster/<klant>/ zelf.
//
// De fout die hier op de loer ligt, is dezelfde die in dit project al vaker is
// gemaakt: iemand zet er "even" een lijst met clusternamen in de code bij.
// Vanaf dat moment staat dezelfde waarheid op twee plekken, en dan is het een
// kwestie van tijd tot je een analyse neerzet die niet in het overzicht
// verschijnt, zonder dat iets rood wordt. Deze proef bewaakt dat de maplezing
// de bron blijft, en dat de interne link naar het gelijknamige bestand wijst.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

const wortel = join(__dirname, "..");
const pagina = readFileSync(join(wortel, "app/share/cluster/[klant]/page.tsx"), "utf8");

proef("de clusters komen uit de map, niet uit een lijst in de code",
  pagina.includes("readdirSync") && pagina.includes('endsWith(".html")'),
  "Zonder maplezing verschijnt een nieuwe analyse pas als iemand er met de hand aan denkt.");

proef("de interne link wijst naar het gelijknamige bestand in intern-9f3a2b",
  /INTERN_MAP\s*=\s*"intern-9f3a2b"/.test(pagina) && pagina.includes("join(map, INTERN_MAP, b.name)"),
  "Wijst hij ergens anders heen, dan opent 'Intern' de verkeerde of een niet-bestaande pagina.");

proef("een ontbrekende interne versie levert geen dode link op",
  /existsSync\(internBestand\)\s*\?/.test(pagina),
  "Een link die 404 geeft is erger dan geen link.");

proef("alleen bestaande klantmappen krijgen een pagina",
  pagina.includes("dynamicParams = false") && pagina.includes("generateStaticParams"),
  "Zonder die grens kan een verzonnen adres een andere map laten uitlezen.");

proef("het overzicht noemt de interne versie en hoort dus niet in Google",
  /robots:\s*\{\s*index:\s*false/.test(pagina),
  "Deze pagina is een interne index; hij mag niet geïndexeerd worden.");

// De maplezing moet ook echt iets vinden, anders is het overzicht stil leeg.
const clusterMap = join(wortel, "public/share/cluster");
if (existsSync(clusterMap)) {
  for (const klant of readdirSync(clusterMap, { withFileTypes: true }).filter((m) => m.isDirectory())) {
    const map = join(clusterMap, klant.name);
    const clusters = readdirSync(map, { withFileTypes: true }).filter((b) => b.isFile() && b.name.endsWith(".html"));
    proef(`klant ${klant.name} heeft minstens één cluster om te tonen`,
      clusters.length > 0,
      "Een klantmap zonder .html-bestand levert een leeg overzicht op.");
  }
}

console.log(fouten === 0 ? "\nAlles goed." : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);
