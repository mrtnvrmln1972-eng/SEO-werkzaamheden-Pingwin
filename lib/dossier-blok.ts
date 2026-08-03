import { mdToHtml } from "./markdown";
import { linkifyHtml } from "./linkify";
import { HARD_BEWIJS, type PaginaMail } from "./page-emails";
import type { PageDossier, DossierDoc } from "./page-dossier";

// ═══════════════════════════════════════════════════════════
// HET DOSSIERBLOK: wat je op de kaart ziet
// ═══════════════════════════════════════════════════════════
// Bewust karig. Eén alinea, een rij linkjes, een rij statussen, en de rest
// ingeklapt. De voorraadkast is groot; dit venster is klein. Zou hier alles in
// komen, dan is het middel erger dan de kwaal.
//
// Dit is een pure functie die HTML teruggeeft, zodat exact hetzelfde blok op
// alle plekken gerenderd kan worden: bird's eye-chat, voorgestelde taak,
// weekplankaart en Pagina's.
// ═══════════════════════════════════════════════════════════

const MAX_MAILS = 3;
const MAX_DOCS = 4;

function esc(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const MAAND = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

function datumKort(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MAAND[d.getMonth()]}`;
}

function mailLink(m: PaginaMail): string {
  return m.superhumanLink || m.webLink || "";
}

// "de mail van 22 juli" in de alinea wordt een echte link naar díe mail.
// Kennen we de datum niet, dan blijft het gewone tekst: nooit een dode link.
function linkifyMailDatums(html: string, mails: PaginaMail[]): string {
  if (!mails.length) return html;
  const perDatum = new Map<string, PaginaMail>();
  for (const m of mails) {
    if (!m.ontvangenOp) continue;
    const d = new Date(m.ontvangenOp);
    if (Number.isNaN(d.getTime())) continue;
    const sleutels = [`${d.getDate()} ${MAAND[d.getMonth()]}`, `${d.getDate()}-${d.getMonth() + 1}`];
    for (const s of sleutels) if (!perDatum.has(s)) perDatum.set(s, m);
  }
  if (!perDatum.size) return html;

  // Alleen buiten bestaande tags en links vervangen.
  const delen = html.split(/(<a\b[^>]*>[\s\S]*?<\/a>|<[^>]+>)/gi);
  return delen.map((seg, i) => {
    if (i % 2 === 1 || !seg) return seg;
    return seg.replace(
      /\b(\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)|\d{1,2}-\d{1,2})\b/gi,
      (heel) => {
        const m = perDatum.get(heel.toLowerCase());
        const link = m ? mailLink(m) : "";
        if (!link) return heel;
        return `<a class="wp-maillink" href="${esc(link)}" target="_blank" rel="noreferrer" title="${esc(m!.onderwerp)}">${heel}</a>`;
      },
    );
  }).join("");
}

// Een mail als chip. Bevestigd (vastgepind of hard bewijs) ziet er stellig uit;
// een automatische treffer krijgt een vraagteken plus twee knopjes, zodat een gok
// nooit voor een feit doorgaat en je hem met één klik afhandelt.
function mailChip(m: PaginaMail): string {
  const link = mailLink(m);
  const wie = m.vanNaam || m.vanAdres || "onbekend";
  const datum = datumKort(m.ontvangenOp);
  const vast = m.bron === "pin" || m.score >= HARD_BEWIJS;
  const titel = vast
    ? `${m.onderwerp}${m.reden ? ` (${m.reden})` : ""}`
    : `Automatisch gevonden: ${m.reden || "lijkt over deze pagina te gaan"}`;
  const label = `${esc(wie.split(" ")[0])}${datum ? `, ${datum}` : ""}`;
  const bij = m.heeftBijlagen ? '<span class="pd-bij">bijlage</span>' : "";
  const inhoud = `<span class="pd-ico">✉</span>${label}${bij}`;
  const kern = link
    ? `<a class="pd-chip-link" href="${esc(link)}" target="_blank" rel="noreferrer" title="${esc(titel)}">${inhoud}</a>`
    : `<span class="pd-chip-link" title="${esc(titel)}">${inhoud}</span>`;
  const acties = vast
    ? (m.bron === "pin" ? `<button type="button" class="pd-knop pd-los" data-mail="${m.id}" title="Niet meer vastpinnen">📌</button>` : "")
    : `<button type="button" class="pd-knop pd-pin" data-mail="${m.id}" title="Deze mail hoort hier: vastpinnen">📌</button>` +
      `<button type="button" class="pd-knop pd-weg" data-mail="${m.id}" title="Hoort hier niet, en vraag het niet nog eens">×</button>`;
  // Zitten er teksten bij? Dan kun je ze met één klik als klantversie klaarzetten
  // in het documentenvak dat er al is.
  const bijlageKnop = m.heeftBijlagen
    ? `<button type="button" class="pd-knop pd-bijlage" data-mail="${m.id}" title="Zet de tekstbijlagen uit deze mail klaar als klantversie">↓</button>`
    : "";
  return `<span class="pd-chip${vast ? " pd-vast" : " pd-gok"}">${kern}${bijlageKnop}${acties}</span>`;
}

function docChip(d: DossierDoc, klant = false): string {
  const label = klant ? `${esc(d.naam)}` : esc(d.label);
  const inhoud = `<span class="pd-ico">▤</span>${label}${klant ? '<span class="pd-bij">te verwerken</span>' : ""}`;
  return d.link
    ? `<a class="pd-chip${klant ? " pd-klant" : ""}" href="${esc(d.link)}" target="_blank" rel="noreferrer" title="Open het document">${inhoud}</a>`
    : `<span class="pd-chip pd-leeg" title="Deze tekst bestaat, maar er is geen document van">${inhoud}</span>`;
}

// De statusregel: alleen wat je moet weten om te beslissen wat je nu doet.
function statusChips(d: PageDossier): string {
  const chips: string[] = [];
  const s = d.stand;
  if (s) {
    if (s.copy) chips.push('<span class="pd-stat pd-ok">Copy klaar</span>');
    if (d.copyLive && d.copyLive.totaal > 0 && !d.copyLive.doorgevoerd) {
      chips.push(`<span class="pd-stat pd-stop" title="${d.copyLive.gevonden} van ${d.copyLive.totaal} koppen gevonden op de pagina">Nog niet live verwerkt</span>`);
    }
    if (!s.structured) chips.push('<span class="pd-stat pd-stop">Geen structured data</span>');
    if (!s.live) chips.push('<span class="pd-stat pd-stop">Staat niet live</span>');
  }
  if (d.klantvoorstellen.length) {
    chips.push(`<span class="pd-stat pd-let">${d.klantvoorstellen.length === 1 ? "Klantversie" : `${d.klantvoorstellen.length} klantversies`} klaar om te verwerken</span>`);
  }
  return chips.length ? `<div class="pd-rij pd-statusrij">${chips.join("")}</div>` : "";
}

function tijdlijn(d: PageDossier): string {
  const rijen = d.activiteit.slice(0, 10);
  const extraMails = d.mails.slice(MAX_MAILS);
  const extraDocs = d.documenten.slice(MAX_DOCS);
  const aantal = rijen.length + extraMails.length + extraDocs.length + d.chats.length;
  if (!aantal) return "";

  const delen: string[] = [];
  if (extraMails.length || extraDocs.length) {
    delen.push(`<div class="pd-rij">${[...extraMails.map(mailChip), ...extraDocs.map((x) => docChip(x))].join("")}</div>`);
  }
  if (rijen.length) {
    delen.push(`<ul class="pd-tijdlijn">${rijen.map((a) => {
      const datum = new Date(a.gebeurdeOp).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
      const tekst = esc(a.intern);
      const bewijs = a.bewijs ? ` <a href="${esc(a.bewijs)}" target="_blank" rel="noreferrer">bekijk</a>` : "";
      return `<li><span class="pd-datum">${datum}</span> ${tekst}${bewijs}</li>`;
    }).join("")}</ul>`);
  }
  if (d.chats.length) {
    delen.push(`<div class="pd-chats">${d.chats.map((c) => `<span class="pd-chatregel" data-chat="${c.id}">${esc(c.title.slice(0, 90))}</span>`).join("")}</div>`);
  }
  return `<details class="pd-meer"><summary>Tijdlijn en eerdere notities (${aantal})</summary><div class="pd-meer-body">${delen.join("")}</div></details>`;
}

/**
 * Het volledige blok als HTML. `tekst` is de opgeslagen alinea.
 */
export function dossierBlokHtml(d: PageDossier, tekst: string, opts: { compact?: boolean } = {}): string {
  const domein = d.domein;
  // De alinea: markdown → HTML, slugs klikbaar, maildatums naar de echte mail.
  const alinea = linkifyMailDatums(linkifyHtml(mdToHtml(tekst || ""), domein), d.mails);

  const mails = d.mails.slice(0, MAX_MAILS).map(mailChip);
  const docs = d.documenten.slice(0, MAX_DOCS).map((x) => docChip(x));
  const klant = d.klantvoorstellen.map((x) => docChip(x, true));
  const pagina = d.url
    ? `<a class="pd-chip" href="${esc(d.url)}" target="_blank" rel="noreferrer" title="De live pagina"><span class="pd-ico">↗</span>${esc(d.pad)}</a>`
    : "";
  const linkrij = [...klant, ...mails, ...docs, pagina].filter(Boolean);

  return [
    '<div class="pd-blok">',
    '<div class="pd-kop"><span class="pd-koptekst">Waar deze pagina staat</span></div>',
    alinea ? `<div class="pd-alinea md">${alinea}</div>` : "",
    linkrij.length ? `<div class="pd-rij">${linkrij.join("")}</div>` : "",
    opts.compact ? "" : statusChips(d),
    opts.compact ? "" : tijdlijn(d),
    "</div>",
  ].filter(Boolean).join("");
}
