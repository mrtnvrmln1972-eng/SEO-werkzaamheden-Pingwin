// Proef op de opleverpoort van de meta-motor.
//
// Waarom dit bestand er is: op 11 augustus 2026 stond in de copy-briefing voor
// Kamsteeg (/hovenier/oosterhout/) ons eigen oordeel over onze eigen tekst:
// "40 tekens, 380 px van max 580; te kort, ruimte onbenut" bij de meta-title, en
// hetzelfde bij de description. De pixel-motor mat dus goed, maar de poort
// waarmee we onze eigen teksten aftoetsen keek alleen naar harde gebreken
// (te breed, pijp, haken). "Te kort" telde niet mee, dus liet de correctielus
// die tekst gewoon door, en las de klant in een oplevering dat ons werk niet
// voldeed.
//
// Deze proef legt het verschil vast tussen de twee oordelen:
//   metaHardIssues    — over wat er LIVE staat: alleen wat echt kapot is.
//   metaOpleverIssues — over wat WIJ maken: de volledige criterialijst.
// Zolang deze proef groen is, kan een te korte of niet front-loaded meta niet
// meer stilzwijgend een klantdocument in.

import {
  metaHardIssues,
  metaOpleverIssues,
  metaPixelInfo,
  pixelAfstand,
} from "../lib/meta-rules";

let fouten = 0;
function check(naam: string, gekregen: unknown, verwacht: unknown) {
  const ok = String(gekregen) === String(verwacht);
  if (!ok) fouten++;
  console.log(`${ok ? "OK  " : "FOUT"} | ${naam}`);
  if (!ok) console.log(`       verwacht: ${JSON.stringify(verwacht)}\n       gekregen: ${JSON.stringify(gekregen)}`);
}

const KW = "hovenier oosterhout";

// ── De echte teksten uit de Kamsteeg-briefing ──────────────────────
const TITEL_KORT = "Hovenier in Oosterhout - Kamsteeg Tuinen";
const DESC_KORT = "Hovenier Oosterhout: tuinaanleg, ontwerp & onderhoud. 30 jaar ervaring, eigen team. Vraag gratis advies aan.";

check("de titel uit het document meet 380 px", metaPixelInfo("meta_title", TITEL_KORT).px, 380);
check("die titel is niet kapot (dus geen alarm over een live pagina)", metaHardIssues("meta_title", TITEL_KORT).length, 0);
check("maar hij komt niet door de opleverpoort", metaOpleverIssues("meta_title", TITEL_KORT, { keyword: KW }).length > 0, true);
check("en de poort noemt de onbenutte ruimte", /te kort/.test(metaOpleverIssues("meta_title", TITEL_KORT, { keyword: KW }).join(" ")), true);
check("de description idem: niet kapot", metaHardIssues("meta_description", DESC_KORT).length, 0);
check("de description komt niet door de poort", metaOpleverIssues("meta_description", DESC_KORT, { keyword: KW }).length > 0, true);

// ── Wat er wél uitgeleverd mag worden ──────────────────────────────
const TITEL_GOED = "Hovenier Oosterhout: tuinaanleg en onderhoud - Kamsteeg";
const DESC_GOED = "Hovenier Oosterhout nodig? Kamsteeg Tuinen ontwerpt, legt aan en onderhoudt met een eigen team en 30 jaar ervaring. Vraag vandaag gratis advies aan.";

check("een gevulde titel komt door de poort", metaOpleverIssues("meta_title", TITEL_GOED, { keyword: KW }), []);
check("een gevulde description komt door de poort", metaOpleverIssues("meta_description", DESC_GOED, { keyword: KW, title: TITEL_GOED }), []);

// ── De harde gebreken blijven hard ─────────────────────────────────
const TITEL_PIJP = "Hovenier Oosterhout | tuinaanleg en onderhoud Kamsteeg";
check("een pijp blijft een hard gebrek", metaHardIssues("meta_title", TITEL_PIJP).length > 0, true);
check("een pijp valt ook door de opleverpoort", metaOpleverIssues("meta_title", TITEL_PIJP, { keyword: KW }).length > 0, true);

const TITEL_BREED = "Hovenier in Oosterhout voor tuinaanleg, tuinontwerp en compleet tuinonderhoud - Kamsteeg Tuinen";
check("een te brede titel is hard fout", metaHardIssues("meta_title", TITEL_BREED).length > 0, true);
check("lege tekst is een gebrek, geen stilte", metaOpleverIssues("meta_title", "", { keyword: KW }), ["ontbreekt volledig"]);

// ── De tie-break van de correctielus ───────────────────────────────
// Eerder won bij gelijk spel altijd de smalste kandidaat. Bij een te korte
// titel werd de correctie daardoor nóg korter: precies de verkeerde kant op.
check("te kort meet afstand tot het venster", pixelAfstand("meta_title", TITEL_KORT), 50);
check("te breed meet ook afstand", pixelAfstand("meta_title", TITEL_BREED) > 0, true);
check("een goede titel heeft afstand nul", pixelAfstand("meta_title", TITEL_GOED), 0);
check("gevulder is dichterbij dan korter", pixelAfstand("meta_title", TITEL_GOED) < pixelAfstand("meta_title", TITEL_KORT), true);

console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef/proeven mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
