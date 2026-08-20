// ═══════════════════════════════════════════════════════════
// PROEF OP HET OORDEEL VAN HET PAGINA-LAB
// ═══════════════════════════════════════════════════════════
// Vanaf nu geeft het lab zelf een oordeel over een pagina. Dat is precies het
// moment waarop dit gereedschap gevaarlijk kan worden: een model schrijft een
// vloeiend verhaal met of zonder onderbouwing, en van buiten zie je het verschil
// niet. Een bevinding die morgen in een klantrapport belandt, moet terug te
// leiden zijn naar een criterium, een bron en een meting.
//
// De poort staat daarom in de code (`keur` in `lib/pagina-lab/oordeel.ts`) en
// niet in een afspraak. Dit bestand rekent na dat die poort echt dichtzit, met
// verzonnen antwoorden die precies de fouten maken waar we bang voor zijn:
//
//   - een criterium dat niet bestaat;
//   - een oordeel over iets dat gemeten hoort te worden terwijl er niets gemeten is;
//   - een vakoordeel dat zich voordoet als onderbouwd;
//   - twee bevindingen over hetzelfde punt;
//   - een bevinding zonder waarneming.
//
// En één die geen model-fout is maar een gat in ons eigen werk: een criterium
// dat volgens de kennisbank uit een meting moet komen terwijl de meting die
// waarde nooit oplevert. Zo'n criterium kan nooit iets anders worden dan "niet
// vast te stellen", en dan is het beter dat wij dat weten dan Maarten.
// ═══════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CRITERIA, VAKOORDELEN, opId } from "../lib/pagina-lab/kennisbank";
import { naarWaarden, type MetingWaarde, type RuweMeting } from "../lib/pagina-lab/meting";
import { BEVINDING_TOOL, bouwOpdracht, isBase64, keur, opVolgorde, type RuweBevinding } from "../lib/pagina-lab/oordeel";
import type { Opname } from "../lib/pagina-lab/meting";

const WORTEL = join(__dirname, "..");
const lees = (p: string) => readFileSync(join(WORTEL, p), "utf8");

let fouten = 0;
function check(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

// ── Een verzonnen meting, met overal iets in ───────────────
const RUW: RuweMeting = {
  formulier: { velden: 11, zonderLabel: ["telefoon"], verplichtGemarkeerd: 4, optioneelGemarkeerd: 0, metAutomatischInvullen: 2 },
  contrast: { gekeken: 120, teLaag: [{ tekst: "Vraag vrijblijvend een offerte aan", ratio: 2.8, voor: "rgb(150, 150, 150)", achter: "rgb(255, 255, 255)", grootte: 14 }], onbekend: 3 },
  typografie: { kleinste: 12, gangbaar: 16, tekensPerRegel: 96 },
  links: { totaal: 84, vaag: ["Lees meer"] },
  zoom: { geblokkeerd: true, melding: "width=device-width, user-scalable=no" },
  breedte: { scherm: 390, inhoud: 431, uitstekend: ["div.hero"] },
  tikdoelen: { totaal: 52, teKlein: ["Sluiten (18×18)"] },
  overlays: { cookiemelding: true, afdekkend: [{ wat: "div.chat: Kan ik je helpen?", dekking: 22 }] },
  beweging: { autoplayVideo: 1, eindeloosBewegend: 2 },
  knoppen: { totaal: 9, zonderVorm: ["Meer weten"] },
  beeld: { totaal: 14, zonderAlt: 6, grootZonderAlt: ["/beeld/hero.jpg"] },
  snelheid: { lcpMs: 3400, lcpElement: "img.hero", cls: 0.18, ttfbMs: 220, domKlaarMs: 1800 },
};
const METINGEN: MetingWaarde[] = naarWaarden(RUW, "desktop");

// ── 1. Elke meting wijst naar criteria die bestaan ─────────
// Een typefout in een code is stil dodelijk: de meting hangt dan aan niets, en
// het criterium waar hij bij hoorde komt op "niet vast te stellen" te staan
// zonder dat iemand snapt waarom.
for (const m of METINGEN) {
  check(`meting "${m.sleutel}" wijst naar bestaande criteria`, m.criteria.every((c) => !!opId(c)),
    `Onbekend: ${m.criteria.filter((c) => !opId(c)).join(", ")}`);
  check(`meting "${m.sleutel}" heeft een waarde in gewone taal`, m.waarde.trim().length > 2);
}

// ── 2. Elk criterium dat gemeten hoort te worden, wordt gemeten ──
// Deze lijst is een ratel: hij mag alleen korter worden. Staat er een code bij,
// dan is dat een gat in de meting en geen eigenschap van het lab.
const NOG_NIET_TE_METEN = new Set<string>([
  // INT-02 gaat over hoe snel een klik beeld geeft (INP). Dat kun je alleen meten
  // door echt te klikken en te wachten, en dat doet deze meting niet: er is geen
  // manier om te weten wát je op een vreemde pagina veilig kunt aanklikken.
  // Zolang dit hier staat, is INT-02 altijd "niet vast te stellen".
  "INT-02",
]);
const meetbaar = [...CRITERIA, ...VAKOORDELEN].filter((p) => p.vaststellen === "meting");
for (const p of meetbaar) {
  const heeft = METINGEN.some((m) => m.criteria.includes(p.id));
  if (NOG_NIET_TE_METEN.has(p.id)) {
    check(`${p.id} staat bekend als nog niet te meten`, !heeft,
      "Dit criterium wordt inmiddels wél gemeten. Haal hem van de lijst NOG_NIET_TE_METEN af.");
    continue;
  }
  check(`${p.id} (${p.titel}) heeft een meting`, heeft,
    "Dit criterium hoort uit een meting te komen, maar er is geen meetwaarde die ernaar wijst. Voeg hem toe in lib/pagina-lab/meting.ts, of zet de code op de lijst NOG_NIET_TE_METEN met de reden erbij.");
}

// ── 3. De poort op de bevindingen ──────────────────────────
const ANTWOORD: RuweBevinding[] = [
  { criterium: "CONV-04", stand: "mis", wat: "Het aanvraagformulier heeft elf velden, waarvan er vier verplicht zijn.", advies: "Schrap de velden die je pas in het gesprek nodig hebt." },
  { criterium: "CONV-04", stand: "goed", wat: "Tweede oordeel over hetzelfde punt, dit hoort te verdwijnen." },
  { criterium: "CONV-99", stand: "mis", wat: "Een criterium dat niet bestaat, met een heel geloofwaardig verhaal eronder." },
  { criterium: "VAK-01", stand: "kan beter", wat: "Het telefoonnummer staat pas in de voettekst, op mobiel dus na acht schermen scrollen.", advies: "Zet het nummer in de kopbalk." },
  { criterium: "BRUIK-03", stand: "goed", wat: "Kort" },
  { criterium: "INT-02", stand: "goed", wat: "Klikken voelde soepel aan, alles reageerde direct.", advies: "" },
  { criterium: "BRUIK-01", stand: "mis", wat: "De tekst boven de knop staat op 2,8:1 en dat is onder de norm van 4,5:1.", advies: "Maak het grijs donkerder." },
];

const { bevindingen, opmerkingen } = keur(ANTWOORD, METINGEN);
const bij = (code: string) => bevindingen.find((b) => b.criterium === code);

check("een verzonnen criterium wordt weggegooid", !bij("CONV-99"),
  "Zonder deze grens verzint een model er een criterium bij dat nergens op rust.");
check("het weggooien wordt gemeld", opmerkingen.some((o) => o.includes("CONV-99")),
  "Stil weglaten maakt een oordeel completer dan het is.");
check("een tweede bevinding over hetzelfde punt vervalt", bevindingen.filter((b) => b.criterium === "CONV-04").length === 1);
check("een bevinding zonder waarneming vervalt", !bij("BRUIK-03"), "\"Kort\" is geen waarneming over deze pagina.");

const conv04 = bij("CONV-04");
check("een gemeten criterium houdt zijn oordeel", conv04?.stand === "mis");
check("en krijgt de meting eronder", !!conv04?.vastgesteldUit.some((v) => v.startsWith("Meting:")),
  `Stond er: ${conv04?.vastgesteldUit.join(" | ")}`);
check("het waarom komt uit de kennisbank, niet uit het model",
  conv04?.waarom === CRITERIA.find((c) => c.id === "CONV-04")?.waarom,
  "Het model mag nooit zelf de onderbouwing schrijven; dan komt er een verzonnen onderzoek in een klantrapport.");
check("en de bron staat erbij", (conv04?.bronnen.length || 0) > 0);

const int02 = bij("INT-02");
check("een gemeten criterium zonder meting wordt \"niet vast te stellen\"", int02?.stand === "niet vast te stellen",
  `Stond er: ${int02?.stand}. Het model zei "goed" op iets dat niemand gemeten heeft.`);
check("en het advies vervalt daarbij", (int02?.advies || "") === "");
check("met een melding waarom", opmerkingen.some((o) => o.includes("INT-02")));

const vak01 = bij("VAK-01");
check("een vakoordeel blijft een vakoordeel", vak01?.plank === "vakoordeel");
check("een vakoordeel krijgt nooit een bron", (vak01?.bronnen.length || 0) === 0,
  "Een mening met een bronvermelding eronder is precies wat de twee planken moeten voorkomen.");
check("en draagt de waarschuwing mee", (vak01?.waarom || "").includes("geen onderzoek"),
  "Overal waar een vakoordeel in beeld komt, hoort de waarschuwing mee te reizen.");

const nietLangs = opmerkingen.find((o) => o.startsWith("Niet langsgelopen"));
check("criteria die niet beoordeeld zijn, worden benoemd", !!nietLangs && nietLangs.includes("CONV-01"),
  "Anders lijkt een pagina goedgekeurd op punten waar niemand naar gekeken heeft.");

// ── 4. Het model kan de onderbouwing niet zelf invullen ────
const velden = Object.keys((BEVINDING_TOOL.input_schema as { properties: { bevindingen: { items: { properties: Record<string, unknown> } } } }).properties.bevindingen.items.properties);
check("het model levert geen waarom, geen bron en geen weging aan",
  !velden.some((v) => /waarom|bron|weegt|discipline|titel/i.test(v)),
  `Velden nu: ${velden.join(", ")}. Die horen uit de kennisbank te komen, niet uit het antwoord.`);

// ── 5. De volgorde is berekend, niet gevoeld ───────────────
const volgorde = opVolgorde(bevindingen);
check("wat mis is en zwaar weegt staat bovenaan", volgorde[0]?.stand === "mis",
  `Bovenaan stond: ${volgorde[0]?.criterium} (${volgorde[0]?.stand})`);
check("wat niet vast te stellen is, staat niet bovenaan", volgorde[0]?.stand !== "niet vast te stellen");

// ── 6. De opdracht bevat waar het oordeel op moet rusten ───
const opname = { bron: { url: "https://voorbeeld.nl/dienst/", eindUrl: "https://voorbeeld.nl/dienst/", status: 200, titel: "Dienst", omschrijving: "", canoniek: "", robots: "", taal: "nl", koppen: [{ niveau: 1, tekst: "Onze dienst", zichtbaar: true, y: 120 }], tekst: "Wij doen dit werk al twintig jaar.", woorden: 7, links: [], beelden: [], formulierVelden: 11, knoppen: ["Offerte aanvragen"], hoogte: 4200 }, ruw: RUW, meting: METINGEN, apparaat: "desktop", eersteScherm: "", paginaHoogte: 4200 } as unknown as Opname;
const opdracht = bouwOpdracht(opname, null, null);
check("de criteria staan in de opdracht", opdracht.includes("CONV-01") && opdracht.includes("VAK-06"));
check("de meting staat in de opdracht, met sleutels", opdracht.includes("[contrast.telaag]"));
check("de pagina zelf staat in de opdracht", opdracht.includes("Onze dienst"));
check("zonder cijfers over bezoekers zegt de opdracht dat ook",
  opdracht.includes("geen cijfers over bezoekers"),
  "Anders verzint het model iets over hoe de pagina het doet.");

// ── 7. Het scherm houdt de twee planken uit elkaar ─────────
const paneel = lees("app/admin/pagina-lab/OordeelPaneel.tsx");
check("het scherm toont de waarschuwing bij het vakoordeel", paneel.includes("VAKOORDEEL_WAARSCHUWING"));
check("het scherm zet het vakoordeel in een eigen paneel", /Vakoordeel van Pingwin over deze pagina/.test(paneel));
check("het scherm toont de foto naast het oordeel", paneel.includes("pl-naast") && paneel.includes("pl-fotos"));
check("het scherm toont ook de meting", paneel.includes("De meting waar dit op rust"));
check("het scherm toont wat er is afgevallen", paneel.includes("opmerkingen"));
check("de tekst gaat door de gedeelde opmaak", !paneel.includes("dangerouslySetInnerHTML"),
  "Losse tekst hoort door <Tekst> te gaan, dus door mdToHtml.");

// ── 8. Het oordeel bewaart niets ───────────────────────────
// Dubbelop met pagina-lab-schrijft-niet.proef.ts, en met opzet: die kijkt naar
// mappen, deze naar de belofte die op het scherm staat. Zodra het lab wél gaat
// bewaren, moeten ze allebei mee, inclusief de zin die Maarten leest.
check("het scherm belooft niet dat er iets bewaard wordt",
  paneel.includes("Er wordt niets bewaard"),
  "Zolang het lab niets opslaat, moet dat er staan; anders zoekt Maarten later naar een oordeel dat er niet meer is.");


// ── 9. Een schermfoto die geen schermfoto is ───────────────
// Puppeteer geeft een foto terug als Uint8Array, en .toString("base64") daarop
// maakt er "255,216,255,…" van. Dat ziet er als string prima uit, komt overal
// doorheen, en sneuvelt pas bij de API, ná twee paginabezoeken. Dit is precies
// de fout die de eerste echte beoordeling liet mislukken.
check("een rij getallen gaat niet door voor een foto", !isBase64("255,216,255,224,0,16,74,70,73,70".repeat(20)));
check("echte base64 komt er wel doorheen", isBase64("a".repeat(200) + "=="));

console.log(fouten ? `\n${fouten} fout(en) in het oordeel van het Pagina-lab.` : "\nHet oordeel van het Pagina-lab rust op criteria, meting en foto.");
if (fouten) process.exit(1);
