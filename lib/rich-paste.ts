// ═══════════════════════════════════════════════════════════
// PLAK-OPSCHONER VOOR RICH-TEXT VELDEN (client-side)
// ═══════════════════════════════════════════════════════════
// Gebruikt in de taakcellen en in de "Zoekwoorden & links"-kaart.
// Probleem dat dit oplost: als je cellen uit Google Sheets/Docs of een
// webpagina plakt, komen er inline lettertypes, kleuren, classes én hele
// <style>-blokken (met CSS-commentaar) mee die het dashboard-font overrulen
// of als rommel-tekst verschijnen. Deze functie gooit alle opmaak van buiten weg
// en houdt over wat we willen: tekst, links (klikbaar, nieuw tabblad),
// vet/cursief, en — in rijke modus — koppen, lijsten, lijnen, citaten, alinea's
// en een nette tabel.
//
// ── Waarom rijke modus de standaard is (17 augustus 2026) ──
// Hij bestond al, maar werd door niemand aangezet. Plakte je een uitgewerkte
// strategie uit de chat naar het koersveld ernaast, dan bleef er een muur tekst
// over: de kopjes waren gewone letters die aan de volgende zin vastplakten, de
// bullets waren regelafbrekingen, de lijnen waren weg. Terwijl exact dezelfde
// tekst een kolom verderop wél netjes stond. Opmaak weggooien is goed als het
// om lettertypes en kleuren van buiten gaat, en fout als het om de structuur
// van de tekst zelf gaat; dat onderscheid is nu waar de knip zit.
// ═══════════════════════════════════════════════════════════

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Tags waarvan we de inhoud volledig negeren (anders lekt CSS/script als tekst).
const SKIP_TAGS = new Set(["style", "script", "head", "meta", "title", "link", "colgroup", "col"]);

type Opts = { keepTables?: boolean; rich?: boolean };

// Blokken die hun eigen regel én hun eigen lucht hebben. Een <div> die zo'n blok
// in zich draagt mag dus geen alinea worden: dan zou er een kop of een lijst in
// een <p> belanden en klapt de browser de boel uit elkaar.
const BLOK_TAGS = "p,div,h1,h2,h3,h4,h5,h6,ul,ol,li,table,blockquote,pre,hr";

function bevatBlok(el: HTMLElement): boolean {
  return !!el.querySelector(BLOK_TAGS);
}

// Een geplakte kop wordt altijd een inhoudskop, nooit een paginakop: h1 en h2
// gaan naar h3. Exact dezelfde regel als in `lib/markdown.ts`, zodat geplakte
// tekst en gerenderde AI-tekst er identiek uitzien.
function kopTag(tag: string): string {
  const niveau = Number(tag.slice(1));
  return niveau <= 3 ? "h3" : niveau === 4 ? "h4" : "h5";
}

// Bouwt een nette tabel op uit een <table>-element (zonder inline opmaak).
function buildTable(table: HTMLElement, opts: Opts): string {
  const rows: string[] = [];
  table.querySelectorAll("tr").forEach((tr) => {
    const cells: string[] = [];
    tr.querySelectorAll("th, td").forEach((cell) => {
      const isHead = cell.tagName.toLowerCase() === "th";
      const inner = walk(cell, { ...opts, keepTables: false }).trim();
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
      if (opts.keepTables) { out += buildTable(el, opts); return; }
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

    // Rijke modus: koppen, lijsten, lijnen, citaten en alinea's blijven échte
    // elementen. Dat is het verschil tussen "een muur tekst met regelafbrekingen"
    // en de opmaak die je in de chat ernaast ziet: pas als een kop een <h3> is en
    // een alinea een <p>, kan de huisstijl er een titel en witruimte van maken.
    if (opts.rich) {
      if (/^h[1-6]$/.test(tag)) {
        const inner = walk(el, opts).trim();
        if (inner) { const t = kopTag(tag); out += `<${t}>${inner}</${t}>`; }
        return;
      }
      if (tag === "hr") { out += "<hr>"; return; }
      if (tag === "u" || tag === "ins") { out += `<u>${walk(el, opts)}</u>`; return; }
      if (tag === "ul" || tag === "ol") { const inner = walk(el, opts); if (inner.trim()) out += `<${tag}>${inner}</${tag}>`; return; }
      if (tag === "li") { out += `<li>${walk(el, opts).trim()}</li>`; return; }
      if (tag === "blockquote") { const inner = walk(el, opts).trim(); if (inner) out += `<blockquote>${inner}</blockquote>`; return; }
      if (tag === "pre") { const inner = walk(el, opts).trim(); if (inner) out += `<pre class="md-code"><code>${inner}</code></pre>`; return; }
      if (tag === "code") { const inner = walk(el, opts).trim(); if (inner) out += `<code>${inner}</code>`; return; }
      // Een alinea wordt een alinea. Een <div> alleen als er geen blok in zit:
      // een omhullende <div> om een kop plus een lijst moet gewoon doorlaten,
      // anders zou die kop in een <p> terechtkomen.
      if (tag === "p" || (tag === "div" && !bevatBlok(el))) {
        const inner = walk(el, opts).trim();
        if (inner) out += `<p>${inner}</p>`;
        return;
      }
      if (tag === "div") { out += walk(el, opts); return; }
    }

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

// Schoont geplakte HTML. keepTables=true behoudt een nette tabel; rich=true
// behoudt koppen, lijsten en onderstreping (voor de rijke invulvelden).
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

// Is deze platte tekst eigenlijk markdown? Dan hoort hij gerenderd te worden in
// plaats van letterlijk in beeld te komen. Er moet minstens één echte markering
// op een eigen regel staan (een kopje, een bullet, een genummerd punt, een
// citaat, een codehek of een tabelrij) of vetgedrukte tekst met sterretjes;
// gewone tekst met een streepje erin mag hier nooit doorheen glippen.
export function lijktOpMarkdown(tekst: string): boolean {
  const t = tekst || "";
  if (!t.trim()) return false;
  if (/\*\*[^*\n]+\*\*/.test(t)) return true;
  return t.split("\n").some((r) =>
    /^\s{0,3}#{1,6}\s+\S/.test(r)          // ## Kopje
    || /^\s{0,6}[-*]\s+\S/.test(r)         // - punt
    || /^\s{0,6}\d+[.)]\s+\S/.test(r)      // 1. punt
    || /^\s{0,3}>\s+\S/.test(r)            // > citaat
    || /^\s*```/.test(r)                   // codehek
    || /^\s*\|.*\|\s*$/.test(r)            // | tabel | rij |
  );
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
