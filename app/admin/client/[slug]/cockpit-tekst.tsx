// ═══════════════════════════════════════════════════════════
// KLEINE OMZETTERS VOOR DE COCKPIT (tekst, datums, mail-opschoning)
// ═══════════════════════════════════════════════════════════
// Pure functies zonder eigen staat: tekst netjes maken, een datum leesbaar
// schrijven, een mail van vreemde opmaak ontdoen. Ze stonden onderaan
// ClientCockpit.tsx, en dat bestand liep daardoor over de grens van duizend
// regels heen (de poort in proeven/bestandsgrootte.proef.ts). Ze horen hier
// beter: het zijn omzetters, geen scherm.
//
// Nieuwe omzetter voor de cockpit? Zet hem hier, niet terug in het scherm.
// ═══════════════════════════════════════════════════════════

const METRIC_LABELS: Record<string, string> = {
  clicks: "Klikken",
  impressions: "Vertoningen",
  ctr: "CTR",
  position: "Gem. positie",
  users: "Bezoekers",
  totalUsers: "Bezoekers",
  sessions: "Sessies",
  conversions: "Conversies",
  org_traffic: "Organisch verkeer",
  org_keywords: "Organische zoekwoorden",
  domain_rating: "Domain Rating",
};

export function metricLabel(metric: string): string {
  return METRIC_LABELS[metric] || metric;
}

export function fmtMetric(metric: string, value: number | null): string {
  if (value == null) return "—";
  if (metric === "ctr") return `${value.toFixed(1)}%`;
  if (metric === "position") return value.toFixed(1);
  if (metric === "domain_rating") return value.toFixed(0);
  return value.toLocaleString("nl-NL");
}

export function periodLabel(period: string): string {
  if (period === "last28") return "laatste 28 dagen";
  if (period === "last7") return "laatste 7 dagen";
  if (period === "last90") return "laatste 90 dagen";
  if (period === "now") return "nu";
  return period;
}

// Lichte opschoning van mail-HTML voor weergave in het dashboard:
// scripts/styles/event-handlers en javascript-links eruit.
export function sanitizeEmail(html: string): string {
  return html
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*style[\s\S]*?<\s*\/\s*style\s*>/gi, "")
    // Inline-bijlagen (cid:) kunnen in de browser niet laden en tonen als kapotte
    // plaatjes; die halen we weg. Gewone (https-)afbeeldingen blijven staan.
    .replace(/<img[^>]*src\s*=\s*["']cid:[^"']*["'][^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/<a\s/gi, '<a target="_blank" rel="noreferrer" ');
}

// Schoont de HTML uit de editor op: paragrafen/divs naar gewone regels (zonder
// de grote standaard-marges van <p>), hoogstens één witregel, en getypte
// **vet** wordt echt vet. Lijsten (ul/li) blijven intact.
export function cleanReplyHtml(html: string): string {
  return html
    // lege blokken (alleen een regeleinde) volledig weg
    .replace(/<(p|div)[^>]*>\s*(<br\s*\/?>)?\s*<\/(p|div)>/gi, "")
    // grens tussen twee paragrafen → één witregel
    .replace(/<\/(p|div)>\s*<(p|div)[^>]*>/gi, "<br><br>")
    // overige blok-tags weghalen (marges veroorzaken de grote witgaten)
    .replace(/<\/?(p|div)[^>]*>/gi, "")
    // getypte markdown-vet omzetten
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // nooit meer dan één witregel
    .replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>")
    .replace(/^(\s*<br\s*\/?>)+/i, "")
    .replace(/(<br\s*\/?>\s*)+$/i, "")
    .trim();
}

export function daysSince(iso: string): number | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function daysAgoLabel(iso: string): string {
  const n = daysSince(iso);
  if (n == null) return "";
  if (n <= 0) return "vandaag";
  if (n === 1) return "1 dag";
  return `${n} dagen`;
}

export function contactColor(iso: string): string {
  const n = daysSince(iso);
  if (n == null) return "gray";
  if (n < 7) return "green";
  if (n < 14) return "orange";
  return "red";
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) +
    ", " + d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname === "/" ? u.hostname : u.pathname).replace(/\/$/, "") || url;
  } catch {
    return url;
  }
}
