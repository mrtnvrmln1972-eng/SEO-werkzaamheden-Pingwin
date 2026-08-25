/* eslint-disable @typescript-eslint/no-explicit-any */
import { PINGWIN_LOGO_BASE64 } from "./pingwin-logo";
import { Kaders, T, sectiekop, copyKop, callout, stapkaart, citaat, kpiblok,
         datatabel, subkop, bullet, codeRegels, P, cel, tabel, GEEN_RAND, lijnRand,
         run, type KpiRegel } from "./huisstijl/blokken";
import { verwerkVormen } from "./huisstijl/vorm";
import { omslagPng, OMSLAG_BREEDTE, OMSLAG_HOOGTE } from "./huisstijl/omslag";
import { zonderLosStreepje } from "./streepjes";

// Elk Pingwin-document (analyse, blauwdruk, copy, en alles daaromheen) komt
// hier samen vóór het naar .docx wordt gebakken. Dit is dus de plek om de
// schrijfregel "geen los liggend lang streepje" af te dwingen MET
// TERUGWERKENDE KRACHT op elk documenttype, ongeacht welke systeemprompt de
// tekst maakte en of die prompt de regel noemt of vergeet. Dezelfde aanpak als
// lib/markdown.ts voor de chat/kaarten: een model houdt zich niet met
// zekerheid aan een stijlregel, deze functie op de weergave-/renderlaag wel.
// Nooit een tekstveld aan een Word-blok geven zonder hierdoorheen; proeven/
// streepjes.proef.ts bewaakt dat.

// Bouwt een .docx in de Pingwin-huisstijl uit een gestructureerde inhoud.
//
// De vormgeving volgt het rapport uit de skill pingwin-huisstijl: omslag met
// kleurverloop, sectiekoppen met nummer-bolletje, stappenkaarten en callouts met
// afgeronde hoeken, KPI-kaart met status-pillen, en een citaatblok met verloop.
//
// Word is bewust het opleverformaat: de klant moet de tekst kunnen aanpassen en
// de sitebouwer moet kunnen knippen en plakken. Alles wat tekst is, is dus echte
// tekst; alleen de omslag en de nummer-bolletjes zijn beeld.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Document, Packer, Paragraph, TextRun, Header, Footer, ImageRun, Table, TableRow,
        TableCell, WidthType, AlignmentType, BorderStyle, PageNumber }: any = require("docx");

export type DocBlock =
  | { type: "paragraph"; text: string }
  | { type: "subheading"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "highlight"; text: string }
  | { type: "step"; nr: number; title: string; text: string }
  | { type: "table"; headers: string[]; rows: string[][]; cols?: number[] }
  | { type: "kpi"; rows: KpiRegel[] }
  | { type: "code"; text: string };

export type DocSection = { heading?: string; blocks: DocBlock[] };
export type DocSpec = {
  klant: string;
  rapporttype: string;
  titel: string;
  ondertitel?: string;
  meta?: Record<string, string>;
  sections: DocSection[];
  /**
   * Optioneel: de klantpagina waarvan een sfeerbeeld op de omslag komt. Bestaat
   * die pagina nog niet (een nieuw te bouwen pagina geeft een 404), dan valt de
   * omslag vanzelf terug op de homepage van dezelfde site; nooit een foutpagina
   * als hoofdbeeld.
   */
  sfeerbeeldUrl?: string;
  /** Optioneel: het citaat onder aan het document. Leeg = geen citaatblok. */
  slotcitaat?: string;
  /**
   * "rapport" (standaard) is de volle huisstijl: omslag met kleurverloop en
   * sfeerbeeld, sectiekoppen met nummer-bolletje. Voor alles wat de klant ziet.
   *
   * "werkdocument" is de sobere variant: dezelfde typografie en kleuren, maar
   * zonder omslag en zonder nummers. Voor stukken die alleen intern of tussendoor
   * gebruikt worden, zoals een samengevoegde geldende versie. Daar is een
   * rapportomslag misplaatst, en het scheelt ook nog een browserstart.
   */
  stijl?: "rapport" | "werkdocument";
};

const logoBuffer = () => Buffer.from(PINGWIN_LOGO_BASE64, "base64");

// Viel de omslag terug op de tekst-versie? De terugval is bewust stil (liever een
// sobere omslag dan een kapot document), maar stil betekende ook: onopgemerkt.
// Maarten kreeg maandenlang een kaal document zonder dat iets dat meldde. De
// routes lezen dit uit en zeggen het erbij.
let omslagGelukt = true;
export function laatsteOmslagGelukt(): boolean { return omslagGelukt; }

function kopregel(klant: string, rapporttype: string): any {
  const merk = [klant, rapporttype].filter(Boolean).join("  ·  ");
  return new Header({ children: [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [6000, 3000], borders: GEEN_RAND,
      rows: [new TableRow({ children: [
        new TableCell({ borders: GEEN_RAND, margins: { left: 0 }, children: [
          new Paragraph({ spacing: { after: 40 }, children: [run(merk, { bold: true, size: 16, color: T.oranje, spacing: 20 })] }),
        ] }),
        new TableCell({ borders: GEEN_RAND, margins: { right: 0 }, children: [
          new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 40 },
            children: [new ImageRun({ type: "jpg", data: logoBuffer(), transformation: { width: 96, height: 25 } })] }),
        ] }),
      ] })],
    }),
    new Paragraph({ spacing: { after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: T.oranje, space: 4 } }, children: [] }),
  ] });
}

function voetregel(): any {
  return new Footer({ children: [
    new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: T.lijn, space: 8 } }, spacing: { before: 60 }, children: [] }),
    new Paragraph({ children: [
      run("pingwin.nl", { bold: true, size: 16, color: T.oranje }),
      run("\t\tPagina ", { size: 16, color: T.grijs }),
      new TextRun({ children: [PageNumber.CURRENT], font: T.font, size: 16, color: T.grijs }),
      run(" / ", { size: 16, color: T.grijs }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], font: T.font, size: 16, color: T.grijs }),
    ] }),
  ] });
}

// Terugval als de omslag niet gerenderd kan worden: dezelfde gegevens, maar dan
// als gewone tekst. Liever een sobere omslag dan een kapotte afbeelding.
function tekstOmslag(spec: DocSpec): any[] {
  const rijen = Object.entries(spec.meta || {}).map(([k, v]) => new TableRow({ children: [
    cel([P(k.toUpperCase(), { bold: true, size: 16, color: T.inkt, spacing: 24, na: 0 })], { fill: T.peachLicht, pt: 120, pb: 120 }),
    cel([P(zonderLosStreepje(String(v)), { size: 20, na: 0 })], { pt: 120, pb: 120 }),
  ] }));
  return [
    P("Pingwin rapportage".toUpperCase(), { bold: true, size: 16, color: T.oranje, spacing: 28, na: 100 }),
    // `regel` telt in 240sten van een regel, niet in punten: 480 was dus dubbele
    // regelafstand. Bij een titel van drie regels stonden die zo ver uit elkaar
    // dat het halve blad eraan opging. Maartens woorden (25-08-2026): "de titel
    // ziet er heel groot en omslachtig uit, met een grote regelafstand, dat mag
    // gewoon veel compacter en korter achter elkaar." Nu 18pt op iets meer dan
    // één regel, dus de regels sluiten aan.
    P(zonderLosStreepje(spec.titel), { bold: true, size: 36, color: T.inkt, regel: 250, na: 100 }),
    ...(spec.ondertitel ? [P(zonderLosStreepje(spec.ondertitel), { size: 22, color: "5D564E", regel: 260, na: 180 })] : []),
    ...(rijen.length ? [tabel(rijen, { cols: [2200, 6800] }), new Paragraph({ spacing: { after: 320 }, children: [] })] : []),
  ];
}

// "H2 — Tuinaanleg in Oss" en "H2 · Tuinaanleg in Oss" horen allebei bij deze
// vorm. De middelste punt stond er niet in, waardoor een kop uit een
// ondersteunend stuk als gewone subkop werd gezet en het H-nummer dus als losse
// tekst in beeld kwam in plaats van als label (25-08-2026).
const KOP_NIVEAU = /^\s*(H[123])\s*[—–·-]\s*(.*)$/;

/**
 * De pagina zelf, en als terugval de homepage van dezelfde site. Een copy-doc
 * gaat vaak over een pagina die nog gebouwd moet worden; die URL geeft dan een
 * 404-scherm, en dat hoort niet als hoofdbeeld op een klantdocument.
 */
function sfeerbeeldKandidaten(url?: string): string[] {
  if (!url) return [];
  try {
    const u = new URL(url);
    return u.pathname === "/" ? [u.href] : [u.href, `${u.origin}/`];
  } catch { return [url]; }
}

export async function buildPingwinDoc(spec: DocSpec): Promise<Buffer> {
  const kaders = new Kaders();
  const kids: any[] = [];

  // ── omslag ──────────────────────────────────────────────────
  // Een werkdocument krijgt geen rapportomslag: dat is een tussenstuk, geen
  // oplevering. Scheelt ook een browserstart.
  const werkdocument = spec.stijl === "werkdocument";
  const png = werkdocument ? null : await omslagPng({
    kicker: spec.rapporttype || "Pingwin rapportage",
    titel: zonderLosStreepje(spec.titel),
    ondertitel: spec.ondertitel ? zonderLosStreepje(spec.ondertitel) : spec.ondertitel,
    meta: Object.fromEntries(Object.entries({ Klant: spec.klant, ...(spec.meta || {}) }).map(([k, v]) => [k, zonderLosStreepje(String(v))])),
  }, sfeerbeeldKandidaten(spec.sfeerbeeldUrl)).catch(() => null);
  omslagGelukt = werkdocument || !!png;
  if (png) {
    kids.push(new Paragraph({ spacing: { after: 340 }, children: [new ImageRun({
      type: "png", data: png, transformation: { width: OMSLAG_BREEDTE, height: OMSLAG_HOOGTE },
    })] }));
  } else {
    kids.push(...tekstOmslag(spec));
  }

  // ── secties ────────────────────────────────────────────────
  // Alleen de eigen secties van het rapport krijgen een nummer-bolletje. Koppen
  // die uit de copy zelf komen ("H2 — Tuinaanleg in Oss") houden hun niveau als
  // labeltje, want die horen bij de webtekst en niet bij ons rapport.
  // KOP_NIVEAU matcht op de RUWE tekst (het "H2 — Titel"-label gebruikt zelf een
  // gedachtestreepje als vaste vorm); pas ná die match wordt het overgebleven
  // stuk kop- of looptekst opgeschoond, zodat de match nooit breekt.
  let secNr = 0;
  for (const sec of spec.sections || []) {
    if (sec.heading) {
      const m = KOP_NIVEAU.exec(sec.heading);
      if (m) kids.push(...copyKop(m[1], zonderLosStreepje(m[2])));
      else if (werkdocument) kids.push(...copyKop("", zonderLosStreepje(sec.heading)));
      else kids.push(...sectiekop(++secNr, "", zonderLosStreepje(sec.heading)));
    }
    for (const b of sec.blocks || []) {
      try {
        if (b.type === "paragraph" && b.text) kids.push(P(zonderLosStreepje(b.text)));
        else if (b.type === "subheading" && b.text) {
          const m = KOP_NIVEAU.exec(b.text);
          if (m) kids.push(...copyKop(m[1], zonderLosStreepje(m[2])));
          else kids.push(subkop(zonderLosStreepje(b.text)));
        }
        else if (b.type === "bullets" && b.items?.length) kids.push(...b.items.map((i) => bullet(zonderLosStreepje(i))));
        else if (b.type === "highlight" && b.text) kids.push(...callout(kaders, "", zonderLosStreepje(b.text)));
        else if (b.type === "step") kids.push(...stapkaart(kaders, b.nr, zonderLosStreepje(b.title), zonderLosStreepje(b.text)));
        else if (b.type === "kpi" && b.rows?.length) kids.push(...kpiblok(kaders, b.rows.map((r) => ({
          ...r, label: zonderLosStreepje(r.label), waarde: zonderLosStreepje(r.waarde),
          verschil: r.verschil ? zonderLosStreepje(r.verschil) : r.verschil,
        }))));
        else if (b.type === "table" && b.headers?.length && b.rows?.length)
          kids.push(...datatabel(b.headers.map(zonderLosStreepje), b.rows.map((r) => r.map(zonderLosStreepje)), b.cols));
        // Code-blokken blijven letterlijk (JSON/markup), daar hoort geen tekstopschoning in.
        else if (b.type === "code" && b.text) kids.push(...codeRegels(b.text));
      } catch { /* sla een fout blok over, breek het document niet */ }
    }
  }

  if (spec.slotcitaat) kids.push(...citaat(kaders, zonderLosStreepje(spec.slotcitaat)));

  // Vangnet: geneste arrays platslaan en losse primitieven eruit, zodat er nooit
  // een ongeldig element in de XML kan lekken.
  const schoon = (kids as unknown[]).flat(Infinity).filter((c) => c && typeof c === "object");

  const doc = new Document({
    styles: { default: { document: { run: { font: T.font, size: 21, color: T.body } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1400, right: 1080, bottom: 1080, left: 1080 } } },
      headers: { default: kopregel(spec.klant || "", spec.rapporttype || "") },
      footers: { default: voetregel() },
      children: schoon,
    }],
  });

  const ruw = (await Packer.toBuffer(doc)) as Buffer;
  return verwerkVormen(ruw, kaders.opties);
}
