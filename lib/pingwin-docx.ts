/* eslint-disable @typescript-eslint/no-explicit-any */
import { PINGWIN_LOGO_BASE64 } from "./pingwin-logo";

// Bouwt een .docx in de Pingwin-huisstijl uit een gestructureerde inhoud.
// De componenten (design tokens, cover, sectiekoppen, tabellen) komen uit de
// huisstijl-skill die naar de repo is geport.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const P: any = require("./pingwin-docx-components.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Document, Packer, Paragraph, TextRun, AlignmentType }: any = require("docx");

// Vet-rendering: zet **tekst** om in vette runs (bijv. zoekwoorden), in dezelfde
// bodystijl als createBodyText/createBulletList (P.tokens). Zo kan de AI met
// **dubbele sterretjes** nadruk geven zonder ruwe markdown in beeld.
const T: any = P.tokens;
function richRuns(text: string): any[] {
  const runs: any[] = [];
  for (const seg of String(text ?? "").split(/(\*\*[^*]+\*\*)/g)) {
    if (!seg) continue;
    const bold = /^\*\*[^*]+\*\*$/.test(seg);
    runs.push(new TextRun({ text: bold ? seg.slice(2, -2) : seg, font: T.font, size: T.size.body, bold, color: T.color.bodyDark }));
  }
  if (runs.length === 0) runs.push(new TextRun({ text: "", font: T.font, size: T.size.body, color: T.color.bodyDark }));
  return runs;
}
function bodyPara(text: string): any {
  return new Paragraph({ alignment: AlignmentType.LEFT, spacing: { line: 320, after: 140, before: 0 }, children: richRuns(text) });
}
function bulletPara(item: string): any {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 80, line: 300 }, children: richRuns(item) });
}

export type DocBlock =
  | { type: "paragraph"; text: string }
  | { type: "subheading"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "highlight"; text: string }
  | { type: "step"; nr: number; title: string; text: string }
  | { type: "table"; headers: string[]; rows: string[][] };

export type DocSection = { heading?: string; blocks: DocBlock[] };
export type DocSpec = {
  klant: string;
  rapporttype: string;
  titel: string;
  ondertitel?: string;
  meta?: Record<string, string>;
  sections: DocSection[];
};

export async function buildPingwinDoc(spec: DocSpec): Promise<Buffer> {
  const logo = Buffer.from(PINGWIN_LOGO_BASE64, "base64");
  const children: any[] = [];
  children.push(...P.createCoverPage(spec.titel, spec.ondertitel || "", spec.meta || {}));

  for (const sec of spec.sections || []) {
    // createSectionDivider en createHighlightBox geven een ARRAY terug: spreiden,
    // anders belandt er een geneste array in de kinderen en lekt de docx-bibliotheek
    // een ongeldig <0/>-tag in de XML (bestand corrupt, niet te openen).
    if (sec.heading) children.push(...P.createSectionDivider(sec.heading));
    for (const b of sec.blocks || []) {
      try {
        if (b.type === "paragraph" && b.text) children.push(bodyPara(b.text));
        else if (b.type === "subheading" && b.text) children.push(P.createSubHeading(b.text));
        else if (b.type === "bullets" && b.items?.length) children.push(...b.items.map(bulletPara));
        else if (b.type === "highlight" && b.text) children.push(...P.createHighlightBox(b.text));
        else if (b.type === "step") children.push(P.createStepBlock(b.nr, b.title, b.text));
        else if (b.type === "table" && b.headers?.length && b.rows?.length) children.push(P.createDataTable(b.headers, b.rows));
      } catch { /* sla een fout blok over, breek het document niet */ }
    }
  }

  // Vangnet: sla eventuele geneste arrays plat en gooi losse primitieven (getallen,
  // null) eruit, zodat er nooit meer een ongeldig element in de XML kan lekken.
  const cleanChildren = (children as unknown[]).flat(Infinity).filter((c) => c && typeof c === "object");

  const doc = new Document({
    styles: P.styles,
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
      headers: { default: P.createPageHeader(spec.klant || "", spec.rapporttype || "", logo) },
      footers: { default: P.createPageFooter() },
      children: cleanChildren,
    }],
  });

  return (await Packer.toBuffer(doc)) as Buffer;
}
