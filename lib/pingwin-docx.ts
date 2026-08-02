/* eslint-disable @typescript-eslint/no-explicit-any */
import { PINGWIN_LOGO_BASE64 } from "./pingwin-logo";
import { Kaders, T, sectiekop, copyKop, callout, stapkaart, citaat, kpiblok,
         datatabel, subkop, bullet, codeRegels, P, cel, tabel, GEEN_RAND, lijnRand,
         run, type KpiRegel } from "./huisstijl/blokken";
import { verwerkVormen } from "./huisstijl/vorm";
import { omslagPng, OMSLAG_BREEDTE, OMSLAG_HOOGTE } from "./huisstijl/omslag";

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
  | { type: "table"; headers: string[]; rows: string[][] }
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
  /** Optioneel: de klantpagina waarvan een sfeerbeeld op de omslag komt. */
  sfeerbeeldUrl?: string;
  /** Optioneel: het citaat onder aan het document. Leeg = geen citaatblok. */
  slotcitaat?: string;
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
    cel([P(String(v), { size: 20, na: 0 })], { pt: 120, pb: 120 }),
  ] }));
  return [
    P("Pingwin rapportage".toUpperCase(), { bold: true, size: 16, color: T.oranje, spacing: 28, na: 120 }),
    P(spec.titel, { bold: true, size: 46, color: T.inkt, regel: 480, na: 120 }),
    ...(spec.ondertitel ? [P(spec.ondertitel, { size: 24, color: "5D564E", na: 200 })] : []),
    ...(rijen.length ? [tabel(rijen, { cols: [2200, 6800] }), new Paragraph({ spacing: { after: 320 }, children: [] })] : []),
  ];
}

const KOP_NIVEAU = /^\s*(H[123])\s*[—–-]\s*(.*)$/;

export async function buildPingwinDoc(spec: DocSpec): Promise<Buffer> {
  const kaders = new Kaders();
  const kids: any[] = [];

  // ── omslag ──────────────────────────────────────────────────
  const png = await omslagPng({
    kicker: spec.rapporttype || "Pingwin rapportage",
    titel: spec.titel,
    ondertitel: spec.ondertitel,
    meta: { Klant: spec.klant, ...(spec.meta || {}) },
  }, spec.sfeerbeeldUrl).catch(() => null);
  omslagGelukt = !!png;
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
  let secNr = 0;
  for (const sec of spec.sections || []) {
    if (sec.heading) {
      const m = KOP_NIVEAU.exec(sec.heading);
      if (m) kids.push(...copyKop(m[1], m[2]));
      else kids.push(...sectiekop(++secNr, "", sec.heading));
    }
    for (const b of sec.blocks || []) {
      try {
        if (b.type === "paragraph" && b.text) kids.push(P(b.text));
        else if (b.type === "subheading" && b.text) {
          const m = KOP_NIVEAU.exec(b.text);
          if (m) kids.push(...copyKop(m[1], m[2]));
          else kids.push(subkop(b.text));
        }
        else if (b.type === "bullets" && b.items?.length) kids.push(...b.items.map(bullet));
        else if (b.type === "highlight" && b.text) kids.push(...callout(kaders, "", b.text));
        else if (b.type === "step") kids.push(...stapkaart(kaders, b.nr, b.title, b.text));
        else if (b.type === "kpi" && b.rows?.length) kids.push(...kpiblok(kaders, b.rows));
        else if (b.type === "table" && b.headers?.length && b.rows?.length) kids.push(...datatabel(b.headers, b.rows));
        else if (b.type === "code" && b.text) kids.push(...codeRegels(b.text));
      } catch { /* sla een fout blok over, breek het document niet */ }
    }
  }

  if (spec.slotcitaat) kids.push(...citaat(kaders, spec.slotcitaat));

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
