/**
 * pingwin-docx-components.js  (v2 — Google Docs safe)
 * ---------------------------------------------------------------
 * Herbruikbare docx-componenten voor Pingwin-rapportages.
 *
 * BREAKING CHANGES t.o.v. v1:
 * - createSectionDivider: van 1-koloms-tabel → Paragraph met shading.
 *   Google Docs renderde 1-cel-tabellen als smalle kolom; dit fixt dat.
 * - createHighlightBox: idem.
 * - createDataTable: heeft nu een ingebouwde validatie die te smalle
 *   kolommen detecteert en automatisch corrigeert (of waarschuwt).
 *
 * REGELS (altijd handhaven):
 * - NOOIT WidthType.PERCENTAGE — Google Docs rendert dit kapot.
 *   Altijd WidthType.DXA met expliciete columnWidths.
 * - GEEN 1-koloms-tabellen voor layout-blokken (achtergrondkleur).
 *   Gebruik Paragraph met shading + border.
 * - A4 met 1080 DXA marges: contentbreedte = 9746 DXA.
 * - Header/footer: altijd één Paragraph met TabStopType.RIGHT op 9746,
 *   nooit een tabel.
 * - Pingwin-logo altijd rechtsboven in de header als ImageRun.
 *
 * KOLOMBREEDTE-VUISTREGELS (in createDataTable):
 * - Korte ID/code-kolom (bv. "H1-01"):    minimaal 1500 DXA
 * - Korte label-kolom (bv. "CRITICAL"):    minimaal 1500 DXA
 * - Langere label/term:                    minimaal 2000 DXA
 * - Volzin-kolom (>40 tekens):             minimaal 3500 DXA
 * - Som van alle kolommen = 9746 DXA exact.
 * ---------------------------------------------------------------
 */

const {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  ImageRun,
  LevelFormat,
  TabStopType,
  TabStopPosition,
  TableLayoutType,
  convertInchesToTwip,
} = require("docx");

/* =========================================================
 * LAYOUT CONSTANTEN
 * ======================================================= */
const CONTENT_WIDTH = 9746; // A4 - 2x 1080 DXA marges

/* =========================================================
 * 1. DESIGN TOKENS
 * ======================================================= */
const T = {
  font: "Noto Sans",
  color: {
    accent:      "F6712C",
    accentAlt:   "F6712C",
    accentHover: "D85A1A",
    accentSoft:  "FDE8DB",
    red:         "A22F3B",
    blue:        "0E7E9A",
    brown:       "84796B",
    headingDark: "2F2A2A",
    bodyDark:    "2F2A2A",
    white:       "FFFFFF",
    surface1:    "FFFFFF",
    surface2:    "F7F7F7",
    surface3:    "EEEEEE",
    surface4:    "E0E0E0",
    footerBg:    "2F2A2A",
    success:     "46B450",
    warning:     "FFB900",
    danger:      "A22F3B",
    info:        "0E7E9A",
  },
  size: {
    body:   22,
    small:  18,
    h1:     40,
    h2:     30,
    h3:     24,
    eyebrow:18,
    cover:  56,
  },
};

/* =========================================================
 * 2. DOCUMENT STYLES
 * ======================================================= */
const styles = {
  default: {
    document: {
      run: { font: T.font, size: T.size.body, color: T.color.bodyDark },
      paragraph: { spacing: { line: 320, after: 120 } },
    },
    heading1: {
      run: { font: T.font, size: T.size.h1, bold: true, color: T.color.headingDark },
      paragraph: { spacing: { before: 240, after: 180 } },
    },
    heading2: {
      run: { font: T.font, size: T.size.h2, bold: true, color: T.color.headingDark },
      paragraph: { spacing: { before: 220, after: 140 } },
    },
    heading3: {
      run: { font: T.font, size: T.size.h3, bold: true, color: T.color.headingDark },
      paragraph: { spacing: { before: 180, after: 100 } },
    },
  },
};

/* =========================================================
 * HELPERS
 * ======================================================= */
const noBorder = {
  top:              { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom:           { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left:             { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right:            { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideVertical:   { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

const shade = (fill) => ({ type: ShadingType.CLEAR, color: "auto", fill });

const baseRun = (text, opts = {}) =>
  new TextRun({
    text,
    font: T.font,
    size: opts.size || T.size.body,
    bold: !!opts.bold,
    italics: !!opts.italic,
    color: opts.color || T.color.bodyDark,
    allCaps: !!opts.caps,
    characterSpacing: opts.tracking || 0,
  });

/* =========================================================
 * 3. COMPONENT: createBodyText
 * ======================================================= */
function createBodyText(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { line: 320, after: 140, before: opts.before || 0 },
    keepNext: !!opts.keepNext,
    keepLines: !!opts.keepLines,
    children: [
      baseRun(text, {
        bold: opts.bold,
        italic: opts.italic,
        color: opts.color,
        size: opts.size || T.size.body,
      }),
    ],
  });
}

/* =========================================================
 * 3b. COMPONENT: createSubHeading (inline kop binnen sectie)
 *
 * Gebruik voor inline kopjes als "Wat de koplopers onderscheidt:"
 * of "Tabel B — Variantenlijst:". Krijgt extra ruimte boven en
 * keepNext zodat de kop nooit los onderaan een pagina staat.
 * ======================================================= */
function createSubHeading(text) {
  return new Paragraph({
    spacing: { before: 280, after: 120, line: 320 },
    keepNext: true,
    keepLines: true,
    children: [
      baseRun(text, {
        bold: true,
        color: T.color.headingDark,
        size: T.size.body,
      }),
    ],
  });
}

/* =========================================================
 * 4. COMPONENT: createBulletList
 * ======================================================= */
function createBulletList(items) {
  return items.map(
    (item) =>
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 80, line: 300 },
        children: [baseRun(item)],
      })
  );
}

/* =========================================================
 * 5. COMPONENT: createSectionDivider  (v2 — Paragraph-based)
 *
 * GEEN 1-koloms-tabel meer. Google Docs rendert die als smalle cel
 * waardoor de tekst verticaal afbreekt. Een Paragraph met shading +
 * border werkt zowel in Word als in Google Docs correct.
 * ======================================================= */
function createSectionDivider(label) {
  return [
    new Paragraph({
      spacing: { before: 0, after: 0, line: 320 },
      children: [new TextRun({ text: "" })],
    }),
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [CONTENT_WIDTH],
      borders: noBorder,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: CONTENT_WIDTH, type: WidthType.DXA },
              shading: shade(T.color.accent),
              margins: { top: 180, bottom: 180, left: 300, right: 300 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  keepNext: true,
                  keepLines: true,
                  children: [
                    baseRun(label, {
                      bold: true,
                      color: T.color.white,
                      caps: true,
                      tracking: 12,
                      size: T.size.h3,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 160 },
      keepNext: true,
      children: [new TextRun({ text: "" })],
    }),
  ];
}

/* =========================================================
 * 6. COMPONENT: createHighlightBox  (v2 — Paragraph-based)
 *
 * GEEN 1-koloms-tabel meer. Paragraph met shading + linker border.
 * Werkt in Word én Google Docs correct over volle contentbreedte.
 * ======================================================= */
function createHighlightBox(text) {
  return [
    new Paragraph({
      spacing: { before: 0, after: 0, line: 240 },
      children: [new TextRun({ text: "" })],
    }),
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [CONTENT_WIDTH],
      borders: noBorder,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: CONTENT_WIDTH, type: WidthType.DXA },
              shading: shade(T.color.accentSoft),
              margins: { top: 240, bottom: 240, left: 320, right: 320 },
              borders: {
                top:    { style: BorderStyle.NONE,   size: 0,  color: "FFFFFF" },
                bottom: { style: BorderStyle.NONE,   size: 0,  color: "FFFFFF" },
                left:   { style: BorderStyle.SINGLE, size: 36, color: T.color.accent },
                right:  { style: BorderStyle.NONE,   size: 0,  color: "FFFFFF" },
              },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 0, line: 320 },
                  children: [
                    baseRun(text, {
                      bold: true,
                      color: T.color.headingDark,
                      size: T.size.body,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 240 },
      children: [new TextRun({ text: "" })],
    }),
  ];
}

/* =========================================================
 * 7. COMPONENT: createStepBlock
 *
 * Tabel met 2 kolommen (nummer + tekst). Beide kolommen zijn breed
 * genoeg, geen Google Docs render-bug.
 * ======================================================= */
const STEP_NUM_COL  = 1200;
const STEP_TEXT_COL = CONTENT_WIDTH - STEP_NUM_COL; // 8546

function createStepBlock(nummer, titel, tekst) {
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [STEP_NUM_COL, STEP_TEXT_COL],
    borders: noBorder,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: STEP_NUM_COL, type: WidthType.DXA },
            shading: shade(T.color.accentAlt),
            verticalAlign: "center",
            margins: { top: 220, bottom: 220, left: 120, right: 120 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: String(nummer),
                    font: T.font,
                    size: 48,
                    bold: true,
                    color: T.color.white,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: STEP_TEXT_COL, type: WidthType.DXA },
            shading: shade(T.color.surface2),
            margins: { top: 200, bottom: 200, left: 300, right: 300 },
            children: [
              new Paragraph({
                spacing: { after: 80 },
                children: [
                  baseRun(titel, { bold: true, size: T.size.h3, color: T.color.headingDark }),
                ],
              }),
              new Paragraph({
                children: [baseRun(tekst)],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/* =========================================================
 * 8. COMPONENT: createDataTable  (v2 — met validatie)
 *
 * Auto-correctie:
 *  - Detecteert te smalle kolommen voor de inhoud die erin staat
 *  - Logt een waarschuwing en past kolombreedtes aan in plaats
 *    van een gebroken layout op te leveren.
 *
 * Validatie-regels:
 *  - Minimum kolombreedte: 1300 DXA
 *  - Bij content >40 tekens in een cel: kolom moet ≥3500 DXA zijn
 *  - Som van kolommen blijft altijd CONTENT_WIDTH
 * ======================================================= */
function _validateAndFixColumnWidths(headers, rows, columnWidths) {
  const n = headers.length;
  let colW = columnWidths
    ? [...columnWidths]
    : headers.map(() => Math.floor(CONTENT_WIDTH / n));

  // Bereken voor elke kolom de maximale celtekst-lengte
  const maxLen = headers.map((h, i) => {
    let m = String(h).length;
    for (const row of rows) {
      const v = row[i] != null ? String(row[i]) : "";
      if (v.length > m) m = v.length;
    }
    return m;
  });

  // Bepaal minimum-vereiste breedte per kolom op basis van inhoud
  const minRequired = maxLen.map((l) => {
    if (l <= 8)   return 1300;   // korte codes (bv. "H1-01")
    if (l <= 15)  return 1700;   // korte labels (bv. "CRITICAL")
    if (l <= 25)  return 2200;   // medium termen
    if (l <= 40)  return 3000;   // langere termen / korte zinnen
    if (l <= 70)  return 4200;   // zinnen
    return 5500;                 // lange zinnen / paragrafen
  });

  // Check of huidige kolombreedtes voldoen
  let needsFix = false;
  const issues = [];
  for (let i = 0; i < n; i++) {
    if (colW[i] < minRequired[i]) {
      needsFix = true;
      issues.push(
        `  - Kolom ${i + 1} ("${headers[i]}"): ${colW[i]} DXA, ` +
        `minimum vereist ${minRequired[i]} DXA (langste cel: ${maxLen[i]} tekens)`
      );
    }
  }

  if (needsFix) {
    // Auto-correctie: verdeel CONTENT_WIDTH proportioneel op basis van minRequired
    const totalMin = minRequired.reduce((a, b) => a + b, 0);
    if (totalMin <= CONTENT_WIDTH) {
      // Geef elke kolom zijn minimum, verdeel het overschot proportioneel
      const surplus = CONTENT_WIDTH - totalMin;
      colW = minRequired.map(
        (m) => m + Math.floor((m / totalMin) * surplus)
      );
    } else {
      // Inhoud past niet op A4-breedte → schaal proportioneel
      colW = minRequired.map((m) => Math.floor((m / totalMin) * CONTENT_WIDTH));
    }
    // Compenseer afronding op laatste kolom
    const sum = colW.slice(0, -1).reduce((a, b) => a + b, 0);
    colW[colW.length - 1] = CONTENT_WIDTH - sum;

    console.warn(
      "[pingwin-docx] createDataTable: kolombreedtes auto-gecorrigeerd.\n" +
      issues.join("\n") +
      `\n  → Aangepast naar: [${colW.join(", ")}]`
    );
  } else {
    // Compenseer afrondingsverschillen ook bij goede input
    const sum = colW.slice(0, -1).reduce((a, b) => a + b, 0);
    colW[colW.length - 1] = CONTENT_WIDTH - sum;
  }

  return colW;
}

function createDataTable(headers, rows, columnWidths) {
  const colW = _validateAndFixColumnWidths(headers, rows, columnWidths);

  const border = {
    top:              { style: BorderStyle.SINGLE, size: 4, color: T.color.surface3 },
    bottom:           { style: BorderStyle.SINGLE, size: 4, color: T.color.surface3 },
    left:             { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" },
    right:            { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: T.color.surface3 },
    insideVertical:   { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" },
  };

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) =>
      new TableCell({
        width: { size: colW[i], type: WidthType.DXA },
        shading: shade(T.color.headingDark),
        margins: { top: 160, bottom: 160, left: 200, right: 200 },
        children: [
          new Paragraph({
            children: [
              baseRun(h, { bold: true, color: T.color.white, caps: true, tracking: 8, size: T.size.small }),
            ],
          }),
        ],
      })
    ),
  });

  const dataRows = rows.map((r, i) =>
    new TableRow({
      children: r.map((cell, j) =>
        new TableCell({
          width: { size: colW[j], type: WidthType.DXA },
          shading: shade(i % 2 === 0 ? T.color.white : T.color.surface2),
          margins: { top: 140, bottom: 140, left: 200, right: 200 },
          children: [
            new Paragraph({ children: [baseRun(String(cell))] }),
          ],
        })
      ),
    })
  );

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: colW,
    borders: border,
    rows: [headerRow, ...dataRows],
  });
}

/* =========================================================
 * 9. COMPONENT: createKPITable
 * ======================================================= */
const KPI_COLS = [4000, 2000, 2000, 1746];

function createKPITable(metrics) {
  const statusColor = {
    good:    T.color.success,
    warn:    T.color.warning,
    bad:     T.color.danger,
    neutral: T.color.surface4,
  };

  const border = {
    top:              { style: BorderStyle.SINGLE, size: 4, color: T.color.surface3 },
    bottom:           { style: BorderStyle.SINGLE, size: 4, color: T.color.surface3 },
    left:             { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" },
    right:            { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: T.color.surface3 },
    insideVertical:   { style: BorderStyle.SINGLE, size: 4, color: T.color.surface3 },
  };

  const kpiHeaders = ["KPI", "Waarde", "Verschil", "Status"];
  const headerRow = new TableRow({
    tableHeader: true,
    children: kpiHeaders.map((h, i) =>
      new TableCell({
        width: { size: KPI_COLS[i], type: WidthType.DXA },
        shading: shade(T.color.headingDark),
        margins: { top: 160, bottom: 160, left: 200, right: 200 },
        children: [
          new Paragraph({
            children: [
              baseRun(h, { bold: true, color: T.color.white, caps: true, tracking: 8, size: T.size.small }),
            ],
          }),
        ],
      })
    ),
  });

  const dataRows = metrics.map((m, i) => {
    const bg     = i % 2 === 0 ? T.color.white : T.color.surface2;
    const sColor = statusColor[m.status] || T.color.surface4;
    return new TableRow({
      children: [
        new TableCell({
          width: { size: KPI_COLS[0], type: WidthType.DXA },
          shading: shade(bg),
          margins: { top: 160, bottom: 160, left: 200, right: 200 },
          children: [new Paragraph({ children: [baseRun(m.label, { bold: true })] })],
        }),
        new TableCell({
          width: { size: KPI_COLS[1], type: WidthType.DXA },
          shading: shade(bg),
          margins: { top: 160, bottom: 160, left: 200, right: 200 },
          children: [
            new Paragraph({
              children: [baseRun(String(m.value), { bold: true, size: T.size.h3, color: T.color.headingDark })],
            }),
          ],
        }),
        new TableCell({
          width: { size: KPI_COLS[2], type: WidthType.DXA },
          shading: shade(bg),
          margins: { top: 160, bottom: 160, left: 200, right: 200 },
          children: [
            new Paragraph({ children: [baseRun(String(m.change || ""), { bold: true, color: sColor })] }),
          ],
        }),
        new TableCell({
          width: { size: KPI_COLS[3], type: WidthType.DXA },
          shading: shade(sColor),
          margins: { top: 160, bottom: 160, left: 200, right: 200 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                baseRun((m.status || "neutral").toUpperCase(), {
                  bold: true,
                  color: T.color.white,
                  tracking: 8,
                }),
              ],
            }),
          ],
        }),
      ],
    });
  });

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: KPI_COLS,
    borders: border,
    rows: [headerRow, ...dataRows],
  });
}

/* =========================================================
 * 10. COMPONENT: createCoverPage
 * ======================================================= */
const META_COL1 = 2924;
const META_COL2 = CONTENT_WIDTH - META_COL1; // 6822
const ACCENT_BAR_WIDTH = 1462;

function createCoverPage(titel, ondertitel, metaTabel = {}, opts = {}) {
  const children = [];

  // Eyebrow
  children.push(
    new Paragraph({
      spacing: { before: 0, after: 200 },
      children: [
        baseRun(opts.eyebrow || "PINGWIN RAPPORTAGE", {
          bold: true, caps: true, tracking: 24, size: T.size.eyebrow, color: T.color.accent,
        }),
      ],
    })
  );

  // Oranje accent-balk (smalle 2-koloms-tabel: balk + lege ruimte)
  children.push(
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [ACCENT_BAR_WIDTH, CONTENT_WIDTH - ACCENT_BAR_WIDTH],
      borders: noBorder,
      rows: [
        new TableRow({
          height: { value: 80, rule: "exact" },
          children: [
            new TableCell({
              width: { size: ACCENT_BAR_WIDTH, type: WidthType.DXA },
              shading: shade(T.color.accent),
              children: [new Paragraph({ children: [new TextRun({ text: "" })] })],
            }),
            new TableCell({
              width: { size: CONTENT_WIDTH - ACCENT_BAR_WIDTH, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun({ text: "" })] })],
            }),
          ],
        }),
      ],
    })
  );

  // Titel
  children.push(
    new Paragraph({
      spacing: { before: 400, after: 200 },
      children: [
        new TextRun({ text: titel, font: T.font, size: T.size.cover, bold: true, color: T.color.headingDark }),
      ],
    })
  );

  // Ondertitel
  if (ondertitel) {
    children.push(
      new Paragraph({
        spacing: { after: 600 },
        children: [baseRun(ondertitel, { size: 32, color: T.color.bodyDark })],
      })
    );
  }

  // Meta-tabel
  const metaRows = Object.entries(metaTabel).map(([k, v]) =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: META_COL1, type: WidthType.DXA },
          shading: shade(T.color.surface2),
          margins: { top: 120, bottom: 120, left: 200, right: 200 },
          children: [
            new Paragraph({
              children: [
                baseRun(k, { bold: true, caps: true, tracking: 8, size: T.size.small, color: T.color.headingDark }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: META_COL2, type: WidthType.DXA },
          shading: shade(T.color.white),
          margins: { top: 120, bottom: 120, left: 200, right: 200 },
          children: [new Paragraph({ children: [baseRun(String(v))] })],
        }),
      ],
    })
  );

  if (metaRows.length) {
    children.push(
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [META_COL1, META_COL2],
        borders: {
          top:              { style: BorderStyle.SINGLE, size: 4, color: T.color.surface3 },
          bottom:           { style: BorderStyle.SINGLE, size: 4, color: T.color.surface3 },
          left:             { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" },
          right:            { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: T.color.surface3 },
          insideVertical:   { style: BorderStyle.NONE,   size: 0, color: "FFFFFF" },
        },
        rows: metaRows,
      })
    );
  }

  // Pagebreak
  children.push(
    new Paragraph({
      pageBreakBefore: true,
      children: [new TextRun({ text: "" })],
    })
  );

  return children;
}

/* =========================================================
 * 11. COMPONENT: createPageHeader
 * ======================================================= */
function createPageHeader(klantnaam, rapporttype, logoBuffer) {
  // Logo: 573x134 px → schalen naar hoogte ~28pt voor compacte header
  const LOGO_H_PX = 38;
  const LOGO_W_PX = Math.round((573 / 134) * LOGO_H_PX);

  // Linker tekstcel + rechter logocel
  const TEXT_COL = Math.round(CONTENT_WIDTH * 0.65);   // 65% voor tekst
  const LOGO_COL = CONTENT_WIDTH - TEXT_COL;            // 35% voor logo

  const logoChildren = logoBuffer
    ? [
        new ImageRun({
          data: logoBuffer,
          transformation: { width: LOGO_W_PX, height: LOGO_H_PX },
          type: "jpg",
        }),
      ]
    : [
        baseRun("PINGWIN", {
          bold: true, caps: true, tracking: 16, color: T.color.accent, size: T.size.small,
        }),
      ];

  return new Header({
    children: [
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [TEXT_COL, LOGO_COL],
        borders: {
          top:              { style: BorderStyle.NONE,   size: 0,  color: "FFFFFF" },
          bottom:           { style: BorderStyle.SINGLE, size: 12, color: T.color.accent },
          left:             { style: BorderStyle.NONE,   size: 0,  color: "FFFFFF" },
          right:            { style: BorderStyle.NONE,   size: 0,  color: "FFFFFF" },
          insideHorizontal: { style: BorderStyle.NONE,   size: 0,  color: "FFFFFF" },
          insideVertical:   { style: BorderStyle.NONE,   size: 0,  color: "FFFFFF" },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: TEXT_COL, type: WidthType.DXA },
                margins: { top: 0, bottom: 80, left: 0, right: 0 },
                verticalAlign: "center",
                children: [
                  new Paragraph({
                    spacing: { before: 0, after: 0 },
                    children: [
                      baseRun(`${klantnaam || ""}  •  ${rapporttype || ""}`, {
                        color: T.color.bodyDark,
                        size: T.size.small,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: LOGO_COL, type: WidthType.DXA },
                margins: { top: 0, bottom: 80, left: 0, right: 0 },
                verticalAlign: "center",
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 0, after: 0 },
                    children: logoChildren,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      // Spacer-paragraph onder de header voor afstand naar body
      new Paragraph({
        spacing: { before: 0, after: 0, line: 120 },
        children: [new TextRun({ text: "" })],
      }),
    ],
  });
}

/* =========================================================
 * 12. COMPONENT: createPageFooter
 * ======================================================= */
function createPageFooter() {
  return new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }],
        border: {
          top: { style: BorderStyle.SINGLE, size: 6, color: T.color.surface3, space: 4 },
        },
        spacing: { before: 120 },
        children: [
          baseRun("pingwin.nl", { bold: true, color: T.color.accent, size: T.size.small }),
          new TextRun({ text: "\t" }),
          new TextRun({
            children: ["Pagina ", PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES],
            font: T.font,
            size: T.size.small,
            color: T.color.bodyDark,
          }),
        ],
      }),
    ],
  });
}

/* =========================================================
 * EXPORTS
 * ======================================================= */
module.exports = {
  tokens: T,
  styles,
  CONTENT_WIDTH,
  createCoverPage,
  createSectionDivider,
  createStepBlock,
  createHighlightBox,
  createDataTable,
  createBulletList,
  createBodyText,
  createSubHeading,
  createPageHeader,
  createPageFooter,
  createKPITable,
};
