/* eslint-disable @typescript-eslint/no-explicit-any */
// De bouwstenen van de Pingwin-huisstijl in Word, nagebouwd naar het rapport uit
// de skill pingwin-huisstijl (het Tudor Kozijnen-groeiplan).
//
// Wat tekst is, blijft tekst: selecteren, kopiëren en aanpassen werkt overal.
// Alleen de omslag en de ronde nummer-bolletjes zijn afbeeldingen, want die
// vormen kan Word niet tekenen op een plek waar tekst omheen loopt.

import { BOLLETJES } from "./beelden";
import { START, EIND, hoogteVan, type VormOpties } from "./vorm";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const D: any = require("docx");
const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle,
        AlignmentType, ImageRun, VerticalAlign } = D;

export const T = {
  font: "Montserrat",
  oranje: "F15829", peach: "F8DABC", peachLicht: "FDF3E7", inkt: "2F2A2A",
  grijs: "84796B", lijn: "F0E7DF", body: "4A443D", groen: "3E9E4C",
  groenSoft: "E3F4E5", rood: "C8442C", roodSoft: "FBE6DF", neutraal: "EFECE9",
  gradBlauw: "C7E2EB", gradPeach: "F8DABC",
};

const NONE = { style: BorderStyle.NONE, size: 0, color: "auto" };
export const GEEN_RAND = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
export const lijnRand = (kleur = T.lijn, sz = 4) => ({ style: BorderStyle.SINGLE, size: sz, color: kleur });

export const run = (text: string, o: any = {}) => new TextRun({
  text, font: T.font, size: o.size || 21, bold: !!o.bold, italics: !!o.italics,
  color: o.color || T.body, characterSpacing: o.spacing,
});
export const runs = (text: string, o: any = {}) => String(text ?? "").split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  .map((s) => /^\*\*[^*]+\*\*$/.test(s) ? run(s.slice(2, -2), { ...o, bold: true }) : run(s, o));
export const P = (text: string, o: any = {}) => new Paragraph({
  children: runs(text, o), alignment: o.midden ? AlignmentType.CENTER : undefined,
  spacing: { before: o.voor ?? 0, after: o.na ?? 140, line: o.regel ?? 320 },
});
export const cel = (children: any[], o: any = {}) => new TableCell({
  children, shading: o.fill ? { type: "clear", fill: o.fill } : undefined,
  margins: { top: o.pt ?? 120, bottom: o.pb ?? 120, left: o.pl ?? 160, right: o.pr ?? 160 },
  borders: o.borders || GEEN_RAND, verticalAlign: o.mid ? VerticalAlign.CENTER : undefined,
});
export const tabel = (rows: any[], o: any = {}) => new Table({
  rows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: o.borders || GEEN_RAND, columnWidths: o.cols,
});
const leeg = (na: number) => new Paragraph({ spacing: { after: na }, children: [] });

// ── kaders ────────────────────────────────────────────────────
// Elk kader registreert zijn vormgeving; na het bouwen zet verwerkVormen() ze om
// in echte vormen met afgeronde hoeken.

export class Kaders {
  private n = 0;
  readonly opties: Record<number, VormOpties> = {};
  wikkel(o: VormOpties, kinderen: any[]): any[] {
    const id = ++this.n;
    this.opties[id] = o;
    return [
      new Paragraph({ children: [new TextRun({ text: START(id), size: 2 })] }),
      ...kinderen,
      new Paragraph({ children: [new TextRun({ text: EIND(id), size: 2 })] }),
    ];
  }
}

const bolletje = (soort: "sec" | "stap", nr: number) => new Paragraph({
  spacing: { after: 0 },
  children: [new ImageRun({
    type: "png", data: Buffer.from(BOLLETJES[`${soort}${Math.min(Math.max(nr, 1), 9)}`], "base64"),
    transformation: { width: 26, height: 26 },
  })],
});

/** Sectiekop met oranje nummer-bolletje en klein labeltje erboven. */
export function sectiekop(nr: number, label: string, kop: string): any[] {
  return [
    tabel([new TableRow({ children: [
      cel([bolletje("sec", nr)], { pl: 0, pt: 60 }),
      cel([
        ...(label ? [P(label.toUpperCase(), { bold: true, size: 16, color: T.oranje, spacing: 28, na: 40 })] : []),
        P(kop, { bold: true, size: 30, color: T.inkt, regel: 300, na: 0 }),
      ], { pl: 0, pt: 0 }),
    ] })], { cols: [700, 8300] }),
    leeg(180),
  ];
}

/** Kop uit de copy zelf (H1/H2/H3): het niveau als labeltje, dan de kop. */
export function copyKop(niveau: string, kop: string): any[] {
  const maat = niveau === "H1" ? 30 : niveau === "H2" ? 25 : 22;
  return [
    // Zonder niveau (een werkdocument) alleen de kop, anders zou er een leeg
    // oranje labeltje boven staan.
    ...(niveau ? [P(niveau.toUpperCase(), { bold: true, size: 16, color: T.oranje, spacing: 28, voor: 200, na: 60 })] : []),
    P(kop, { bold: true, size: maat, color: T.inkt, voor: niveau ? 0 : 220, na: 120 }),
  ];
}

export function callout(k: Kaders, kop: string, tekst: string): any[] {
  return k.wikkel({
    naam: "Callout", radius: 6500, breedte: 650, hoogte: hoogteVan(tekst, 600, 17, kop ? 62 : 40),
    vulling: { kleur: T.peachLicht }, rand: T.oranje, randDikte: 1.5,
    marges: { links: 22, rechts: 22, boven: 16, onder: 16 }, na: 260,
  }, [
    ...(kop ? [P(kop, { bold: true, size: 24, color: T.inkt, na: 60 })] : []),
    P(tekst, { size: 21, na: 0 }),
  ]);
}

export function stapkaart(k: Kaders, nr: number, titel: string, tekst: string): any[] {
  return k.wikkel({
    naam: `Stap ${nr}`, radius: 8000, breedte: 650, hoogte: hoogteVan(tekst, 600, 17, 74),
    vulling: { kleur: "FFFFFF" }, rand: T.lijn, randDikte: 1,
    marges: { links: 20, rechts: 20, boven: 16, onder: 16 }, na: 180,
  }, [
    tabel([new TableRow({ children: [
      cel([bolletje("stap", nr)], { pl: 0, pt: 0 }),
      cel([P(titel, { bold: true, size: 23, color: T.inkt, na: 0 })], { pl: 0, pt: 60, mid: true }),
    ] })], { cols: [620, 7600] }),
    P(tekst, { size: 20, na: 0, regel: 300, voor: 100 }),
  ]);
}

export function citaat(k: Kaders, tekst: string, wie = "Maarten van Pingwin"): any[] {
  return k.wikkel({
    naam: "Citaat", radius: 7000, breedte: 650, hoogte: hoogteVan(tekst, 590, 19, 78),
    vulling: { verloop: [T.gradBlauw, T.gradPeach], hoek: 228, alpha: 40000, alpha2: 62000 },
    schaduw: { blur: 20, dist: 7, alpha: 13000 },
    marges: { links: 26, rechts: 26, boven: 20, onder: 20 }, na: 260,
  }, [
    P(`“${tekst}”`, { italics: true, size: 24, color: T.inkt, na: 60 }),
    P(`– ${wie}`, { bold: true, size: 24, color: T.oranje, na: 0 }),
  ]);
}

/** Status-pil: een echte pil-vorm met tekst erin. */
function pil(k: Kaders, tekst: string, kleurTekst: string, kleurVlak: string): any[] {
  return k.wikkel({
    naam: `Pil ${tekst}`, radius: 50000, breedte: 96, hoogte: 19, vast: true,
    vulling: { kleur: kleurVlak }, marges: { links: 3, rechts: 3, boven: 1, onder: 1 },
    midden: true, na: 0,
  }, [P(tekst, { bold: true, size: 14, color: kleurTekst, spacing: 16, na: 0, regel: 200, midden: true })]);
}

export type KpiRegel = { label: string; waarde: string; verschil?: string; status?: "goed" | "actie" | "neutraal" };

/**
 * KPI-kaart met status-pillen.
 * Let op: een vorm in een vorm mag niet, dus de kaart eromheen is een tabel met
 * een oranje balk links; alleen de pillen erin zijn vormen.
 */
export function kpiblok(k: Kaders, regels: KpiRegel[]): any[] {
  const pilVan = (s?: string): [string, string, string] => s === "goed" ? ["GOED", T.groen, T.groenSoft]
    : s === "actie" ? ["ACTIE", T.rood, T.roodSoft] : ["NEUTRAAL", "6B6157", T.neutraal];
  const kop = new TableRow({ tableHeader: true, children: ["", "waarde", "verschil", "status"].map((h) => cel(
    [P(h.toUpperCase(), { bold: true, size: 15, color: T.grijs, spacing: 24, na: 0 })],
    { pt: 100, pb: 90, borders: { bottom: lijnRand() } })) });
  const rijen = regels.map((r, i) => {
    const b = { bottom: i === regels.length - 1 ? NONE : lijnRand() };
    const [tk, kl, vl] = pilVan(r.status);
    return new TableRow({ children: [
      cel([P(r.label, { bold: true, size: 20, color: T.inkt, na: 0 })], { pt: 130, pb: 130, borders: b }),
      cel([P(r.waarde, { bold: true, size: 26, color: T.inkt, na: 0 })], { pt: 130, pb: 130, borders: b }),
      cel([P(r.verschil || "—", { bold: true, size: 20, color: r.verschil ? T.groen : "B7AEA4", na: 0 })], { pt: 130, pb: 130, borders: b }),
      cel(pil(k, tk, kl, vl), { pt: 130, pb: 130, borders: b }),
    ] });
  });
  return [
    tabel([new TableRow({ children: [
      cel([], { fill: T.oranje, pl: 0, pr: 0 }),
      cel([tabel([kop, ...rijen], { cols: [3100, 2000, 1400, 1700] })],
        { pt: 60, pb: 60, pl: 240, pr: 200, borders: { top: lijnRand(), bottom: lijnRand(), right: lijnRand() } }),
    ] })], { cols: [60, 8940] }),
    leeg(260),
  ];
}

export function datatabel(headers: string[], rijen: string[][], breedtes?: number[]): any[] {
  const cols = breedtes || headers.map(() => Math.floor(9000 / headers.length));
  const kop = new TableRow({ tableHeader: true, children: headers.map((h) => cel(
    [P(String(h).toUpperCase(), { bold: true, size: 16, color: T.inkt, spacing: 24, na: 0 })],
    { fill: T.peachLicht, pt: 140, pb: 120, borders: { bottom: lijnRand() } })) });
  const body = rijen.map((r, ri) => new TableRow({ children: headers.map((_, ci) => cel(
    [P(r[ci] ?? "", { size: 20, na: 0, regel: 280, bold: ci === 0, color: ci === 0 ? T.inkt : T.body })],
    { pt: 160, pb: 160, borders: { bottom: ri === rijen.length - 1 ? NONE : lijnRand() } })) }));
  return [tabel([kop, ...body], { cols }), leeg(220)];
}

export const subkop = (t: string) => P(t, { bold: true, size: 23, color: T.inkt, voor: 160, na: 80 });
export const bullet = (t: string) => new Paragraph({
  bullet: { level: 0 }, spacing: { after: 80, line: 300 }, children: runs(t),
});
export const codeRegels = (tekst: string) => (tekst || "").replace(/\r/g, "").split("\n").map((r, i, a) =>
  new Paragraph({
    spacing: { after: i === a.length - 1 ? 160 : 0, line: 240 },
    shading: { type: "clear", fill: "F5F3F0" },
    children: [new TextRun({ text: r || " ", font: "Courier New", size: 15 })],
  }));
