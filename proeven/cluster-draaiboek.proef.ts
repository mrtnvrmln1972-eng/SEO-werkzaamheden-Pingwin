// Proef: het draaiboek van een blok werk laat niets door de verkeerde volgorde.
//
// WAAROM DIT BESTAAT
// ══════════════════
// Maarten stelde de vraag die alles bepaalt: "een redirect pas doen wanneer de
// tekst uit de op te ruimen pagina al is overgezet. Hoe gaan we die volgorde
// organiseren?" Een omleiding vóór de verhuizing gooit precies weg wat je wilde
// behouden, en dat is niet terug te draaien: de oude pagina is dan weg.
//
// Daarnaast twee eisen van hem die geen instelling mogen worden:
//   - hij zet elke stap zélf aan, ook de stappen die de machine kan doen;
//   - de copy beoordeelt hij altijd zelf, en die stap kan nooit op automatisch.
//
// Deze proef rekent na dat de sloten kloppen, dat de volgorde niet stiekem te
// omzeilen is, en dat het rekenwerk van de stappen doet wat het belooft.

import {
  STAPPEN, bouwDraaiboek, magStarten, STAP_VAN_SLEUTEL,
  type StapStand, type StapSleutel,
} from "../lib/cluster-draaiboek";
import {
  bouwTermverdeling, bouwVerdict, bouwLinkplan, bouwBouwpakket, blijvendePaginas,
} from "../lib/cluster-uitvoering";
import { bouwWerkplan, type OpruimRegel, type MetaKans } from "../lib/werkplan";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { if (uitleg) console.log(`     | ${uitleg}`); fouten++; }
}

const klaar = (...s: StapSleutel[]): StapStand[] => s.map((sleutel) => ({
  sleutel, stand: "klaar" as const, modus: "handmatig" as const,
  gestartOp: "", klaarOp: "2026-08-26T10:00:00Z", resultaat: "", notitie: "",
}));

// ── 1. Het slot: niets kan starten dat nog ergens op wacht ──
const leeg = bouwDraaiboek("Amsterdam", []);
proef("aan het begin kan alleen de eerste stap starten",
  leeg.stappen[0].stand === "klaar-om-te-starten" &&
  leeg.stappen.slice(1).every((s) => s.stand === "wacht"),
  leeg.stappen.map((s) => `${s.nummer}=${s.stand}`).join(" "));
proef("een stap die wacht zegt in gewone taal waarop",
  /wacht op: kijken wat er nu op de pagina's staat/.test(leeg.stappen[1].wachtOp),
  `"${leeg.stappen[1].wachtOp}"`);
proef("de eerstvolgende stap wordt aangewezen",
  leeg.volgende === "inventaris", String(leeg.volgende));

// ── 2. De belangrijkste: geen omleiding vóór de bouwer klaar is ──
const zonderBouw = bouwDraaiboek("Amsterdam", klaar(
  "inventaris", "analyse", "termverdeling", "verdict", "blauwdruk", "copy",
  "beoordelen", "linkplan", "bouwpakket"));
const redirectPoging = magStarten(zonderBouw, "redirects");
proef("de omleidingen kunnen NIET starten zolang de bouwer het niet live heeft",
  !redirectPoging.ok && /bouwer/i.test(redirectPoging.reden),
  `ok=${redirectPoging.ok}, reden="${redirectPoging.reden}"`);
proef("titels doorzetten kan óók nog niet, om dezelfde reden",
  !magStarten(zonderBouw, "meta").ok);

const metBouw = bouwDraaiboek("Amsterdam", klaar(
  "inventaris", "analyse", "termverdeling", "verdict", "blauwdruk", "copy",
  "beoordelen", "linkplan", "bouwpakket", "implementatie"));
proef("zodra de bouwer het live heeft, gaan de omleidingen open",
  magStarten(metBouw, "redirects").ok && magStarten(metBouw, "meta").ok);
proef("nameten wacht op de omleidingen én op de titels",
  !magStarten(metBouw, "nameten").ok);

// ── 3. Copy beoordelen kan nooit automatisch, en copy wacht op de blauwdruk ──
const beoordelen = STAP_VAN_SLEUTEL.get("beoordelen")!;
proef("de stap 'copy nalezen' kan nooit op automatisch",
  beoordelen.magAutomatisch === false && beoordelen.wie === "maarten");
proef("de bouwer afvinken kan ook niet automatisch, want dat is werk van een mens",
  STAP_VAN_SLEUTEL.get("implementatie")!.magAutomatisch === false);
proef("elke andere stap mag ooit automatisch worden",
  STAPPEN.filter((s) => !s.magAutomatisch).map((s) => s.sleutel).join(",") === "beoordelen,implementatie",
  STAPPEN.filter((s) => !s.magAutomatisch).map((s) => s.sleutel).join(","));

// ── 4. Een blok zonder samenvoeging slaat de omleidingen over ──
const dunnePagina = bouwDraaiboek("Losse dunne pagina", klaar(
  "inventaris", "analyse", "termverdeling", "verdict", "blauwdruk", "copy",
  "beoordelen", "linkplan", "bouwpakket", "implementatie", "meta"), { heeftSamenvoeging: false });
proef("zonder samenvoeging is de omleidingsstap niet van toepassing",
  dunnePagina.stappen.find((s) => s.sleutel === "redirects")?.nvt === true);
proef("en dan houdt die stap het nameten niet tegen",
  magStarten(dunnePagina, "nameten").ok,
  magStarten(dunnePagina, "nameten").reden);
proef("een stap die niet van toepassing is telt niet mee in de voortgang",
  dunnePagina.totaal === STAPPEN.length - 1, `totaal=${dunnePagina.totaal}`);

// ── 5. Overslaan telt als voorbij, zodat je niet vast komt te zitten ──
const overgeslagen = bouwDraaiboek("Amsterdam", [
  ...klaar("inventaris"),
  { sleutel: "analyse", stand: "overgeslagen", modus: "handmatig", gestartOp: "", klaarOp: "", resultaat: "", notitie: "" },
]);
proef("een overgeslagen stap blokkeert de volgende niet",
  magStarten(overgeslagen, "termverdeling").ok);

// ── 6. Een stap die al loopt of al klaar is, start niet nog een keer ──
const bezig = bouwDraaiboek("Amsterdam", [
  { sleutel: "inventaris", stand: "bezig", modus: "handmatig", gestartOp: "", klaarOp: "", resultaat: "", notitie: "" },
]);
proef("een stap die al loopt kan niet nog eens gestart worden",
  !magStarten(bezig, "inventaris").ok && /loopt al/.test(magStarten(bezig, "inventaris").reden));
proef("een stap die klaar is ook niet",
  !magStarten(bouwDraaiboek("A", klaar("inventaris")), "inventaris").ok);

// ── 7. Het rekenwerk, op het echte cluster Amsterdam ──
const AMSTERDAM: OpruimRegel[] = [
  { pad: "/soa-klinieken/soa-test-amsterdam/", uitkomst: "uitbouwen", naar: "", reden: "Wordt de hoofdpagina.",
    onderbouwing: ["Drie eigen pagina's staan tegelijk op deze term."],
    term: "soa test amsterdam", volume: 1900, klikken: 33, positie: 8, groep: "Amsterdam" },
  { pad: "/testen-in-amsterdam-welke-opties-heb-je/", uitkomst: "uitbouwen", naar: "", reden: "Eigen zoekvraag: de GGD.",
    onderbouwing: ["Drie eigen pagina's staan tegelijk op deze term.", "Dit blog wint op de GGD-termen."],
    term: "ggd soa test amsterdam", volume: 450, klikken: 33, positie: 5, groep: "Amsterdam" },
  { pad: "/snelle-soa-test-amsterdam/", uitkomst: "samenvoegen", naar: "/soa-klinieken/soa-test-amsterdam/",
    reden: "Gaat op in de hoofdpagina.", onderbouwing: ["Drie eigen pagina's staan tegelijk op deze term."],
    term: "snelle soa test amsterdam", volume: 210, klikken: 0, positie: 18, groep: "Amsterdam" },
  { pad: "/oude-soa-adam/", uitkomst: "opruimen", naar: "/soa-klinieken/soa-test-amsterdam/",
    reden: "Levert niets op.", onderbouwing: ["Drie eigen pagina's staan tegelijk op deze term."],
    term: "", volume: 0, klikken: 0, positie: null, groep: "Amsterdam" },
];
const METAS: MetaKans[] = [
  { url: "/soa-klinieken/soa-test-amsterdam/", keyword: "soa test amsterdam", volume: 1900, position: 8,
    extraClicks: 1693, curTitle: "SOA test in Amsterdam", curDesc: "Anoniem, uitslag na 30 min.", reden: "klikwinst" },
];
const plan = bouwWerkplan(AMSTERDAM, METAS, [], [], 3);
const cluster = plan.clusters.find((c) => c.naam === "Amsterdam")!;

const termen = bouwTermverdeling(cluster);
const hoofd = termen.find((t) => t.pad === "/soa-klinieken/soa-test-amsterdam/")!;
const blog = termen.find((t) => t.pad === "/testen-in-amsterdam-welke-opties-heb-je/")!;
const weg = termen.find((t) => t.pad === "/snelle-soa-test-amsterdam/")!;
proef("de hoofdpagina krijgt zijn eigen term plus die van de samengevoegde pagina's",
  hoofd.krijgt.includes("soa test amsterdam") && hoofd.krijgt.includes("snelle soa test amsterdam"),
  hoofd.krijgt.join(", "));
proef("het blog met een eigen zoekvraag houdt zijn eigen term en staat niets af",
  blog.krijgt.join() === "ggd soa test amsterdam" && blog.staatAf.length === 0,
  `krijgt=${blog.krijgt.join()}, staatAf=${blog.staatAf.join()}`);
proef("een pagina die opgaat in een andere staat zijn term af",
  weg.staatAf.join() === "snelle soa test amsterdam" && weg.krijgt.length === 0);

const verdicten = bouwVerdict(cluster);
const vHoofd = verdicten.find((v) => v.pad === "/soa-klinieken/soa-test-amsterdam/")!;
proef("een pagina met posities en klikken wordt aangevuld, nooit volledig herschreven",
  vHoofd.verdict === "aanvullen, niet herschrijven" && vHoofd.risico === true,
  `${vHoofd.verdict}: ${vHoofd.waarom}`);
proef("de reden noemt het bewijs waarom er niet herschreven wordt",
  /positie 8/.test(vHoofd.waarom) && /33 klikken/.test(vHoofd.waarom), vHoofd.waarom);
proef("een pagina die opgeruimd wordt krijgt geen schrijfopdracht",
  verdicten.find((v) => v.pad === "/oude-soa-adam/")?.verdict === "weg");

const links = bouwLinkplan(cluster);
proef("het linkplan legt links over en weer tussen de blijvers en de hoofdpagina",
  links.some((l) => l.van === "/testen-in-amsterdam-welke-opties-heb-je/" && l.naar === "/soa-klinieken/soa-test-amsterdam/" && l.anker === "soa test amsterdam") &&
  links.some((l) => l.van === "/soa-klinieken/soa-test-amsterdam/" && l.naar === "/testen-in-amsterdam-welke-opties-heb-je/" && l.anker === "ggd soa test amsterdam"),
  links.map((l) => `${l.van} -> ${l.naar} (${l.anker})`).join(" | "));
proef("er wordt nooit gelinkt naar een pagina die straks wordt omgeleid",
  !links.some((l) => l.naar === "/snelle-soa-test-amsterdam/" || l.naar === "/oude-soa-adam/"),
  links.map((l) => l.naar).join(", "));
proef("en ook niet vanaf zo'n pagina",
  !links.some((l) => l.van === "/snelle-soa-test-amsterdam/" || l.van === "/oude-soa-adam/"));

proef("de motor draait alleen op de pagina's die blijven",
  blijvendePaginas(cluster).length === 2,
  blijvendePaginas(cluster).map((p) => p.pad).join(", "));

const pakket = bouwBouwpakket(cluster, termen, verdicten, links);
proef("het bouwpakket noemt per pagina wat er moet gebeuren",
  /#### \/soa-klinieken\/soa-test-amsterdam\//.test(pakket) &&
  /#### \/snelle-soa-test-amsterdam\//.test(pakket));
proef("het bouwpakket zegt welke term ergens weg moet",
  /Haal weg uit titel, H1 en eerste alinea:\*\* snelle soa test amsterdam/.test(pakket));
proef("het bouwpakket bevat de linktabel en de omleidingen",
  /Interne links die gelegd moeten worden/.test(pakket) &&
  /Omleidingen, als allerlaatste stap/.test(pakket));
proef("het bouwpakket waarschuwt dat de omleiding als laatste komt",
  /pas nadat de teksten hierboven live staan/i.test(pakket));

console.log(fouten === 0 ? "\nAlles klopt: de volgorde is niet te omzeilen." : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);
