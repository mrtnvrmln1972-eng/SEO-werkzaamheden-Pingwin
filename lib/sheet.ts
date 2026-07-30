import type { ClientBudget } from "./clients";
import type { TaskRow } from "./tasks";

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
  klantToelichting?: string; // korte uitleg voor de klant ("?"-tooltip)
  standaardTijd: number; // minuten
  status: string;
  maand: string;
  link: string;
  row: number; // regelnummer in de Google Sheet (1-gebaseerd)
  wie: string;            // SEO / Dev (kolom H) — leeg bij bestaande sheets
  klantZichtbaar: boolean; // kolom I (ja/nee) — false bij bestaande sheets
  clientDocLink?: string; // klantversie-document (opent in het klantdashboard)
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

// Bouwt het dashboard-formaat rechtstreeks uit de database-taken (de nieuwe
// bron van waarheid). Vervangt de Google Sheet voor klanten die we al in het
// dashboard bijhouden. Alle taken zijn klant-zichtbaar; uren staan in minuten.
export function tasksToDashboardData(tasks: TaskRow[], budget: ClientBudget): DashboardData {
  const mapped: Task[] = tasks
    // Weekplanning-taken (step_kind 'weekplan…') zijn interne planning, geen
    // klant-mijlpaal: die horen niet op het klant-dashboard.
    .filter((t) => (t.taak || "").trim() && !String(t.stepKind || "").startsWith("weekplan"))
    .map((t, i) => ({
      categorie: t.categorie || "",
      taak: t.taak,
      toelichting: t.toelichting || "",
      klantToelichting: t.klantToelichting || "",
      clientDocLink: t.clientDocLink || "",
      standaardTijd: Number(t.uren) || 0,
      status: t.status || "",
      maand: (t.maand || "").toLowerCase(),
      link: t.link || "",
      row: i + 1,
      wie: t.wie || "",
      klantZichtbaar: true,
    }));

  const uniqueMonths = Array.from(new Set(mapped.map((t) => t.maand).filter((m) => m)));
  uniqueMonths.sort((a, b) => {
    const ia = MAAND_VOLGORDE.indexOf(a);
    const ib = MAAND_VOLGORDE.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return { months: uniqueMonths, tasks: mapped, budget };
}

// De pijplijn-stappen die de klant NIET los hoeft te zien; ze rollen samen tot
// één mijlpaal per pagina.
const PIPELINE_STEPS = new Set(["analyse_doc", "blauwdruk_doc", "copy_doc"]);
function normUrlKey(u: string): string { return (u || "").replace(/\/+$/, "").toLowerCase(); }
function pathOf(u: string): string { try { return new URL(u).pathname || "/"; } catch { return u || ""; } }
function statusRank(s: string): number {
  const t = (s || "").toLowerCase();
  if (t.startsWith("verwerkt")) return 4;
  if (t.startsWith("klaar")) return 3;
  if (t.startsWith("bezig") || t.includes("dev")) return 2;
  return 1;
}

// SIMPELE klant-weergave: de klant ziet mijlpalen, geen proces. Alle pijplijn-
// stappen (analyse, blauwdruk, copy) van één pagina rollen samen tot één regel
// ("Landingspagina /x/ geoptimaliseerd"); losse deliverables (meta, handmatige
// taken) blijven eigen regels, mits klant-zichtbaar. Weekplanning-taken (interne
// planning) en de granulaire stappen komen zo nooit bij de klant. De uren blijven
// per mijlpaal opgeteld, zodat je desgewenst nog kunt laten zien waar het heen ging.
export function clientDashboardData(tasks: TaskRow[], budget: ClientBudget): DashboardData {
  const visible = tasks.filter((t) => (t.taak || "").trim() && !String(t.stepKind || "").startsWith("weekplan"));

  // 1) Pijplijn-rijen per pagina groeperen; de rest (losse mijlpalen) apart houden.
  const pipelineByPage = new Map<string, TaskRow[]>();
  const rest: TaskRow[] = [];
  for (const t of visible) {
    if (PIPELINE_STEPS.has(String(t.stepKind || "")) && (t.pageUrl || "").trim()) {
      const k = normUrlKey(t.pageUrl as string);
      const arr = pipelineByPage.get(k) || [];
      arr.push(t); pipelineByPage.set(k, arr);
    } else {
      // Losse deliverables (meta, handmatige taken): tonen zoals nu. De klant_zichtbaar-
      // vlag als échte verbergknop komt later (met een oog-toggle in de takentabel),
      // zodat we nu geen bestaande zichtbare taken per ongeluk verbergen.
      rest.push(t);
    }
  }

  // 2) Per pagina één mijlpaal-regel bouwen.
  const milestones: TaskRow[] = [];
  for (const group of pipelineByPage.values()) {
    const url = group[0].pageUrl || "";
    const path = pathOf(url);
    const maxRank = Math.max(...group.map((g) => statusRank(g.status)));
    const status = maxRank >= 4 ? "Verwerkt" : maxRank >= 3 ? "Klaar" : maxRank >= 2 ? "Bezig" : "Gepland";
    const titel = maxRank >= 3 ? `Landingspagina ${path} geoptimaliseerd` : `Landingspagina ${path} in ontwikkeling`;
    const uren = group.reduce((s, g) => s + (Number(g.uren) || 0), 0);
    // Meest recente maand in de groep (voor de klant-rollup).
    let maand = ""; let bestRank = -2;
    for (const g of group) {
      const m = (g.maand || "").toLowerCase();
      const r = MAAND_VOLGORDE.indexOf(m);
      if (m && r > bestRank) { bestRank = r; maand = m; }
    }
    const copy = group.find((g) => g.stepKind === "copy_doc" && (g.clientDocLink || "").trim());
    const anyDoc = group.find((g) => (g.clientDocLink || "").trim());
    const clientDocLink = (copy?.clientDocLink || anyDoc?.clientDocLink || "").trim();
    const klantToel = (group.find((g) => (g.klantToelichting || "").trim())?.klantToelichting || "").trim();
    milestones.push({
      categorie: "Content", taak: titel, toelichting: "", klantToelichting: klantToel,
      uren: uren || null, status, maand, link: "", wie: "SEO", klantZichtbaar: true,
      pageUrl: url, clientDocLink,
    });
  }

  // 3) Mijlpalen + losse deliverables → het dashboard-formaat.
  const mapped: Task[] = [...milestones, ...rest]
    .filter((t) => (t.taak || "").trim())
    .map((t, i) => ({
      categorie: t.categorie || "",
      taak: t.taak,
      toelichting: t.toelichting || "",
      klantToelichting: t.klantToelichting || "",
      clientDocLink: t.clientDocLink || "",
      standaardTijd: Number(t.uren) || 0,
      status: t.status || "",
      maand: (t.maand || "").toLowerCase(),
      link: t.link || "",
      row: i + 1,
      wie: t.wie || "",
      klantZichtbaar: true,
    }));

  const uniqueMonths = Array.from(new Set(mapped.map((t) => t.maand).filter((m) => m)));
  uniqueMonths.sort((a, b) => {
    const ia = MAAND_VOLGORDE.indexOf(a);
    const ib = MAAND_VOLGORDE.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return { months: uniqueMonths, tasks: mapped, budget };
}

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
