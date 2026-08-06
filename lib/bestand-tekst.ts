// ═══════════════════════════════════════════════════════════
// TEKST UIT EEN AANGELEVERD BESTAND (zonder omweg via Drive)
// ═══════════════════════════════════════════════════════════
// Een Word- of Excel-bestand hoeft nergens heen om gelezen te worden: beide zijn
// zipbestanden met de inhoud erin. Ze gingen eerder naar Drive en werden daar als
// tekst teruggevraagd, maar dat werkt alleen voor Google-eigen bestanden; een
// gedropt .docx kwam daardoor terug als "kan ik niet als tekst lezen".
// Hier lezen we ze ter plekke: sneller, geen extra kopie in de klantmap, en niet
// afhankelijk van Drive-rechten. Alleen pdf's, scans en foto's blijven via Drive
// lopen, want daar is de tekstherkenning van Drive juist het punt.
// ═══════════════════════════════════════════════════════════

// Tekst uit een .docx. Elke alinea, opsommingsregel en tabelcel wordt een eigen
// regel, zodat de structuur van een verzameldocument (kopje, dan de gegevens
// eronder) leesbaar blijft voor wat er daarna mee gebeurt.
export async function tekstUitDocx(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const JSZip: typeof import("jszip") = require("jszip");
  const zip = await JSZip.loadAsync(buffer);
  const delen = ["word/document.xml", "word/footnotes.xml", "word/endnotes.xml"];
  const regels: string[] = [];
  for (const naam of delen) {
    const bestand = zip.file(naam);
    if (!bestand) continue;
    const xml = await bestand.async("string");
    // Per alinea (<w:p>) de losse tekststukjes (<w:t>) aan elkaar plakken.
    for (const alinea of xml.split(/<w:p[ >]/).slice(1)) {
      const stukjes = [...alinea.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]);
      const tekst = ontsnap(stukjes.join(""))
        // Een harde regelafbreking binnen een alinea blijft een nieuwe regel.
        .replace(/\s+/g, " ").trim();
      if (tekst) regels.push(tekst);
      else if (regels.length && regels[regels.length - 1] !== "") regels.push("");
    }
  }
  return regels.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Tekst uit een .xlsx/.xls/.csv: elk tabblad met zijn naam als kopje, daarna de
// rijen. Zo blijft zichtbaar welke kolom bij welke waarde hoort.
export function tekstUitSpreadsheet(buffer: Buffer): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const XLSX: typeof import("xlsx") = require("xlsx");
  const boek = XLSX.read(buffer, { type: "buffer" });
  const delen: string[] = [];
  for (const naam of boek.SheetNames) {
    const blad = boek.Sheets[naam];
    if (!blad) continue;
    const csv = XLSX.utils.sheet_to_csv(blad, { blankrows: false }).trim();
    if (csv) delen.push(`TABBLAD ${naam}:\n${csv}`);
  }
  return delen.join("\n\n").trim();
}

function ontsnap(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// Kan dit bestand hier gelezen worden, zonder Drive?
export function kanDirectGelezen(naam: string): boolean {
  return /\.(txt|md|json|csv|tsv|docx|xlsx|xlsm|xls)$/i.test(naam || "");
}

// De tekst uit een bestand dat we zelf aankunnen. Geeft een lege string terug
// als het bestandstype hier niet thuishoort (dan is Drive aan de beurt).
export async function tekstUitLokaalBestand(naam: string, buffer: Buffer): Promise<string> {
  if (/\.(txt|md|json)$/i.test(naam)) return buffer.toString("utf8");
  if (/\.docx$/i.test(naam)) return tekstUitDocx(buffer);
  if (/\.(xlsx|xlsm|xls|csv|tsv)$/i.test(naam)) return tekstUitSpreadsheet(buffer);
  return "";
}
