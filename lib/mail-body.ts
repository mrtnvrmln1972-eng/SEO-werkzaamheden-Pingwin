// ═══════════════════════════════════════════════════════════
// DE MAIL VANUIT EEN KAART OPBOUWEN
// ═══════════════════════════════════════════════════════════
// Van de tekst die Maarten in het mailvenster ziet naar de HTML die de ontvanger
// krijgt. Stond als losse functies in de verstuurroute, en was daardoor nergens
// na te rekenen; nu is het één bron met een proef eromheen
// (`proeven/mail-links.proef.ts`), en gebruiken het venster én de route dezelfde
// vorm voor een linkregel.
//
// Wat het moet doen, in volgorde van belang:
//  1. Een aangevinkte link mag NOOIT stil verdwijnen. Op 03-08-2026 ging er een
//     mail uit met "kun je deze tekst op de bijgevoegde link plaatsen?" terwijl
//     die link nergens in de mail stond; de ontvanger verwijst dan naar iets wat
//     er niet is.
//  2. Geen kale URL van honderd tekens in beeld bij de ontvanger. In het
//     schrijfvenster juist wél, want daar wil Maarten hem kunnen zien, kopiëren
//     en in een zin zetten.
//  3. Een mail blijft een mail: korte alinea's, simpele bullets, geen tabellen
//     en geen kopjes.

export type MailLink = { label: string; url: string };

// De vorm van een linkregel onderaan de mail. Het schrijfvenster zet hem zo neer
// (met de volledige URL in beeld), en hieronder wordt precies diezelfde regel
// herkend en tot één nette link gemaakt. Eén afspraak, op één plek.
export function linkRegel(l: MailLink): string {
  return `${l.label}: ${l.url}`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Splitst de HTML in stukken lopende tekst en stukken opmaak (tags en links die
// er al staan). Alleen de tekststukken mogen aangeraakt worden; anders belandt er
// een link binnen een link en klapt de mail visueel in elkaar.
function overTekst(html: string, fn: (tekst: string) => string): string {
  return html.split(/(<a\b[^>]*>[\s\S]*?<\/a>|<[^>]+>)/gi)
    .map((seg, i) => (i % 2 === 1 || !seg ? seg : fn(seg)))
    .join("");
}

// Hangt de links aan de tekst, en geeft terug welke er niet in pasten. Die komen
// verderop alsnog onderaan de mail te staan (zie `plakOnderaan`).
function linkify(html: string, links: MailLink[]): { html: string; ongeplaatst: MailLink[] } {
  let uit = html;
  const ongeplaatst: MailLink[] = [];
  for (const l of links) {
    if (!l.url || !l.label) continue;
    // 1. De regel "Naam: https://…" die het mailvenster zelf onderaan de tekst
    //    zet, wordt één nette link. Zo zie je tijdens het schrijven de volledige
    //    URL staan (en kun je hem in een zin zetten), terwijl de ontvanger geen
    //    regel van honderd tekens in beeld krijgt.
    const regel = esc(linkRegel(l));
    if (uit.includes(regel)) {
      uit = uit.split(regel).join(`<a href="${l.url}">${esc(l.label)}</a>`);
      continue;
    }
    // 2. Noemt de tekst de naam van het document, dan hangt de link daaraan.
    //    Alleen de eerste vermelding: drie keer dezelfde link leest rommelig.
    const woord = esc(l.label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[\\s(>])(${woord})(?=[\\s).,:;!?<]|$)`, "i");
    let gezet = false;
    uit = overTekst(uit, (seg) => {
      if (gezet || !re.test(seg)) return seg;
      gezet = true;
      return seg.replace(re, (_m, pre, tekst) => `${pre}<a href="${l.url}">${tekst}</a>`);
    });
    if (gezet) continue;
    // 3. Staat alleen de kale URL in de tekst, omdat je hem zelf in een zin hebt
    //    gezet, dan wordt die hieronder klikbaar gemaakt. Niets meer te doen, en
    //    zeker niet nog een keer onderaan plakken.
    if (uit.includes(esc(l.url))) continue;
    ongeplaatst.push(l);
  }
  return { html: uit, ongeplaatst };
}

// Een URL die je zelf in een zin zette wordt klikbaar. Zonder dit staat er een
// kale https://… in de mail en moet de ontvanger hem overtypen.
function linkifyKaleUrls(html: string): string {
  return overTekst(html, (seg) => seg.replace(/(^|[\s(])(https?:\/\/[^\s<>"']+)/gi, (_m, pre, url) => {
    // Een punt of haakje direct achter de URL hoort bij de zin, niet bij de link.
    const staart = /[.,:!?)]+$/.exec(url)?.[0] || "";
    const schoon = staart ? url.slice(0, -staart.length) : url;
    return `${pre}<a href="${schoon}">${schoon}</a>${staart}`;
  }));
}

// Wat niet in de lopende tekst paste, komt er onderaan alsnog bij. Simpel, zoals
// een mail hoort: een regel per link, geen tabel en geen kopjes.
function plakOnderaan(html: string, links: MailLink[]): string {
  if (!links.length) return html;
  const regels = links.map((l) => `<p><a href="${l.url}">${esc(l.label)}</a></p>`).join("\n");
  return `${html}\n${regels}`;
}

// Meegestuurde screenshots (geplakt of gesleept in het bewerkbare vak) gaan
// als losse <img>-blokken onderaan de mail, na de links. Zelfde plek en vorm
// als in MailPopup, dat andere mailvenster in het dashboard.
function plakAfbeeldingen(html: string, afbeeldingen: string[]): string {
  if (!afbeeldingen.length) return html;
  const imgs = afbeeldingen
    .filter((a) => /^data:image\//i.test(a))
    .map((a) => `<img src="${a}" alt="Bijgevoegde afbeelding" style="max-width:100%;margin-top:8px;display:block;border-radius:8px;">`)
    .join("\n");
  return `${html}\n${imgs}`;
}

// Paden naar de live site worden echte links, zodat de sitebouwer overal kan
// doorklikken zonder een URL over te typen.
function linkifyPaden(html: string, domein: string): string {
  const basis = (domein || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!basis) return html;
  return overTekst(html, (seg) => seg.replace(
    /(^|[\s(>])(\/[a-z][a-z0-9-]*(?:\/[a-z0-9-]+)*\/?)(?=[\s).,:;!?]|$)/gi,
    (_m, pre, pad) => `${pre}<a href="https://${basis}${pad}">${pad}</a>`));
}

function naarHtml(tekst: string, links: MailLink[]): { html: string; ongeplaatst: MailLink[] } {
  const veilig = esc(tekst || "");
  // Een enkel vet woord en een genummerd lijstje mogen wel. Dat doet Maarten in
  // zijn eigen mails ook en het leest prettiger; het is iets anders dan een mail
  // volplempen met kopjes en kaders. Sterretjes die niets omsluiten blijven staan
  // zoals ze staan, zodat "5 * 3" geen opmaak wordt.
  const vet = (s: string) => s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>");
  const regels = veilig.split("\n").map((r) => r.trimEnd());
  const uit: string[] = [];
  let inLijst: "ul" | "ol" | null = null;
  const sluit = () => { if (inLijst) { uit.push(`</${inLijst}>`); inLijst = null; } };
  for (const r of regels) {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(r);
    const genummerd = /^\s*\d+[.)]\s+(.*)$/.exec(r);
    if (bullet || genummerd) {
      const soort = bullet ? "ul" : "ol";
      if (inLijst !== soort) { sluit(); uit.push(`<${soort}>`); inLijst = soort; }
      uit.push(`<li>${vet((bullet || genummerd)![1])}</li>`);
      continue;
    }
    sluit();
    if (!r.trim()) { uit.push(""); continue; }
    uit.push(`<p>${vet(r)}</p>`);
  }
  sluit();
  return linkify(uit.filter((x) => x !== "").join("\n"), links);
}

// De hele mail, van getypte tekst naar verzendklare HTML.
export function bouwMailHtml(
  tekst: string,
  links: MailLink[],
  domein: string,
  afbeeldingen: string[] = [],
): string {
  const { html, ongeplaatst } = naarHtml(tekst, links);
  const metUrls = linkifyKaleUrls(plakOnderaan(html, ongeplaatst));
  return plakAfbeeldingen(linkifyPaden(metUrls, domein), afbeeldingen);
}
