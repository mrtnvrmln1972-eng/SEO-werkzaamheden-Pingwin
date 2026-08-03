// ═══════════════════════════════════════════════════════════
// WAT IEMAND ZELF SCHREEF, LOS VAN DE GECITEERDE GESCHIEDENIS
// ═══════════════════════════════════════════════════════════
// Onder elke reply hangt de hele thread. Dat is precies waarom het koppelen van
// mail aan een pagina misging: de mail van 25 juli ging over de SOA-test en een
// belafspraak, maar in de geciteerde geschiedenis eronder stond de mail van
// 14 juli mét het pad /crp-waarde-testen/ en de documentlinks. Wie de hele body
// leest, ziet dus in élke mail van de thread "hard bewijs" staan.
//
// Voor de vraag "gaat DEZE mail over deze pagina" telt alleen wat de afzender
// zelf getypt heeft. De geschiedenis eronder zegt iets over de thread, niet over
// deze mail.
// ═══════════════════════════════════════════════════════════

// Markers waar de geciteerde geschiedenis begint. Bewust ruim: Outlook, Gmail,
// Apple Mail, Superhuman en Roundcube schrijven het allemaal net anders op.
const QUOTE_MARKERS: RegExp[] = [
  // HTML-containers die mailprogramma's om een citaat zetten
  /<blockquote/i,
  /<div[^>]*class="[^"]*gmail_quote/i,
  /<div[^>]*id="[^"]*divRplyFwdMsg/i,
  /<div[^>]*id="[^"]*x_divRplyFwdMsg/i,
  /<div[^>]*id="[^"]*(?:x_)?replybody\d*/i,
  /<div[^>]*class="[^"]*moz-cite-prefix/i,
  /<hr[^>]*id="[^"]*stopSpelling/i,
  // Tekstuele inleidingen op een citaat
  /Begin doorgestuurd bericht\s*:/i,
  /-{2,}\s*Oorspronkelijk bericht\s*-{2,}/i,
  /-{2,}\s*Original Message\s*-{2,}/i,
  /-{2,}\s*Forwarded message\s*-{2,}/i,
  // "Op 25 jul 2026 om 08:46 heeft X het volgende geschreven:"
  /\bOp\s+\d{1,2}[^<]{0,40}\d{4}[^<]{0,40}\b(?:heeft|schreef)\b/i,
  // "Op za 25 jul 2026 om 09:59 schreef Clinic <...>:"
  /\bOp\s+\w{2,3}\s+\d{1,2}\s+\w{3,}[^<]{0,40}\bschreef\b/i,
  // "On Wed, Jul 22, 2026 at 22:11:59, Clinic <...> wrote:"
  /\bOn\s+\w{3},?\s+\w{3,}\s+\d{1,2},?\s+\d{4}[^<]{0,60}\bwrote\b/i,
  // "Clinic schreef op 15.7.2026 09:58:"
  /\b\w[^<]{0,40}\bschreef op\s+\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}/i,
  // Kop van een doorgestuurd bericht: "Van: ... Datum: ..." of "Van: ... Verzonden: ..."
  /<b[^>]*>\s*Van\s*:\s*<\/b>/i,
  /<strong[^>]*>\s*Van\s*:\s*<\/strong>/i,
  /\bVan\s*:\s*[^<\n]{3,80}(?:\n|<br)[^<\n]{0,40}(?:Datum|Verzonden|Sent)\s*:/i,
];

/**
 * Splitst een mailbody in het deel dat de afzender zelf schreef en de
 * geciteerde geschiedenis eronder. Vindt hij geen citaat, dan is alles "eigen".
 */
export function splitsMail(bodyHtml: string): { eigen: string; geciteerd: string } {
  const body = String(bodyHtml || "");
  if (!body) return { eigen: "", geciteerd: "" };

  let knip = -1;
  for (const re of QUOTE_MARKERS) {
    const m = re.exec(body);
    if (m && m.index >= 0 && (knip === -1 || m.index < knip)) knip = m.index;
  }
  if (knip === -1) return { eigen: body, geciteerd: "" };

  // Een citaat helemaal bovenaan betekent meestal dat de afzender bovenop een
  // doorgestuurd bericht niets heeft getypt. Dan is er geen eigen deel, en dat
  // is een eerlijker antwoord dan de hele geschiedenis als "eigen" beschouwen.
  return { eigen: body.slice(0, knip), geciteerd: body.slice(knip) };
}

/** Platte tekst uit HTML, met behoud van regelovergangen. */
export function naarTekst(html: string): string {
  return String(html || "")
    .replace(/<\s*(script|style)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\/(p|div|br|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Afsluitingen en handtekeningen dragen niets bij aan de vraag waar een mail
// over gaat, en vervuilen de kernzin in de tijdlijn.
const GROET = /\n\s*(met vriendelijke groet|vriendelijke groet|groetjes|groet|hartelijke groet|mvg|met hartelijke groet|dank alvast|bedankt alvast)\b[\s\S]*$/i;

// ── Ruis: automatische meldingen die geen gesprek zijn ──
//
// Bij One Day Clinic waren negen van de twintig "laatste mails" meldingen van
// Ahrefs, Search Console en een agenda-uitnodiging. Die verdringen de echte
// correspondentie, zowel in de chat als bij het koppelen aan een pagina.
//
// Dit filter kijkt naar de AFZENDER en het SOORT bericht, nooit naar de inhoud.
// Mail van de klant, van onszelf of van de sitebouwer valt hier dus nooit onder,
// ook niet als iemand toevallig over rankings schrijft.
const RUIS_AFZENDER = [
  /@ahrefs\.com$/i,
  /@semrush\.com$/i,
  /@moz\.com$/i,
  /@sitebulb\.com$/i,
  /@screamingfrog\.co\.uk$/i,
  /^sc-noreply@google\.com$/i,          // Search Console
  /^analytics-noreply@google\.com$/i,
  /^noreply(-|@)/i,
  /^no-reply(-|@)/i,
  /^donotreply@/i,
  /^notifications?@/i,
  /^mailer-daemon@/i,
];

// Agenda-uitnodigingen komen van een echte collega, dus die herken je aan het
// bericht zelf en niet aan de afzender.
const RUIS_ONDERWERP = [
  /^(uitnodiging|invitation|invite)\s*:/i,
  /^(geaccepteerd|accepted|afgewezen|declined|tentatief|tentative)\s*:/i,
  /^(bijgewerkt|updated|geannuleerd|canceled|cancelled)\s*:.*\d{1,2}:\d{2}/i,
  /^automatisch antwoord\s*:/i,
  /^automatic reply\s*:/i,
  /^out of office/i,
];

/** Is dit een automatische melding in plaats van een gesprek? */
export function isRuisMail(m: { fromAddress?: string | null; subject?: string | null }): boolean {
  const van = (m.fromAddress || "").trim();
  if (van && RUIS_AFZENDER.some((re) => re.test(van))) return true;
  const onderwerp = (m.subject || "").trim();
  return !!onderwerp && RUIS_ONDERWERP.some((re) => re.test(onderwerp));
}

/** Het eigen deel van een mail als leesbare tekst, zonder handtekening. */
export function eigenTekst(bodyHtml: string, preview = "", max = 1200): string {
  const { eigen } = splitsMail(bodyHtml);
  let t = naarTekst(eigen);
  // Niets eigen gevonden (bijv. een kale doorstuurmail): val terug op de preview,
  // want die toont in mailprogramma's ook het bovenste stukje.
  if (t.length < 3) t = naarTekst(preview);
  return t.replace(GROET, "").trim().slice(0, max);
}
