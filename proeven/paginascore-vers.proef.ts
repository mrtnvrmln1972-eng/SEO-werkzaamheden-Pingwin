// Proef op de versheid van de paginascore.
//
// Waarom dit bestand er is. Op 11 augustus 2026 stond de Strandtuin-pagina van
// Kamsteeg op score 47, terwijl er copy aan toegevoegd was. Maarten had de site
// net "opnieuw laten scannen". De score klopte niet, en de reden was niet de
// berekening maar de versheid van de meting: de knop "Hele site opnieuw scannen"
// haalde alleen op wélke pagina's er zijn en hoe het menu loopt. De inhoud van de
// pagina's werd niet opnieuw gemeten, dus kwam de score van maanden terug er
// gewoon weer uit. Er kwam geen foutmelding; er kwam een verkeerd cijfer, en dat
// is de fout die je niet ziet.
//
// Dezelfde fout zat in de weekcron: die liep de klanten op naam af binnen een
// venster van vijf minuten, en begon elke week weer vooraan. De eerste klant
// kreeg dus altijd een verse meting en de laatste nooit.
//
// Wat hier vastligt:
//  1. De scanknop meet ook echt de inhoud (en wacht daarop).
//  2. De weekcron rouleert en houdt zich aan een tijdsbudget.
//  3. Een score op een oude of geschatte meting wordt als zodanig gemeld.

import { readFileSync } from "fs";
import { join } from "path";

let fouten = 0;
function check(naam: string, ok: boolean, toelichting = "") {
  if (!ok) fouten++;
  console.log(`${ok ? "OK  " : "FOUT"} | ${naam}`);
  if (!ok && toelichting) console.log(`       ${toelichting}`);
}

const lees = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// ── 1. De scanknop meet de inhoud ────────────────────────────
const roadmap = lees("app/admin/client/[slug]/navigatie/NavigatieRoadmap.tsx");
const scanSite = roadmap.slice(roadmap.indexOf("async function scanSite"), roadmap.indexOf("// Welke lijst tonen we"));

check(
  "de scanknop haalt de pagina's van de site op",
  scanSite.includes("/api/admin/urls"),
  "scanSite() roept /api/admin/urls niet meer aan",
);
check(
  "de scanknop leest het menu opnieuw uit",
  scanSite.includes('action: "menu"'),
  "scanSite() leest het menu niet meer uit",
);
check(
  "de scanknop meet daarna de inhoud van elke pagina",
  scanSite.includes("/api/admin/content-scan"),
  "scanSite() start de contentmeting niet; de scores blijven dan op de vorige meting staan, ook al heet de knop 'hele site opnieuw scannen'",
);
check(
  "en wacht tot die meting klaar is voordat het scherm ververst",
  scanSite.includes('wachtOpKlus(slug, "wijzigingen-scan")'),
  "zonder wachten laadt het scherm de oude scores terug voordat de meting klaar is",
);

// ── 2. De weekcron rouleert binnen een tijdsbudget ───────────
const cron = lees("app/api/cron/content-scan/route.ts");
check(
  "de weekcron begint bij de klant die het langst niet aan de beurt was",
  cron.includes("klantenOpMeetVolgorde"),
  "zonder rouleren krijgt de eerste klant elke week een meting en de laatste nooit",
);
check(
  "de weekcron legt per klant vast wanneer hij gedraaid heeft",
  cron.includes("markeerContentScan"),
  "zonder die stempel weet de volgende run niet wie er al is geweest",
);
check(
  "de weekcron begint geen nieuwe klant meer als de tijd bijna op is",
  cron.includes("BUDGET_MS"),
  "zonder tijdsbudget wordt de laatste klant halverwege afgekapt",
);

// ── 3. Een oude meting wordt gemeld ──────────────────────────
check(
  "het tekstballonnetje bij de score waarschuwt bij een verouderde meting",
  roadmap.includes("scoreVeroudering"),
  "zonder waarschuwing leest een score van maanden terug als de stand van vandaag",
);
check(
  "en waarschuwt ook als de pagina nog nooit precies gemeten is",
  roadmap.includes("n.woordenGeschat") && roadmap.includes("nog nooit precies gemeten"),
  "een geschat woordaantal maakt de score onbetrouwbaar; dat hoort erbij te staan",
);

console.log(fouten === 0 ? "\nAlles goed." : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
