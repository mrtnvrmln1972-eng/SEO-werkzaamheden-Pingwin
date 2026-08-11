// Proef op de laatste slag van de meta-motor: de vijl.
//
// Aanleiding: "waarom voldoen de titel en de omschrijving niet aan de criteria,
// terwijl onze eigen machine dat perfect kan?" Het antwoord bleek te meten:
//
//   Wij vertelden het model een LENGTE IN TEKENS en rekenden het af op
//   PIXELBREEDTE, en die twee liepen niet gelijk. Een omschrijving van 129
//   tekens haalde het tekencriterium (120-155) en bleef met 780 px onder het
//   pixelvenster (800-920). Het model schreef dus keurig naar de regel die het
//   kon uitvoeren, en werd afgekeurd op een regel die het niet kon zien.
//
// Sinds die vondst is de pixel de enige norm en wordt het tekenbereik daaruit
// afgeleid. Daar bovenop ligt de vijl: een rekenkundige laatste slag zonder
// model, zodat een te korte of te brede tekst alsnog in het venster komt.
//
// Deze proef bewaakt twee dingen, en het tweede is het belangrijkste:
//   1. de twee regels spreken elkaar niet meer tegen;
//   2. de vijl levert nooit half werk af. Liever een tekst ongemoeid laten dan
//      hem afknippen tot "werkt met een eigen vast." Dat gebeurde in de eerste
//      opzet, doordat een aangevulde zin die net te breed werd daarna woord voor
//      woord werd teruggeknipt.

import { vijlMeta } from "../lib/meta-machine";
import {
  checkMetaDescription,
  checkMetaTitle,
  metaOpleverIssues,
  metaPixelInfo,
  tekenDoel,
  type MetaKind,
} from "../lib/meta-rules";

let fouten = 0;
function check(naam: string, gekregen: unknown, verwacht: unknown) {
  const ok = String(gekregen) === String(verwacht);
  if (!ok) fouten++;
  console.log(`${ok ? "OK  " : "FOUT"} | ${naam}`);
  if (!ok) console.log(`       verwacht: ${JSON.stringify(verwacht)}\n       gekregen: ${JSON.stringify(gekregen)}`);
}

const KW = "hovenier oosterhout";

// ── 1. De twee regels spreken elkaar niet meer tegen ───────────────
// Precies de tekst die de oude opzet erdoor liet: goed op tekens, te smal in px.
const DESC_129 = "Hovenier Oosterhout nodig? Kamsteeg ontwerpt, legt aan en onderhoudt met een eigen team. Vraag vandaag gratis advies aan bij ons.";
check("die omschrijving meet 780 px", metaPixelInfo("meta_description", DESC_129).px, 780);
check("het lengtecriterium keurt hem nu ook af (was: goedgekeurd)",
  checkMetaDescription(DESC_129, KW).find((c) => c.id === "META-07")?.pass, false);

const TITEL_40 = "Hovenier in Oosterhout - Kamsteeg Tuinen";
check("de titel van 40 tekens meet 380 px", metaPixelInfo("meta_title", TITEL_40).px, 380);
check("het lengtecriterium keurt die nu ook af",
  checkMetaTitle(TITEL_40, KW).find((c) => c.id === "META-02")?.pass, false);

// Het tekenbereik dat we het model noemen, hoort ín het pixelvenster te vallen.
for (const [kind, tekst] of [["meta_title", TITEL_40], ["meta_description", DESC_129]] as [MetaKind, string][]) {
  const doel = tekenDoel(kind, tekst);
  const per = metaPixelInfo(kind, tekst).px / metaPixelInfo(kind, tekst).chars;
  const cfg = metaPixelInfo(kind, tekst);
  check(`${kind}: het genoemde tekenbereik valt binnen het pixelvenster`,
    Math.round(doel.min * per) >= cfg.min && Math.round(doel.max * per) <= cfg.max, true);
}

// ── 2. De vijl levert nooit half werk ──────────────────────────────
type Geval = { naam: string; kind: MetaKind; tekst: string; ctx: Record<string, string>; bouw: string[] };
const GEVALLEN: Geval[] = [
  { naam: "titel te kort, mét merkstaartje", kind: "meta_title", tekst: TITEL_40, ctx: { keyword: KW }, bouw: ["tuinaanleg en onderhoud", "Kamsteeg Tuinen"] },
  { naam: "titel te kort, zonder merkstaartje", kind: "meta_title", tekst: "Ecologische tuin aanleggen", ctx: { keyword: "ecologische tuin" }, bouw: ["met inheemse beplanting", "Kamsteeg Tuinen"] },
  { naam: "titel veel te breed", kind: "meta_title", tekst: "Hovenier in Oosterhout voor tuinaanleg, tuinontwerp en compleet tuinonderhoud - Kamsteeg Tuinen", ctx: { keyword: KW }, bouw: ["Kamsteeg Tuinen"] },
  { naam: "omschrijving te kort", kind: "meta_description", tekst: "Hovenier Oosterhout: tuinaanleg, ontwerp en onderhoud. 30 jaar ervaring, eigen team. Vraag gratis advies aan.", ctx: { keyword: KW }, bouw: ["Al ruim dertig jaar actief in West-Brabant"] },
  { naam: "omschrijving te breed", kind: "meta_description", tekst: "Hovenier Oosterhout nodig? Kamsteeg Tuinen ontwerpt, legt aan en onderhoudt uw tuin met een eigen vast team en ruim dertig jaar ervaring in heel West-Brabant en omstreken. Vraag vandaag een offerte aan bij ons.", ctx: { keyword: KW }, bouw: [] },
  { naam: "omschrijving 20 px te kort, geen passend materiaal", kind: "meta_description", tekst: DESC_129, ctx: { keyword: KW }, bouw: ["Al ruim dertig jaar actief in West-Brabant"] },
  { naam: "al goed: blijft onaangeraakt", kind: "meta_title", tekst: "Hovenier Oosterhout: tuinaanleg en onderhoud - Kamsteeg", ctx: { keyword: KW }, bouw: ["Kamsteeg Tuinen"] },
  { naam: "niets om mee aan te vullen", kind: "meta_title", tekst: "Hovenier in Oosterhout", ctx: { keyword: KW }, bouw: [] },
];

// Woorden waar geen enkele opgeleverde tekst op mag eindigen.
const LOS_EINDE = /\b(en|of|met|voor|van|in|op|bij|tot|door|naar|aan|uit|over|de|het|een|die|dat|deze|als|om|ook|heel|compleet|onze)[.!?]?$/i;

let gerepareerd = 0;
for (const g of GEVALLEN) {
  const na = vijlMeta(g.kind, g.tekst, g.ctx, g.bouw);
  const info = metaPixelInfo(g.kind, na);
  const veranderd = na !== g.tekst;
  if (info.ok) gerepareerd++;

  // De harde eis: veranderde de vijl iets, dan is het resultaat ook echt goed.
  check(`${g.naam}: onaangeraakt, of in het venster`, !veranderd || info.ok, true);
  if (veranderd) check(`${g.naam}: eindigt niet op een los woord`, LOS_EINDE.test(na.trim()), false);
  check(`${g.naam}: nooit leeg of korter dan een halve zin`, na.trim().length >= 15, true);
  // Een tekst die al goed was, blijft precies zoals hij was.
  if (metaPixelInfo(g.kind, g.tekst).ok) check(`${g.naam}: al goede tekst blijft ongemoeid`, na, g.tekst);
  // Een verandering mag nooit een nieuw gebrek introduceren.
  if (veranderd) {
    const voor = metaOpleverIssues(g.kind, g.tekst, g.ctx).length;
    const nu = metaOpleverIssues(g.kind, na, g.ctx).length;
    check(`${g.naam}: er komt geen gebrek bij`, nu <= voor, true);
  }
}

console.log(`\nDe vijl bracht ${gerepareerd} van de ${GEVALLEN.length} gevallen zelf in het venster; de rest bleef bewust onaangeraakt.`);
console.log(fouten === 0 ? "Alle proeven geslaagd." : `${fouten} proef/proeven mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
