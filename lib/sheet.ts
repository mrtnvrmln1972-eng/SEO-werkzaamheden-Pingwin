import type { ClientBudget } from "./clients";

// ═══════════════════════════════════════════════════════════
// GOOGLE SHEET LADEN, PARSEN EN STRUCTUREREN
// ═══════════════════════════════════════════════════════════
// Ongewijzigde logica uit het originele dashboard, alleen de
// budgetbedragen komen nu uit de klant-config in plaats van hardcoded.
// ═══════════════════════════════════════════════════════════

export type Task = {
  categorie: string;
  taak: string;
  toelichting: string;
  standaardTijd: number; // minuten
  status: string;
  maand: string;
  link: string;
  row: number; // regelnummer in de Google Sheet (1-gebaseerd)
  wie: string;            // SEO / Dev (kolom H) — leeg bij bestaande sheets
  klantZichtbaar: boolean; // kolom I (ja/nee) — false bij bestaande sheets
};

export type DashboardData = {
  months: string[];
  tasks: Task[];
  budget: ClientBudget;
};

const COL = {
  CATEGORIE: 0,
  TAAK: 1,
  TOELICHTING: 2,
  STANDAARDTIJD: 3,
  STATUS: 4,
  MAAND: 5,
  LINK: 6,
  WIE: 7,             // nieuw: SEO / Dev
  KLANT_ZICHTBAAR: 8, // nieuw: ja/nee
};

function truthy(val: string): boolean {
  return /^(ja|j|x|✓|true|1|zichtbaar)$/i.test((val || "").trim());
}

export const MAAND_VOLGORDE = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

export function sheetCsvUrl(sheetId: string, gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(current.trim());
        current = "";
      } else if (char === "\n" || (char === "\r" && next === "\n")) {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = "";
        if (char === "\r") i++;
      } else {
        current += char;
      }
    }
  }
  if (current || row.length) {
    row.push(current.trim());
    rows.push(row);
  }
  return rows;
}

function parseNumber(val: string): number {
  if (!val) return 0;
  const cleaned = val.toString().replace(/[^\d,.-]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Bouwt taken op uit de sheet-rijen. De budgetregels in de sheet worden
// overgeslagen; de bedragen komen uit de klant-config (budget).
export function structureData(rows: string[][], budget: ClientBudget): DashboardData | null {
  if (!rows || rows.length < 2) return null;

  const tasks: Task[] = [];
  let inBudgetSection = false;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const colA = (row[COL.CATEGORIE] || "").trim();
    const colB = (row[COL.TAAK] || "").trim();
    const colC = (row[COL.TOELICHTING] || "").trim();
    const colD = (row[COL.STANDAARDTIJD] || "").trim();

    // Begin van de budgetsectie in de sheet (overslaan voor de taaklijst).
    if (colA.toLowerCase().includes("budget") && colA.toLowerCase().includes("linkbuilding")) {
      inBudgetSection = true;
      continue;
    }

    if (inBudgetSection) {
      const nextColA = (row[COL.CATEGORIE] || "").trim();
      const nextColB = (row[COL.TAAK] || "").trim();
      const nextStatus = (row[COL.STATUS] || "").trim();
      const nextMaand = (row[COL.MAAND] || "").trim();
      // Einde budgetsectie: zodra er weer een echte taakregel komt.
      if (nextMaand || nextStatus) {
        inBudgetSection = false;
        const task: Task = {
          categorie: nextColA,
          taak: nextColB,
          toelichting: colC,
          standaardTijd: parseNumber(colD),
          status: nextStatus,
          maand: nextMaand.toLowerCase(),
          link: (row[COL.LINK] || "").trim(),
          row: r + 1,
          wie: (row[COL.WIE] || "").trim(),
          klantZichtbaar: truthy(row[COL.KLANT_ZICHTBAAR] || ""),
        };
        if (task.taak) tasks.push(task);
      }
      continue;
    }

    if (!colB && !colA) continue;

    const task: Task = {
      categorie: colA,
      taak: colB,
      toelichting: colC,
      standaardTijd: parseNumber(colD),
      status: (row[COL.STATUS] || "").trim(),
      maand: (row[COL.MAAND] || "").trim().toLowerCase(),
      link: (row[COL.LINK] || "").trim(),
      row: r + 1,
      wie: (row[COL.WIE] || "").trim(),
      klantZichtbaar: truthy(row[COL.KLANT_ZICHTBAAR] || ""),
    };

    if (task.taak) tasks.push(task);
  }

  const uniqueMonths = Array.from(new Set(tasks.map((t) => t.maand).filter((m) => m)));
  uniqueMonths.sort((a, b) => {
    const ia = MAAND_VOLGORDE.indexOf(a);
    const ib = MAAND_VOLGORDE.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return { months: uniqueMonths, tasks, budget };
}
