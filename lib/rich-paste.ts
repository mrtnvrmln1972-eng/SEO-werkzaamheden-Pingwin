// ═══════════════════════════════════════════════════════════
// PLAK-OPSCHONER VOOR RICH-TEXT VELDEN (client-side)
// ═══════════════════════════════════════════════════════════
// Gebruikt in de taakcellen en in de "Zoekwoorden & links"-kaart.
// Probleem dat dit oplost: als je cellen uit Google Sheets/Docs of een
// webpagina plakt, komen er inline lettertypes, kleuren en classes mee die
// het dashboard-font overrulen (inline stijl wint van CSS). Deze functie
// gooit ALLE opmaak weg en houdt alleen de inhoud over die we willen:
// tekst, links (klikbaar, openen in een nieuw tabblad), vet/cursief en
// regelafbrekingen. Tabellen en cel-rijtjes worden platgeslagen naar regels.
// ═══════════════════════════════════════════════════════════

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Loopt door de geplakte HTML-boom en bouwt schone HTML op.
function walk(node: Node): string {
  let out = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += escapeHtml((child.textContent || "").replace(/\s+/g, " "));
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "a") {
      const href = el.getAttribute("href") || "";
      const inner = walk(el).trim() || escapeHtml(href);
      if (href && !href.startsWith("javascript:")) {
        out += `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${inner}</a>`;
      } else {
        out += inner;
      }
      return;
    }
    if (tag === "br") { out += "<br>"; return; }
    if (tag === "b" || tag === "strong") { out += `<strong>${walk(el)}</strong>`; return; }
    if (tag === "i" || tag === "em") { out += `<em>${walk(el)}</em>`; return; }

    // Tabel/cel/lijst-structuur platslaan naar regels.
    if (tag === "tr" || tag === "li" || tag === "p" || tag === "div") {
      const inner = walk(el).trim();
      if (inner) out += (out && !out.endsWith("<br>") ? "<br>" : "") + inner;
      return;
    }
    if (tag === "td" || tag === "th") {
      const inner = walk(el).trim();
      if (inner) out += (out && !/[\s>]$/.test(out) ? " " : "") + inner;
      return;
    }

    // Alle overige tags: alleen de inhoud overnemen, opmaak weg.
    out += walk(el);
  });
  return out;
}

// Schoont geplakte HTML. Geeft veilige, opmaak-loze HTML terug met klikbare links.
export function cleanPastedHtml(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return walk(doc.body)
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
