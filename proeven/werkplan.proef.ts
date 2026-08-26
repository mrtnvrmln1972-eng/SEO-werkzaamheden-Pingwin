// Proef: het werkplan is een plan, geen lijst.
//
// WAAROM DIT BESTAAT
// ══════════════════
// De werkplanning toonde 372 signalen in 173 groepen. Dat is dezelfde lange lijst
// met tussenkopjes erin, en je kunt er geen plan uit trekken. Maartens eis: één
// overzicht waarin je per cluster ziet wat er aan de hand is, welke pagina's
// erbij horen, wat je gaat doen en wat het moet opleveren, zonder erover na te
// hoeven denken.
//
// De motor die dat maakt (`lib/werkplan.ts`) is stil kapot te maken: één regel
// anders en de meta-kansen vallen weer uit hun cluster, of de fase-volgorde
// klapt om en je optimaliseert pagina's die je daarna doorstuurt. Deze proef
// rekent de vijf beloftes na met een echt cluster:
//   1. één onderwerp is één cluster, met alle handelingen erin door elkaar;
//   2. een titel-kans hangt aan het cluster van zijn eigen pagina;
//   3. werk op een pagina die tóch verdwijnt vervalt zichtbaar;
//   4. structuur gaat vóór inhoud gaat vóór laaghangend fruit;
//   5. de tijd per handeling verschilt, en de weken volgen het urenbudget.

import {
  bouwWerkplan, urenTekst, paginaRegel, MINUTEN, FASE_TITEL,
  type OpruimRegel, type MetaKans,
} from "../lib/werkplan";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { if (uitleg) console.log(`     | ${uitleg}`); fouten++; }
}

// ── Een echt cluster: Amsterdam, zes pagina's, vier verschillende handelingen ──
const AMSTERDAM: OpruimRegel[] = [
  { pad: "/soa-test-amsterdam/", uitkomst: "blijft", naar: "", reden: "Blijft de pagina voor Amsterdam.",
    onderbouwing: ["Zes pagina's ranken op dezelfde term.", "Deze heeft de meeste klikken."],
    term: "soa test amsterdam", volume: 5400, klikken: 210, positie: 4, groep: "Amsterdam" },
  { pad: "/soa-test/amsterdam-centrum/", uitkomst: "samenvoegen", naar: "/soa-test-amsterdam/", reden: "Gaat op in de pagina voor Amsterdam.",
    onderbouwing: ["Zes pagina's ranken op dezelfde term.", "Positie wisselt tussen drie pagina's."],
    term: "soa test amsterdam centrum", volume: 1300, klikken: 20, positie: 11, groep: "Amsterdam" },
  { pad: "/soa-test-adam/", uitkomst: "samenvoegen", naar: "/soa-test-amsterdam/", reden: "Gaat op in de pagina voor Amsterdam.",
    onderbouwing: ["Zes pagina's ranken op dezelfde term.", "Nauwelijks vertoningen."],
    term: "soa test adam", volume: 590, klikken: 3, positie: 24, groep: "Amsterdam" },
  { pad: "/soa-test-amsterdam-zuid/", uitkomst: "samenvoegen", naar: "/soa-test-amsterdam/", reden: "Gaat op in de pagina voor Amsterdam.",
    onderbouwing: ["Zes pagina's ranken op dezelfde term."],
    term: "soa test amsterdam zuid", volume: 320, klikken: 1, positie: 31, groep: "Amsterdam" },
  { pad: "/oude-soa-pagina-adam/", uitkomst: "opruimen", naar: "/soa-test-amsterdam/", reden: "Levert niets op.",
    onderbouwing: ["Zes pagina's ranken op dezelfde term.", "Nul klikken in twaalf maanden."],
    term: "", volume: 0, klikken: 0, positie: null, groep: "Amsterdam" },
  { pad: "/soa-test-amsterdam-afspraak/", uitkomst: "uitbouwen", naar: "", reden: "Aparte intentie, mag blijven en uitgebreid.",
    onderbouwing: ["Zes pagina's ranken op dezelfde term.", "Eigen zoekintentie: afspraak maken."],
    term: "soa test afspraak amsterdam", volume: 720, klikken: 40, positie: 8, groep: "Amsterdam" },
];

// Twee titel-kansen: één op de pagina die blijft, één op een pagina die verdwijnt.
const METAS: MetaKans[] = [
  { url: "/soa-test-amsterdam/", keyword: "soa test amsterdam", volume: 5400, position: 4,
    extraClicks: 180, curTitle: "SOA test", curDesc: "", reden: "klikwinst", issues: { desc: ["ontbreekt"] } },
  { url: "/soa-test-adam/", keyword: "soa test adam", volume: 590, position: 24,
    extraClicks: 12, curTitle: "", curDesc: "", reden: "kapot", issues: { title: ["ontbreekt"] } },
];

const plan = bouwWerkplan(AMSTERDAM, METAS, [], [], 3);
const amsterdam = plan.clusters.find((c) => c.naam === "Amsterdam");

// ── 1. Eén onderwerp is één cluster ──
proef("zes pagina's over Amsterdam vormen één cluster, geen zes regels",
  !!amsterdam && amsterdam.paginas.length === 6 && plan.clusters.length === 1,
  `kreeg ${plan.clusters.length} clusters met ${amsterdam?.paginas.length} pagina's`);
proef("alle vier de handelingen zitten in dat ene cluster",
  ["blijft", "uitbouwen", "samenvoegen", "opruimen"].every((h) => amsterdam!.paginas.some((p) => p.handeling === h)),
  amsterdam?.telling.map((t) => `${t.n} ${t.handeling}`).join(", "));
proef("de pagina die blijft staat bovenaan, want alles wijst naar hem",
  amsterdam?.paginas[0].handeling === "blijft" && amsterdam?.doel === "/soa-test-amsterdam/",
  `bovenaan staat ${amsterdam?.paginas[0].handeling}, doel is ${amsterdam?.doel}`);
proef("de samenvatting zegt in één zin hoeveel pagina's en wat ermee gebeurt",
  /6 pagina's/.test(amsterdam?.samenvatting || "") &&
  /samenvoegen/.test(amsterdam?.samenvatting || "") &&
  /8\.330 zoekopdrachten per maand/.test(amsterdam?.samenvatting || ""),
  `samenvatting: "${amsterdam?.samenvatting}"`);
proef("de onderbouwing die alle pagina's delen staat één keer op het cluster",
  amsterdam?.gedeeld.length === 1 && amsterdam.gedeeld[0] === "Zes pagina's ranken op dezelfde term.",
  `gedeeld: ${JSON.stringify(amsterdam?.gedeeld)}`);

// ── 2 en 3. Titel-kansen hangen aan hun eigen pagina, of vervallen zichtbaar ──
const blijver = amsterdam!.paginas.find((p) => p.pad === "/soa-test-amsterdam/")!;
const weg = amsterdam!.paginas.find((p) => p.pad === "/soa-test-adam/")!;
proef("de titel-kans op de blijvende pagina hangt aan die pagina, niet in een eigen lijst",
  !!blijver.meta && blijver.minuten === MINUTEN.blijft + MINUTEN.meta,
  `meta=${!!blijver.meta}, minuten=${blijver.minuten}`);
proef("de titel-kans op een pagina die verdwijnt vervalt, met de reden erbij",
  weg.meta === null && /gaat op in \/soa-test-amsterdam\//.test(weg.vervallen),
  `meta=${weg.meta}, vervallen="${weg.vervallen}"`);
proef("het cluster telt hoeveel kansen er vervielen",
  amsterdam?.vervallen === 1, `vervallen=${amsterdam?.vervallen}`);

// ── 4. De volgorde: structuur, dan inhoud, dan laaghangend fruit ──
const GEMENGD: OpruimRegel[] = [
  ...AMSTERDAM,
  { pad: "/hpv-vaccinatie/", uitkomst: "uitbouwen", naar: "", reden: "Te dun voor de vraag.",
    onderbouwing: ["Concurrenten hebben drie keer zoveel tekst."], term: "hpv vaccinatie",
    volume: 9700, klikken: 90, positie: 9, groep: "HPV-vaccinatie" },
];
const LOSSE_METAS: MetaKans[] = [
  { url: "/openingstijden/", keyword: "openingstijden", volume: 400, position: 6, extraClicks: 30, reden: "klikwinst", issues: { desc: ["te kort"] } },
  { url: "/parkeren/", keyword: "parkeren", volume: 100, position: 7, extraClicks: 8, reden: "klikwinst", issues: { desc: ["te kort"] } },
];
const plan2 = bouwWerkplan(GEMENGD, [...METAS, ...LOSSE_METAS], [], [], 3);
const fases = plan2.clusters.map((c) => c.fase);
proef("de fases lopen oplopend: structuur eerst, laaghangend fruit achteraan",
  fases.every((f, i) => i === 0 || f >= fases[i - 1]),
  `fases in volgorde: ${fases.join(", ")}`);
proef("het samenvoeg-cluster zit in fase 1, het uitbouw-cluster in fase 2",
  plan2.clusters.find((c) => c.naam === "Amsterdam")?.fase === 1 &&
  plan2.clusters.find((c) => c.naam === "HPV-vaccinatie")?.fase === 2,
  plan2.clusters.map((c) => `${c.naam}=${c.fase}`).join(" "));
proef("losse titel-kansen zonder cluster komen in fase 3, gebundeld en niet los",
  plan2.clusters.filter((c) => c.fase === 3).length === 1 &&
  plan2.clusters.find((c) => c.fase === 3)?.paginas.length === 2,
  plan2.clusters.filter((c) => c.fase === 3).map((c) => `${c.naam} (${c.paginas.length})`).join(", "));
proef("elke fase heeft een titel en een uitleg waarom hij daar staat",
  FASE_TITEL[1].length > 10 && FASE_TITEL[2].length > 10 && FASE_TITEL[3].length > 10);
proef("de clusters zijn doorgenummerd in de volgorde waarin je ze doet",
  plan2.clusters.map((c) => c.nummer).join(",") === plan2.clusters.map((_, i) => i + 1).join(","),
  plan2.clusters.map((c) => `${c.nummer} ${c.naam}`).join(" | "));

// ── 5. Tijd en weken ──
proef("een redirect kost geen half uur en een nieuwe pagina veel meer",
  MINUTEN.opruimen < MINUTEN.samenvoegen && MINUTEN.samenvoegen < MINUTEN.uitbouwen && MINUTEN.uitbouwen < MINUTEN.nieuw,
  `opruimen=${MINUTEN.opruimen} samenvoegen=${MINUTEN.samenvoegen} uitbouwen=${MINUTEN.uitbouwen} nieuw=${MINUTEN.nieuw}`);
proef("de tijd van een cluster is de som van zijn handelingen",
  amsterdam?.minuten === (MINUTEN.blijft + MINUTEN.meta) + MINUTEN.uitbouwen + MINUTEN.samenvoegen * 3 + MINUTEN.opruimen,
  `minuten=${amsterdam?.minuten}`);
proef("bij een kleiner budget loopt het plan over meer weken",
  bouwWerkplan(GEMENGD, LOSSE_METAS, [], [], 1).weken > bouwWerkplan(GEMENGD, LOSSE_METAS, [], [], 8).weken,
  `1 uur: ${bouwWerkplan(GEMENGD, LOSSE_METAS, [], [], 1).weken} weken, 8 uur: ${bouwWerkplan(GEMENGD, LOSSE_METAS, [], [], 8).weken} weken`);
proef("een cluster wordt nooit midden doorgeknipt over twee weken",
  new Set(plan2.clusters.map((c) => `${c.nummer}`)).size === plan2.clusters.length);
proef("tijd staat er in gewone taal, niet in minuten",
  urenTekst(45) === "45 min" && urenTekst(200) === "3 u 20 min" && urenTekst(120) === "2 uur",
  `${urenTekst(45)} / ${urenTekst(200)} / ${urenTekst(120)}`);

// ── 6. Nu en straks, en wat er per pagina gebeurt ──
proef("het cluster toont de huidige situatie en het beoogde doel apart",
  (amsterdam?.nu.length || 0) >= 3 && (amsterdam?.straks.length || 0) >= 2,
  `nu: ${amsterdam?.nu.map((k) => k.label).join(", ")} | straks: ${amsterdam?.straks.map((k) => k.label).join(", ")}`);
// Van de zes blijven er twee staan: de hoofdpagina en de afspraak-pagina met zijn
// eigen zoekintentie. De vier andere gaan erin op of gaan weg.
proef("straks staat er dat er van 6 pagina's 2 overblijven, gebundeld op de hoofdpagina",
  !!amsterdam?.straks.some((k) => k.label === "pagina's straks" && k.waarde === "2") &&
  !!amsterdam?.straks.some((k) => k.waarde === "/soa-test-amsterdam/"),
  amsterdam?.straks.map((k) => `${k.label}=${k.waarde}`).join(" | "));
proef("elke pagina zegt in gewone taal wat ermee gebeurt",
  paginaRegel(weg) === "gaat op in /soa-test-amsterdam/" &&
  paginaRegel(blijver) === "wordt de hoofdpagina",
  `"${paginaRegel(weg)}" / "${paginaRegel(blijver)}"`);

// ── 7. Een cluster weet of er al aan gewerkt wordt ──
const plan3 = bouwWerkplan(AMSTERDAM, METAS,
  [{ id: 1, thread: "Amsterdam", url: "/soa-test-adam/", status: "gepland", genegeerd: false }],
  [{ url: "/soa-test-amsterdam/", gebeurdeOp: "2026-08-04T09:00:00Z" }], 3);
proef("een cluster ziet dat er al een taak voor loopt en dat er al aan gewerkt is",
  plan3.clusters[0].inPlanning === 1 && plan3.clusters[0].alGedaan === 1,
  `inPlanning=${plan3.clusters[0].inPlanning}, alGedaan=${plan3.clusters[0].alGedaan}`);

// ── 8. Doorgevoerd werk telt niet meer als werk ──
const klaar = bouwWerkplan(
  AMSTERDAM.map((r) => ({ ...r, doorgevoerd: true })), [], [], [], 3);
proef("een cluster waarvan alles al doorgevoerd is, staat niet meer in het plan",
  klaar.clusters.length === 0, `kreeg ${klaar.clusters.length} clusters`);

// ── 9. Leeg blijft leeg, zonder te klappen ──
const leeg = bouwWerkplan([], [], [], [], 3);
proef("zonder data komt er een leeg plan uit en geen fout",
  leeg.clusters.length === 0 && leeg.weken === 0 && leeg.perFase.length === 0);

console.log(fouten === 0 ? "\nAlles klopt: het werkplan is een plan." : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);
