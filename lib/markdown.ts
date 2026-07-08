// Compacte markdown → HTML renderer voor de chat-output (kopjes, bullets,
// genummerde lijsten, tabellen, vet/cursief, links, code). Bewust klein en
// zonder externe dependency. Alle tekst wordt eerst ge-escaped.

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string, base: string): string {
  let t = esc(s);
  // Markdown-links [tekst](url) → klikbaar, nieuw tabblad.
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  // Markdown-links met een relatief pad [tekst](/pad/) → link naar de klant-site.
  t = t.replace(/\[([^\]]+)\]\((\/[^\s)]*)\)/g, (_m, txt: string, path: string) =>
    base ? `<a href="${base}${path}" target="_blank" rel="noreferrer">${txt}</a>` : txt);
  // Kale URL's (https://...) die nog niet in een link/attribuut zitten → ook klikbaar.
  t = t.replace(/(^|[^"'>=/])(https?:\/\/[^\s<]+)/g, (_m, pre: string, url: string) => {
    const trail = (url.match(/[.,;:)\]]+$/) || [""])[0];
    const clean = url.slice(0, url.length - trail.length);
    return `${pre}<a href="${clean}" target="_blank" rel="noreferrer">${clean}</a>${trail}`;
  });
  // Losse slugs zoals /lensimplantatie/ of /blog/artikel/ → link naar de live
  // pagina op de klant-site (alleen als de site-URL bekend is). Het pad moet
  // aan het begin staan of na witruimte/haakje/opmaakteken, zodat delen van
  // URL's, breuken (50/50) en woorden (en/of) nooit meegepakt worden.
  if (base) {
    t = t.replace(/(^|[\s(*"'`])(\/[a-zA-Z0-9][a-zA-Z0-9\-._~%/]*)/g, (_m, pre: string, path: string) => {
      const trail = (path.match(/[.,;:!?]+$/) || [""])[0];
      const clean = path.slice(0, path.length - trail.length);
      if (clean.length < 2) return pre + path;
      return `${pre}<a href="${base}${clean}" target="_blank" rel="noreferrer">${clean}</a>${trail}`;
    });
  }
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  // _tekst_ → onderstreept (niet binnen bestandsnamen/__ ).
  t = t.replace(/(^|[^_\w])_([^_\n]+)_(?![_\w])/g, "$1<u>$2</u>");
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  return t;
}

function splitRow(line: string): string[] {
  return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
}

export function mdToHtml(md: string, siteUrl?: string): string {
  // Site-URL normaliseren: "onedayclinic.nl" of "https://onedayclinic.nl/" → "https://onedayclinic.nl".
  const base = (siteUrl || "").trim()
    ? ((siteUrl || "").trim().match(/^https?:\/\//i) ? (siteUrl || "").trim() : `https://${(siteUrl || "").trim()}`).replace(/\/+$/, "")
    : "";
  const lines = (md || "").replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let i = 0;
  let listType: "ul" | "ol" | null = null;
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };

  while (i < lines.length) {
    const line = lines[i];

    // Horizontale scheidingslijn (--- / *** / ___) → nette lijn i.p.v. streepjes.
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { closeList(); out.push("<hr>"); i++; continue; }

    // Tabel: huidige regel bevat |, volgende regel is een scheidingsregel (|---|).
    if (/\|/.test(line) && i + 1 < lines.length && /-/.test(lines[i + 1]) && /^\s*\|?[\s:|-]+$/.test(lines[i + 1])) {
      closeList();
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) { rows.push(splitRow(lines[i])); i++; }
      out.push(
        '<table class="md-table"><thead><tr>' + header.map((h) => `<th>${inline(h, base)}</th>`).join("") + "</tr></thead><tbody>" +
        rows.map((r) => "<tr>" + r.map((c) => `<td>${inline(c, base)}</td>`).join("") + "</tr>").join("") +
        "</tbody></table>",
      );
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { closeList(); const lvl = Math.min(h[1].length + 2, 6); out.push(`<h${lvl}>${inline(h[2], base)}</h${lvl}>`); i++; continue; }

    if (/^\s*[-*]\s+/.test(line)) {
      if (listType !== "ul") { closeList(); out.push("<ul>"); listType = "ul"; }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ""), base)}</li>`); i++; continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      if (listType !== "ol") { closeList(); out.push("<ol>"); listType = "ol"; }
      out.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ""), base)}</li>`); i++; continue;
    }

    if (!line.trim()) { closeList(); i++; continue; }

    closeList();
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i]) && !/\|/.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    out.push(`<p>${para.map((p) => inline(p, base)).join("<br>")}</p>`);
  }
  closeList();
  return out.join("\n");
}
