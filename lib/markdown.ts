import { zonderLosStreepje } from "./streepjes";
// Compacte markdown → HTML renderer voor alles wat Maarten op het scherm ziet
// (kopjes, bullets, genummerde en geneste lijsten, tabellen, citaten,
// codeblokken, vet/cursief, links). Bewust klein en zonder externe dependency.
// Alle tekst wordt eerst ge-escaped.
//
// Waarom dit bestand breder is dan het lijkt: de opmaakregel van dit dashboard
// is "nooit ruwe markdown in beeld". Alles wat deze renderer NIET kent, komt
// letterlijk op het scherm als `>` of ``` of een rij pipes. De motoren die de
// AI aansturen vragen vrijelijk om markdown, dus elk gat hier is een garantie
// op rommel in beeld, niet een kans erop. Vandaar dat de gaten van 6 augustus
// 2026 (citaten, codeblokken, geneste lijsten, tabel zonder scheidingsregel)
// hier dicht zijn, en dat proeven/opmaak.proef.ts ze dicht houdt.

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Ook het dubbele aanhalingsteken: zonder dit kan een aanhalingsteken in een
    // URL uit het href-attribuut breken.
    .replace(/"/g, "&quot;");
}

function inline(s: string, base: string): string {
  let t = esc(s);
  // ── Codestukjes eerst opzij ──────────────────────────────────────────────
  // Wat tussen backticks staat is letterlijke code en mag door geen enkele
  // regel hieronder meer aangeraakt worden. Stond een webadres tussen die
  // backticks (`https://site.nl/#organization`), dan pakte de link-regel dat
  // adres inclusief de sluit-backtick, en daarna knipte de code-regel op de
  // verkeerde plek: het resultaat was een kapotte tag met een `</code>` middenin
  // een href, en de rest van de alinea kleurde mee als link (21-08-2026, in de
  // opdracht voor de developer). Ze gaan dus eerst opzij en komen als laatste
  // terug; het merkteken (een niet-typbaar teken) raakt geen enkele regel.
  const codes: string[] = [];
  t = t.replace(/`([^`]+)`/g, (_m, code: string) => {
    codes.push(code);
    return `\u0000c${codes.length - 1}\u0000`;
  });
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
  // URL's, breuken (50/50) en woorden (en/of) nooit meegepakt worden. De `;`
  // hoort in die lijst omdat een aanhalingsteken hierboven `&quot;` werd.
  if (base) {
    t = t.replace(/(^|[\s(*'`;])(\/[a-zA-Z0-9][a-zA-Z0-9\-._~%/]*)/g, (_m, pre: string, path: string) => {
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
  // En de codestukjes terug op hun plek, precies zoals ze er stonden.
  t = t.replace(/\u0000c(\d+)\u0000/g, (_m, nr: string) => `<code>${codes[Number(nr)]}</code>`);
  return t;
}

function splitRow(line: string): string[] {
  return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
}

/** Een regel die eruitziet als een tabelrij: begint én eindigt met een pipe. */
function isTabelRij(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

/** De |---|---|-regel onder een tabelkop. Mag ontbreken; dan is er geen kop. */
function isScheiding(line: string | undefined): boolean {
  return Boolean(line) && /-/.test(line as string) && /^\s*\|?[\s:|-]+\|?\s*$/.test(line as string);
}

/** Hoeveel spaties staan er vóór het opsommingsteken. Tab telt als twee. */
function inspringing(line: string): number {
  const m = line.match(/^[ \t]*/);
  return (m ? m[0] : "").replace(/\t/g, "  ").length;
}

export function mdToHtml(md: string, siteUrl?: string): string {
  // Site-URL normaliseren: "onedayclinic.nl" of "https://onedayclinic.nl/" → "https://onedayclinic.nl".
  const base = (siteUrl || "").trim()
    ? ((siteUrl || "").trim().match(/^https?:\/\//i) ? (siteUrl || "").trim() : `https://${(siteUrl || "").trim()}`).replace(/\/+$/, "")
    : "";
  // Vaste schrijfregel: geen los liggend lang streepje als zinsscheiding. Hier,
  // in de weergave, dus ook in alle tekst die er al staat (zie lib/streepjes.ts).
  const lines = zonderLosStreepje((md || "").replace(/\r/g, "")).split("\n");
  const out: string[] = [];
  let i = 0;

  // Lijsten kunnen nesten. Zonder deze stapel werd een sub-bullet een gewone
  // bullet en zag een lijst met twee niveaus eruit als één platte lijst.
  const stapel: { type: "ul" | "ol"; inspring: number }[] = [];
  const sluitTot = (inspring: number) => {
    while (stapel.length && stapel[stapel.length - 1].inspring > inspring) {
      out.push(`</${stapel.pop()!.type}>`);
    }
  };
  const sluitAlles = () => { while (stapel.length) out.push(`</${stapel.pop()!.type}>`); };

  while (i < lines.length) {
    const line = lines[i];

    // Codeblok met ``` : letterlijk tonen, niets erin opmaken. Zonder deze tak
    // stonden de backticks zelf in beeld.
    const fence = line.match(/^\s*```+\s*([a-zA-Z0-9+#-]*)\s*$/);
    if (fence) {
      sluitAlles();
      i++;
      const code: string[] = [];
      while (i < lines.length && !/^\s*```+\s*$/.test(lines[i])) { code.push(lines[i]); i++; }
      if (i < lines.length) i++; // het sluitende hek
      out.push(`<pre class="md-code"><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }

    // Horizontale scheidingslijn (--- / *** / ___) → nette lijn i.p.v. streepjes.
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { sluitAlles(); out.push("<hr>"); i++; continue; }

    // Citaat (> tekst). Meerdere regels achter elkaar worden één blok.
    if (/^\s*>\s?/.test(line)) {
      sluitAlles();
      const cite: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        cite.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${cite.map((c) => inline(c, base)).join("<br>")}</blockquote>`);
      continue;
    }

    // Tabel. De scheidingsregel |---| is niet verplicht: zonder die regel viel de
    // hele tabel eerst terug op gewone alinea's en stonden de pipes in beeld.
    if (isTabelRij(line)) {
      sluitAlles();
      const rijen: string[][] = [];
      let kop: string[] | null = null;
      if (isScheiding(lines[i + 1])) { kop = splitRow(line); i += 2; }
      while (i < lines.length && isTabelRij(lines[i])) {
        if (!isScheiding(lines[i])) rijen.push(splitRow(lines[i]));
        i++;
      }
      const kopHtml = kop
        ? "<thead><tr>" + kop.map((h) => `<th>${inline(h, base)}</th>`).join("") + "</tr></thead>"
        : "";
      out.push(
        '<table class="md-table">' + kopHtml + "<tbody>" +
        rijen.map((r) => "<tr>" + r.map((c) => `<td>${inline(c, base)}</td>`).join("") + "</tr>").join("") +
        "</tbody></table>",
      );
      continue;
    }

    // Kopjes. # wordt h3 (h1/h2 horen bij de pagina zelf, niet bij de inhoud),
    // en elk niveau daaronder krijgt een eigen tag zodat ze visueel verschillen.
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { sluitAlles(); const lvl = Math.min(h[1].length + 2, 6); out.push(`<h${lvl}>${inline(h[2], base)}</h${lvl}>`); i++; continue; }

    const bullet = line.match(/^(\s*)[-*]\s+(.*)$/);
    const nummer = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (bullet || nummer) {
      const type: "ul" | "ol" = bullet ? "ul" : "ol";
      const inspring = inspringing(line);
      const tekst = (bullet ? bullet[2] : nummer![2]);
      sluitTot(inspring);
      const huidig = stapel[stapel.length - 1];
      if (!huidig || huidig.inspring < inspring) {
        out.push(`<${type}>`);
        stapel.push({ type, inspring });
      } else if (huidig.type !== type) {
        out.push(`</${stapel.pop()!.type}>`);
        out.push(`<${type}>`);
        stapel.push({ type, inspring });
      }
      out.push(`<li>${inline(tekst, base)}</li>`);
      i++; continue;
    }

    if (!line.trim()) { sluitAlles(); i++; continue; }

    sluitAlles();
    const para: string[] = [line];
    i++;
    while (
      i < lines.length && lines[i].trim() &&
      !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^#{1,6}\s/.test(lines[i]) && !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*```+/.test(lines[i]) && !isTabelRij(lines[i])
    ) {
      para.push(lines[i]); i++;
    }
    out.push(`<p>${para.map((p) => inline(p, base)).join("<br>")}</p>`);
  }
  sluitAlles();
  return out.join("\n");
}
