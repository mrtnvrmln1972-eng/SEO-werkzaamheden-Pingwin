// ═══════════════════════════════════════════════════════════
// EEN ANALYSE DOORMAILEN ZOALS HIJ OP HET SCHERM STAAT
// ═══════════════════════════════════════════════════════════
// Een goede analyse in de chat kon je alleen als platte tekst doorsturen, en daarna
// als één grijze lap. Dat is niet alleen jammer: een ontvanger die een muur tekst
// ziet leest hem niet, en dan heeft de analyse geen effect. Het verschil tussen wel
// en niet gelezen worden zit precies in de opmaak.
//
// De eerste versie gaf het hele antwoord in één keer aan mdToHtml. Dat ging mis om
// twee redenen:
//
//   1. mdToHtml schuift koppen op ("##" wordt <h4>, nooit <h2>), dus de sectiekoppen
//      kwamen als grijs regeltje aan in plaats van als oranje titel.
//   2. Het scherm haalt die "## "-koppen juist WEG uit de tekst en zet ze als titel
//      boven een eigen witte kaart. Zonder die knip bestaan de kaarten niet en loopt
//      alles aan elkaar door.
//
// Daarom knipt deze module nu eerst per sectie (gedeeld met het scherm, zie
// lib/antwoord-secties.ts) en bouwt hij per sectie een kaart.
//
// Alle opmaak staat inline op het element zelf: Gmail en Outlook gooien een
// <style>-blok weg, dus dat is de enige opmaak die overal overleeft. Om dezelfde
// reden is de lay-out met geneste tabellen gebouwd en niet met div's: Outlook
// gebruikt de Word-engine en kent geen max-width op een div. Afgeronde hoeken
// negeert Outlook; daar worden het rechte hoeken, en dat is de enige concessie.
//
// Bewust apart van de gewone kaart-mail. Die hoort juist simpel te zijn (aanhef,
// korte alinea's, geen tabellen); dit is het omgekeerde geval, een rapport
// doorsturen zoals het is.
// ═══════════════════════════════════════════════════════════

import { mdToHtml } from "./markdown";
import { splitsAntwoord } from "./antwoord-secties";
import { puntSoort } from "./punt-soort";

// Kleuren uit app/globals.css, zodat de mail en het scherm dezelfde huisstijl delen.
const ACCENT = "#F15829";        // Pingwin-accent (live site)
const KOP_ORANJE = "#E7773F";    // --orange, de kleur van een sectietitel
const LINK = "#C95E28";          // --orange-dark, de linkkleur in de chat
const INKT = "#222222";          // --dark
const GRIJS = "#616161";         // --gray
const TAUPE = "#7C7268";         // --brand-taupe, het bolletje voor een constatering
const KAARTRAND = "#F0E7DF";     // --card-border
const KOPLIJN = "#F3E9E1";       // lijntje onder een sectietitel
const RAND = "#E0E0E0";          // --border
const ZEBRA = "#F7F7F8";         // om-en-om achtergrond in een tabel
const PAPIER = "#FAF8F6";        // achtergrond van de mail zelf
const FONT = "'Montserrat',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Per tag de stijl die erop moet. mdToHtml levert h3/h4/h5 (nooit h1/h2), dus die
// drie dragen de hiërarchie binnen een sectie.
const STIJL: Record<string, string> = {
  h3: `margin:16px 0 6px;font-family:${FONT};font-size:16px;line-height:1.35;font-weight:700;color:${INKT}`,
  h4: `margin:14px 0 5px;font-family:${FONT};font-size:14.5px;line-height:1.4;font-weight:700;color:${INKT}`,
  h5: `margin:12px 0 4px;font-family:${FONT};font-size:13.5px;line-height:1.4;font-weight:700;color:${GRIJS}`,
  h6: `margin:12px 0 4px;font-family:${FONT};font-size:13px;line-height:1.4;font-weight:700;color:${GRIJS}`,
  p: `margin:0 0 10px;font-family:${FONT};font-size:14px;line-height:1.62;color:${INKT}`,
  a: `color:${LINK};text-decoration:underline`,
  strong: `font-weight:700;color:${INKT}`,
  em: `font-style:italic`,
  code: `font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;background:#f2efec;padding:1px 5px;border-radius:3px`,
  hr: `border:0;border-top:1px solid ${RAND};margin:16px 0`,
};

// Knopjes en bedieningselementen uit het dashboard doen in een mail niets.
const WEG = /<button\b[^>]*>[\s\S]*?<\/button>|<(?:script|style|svg|input|select|textarea)\b[^>]*>[\s\S]*?<\/(?:script|style|svg|input|select|textarea)>/gi;

function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Eén cel-in-een-tabel als omhulsel; de enige lay-out die Outlook betrouwbaar aankan. */
function doos(inhoud: string, stijl: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;width:100%">`
    + `<tr><td style="${stijl}">${inhoud}</td></tr></table>`;
}

/**
 * Tabellen: mdToHtml geeft `<table class="md-table">` met een `<thead>`. In een mail
 * werkt nth-child niet, dus de om-en-om achtergrond wordt hier geteld en als vaste
 * stijl meegegeven. De donkere kopregel komt uit het dashboard (.md-table th).
 */
function tabellen(html: string): string {
  return html.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_heel, binnen: string) => {
    let rij = 0;
    const body = binnen
      .replace(/<th\b[^>]*>/gi, `<th style="background:${INKT};color:#ffffff;padding:8px 12px;text-align:left;font-weight:700;font-family:${FONT};font-size:12.5px;line-height:1.45">`)
      .replace(/<tr\b[^>]*>/gi, (m: string) => {
        // De koprij zit in <thead> en krijgt geen zebra; die telt niet mee.
        const inHead = /<\/thead>/i.test(binnen) && rij === 0;
        const stijl = inHead ? "" : ` style="background:${rij % 2 === 0 ? "#ffffff" : ZEBRA}"`;
        rij++;
        return `<tr${stijl}>`;
      })
      .replace(/<td\b[^>]*>/gi, `<td style="border:1px solid ${RAND};padding:7px 12px;vertical-align:top;font-family:${FONT};font-size:12.5px;line-height:1.5;color:${INKT}">`);
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;margin:10px 0 14px;font-family:${FONT};font-size:12.5px">${body}</table>`;
  });
}

/**
 * Elk punt een eigen kaartje, zoals in het dashboard: dat maakt een lange analyse
 * scanbaar in plaats van een alinea die je moet uitlezen. Een punt dat wérk
 * beschrijft wordt een kaartje; een losse constatering blijft lopende tekst met een
 * bolletje, precies zoals het scherm het onderscheidt. Zonder dat onderscheid wordt
 * een lange analyse één grote stapel kaders.
 */
function punten(html: string): string {
  return html.replace(/<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_heel, soort: string, binnen: string) => {
    let nr = 0;
    const items = binnen.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_l, inhoud: string) => {
      nr++;
      const kaal = inhoud.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const nummer = soort.toLowerCase() === "ol" ? `<span style="color:${ACCENT};font-weight:700">${nr}.</span> ` : "";
      if (puntSoort(kaal) === "feit") {
        // Constatering: rustige regel met een taupe bolletje.
        return `<tr><td style="padding:3px 0 3px 2px;font-family:${FONT};font-size:14px;line-height:1.6;color:${INKT}">`
          + `<span style="color:${TAUPE};font-weight:700">&bull;</span> ${nummer}${inhoud}</td></tr>`;
      }
      // Werk of vraag: een eigen kaartje.
      return `<tr><td style="padding:0 0 8px">`
        + doos(`${nummer}${inhoud}`, `background:#ffffff;border:1px solid ${KAARTRAND};border-radius:10px;padding:11px 14px;font-family:${FONT};font-size:14px;line-height:1.55;color:${INKT}`)
        + `</td></tr>`;
    });
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;width:100%;margin:8px 0 12px">${items}</table>`;
  });
}

/** De inline stijlen op de overige elementen zetten. */
function stijlen(html: string): string {
  return html.replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi, (heel, tag: string, rest: string) => {
    const stijl = STIJL[tag.toLowerCase()];
    if (!stijl) return heel;
    const bestaand = /\sstyle="([^"]*)"/i.exec(rest);
    const schoon = rest.replace(/\sstyle="[^"]*"/i, "");
    return `<${tag}${schoon} style="${bestaand ? `${stijl};${bestaand[1]}` : stijl}">`;
  });
}

/** Eén sectie van het antwoord als witte kaart met oranje titel. */
function sectieKaart(kop: string, md: string, siteUrl?: string): string {
  let inhoud = mdToHtml(md, siteUrl).replace(WEG, "");
  inhoud = inhoud.replace(/\sclass="[^"]*"/gi, "").replace(/\sdata-[a-z-]+="[^"]*"/gi, "").replace(/\scontenteditable="[^"]*"/gi, "");
  inhoud = tabellen(inhoud);
  inhoud = punten(inhoud);
  inhoud = stijlen(inhoud);
  inhoud = inhoud.replace(/<a\b(?![^>]*\btarget=)/gi, '<a target="_blank" rel="noreferrer" ');

  const titel = kop
    ? `<div style="font-family:${FONT};font-size:15px;line-height:1.45;font-weight:700;color:${KOP_ORANJE};padding-bottom:8px;margin-bottom:10px;border-bottom:1px solid ${KOPLIJN}">${esc(kop)}</div>`
    : "";
  return `<tr><td style="padding:0 0 12px">`
    + doos(titel + inhoud, `background:#ffffff;border:1px solid ${KAARTRAND};border-radius:12px;padding:16px 20px`)
    + `</td></tr>`;
}

/**
 * Bouwt de complete mail uit de RUWE markdown van een antwoord. Krijgt bewust de
 * markdown en geen voorgerenderde HTML, want de sectie-knip moet vóór het renderen
 * gebeuren (anders bestaan de kaarten niet).
 */
export function analyseNaarMailHtml(markdown: string, opties?: { intro?: string; titel?: string; bron?: string; siteUrl?: string }): string {
  const secties = splitsAntwoord(markdown || "");
  const kaarten = secties.map((s) => sectieKaart(s.kop, s.md, opties?.siteUrl)).join("");

  // Kopbalk: hiermee leest het als een rapport van Pingwin en niet als een
  // doorgestuurd mailtje.
  const kopbalk = `<tr><td style="padding:0 0 14px">`
    + doos(
      `<div style="font-family:${FONT};font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#ffffff;opacity:0.92">Pingwin</div>`
      + (opties?.titel ? `<div style="font-family:${FONT};font-size:19px;line-height:1.3;font-weight:700;color:#ffffff;margin-top:5px">${esc(opties.titel)}</div>` : ""),
      `background:${ACCENT};border-radius:12px;padding:16px 20px`)
    + `</td></tr>`;

  const intro = opties?.intro
    ? `<tr><td style="padding:0 4px 14px;font-family:${FONT};font-size:14.5px;line-height:1.62;color:${INKT}">${esc(opties.intro).replace(/\n/g, "<br>")}</td></tr>`
    : "";

  const voet = opties?.bron
    ? `<tr><td style="padding:6px 4px 0;border-top:1px solid ${RAND};font-family:${FONT};font-size:12px;line-height:1.5;color:${GRIJS}">${esc(opties.bron)}</td></tr>`
    : "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background:${PAPIER};margin:0;padding:0">`
    + `<tr><td align="center" style="padding:16px 12px">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="660" style="width:100%;max-width:660px;border-collapse:collapse">`
    + kopbalk + intro + kaarten + voet
    + `</table></td></tr></table>`;
}
