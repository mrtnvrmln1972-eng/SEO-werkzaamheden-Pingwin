// ═══════════════════════════════════════════════════════════
// PLAK-OPSCHONER VOOR RICH-TEXT VELDEN (client-side)
// ═══════════════════════════════════════════════════════════
// Gebruikt in de taakcellen en in de "Zoekwoorden & links"-kaart.
// Probleem dat dit oplost: als je cellen uit Google Sheets/Docs of een
// webpagina plakt, komen er inline lettertypes, kleuren, classes én hele
// <style>-blokken (met CSS-commentaar) mee die het dashboard-font overrulen
// of als rommel-tekst verschijnen. Deze functie gooit ALLE opmaak weg en
// houdt alleen over wat we willen: tekst, links (klikbaar, nieuw tabblad),
// vet/cursief, regelafbrekingen en — optioneel — een nette tabel.
// ═══════════════════════════════════════════════════════════

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Tags waarvan we de inhoud volledig negeren (anders lekt CSS/script als tekst).
const SKIP_TAGS = new Set(["style", "script", "head", "meta", "title", "link", "colgroup", "col"]);

type Opts = { keepTables?: boolean };

// Bouwt een nette tabel op uit een <table>-element (zonder inline opmaak).
function buildTable(table: HTMLElement): string {
  const rows: string[] = [];
  table.querySelectorAll("tr").forEach((tr) => {
    const cells: string[] = [];
    tr.querySelectorAll("th, td").forEach((cell) => {
      const isHead = cell.tagName.toLowerCase() === "th";
      const inner = walk(cell, { keepTables: false }).trim();
      const text = inner.replace(/<[^>]*>/g, "").trim();
      // Getalcellen rechts uitlijnen voor een net raster.
      const numeric = text !== "" && /^[\d.,%€$\s-]+$/.test(text);
      const align = numeric ? ' style="text-align:right"' : "";
      cells.push(`<${isHead ? "th" : "td"}${align}>${inner || "&nbsp;"}</${isHead ? "th" : "td"}>`);
    });
    if (cells.length) rows.push(`<tr>${cells.join("")}</tr>`);
  });
  if (!rows.length) return "";
  return `<table class="paste-table"><tbody>${rows.join("")}</tbody></table>`;
}

// Loopt door de geplakte HTML-boom en bouwt schone HTML op.
function walk(node: Node, opts: Opts): string {
  let out = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += escapeHtml((child.textContent || "").replace(/\s+/g, " "));
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return; // comments e.d. overslaan
    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (SKIP_TAGS.has(tag)) return;

    if (tag === "table") {
      if (opts.keepTables) { out += buildTable(el); return; }
      // Platslaan: elke rij een regel, cellen met spaties ertussen.
      el.querySelectorAll("tr").forEach((tr) => {
        const cells: string[] = [];
        tr.querySelectorAll("th, td").forEach((c) => { const t = walk(c, opts).trim(); if (t) cells.push(t); });
        if (cells.length) out += (out && !out.endsWith("<br>") ? "<br>" : "") + cells.join(" ");
      });
      return;
    }

    if (tag === "a") {
      const href = el.getAttribute("href") || "";
      const inner = walk(el, opts).trim() || escapeHtml(href);
      if (href && !href.startsWith("javascript:")) {
        out += `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${inner}</a>`;
      } else {
        out += inner;
      }
      return;
    }
    if (tag === "br") { out += "<br>"; return; }
    if (tag === "b" || tag === "strong") { out += `<strong>${walk(el, opts)}</strong>`; return; }
    if (tag === "i" || tag === "em") { out += `<em>${walk(el, opts)}</em>`; return; }

    // Blok-elementen: op een nieuwe regel.
    if (tag === "tr" || tag === "li" || tag === "p" || tag === "div") {
      const inner = walk(el, opts).trim();
      if (inner) out += (out && !out.endsWith("<br>") ? "<br>" : "") + inner;
      return;
    }
    if (tag === "td" || tag === "th") {
      const inner = walk(el, opts).trim();
      if (inner) out += (out && !/[\s>]$/.test(out) ? " " : "") + inner;
      return;
    }

    // Alle overige tags: alleen de inhoud overnemen, opmaak weg.
    out += walk(el, opts);
  });
  return out;
}

// Schoont geplakte HTML. keepTables=true behoudt een nette tabel (voor het
// Zoekwoorden & links-veld); anders worden tabellen platgeslagen naar regels.
export function cleanPastedHtml(html: string, opts: Opts = {}): string {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return walk(doc.body, opts)
      .replace(/(<br>\s*){3,}/g, "<br><br>")
      .replace(/^(<br>)+/, "")
      .replace(/(<br>)+$/, "")
      .trim();
  } catch {
    return "";
  }
}

// Zet kale URL's in platte tekst om naar klikbare links.
export function linkifyPlainText(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/https?:\/\/[^\s<>"']+/gi, (url) => {
      const clean = url.replace(/[.,;:!?)"']+$/, "");
      return `<a href="${clean}" target="_blank" rel="noreferrer">${clean}</a>`;
    })
    .replace(/\n/g, "<br>");
}
