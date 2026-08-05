/* eslint-disable @typescript-eslint/no-explicit-any */
// ═══════════════════════════════════════════════════════════
// AFGERONDE KADERS IN WORD
// ═══════════════════════════════════════════════════════════
// Tabelranden zijn in Word altijd recht. De ronde kaders uit de huisstijl
// (stappenkaarten, callout, citaatblok, status-pillen) zijn vormen, en die
// kunnen wél een radius, een kleurverloop en een zachte schaduw hebben, met
// gewone bewerkbare tekst erin.
//
// De docx-bibliotheek heeft er een functie voor (WpsShapeRun), maar die schrijft
// een afbeelding in plaats van een vorm. Daarom bouwen we de vorm hier zelf.
//
// Werkwijze: bij het opbouwen zet je een markeer-alinea vóór en ná de inhoud die
// in een kader moet. Als het document klaar is, knippen we alles daartussen uit
// en hangen het in de vorm. Zo blijft de inhoud gewone docx-inhoud (alinea's,
// bullets, tabellen, afbeeldingen) en houdt de bibliotheek de verwijzingen naar
// afbeeldingen zelf bij.
//
// HARDE REGEL: een vorm in een vorm mag NIET. Word raakt dan de draad kwijt en
// laat stilletjes een deel van het document weg (in de proef verdween een halve
// pagina). Zet dus nooit een pil of een ander kader binnen een kader-vorm.
// ═══════════════════════════════════════════════════════════

const EMU = 9525; // 1 px

export type Vulling = { kleur: string } | { verloop: [string, string]; hoek?: number; alpha?: number; alpha2?: number };
export type VormOpties = {
  breedte?: number;          // px
  hoogte?: number;           // px, startwaarde; Word herrekent bij meegroeien
  radius?: number;           // 0 tot 50000 (50000 = pil)
  vorm?: "roundRect" | "rect" | "ellipse";
  vulling?: Vulling;
  rand?: string;             // hex, weglaten = geen rand
  randDikte?: number;        // px
  schaduw?: { blur?: number; dist?: number; alpha?: number };
  marges?: { links?: number; rechts?: number; boven?: number; onder?: number };
  midden?: boolean;          // verticaal centreren
  vast?: boolean;            // niet meegroeien met de tekst (voor pillen)
  naam?: string;
  na?: number;               // ruimte onder het kader (twips)
};

export const START = (id: number) => `@@PW-VORM-START:${id}@@`;
export const EIND = (id: number) => `@@PW-VORM-EIND:${id}@@`;

const esc = (s: unknown): string =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function vullingXml(v?: Vulling): string {
  if (!v) return "<a:noFill/>";
  if ("verloop" in v) {
    const [a, b] = v.verloop;
    return `<a:gradFill rotWithShape="1"><a:gsLst>` +
      `<a:gs pos="0"><a:srgbClr val="${a}"><a:alpha val="${v.alpha ?? 45000}"/></a:srgbClr></a:gs>` +
      `<a:gs pos="100000"><a:srgbClr val="${b}"><a:alpha val="${v.alpha2 ?? 60000}"/></a:srgbClr></a:gs>` +
      `</a:gsLst><a:lin ang="${Math.round((v.hoek ?? 228) * 60000)}" scaled="0"/></a:gradFill>`;
  }
  return `<a:solidFill><a:srgbClr val="${v.kleur}"/></a:solidFill>`;
}

function schaduwXml(s?: VormOpties["schaduw"]): string {
  if (!s) return "";
  return `<a:effectLst><a:outerShdw blurRad="${(s.blur ?? 22) * EMU}" dist="${(s.dist ?? 8) * EMU}" ` +
    `dir="5400000" rotWithShape="0"><a:srgbClr val="2F2A2A"><a:alpha val="${s.alpha ?? 12000}"/></a:srgbClr></a:outerShdw></a:effectLst>`;
}

function vormXml(id: number, o: VormOpties, binnenXml: string): string {
  const cx = Math.round((o.breedte ?? 650) * EMU);
  const cy = Math.round((o.hoogte ?? 100) * EMU);
  const rand = o.rand
    ? `<a:ln w="${Math.round((o.randDikte ?? 1) * EMU)}"><a:solidFill><a:srgbClr val="${o.rand}"/></a:solidFill></a:ln>`
    : `<a:ln><a:noFill/></a:ln>`;
  const m = o.marges || {};
  const ins = (v: number | undefined, d: number) => Math.round((v ?? d) * EMU);
  return `<w:p><w:pPr><w:spacing w:after="${o.na ?? 200}" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${9000 + id}" name="${esc(o.naam || "Kader")}"/><wp:cNvGraphicFramePr/>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">` +
    `<wps:wsp><wps:cNvSpPr txBox="1"/><wps:spPr bwMode="auto">` +
    `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="${o.vorm || "roundRect"}"><a:avLst>` +
    (o.vorm === "ellipse" ? "" : `<a:gd name="adj" fmla="val ${o.radius ?? 9000}"/>`) +
    `</a:avLst></a:prstGeom>` +
    vullingXml(o.vulling) + rand + schaduwXml(o.schaduw) +
    `</wps:spPr><wps:txbx><w:txbxContent>${binnenXml}</w:txbxContent></wps:txbx>` +
    `<wps:bodyPr rot="0" vert="horz" wrap="square" ` +
    `lIns="${ins(m.links, 16)}" tIns="${ins(m.boven, 12)}" rIns="${ins(m.rechts, 16)}" bIns="${ins(m.onder, 12)}" ` +
    `anchor="${o.midden ? "ctr" : "t"}">${o.vast ? "<a:noAutofit/>" : "<a:spAutoFit/>"}</wps:bodyPr>` +
    `</wps:wsp></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

/** Vervangt in de document-XML elk gemarkeerd blok door een echt kader. */
export function zetVormen(xml: string, opties: Record<number, VormOpties>): string {
  // Van achter naar voren, zodat een kader-in-kader (dat niet mag) er tenminste
  // niet toe leidt dat we in al vervangen XML staan te knippen.
  const ids = Object.keys(opties).map(Number).sort((a, b) => a - b);
  for (const id of ids) {
    const s = xml.indexOf(START(id));
    const e = xml.indexOf(EIND(id));
    if (s < 0 || e < 0 || e < s) continue;
    const pStart = Math.max(xml.lastIndexOf("<w:p ", s), xml.lastIndexOf("<w:p>", s));
    const pStartEind = xml.indexOf("</w:p>", s) + 6;
    const pEindStart = Math.max(xml.lastIndexOf("<w:p ", e), xml.lastIndexOf("<w:p>", e));
    const pEindEind = xml.indexOf("</w:p>", e) + 6;
    if (pStart < 0 || pEindStart < pStartEind) continue;
    const binnen = xml.slice(pStartEind, pEindStart);
    xml = xml.slice(0, pStart) + vormXml(id, opties[id], binnen) + xml.slice(pEindEind);
  }
  return xml;
}

/** Zet de kaders in het al gebouwde .docx-bestand. */
export async function verwerkVormen(buffer: Buffer, opties: Record<number, VormOpties>): Promise<Buffer> {
  if (!Object.keys(opties).length) return buffer;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const JSZip: any = require("jszip");
  const zip = await JSZip.loadAsync(buffer);
  const naam = "word/document.xml";
  const xml: string = await zip.file(naam).async("string");
  zip.file(naam, zetVormen(xml, opties));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** Ruwe schatting van de kaderhoogte, zodat het al klopt vóór Word zelf herrekent. */
export function hoogteVan(tekst: string, breedte = 600, regelhoogte = 17, extra = 34): number {
  return Math.max(46, Math.ceil(String(tekst).length / (breedte / 6.4)) * regelhoogte + extra);
}
