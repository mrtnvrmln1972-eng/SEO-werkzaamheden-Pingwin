// Proef voor lib/chat-bronnen.ts: wordt een gereedschap-aanroep een leesbare bronregel?
// Draaien met: npx --yes tsx proeven/chat-bronnen.proef.ts

import { bronVan, ontdubbel, type Bron } from "../lib/chat-bronnen";

let mislukt = 0;
function check(naam: string, gekregen: unknown, verwacht: unknown) {
  const a = JSON.stringify(gekregen);
  const b = JSON.stringify(verwacht);
  if (a === b) { console.log(`  ok   ${naam}`); return; }
  mislukt++;
  console.log(`  FOUT ${naam}\n       verwacht: ${b}\n       gekregen: ${a}`);
}

const domein = "paulhoevenaars.nl";

console.log("\nEigen pagina's worden een kort pad:");
check("meet_pagina", bronVan("meet_pagina", { url: "https://paulhoevenaars.nl/hovenier-uden/" }, domein),
  { naam: "Pagina gelezen", detail: "/hovenier-uden/" });
check("homepage", bronVan("meet_pagina", { url: "https://paulhoevenaars.nl/" }, domein),
  { naam: "Pagina gelezen", detail: "de homepage" });
check("gsc_pagina", bronVan("gsc_pagina", { url: "https://paulhoevenaars.nl/hovenier-oss/" }, domein),
  { naam: "Search Console", detail: "/hovenier-oss/" });

console.log("\nEen concurrent houdt zijn domeinnaam, anders lijkt het je eigen pagina:");
check("concurrent", bronVan("meet_pagina", { url: "https://www.lipsgroen.nl/tuinaanleg/" }, domein),
  { naam: "Pagina gelezen", detail: "lipsgroen.nl/tuinaanleg/" });

console.log("\nZoekwoorden en zoektermen:");
check("serp_top10", bronVan("serp_top10", { keyword: "hovenier den bosch" }, domein),
  { naam: "Top 10 bekeken", detail: "hovenier den bosch" });
check("meerdere zoekwoorden", bronVan("ahrefs_keyword_volume", { keywords: ["hovenier uden", "tuinman uden"] }, domein),
  { naam: "Ahrefs, zoekvolume", detail: "hovenier uden, tuinman uden" });
check("zoek_mail", bronVan("zoek_mail", { zoekterm: "Sander" }, domein),
  { naam: "Mail doorzocht", detail: "Sander" });

console.log("\nGereedschap zonder invoer houdt gewoon zijn label:");
check("site_overzicht", bronVan("site_overzicht", {}, domein),
  { naam: "Site-breed overzicht opgehaald", detail: "" });
check("dunne_paginas", bronVan("dunne_paginas", {}, domein),
  { naam: "Dunne pagina's opgezocht", detail: "" });

console.log("\nIets DOEN is geen bron en hoort niet in de strip:");
check("stel_acties_voor", bronVan("stel_acties_voor", { acties: [] }, domein), null);

console.log("\nOnbekend gereedschap valt netjes terug:");
check("onbekend", bronVan("nieuw_gereedschap", { iets: "waarde" }, domein),
  { naam: "nieuw gereedschap", detail: "waarde" });
check("onbekend zonder invoer", bronVan("nieuw_gereedschap", {}, domein),
  { naam: "nieuw gereedschap", detail: "" });

console.log("\nEen heel lange waarde wordt afgekapt, niet uitgesmeerd:");
const lang = bronVan("zoek_mail", { zoekterm: "x".repeat(200) }, domein) as Bron;
check("lengte <= 70", lang.detail.length <= 70, true);

console.log("\nDrie keer dezelfde pagina wordt één regel:");
check("ontdubbelen", ontdubbel([
  { naam: "Pagina gelezen", detail: "/a/" },
  { naam: "Pagina gelezen", detail: "/a/" },
  { naam: "Pagina gelezen", detail: "/b/" },
]), [{ naam: "Pagina gelezen", detail: "/a/" }, { naam: "Pagina gelezen", detail: "/b/" }]);

console.log("\nRommelige invoer mag nooit een fout geven:");
check("kapotte url", bronVan("meet_pagina", { url: "geen-url" }, domein),
  { naam: "Pagina gelezen", detail: "geen-url" });
check("geen domein bekend", bronVan("meet_pagina", { url: "https://paulhoevenaars.nl/x/" }, undefined),
  { naam: "Pagina gelezen", detail: "/x/" });

console.log(mislukt === 0 ? "\nAlles goed.\n" : `\n${mislukt} proef(en) mislukt.\n`);
process.exit(mislukt === 0 ? 0 : 1);
