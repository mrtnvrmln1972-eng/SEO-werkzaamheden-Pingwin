// ═══════════════════════════════════════════════════════════
// EEN ANALYSE ONVERANDERD DOORMAILEN
// ═══════════════════════════════════════════════════════════
// Een goede analyse in de chat kon je alleen als platte tekst doorsturen: het
// mailvenster leest innerText, dus koppen, tabellen en lijstjes vielen weg en er
// bleef een muur tekst over. Precies het werk dat je wilt laten zien ging kapot
// in de laatste stap.
//
// Mailprogramma's kennen de stijlen van het dashboard niet, en Gmail en Outlook
// gooien een <style>-blok weg. De enige opmaak die overal overleeft staat op het
// element zelf. Deze module zet die stijlen erop, in Pingwin-huisstijl.
//
// Bewust apart van de gewone kaart-mail: die hoort juist simpel te zijn (aanhef,
// korte alinea's, geen tabellen). Dit is het tegenovergestelde geval, een rapport
// doorsturen zoals het op het scherm staat, en dat is een eigen knop.
// ═══════════════════════════════════════════════════════════

const ORANJE = "#F15829";
const INKT = "#2b2b2b";
const GRIJS = "#5e6063";
const LIJN = "#e7dfd7";
const ZACHT = "#faf7f4";
// Montserrat staat niet op de meeste mailclients; deze rij valt netjes terug.
const FONT = "'Montserrat',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Per tag de stijl die erop moet. Alles inline, geen klassen, geen <style>.
const STIJL: Record<string, string> = {
  h1: `margin:28px 0 12px;font-family:${FONT};font-size:23px;line-height:1.25;font-weight:700;color:${INKT}`,
  h2: `margin:26px 0 10px;font-family:${FONT};font-size:19px;line-height:1.3;font-weight:700;color:${ORANJE}`,
  h3: `margin:22px 0 8px;font-family:${FONT};font-size:16px;line-height:1.35;font-weight:700;color:${INKT}`,
  h4: `margin:18px 0 6px;font-family:${FONT};font-size:15px;line-height:1.4;font-weight:700;color:${GRIJS}`,
  p: `margin:0 0 12px;font-family:${FONT};font-size:15px;line-height:1.62;color:${INKT}`,
  ul: `margin:0 0 14px;padding-left:22px;font-family:${FONT};font-size:15px;line-height:1.62;color:${INKT}`,
  ol: `margin:0 0 14px;padding-left:22px;font-family:${FONT};font-size:15px;line-height:1.62;color:${INKT}`,
  li: `margin:0 0 6px`,
  table: `border-collapse:collapse;width:100%;margin:0 0 18px;font-family:${FONT};font-size:14px`,
  th: `border:1px solid ${LIJN};background:${ZACHT};padding:8px 10px;text-align:left;font-weight:700;color:${INKT}`,
  td: `border:1px solid ${LIJN};padding:8px 10px;color:${INKT};vertical-align:top`,
  a: `color:${ORANJE};text-decoration:underline`,
  strong: `font-weight:700;color:${INKT}`,
  em: `font-style:italic`,
  blockquote: `margin:0 0 14px;padding:10px 14px;border-left:3px solid ${ORANJE};background:${ZACHT};font-family:${FONT};font-size:15px;line-height:1.6;color:${GRIJS}`,
  code: `font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;background:${ZACHT};padding:1px 5px;border-radius:3px`,
  hr: `border:0;border-top:1px solid ${LIJN};margin:22px 0`,
};

// Knopjes en bedieningselementen uit het dashboard horen niet in een mail: een
// "+ Taak"-knop of een kruisje doet daar niets en leest als rommel.
const WEG = /<button\b[^>]*>[\s\S]*?<\/button>|<(?:script|style|svg|input|select|textarea)\b[^>]*>[\s\S]*?<\/(?:script|style|svg|input|select|textarea)>|<(?:input|br\s*\/?)\b[^>]*\/?>(?=\s*<\/(?:button|label)>)/gi;

/**
 * Zet gerenderde dashboard-HTML om naar HTML die in een mailprogramma hetzelfde
 * oogt. Verwacht de uitvoer van mdToHtml; geeft een compleet mailbericht terug.
 */
export function analyseNaarMailHtml(html: string, opties?: { intro?: string; titel?: string; bron?: string }): string {
  let h = (html || "").replace(WEG, "");
  // Losse dashboard-attributen die in een mail niets doen of juist storen.
  h = h.replace(/\sclass="[^"]*"/gi, "").replace(/\sdata-[a-z-]+="[^"]*"/gi, "").replace(/\scontenteditable="[^"]*"/gi, "");
  // Stijl op elk element dat we kennen. Een bestaande style blijft staan en gaat
  // vóór, zodat bewuste opmaak uit de bron niet overschreven wordt.
  h = h.replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi, (heel, tag: string, rest: string) => {
    const stijl = STIJL[tag.toLowerCase()];
    if (!stijl) return heel;
    const bestaand = /\sstyle="([^"]*)"/i.exec(rest);
    const schoon = rest.replace(/\sstyle="[^"]*"/i, "");
    const samen = bestaand ? `${stijl};${bestaand[1]}` : stijl;
    return `<${tag}${schoon} style="${samen}">`;
  });
  // Alle links in een nieuw venster; een mailclient opent anders in zichzelf.
  h = h.replace(/<a\b(?![^>]*\btarget=)/gi, '<a target="_blank" rel="noreferrer" ');

  const kop = opties?.titel
    ? `<h1 style="${STIJL.h1};margin-top:0">${escape(opties.titel)}</h1>`
    : "";
  const intro = opties?.intro
    ? `<p style="${STIJL.p}">${escape(opties.intro).replace(/\n/g, "<br>")}</p>`
    : "";
  const voet = opties?.bron
    ? `<hr style="${STIJL.hr}"><p style="${STIJL.p};font-size:13px;color:${GRIJS}">${escape(opties.bron)}</p>`
    : "";

  // Eén tabel als buitenste omhulsel: dat is de enige lay-out waar elke
  // mailclient mee overweg kan (Outlook kent geen max-width op een div).
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#ffffff">
<tr><td align="left" style="padding:8px 0">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:660px;width:100%">
<tr><td style="font-family:${FONT};font-size:15px;line-height:1.62;color:${INKT}">
${kop}${intro}${h}${voet}
</td></tr></table></td></tr></table>`;
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
